import { put, list, del } from '@vercel/blob';
import webpush from 'web-push';
import crypto from 'crypto';

/* ═══════════════════════════════════════════════════════════════
   STORAGE LAYER — Hybrid (Upstash Redis + Cloudflare R2 + Blob)
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM = (process.env.STORAGE_PREFIX || 'basma').trim();
const PFX_REDIS = SYSTEM + ':';      // basma:employees
const PFX = SYSTEM + '_';             // basma_employees.json (Blob/backward-compat)

// Upstash Redis
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// Cloudflare R2
const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY = (process.env.R2_ACCESS_KEY_ID || '').trim();
const R2_SECRET_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const R2_BUCKET = (process.env.R2_BUCKET || 'hma-storage').trim();
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();
const USE_R2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);

/* ────── Upstash Redis Wrappers ────── */
async function redisRequest(command, ...args) {
  var body = JSON.stringify([command, ...args]);
  var r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: body,
  });
  if (!r.ok) throw new Error('Redis ' + command + ' failed: ' + r.status);
  var data = await r.json();
  return data.result;
}

async function redisGet(key) {
  var val = await redisRequest('GET', PFX_REDIS + key);
  if (!val) return null;
  try { return JSON.parse(val); } catch(e) { return val; }
}

/* MGET: fetch multiple keys in chunks (Upstash has payload limits) */
async function redisMget(keys) {
  if (!keys || keys.length === 0) return [];
  var results = [];
  var CHUNK = 25; // Safe chunk size for Upstash REST API
  for (var i = 0; i < keys.length; i += CHUNK) {
    var chunk = keys.slice(i, i + CHUNK);
    var prefixedKeys = chunk.map(function(k){ return PFX_REDIS + k; });
    try {
      var vals = await redisRequest('MGET', ...prefixedKeys);
      if (!Array.isArray(vals)) {
        // Fallback for this chunk
        for (var j = 0; j < chunk.length; j++) results.push(null);
        continue;
      }
      for (var k = 0; k < vals.length; k++) {
        var v = vals[k];
        if (!v) { results.push(null); continue; }
        try { results.push(JSON.parse(v)); } catch(e) { results.push(v); }
      }
    } catch(e) {
      console.error('[redisMget chunk] failed:', e.message);
      // Fallback: sequential GETs for this chunk
      for (var m = 0; m < chunk.length; m++) {
        try {
          var single = await redisGet(chunk[m]);
          results.push(single);
        } catch(e2) { results.push(null); }
      }
    }
  }
  return results;
}

async function redisSet(key, data) {
  var payload = typeof data === 'string' ? data : JSON.stringify(data);
  await redisRequest('SET', PFX_REDIS + key, payload);
  return true;
}

async function redisDel(key) {
  await redisRequest('DEL', PFX_REDIS + key);
  return true;
}

/* ────── Vercel Blob Wrappers (Fallback) ────── */
async function blobGet(t) {
  try {
    const { blobs } = await list({ prefix: PFX + t + '.json' });
    if (!blobs.length) return null;
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch(e) { console.error('[BLOB GET] ' + t + ':', e.message); return null; }
}

async function blobSet(t, d) {
  try {
    await put(PFX + t + '.json', JSON.stringify(d), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
    });
    return true;
  } catch(e) { console.error('[BLOB SET] ' + t + ':', e.message); return false; }
}

/* ────── Unified DB interface (Redis primary, Blob fallback) ────── */
async function dbGet(t) {
  if (USE_REDIS) {
    try {
      var v = await redisGet(t);
      if (v !== null) return v;
      // Fallback: try blob for migration support
      var blobVal = await blobGet(t);
      if (blobVal !== null) {
        // Auto-migrate to Redis
        redisSet(t, blobVal).catch(function(){});
        return blobVal;
      }
      return null;
    } catch(e) {
      console.error('[DB GET Redis] ' + t + ':', e.message);
      return await blobGet(t);
    }
  }
  return await blobGet(t);
}

async function dbSet(t, d) {
  if (USE_REDIS) {
    try {
      await redisSet(t, d);
      // Write to Blob as backup unless disabled
      var disableBlobBackup = (process.env.DISABLE_BLOB_BACKUP || '').trim() === 'true';
      if (!disableBlobBackup) {
        blobSet(t, d).catch(function(){});
      }
      return true;
    } catch(e) {
      console.error('[DB SET Redis] ' + t + ':', e.message);
      return await blobSet(t, d);
    }
  }
  return await blobSet(t, d);
}

/* ────── Cloudflare R2 via AWS SigV4 ────── */
async function r2Sign(method, path, body, contentType) {
  var host = R2_ACCOUNT_ID + '.r2.cloudflarestorage.com';
  var url = 'https://' + host + '/' + R2_BUCKET + path;
  var date = new Date();
  var amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  var dateStamp = amzDate.slice(0, 8);

  var encoder = new TextEncoder();
  var bodyBytes = body instanceof Uint8Array ? body : typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body || []);
  var payloadHash = crypto.createHash('sha256').update(bodyBytes).digest('hex');

  var canonicalHeaders = 'host:' + host + '\n' +
                         'x-amz-content-sha256:' + payloadHash + '\n' +
                         'x-amz-date:' + amzDate + '\n';
  if (contentType) canonicalHeaders = 'content-type:' + contentType + '\n' + canonicalHeaders;
  var signedHeaders = contentType ? 'content-type;host;x-amz-content-sha256;x-amz-date' : 'host;x-amz-content-sha256;x-amz-date';
  var canonicalRequest = method + '\n/' + R2_BUCKET + path + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

  var region = 'auto';
  var service = 's3';
  var credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  var stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' +
                     crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  var kDate = crypto.createHmac('sha256', 'AWS4' + R2_SECRET_KEY).update(dateStamp).digest();
  var kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  var kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  var kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  var signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  var authorization = 'AWS4-HMAC-SHA256 Credential=' + R2_ACCESS_KEY + '/' + credentialScope +
                      ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  var headers = {
    'Authorization': authorization,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['Content-Type'] = contentType;
  return { url: url, headers: headers, body: bodyBytes };
}

async function r2Upload(key, data, contentType) {
  if (!USE_R2) return null;
  contentType = contentType || 'application/octet-stream';
  var signed = await r2Sign('PUT', '/' + key, data, contentType);
  var r = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: signed.body });
  if (!r.ok) {
    var text = await r.text().catch(function(){ return ''; });
    throw new Error('R2 upload failed: ' + r.status + ' ' + text);
  }
  var publicUrl = R2_PUBLIC_URL ? R2_PUBLIC_URL + '/' + key : signed.url;
  return { key: key, url: publicUrl };
}

async function r2Delete(key) {
  if (!USE_R2) return false;
  var signed = await r2Sign('DELETE', '/' + key, '');
  var r = await fetch(signed.url, { method: 'DELETE', headers: signed.headers });
  return r.ok;
}


// ═══ Web Push helper ═══
var vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  var pubKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  var privKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pubKey || !privKey) return false;
  try {
    webpush.setVapidDetails(
      'mailto:' + ((process.env.VAPID_CONTACT_EMAIL || 'admin@hma.engineer').trim()),
      pubKey,
      privKey
    );
    vapidConfigured = true;
    return true;
  } catch(e) {
    console.error('[VAPID CONFIG ERROR]', e.message);
    return false;
  }
}

async function sendWebPush(subscription, payload) {
  if (!configureVapid()) return { sent: false, reason: 'VAPID not configured' };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { sent: true, reason: 'delivered' };
  } catch (err) {
    return { sent: false, reason: 'push error: ' + (err.statusCode || err.message || String(err)) };
  }
}


// Cleanup function — delete all duplicate blobs, keep only latest of each
async function dbCleanup() {
  try {
    var allBlobs = [];
    var cursor = undefined;
    // Paginate through all blobs
    do {
      var result = await list({ prefix: PFX, cursor, limit: 1000 });
      allBlobs = allBlobs.concat(result.blobs);
      cursor = result.cursor;
    } while (cursor);

    // Group by pathname
    var groups = {};
    for (var b of allBlobs) {
      if (!groups[b.pathname]) groups[b.pathname] = [];
      groups[b.pathname].push(b);
    }

    var deleted = 0;
    for (var pathname in groups) {
      var blobs = groups[pathname];
      if (blobs.length <= 1) continue;
      // Sort by date, keep latest
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      // Delete all except the latest
      for (var i = 1; i < blobs.length; i++) {
        await del(blobs[i].url);
        deleted++;
      }
    }
    return { ok: true, totalFound: allBlobs.length, deleted, remaining: allBlobs.length - deleted };
  } catch(e) { return { ok: false, error: e.message }; }
}

const INIT_BRANCHES = [
  { id: "jed", name: "جدة", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 21.5433, lng: 39.1728 },
  { id: "riy", name: "الرياض", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 24.7136, lng: 46.6753 },
  { id: "ist", name: "اسطنبول", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Europe/Istanbul", radius: 200, lat: 41.0082, lng: 28.9784 },
  { id: "gaz", name: "غازي عنتاب", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Europe/Istanbul", radius: 120, lat: 37.0662, lng: 37.3833 },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;
  try {
    switch (action) {

      case 'init': {
        const ex = await dbGet('employees');
        if (ex && ex.length > 0) return res.json({ ok: true, msg: 'exists', count: ex.length });
        // NO LONGER seeds INIT_EMP — employees come from kadwar via sync-kadwar
        await dbSet('employees', []);
        await dbSet('branches', INIT_BRANCHES);
        await dbSet('attendance', []);
        await dbSet('violations', []);
        await dbSet('warnings', []);
        await dbSet('leaves', []);
        await dbSet('dependents', []);
        await dbSet('tickets', []);
        await dbSet('projects', []);
        await dbSet('delegations', []);
        await dbSet('exceptions', []);
        await dbSet('events', []);
        await dbSet('manual_attendance', []);
        await dbSet('settings', { breakRandomMin: 2, breakRandomMax: 7, autoCheckoutDelay: 5, callRetryDelay: 10 });
        // Auto-trigger first sync from kadwar
        try {
          var syncR = await fetch('https://hma.engineer/api/basma-sync?action=employees');
          if (syncR.ok) {
            var syncData = await syncR.json();
            if (syncData && Array.isArray(syncData.employees)) {
              return res.json({ ok: true, msg: 'initialized + synced', employeesFromKadwar: syncData.employees.length, note: 'call action=sync-kadwar to complete' });
            }
          }
        } catch(e) { /* silent */ }
        return res.json({ ok: true, msg: 'initialized (employees empty — call action=sync-kadwar)' });
      }

      /* v6.61 — WebAuthn Biometric login endpoints */
      case 'biometric-register-challenge': {
        // Returns a challenge for the browser to sign with the biometric key
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId) return res.status(400).json({ error: 'empId required' });
        const emps = await dbGet('employees') || [];
        const emp = emps.find(function(e){ return e.id === body.empId; });
        if (!emp) return res.status(404).json({ error: 'employee not found' });

        // Generate random challenge (32 bytes base64url)
        const crypto = await import('crypto');
        const challenge = crypto.randomBytes(32).toString('base64url');

        // Store challenge temporarily (valid 5 min)
        const challenges = (await dbGet('biometric_challenges')) || {};
        challenges[body.empId] = { challenge: challenge, expires: Date.now() + 5 * 60 * 1000 };
        // Clean expired
        Object.keys(challenges).forEach(function(k){
          if (challenges[k].expires < Date.now()) delete challenges[k];
        });
        await dbSet('biometric_challenges', challenges);

        return res.json({
          challenge: challenge,
          rp: { name: 'بصمة HMA', id: body.rpId || 'b.hma.engineer' },
          user: {
            id: Buffer.from(String(body.empId)).toString('base64url'),
            name: emp.email || emp.username || body.empId,
            displayName: emp.name || body.empId,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Use device's built-in biometric
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        });
      }

      case 'biometric-register-verify': {
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId || !body.credential) return res.status(400).json({ error: 'empId and credential required' });

        // Simple verification: trust the browser's signature for now (production would verify attestation)
        const credentials = (await dbGet('biometric_credentials')) || {};
        if (!credentials[body.empId]) credentials[body.empId] = [];

        // Check if credential ID already exists
        const credId = body.credential.id;
        const existing = credentials[body.empId].find(function(c){ return c.credentialId === credId; });
        if (existing) {
          return res.json({ ok: true, message: 'already registered', device: existing });
        }

        var device = {
          credentialId: credId,
          publicKey: body.credential.response && body.credential.response.publicKey ? body.credential.response.publicKey : '',
          deviceName: body.deviceName || 'جهاز غير مسمى',
          userAgent: body.userAgent || '',
          platform: body.platform || '',
          registeredAt: new Date().toISOString(),
          lastUsed: null,
        };
        credentials[body.empId].push(device);
        await dbSet('biometric_credentials', credentials);

        return res.json({ ok: true, device: device });
      }

      case 'biometric-login-challenge': {
        // Returns challenge + allowed credentials for a given user
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId) return res.status(400).json({ error: 'empId required' });

        const credentials = (await dbGet('biometric_credentials')) || {};
        const userCreds = credentials[body.empId] || [];
        if (userCreds.length === 0) return res.status(404).json({ error: 'لا يوجد بصمة مسجّلة لهذا المستخدم' });

        const crypto = await import('crypto');
        const challenge = crypto.randomBytes(32).toString('base64url');

        const challenges = (await dbGet('biometric_challenges')) || {};
        challenges[body.empId] = { challenge: challenge, expires: Date.now() + 5 * 60 * 1000, type: 'login' };
        await dbSet('biometric_challenges', challenges);

        return res.json({
          challenge: challenge,
          allowCredentials: userCreds.map(function(c){
            return { type: 'public-key', id: c.credentialId, transports: ['internal'] };
          }),
          timeout: 60000,
          userVerification: 'required',
        });
      }

      case 'biometric-login-verify': {
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId || !body.credential) return res.status(400).json({ error: 'بيانات ناقصة' });

        // Verify challenge exists and matches
        const challenges = (await dbGet('biometric_challenges')) || {};
        const stored = challenges[body.empId];
        if (!stored || stored.type !== 'login' || stored.expires < Date.now()) {
          return res.status(400).json({ error: 'انتهت صلاحية التحدي — حاول مرة أخرى' });
        }

        // Verify credential exists for user
        const credentials = (await dbGet('biometric_credentials')) || {};
        const userCreds = credentials[body.empId] || [];
        const cred = userCreds.find(function(c){ return c.credentialId === body.credential.id; });
        if (!cred) return res.status(401).json({ error: 'بصمة غير مُسجّلة' });

        // Update lastUsed
        cred.lastUsed = new Date().toISOString();
        await dbSet('biometric_credentials', credentials);

        // Delete used challenge
        delete challenges[body.empId];
        await dbSet('biometric_challenges', challenges);

        // Return full employee data (same as login endpoint)
        const emps = await dbGet('employees') || [];
        const emp = emps.find(function(e){ return e.id === body.empId; });
        if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

        const safeEmp = Object.assign({}, emp);
        delete safeEmp.passwordHash;
        delete safeEmp.password;
        delete safeEmp.passwordSalt;

        return res.json({ ok: true, employee: safeEmp, biometricUsed: true });
      }

      case 'biometric-devices': {
        // GET: list devices for user · DELETE: remove a device
        const body = req.method === 'GET' ? req.query : (req.body || {});
        if (!body.empId) return res.status(400).json({ error: 'empId required' });

        const credentials = (await dbGet('biometric_credentials')) || {};
        if (req.method === 'GET') {
          var list = (credentials[body.empId] || []).map(function(c){
            return {
              credentialId: c.credentialId,
              deviceName: c.deviceName,
              platform: c.platform,
              registeredAt: c.registeredAt,
              lastUsed: c.lastUsed,
            };
          });
          return res.json(list);
        }
        if (req.method === 'DELETE') {
          if (!body.credentialId) return res.status(400).json({ error: 'credentialId required' });
          credentials[body.empId] = (credentials[body.empId] || []).filter(function(c){
            return c.credentialId !== body.credentialId;
          });
          await dbSet('biometric_credentials', credentials);
          return res.json({ ok: true });
        }
        break;
      }

      case 'login': {
        var body = req.body || {};
        var loginId = (body.username || body.empId || body.email || '').toLowerCase().trim();
        var password = body.password || body.code || '';
        if (!loginId || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

        // 1. Check general manager (admin) — stored in basma
        var admin = await dbGet('admin_config');
        if (admin && admin.email && admin.email === loginId) {
          if (admin.password !== password) return res.status(401).json({ error: 'كلمة المرور خاطئة' });
          return res.json({ ok: true, employee: {
            id: admin.email, email: admin.email,
            name: admin.name || 'المدير العام',
            role: admin.role || 'المدير العام',
            branch: 'jed',
            isGeneralManager: true, isManager: true, isAdmin: true,
          }});
        }

        // 2. Regular employee — username + SHA256 password verification
        var emps = await dbGet('employees') || [];
        var emp = emps.find(function(x) {
          if (!x) return false;
          if ((x.username || '').toLowerCase() === loginId) return true;
          if ((x.email || '').toLowerCase() === loginId) return true;
          if (String(x.idNumber || '') === loginId) return true;
          return false;
        });
        if (!emp) return res.status(404).json({ error: 'المستخدم غير موجود — راجع المشرف لإنشاء حسابك في كوادر' });
        if (emp.hasAccount === false) return res.status(403).json({ error: 'راجع المشرف لإنشاء حسابك في كوادر' });

        // Verify SHA256(password + salt) === passwordHash
        var storedHash = emp.passwordHash || '';
        var salt = emp.passwordSalt || 'hr_salt_2024';
        if (!storedHash) return res.status(403).json({ error: 'لم تتم مزامنة كلمة المرور بعد — راجع المشرف' });

        // Compute SHA256 using Node crypto
        var crypto = await import('crypto');
        var computed = crypto.createHash('sha256').update(password + salt).digest('hex');
        if (computed.toLowerCase() !== String(storedHash).toLowerCase()) {
          return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        }
        // Don't return password hash back to client
        var safeEmp = Object.assign({}, emp);
        delete safeEmp.passwordHash;
        delete safeEmp.password;
        delete safeEmp.passwordSalt;
        return res.json({ ok: true, employee: safeEmp });
      }

      case 'employees': {
        if (req.method === 'GET') return res.json(await dbGet('employees') || []);
        if (req.method === 'PUT') {
          const emps = await dbGet('employees') || [];
          const { id, ...up } = req.body;
          const i = emps.findIndex(e => e.id === id);
          if (i >= 0) { emps[i] = { ...emps[i], ...up }; await dbSet('employees', emps); }
          return res.json({ ok: true });
        }
        if (req.method === 'POST') {
          const emps = await dbGet('employees') || [];
          emps.push(req.body);
          await dbSet('employees', emps);
          return res.json({ ok: true });
        }
        break;
      }

      case 'checkin': {
        const { empId, type, lat, lng, facePhoto } = req.body || {};
        const recs = await dbGet('attendance') || [];
        const rec = { id: 'A' + Date.now(), empId, type, lat, lng, facePhoto: facePhoto ? '[captured]' : null, ts: new Date().toISOString(), date: new Date().toISOString().split('T')[0] };
        recs.push(rec);
        await dbSet('attendance', recs);
        // Add points
        const emps = await dbGet('employees') || [];
        const ei = emps.findIndex(e => e.id === empId);
        if (ei >= 0) { emps[ei].points = (emps[ei].points || 0) + 10; await dbSet('employees', emps); }
        return res.json({ ok: true, record: rec });
      }

      case 'face': {
        if (req.method === 'GET') {
          const faceId = req.query.empId;
          // Admin: list all enrolled employees
          if (req.query.listAll === '1') {
            const faces = await dbGet('faces') || {};
            return res.json({ ok: true, enrolled: Object.keys(faces) });
          }
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          if (faces[faceId]) return res.json({ ok: true, descriptor: faces[faceId] });
          return res.json({ ok: false });
        }
        if (req.method === 'POST') {
          const { empId, descriptor } = req.body || {};
          if (!empId || !descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) return res.status(400).json({ error: 'empId + descriptor[128] required' });
          const faces = await dbGet('faces') || {};
          // Check if similar face exists for another employee — notify admin, don't block
          var similarFound = null;
          for (const [existingId, existingDesc] of Object.entries(faces)) {
            if (existingId === empId) continue;
            if (!Array.isArray(existingDesc) || existingDesc.length !== 128) continue;
            let sum = 0;
            for (let i = 0; i < 128; i++) sum += (descriptor[i] - existingDesc[i]) ** 2;
            const dist = Math.sqrt(sum);
            if (dist < 0.35) { similarFound = { empId: existingId, distance: dist }; break; }
          }
          // Save the face regardless
          faces[empId] = descriptor;
          await dbSet('faces', faces);
          // If similar face found, create admin notification
          if (similarFound) {
            const violations = await dbGet('violations') || [];
            violations.push({ id: 'V' + Date.now(), status: 'open', empId, type: 'similar_face', details: 'تنبيه: وجه مشابه للموظف ' + similarFound.empId + ' (المسافة: ' + similarFound.distance.toFixed(3) + ') — قد يكون توأم أو قريب', date: new Date().toISOString().split('T')[0], ts: new Date().toISOString() });
            await dbSet('violations', violations);
            return res.json({ ok: true, warning: 'similar_face', matchedEmpId: similarFound.empId });
          }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const faceId = req.query.empId;
          if (faceId === 'ALL') {
            // Admin: clear all faces
            await dbSet('faces', {});
            return res.json({ ok: true, msg: 'all faces cleared' });
          }
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          delete faces[faceId];
          await dbSet('faces', faces);
          return res.json({ ok: true });
        }
        return res.json({ error: 'method not allowed' });
      }

      case 'attendance': {
        let recs = await dbGet('attendance') || [];
        const { empId, date, from, to } = req.query;
        if (empId) recs = recs.filter(r => r.empId === empId);
        if (date) recs = recs.filter(r => r.date === date);
        if (from) recs = recs.filter(r => r.date >= from);
        if (to) recs = recs.filter(r => r.date <= to);
        return res.json(recs);
      }

      /* v6.58 — Attendance period locks (for payroll finalization) */
      case 'attendance-locks': {
        if (req.method === 'GET') {
          var locks = (await dbGet('attendance_locks')) || [];
          return res.json(locks);
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          if (!body.month) return res.status(400).json({ error: 'month required (e.g. 2026-04)' });
          var locks = (await dbGet('attendance_locks')) || [];
          // Check if already locked
          var existing = locks.find(function(l){ return l.month === body.month; });
          if (existing) return res.status(400).json({ error: 'هذا الشهر مقفل بالفعل' });
          locks.push({
            month: body.month,
            lockedBy: body.lockedBy || 'admin',
            lockedAt: new Date().toISOString(),
            note: body.note || '',
          });
          await dbSet('attendance_locks', locks);
          return res.json({ ok: true, lock: locks[locks.length - 1] });
        }
        if (req.method === 'DELETE') {
          var body = req.body || {};
          if (!body.month) return res.status(400).json({ error: 'month required' });
          var locks = (await dbGet('attendance_locks')) || [];
          locks = locks.filter(function(l){ return l.month !== body.month; });
          await dbSet('attendance_locks', locks);
          return res.json({ ok: true });
        }
        break;
      }

      case 'manual_checkin': {
        const { empId, type, date, adminId } = req.body || {};
        // v6.58 — Check if the month is locked
        if (date) {
          var month = String(date).substring(0, 7); // "2026-04"
          var locks = (await dbGet('attendance_locks')) || [];
          if (locks.some(function(l){ return l.month === month; })) {
            return res.status(403).json({ error: 'هذا الشهر (' + month + ') مقفل — فك القفل أولاً لتعديل الحضور' });
          }
        }
        const recs = await dbGet('manual_attendance') || [];
        recs.push({ id: 'M' + Date.now(), empId, type, date, adminId, ts: new Date().toISOString(), manual: true });
        await dbSet('manual_attendance', recs);
        // Also add to regular attendance
        const att = await dbGet('attendance') || [];
        att.push({ id: 'MA' + Date.now(), empId, type, date, ts: new Date().toISOString(), manual: true, adminId });
        await dbSet('attendance', att);
        return res.json({ ok: true });
      }

      case 'branches': {
        if (req.method === 'GET') return res.json(await dbGet('branches') || INIT_BRANCHES);
        if (req.method === 'PUT') { await dbSet('branches', req.body); return res.json({ ok: true }); }
        if (req.method === 'POST') { const bs = await dbGet('branches') || []; bs.push(req.body); await dbSet('branches', bs); return res.json({ ok: true }); }
        break;
      }

      case 'projects': {
        if (req.method === 'GET') return res.json(await dbGet('projects') || []);
        if (req.method === 'POST') { const ps = await dbGet('projects') || []; ps.push({ id: 'P' + Date.now(), ...req.body }); await dbSet('projects', ps); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ps = await dbGet('projects') || [];
          const { id, ...up } = req.body;
          const i = ps.findIndex(p => p.id === id);
          if (i >= 0) { ps[i] = { ...ps[i], ...up }; await dbSet('projects', ps); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') { const ps = await dbGet('projects') || []; await dbSet('projects', ps.filter(p => p.id !== req.query.id)); return res.json({ ok: true }); }
        break;
      }

      case 'delegations': {
        if (req.method === 'GET') return res.json(await dbGet('delegations') || []);
        if (req.method === 'POST') { const ds = await dbGet('delegations') || []; ds.push({ id: 'D' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('delegations', ds); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ds = await dbGet('delegations') || [];
          const { id, status } = req.body;
          const i = ds.findIndex(d => d.id === id);
          if (i >= 0) { ds[i].status = status; ds[i].decidedAt = new Date().toISOString(); await dbSet('delegations', ds); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'exceptions': {
        if (req.method === 'GET') return res.json(await dbGet('exceptions') || []);
        if (req.method === 'POST') { const es = await dbGet('exceptions') || []; es.push({ id: 'EX' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('exceptions', es); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const es = await dbGet('exceptions') || [];
          const { id, status } = req.body;
          const i = es.findIndex(e => e.id === id);
          if (i >= 0) { es[i].status = status; await dbSet('exceptions', es); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'leaves': {
        if (req.method === 'GET') return res.json(await dbGet('leaves') || []);
        if (req.method === 'POST') {
          // v6.37 — enhanced submit: compute days + notify manager + validate balance
          var lbody = req.body || {};
          var ls = await dbGet('leaves') || [];
          var now = new Date();
          // Compute number of days (inclusive)
          var daysCount = 1;
          if (lbody.from && lbody.to) {
            var fromD = new Date(lbody.from);
            var toD = new Date(lbody.to);
            daysCount = Math.max(1, Math.round((toD - fromD) / (24*3600*1000)) + 1);
          }
          var newLeave = { id: 'L' + Date.now(), status: 'pending', ...lbody, days: daysCount, ts: now.toISOString() };
          ls.push(newLeave);
          await dbSet('leaves', ls);

          // Notify manager + HR in-app
          (async function(){
            try {
              var emps = (await dbGet('employees')) || [];
              var emp = emps.find(function(e){ return e.id === lbody.empId; });
              var managerId = emp && (emp.managerId || emp.supervisorId);
              var hrIds = emps.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
              var targets = [];
              if (managerId) targets.push(managerId);
              hrIds.forEach(function(id){ if (targets.indexOf(id) < 0) targets.push(id); });

              var leaveTypeLbl = { annual:'سنوية', sick:'مرضية', emergency:'طارئة', personal:'شخصية' }[lbody.type] || 'إجازة';
              var notifs = (await dbGet('notifications')) || [];
              var nowISO = now.toISOString();
              targets.forEach(function(tid){
                notifs.push({
                  id: 'n_lvreq_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  empId: tid,
                  type: 'leave_request',
                  title: '📝 طلب إجازة جديد',
                  message: (emp && emp.name ? emp.name : 'موظف') + ' طلب إجازة ' + leaveTypeLbl + ' (' + daysCount + ' يوم)',
                  leaveId: newLeave.id,
                  targetEmpId: lbody.empId,
                  read: false,
                  createdAt: nowISO,
                });
              });
              if (notifs.length > 1000) notifs = notifs.slice(-1000);
              await dbSet('notifications', notifs);

              // Push notification to manager
              if (managerId) {
                try {
                  var pushSubs = (await dbGet('push_subscriptions')) || {};
                  var sub = pushSubs[managerId];
                  if (sub && sub.subscription) {
                    await sendWebPush(sub.subscription, {
                      title: '📝 طلب إجازة جديد',
                      body: (emp && emp.name ? emp.name : 'موظف') + ' طلب ' + leaveTypeLbl + ' (' + daysCount + ' يوم)',
                      tag: 'leave-' + newLeave.id,
                      data: { leaveId: newLeave.id, type: 'leave_request' },
                    });
                  }
                } catch(ePush) { /* silent */ }
              }
            } catch(e) { /* silent */ }
          })();

          return res.json({ ok: true, leave: newLeave, days: daysCount });
        }
        if (req.method === 'PUT') {
          // v6.37 — enhanced approve/reject: auto-deduct balance + notify employee
          const ls = await dbGet('leaves') || [];
          const { id, status, rejectReason } = req.body;
          const i = ls.findIndex(l => l.id === id);
          if (i < 0) return res.status(404).json({ error: 'الطلب غير موجود' });

          var leave = ls[i];
          var prevStatus = leave.status;
          leave.status = status;
          leave.decidedAt = new Date().toISOString();
          if (rejectReason) leave.rejectReason = rejectReason;

          // Auto-deduct balance on approval (only if moving to approved state)
          if (status === 'approved' && prevStatus !== 'approved' && leave.type) {
            var balances = (await dbGet('leave_balances')) || {};
            var curYear = new Date().getFullYear();
            var empBal = balances[leave.empId] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear };
            if (empBal.year !== curYear) {
              // Year rolled over — reset defaults
              empBal = { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear };
            }
            var days = leave.days || 1;
            if (empBal[leave.type] !== undefined) {
              empBal[leave.type] = Math.max(0, empBal[leave.type] - days);
            }
            balances[leave.empId] = empBal;
            await dbSet('leave_balances', balances);
          }

          // Reverse deduction if moving FROM approved
          if (prevStatus === 'approved' && status !== 'approved' && leave.type) {
            var balances2 = (await dbGet('leave_balances')) || {};
            var curYear2 = new Date().getFullYear();
            var empBal2 = balances2[leave.empId] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear2 };
            if (empBal2.year !== curYear2) empBal2 = { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear2 };
            var daysRev = leave.days || 1;
            if (empBal2[leave.type] !== undefined) {
              empBal2[leave.type] = empBal2[leave.type] + daysRev;
            }
            balances2[leave.empId] = empBal2;
            await dbSet('leave_balances', balances2);
          }

          await dbSet('leaves', ls);

          // Notify employee
          (async function(){
            try {
              var notifs = (await dbGet('notifications')) || [];
              var nowISO = new Date().toISOString();
              var leaveTypeLbl2 = { annual:'السنوية', sick:'المرضية', emergency:'الطارئة', personal:'الشخصية' }[leave.type] || '';
              var titleStr = status === 'approved' ? '✅ تمت الموافقة على إجازتك' : status === 'rejected' ? '❌ تم رفض طلب الإجازة' : '🔄 تحديث على طلب الإجازة';
              var msgStr = status === 'approved'
                ? 'تمت الموافقة على الإجازة ' + leaveTypeLbl2 + ' (' + (leave.days || 1) + ' يوم). إجازة سعيدة!'
                : status === 'rejected'
                ? 'تم رفض طلب الإجازة ' + leaveTypeLbl2 + (rejectReason ? '. السبب: ' + rejectReason : '. راجع مديرك.')
                : 'تم تحديث طلب الإجازة.';
              notifs.push({
                id: 'n_lvres_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                empId: leave.empId,
                type: 'leave_response',
                title: titleStr,
                message: msgStr,
                leaveId: leave.id,
                read: false,
                createdAt: nowISO,
              });
              if (notifs.length > 1000) notifs = notifs.slice(-1000);
              await dbSet('notifications', notifs);

              // Push
              try {
                var pushSubs = (await dbGet('push_subscriptions')) || {};
                var sub = pushSubs[leave.empId];
                if (sub && sub.subscription) {
                  await sendWebPush(sub.subscription, { title: titleStr, body: msgStr, tag: 'leave-resp-' + leave.id, data: { leaveId: leave.id, type: 'leave_response' } });
                }
              } catch(e){}
            } catch(e){}
          })();

          return res.json({ ok: true, leave: leave });
        }
        break;
      }

      /* ═══ v6.37 — LEAVE BALANCE (رصيد الإجازات) ═══ */
      case 'leave-balance': {
        if (req.method === 'GET') {
          var empIdLB = req.query.empId;
          if (!empIdLB) return res.status(400).json({ error: 'empId مطلوب' });
          var balancesLB = (await dbGet('leave_balances')) || {};
          var curYearLB = new Date().getFullYear();
          var empBalLB = balancesLB[empIdLB] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYearLB };
          // Auto-reset on new year
          if (empBalLB.year !== curYearLB) {
            empBalLB = { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYearLB };
            balancesLB[empIdLB] = empBalLB;
            await dbSet('leave_balances', balancesLB);
          }
          return res.json(empBalLB);
        }
        if (req.method === 'PUT') {
          // Admin-only: adjust balance
          var bodyLB = req.body || {};
          var balancesLB2 = (await dbGet('leave_balances')) || {};
          var curYearLB2 = new Date().getFullYear();
          var empBalLB2 = balancesLB2[bodyLB.empId] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYearLB2 };
          if (bodyLB.annual !== undefined) empBalLB2.annual = Math.max(0, parseInt(bodyLB.annual, 10));
          if (bodyLB.sick !== undefined) empBalLB2.sick = Math.max(0, parseInt(bodyLB.sick, 10));
          if (bodyLB.emergency !== undefined) empBalLB2.emergency = Math.max(0, parseInt(bodyLB.emergency, 10));
          if (bodyLB.personal !== undefined) empBalLB2.personal = Math.max(0, parseInt(bodyLB.personal, 10));
          empBalLB2.year = curYearLB2;
          balancesLB2[bodyLB.empId] = empBalLB2;
          await dbSet('leave_balances', balancesLB2);
          return res.json({ ok: true, balance: empBalLB2 });
        }
        break;
      }

      case 'violations': {
        if (req.method === 'GET') {
          let vs = await dbGet('violations') || [];
          const { empId } = req.query;
          if (empId) vs = vs.filter(v => v.empId === empId);
          return res.json(vs);
        }
        if (req.method === 'POST') { const vs = await dbGet('violations') || []; vs.push({ id: 'V' + Date.now(), status: 'open', ...req.body, ts: new Date().toISOString() }); await dbSet('violations', vs); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const vs = await dbGet('violations') || [];
          const { id, ...up } = req.body;
          const i = vs.findIndex(v => v.id === id);
          if (i >= 0) { vs[i] = { ...vs[i], ...up, updatedAt: new Date().toISOString() }; await dbSet('violations', vs); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'warnings': {
        if (req.method === 'GET') {
          let ws = await dbGet('warnings') || [];
          const { empId } = req.query;
          if (empId) ws = ws.filter(w => w.empId === empId);
          return res.json(ws);
        }
        if (req.method === 'POST') { const ws = await dbGet('warnings') || []; ws.push({ id: 'W' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('warnings', ws); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ws = await dbGet('warnings') || [];
          const { id, ...up } = req.body;
          const i = ws.findIndex(w => w.id === id);
          if (i >= 0) { ws[i] = { ...ws[i], ...up, updatedAt: new Date().toISOString() }; await dbSet('warnings', ws); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'pre_absence': {
        if (req.method === 'GET') return res.json(await dbGet('pre_absences') || []);
        if (req.method === 'POST') {
          const pas = await dbGet('pre_absences') || [];
          var newPA = { id: 'PA' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() };
          pas.push(newPA);
          await dbSet('pre_absences', pas);

          // v6.37 — Notify manager + HR
          (async function(){
            try {
              var emps = (await dbGet('employees')) || [];
              var emp = emps.find(function(e){ return e.id === newPA.empId; });
              var managerId = emp && (emp.managerId || emp.supervisorId);
              var hrIds = emps.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
              var targets = [];
              if (managerId) targets.push(managerId);
              hrIds.forEach(function(id){ if (targets.indexOf(id) < 0) targets.push(id); });

              var notifs = (await dbGet('notifications')) || [];
              var nowISO = new Date().toISOString();
              targets.forEach(function(tid){
                notifs.push({
                  id: 'n_pareq_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  empId: tid,
                  type: 'pre_absence_request',
                  title: '🏥 إفادة غياب بعذر',
                  message: (emp && emp.name ? emp.name : 'موظف') + ' قدّم إفادة غياب بعذر (' + (newPA.reason || 'بدون سبب محدد') + ')',
                  preAbsenceId: newPA.id,
                  targetEmpId: newPA.empId,
                  read: false,
                  createdAt: nowISO,
                });
              });
              if (notifs.length > 1000) notifs = notifs.slice(-1000);
              await dbSet('notifications', notifs);

              if (managerId) {
                try {
                  var pushSubs = (await dbGet('push_subscriptions')) || {};
                  var sub = pushSubs[managerId];
                  if (sub && sub.subscription) {
                    await sendWebPush(sub.subscription, {
                      title: '🏥 إفادة غياب بعذر',
                      body: (emp && emp.name ? emp.name : 'موظف') + ' قدّم إفادة غياب بعذر',
                      tag: 'preabs-' + newPA.id,
                      data: { id: newPA.id, type: 'pre_absence' },
                    });
                  }
                } catch(e) {}
              }
            } catch(e) {}
          })();

          return res.json({ ok: true, preAbsence: newPA });
        }
        break;
      }

      /* ═══ CUSTODY — نظام العهد المتطور (3 أنواع) ═══ */
      case 'custody': {
        if (req.method === 'GET') {
          let items = await dbGet('custody') || [];
          const { empId, type, status } = req.query || {};
          if (empId) items = items.filter(c => c.empId === empId);
          if (type) items = items.filter(c => c.type === type);
          if (status) items = items.filter(c => c.status === status);
          return res.json(items);
        }
        if (req.method === 'POST') {
          const items = await dbGet('custody') || [];
          const body = req.body || {};

          // Type-specific validation
          if (body.type === 'asset' && !body.serialNumber) {
            return res.status(400).json({ error: 'رقم السيريال مطلوب للعهد الدائمة' });
          }
          if (body.type === 'cash' && (!body.amount || body.amount <= 0)) {
            return res.status(400).json({ error: 'المبلغ مطلوب للعهد النقدية' });
          }

          const item = {
            id: 'CUS' + Date.now(),
            type: body.type || 'consumable',  // consumable | asset | cash
            name: body.name,
            category: body.category || '',
            empId: body.empId,
            empName: body.empName || '',

            // For assets
            serialNumber: body.serialNumber || '',
            photoUrl: body.photoUrl || '',
            brand: body.brand || '',
            model: body.model || '',
            condition: body.condition || 'new',

            // For consumables
            quantity: body.quantity || 1,
            unit: body.unit || 'قطعة',

            // For cash
            amount: parseFloat(body.amount) || 0,
            spent: 0,
            balance: parseFloat(body.amount) || 0,
            purpose: body.purpose || '',

            // Common
            value: parseFloat(body.value) || 0,
            status: body.type === 'consumable' ? 'issued' : 'active',
            notes: body.notes || '',
            issuedAt: new Date().toISOString(),
            issuedBy: body.issuedBy || '',
            returnedAt: null,
            closedAt: null,

            acknowledged: false,
            acknowledgedAt: null,
          };
          items.push(item);
          await dbSet('custody', items);
          return res.json({ ok: true, item });
        }
        if (req.method === 'PUT') {
          const items = await dbGet('custody') || [];
          const { id, ...up } = req.body;
          const i = items.findIndex(c => c.id === id);
          if (i < 0) return res.status(404).json({ error: 'العهدة غير موجودة' });
          items[i] = { ...items[i], ...up, updatedAt: new Date().toISOString() };
          await dbSet('custody', items);
          return res.json({ ok: true, item: items[i] });
        }
        if (req.method === 'DELETE') {
          const items = await dbGet('custody') || [];
          await dbSet('custody', items.filter(c => c.id !== req.query.id));
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ CUSTODY ACKNOWLEDGE — الموظف يوقّع استلام ═══ */
      case 'custody-ack': {
        if (req.method !== 'POST') return res.status(400).json({ error: 'POST required' });
        const body = req.body || {};
        const items = await dbGet('custody') || [];
        const i = items.findIndex(c => c.id === body.custodyId);
        if (i < 0) return res.status(404).json({ error: 'العهدة غير موجودة' });
        if (items[i].empId !== body.empId) return res.status(403).json({ error: 'ليست عهدتك' });
        items[i].acknowledged = true;
        items[i].acknowledgedAt = new Date().toISOString();
        await dbSet('custody', items);
        return res.json({ ok: true });
      }

      /* ═══ CUSTODY RETURN — إعادة عهدة دائمة ═══ */
      case 'custody-return': {
        if (req.method !== 'POST') return res.status(400).json({ error: 'POST required' });
        const body = req.body || {};
        const items = await dbGet('custody') || [];
        const i = items.findIndex(c => c.id === body.custodyId);
        if (i < 0) return res.status(404).json({ error: 'العهدة غير موجودة' });
        items[i].status = body.condition === 'damaged' ? 'damaged' : 'returned';
        items[i].returnedAt = new Date().toISOString();
        items[i].returnCondition = body.condition || 'good';
        items[i].returnNotes = body.notes || '';
        items[i].returnedBy = body.returnedBy || '';
        await dbSet('custody', items);
        return res.json({ ok: true, item: items[i] });
      }

      /* ═══ CUSTODY INVOICES — فواتير العهد النقدية ═══ */
      case 'custody-invoices': {
        if (req.method === 'GET') {
          let invoices = await dbGet('custody_invoices') || [];
          const { custodyId, empId } = req.query || {};
          if (custodyId) invoices = invoices.filter(i => i.custodyId === custodyId);
          if (empId) invoices = invoices.filter(i => i.empId === empId);
          return res.json(invoices);
        }
        if (req.method === 'POST') {
          const body = req.body || {};
          if (!body.custodyId || !body.amount || !body.description) {
            return res.status(400).json({ error: 'بيانات ناقصة' });
          }
          const invoices = await dbGet('custody_invoices') || [];
          const invoice = {
            id: 'INV' + Date.now(),
            custodyId: body.custodyId,
            empId: body.empId,
            amount: parseFloat(body.amount),
            description: body.description,
            vendor: body.vendor || '',
            invoiceDate: body.invoiceDate || new Date().toISOString().split('T')[0],
            invoiceNumber: body.invoiceNumber || '',
            photoUrl: body.photoUrl || '',
            status: 'pending',
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: '',
          };
          invoices.push(invoice);
          await dbSet('custody_invoices', invoices);
          return res.json({ ok: true, invoice });
        }
        if (req.method === 'PUT') {
          const body = req.body || {};
          const invoices = await dbGet('custody_invoices') || [];
          const i = invoices.findIndex(inv => inv.id === body.id);
          if (i < 0) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
          const oldStatus = invoices[i].status;
          invoices[i] = { ...invoices[i], ...body, reviewedAt: new Date().toISOString() };
          await dbSet('custody_invoices', invoices);

          // If approved, update custody spent/balance
          if (oldStatus !== 'approved' && body.status === 'approved') {
            const items = await dbGet('custody') || [];
            const idx = items.findIndex(c => c.id === invoices[i].custodyId);
            if (idx >= 0 && items[idx].type === 'cash') {
              items[idx].spent = (items[idx].spent || 0) + invoices[i].amount;
              items[idx].balance = (items[idx].amount || 0) - items[idx].spent;
              await dbSet('custody', items);
            }
          }
          return res.json({ ok: true, invoice: invoices[i] });
        }
        if (req.method === 'DELETE') {
          const invoices = await dbGet('custody_invoices') || [];
          await dbSet('custody_invoices', invoices.filter(i => i.id !== req.query.id));
          return res.json({ ok: true });
        }
        break;
      }

      case 'custody_maintenance': {
        if (req.method === 'GET') {
          let logs = await dbGet('custody_maint') || [];
          const { custodyId } = req.query;
          if (custodyId) logs = logs.filter(l => l.custodyId === custodyId);
          return res.json(logs);
        }
        if (req.method === 'POST') {
          const logs = await dbGet('custody_maint') || [];
          const body = req.body || {};
          var entry = {
            id: 'CM' + Date.now(),
            custodyId: body.custodyId,
            type: body.type || 'routine', // routine | repair | inspection | upgrade
            description: body.description || '',
            cost: parseFloat(body.cost) || 0,
            vendor: body.vendor || '',
            doneBy: body.doneBy || '',
            date: body.date || new Date().toISOString().split('T')[0],
            nextDueDate: body.nextDueDate || null,
            photos: body.photos || [],
            notes: body.notes || '',
            ts: new Date().toISOString(),
          };
          logs.push(entry);
          await dbSet('custody_maint', logs);
          return res.json({ ok: true, entry: entry });
        }
        if (req.method === 'PUT') {
          const logs = await dbGet('custody_maint') || [];
          const body = req.body || {};
          const i = logs.findIndex(function(l){ return l.id === body.id; });
          if (i < 0) return res.status(404).json({ error: 'not found' });
          logs[i] = Object.assign({}, logs[i], body);
          await dbSet('custody_maint', logs);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const logs = await dbGet('custody_maint') || [];
          const { id } = req.body || {};
          var filtered = logs.filter(function(l){ return l.id !== id; });
          await dbSet('custody_maint', filtered);
          return res.json({ ok: true });
        }
        break;
      }

      /* v6.60 — Custody status updates (operational | broken | in_maintenance | lost | retired) */
      case 'custody-status': {
        if (req.method !== 'POST' && req.method !== 'PUT') break;
        const body = req.body || {};
        if (!body.custodyId || !body.status) return res.status(400).json({ error: 'custodyId and status required' });
        const items = await dbGet('custody') || [];
        const i = items.findIndex(function(c){ return c.id === body.custodyId; });
        if (i < 0) return res.status(404).json({ error: 'custody not found' });

        // Record status history
        var history = items[i].statusHistory || [];
        history.push({
          status: body.status,
          previousStatus: items[i].operationalStatus || 'operational',
          changedBy: body.changedBy || 'admin',
          changedAt: new Date().toISOString(),
          reason: body.reason || '',
        });
        items[i].operationalStatus = body.status;
        items[i].statusHistory = history;
        if (body.reason) items[i].statusNote = body.reason;
        await dbSet('custody', items);
        return res.json({ ok: true, custody: items[i] });
      }

      /* v6.60 — Warranty tracking + upcoming expiry alerts */
      case 'custody-warranty': {
        if (req.method === 'GET') {
          const items = await dbGet('custody') || [];
          var today = new Date();
          var in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
          var result = {
            expiringSoon: [], // Within 30 days
            expired: [],
            active: [],
            noWarranty: [],
          };
          items.forEach(function(c){
            if (!c.warrantyEnd) { result.noWarranty.push(c); return; }
            var end = new Date(c.warrantyEnd);
            if (end < today) result.expired.push(c);
            else if (end < in30days) result.expiringSoon.push(c);
            else result.active.push(c);
          });
          return res.json(result);
        }
        if (req.method === 'PUT') {
          const body = req.body || {};
          const items = await dbGet('custody') || [];
          const i = items.findIndex(function(c){ return c.id === body.custodyId; });
          if (i < 0) return res.status(404).json({ error: 'not found' });
          items[i].warrantyStart = body.warrantyStart || items[i].warrantyStart;
          items[i].warrantyEnd = body.warrantyEnd || items[i].warrantyEnd;
          items[i].warrantyProvider = body.warrantyProvider || items[i].warrantyProvider;
          items[i].warrantyNote = body.warrantyNote || items[i].warrantyNote;
          await dbSet('custody', items);
          return res.json({ ok: true });
        }
        break;
      }

      /* v6.60 — Total cost of ownership for an asset */
      case 'custody-tco': {
        const { custodyId } = req.query || {};
        if (!custodyId) return res.status(400).json({ error: 'custodyId required' });
        const items = await dbGet('custody') || [];
        const item = items.find(function(c){ return c.id === custodyId; });
        if (!item) return res.status(404).json({ error: 'not found' });
        const maintLogs = (await dbGet('custody_maint') || []).filter(function(m){ return m.custodyId === custodyId; });

        var purchaseCost = parseFloat(item.purchaseCost) || 0;
        var maintTotalCost = maintLogs.reduce(function(sum, m){ return sum + (parseFloat(m.cost) || 0); }, 0);
        var byType = {};
        maintLogs.forEach(function(m){
          byType[m.type] = (byType[m.type] || 0) + (parseFloat(m.cost) || 0);
        });

        // Age calculation
        var ageYears = 0;
        if (item.purchaseDate) {
          var start = new Date(item.purchaseDate);
          var now = new Date();
          ageYears = ((now - start) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);
        }

        return res.json({
          custodyId: custodyId,
          itemName: item.name,
          purchaseCost: purchaseCost,
          purchaseDate: item.purchaseDate,
          ageYears: parseFloat(ageYears),
          maintenanceCount: maintLogs.length,
          maintenanceCost: maintTotalCost,
          totalCost: purchaseCost + maintTotalCost,
          byType: byType,
          maintenanceHistory: maintLogs,
        });
      }

      /* v6.60 — Maintenance due alerts (based on nextDueDate) */
      case 'custody-maintenance-due': {
        const maintLogs = await dbGet('custody_maint') || [];
        const items = await dbGet('custody') || [];
        var today = new Date();
        var in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Get last maintenance per custody
        var latestByCustody = {};
        maintLogs.forEach(function(m){
          if (!m.nextDueDate) return;
          if (!latestByCustody[m.custodyId] || new Date(m.date) > new Date(latestByCustody[m.custodyId].date)) {
            latestByCustody[m.custodyId] = m;
          }
        });

        var overdue = [], upcoming = [];
        Object.keys(latestByCustody).forEach(function(cid){
          var m = latestByCustody[cid];
          var item = items.find(function(c){ return c.id === cid; });
          if (!item) return;
          var due = new Date(m.nextDueDate);
          var enriched = Object.assign({}, m, { itemName: item.name, empName: item.empName, category: item.category });
          if (due < today) overdue.push(enriched);
          else if (due < in7days) upcoming.push(enriched);
        });

        return res.json({ overdue: overdue, upcoming: upcoming });
      }

      case 'gps_log': {
        if (req.method === 'GET') {
          let logs = await dbGet('gps_logs') || [];
          const { empId, date } = req.query;
          if (empId) logs = logs.filter(l => l.empId === empId);
          if (date) logs = logs.filter(l => l.date === date);
          return res.json(logs);
        }
        if (req.method === 'POST') {
          const logs = await dbGet('gps_logs') || [];
          const entry = { ...req.body, ts: new Date().toISOString(), date: new Date().toISOString().split('T')[0] };
          logs.push(entry);
          // Keep only last 7 days
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          const filtered = logs.filter(l => new Date(l.ts) > cutoff);
          await dbSet('gps_logs', filtered);
          return res.json({ ok: true });
        }
        break;
      }

      case 'termination': {
        if (req.method === 'GET') return res.json(await dbGet('terminations') || []);
        if (req.method === 'POST') {
          const ts = await dbGet('terminations') || [];
          ts.push({ id: 'TERM' + Date.now(), status: 'pending', ...req.body, createdAt: new Date().toISOString() });
          await dbSet('terminations', ts);
          // Deactivate employee
          const emps = await dbGet('employees') || [];
          const ei = emps.findIndex(e => e.id === req.body.empId);
          if (ei >= 0) { emps[ei].terminated = true; emps[ei].terminatedAt = new Date().toISOString(); await dbSet('employees', emps); }
          return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const ts = await dbGet('terminations') || [];
          const { id, ...up } = req.body;
          const i = ts.findIndex(t => t.id === id);
          if (i >= 0) { ts[i] = { ...ts[i], ...up }; await dbSet('terminations', ts); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'requests': {
        if (req.method === 'GET') {
          let reqs = await dbGet('admin_requests') || [];
          const { empId } = req.query;
          if (empId) reqs = reqs.filter(r => r.empId === empId);
          return res.json(reqs);
        }
        if (req.method === 'POST') {
          const reqs = await dbGet('admin_requests') || [];
          const newReq = { id: 'REQ' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() };
          reqs.push(newReq);
          const saved = await dbSet('admin_requests', reqs);
          return res.json({ ok: saved, saved, id: newReq.id, total: reqs.length });
        }
        if (req.method === 'PUT') {
          const reqs = await dbGet('admin_requests') || [];
          const { id, ...up } = req.body;
          const i = reqs.findIndex(r => r.id === id);
          if (i >= 0) { reqs[i] = { ...reqs[i], ...up }; await dbSet('admin_requests', reqs); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'clusters': {
        // Detect employee clusters (groups in same location)
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const logs = (await dbGet('gps_logs') || []).filter(l => l.date === targetDate && l.lat && l.lat !== 0);
        const settings = await dbGet('settings') || {};
        const clusterRadius = settings.clusterRadius || 30; // meters
        const clusterMinPeople = settings.clusterMinPeople || 3;
        const clusterMinMinutes = settings.clusterMinMinutes || 30;

        // Group logs by time windows (15-min blocks)
        var timeBlocks = {};
        logs.forEach(function(l) {
          var h = new Date(l.ts).getHours(), m = new Date(l.ts).getMinutes();
          var block = h + ":" + (m < 15 ? "00" : m < 30 ? "15" : m < 45 ? "30" : "45");
          if (!timeBlocks[block]) timeBlocks[block] = [];
          timeBlocks[block].push(l);
        });

        // Find clusters in each block
        var clusters = [];
        Object.keys(timeBlocks).forEach(function(block) {
          var bl = timeBlocks[block];
          var grouped = {};
          bl.forEach(function(l) {
            var key = Math.round(l.lat * 1000) + "," + Math.round(l.lng * 1000); // ~100m grid
            if (!grouped[key]) grouped[key] = { lat: l.lat, lng: l.lng, emps: new Set() };
            grouped[key].emps.add(l.empId);
          });
          Object.values(grouped).forEach(function(g) {
            if (g.emps.size >= clusterMinPeople) {
              clusters.push({ time: block, lat: g.lat, lng: g.lng, employees: Array.from(g.emps), count: g.emps.size });
            }
          });
        });

        return res.json({ date: targetDate, clusters, settings: { clusterRadius, clusterMinPeople, clusterMinMinutes } });
      }

      case 'comparison': {
        // Weekly employee movement comparison
        const emps = await dbGet('employees') || [];
        const logs = await dbGet('gps_logs') || [];
        const now = new Date();
        var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        var weekLogs = logs.filter(l => new Date(l.ts) >= weekAgo && l.lat && l.lat !== 0);

        var comparison = emps.filter(e => !e.terminated).map(function(e) {
          var myLogs = weekLogs.filter(l => l.empId === e.id);
          var stationary = 0, moving = 0;
          for (var i = 1; i < myLogs.length; i++) {
            var d = Math.sqrt(Math.pow(myLogs[i].lat - myLogs[i-1].lat, 2) + Math.pow(myLogs[i].lng - myLogs[i-1].lng, 2)) * 111000;
            if (d < 20) stationary++; else moving++;
          }
          var total = stationary + moving || 1;
          var appEvents = logs.filter(l => l.empId === e.id && l.event);
          var closedCount = appEvents.filter(l => l.event === "app_closed" || l.event === "app_hidden").length;
          return {
            id: e.id, name: e.name, branch: e.branch,
            totalPoints: myLogs.length,
            movementPct: Math.round(moving / total * 100),
            stationaryPct: Math.round(stationary / total * 100),
            appCloses: closedCount,
          };
        }).sort(function(a, b) { return b.movementPct - a.movementPct; });

        return res.json({ from: weekAgo.toISOString().split('T')[0], to: now.toISOString().split('T')[0], employees: comparison });
      }

      /* v6.44 — DIAGNOSTIC: shows what the system knows about org hierarchy */
      case 'debug-hierarchy': {
        var dbgEmps = (await dbGet('employees')) || [];
        var dbgStats = {
          totalEmployees: dbgEmps.length,
          withKadwarId: 0,
          withManagerKadwarId: 0,
          withManagerEmail: 0,
          withManagerId: 0,
          withoutAnyManager: 0,
        };
        var dbgSample = [];
        dbgEmps.forEach(function(e){
          if (e.kadwarId) dbgStats.withKadwarId++;
          if (e.managerKadwarId) dbgStats.withManagerKadwarId++;
          if (e.managerEmail) dbgStats.withManagerEmail++;
          if (e.managerId) dbgStats.withManagerId++;
          if (!e.managerKadwarId && !e.managerEmail && !e.managerId && !e.supervisorId) dbgStats.withoutAnyManager++;
        });
        // Show up to 5 sample employees (with sensitive fields redacted)
        dbgEmps.slice(0, 5).forEach(function(e){
          dbgSample.push({
            id: e.id,
            name: e.name,
            kadwarId: e.kadwarId || null,
            managerId: e.managerId || null,
            managerKadwarId: e.managerKadwarId || null,
            managerEmail: e.managerEmail || null,
            supervisorId: e.supervisorId || null,
            supervisorKadwarId: e.supervisorKadwarId || null,
            role: e.role || null,
            isManager: e.isManager || false,
          });
        });
        // Build hierarchy same way tawasul-list does
        var dbgKadToEmp = {}, dbgEmailToEmp = {};
        dbgEmps.forEach(function(e){
          if (e.kadwarId) dbgKadToEmp[String(e.kadwarId)] = String(e.id);
          if (e.email) dbgEmailToEmp[String(e.email).toLowerCase()] = String(e.id);
        });
        var dbgHierarchy = (await dbGet('org_hierarchy')) || {};
        dbgEmps.forEach(function(e){
          if (!e || !e.id) return;
          var empKey = String(e.id);
          if (dbgHierarchy[empKey]) return;
          var managerId = null;
          if (e.managerId) managerId = String(e.managerId);
          else if (e.managerKadwarId && dbgKadToEmp[String(e.managerKadwarId)]) managerId = dbgKadToEmp[String(e.managerKadwarId)];
          else if (e.managerEmail && dbgEmailToEmp[String(e.managerEmail).toLowerCase()]) managerId = dbgEmailToEmp[String(e.managerEmail).toLowerCase()];
          if (managerId && managerId !== empKey) dbgHierarchy[empKey] = managerId;
        });
        return res.json({
          stats: dbgStats,
          sampleEmployees: dbgSample,
          computedHierarchy: dbgHierarchy,
          hierarchySize: Object.keys(dbgHierarchy).length,
          hint: 'إذا withManagerKadwarId = 0 فالمزامنة من كوادر لم تحفظ managerId. إذا > 0 لكن hierarchySize = 0 فالـ managerKadwarId لا يطابق أي kadwarId موجود.',
        });
      }

      case 'auto_check': {
        // Auto-detect violations for today + workType-aware + auto-warn after 3 lates
        const today = new Date().toISOString().split('T')[0];
        const emps = await dbGet('employees') || [];
        const att = (await dbGet('attendance') || []).filter(a => a.date === today);
        const violations = await dbGet('violations') || [];
        const preAbs = (await dbGet('pre_absences') || []).filter(p => p.date === today);
        const branches = await dbGet('branches') || [];
        const settings = await dbGet('settings') || {};
        // v6.36 — load work_types for per-employee thresholds
        const workTypesData = (await dbGet('work_types')) || { types: {}, overrides: {} };
        var newViolations = [];
        var hour = new Date().getHours(), min = new Date().getMinutes();
        var curMin = hour * 60 + min;

        // Helper: get workType for employee
        function getEmpWorkType(empId) {
          var key = (workTypesData.overrides && workTypesData.overrides[empId]) || 'full_time';
          return (workTypesData.types && workTypesData.types[key]) || null;
        }

        for (const emp of emps) {
          if (emp.terminated || emp.onLeave) continue;
          if (preAbs.find(p => p.empId === emp.id)) continue; // Pre-notified absence
          var empAtt = att.filter(a => a.empId === emp.id);
          var hasCheckin = empAtt.find(a => a.type === 'checkin' || a.type === 'الحضور');
          var wt = getEmpWorkType(emp.id);
          var isFlex = wt && wt.flexible === true;
          var lateGrace = (wt && wt.lateAfterMin) || 15;
          var br = branches.find(b => b.id === emp.branch) || { start: "08:30" };
          var startMin = parseInt((br.start || '08:30').split(":")[0] || 8) * 60 + parseInt((br.start || '08:30').split(":")[1] || 30);

          // Late detection — skipped for flexible workers (they set their own start)
          if (!isFlex && curMin > startMin + lateGrace && hasCheckin) {
            var checkinTime = new Date(hasCheckin.ts);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            if (checkinMin > startMin + 5) {
              var lateMin = checkinMin - startMin;
              var existing = violations.find(v => v.empId === emp.id && v.date === today && v.type === "late");
              if (!existing) newViolations.push({ empId: emp.id, empName: emp.name, type: "late", date: today, details: "تأخر " + lateMin + " دقيقة (حد نوع الدوام: " + lateGrace + " د)" });
            }
          }

          // Absent detection — flex workers only considered absent at end of day
          var absentThreshold = isFlex ? (24 * 60) : (startMin + 60);
          if (curMin > absentThreshold && !hasCheckin) {
            var existing2 = violations.find(v => v.empId === emp.id && v.date === today && v.type === "absent");
            if (!existing2) newViolations.push({ empId: emp.id, empName: emp.name, type: "absent", date: today, details: "غياب بدون إفادة مسبقة" });
          }
        }

        // Save new violations + SEND NOTIFICATIONS to employee and HR
        if (newViolations.length > 0) {
          var allNotifs = (await dbGet('notifications')) || [];
          var nowISO = new Date().toISOString();

          for (const v of newViolations) {
            var vId = 'V' + Date.now() + Math.random().toString(36).substr(2, 4);
            violations.push({ id: vId, status: 'open', ...v, ts: nowISO });

            // Notify the employee
            var empNotifTitle = v.type === 'late' ? '⏰ تنبيه تأخير' : v.type === 'absent' ? '🚫 تنبيه غياب' : '⚠️ مخالفة جديدة';
            var empNotifMsg = v.type === 'late'
              ? 'تم تسجيل تأخير اليوم: ' + (v.details || '') + '. الرجاء مراجعة قسم الموارد البشرية.'
              : v.type === 'absent'
              ? 'تم تسجيل غياب اليوم بدون إفادة مسبقة. الرجاء المبادرة بالتواصل مع HR.'
              : 'تم تسجيل مخالفة: ' + (v.details || '');
            allNotifs.push({
              id: 'n_emp_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
              empId: v.empId,
              type: v.type,
              title: empNotifTitle,
              message: empNotifMsg,
              violationId: vId,
              read: false,
              createdAt: nowISO,
            });

            // Notify HR / admins (by flagging for all HR users)
            var hrEmps = (await dbGet('employees')) || [];
            var hrIds = hrEmps.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
            hrIds.forEach(function(hrId){
              allNotifs.push({
                id: 'n_hr_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                empId: hrId,
                type: 'hr_alert',
                title: '👔 مخالفة تتطلب مراجعة',
                message: 'الموظف ' + (v.empName || '—') + ': ' + (v.details || v.type),
                violationId: vId,
                targetEmpId: v.empId,
                read: false,
                createdAt: nowISO,
              });
            });
          }

          // Keep last 1000 notifs
          if (allNotifs.length > 1000) allNotifs = allNotifs.slice(-1000);

          await dbSet('violations', violations);
          await dbSet('notifications', allNotifs);
        }

        // v6.36 — AUTO-WARNING ESCALATION: 3+ late/absent in rolling 30 days → auto-warning
        var warnings = await dbGet('warnings') || [];
        var autoWarningsCreated = 0;
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Group violations by employee, count lates in last 30 days
        var empViolationCounts = {};
        violations.forEach(function(v){
          if (!v.empId) return;
          if (v.type !== 'late' && v.type !== 'absent' && v.type !== 'break_window') return;
          var vDate = v.date ? new Date(v.date) : (v.ts ? new Date(v.ts) : null);
          if (!vDate || vDate < thirtyDaysAgo) return;
          var key = v.empId + ':' + v.type;
          if (!empViolationCounts[key]) empViolationCounts[key] = { empId: v.empId, type: v.type, count: 0, empName: v.empName };
          empViolationCounts[key].count++;
        });

        // Thresholds for auto-warning
        var WARNING_THRESHOLDS = { late: 3, absent: 2, break_window: 3 };
        var WARNING_LABELS = { late: 'تأخر متكرر', absent: 'غياب متكرر', break_window: 'مخالفة بريك متكررة' };

        Object.keys(empViolationCounts).forEach(function(k){
          var info = empViolationCounts[k];
          var threshold = WARNING_THRESHOLDS[info.type];
          if (info.count < threshold) return;
          // Check if we already issued a warning for this employee+type in the last 30 days
          var alreadyWarned = warnings.some(function(w){
            if (w.empId !== info.empId) return false;
            if (w.autoType !== info.type) return false;
            var wDate = w.ts ? new Date(w.ts) : null;
            return wDate && wDate >= thirtyDaysAgo;
          });
          if (alreadyWarned) return;
          // Create auto-warning
          var wNow = new Date().toISOString();
          var deadlineDate = new Date(); deadlineDate.setDate(deadlineDate.getDate() + 7);
          warnings.push({
            id: 'W' + Date.now() + Math.random().toString(36).substr(2, 4),
            empId: info.empId,
            empName: info.empName || '—',
            status: 'pending',
            level: 'auto',
            autoType: info.type,
            reason: WARNING_LABELS[info.type] + ' — ' + info.count + ' حالات خلال 30 يوماً',
            issuedBy: 'system_auto',
            ts: wNow,
            deadline: deadlineDate.toISOString(),
          });
          autoWarningsCreated++;
          // Notify the employee
          var warnAllNotifs = [];
          try { warnAllNotifs = (allNotifs && allNotifs.length) ? allNotifs : ((/** @type {any[]} */ (warnAllNotifs || []))); } catch(e) {}
          // Push in-app notification
          (async function(){
            try {
              var curNotifs = (await dbGet('notifications')) || [];
              curNotifs.push({
                id: 'n_warn_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                empId: info.empId,
                type: 'auto_warning',
                title: '📋 إنذار رسمي تلقائي',
                message: WARNING_LABELS[info.type] + ' — ' + info.count + ' حالات خلال 30 يوماً. تواصل مع HR خلال 7 أيام.',
                read: false,
                createdAt: wNow,
              });
              if (curNotifs.length > 1000) curNotifs = curNotifs.slice(-1000);
              await dbSet('notifications', curNotifs);
            } catch(e) {}
          })();
        });

        if (autoWarningsCreated > 0) await dbSet('warnings', warnings);

        // Auto-escalate overdue warnings (original behavior preserved)
        var escalated = 0;
        for (const w of warnings) {
          if (w.status === 'pending' && w.deadline && new Date(w.deadline) < new Date()) {
            w.status = 'escalated';
            w.escalatedAt = new Date().toISOString();
            escalated++;
          }
        }
        if (escalated > 0) await dbSet('warnings', warnings);

        // v6.36 — Track last auto-check timestamp for throttling
        await dbSet('auto_check_last_run', new Date().toISOString());

        return res.json({ ok: true, newViolations: newViolations.length, escalated, autoWarnings: autoWarningsCreated, date: today });
      }

      case 'dependents': {
        if (req.method === 'GET') { const ds = await dbGet('dependents') || []; const { empId } = req.query; return res.json(empId ? ds.filter(d => d.empId === empId) : ds); }
        if (req.method === 'POST') { const ds = await dbGet('dependents') || []; ds.push({ id: 'DEP' + Date.now(), status: 'pending', ...req.body }); await dbSet('dependents', ds); return res.json({ ok: true }); }
        break;
      }

      case 'tickets': {
        if (req.method === 'GET') return res.json(await dbGet('tickets') || []);
        if (req.method === 'POST') { const ts = await dbGet('tickets') || []; ts.push({ id: 'T' + Date.now(), status: 'open', ...req.body, ts: new Date().toISOString() }); await dbSet('tickets', ts); return res.json({ ok: true }); }
        break;
      }

      case 'events': {
        if (req.method === 'GET') return res.json(await dbGet('events') || []);
        if (req.method === 'POST') {
          // Bulk save (full array) or single add
          if (Array.isArray(req.body)) {
            await dbSet('events', req.body);
            return res.json({ ok: true });
          }
          const es = await dbGet('events') || []; es.push({ id: 'EV' + Date.now(), ...req.body }); await dbSet('events', es); return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const es = await dbGet('events') || [];
          const { id, ...up } = req.body;
          const i = es.findIndex(e => e.id === id);
          if (i >= 0) { es[i] = { ...es[i], ...up }; await dbSet('events', es); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') { const es = await dbGet('events') || []; await dbSet('events', es.filter(e => e.id !== req.query.id)); return res.json({ ok: true }); }
        break;
      }

      case 'settings': {
        if (req.method === 'GET') return res.json(await dbGet('settings') || {});
        if (req.method === 'PUT') { await dbSet('settings', req.body); return res.json({ ok: true }); }
        break;
      }

      /* ═══ SSO VERIFY — التحقق من token SSO من كوادر ═══ */
      case 'sso-verify': {
        var body = req.body || {};
        var token = body.token;
        if (!token) return res.status(400).json({ ok: false, error: 'token مطلوب' });
        try {
          // Ask kadwar to validate the token
          var r = await fetch('https://hma.engineer/api/basma-sync?action=sso-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token }),
          });
          if (!r.ok) {
            return res.status(401).json({ ok: false, error: 'الجلسة منتهية أو غير صالحة' });
          }
          var d = await r.json();
          if (!d.ok || !d.employee) {
            return res.status(401).json({ ok: false, error: d.error || 'جلسة غير صالحة' });
          }
          // Find the matching employee in basma
          var emps = await dbGet('employees') || [];
          var emp = emps.find(function(x) {
            if (!x) return false;
            if (d.employee.idNumber && x.idNumber === d.employee.idNumber) return true;
            if (d.employee.username && (x.username || '').toLowerCase() === (d.employee.username || '').toLowerCase()) return true;
            if (d.employee.email && (x.email || '').toLowerCase() === (d.employee.email || '').toLowerCase()) return true;
            return false;
          });
          if (!emp) {
            return res.status(404).json({ ok: false, error: 'الموظف غير موجود في بصمة — اطلب من الإدارة مزامنة' });
          }
          // Return safe employee object (no password hash)
          var safeEmp = Object.assign({}, emp);
          delete safeEmp.passwordHash;
          delete safeEmp.password;
          delete safeEmp.passwordSalt;
          return res.json({ ok: true, employee: safeEmp, ts: new Date().toISOString() });
        } catch (e) {
          return res.status(500).json({ ok: false, error: 'فشل الاتصال بكوادر: ' + (e && e.message ? e.message : String(e)) });
        }
      }

      /* ═══ WORK TYPES — إعدادات أنواع الدوام + overrides للموظفين ═══ */
      case 'work_types': {
        if (req.method === 'POST') {
          var body = req.body || {};
          var current = (await dbGet('work_types')) || { types: {}, overrides: {} };
          if (body.types) current.types = body.types;
          if (body.overrides) current.overrides = body.overrides;
          await dbSet('work_types', current);
          return res.json({ ok: true, ...current });
        }
        var wt = (await dbGet('work_types')) || { types: {}, overrides: {} };
        return res.json(wt);
      }

      /* ═══ WEB PUSH — generate VAPID keys (ONE-TIME SETUP) ═══ */
      case 'vapid-generate': {
        try {
          var keys = webpush.generateVAPIDKeys();
          return res.json({
            ok: true,
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
            instructions: [
              '1. انسخ المفتاحين',
              '2. اذهب لـ Vercel → basma-hma → Settings → Environment Variables',
              '3. أضف: VAPID_PUBLIC_KEY = ' + keys.publicKey,
              '4. أضف: VAPID_PRIVATE_KEY = ' + keys.privateKey,
              '5. أضف (اختياري): VAPID_CONTACT_EMAIL = admin@hma.engineer',
              '6. اضغط Save ثم Redeploy من Deployments',
              '7. افتح التطبيق على جوالك، اقبل الإشعارات، ثم جرّب الاختبار من لوحة المدير',
            ],
          });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ WEB PUSH — VAPID public key (client subscribes with it) ═══ */
      case 'vapid-public-key': {
        return res.json({ publicKey: (process.env.VAPID_PUBLIC_KEY || '').trim() });
      }

      /* ═══ WEB PUSH — subscribe employee to push ═══ */
      case 'subscribe-push': {
        var body = req.body || {};
        var empId = body.empId;
        var subscription = body.subscription;
        if (!empId || !subscription) return res.status(400).json({ ok: false, error: 'empId + subscription required' });
        var subs = (await dbGet('push_subscriptions')) || {};
        subs[empId] = { subscription: subscription, ts: new Date().toISOString() };
        await dbSet('push_subscriptions', subs);
        return res.json({ ok: true });
      }

      /* ═══ WEB PUSH — unsubscribe ═══ */
      case 'unsubscribe-push': {
        var body = req.body || {};
        var empId = body.empId;
        if (!empId) return res.status(400).json({ ok: false, error: 'empId required' });
        var subs = (await dbGet('push_subscriptions')) || {};
        delete subs[empId];
        await dbSet('push_subscriptions', subs);
        return res.json({ ok: true });
      }

      /* ═══ TEST NOTIFY — إرسال إشعار/اتصال وهمي (مع push حقيقي) ═══ */
      case 'test-notify': {
        var body = req.body || {};
        var empId = body.empId;
        if (!empId) return res.status(400).json({ ok: false, error: 'empId مطلوب' });

        // 1. Save to DB (polling fallback picks this up)
        var notifs = (await dbGet('notifications')) || [];
        var newNotif = {
          id: 'N' + Date.now(),
          empId: empId,
          type: body.type || 'test',
          title: body.title || 'إشعار اختبار',
          message: body.message || 'إشعار من المدير',
          fakeCall: body.type === 'fake_call',
          callType: body.callType || 'checkin',
          read: false,
          ts: new Date().toISOString(),
        };
        notifs.unshift(newNotif);
        await dbSet('notifications', notifs.slice(0, 500));

        // 2. Try sending real Web Push
        var pushResult = { sent: false, reason: '' };
        try {
          var subs = (await dbGet('push_subscriptions')) || {};
          var sub = subs[empId];
          if (!sub) {
            pushResult.reason = 'الموظف لم يفعّل الإشعارات بعد (يجب أن يفتح التطبيق على جواله ويوافق على الإذن)';
          } else if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            pushResult.reason = 'VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY غير معرّفين في Vercel env — استخدم polling fallback';
          } else {
            // Try Web Push using native crypto (simple implementation)
            pushResult = await sendWebPush(sub.subscription, {
              title: newNotif.title,
              body: newNotif.message,
              fakeCall: newNotif.fakeCall,
              callType: newNotif.callType,
              tag: 'basma-' + newNotif.id,
            });
          }
        } catch (e) {
          pushResult.reason = 'خطأ: ' + (e.message || String(e));
        }

        return res.json({
          ok: true,
          notification: newNotif,
          push: pushResult,
          hint: pushResult.sent ? null : 'الإشعار محفوظ في DB — التطبيق سيكتشفه خلال 15 ثانية (polling)',
        });
      }

      /* ═══ STORAGE STATUS — تحقق من تفعيل Redis + R2 ═══ */
      case 'storage-status': {
        var redisTest = null;
        if (USE_REDIS) {
          try {
            await redisRequest('PING');
            redisTest = 'ok';
          } catch(e) {
            redisTest = 'error: ' + e.message;
          }
        }
        var r2Test = null;
        if (USE_R2) {
          try {
            var testKey = 'test/' + Date.now() + '.txt';
            var upResult = await r2Upload(testKey, 'test', 'text/plain');
            r2Test = upResult ? 'ok (' + upResult.url + ')' : 'upload returned null';
            // Clean up test file
            r2Delete(testKey).catch(function(){});
          } catch(e) {
            r2Test = 'error: ' + e.message;
          }
        }
        return res.json({
          system: SYSTEM,
          redis: {
            enabled: USE_REDIS,
            url: USE_REDIS ? REDIS_URL.slice(0, 40) + '...' : null,
            test: redisTest,
          },
          r2: {
            enabled: USE_R2,
            bucket: USE_R2 ? R2_BUCKET : null,
            publicUrl: R2_PUBLIC_URL || null,
            test: r2Test,
          },
          blobFallback: true,
          primary: USE_REDIS ? 'upstash-redis' : 'vercel-blob',
          ts: new Date().toISOString(),
        });
      }

      /* ═══ MIGRATE — نقل البيانات من Blob إلى Redis ═══ */
      case 'migrate-to-redis': {
        if (!USE_REDIS) return res.json({ ok: false, error: 'Redis غير مفعّل — أضف UPSTASH_REDIS_REST_URL و TOKEN في Vercel' });
        var tables = ['employees', 'branches', 'attendance', 'violations', 'violations_v2', 'warnings', 'leaves', 'dependents', 'tickets', 'projects', 'delegations', 'exceptions', 'events', 'manual_attendance', 'settings', 'laiha_settings', 'complaints', 'investigations', 'appeals', 'notifications', 'permissions', 'gps_log', 'pre_absences', 'custody', 'custody_maintenance', 'attachments', 'attachment_types', 'health_disclosure', 'emp_records', 'kadwar_data', 'kadwar_notifs', 'kadwar_employees', 'admin_config', 'faces', 'work_types', 'push_subscriptions', 'hr_questions', 'delegations'];
        var migrated = {};
        var failed = [];
        for (var i = 0; i < tables.length; i++) {
          var t = tables[i];
          try {
            var data = await blobGet(t);
            if (data !== null) {
              await redisSet(t, data);
              migrated[t] = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 1);
            } else {
              migrated[t] = 'empty';
            }
          } catch (e) {
            failed.push({ table: t, error: e.message });
          }
        }
        return res.json({ ok: true, migrated: migrated, failed: failed, total: Object.keys(migrated).length, ts: new Date().toISOString() });
      }

      /* ═══ BLOB LIST — عرض كل الملفات في Vercel Blob ═══ */
      case 'blob-list': {
        try {
          var allBlobs = [];
          var cursor = undefined;
          do {
            var result = await list({ cursor, limit: 1000 });
            allBlobs = allBlobs.concat(result.blobs);
            cursor = result.cursor;
          } while (cursor && allBlobs.length < 5000);

          // Group by prefix
          var basmaData = [];
          var basmaFiles = [];
          var basmaOther = [];
          var other = [];
          var totalSize = 0;

          allBlobs.forEach(function(b) {
            totalSize += b.size || 0;
            var info = {
              name: b.pathname,
              size: b.size,
              sizeKB: ((b.size || 0) / 1024).toFixed(1),
              uploaded: b.uploadedAt,
              url: b.url,
            };
            if (b.pathname.match(/^basma_[^/]+\.json$/)) {
              basmaData.push(info);
            } else if (b.pathname.startsWith('basma_files/')) {
              basmaFiles.push(info);
            } else if (b.pathname.startsWith('basma_')) {
              basmaOther.push(info);
            } else {
              other.push(info);
            }
          });

          return res.json({
            ok: true,
            totalFiles: allBlobs.length,
            totalSizeKB: (totalSize / 1024).toFixed(1),
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            summary: {
              basmaDataFiles: basmaData.length,    // basma_*.json
              basmaAttachments: basmaFiles.length, // basma_files/*
              basmaOther: basmaOther.length,       // basma_* other
              other: other.length,                 // not basma
            },
            basmaData: basmaData,
            basmaFiles: basmaFiles,
            basmaOther: basmaOther,
            other: other,
          });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ BLOB DELETE ALL — حذف كل الملفات من Blob (خطير) ═══ */
      case 'blob-delete-all': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        if (body.confirm !== 'DELETE_ALL_BLOB') {
          return res.status(400).json({ ok: false, error: 'Missing confirm field' });
        }
        try {
          var allBlobs = [];
          var cursor = undefined;
          do {
            var result = await list({ cursor, limit: 1000 });
            allBlobs = allBlobs.concat(result.blobs);
            cursor = result.cursor;
          } while (cursor && allBlobs.length < 5000);

          var deleted = 0;
          var failed = [];
          // Delete in batches
          for (var i = 0; i < allBlobs.length; i++) {
            try {
              await del(allBlobs[i].url);
              deleted++;
            } catch(e) {
              failed.push({ name: allBlobs[i].pathname, error: e.message });
            }
          }
          return res.json({ ok: true, deleted: deleted, failed: failed, total: allBlobs.length });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ BLOB DELETE ALL BASMA DATA — حذف كل بيانات بصمة من Blob ═══ */
      case 'blob-delete-basma-data': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        if (body.confirm !== 'DELETE_BLOB_BASMA') {
          return res.status(400).json({ ok: false, error: 'Missing confirm field (must be "DELETE_BLOB_BASMA")' });
        }
        try {
          var allBlobs = [];
          var cursor = undefined;
          do {
            var result = await list({ cursor, limit: 1000 });
            allBlobs = allBlobs.concat(result.blobs);
            cursor = result.cursor;
          } while (cursor && allBlobs.length < 5000);

          var toDelete = allBlobs.filter(function(b){
            return b.pathname.match(/^basma_[^/]+\.json$/);
          });

          var deleted = 0;
          var failed = [];
          for (var i = 0; i < toDelete.length; i++) {
            try {
              await del(toDelete[i].url);
              deleted++;
            } catch(e) {
              failed.push({ name: toDelete[i].pathname, error: e.message });
            }
          }
          return res.json({ ok: true, deleted: deleted, failed: failed, total: toDelete.length });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ BENEFITS — قائمة الامتيازات ═══ */
      case 'benefits': {
        if (req.method === 'POST') {
          var body = req.body || {};
          await dbSet('benefits', body.coupons || []);
          return res.json({ ok: true });
        }
        var benefits = (await dbGet('benefits')) || [];
        return res.json({ coupons: benefits });
      }

      /* ═══ REDEEM BENEFIT — صرف كوبون ═══ */
      case 'redeem-benefit': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        var empId = body.empId;
        var couponId = body.couponId;
        if (!empId || !couponId) return res.status(400).json({ ok: false, error: 'empId + couponId required' });
        var redemptions = (await dbGet('redemptions')) || [];
        redemptions.unshift({
          id: 'R' + Date.now(),
          empId: empId,
          couponId: couponId,
          pts: body.pts || 0,
          couponName: body.couponName || '',
          ts: new Date().toISOString(),
        });
        await dbSet('redemptions', redemptions.slice(0, 5000));

        // Deduct points from employee
        var emps = (await dbGet('employees')) || [];
        var empIdx = emps.findIndex(function(e){ return e.id === empId; });
        if (empIdx >= 0) {
          emps[empIdx].points = Math.max(0, (emps[empIdx].points || 0) - (body.pts || 0));
          await dbSet('employees', emps);
        }
        return res.json({ ok: true });
      }

      /* ═══ REDEMPTIONS — سجل الصرف ═══ */
      case 'redemptions': {
        var redemps = (await dbGet('redemptions')) || [];
        var empId = req.query ? req.query.empId : null;
        if (empId) redemps = redemps.filter(function(r){ return r.empId === empId; });
        return res.json(redemps);
      }

      /* ═══ TAWASUL — نظام تبادل المهام الإدارية (NATIVE — Upstash Redis) ═══ */
      /* ═══ TAWASUL ATTACHMENTS — R2 storage with task/project-based keys ═══
         POST body: { taskId, serial, projectId, filename, contentType, dataB64 }
         Key: tawasul/{serial || taskId}/attachments/{YYYY-MM-DD}_{filename}
         Returns: { ok, key, url, size } */
      case 'tawasul-attachment-upload': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        if (!USE_R2) return res.status(500).json({ error: 'R2 not configured' });
        try {
          var bd = req.body || {};
          var taskId = bd.taskId;
          var serial = bd.serial || taskId;
          var filename = (bd.filename || 'file').replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 120);
          var contentType = bd.contentType || 'application/octet-stream';
          var dataB64 = bd.dataB64;
          if (!taskId || !dataB64) return res.status(400).json({ error: 'taskId and dataB64 required' });
          // Decode base64
          var buffer = Buffer.from(dataB64, 'base64');
          var size = buffer.length;
          if (size > 50 * 1024 * 1024) return res.status(413).json({ error: 'File too large (max 50MB per file)' });
          // Build key
          var today = new Date().toISOString().slice(0, 10);
          var safeSerial = String(serial).replace(/[\/\\?%*:|"<>]/g, '_');
          var ts = Date.now();
          var key = 'tawasul/' + safeSerial + '/attachments/' + today + '_' + ts + '_' + filename;
          // Upload
          var result = await r2Upload(key, buffer, contentType);
          if (!result) return res.status(500).json({ error: 'R2 upload returned null' });
          // Append to task's attachments array
          var task = await dbGet('twsl:' + taskId);
          if (task) {
            task.attachments = task.attachments || [];
            task.attachments.push({
              key: key,
              url: result.url,
              filename: filename,
              contentType: contentType,
              size: size,
              uploadedAt: new Date().toISOString(),
              uploadedBy: bd.uploadedBy || null,
            });
            task.updatedAt = new Date().toISOString();
            await dbSet('twsl:' + taskId, task);
          }
          return res.json({ ok: true, key: key, url: result.url, size: size, filename: filename });
        } catch(e) {
          console.error('[tawasul-attachment-upload]', e);
          return res.status(500).json({ error: 'upload error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-attachment-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bd2 = req.body || {};
          var taskId2 = bd2.taskId;
          var key2 = bd2.key;
          if (!taskId2 || !key2) return res.status(400).json({ error: 'taskId and key required' });
          // Delete from R2
          if (USE_R2) { try { await r2Delete(key2); } catch(e) { console.error('R2 delete:', e.message); } }
          // Remove from task
          var task2 = await dbGet('twsl:' + taskId2);
          if (task2 && Array.isArray(task2.attachments)) {
            task2.attachments = task2.attachments.filter(function(a){ return a.key !== key2; });
            task2.updatedAt = new Date().toISOString();
            await dbSet('twsl:' + taskId2, task2);
          }
          return res.json({ ok: true });
        } catch(e) {
          return res.status(500).json({ error: 'delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-list': {
        try {
          var idx = (await dbGet('twsl:idx')) || [];
          var categories = (await dbGet('twsl:categories')) || [
            { id: "supervision", label: "أعمال الإشراف", icon: "🏗️", fixed: true },
            { id: "design",      label: "أعمال التصميم", icon: "✏️", fixed: true },
            { id: "survey",      label: "أعمال المساحة", icon: "📐", fixed: true },
            { id: "clients",     label: "علاقات العملاء", icon: "👥", fixed: true },
            { id: "admin",       label: "إداري",          icon: "📋", fixed: true },
            { id: "other",       label: "أخرى",           icon: "📎", fixed: false },
          ];
          var projects = (await dbGet('twsl:projects')) || [];
          // v6.42 — Build hierarchy from employees automatically (source of truth = Kadwar sync).
          // Previously read from separate 'org_hierarchy' KV which was never populated after Kadwar sync.
          var hierarchy = {};
          try {
            var orgStored = (await dbGet('org_hierarchy')) || {};
            hierarchy = Object.assign({}, orgStored); // start from any manual overrides
          } catch(e) {}

          try {
            var allEmps = (await dbGet('employees')) || [];
            // Map kadwarId -> empId (for resolving manager references by kadwar id)
            var kadIdToEmpId = {};
            var emailToEmpId = {};
            allEmps.forEach(function(e){
              if (e.kadwarId) kadIdToEmpId[String(e.kadwarId)] = String(e.id);
              if (e.email) emailToEmpId[String(e.email).toLowerCase()] = String(e.id);
            });
            // For each employee with a manager, register in hierarchy
            allEmps.forEach(function(e){
              if (!e || !e.id) return;
              var empKey = String(e.id);
              if (hierarchy[empKey]) return; // manual override wins
              var managerId = null;
              // Direct manager by id
              if (e.managerId) managerId = String(e.managerId);
              // Manager by kadwar id → resolve to empId
              else if (e.managerKadwarId && kadIdToEmpId[String(e.managerKadwarId)]) managerId = kadIdToEmpId[String(e.managerKadwarId)];
              // v6.44 — Manager by email (some kadwar sync returns email not id)
              else if (e.managerEmail && emailToEmpId[String(e.managerEmail).toLowerCase()]) managerId = emailToEmpId[String(e.managerEmail).toLowerCase()];
              // Supervisor fallbacks
              else if (e.supervisorId) managerId = String(e.supervisorId);
              else if (e.supervisorKadwarId && kadIdToEmpId[String(e.supervisorKadwarId)]) managerId = kadIdToEmpId[String(e.supervisorKadwarId)];
              else if (e.supervisorEmail && emailToEmpId[String(e.supervisorEmail).toLowerCase()]) managerId = emailToEmpId[String(e.supervisorEmail).toLowerCase()];
              if (managerId && managerId !== empKey) hierarchy[empKey] = managerId;
            });
          } catch(e) { /* silent */ }

          // Fetch all requests — use reliable parallel GETs (proven path)
          var requests = [];
          if (idx.length > 0) {
            try {
              requests = await Promise.all(idx.map(function(id){
                return dbGet('twsl:' + id).catch(function(){ return null; });
              }));
            } catch(e) {
              console.error('[tawasul-list] parallel fetch error:', e.message);
              requests = [];
            }
          }
          requests = (requests || []).filter(function(r){ return r && r.id; });

          return res.json({
            ok: true,
            requests: requests,
            categories: categories,
            projects: projects,
            hierarchy: hierarchy,
            total: requests.length,
            syncDate: new Date().toISOString(),
          });
        } catch (e) {
          console.error('[tawasul-list] FATAL:', e);
          return res.status(200).json({
            ok: false,
            error: 'tawasul-list error: ' + (e.message || 'unknown'),
            requests: [], categories: [], projects: [], hierarchy: {},
          });
        }
      }

      case 'tawasul-save': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var body = req.body || {};
          var reqData = body.request;
          if (!reqData) return res.status(400).json({ error: 'request object required' });

          var now = new Date().toISOString();
          // Check if this is a new request by looking at the index
          var idx = (await dbGet('twsl:idx')) || [];
          var isNew = !reqData.id || idx.indexOf(reqData.id) < 0;

          // Generate ID if new and missing
          if (!reqData.id) reqData.id = 'twsl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

          // Generate serial if new
          if (!reqData.serial) {
            var counter = (await dbGet('twsl:serial')) || 0;
            counter = counter + 1;
            reqData.serial = 'CB' + String(counter).padStart(4, '0');
            await dbSet('twsl:serial', counter);
          }

          reqData.updatedAt = now;
          if (!reqData.createdAt) reqData.createdAt = now;

          // Save the request
          await dbSet('twsl:' + reqData.id, reqData);

          // Update index if new
          if (isNew) {
            if (idx.indexOf(reqData.id) < 0) {
              idx.push(reqData.id);
              await dbSet('twsl:idx', idx);
            }

            // Create notification for each assignee
            var notifs = (await dbGet('twsl:notifs')) || [];
            (reqData.assignees || []).forEach(function(a){
              notifs.push({
                id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'new_task',
                taskId: reqData.id,
                serial: reqData.serial,
                from: reqData.requesterName || '',
                createdAt: now,
                read: false,
                targetId: a.id,
              });
            });
            // Keep last 500 notifications
            if (notifs.length > 500) notifs = notifs.slice(-500);
            await dbSet('twsl:notifs', notifs);

            // Send Web Push to each assignee (fire-and-forget, don't block response)
            if (reqData.status === 'sent' && (reqData.assignees || []).length > 0) {
              (async function(){
                try {
                  var pushSubs = (await dbGet('push_subscriptions')) || {};
                  var pushTitle = (reqData.urgency === 'urgent' ? '🔴 ' : '📨 ') + 'مهمة جديدة' + (reqData.serial ? ' #' + reqData.serial : '');
                  var pushBody = (reqData.requesterName ? reqData.requesterName + ': ' : '') + (reqData.title || '(بدون عنوان)');
                  if (reqData.deadline) {
                    var d = new Date(reqData.deadline);
                    var now2 = Date.now();
                    var hoursLeft = (d.getTime() - now2) / 3600000;
                    if (hoursLeft > 0 && hoursLeft < 24) pushBody += ' · ⏰ الموعد: ' + d.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                  }
                  var payload = {
                    title: pushTitle,
                    body: pushBody,
                    tag: 'tawasul-' + reqData.id,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { taskId: reqData.id, type: 'tawasul_new_task', url: '/?tab=tawasul' },
                  };
                  for (var i = 0; i < (reqData.assignees || []).length; i++) {
                    var aid = reqData.assignees[i].id;
                    var sub = pushSubs[aid];
                    if (!sub || !sub.subscription) continue;
                    try { await sendWebPush(sub.subscription, payload); }
                    catch(e) { console.error('[tawasul push]', aid, e.message); }
                  }
                } catch(e) {
                  console.error('[tawasul auto-push]', e.message);
                }
              })();
            }
          }

          return res.json({ ok: true, request: reqData, isNew: isNew });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-save error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var body2 = req.body || {};
          var id = body2.id;
          if (!id) return res.status(400).json({ error: 'id required' });

          // Remove from index
          var idx2 = (await dbGet('twsl:idx')) || [];
          idx2 = idx2.filter(function(x){ return x !== id; });
          await dbSet('twsl:idx', idx2);

          // Delete the object (overwrite with null since we don't have a delete helper)
          await dbSet('twsl:' + id, null);

          return res.json({ ok: true, id: id });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-notifs': {
        try {
          if (req.method === 'POST') {
            var pb = req.body || {};
            var notifs2 = (await dbGet('twsl:notifs')) || [];
            // Mark notifications as read
            if (pb.markRead && Array.isArray(pb.ids)) {
              notifs2 = notifs2.map(function(n){
                if (pb.ids.indexOf(n.id) >= 0) return Object.assign({}, n, { read: true });
                return n;
              });
              await dbSet('twsl:notifs', notifs2);
            }
            // Add a new notification
            if (pb.notif) {
              notifs2.push(Object.assign({ id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), createdAt: new Date().toISOString(), read: false }, pb.notif));
              if (notifs2.length > 500) notifs2 = notifs2.slice(-500);
              await dbSet('twsl:notifs', notifs2);
            }
            return res.json({ ok: true, notifs: notifs2 });
          }
          var notifsR = (await dbGet('twsl:notifs')) || [];
          return res.json({ ok: true, notifs: notifsR });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-notifs error: ' + (e.message || 'unknown'), notifs: [] });
        }
      }

      case 'tawasul-ai': {
        // AI stays on kadwar (has API keys) — proxy with timeout
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var ctrlAI = new AbortController();
          var tmoAI = setTimeout(function(){ ctrlAI.abort(); }, 30000);
          var krAI = await fetch('https://hma.engineer/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body || {}),
            signal: ctrlAI.signal,
          });
          clearTimeout(tmoAI);
          var kdAI = await krAI.json();
          if (!krAI.ok) return res.status(krAI.status).json({ error: kdAI.error || 'ai error ' + krAI.status });
          return res.json(kdAI);
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بـ AI: ' + (e.message || 'unknown') });
        }
      }

      /* ═══════════ TIME TRACKING (تتبع الوقت) — v6.29 ═══════════
         - twsl:active:{userId}  =>  { taskId, startedAt, note }
         - request.timeEntries[] =>  [{ id, userId, userName, startedAt, endedAt, durationSec, note, manual? }]
      */
      case 'tawasul-timer-start': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTs = req.body || {};
          var userIdTs = String(bTs.userId || '');
          var taskIdTs = String(bTs.taskId || '');
          if (!userIdTs || !taskIdTs) return res.status(400).json({ error: 'userId و taskId مطلوبان' });

          var activeKey = 'twsl:active:' + userIdTs;
          var existingActive = await dbGet(activeKey);
          if (existingActive && existingActive.taskId) {
            return res.status(409).json({ error: 'هناك مؤقت نشط بالفعل', active: existingActive });
          }

          // Verify task exists
          var taskTs = await dbGet('twsl:' + taskIdTs);
          if (!taskTs) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowTs = new Date().toISOString();
          var activeVal = { taskId: taskIdTs, startedAt: nowTs, note: bTs.note || '', serial: taskTs.serial || '', title: taskTs.title || '' };
          await dbSet(activeKey, activeVal);
          return res.json({ ok: true, active: activeVal });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-start error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-stop': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTp = req.body || {};
          var userIdTp = String(bTp.userId || '');
          if (!userIdTp) return res.status(400).json({ error: 'userId مطلوب' });

          var keyTp = 'twsl:active:' + userIdTp;
          var activeTp = await dbGet(keyTp);
          if (!activeTp || !activeTp.taskId) return res.status(404).json({ error: 'لا يوجد مؤقت نشط' });

          var taskTp = await dbGet('twsl:' + activeTp.taskId);
          if (!taskTp) {
            await dbSet(keyTp, null);
            return res.status(404).json({ error: 'المهمة غير موجودة' });
          }

          var nowTp = new Date().toISOString();
          var startedMs = new Date(activeTp.startedAt).getTime();
          var endedMs = Date.now();
          var durSec = Math.max(1, Math.round((endedMs - startedMs) / 1000));

          var entryTp = {
            id: 'te_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            userId: userIdTp,
            userName: bTp.userName || '',
            startedAt: activeTp.startedAt,
            endedAt: nowTp,
            durationSec: durSec,
            note: bTp.note || activeTp.note || '',
          };

          taskTp.timeEntries = (taskTp.timeEntries || []).concat([entryTp]);
          taskTp.updatedAt = nowTp;

          // Format duration for log
          var h = Math.floor(durSec / 3600);
          var m = Math.floor((durSec % 3600) / 60);
          var durText = h > 0 ? (h + ' س ' + m + ' د') : (m + ' د');
          taskTp.log = (taskTp.log || []).concat([{
            text: '⏱ ' + (bTp.userName || '') + ' سجّل ' + durText + ' على المهمة',
            by: bTp.userName || '', at: nowTp,
          }]);

          await dbSet('twsl:' + taskTp.id, taskTp);
          await dbSet(keyTp, null);

          return res.json({ ok: true, entry: entryTp, task: taskTp });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-stop error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-cancel': {
        // Cancel active timer without saving an entry
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var uidC = String((req.body || {}).userId || '');
          if (!uidC) return res.status(400).json({ error: 'userId مطلوب' });
          await dbSet('twsl:active:' + uidC, null);
          return res.json({ ok: true });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-cancel error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-add': {
        // Manual time entry (for forgotten work)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTa = req.body || {};
          var taskIdTa = String(bTa.taskId || '');
          var userIdTa = String(bTa.userId || '');
          var durSecTa = parseInt(bTa.durationSec, 10);
          if (!taskIdTa || !userIdTa || !durSecTa || durSecTa <= 0) {
            return res.status(400).json({ error: 'taskId و userId و durationSec مطلوبة' });
          }
          if (durSecTa > 24 * 3600) return res.status(400).json({ error: 'لا يمكن إضافة أكثر من 24 ساعة دفعة واحدة' });

          var taskTa = await dbGet('twsl:' + taskIdTa);
          if (!taskTa) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowTa = new Date().toISOString();
          var dateTa = bTa.date || nowTa;
          var entryTa = {
            id: 'te_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            userId: userIdTa,
            userName: bTa.userName || '',
            startedAt: dateTa,
            endedAt: dateTa,
            durationSec: durSecTa,
            note: bTa.note || '',
            manual: true,
          };

          taskTa.timeEntries = (taskTa.timeEntries || []).concat([entryTa]);
          taskTa.updatedAt = nowTa;

          var hTa = Math.floor(durSecTa / 3600);
          var mTa = Math.floor((durSecTa % 3600) / 60);
          var durTextTa = hTa > 0 ? (hTa + ' س ' + mTa + ' د') : (mTa + ' د');
          taskTa.log = (taskTa.log || []).concat([{
            text: '⏱ ' + (bTa.userName || '') + ' أضاف يدوياً ' + durTextTa,
            by: bTa.userName || '', at: nowTa,
          }]);

          await dbSet('twsl:' + taskTa.id, taskTa);
          return res.json({ ok: true, entry: entryTa, task: taskTa });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-add error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTd = req.body || {};
          var taskIdTd = String(bTd.taskId || '');
          var entryIdTd = String(bTd.entryId || '');
          if (!taskIdTd || !entryIdTd) return res.status(400).json({ error: 'taskId و entryId مطلوبان' });

          var taskTd = await dbGet('twsl:' + taskIdTd);
          if (!taskTd) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var entries = taskTd.timeEntries || [];
          var targetEntry = entries.find(function(e){ return e.id === entryIdTd; });
          if (!targetEntry) return res.status(404).json({ error: 'السجل غير موجود' });

          // Permission check: only entry owner or admin can delete
          var actorId = String(bTd.userId || '');
          var isAdminTd = !!bTd.isAdmin;
          if (!isAdminTd && String(targetEntry.userId) !== actorId) {
            return res.status(403).json({ error: 'لا يمكنك حذف سجل وقت لشخص آخر' });
          }

          taskTd.timeEntries = entries.filter(function(e){ return e.id !== entryIdTd; });
          var nowTd = new Date().toISOString();
          taskTd.updatedAt = nowTd;
          taskTd.log = (taskTd.log || []).concat([{
            text: '⏱ ' + (bTd.userName || '') + ' حذف سجل وقت',
            by: bTd.userName || '', at: nowTd,
          }]);
          await dbSet('twsl:' + taskTd.id, taskTd);
          return res.json({ ok: true, task: taskTd });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-active': {
        // GET active timer for current user
        try {
          var uidA = String((req.query && req.query.userId) || (req.body && req.body.userId) || '');
          if (!uidA) return res.status(400).json({ error: 'userId مطلوب' });
          var activeA = await dbGet('twsl:active:' + uidA);
          return res.json({ active: activeA || null });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-active error: ' + (e.message || 'unknown'), active: null });
        }
      }

      /* ═══════════ IN-TASK CHAT (الدردشة داخل المهمة) — v6.30 ═══════════
         - request.chatMessages[] => [{ id, text, by, byName, at, mentions[], replyTo, reactions{emoji:[userIds]}, deleted? }]
      */
      case 'tawasul-chat-send': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bC = req.body || {};
          var taskIdC = String(bC.taskId || '');
          var textC = String(bC.text || '').trim();
          var byC = String(bC.by || '');
          if (!taskIdC || !textC || !byC) return res.status(400).json({ error: 'taskId و text و by مطلوبة' });
          if (textC.length > 2000) return res.status(400).json({ error: 'الرسالة طويلة جداً (الحد 2000 حرف)' });

          var taskC = await dbGet('twsl:' + taskIdC);
          if (!taskC) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowC = new Date().toISOString();
          var msgC = {
            id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            text: textC,
            by: byC,
            byName: String(bC.byName || ''),
            at: nowC,
            mentions: Array.isArray(bC.mentions) ? bC.mentions.map(String).slice(0, 20) : [],
            replyTo: bC.replyTo ? String(bC.replyTo) : null,
            reactions: {},
          };

          taskC.chatMessages = (taskC.chatMessages || []).concat([msgC]);
          // Cap at 1000 messages per task (keep newest)
          if (taskC.chatMessages.length > 1000) taskC.chatMessages = taskC.chatMessages.slice(-1000);
          taskC.updatedAt = nowC;

          await dbSet('twsl:' + taskC.id, taskC);

          // Push notification — fire and forget
          (async function(){
            try {
              var pushSubsC = (await dbGet('push_subscriptions')) || {};
              // Recipients: all task participants (requester + assignees) + any mentioned users — excluding sender
              var recipients = {};
              if (taskC.requesterId) recipients[String(taskC.requesterId)] = true;
              (taskC.assignees || []).forEach(function(a){ if (a.id) recipients[String(a.id)] = true; });
              msgC.mentions.forEach(function(mid){ recipients[String(mid)] = true; });
              delete recipients[byC];

              var isMentionPush = msgC.mentions.length > 0;
              var previewC = textC.length > 80 ? textC.slice(0, 77) + '...' : textC;

              var recipientIds = Object.keys(recipients);
              for (var iC = 0; iC < recipientIds.length; iC++) {
                var ridC = recipientIds[iC];
                var subC = pushSubsC[ridC];
                if (!subC || !subC.subscription) continue;
                var isThisMentioned = msgC.mentions.indexOf(ridC) >= 0;
                var titleC = (isThisMentioned ? '📣 @ذكرك ' : '💬 ') + (msgC.byName || 'رسالة جديدة') + (taskC.serial ? ' · #' + taskC.serial : '');
                try {
                  await sendWebPush(subC.subscription, {
                    title: titleC,
                    body: previewC,
                    tag: 'twsl-chat-' + taskC.id,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { taskId: taskC.id, type: 'tawasul_chat', url: '/?tab=tawasul&open=' + taskC.id },
                  });
                } catch(ePushC) { console.error('[chat push]', ridC, ePushC.message); }
              }

              // Also add in-app notif for mentions
              if (isMentionPush) {
                var notifsC = (await dbGet('twsl:notifs')) || [];
                msgC.mentions.forEach(function(mid){
                  if (String(mid) === byC) return;
                  notifsC.push({
                    id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    type: 'chat_mention',
                    taskId: taskC.id,
                    serial: taskC.serial || '',
                    from: msgC.byName || '',
                    preview: previewC,
                    createdAt: nowC,
                    read: false,
                    targetId: mid,
                  });
                });
                if (notifsC.length > 500) notifsC = notifsC.slice(-500);
                await dbSet('twsl:notifs', notifsC);
              }
            } catch(ePush2) { console.error('[chat auto-push]', ePush2.message); }
          })();

          return res.json({ ok: true, message: msgC, task: taskC });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-send error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-chat-react': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bR = req.body || {};
          var taskIdR = String(bR.taskId || '');
          var msgIdR = String(bR.messageId || '');
          var emojiR = String(bR.emoji || '');
          var byR = String(bR.by || '');
          if (!taskIdR || !msgIdR || !emojiR || !byR) return res.status(400).json({ error: 'taskId و messageId و emoji و by مطلوبة' });
          // Whitelist emojis
          var ALLOWED_EMOJI = ['👍','❤️','🎉','😂','❓','🙏','✅'];
          if (ALLOWED_EMOJI.indexOf(emojiR) < 0) return res.status(400).json({ error: 'emoji غير مسموح' });

          var taskR = await dbGet('twsl:' + taskIdR);
          if (!taskR) return res.status(404).json({ error: 'المهمة غير موجودة' });
          var msgsR = taskR.chatMessages || [];
          var idxR2 = msgsR.findIndex(function(m){ return m.id === msgIdR; });
          if (idxR2 < 0) return res.status(404).json({ error: 'الرسالة غير موجودة' });

          var mR = msgsR[idxR2];
          mR.reactions = mR.reactions || {};
          mR.reactions[emojiR] = Array.isArray(mR.reactions[emojiR]) ? mR.reactions[emojiR] : [];
          var list = mR.reactions[emojiR];
          var ex = list.indexOf(byR);
          if (ex >= 0) list.splice(ex, 1); else list.push(byR);
          if (list.length === 0) delete mR.reactions[emojiR];

          msgsR[idxR2] = mR;
          taskR.chatMessages = msgsR;
          taskR.updatedAt = new Date().toISOString();
          await dbSet('twsl:' + taskR.id, taskR);
          return res.json({ ok: true, message: mR });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-react error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-chat-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bD = req.body || {};
          var taskIdD = String(bD.taskId || '');
          var msgIdD = String(bD.messageId || '');
          var byD = String(bD.by || '');
          var isAdminD = !!bD.isAdmin;
          if (!taskIdD || !msgIdD || !byD) return res.status(400).json({ error: 'taskId و messageId و by مطلوبة' });

          var taskD = await dbGet('twsl:' + taskIdD);
          if (!taskD) return res.status(404).json({ error: 'المهمة غير موجودة' });
          var msgsD = taskD.chatMessages || [];
          var idxD = msgsD.findIndex(function(m){ return m.id === msgIdD; });
          if (idxD < 0) return res.status(404).json({ error: 'الرسالة غير موجودة' });

          var mD = msgsD[idxD];
          if (!isAdminD && String(mD.by) !== byD) return res.status(403).json({ error: 'لا يمكنك حذف رسالة شخص آخر' });

          // Soft delete — keep id/thread intact, scrub content
          mD.deleted = true;
          mD.text = '';
          mD.mentions = [];
          msgsD[idxD] = mD;
          taskD.chatMessages = msgsD;
          taskD.updatedAt = new Date().toISOString();
          await dbSet('twsl:' + taskD.id, taskD);
          return res.json({ ok: true });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-chat-list': {
        // GET messages for a task — used for polling refresh
        try {
          var tidL = String((req.query && req.query.taskId) || (req.body && req.body.taskId) || '');
          if (!tidL) return res.status(400).json({ error: 'taskId مطلوب' });
          var taskL = await dbGet('twsl:' + tidL);
          if (!taskL) return res.json({ messages: [] });
          return res.json({ messages: taskL.chatMessages || [], updatedAt: taskL.updatedAt });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-list error: ' + (e.message || 'unknown'), messages: [] });
        }
      }

      /* ═══════════ DESKTOP WEB (سطح المكتب — مثل WhatsApp Web) — v6.31 ═══════════
         Flow:
         1. Desktop opens /#desktop → calls tawasul-web-init → gets { token, pairCode } (valid 5 min)
         2. Desktop polls tawasul-web-status every 2s using token
         3. User opens mobile app → enters pairCode → calls tawasul-web-authorize
         4. Desktop detects status=authorized → loads Tawasul with that user's identity
         5. Session valid 7 days. Desktop can logout via tawasul-web-logout.

         Storage:
         - twsl:web:tok:{token} => { status, createdAt, expiresAt, pairCode, userId?, userName?, authorizedAt? }
         - twsl:web:pair:{pairCode} => token (reverse lookup; one-time use; auto-cleared after auth)
      */
      case 'tawasul-web-init': {
        // Desktop creates a new pairing session
        try {
          var nowW = new Date();
          var tokW = 'wdt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
          // 6-char alphanumeric pair code — avoid confusing chars (0,O,1,I,L)
          var alphaW = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
          var pairW = '';
          for (var iW = 0; iW < 6; iW++) pairW += alphaW.charAt(Math.floor(Math.random() * alphaW.length));
          // Ensure pairCode uniqueness (low probability of clash but check)
          var existingW = await dbGet('twsl:web:pair:' + pairW);
          if (existingW) {
            // Collision — regenerate once
            pairW = '';
            for (var iW2 = 0; iW2 < 6; iW2++) pairW += alphaW.charAt(Math.floor(Math.random() * alphaW.length));
          }
          var expW = new Date(nowW.getTime() + 5 * 60 * 1000).toISOString(); // 5 min expiry
          var sessW = {
            token: tokW,
            pairCode: pairW,
            status: 'pending',
            createdAt: nowW.toISOString(),
            expiresAt: expW,
          };
          await dbSet('twsl:web:tok:' + tokW, sessW);
          await dbSet('twsl:web:pair:' + pairW, tokW);
          return res.json({ token: tokW, pairCode: pairW, expiresInSec: 300 });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-init error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-web-status': {
        // Desktop polls with token
        try {
          var tokSW = String((req.query && req.query.token) || (req.body && req.body.token) || '');
          if (!tokSW) return res.status(400).json({ error: 'token مطلوب' });
          var sessSW = await dbGet('twsl:web:tok:' + tokSW);
          if (!sessSW) return res.json({ status: 'expired' });
          // Mark pending as expired if past expiry
          if (sessSW.status === 'pending' && new Date(sessSW.expiresAt) < new Date()) {
            sessSW.status = 'expired';
            await dbSet('twsl:web:tok:' + tokSW, sessSW);
            // Clean up pair lookup too
            if (sessSW.pairCode) await dbSet('twsl:web:pair:' + sessSW.pairCode, null);
          }
          return res.json({
            status: sessSW.status,
            userId: sessSW.userId || null,
            userName: sessSW.userName || null,
            userData: sessSW.userData || null,
            authorizedAt: sessSW.authorizedAt || null,
            expiresAt: sessSW.expiresAt,
          });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-status error: ' + (e.message || 'unknown'), status: 'error' });
        }
      }

      case 'tawasul-web-authorize': {
        // Mobile authorizes using pairCode
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bAW = req.body || {};
          var pairAW = String(bAW.pairCode || '').toUpperCase().trim();
          var uidAW = String(bAW.userId || '');
          var unmAW = String(bAW.userName || '');
          if (!pairAW || !uidAW) return res.status(400).json({ error: 'pairCode و userId مطلوبان' });
          if (pairAW.length !== 6) return res.status(400).json({ error: 'رمز غير صحيح — يجب 6 خانات' });

          var tokAW = await dbGet('twsl:web:pair:' + pairAW);
          if (!tokAW) return res.status(404).json({ error: 'الرمز غير صحيح أو انتهت صلاحيته' });

          var sessAW = await dbGet('twsl:web:tok:' + tokAW);
          if (!sessAW) {
            await dbSet('twsl:web:pair:' + pairAW, null);
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
          }
          if (sessAW.status !== 'pending') {
            return res.status(400).json({ error: 'الجلسة سبق استخدامها' });
          }
          if (new Date(sessAW.expiresAt) < new Date()) {
            sessAW.status = 'expired';
            await dbSet('twsl:web:tok:' + tokAW, sessAW);
            await dbSet('twsl:web:pair:' + pairAW, null);
            return res.status(400).json({ error: 'انتهت صلاحية الرمز' });
          }

          // Authorize
          var nowAW2 = new Date();
          sessAW.status = 'authorized';
          sessAW.userId = uidAW;
          sessAW.userName = unmAW;
          sessAW.userData = bAW.userData || null; // Full user object from mobile (v6.31)
          sessAW.authorizedAt = nowAW2.toISOString();
          sessAW.expiresAt = new Date(nowAW2.getTime() + 7 * 24 * 3600 * 1000).toISOString(); // 7 days
          await dbSet('twsl:web:tok:' + tokAW, sessAW);
          // One-time use — clear pair lookup
          await dbSet('twsl:web:pair:' + pairAW, null);

          return res.json({ ok: true, user: { id: uidAW, name: unmAW } });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-authorize error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-web-logout': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var tokLW = String((req.body && req.body.token) || '');
          if (!tokLW) return res.status(400).json({ error: 'token مطلوب' });
          var sessLW = await dbGet('twsl:web:tok:' + tokLW);
          if (sessLW && sessLW.pairCode) await dbSet('twsl:web:pair:' + sessLW.pairCode, null);
          await dbSet('twsl:web:tok:' + tokLW, null);
          return res.json({ ok: true });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-logout error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-check-recurring': {
        // Check recurring task templates and generate next instance if due
        // Should be called periodically (client polls on load; can also be a cron)
        try {
          var idxR = (await dbGet('twsl:idx')) || [];
          var nowR = Date.now();
          var generated = 0;
          var errors = [];

          function calcNextDue(pattern, interval, fromIso, weekdays) {
            var iv = interval || 1;
            var d = new Date(fromIso);
            if (pattern === 'daily') {
              d.setDate(d.getDate() + iv);
            } else if (pattern === 'weekly') {
              if (Array.isArray(weekdays) && weekdays.length > 0) {
                // Find next weekday in the list
                var currentDay = d.getDay();
                var sorted = weekdays.slice().sort();
                var nextDay = sorted.find(function(w){ return w > currentDay; });
                if (nextDay !== undefined) {
                  d.setDate(d.getDate() + (nextDay - currentDay));
                } else {
                  // wrap to next week's first day
                  d.setDate(d.getDate() + (7 - currentDay + sorted[0]));
                }
                // If interval > 1, add extra weeks after wrap
                if (iv > 1 && nextDay === undefined) {
                  d.setDate(d.getDate() + (iv - 1) * 7);
                }
              } else {
                d.setDate(d.getDate() + 7 * iv);
              }
            } else if (pattern === 'monthly') {
              d.setMonth(d.getMonth() + iv);
            } else if (pattern === 'yearly') {
              d.setFullYear(d.getFullYear() + iv);
            }
            return d.toISOString();
          }

          for (var i = 0; i < idxR.length; i++) {
            var tmpl = await dbGet('twsl:' + idxR[i]);
            if (!tmpl || !tmpl.id) continue;
            if (!tmpl.recurrence || !tmpl.recurrence.pattern) continue;
            if (tmpl.recurrence.paused) continue;

            var nextDueIso = tmpl.recurrence.nextDue || tmpl.deadline || tmpl.createdAt;
            if (!nextDueIso) continue;
            var nextDueMs = new Date(nextDueIso).getTime();

            // Skip if not yet due
            if (nextDueMs > nowR) continue;

            // Skip if past end date
            if (tmpl.recurrence.endDate) {
              var endMs = new Date(tmpl.recurrence.endDate).getTime();
              if (nowR > endMs) continue;
            }

            try {
              // Create a new instance (copy of template, fresh ID/serial/status)
              var counter = (await dbGet('twsl:serial')) || 0;
              counter = counter + 1;
              await dbSet('twsl:serial', counter);

              var newInstance = Object.assign({}, tmpl, {
                id: 'twsl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                serial: 'CB' + String(counter).padStart(4, '0'),
                status: 'sent',
                deadline: nextDueIso,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                log: [{
                  text: '🔁 مهمة مُتكرّرة — مُولَّدة تلقائياً (#' + tmpl.serial + ')',
                  by: 'النظام',
                  at: new Date().toISOString(),
                }],
                evaluations: [],
                attachments: [], // fresh attachments
                rejectionReason: null,
                returnReason: null,
                rejectedCount: 0,
                returnCount: 0,
                escalation: null,
                escalatedAt: null,
                finalScore: null,
                pendingCollabRequests: [],
                // reset assignee states
                assignees: (tmpl.assignees || []).map(function(a){
                  return Object.assign({}, a, { acceptedAt: null, deliveredAt: null, returns: 0, objected: false });
                }),
                // Track origin
                recurrenceParentId: tmpl.id,
                recurrenceParentSerial: tmpl.serial,
                recurrence: null, // instance is not itself recurring
              });
              await dbSet('twsl:' + newInstance.id, newInstance);

              // Add to index
              var idxNow = (await dbGet('twsl:idx')) || [];
              if (idxNow.indexOf(newInstance.id) < 0) {
                idxNow.push(newInstance.id);
                await dbSet('twsl:idx', idxNow);
              }

              // Create notifications for assignees
              var notifsR = (await dbGet('twsl:notifs')) || [];
              (newInstance.assignees || []).forEach(function(a){
                notifsR.push({
                  id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                  type: 'new_task_recurring',
                  taskId: newInstance.id,
                  serial: newInstance.serial,
                  from: newInstance.requesterName || '',
                  createdAt: new Date().toISOString(),
                  read: false,
                  targetId: a.id,
                });
              });
              if (notifsR.length > 500) notifsR = notifsR.slice(-500);
              await dbSet('twsl:notifs', notifsR);

              // Update template's nextDue + generationCount
              var updatedRec = Object.assign({}, tmpl.recurrence, {
                nextDue: calcNextDue(tmpl.recurrence.pattern, tmpl.recurrence.interval, nextDueIso, tmpl.recurrence.weekdays),
                generationCount: (tmpl.recurrence.generationCount || 0) + 1,
                lastGeneratedAt: new Date().toISOString(),
              });
              tmpl.recurrence = updatedRec;
              tmpl.updatedAt = new Date().toISOString();
              await dbSet('twsl:' + tmpl.id, tmpl);

              generated++;
            } catch (innerE) {
              errors.push('twsl:' + idxR[i] + ' — ' + (innerE.message || 'error'));
            }
          }

          return res.json({ ok: true, generated: generated, errors: errors, checked: idxR.length });
        } catch (e) {
          return res.status(500).json({ error: 'check-recurring error: ' + (e.message || 'unknown'), generated: 0 });
        }
      }

      case 'tawasul-check-escalations': {
        // Check and update auto-escalations (spec section 13) — native
        try {
          var idxE = (await dbGet('twsl:idx')) || [];
          var nowE = Date.now();
          var savedE = 0;
          for (var i = 0; i < idxE.length; i++) {
            var rE = await dbGet('twsl:' + idxE[i]);
            if (!rE || !rE.id) continue;
            if (['closed','cancelled','evaluated'].indexOf(rE.status) >= 0) continue;
            var updated = null;
            // Yellow: 3 days after issueAt
            if (rE.escalation !== 'yellow' && rE.escalation !== 'red' && rE.issueAt) {
              if (nowE - new Date(rE.issueAt).getTime() > 3 * 86400000) {
                updated = Object.assign({}, rE, { escalation: 'yellow', escalatedAt: new Date().toISOString() });
              }
            }
            // Red: 7 days after yellow
            else if (rE.escalation === 'yellow' && rE.escalatedAt) {
              if (nowE - new Date(rE.escalatedAt).getTime() > 7 * 86400000) {
                updated = Object.assign({}, rE, { escalation: 'red', redEscalatedAt: new Date().toISOString() });
              }
            }
            if (updated) {
              await dbSet('twsl:' + rE.id, updated);
              savedE++;
            }
          }
          return res.json({ ok: true, updates: savedE, checked: idxE.length });
        } catch (e) {
          return res.status(500).json({ error: 'check-escalations error: ' + (e.message || 'unknown'), updates: 0 });
        }
      }

      case 'tawasul-categories': {
        // Manage categories (for admin panel later)
        try {
          if (req.method === 'POST') {
            var cats = req.body && req.body.categories;
            if (!Array.isArray(cats)) return res.status(400).json({ error: 'categories array required' });
            await dbSet('twsl:categories', cats);
            return res.json({ ok: true, categories: cats });
          }
          var catsR = (await dbGet('twsl:categories')) || [];
          return res.json({ ok: true, categories: catsR });
        } catch (e) {
          return res.status(500).json({ error: 'categories error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-projects': {
        // Manage projects (reuse main projects from geofence if exists)
        try {
          if (req.method === 'POST') {
            var prjs = req.body && req.body.projects;
            if (!Array.isArray(prjs)) return res.status(400).json({ error: 'projects array required' });
            await dbSet('twsl:projects', prjs);
            return res.json({ ok: true, projects: prjs });
          }
          // Try twsl:projects first, fallback to geofence projects
          var prjsR = await dbGet('twsl:projects');
          if (!prjsR || !prjsR.length) {
            prjsR = (await dbGet('projects')) || [];
          }
          return res.json({ ok: true, projects: prjsR });
        } catch (e) {
          return res.status(500).json({ error: 'projects error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-permissions': {
        // Manage per-employee inbox permissions (admin only)
        // Each employee has: tawasulInbox ("anyone" | "restricted" | "none")
        //                     tawasulAllowedSenders: [empId, empId, ...]
        try {
          if (req.method === 'POST') {
            var body = req.body || {};
            var empId = body.empId;
            if (!empId) return res.status(400).json({ error: 'empId required' });
            var emps = (await dbGet('employees')) || [];
            var idx = emps.findIndex(function(e){ return String(e.id) === String(empId) || e.username === empId; });
            if (idx < 0) return res.status(404).json({ error: 'employee not found' });
            emps[idx] = Object.assign({}, emps[idx], {
              tawasulInbox: body.tawasulInbox || 'anyone',
              tawasulAllowedSenders: Array.isArray(body.tawasulAllowedSenders) ? body.tawasulAllowedSenders : [],
            });
            await dbSet('employees', emps);
            return res.json({ ok: true, employee: emps[idx] });
          }
          // GET: list all employees with their permissions
          var empsR = (await dbGet('employees')) || [];
          var perms = empsR.map(function(e){
            return {
              id: e.id,
              username: e.username,
              name: e.name,
              department: e.department,
              tawasulInbox: e.tawasulInbox || 'anyone',
              tawasulAllowedSenders: e.tawasulAllowedSenders || [],
            };
          });
          return res.json({ ok: true, permissions: perms });
        } catch (e) {
          return res.status(500).json({ error: 'permissions error: ' + (e.message || 'unknown') });
        }
      }

      /* ═══ HR AI DECISIONS (سجل قرارات المساعد الذكي) ═══ */
      case 'hr-ai-decisions': {
        try {
          if (req.method === 'POST') {
            var bd = req.body || {};
            var decision = bd.decision;
            if (!decision || !decision.id) return res.status(400).json({ error: 'decision.id required' });
            var decs = (await dbGet('hr_ai:decisions')) || [];
            var dIdx = decs.findIndex(function(d){ return d.id === decision.id; });
            if (dIdx >= 0) {
              decs[dIdx] = decision; // update (for undo)
            } else {
              decs.push(decision); // new
              if (decs.length > 1000) decs = decs.slice(-1000); // keep last 1000
            }
            await dbSet('hr_ai:decisions', decs);
            return res.json({ ok: true, decision: decision, total: decs.length });
          }
          // GET: return all decisions
          var decsR = (await dbGet('hr_ai:decisions')) || [];
          return res.json({ ok: true, decisions: decsR, total: decsR.length });
        } catch (e) {
          return res.status(500).json({ error: 'hr-ai-decisions error: ' + (e.message || 'unknown') });
        }
      }

      /* ═══ BANNERS — بنر الصفحة الرئيسية ═══ */
      case 'banners': {
        if (req.method === 'POST') {
          var body = req.body || {};
          var list = (await dbGet('banners')) || [];

          if (body.delete) {
            list = list.filter(function(b){ return b.id !== body.delete; });
            await dbSet('banners', list);
            return res.json({ ok: true, deleted: body.delete });
          }

          if (body.reorder && Array.isArray(body.reorder)) {
            var reordered = body.reorder.map(function(id, idx){
              var found = list.find(function(b){ return b.id === id; });
              return found ? Object.assign({}, found, { order: idx }) : null;
            }).filter(Boolean);
            await dbSet('banners', reordered);
            return res.json({ ok: true });
          }

          if (body.id) {
            var idx = list.findIndex(function(b){ return b.id === body.id; });
            if (idx >= 0) {
              list[idx] = Object.assign({}, list[idx], body, { updatedAt: new Date().toISOString() });
            } else {
              list.push(Object.assign({}, body, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
            }
            await dbSet('banners', list);
            return res.json({ ok: true, banner: list[idx >= 0 ? idx : list.length - 1] });
          }

          // Create new
          var newBanner = {
            id: "bnr_" + Date.now(),
            title: body.title || "",
            content: body.content || "",
            imageUrl: body.imageUrl || "",
            linkUrl: body.linkUrl || "",
            priority: body.priority || "normal",
            active: body.active !== false,
            startDate: body.startDate || null,
            endDate: body.endDate || null,
            order: list.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          list.push(newBanner);
          await dbSet('banners', list);
          return res.json({ ok: true, banner: newBanner });
        }

        // GET
        var list = (await dbGet('banners')) || [];
        var now = new Date();
        var adminView = req.query && req.query.admin === '1';
        var filtered = adminView ? list : list.filter(function(b){
          if (!b.active) return false;
          if (b.startDate && new Date(b.startDate) > now) return false;
          if (b.endDate && new Date(b.endDate) < now) return false;
          return true;
        });
        filtered.sort(function(a,b){ return (a.order || 0) - (b.order || 0); });
        return res.json({ ok: true, banners: filtered });
      }

      /* ═══ ANNOUNCEMENTS — التعاميم ═══ */
      case 'announcements': {
        if (req.method === 'POST') {
          var body = req.body || {};
          var list = (await dbGet('announcements')) || [];
          if (body.delete) {
            list = list.filter(function(a){ return a.id !== body.delete; });
            await dbSet('announcements', list);
            return res.json({ ok: true, deleted: body.delete });
          }
          if (body.id) {
            // Update existing
            var idx = list.findIndex(function(a){ return a.id === body.id; });
            if (idx >= 0) list[idx] = { ...list[idx], ...body };
            else list.unshift(body);
          } else {
            // New
            body.id = 'A' + Date.now();
            body.ts = new Date().toISOString();
            body.readBy = [];
            list.unshift(body);
          }
          await dbSet('announcements', list);
          return res.json({ ok: true, announcement: body });
        }
        var all = (await dbGet('announcements')) || [];
        var empId2 = req.query ? req.query.empId : null;
        if (empId2) {
          // Filter by employee targeting
          all = all.filter(function(a){
            if (!a.published) return false;
            if (a.target === 'all') return true;
            if (a.target === 'branch' && a.targetIds && a.targetIds.indexOf(empId2) < 0) {
              // need to check by branch — we'll return and let client filter
              return true;
            }
            if (a.target === 'employees' && a.targetIds && a.targetIds.indexOf(empId2) >= 0) return true;
            return a.target === 'all';
          });
        }
        return res.json(all);
      }

      /* ═══ MARK ANNOUNCEMENT READ ═══ */
      case 'announcement-read': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        var list = (await dbGet('announcements')) || [];
        var idx = list.findIndex(function(a){ return a.id === body.announcementId; });
        if (idx >= 0) {
          if (!list[idx].readBy) list[idx].readBy = [];
          if (list[idx].readBy.indexOf(body.empId) < 0) list[idx].readBy.push(body.empId);
          await dbSet('announcements', list);
        }
        return res.json({ ok: true });
      }

      /* ═══ PING — اختبار بسيط بدون fetch ═══ */
      case 'ping': {
        return res.json({ ok: true, msg: 'pong', ts: new Date().toISOString(), nodeVer: process.version, fetchAvailable: typeof fetch === 'function' });
      }

      /* ═══ SYNC KADWAR — جلب الموظفين من كوادر ومزامنتهم ═══ */
      case 'sync-kadwar': {
        var sourceUrl = 'https://hma.engineer/api/basma-sync?action=employees';
        var summary = { ok: false, url: sourceUrl, ts: new Date().toISOString() };
        try {
          // 1. Fetch from kadwar
          var r = await fetch(sourceUrl, { method: 'GET' });
          summary.fetchStatus = r.status;
          if (!r.ok) { summary.error = 'fetch failed with status ' + r.status; return res.json(summary); }
          var data = await r.json();
          if (!data || !Array.isArray(data.employees)) { summary.error = 'invalid response shape'; summary.raw = data; return res.json(summary); }

          // 2. Branch mapping (kadwar → basma)
          var branchMap = {
            'المركز الرئيسي — جدة': 'jed',
            'المركز الرئيسي': 'jed',
            'جدة': 'jed',
            'الرياض': 'riy',
            'اسطنبول': 'ist',
            'إسطنبول': 'ist',
            'غازي عنتاب': 'gaz',
          };
          function mapBranch(kadBranch) {
            if (!kadBranch) return 'jed';
            if (branchMap[kadBranch]) return branchMap[kadBranch];
            var lower = kadBranch.toLowerCase();
            if (lower.indexOf('جدة') >= 0) return 'jed';
            if (lower.indexOf('رياض') >= 0) return 'riy';
            if (lower.indexOf('اسطنبول') >= 0 || lower.indexOf('istanbul') >= 0) return 'ist';
            if (lower.indexOf('غازي') >= 0 || lower.indexOf('عنتاب') >= 0) return 'gaz';
            return 'jed';
          }

          // 3. Load existing to preserve basma-specific data (points, face, etc.)
          var existing = await dbGet('employees') || [];
          var existingByEmail = {};
          var existingByKadwarId = {};
          var existingByIdNumber = {};
          existing.forEach(function(e) {
            if (e.email) existingByEmail[e.email.toLowerCase()] = e;
            if (e.kadwarId) existingByKadwarId[e.kadwarId] = e;
            if (e.idNumber) existingByIdNumber[e.idNumber] = e;
          });

          // 4. Build kadwar-id → email mapping (for hierarchy)
          var kadIdToEmail = {};
          data.employees.forEach(function(kad) {
            var kadId = kad.id || kad.uid || kad.idNumber;
            var email = (kad.email || '').toLowerCase();
            if (kadId && email) kadIdToEmail[kadId] = email;
          });

          // 5. Merge: kadwar data + basma-specific preserved
          var merged = data.employees.map(function(kad) {
            var email = (kad.email || '').toLowerCase();
            var kadId = kad.id || kad.uid || kad.idNumber;
            var prev = existingByIdNumber[kad.idNumber] || existingByEmail[email] || existingByKadwarId[kadId] || {};
            // Resolve manager email from managerId
            var managerEmail = kad.managerId && kadIdToEmail[kad.managerId] ? kadIdToEmail[kad.managerId] : '';
            var supervisorEmail = kad.supervisorId && kadIdToEmail[kad.supervisorId] ? kadIdToEmail[kad.supervisorId] : '';
            return {
              // Identity (idNumber is the unified ID)
              id: kad.idNumber || kadId,
              idNumber: kad.idNumber || '',
              kadwarId: kadId,
              email: email,
              // Account (from kadwar — managed there)
              username: (kad.username || '').toLowerCase(),
              hasAccount: kad.hasAccount !== undefined ? kad.hasAccount : !!(kad.username && kad.passwordHash),
              accountRole: kad.accountRole || 'employee',
              passwordHash: kad.passwordHash || '',
              passwordAlgo: kad.passwordAlgo || 'sha256',
              passwordSalt: kad.passwordSalt || 'hr_salt_2024',
              passwordUpdatedAt: kad.passwordUpdatedAt || null,
              // Profile (from kadwar)
              name: kad.name || prev.name || '',
              role: (kad.role || prev.role || '').trim(),
              department: kad.department || prev.department || '',
              branch: mapBranch(kad.branch),
              branchName: kad.branch || '',
              phone: kad.phone || prev.phone || '',
              status: kad.status || 'active',
              // Hierarchy (from kadwar)
              managerKadwarId: kad.managerId || '',
              managerEmail: managerEmail,
              supervisorKadwarId: kad.supervisorId || '',
              supervisorEmail: supervisorEmail,
              isManager: kad.accountRole === 'manager' || kad.accountRole === 'admin' || (kad.role || '').indexOf('مدير') >= 0 || prev.isManager || false,
              isAdmin: kad.accountRole === 'admin' || prev.isAdmin || false,
              // Basma-specific (preserved)
              points: prev.points || 0,
              type: prev.type || 'office',
              flexBase: prev.flexBase || false,
              flexOT: prev.flexOT || false,
              flexOTMax: prev.flexOTMax || 0,
              remote: prev.remote || false,
              observed: prev.observed || false,
              onLeave: prev.onLeave || false,
              salary: prev.salary || 0,
              joinDate: prev.joinDate || '',
              dob: prev.dob || '',
              sceNumber: prev.sceNumber || '',
              sceExpiry: prev.sceExpiry || '',
              sceStatus: prev.sceStatus || '',
              // Sync metadata
              source: 'kadwar',
              syncedAt: new Date().toISOString(),
            };
          });

          // 6. Build subordinates list (reverse lookup via kadwarId)
          merged.forEach(function(emp) {
            emp.subordinates = merged.filter(function(e) {
              return e.managerKadwarId && e.managerKadwarId === emp.kadwarId && e.id !== emp.id;
            }).map(function(e) { return e.id; });
            emp.subordinatesCount = emp.subordinates.length;
          });

          // 7. Save
          await dbSet('kadwar_employees', merged);
          await dbSet('employees', merged);

          // 8. Summary
          var newItems = merged.filter(function(e) { return !existingByIdNumber[e.idNumber] && !existingByKadwarId[e.kadwarId]; });
          var removed = existing.filter(function(e) {
            return !merged.find(function(m) {
              return m.idNumber === e.idNumber || m.kadwarId === e.kadwarId || (m.email && m.email === (e.email || '').toLowerCase());
            });
          });

          summary.ok = true;
          summary.count = merged.length;
          summary.added = newItems.length;
          summary.updated = merged.length - newItems.length;
          summary.removedCount = removed.length;
          summary.removed = removed.map(function(e) { return { id: e.id, name: e.name, email: e.email }; });
          summary.byBranch = merged.reduce(function(acc, e) {
            acc[e.branch] = (acc[e.branch] || 0) + 1;
            return acc;
          }, {});
          summary.withAccount = merged.filter(function(e) { return e.hasAccount; }).length;
          summary.withoutAccount = merged.filter(function(e) { return !e.hasAccount; }).length;
          summary.managers = merged.filter(function(e) { return e.isManager; }).length;
          summary.admins = merged.filter(function(e) { return e.isAdmin; }).length;
          summary.sample = merged.slice(0, 3).map(function(e) {
            return { idNumber: e.idNumber, username: e.username, name: e.name, role: e.role, branch: e.branch, hasAccount: e.hasAccount, accountRole: e.accountRole, subordinatesCount: e.subordinatesCount };
          });
          return res.json(summary);
        } catch (e) {
          summary.error = 'exception: ' + (e && e.message ? e.message : String(e));
          return res.json(summary);
        }
      }

      /* ═══ ADMIN CONFIG — بيانات المدير العام (خاص ببصمة) ═══ */
      case 'admin-config': {
        if (req.method === 'GET') {
          var admin = await dbGet('admin_config') || null;
          if (!admin) return res.json({ ok: true, exists: false });
          // Don't send password back
          return res.json({ ok: true, exists: true, email: admin.email, name: admin.name, updatedAt: admin.updatedAt });
        }
        if (req.method === 'POST') {
          // Set or update admin credentials
          var body = req.body || {};
          if (!body.email || !body.password) return res.status(400).json({ error: 'email and password required' });
          var current = await dbGet('admin_config');
          // If updating, verify current password
          if (current && body.currentPassword !== current.password) {
            return res.status(401).json({ error: 'current password incorrect' });
          }
          var admin = {
            email: body.email.toLowerCase(),
            password: body.password,
            name: body.name || current?.name || 'المدير العام',
            role: 'المدير العام',
            isGeneralManager: true,
            updatedAt: new Date().toISOString(),
          };
          await dbSet('admin_config', admin);
          return res.json({ ok: true, email: admin.email });
        }
        break;
      }

      /* ═══ READ KADWAR EMPLOYEES — عرض الموظفين المُزامَنين ═══ */
      case 'kadwar-employees': {
        var stored = await dbGet('kadwar_employees');
        if (!stored) return res.json({ ok: false, msg: 'no sync yet — call ?action=sync-kadwar first' });
        return res.json({ ok: true, count: stored.length, employees: stored, lastSync: stored[0] && stored[0].syncedAt });
      }

      /* ═══ TEST KADWAR SYNC — اختبار الاتصال بكوادر ═══ */
      case 'test-kadwar-sync': {
        var url = 'https://hma.engineer/api/basma-sync?action=employees';
        var result = { ok: false, url: url, ts: new Date().toISOString() };
        try {
          if (typeof fetch !== 'function') {
            result.error = 'fetch not available in runtime';
            return res.json(result);
          }
          var r;
          try {
            r = await fetch(url, { method: 'GET' });
          } catch (fetchErr) {
            result.error = 'fetch failed: ' + (fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr));
            return res.json(result);
          }
          result.status = r.status || 0;
          try {
            var txt = await r.text();
            result.bodyPreview = (txt || '').slice(0, 300);
          } catch (textErr) {
            result.bodyError = 'text() failed: ' + (textErr && textErr.message ? textErr.message : String(textErr));
          }
          result.ok = result.status >= 200 && result.status < 300;
          return res.json(result);
        } catch (e) {
          result.error = 'outer: ' + (e && e.message ? e.message : String(e));
          try { return res.json(result); } catch(e2) { return res.status(200).send(JSON.stringify(result)); }
        }
      }

      case 'kadwar-sync': {
        // ═══ API for kadwar (hma.engineer) to read basma data ═══
        // Called from: hma.engineer → GET b.hma.engineer/api/data?action=kadwar-sync
        if (req.method === 'GET') {
          var emps = await dbGet('employees') || [];
          var att = await dbGet('attendance') || [];
          var violationsV2 = await dbGet('violations_v2') || [];
          var today = new Date().toISOString().split('T')[0];
          var d30 = new Date(); d30.setDate(d30.getDate() - 30);
          var d30Str = d30.toISOString().split('T')[0];

          // Single employee detail
          if (req.query.empId) {
            var emp = emps.find(e => e.id === req.query.empId);
            if (!emp) return res.json({ error: 'not found' });
            var empAtt = att.filter(a => a.empId === emp.id);
            var last30Att = empAtt.filter(a => a.type === 'checkin' && a.date >= d30Str);
            var compliance = Math.min(100, Math.round((last30Att.length / 26) * 100));
            var empVios = violationsV2.filter(v => v.empId === emp.id && v.status === 'ACTIVE');
            var todayCheckin = empAtt.find(a => a.date === today && a.type === 'checkin');
            return res.json({
              id: emp.id, name: emp.name, role: emp.role, branch: emp.branch,
              compliance: compliance,
              points: emp.points || 0,
              activeViolations: empVios.length,
              violations: empVios.map(v => ({ id: v.id, violationId: v.violationId, description: v.description, penaltyLabel: v.penaltyLabel, occurrence: v.occurrence, createdAt: v.createdAt })),
              todayStatus: todayCheckin ? 'present' : 'absent',
              todayCheckinTime: todayCheckin ? todayCheckin.ts : null,
              last30Days: last30Att.length,
              syncDate: new Date().toISOString(),
            });
          }

          // All employees summary
          var summary = emps.filter(e => !e.terminated).map(function(emp) {
            var empAtt30 = att.filter(a => a.empId === emp.id && a.type === 'checkin' && a.date >= d30Str);
            var compliance = Math.min(100, Math.round((empAtt30.length / 26) * 100));
            var activeVios = violationsV2.filter(v => v.empId === emp.id && v.status === 'ACTIVE').length;
            var todayCheckin = att.find(a => a.empId === emp.id && a.date === today && a.type === 'checkin');
            return {
              id: emp.id, name: emp.name, branch: emp.branch,
              compliance: compliance,
              points: emp.points || 0,
              activeViolations: activeVios,
              todayStatus: todayCheckin ? 'present' : 'absent',
            };
          });
          return res.json({ employees: summary, total: summary.length, syncDate: new Date().toISOString() });
        }

        // kadwar pushes employee data to basma
        if (req.method === 'POST') {
          // Sync: kadwar sends tasks/evaluations/notifications for an employee
          var empId = req.body.empId;
          if (!empId) return res.json({ error: 'empId required' });
          var kadwarData = await dbGet('kadwar_data') || {};
          kadwarData[empId] = {
            tasks: req.body.tasks || [],
            evaluations: req.body.evaluations || [],
            notifications: req.body.notifications || { tasks: 0, exams: 0, alerts: 0 },
            updatedAt: new Date().toISOString(),
          };
          await dbSet('kadwar_data', kadwarData);
          // Also update kadwar_notifs for badge display
          var notifs = await dbGet('kadwar_notifs') || {};
          notifs[empId] = req.body.notifications || { tasks: 0, exams: 0, alerts: 0 };
          await dbSet('kadwar_notifs', notifs);
          return res.json({ ok: true });
        }
        break;
      }

      case 'report': {
        const { period } = req.query; // 'weekly' or 'monthly'
        const emps = await dbGet('employees') || [];
        const att = await dbGet('attendance') || [];
        const violations = await dbGet('violations') || [];
        const warnings = await dbGet('warnings') || [];
        const leaves = await dbGet('leaves') || [];
        const now = new Date();
        var startDate, endDate = now.toISOString().split('T')[0];

        if (period === 'weekly') {
          var d = new Date(); d.setDate(d.getDate() - 7);
          startDate = d.toISOString().split('T')[0];
        } else {
          var d2 = new Date(); d2.setMonth(d2.getMonth() - 1);
          startDate = d2.toISOString().split('T')[0];
        }

        var periodAtt = att.filter(a => a.date >= startDate && a.date <= endDate);
        var periodViol = violations.filter(v => (v.date || v.ts?.split('T')[0]) >= startDate);
        var periodWarn = warnings.filter(w => w.ts?.split('T')[0] >= startDate);
        var periodLeaves = leaves.filter(l => l.ts?.split('T')[0] >= startDate);

        // Build per-employee summary
        var empSummary = emps.filter(e => !e.terminated).map(function(e) {
          var myAtt = periodAtt.filter(a => a.empId === e.id);
          var checkins = myAtt.filter(a => a.type === "الحضور").length;
          var myViol = periodViol.filter(v => v.empId === e.id);
          var myWarn = periodWarn.filter(w => w.empId === e.id);
          var lateCount = myViol.filter(v => v.type === "late").length;
          var absentCount = myViol.filter(v => v.type === "absent").length;
          return {
            id: e.id, name: e.name, branch: e.branch, role: e.role,
            daysPresent: checkins, lateCount, absentCount,
            violationCount: myViol.length, warningCount: myWarn.length,
            pendingWarnings: myWarn.filter(w => w.status === "pending").length,
          };
        });

        return res.json({
          period: period || 'monthly',
          from: startDate, to: endDate,
          totalEmployees: emps.filter(e => !e.terminated).length,
          totalAttendance: periodAtt.length,
          totalViolations: periodViol.length,
          totalWarnings: periodWarn.length,
          pendingWarnings: periodWarn.filter(w => w.status === "pending").length,
          escalatedWarnings: periodWarn.filter(w => w.status === "escalated").length,
          pendingLeaves: periodLeaves.filter(l => l.status === "pending").length,
          employees: empSummary,
          generatedAt: now.toISOString()
        });
      }

      case 'export': {
        const { type } = req.query;
        const emps = await dbGet('employees') || [];
        const att = await dbGet('attendance') || [];
        if (type === 'payroll') {
          const vs = await dbGet('violations') || [];
          let csv = 'الرقم,الاسم,الراتب,الخصومات,الصافي\n';
          emps.forEach(e => { const d = vs.filter(v => v.empId === e.id).reduce((a, v) => a + (v.deduction || 0), 0); csv += `${e.id},${e.name},${e.salary},${d},${e.salary - d}\n`; });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'attendance') {
          let csv = 'التاريخ,الرقم,الاسم,النوع,الوقت,يدوي\n';
          att.forEach(r => { const e = emps.find(x => x.id === r.empId); csv += `${r.date},${r.empId},${e?.name || ''},${r.type},${r.ts},${r.manual ? 'نعم' : 'لا'}\n`; });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'redemptions') {
          var reds = await dbGet('redemptions') || [];
          var csv = 'التاريخ,رقم الموظف,اسم الكوبون,النقاط\n';
          reds.forEach(function(r){
            var e = emps.find(function(x){ return x.id === r.empId; });
            csv += (r.ts || '') + ',' + (r.empId || '') + ',"' + (e ? e.name : '') + '","' + (r.couponName || '') + '",' + (r.pts || 0) + '\n';
          });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'announcements') {
          var anns = await dbGet('announcements') || [];
          var csv2 = 'التاريخ,العنوان,المحتوى,الأولوية,الاستهداف,منشور,عدد القراءات\n';
          anns.forEach(function(a){
            csv2 += (a.ts || '') + ',"' + (a.title || '').replace(/"/g,'""') + '","' + (a.body || '').replace(/"/g,'""').replace(/\n/g,' ') + '",' + (a.priority || 'normal') + ',' + (a.target || 'all') + ',' + (a.published ? 'نعم' : 'لا') + ',' + ((a.readBy || []).length) + '\n';
          });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv2);
        }
        if (type === 'employees_list') {
          var csv3 = 'الرقم,الاسم,المسمى,الفرع,القسم,الإيميل,الجوال,الحالة,حساب نشط\n';
          emps.forEach(function(e){
            csv3 += (e.idNumber || e.id) + ',"' + (e.name || '') + '","' + (e.role || '') + '","' + (e.branchName || e.branch || '') + '","' + (e.department || '') + '","' + (e.email || '') + '","' + (e.phone || '') + '",' + (e.status || 'active') + ',' + (e.hasAccount ? 'نعم' : 'لا') + '\n';
          });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv3);
        }
        return res.json({ error: 'unknown type' });
      }

      /* ═══ EMPLOYEE RECORDS (سجل وظيفي — عقود/ترقيات) ═══ */
      case 'emp_records': {
        if (req.method === 'GET') {
          var records = await dbGet('emp_records') || [];
          if (req.query.empId) records = records.filter(r => r.empId === req.query.empId);
          if (req.query.type) records = records.filter(r => r.recordType === req.query.type);
          return res.json(records);
        }
        if (req.method === 'POST') {
          var records = await dbGet('emp_records') || [];
          records.push({
            id: 'REC' + Date.now(),
            createdAt: new Date().toISOString(),
            ...req.body,
          });
          await dbSet('emp_records', records);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var records = await dbGet('emp_records') || [];
          records = records.filter(r => r.id !== req.query.id);
          await dbSet('emp_records', records);
          return res.json({ ok: true });
        }
        break;
      }

      case 'cleanup': {
        if (req.method === 'GET') {
          // Return data sizes for each table
          var tables = ['attendance','violations','violations_v2','warnings','complaints','investigations','appeals','notifications','leaves','permissions','pre_absences','tickets','gps_log','faces','attachments','health_disclosures','dependents','custody','events','kadwar_data','kadwar_notifs','employees','branches','settings','laiha_settings'];
          var sizes = {};
          for (var tbl of tables) {
            var data = await dbGet(tbl);
            if (data === null) sizes[tbl] = { count: 0, type: 'null' };
            else if (Array.isArray(data)) sizes[tbl] = { count: data.length, type: 'array' };
            else if (typeof data === 'object') sizes[tbl] = { count: Object.keys(data).length, type: 'object' };
            else sizes[tbl] = { count: 1, type: typeof data };
          }
          // Special: count tawasul tasks from twsl:idx
          try {
            var twslIdx = await dbGet('twsl:idx');
            sizes['tawasul'] = { count: Array.isArray(twslIdx) ? twslIdx.length : 0, type: 'tawasul' };
          } catch(e) { sizes['tawasul'] = { count: 0, type: 'tawasul' }; }
          return res.json({ tables: sizes });
        }
        if (req.method === 'POST') {
          // Selective cleanup
          var cleanupAction = req.body.action; // 'delete_older' | 'delete_recent' | 'delete_all' | 'keep_recent'
          var target = req.body.target;  // table name or 'all'
          var days = req.body.days || 0;
          var results = {};

          var cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          var cutoff = cutoffDate.toISOString().split('T')[0];

          var dateTables = ['attendance','violations_v2','complaints','investigations','appeals','notifications','leaves','permissions','pre_absences','tickets','gps_log'];

          async function cleanTable(tbl) {
            // Special case: tawasul tasks stored as twsl:<id> + twsl:idx
            if (tbl === 'tawasul') {
              var idx = await dbGet('twsl:idx') || [];
              var beforeT = idx.length;
              if (cleanupAction === 'delete_all') {
                for (var i = 0; i < idx.length; i++) {
                  try { await dbSet('twsl:' + idx[i], null); } catch(e) {}
                }
                await dbSet('twsl:idx', []);
                try { await dbSet('twsl:notifs', []); } catch(e) {}
                return { before: beforeT, after: 0, deleted: beforeT };
              }
              // Date-based cleanup for tasks
              var keep = [];
              var deleteIds = [];
              for (var j = 0; j < idx.length; j++) {
                var tsk = await dbGet('twsl:' + idx[j]);
                if (!tsk) { continue; }
                var dStr = (tsk.createdAt || tsk.updatedAt || '').split('T')[0];
                var shouldKeep = true;
                if (cleanupAction === 'delete_older') shouldKeep = dStr >= cutoff;
                else if (cleanupAction === 'delete_recent') shouldKeep = dStr < cutoff;
                else if (cleanupAction === 'keep_recent') shouldKeep = dStr >= cutoff;
                if (shouldKeep) keep.push(idx[j]);
                else deleteIds.push(idx[j]);
              }
              for (var k = 0; k < deleteIds.length; k++) {
                try { await dbSet('twsl:' + deleteIds[k], null); } catch(e) {}
              }
              await dbSet('twsl:idx', keep);
              return { before: beforeT, after: keep.length, deleted: deleteIds.length };
            }

            var data = await dbGet(tbl);
            if (!data) return { before: 0, after: 0 };
            var before = Array.isArray(data) ? data.length : Object.keys(data).length;

            if (cleanupAction === 'delete_all') {
              await dbSet(tbl, Array.isArray(data) ? [] : {});
              return { before: before, after: 0, deleted: before };
            }

            if (!Array.isArray(data)) return { before: before, after: before, skipped: 'not array' };

            var filtered;
            if (cleanupAction === 'delete_older') {
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d >= cutoff;
              });
            } else if (cleanupAction === 'delete_recent') {
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d < cutoff;
              });
            } else if (cleanupAction === 'keep_recent') {
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d >= cutoff;
              });
            } else {
              return { before: before, after: before, error: 'unknown action' };
            }
            await dbSet(tbl, filtered);
            return { before: before, after: filtered.length, deleted: before - filtered.length };
          }

          if (target === 'all') {
            for (var tbl of dateTables) {
              results[tbl] = await cleanTable(tbl);
            }
            results['tawasul'] = await cleanTable('tawasul');
          } else {
            results[target] = await cleanTable(target);
          }

          return res.json({ ok: true, action: cleanupAction, days: days, cutoff: cutoff, results: results });
        }
        break;
      }

      /* ═══ KADWAR NOTIFICATIONS + DATA ═══ */
      case 'kadwar_notifs': {
        var empId = req.query.empId;
        var notifs = await dbGet('kadwar_notifs') || {};
        var empNotifs = notifs[empId] || { tasks: 0, exams: 0, alerts: 0 };
        return res.json(empNotifs);
      }

      case 'kadwar_data': {
        // Employee reads their kadwar data (tasks, evaluations) from basma
        var empId = req.query.empId;
        if (!empId) return res.json({ error: 'empId required' });
        var kadwarData = await dbGet('kadwar_data') || {};
        return res.json(kadwarData[empId] || { tasks: [], evaluations: [], notifications: { tasks: 0, exams: 0, alerts: 0 } });
      }

      /* ═══ PERMISSIONS (طلب إذن) ═══ */
      case 'permissions': {
        if (req.method === 'GET') {
          var perms = await dbGet('permissions') || [];
          if (req.query.empId) perms = perms.filter(p => p.empId === req.query.empId);
          return res.json(perms);
        }
        if (req.method === 'POST') {
          var perms = await dbGet('permissions') || [];
          var newPerm = { id: 'PERM' + Date.now(), status: 'pending', ts: new Date().toISOString(), ...req.body };
          perms.push(newPerm);
          await dbSet('permissions', perms);

          // v6.37 — Notify manager + HR
          (async function(){
            try {
              var empsP = (await dbGet('employees')) || [];
              var empP = empsP.find(function(e){ return e.id === newPerm.empId; });
              var mgrId = empP && (empP.managerId || empP.supervisorId);
              var hrIdsP = empsP.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
              var tgtsP = [];
              if (mgrId) tgtsP.push(mgrId);
              hrIdsP.forEach(function(id){ if (tgtsP.indexOf(id) < 0) tgtsP.push(id); });

              var notifsP = (await dbGet('notifications')) || [];
              var nowISOP = new Date().toISOString();
              tgtsP.forEach(function(tid){
                notifsP.push({
                  id: 'n_prmreq_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  empId: tid,
                  type: 'permission_request',
                  title: '⏱ طلب استئذان',
                  message: (empP && empP.name ? empP.name : 'موظف') + ' طلب استئذان' + (newPerm.reason ? ' (' + newPerm.reason + ')' : ''),
                  permissionId: newPerm.id,
                  targetEmpId: newPerm.empId,
                  read: false,
                  createdAt: nowISOP,
                });
              });
              if (notifsP.length > 1000) notifsP = notifsP.slice(-1000);
              await dbSet('notifications', notifsP);

              if (mgrId) {
                try {
                  var pushSubsP = (await dbGet('push_subscriptions')) || {};
                  var subP = pushSubsP[mgrId];
                  if (subP && subP.subscription) {
                    await sendWebPush(subP.subscription, {
                      title: '⏱ طلب استئذان',
                      body: (empP && empP.name ? empP.name : 'موظف') + ' طلب استئذان',
                      tag: 'perm-' + newPerm.id,
                      data: { id: newPerm.id, type: 'permission_request' },
                    });
                  }
                } catch(e) {}
              }
            } catch(e) {}
          })();

          return res.json({ ok: true, permission: newPerm });
        }
        if (req.method === 'PUT') {
          var perms = await dbGet('permissions') || [];
          var idx = perms.findIndex(p => p.id === req.body.id);
          if (idx >= 0) {
            var prevStatusPerm = perms[idx].status;
            perms[idx] = { ...perms[idx], ...req.body, decidedAt: new Date().toISOString() };
            await dbSet('permissions', perms);

            // v6.37 — Notify employee on decision
            if (req.body.status && req.body.status !== prevStatusPerm) {
              (async function(){
                try {
                  var permX = perms[idx];
                  var notifsX = (await dbGet('notifications')) || [];
                  var nowX = new Date().toISOString();
                  var titleX = req.body.status === 'approved' ? '✅ تم الموافقة على الاستئذان' : '❌ تم رفض الاستئذان';
                  var msgX = req.body.status === 'approved' ? 'استئذانك تم اعتماده.' : 'استئذانك لم يُعتمد' + (req.body.rejectReason ? ' — ' + req.body.rejectReason : '.');
                  notifsX.push({
                    id: 'n_prmres_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                    empId: permX.empId,
                    type: 'permission_response',
                    title: titleX,
                    message: msgX,
                    permissionId: permX.id,
                    read: false,
                    createdAt: nowX,
                  });
                  if (notifsX.length > 1000) notifsX = notifsX.slice(-1000);
                  await dbSet('notifications', notifsX);

                  try {
                    var pushSubsX = (await dbGet('push_subscriptions')) || {};
                    var subX = pushSubsX[permX.empId];
                    if (subX && subX.subscription) {
                      await sendWebPush(subX.subscription, { title: titleX, body: msgX, tag: 'perm-resp-' + permX.id, data: { id: permX.id, type: 'permission_response' } });
                    }
                  } catch(e){}
                } catch(e){}
              })();
            }
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ HEALTH DISCLOSURE (الإفصاح الصحي) ═══ */
      case 'health_disclosure': {
        if (req.method === 'GET') {
          var hd = await dbGet('health_disclosures') || [];
          if (req.query.empId) hd = hd.filter(h => h.empId === req.query.empId);
          return res.json(hd);
        }
        if (req.method === 'POST') {
          var hd = await dbGet('health_disclosures') || [];
          var existing = hd.findIndex(h => h.empId === req.body.empId);
          var record = { ...req.body, status: 'pending', updatedAt: new Date().toISOString() };
          if (existing >= 0) { hd[existing] = { ...hd[existing], ...record }; } else { hd.push(record); }
          await dbSet('health_disclosures', hd);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ ATTACHMENTS (المرفقات) ═══ */
      case 'attachments': {
        if (req.method === 'GET') {
          var docs = await dbGet('attachments') || [];
          if (req.query.empId) docs = docs.filter(d => d.empId === req.query.empId);
          return res.json(docs);
        }
        if (req.method === 'POST') {
          var docs = await dbGet('attachments') || [];
          var fileData = req.body.data; // base64
          delete req.body.data; // don't store base64 in main DB
          var newDoc = { id: 'ATT' + Date.now(), status: 'pending', ts: new Date().toISOString(), ...req.body };
          // Store file separately in blob
          if (fileData) {
            try { await put(PFX + 'files/' + newDoc.id, fileData, { access: 'public', contentType: 'text/plain', addRandomSuffix: false }); newDoc.hasFile = true; } catch(e) { /**/ }
          }
          docs.push(newDoc);
          await dbSet('attachments', docs);
          return res.json({ ok: true, doc: newDoc });
        }
        if (req.method === 'PUT') {
          var docs = await dbGet('attachments') || [];
          var idx = docs.findIndex(d => d.id === req.body.id);
          if (idx >= 0) { docs[idx] = { ...docs[idx], ...req.body }; await dbSet('attachments', docs); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var docs = await dbGet('attachments') || [];
          docs = docs.filter(d => d.id !== req.query.id);
          await dbSet('attachments', docs);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ ATTACHMENT TYPES (أنواع المرفقات — يديرها الأدمن) ═══ */
      case 'attachment_types': {
        if (req.method === 'GET') {
          var types = await dbGet('attachment_types');
          if (!types) types = ["بطاقة هوية", "جواز سفر", "رخصة قيادة", "عقد عمل", "IBAN بنكي", "أخرى"];
          return res.json(types);
        }
        if (req.method === 'POST') {
          await dbSet('attachment_types', req.body.types || []);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ LAIHA SETTINGS (إعدادات لائحة المخالفات — يديرها المدير العام) ═══ */
      case 'laiha_settings': {
        if (req.method === 'GET') {
          // Returns admin overrides: { "WH-01": { enabled: true, autoApply: false, customPenalties: {...} } }
          var settings = await dbGet('laiha_settings') || {};
          return res.json(settings);
        }
        if (req.method === 'POST') {
          // Update single item: { id, enabled, autoApply, customDescription, customPenalties }
          var settings = await dbGet('laiha_settings') || {};
          settings[req.body.id] = {
            enabled: req.body.enabled !== undefined ? req.body.enabled : true,
            autoApply: req.body.autoApply !== undefined ? req.body.autoApply : false,
            customDescription: req.body.customDescription || null,
            customPenalties: req.body.customPenalties || null,
            updatedAt: new Date().toISOString(),
            updatedBy: req.body.updatedBy || 'admin',
          };
          await dbSet('laiha_settings', settings);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          // Reset specific item to default
          var settings = await dbGet('laiha_settings') || {};
          delete settings[req.query.id];
          await dbSet('laiha_settings', settings);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ COMPLAINTS (الشكاوى الرسمية) ═══ */
      case 'complaints': {
        if (req.method === 'GET') {
          var complaints = await dbGet('complaints') || [];
          if (req.query.filedBy) complaints = complaints.filter(c => c.filedBy === req.query.filedBy);
          if (req.query.against) complaints = complaints.filter(c => c.against === req.query.against);
          if (req.query.status) complaints = complaints.filter(c => c.status === req.query.status);
          if (req.query.id) complaints = complaints.filter(c => c.id === req.query.id);
          return res.json(complaints);
        }
        if (req.method === 'POST') {
          var complaints = await dbGet('complaints') || [];
          var newComplaint = {
            id: 'CMP' + Date.now(),
            status: 'PENDING_HR',
            createdAt: new Date().toISOString(),
            filedBy: req.body.filedBy,       // ID الشاكي
            filedByName: req.body.filedByName,
            against: req.body.against,        // ID المشكو عليه
            againstName: req.body.againstName,
            violationId: req.body.violationId, // من اللائحة
            chapter: req.body.chapter,         // الفصل
            title: req.body.title,
            details: req.body.details,
            evidence: req.body.evidence || [], // مرفقات
            hrNotes: null,
            hrDecision: null,                  // rejected | investigate | convert
            decidedAt: null,
            decidedBy: null,
            investigationId: null,
            violationCreatedId: null,
          };
          complaints.push(newComplaint);
          await dbSet('complaints', complaints);
          return res.json({ ok: true, complaint: newComplaint });
        }
        if (req.method === 'PUT') {
          // HR decision or status update
          var complaints = await dbGet('complaints') || [];
          var idx = complaints.findIndex(c => c.id === req.body.id);
          if (idx >= 0) {
            complaints[idx] = { ...complaints[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('complaints', complaints);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ INVESTIGATIONS (التحقيقات) ═══ */
      case 'investigations': {
        if (req.method === 'GET') {
          var investigations = await dbGet('investigations') || [];
          if (req.query.empId) investigations = investigations.filter(i => i.empId === req.query.empId);
          if (req.query.complaintId) investigations = investigations.filter(i => i.complaintId === req.query.complaintId);
          if (req.query.status) investigations = investigations.filter(i => i.status === req.query.status);
          if (req.query.id) investigations = investigations.filter(i => i.id === req.query.id);
          return res.json(investigations);
        }
        if (req.method === 'POST') {
          var investigations = await dbGet('investigations') || [];
          var newInv = {
            id: 'INV' + Date.now(),
            complaintId: req.body.complaintId,
            empId: req.body.empId,
            empName: req.body.empName,
            violationId: req.body.violationId,
            chapter: req.body.chapter,
            title: req.body.title,
            description: req.body.description,
            questions: req.body.questions || [], // الأسئلة الموجهة للموظف
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy,
            deadline: req.body.deadline,          // 24 ساعة من الإنشاء
            status: 'WAITING_RESPONSE',
            empResponse: null,                     // نص الرد
            empResponseAttachments: [],            // مرفقات الرد
            empResponseAt: null,
            hrDecision: null,                      // convert_to_violation | close_innocent
            hrDecisionNotes: null,
            hrDecidedAt: null,
            hrDecidedBy: null,
          };
          investigations.push(newInv);
          await dbSet('investigations', investigations);
          // Link to complaint
          if (req.body.complaintId) {
            var complaints = await dbGet('complaints') || [];
            var cIdx = complaints.findIndex(c => c.id === req.body.complaintId);
            if (cIdx >= 0) {
              complaints[cIdx].status = 'UNDER_INVESTIGATION';
              complaints[cIdx].investigationId = newInv.id;
              await dbSet('complaints', complaints);
            }
          }
          // Auto-notify employee about investigation
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: newInv.empId,
              type: 'investigation',
              title: '🔍 استمارة تحقيق',
              body: 'فُتح تحقيق بخصوص: ' + (newInv.title || '').slice(0, 60) + ' — يجب الرد خلال 24 ساعة',
              refId: newInv.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          return res.json({ ok: true, investigation: newInv });
        }
        if (req.method === 'PUT') {
          var investigations = await dbGet('investigations') || [];
          var idx = investigations.findIndex(i => i.id === req.body.id);
          if (idx >= 0) {
            investigations[idx] = { ...investigations[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('investigations', investigations);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ VIOLATIONS V2 (المخالفات الرسمية) — الجدول الجديد ═══ */
      case 'violations_v2': {
        if (req.method === 'GET') {
          var vios = await dbGet('violations_v2') || [];
          if (req.query.empId) vios = vios.filter(v => v.empId === req.query.empId);
          if (req.query.status) vios = vios.filter(v => v.status === req.query.status);
          return res.json(vios);
        }
        if (req.method === 'POST') {
          var vios = await dbGet('violations_v2') || [];
          // Count previous same-violation for this employee (within 180 days)
          var now = new Date();
          var oneEightyAgo = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
          var sameViolationCount = vios.filter(v =>
            v.empId === req.body.empId &&
            v.violationId === req.body.violationId &&
            v.status === 'ACTIVE' &&
            new Date(v.createdAt) > oneEightyAgo
          ).length;
          var occurrence = sameViolationCount + 1; // 1=first, 2=second, 3=third, 4=fourth
          var penaltyKey = occurrence === 1 ? 'first' : occurrence === 2 ? 'second' : occurrence === 3 ? 'third' : 'fourth';
          var newVio = {
            id: 'VIO' + Date.now(),
            empId: req.body.empId,
            empName: req.body.empName,
            violationId: req.body.violationId,
            chapter: req.body.chapter,
            description: req.body.description,
            occurrence: occurrence,
            penaltyCode: req.body.penaltyCode || (req.body.penalties && req.body.penalties[penaltyKey]),
            penaltyLabel: req.body.penaltyLabel,
            complaintId: req.body.complaintId || null,
            investigationId: req.body.investigationId || null,
            source: req.body.source || 'manual', // auto | manual | from_investigation
            legalRef: req.body.legalRef || 'اللائحة التنفيذية لنظام العمل السعودي - رقم الاعتماد 978004',
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy,
            approvedBy: req.body.approvedBy || null,
            status: 'ACTIVE',
            appealedAt: null,
            appealResponse: null,
            notes: req.body.notes || null,
          };
          vios.push(newVio);
          await dbSet('violations_v2', vios);
          // Auto-notify employee
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: newVio.empId,
              type: 'violation',
              title: '⚖️ مخالفة جديدة',
              body: 'صدرت مخالفة بحقك: ' + (newVio.description || '').slice(0, 80) + ' — الجزاء: ' + (newVio.penaltyLabel || ''),
              refId: newVio.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          return res.json({ ok: true, violation: newVio });
        }
        if (req.method === 'PUT') {
          var vios = await dbGet('violations_v2') || [];
          var idx = vios.findIndex(v => v.id === req.body.id);
          if (idx >= 0) {
            vios[idx] = { ...vios[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('violations_v2', vios);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ APPEALS (التظلمات) ═══ */
      case 'appeals': {
        if (req.method === 'GET') {
          var appeals = await dbGet('appeals') || [];
          if (req.query.empId) appeals = appeals.filter(a => a.empId === req.query.empId);
          if (req.query.violationId) appeals = appeals.filter(a => a.violationId === req.query.violationId);
          return res.json(appeals);
        }
        if (req.method === 'POST') {
          var appeals = await dbGet('appeals') || [];
          var newAppeal = {
            id: 'APL' + Date.now(),
            violationId: req.body.violationId,
            empId: req.body.empId,
            empName: req.body.empName,
            reason: req.body.reason,
            attachments: req.body.attachments || [],
            createdAt: new Date().toISOString(),
            deadline: new Date(new Date().getTime() + 5 * 24 * 3600 * 1000).toISOString(),
            status: 'PENDING',
            decision: null,
            decisionNotes: null,
            decidedAt: null,
            decidedBy: null,
          };
          appeals.push(newAppeal);
          // Link to violation
          var vios = await dbGet('violations_v2') || [];
          var vIdx = vios.findIndex(v => v.id === req.body.violationId);
          if (vIdx >= 0) {
            vios[vIdx].status = 'APPEALED';
            vios[vIdx].appealedAt = new Date().toISOString();
            await dbSet('violations_v2', vios);
          }
          await dbSet('appeals', appeals);
          return res.json({ ok: true, appeal: newAppeal });
        }
        if (req.method === 'PUT') {
          var appeals = await dbGet('appeals') || [];
          var idx = appeals.findIndex(a => a.id === req.body.id);
          if (idx >= 0) {
            appeals[idx] = { ...appeals[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('appeals', appeals);
          }
          return res.json({ ok: true });
        }
        break;
      }


      /* ═══ AUTO VIOLATIONS TRIGGER (safety-net, called by client) ═══ */
      case 'auto_violations_check': {
        // Client-triggered safety-net. Runs once per day after 6pm Saudi time.
        var nowCheck = new Date();
        var saudiHourCheck = (nowCheck.getUTCHours() + 3) % 24;
        if (saudiHourCheck < 18) return res.json({ ok: false, reason: 'too_early', saudiHour: saudiHourCheck });
        var lastRun = await dbGet('auto_violations_last_run');
        var todayStrChk = nowCheck.toISOString().split('T')[0];
        if (lastRun === todayStrChk) return res.json({ ok: false, reason: 'already_ran', lastRun: lastRun });
        // Mark as running first (to avoid races)
        await dbSet('auto_violations_last_run', todayStrChk);
        // Internally call auto_violations by forwarding through fetch to self
        try {
          var baseUrl = req.headers.host ? ('https://' + req.headers.host) : 'http://localhost:3000';
          var selfR = await fetch(baseUrl + '/api/data?action=auto_violations');
          var selfD = await selfR.json();
          return res.json({ ok: true, triggered: true, result: selfD });
        } catch (e) {
          return res.status(500).json({ error: 'self-call failed: ' + (e.message || 'unknown') });
        }
      }

      case 'auto_violations': {
        // Called by cron daily 6pm — checks today's attendance and generates violations per laiha
        var emps = await dbGet('employees') || [];
        var att = await dbGet('attendance') || [];
        var violationsV2 = await dbGet('violations_v2') || [];
        var preAbs = await dbGet('pre_absences') || [];
        var branches = await dbGet('branches') || [];
        var laihaSettings = await dbGet('laiha_settings') || {};
        var today = new Date().toISOString().split('T')[0];
        var todayAtt = att.filter(a => a.date === today);
        var todayPreAbs = preAbs.filter(p => p.date === today);
        var generated = [];

        // Penalties lookup (mirrors laiha.js PENALTY_TYPES)
        var penaltyLabels = {
          WARNING: 'إنذار كتابي', FINE_5: 'خصم 5%', FINE_10: 'خصم 10%', FINE_15: 'خصم 15%',
          FINE_20: 'خصم 20%', FINE_25: 'خصم 25%', FINE_30: 'خصم 30%', FINE_50: 'خصم 50%',
          FINE_75: 'خصم 75%', FINE_1DAY: 'خصم يوم', FINE_2DAYS: 'خصم يومين',
          FINE_3DAYS: 'خصم 3 أيام', FINE_4DAYS: 'خصم 4 أيام', FINE_5DAYS: 'خصم 5 أيام',
          DENY_PROMOTION: 'حرمان من الترقية/العلاوة',
          TERMINATION_WITH: 'فصل مع المكافأة', TERMINATION_WITHOUT: 'فصل دون مكافأة (م.80)',
        };

        // Laiha rules (auto-detectable only)
        var laihaRules = [
          { id: 'WH-01', maxLate: 15, penalties: { first: 'WARNING', second: 'FINE_5', third: 'FINE_10', fourth: 'FINE_20' }, desc: 'التأخر لغاية 15 دقيقة دون إذن' },
          { id: 'WH-03', minLate: 16, maxLate: 30, penalties: { first: 'FINE_10', second: 'FINE_15', third: 'FINE_25', fourth: 'FINE_50' }, desc: 'التأخر أكثر من 15 وحتى 30 دقيقة دون إذن' },
          { id: 'WH-05', minLate: 31, maxLate: 60, penalties: { first: 'FINE_25', second: 'FINE_50', third: 'FINE_75', fourth: 'FINE_1DAY' }, desc: 'التأخر أكثر من 30 وحتى 60 دقيقة دون إذن' },
          { id: 'WH-07', minLate: 61, penalties: { first: 'WARNING', second: 'FINE_1DAY', third: 'FINE_2DAYS', fourth: 'FINE_3DAYS' }, desc: 'التأخر لمدة تزيد على ساعة دون إذن' },
          { id: 'WH-11', absentDays: 1, penalties: { first: 'FINE_2DAYS', second: 'FINE_3DAYS', third: 'FINE_4DAYS', fourth: 'DENY_PROMOTION' }, desc: 'الغياب يوم دون إذن كتابي' },
        ];

        emps.forEach(function(emp) {
          if (emp.terminated || emp.onLeave) return;
          if (todayPreAbs.some(p => p.empId === emp.id)) return;

          var branch = branches.find(b => b.id === emp.branch || b.name === emp.branch);
          if (!branch) return;

          var empAtt = todayAtt.filter(a => a.empId === emp.id);
          var checkin = empAtt.find(a => a.type === 'checkin');
          var nowH = new Date().getHours();

          function applyRule(rule, extraDesc) {
            // Check admin settings — is this rule enabled?
            var setting = laihaSettings[rule.id];
            var enabled = setting && setting.enabled !== undefined ? setting.enabled : true;
            var autoApply = setting && setting.autoApply !== undefined ? setting.autoApply : (rule.id.startsWith('WH-0')); // defaults per laiha.js
            if (!enabled) return;

            // Count previous occurrences of same violation in 180 days (per المادة 44)
            var d180 = new Date(); d180.setDate(d180.getDate() - 180);
            var prevCount = violationsV2.filter(v =>
              v.empId === emp.id && v.violationId === rule.id &&
              v.status === 'ACTIVE' && new Date(v.createdAt) > d180
            ).length;
            var occurrence = Math.min(prevCount + 1, 4);
            var penaltyKey = ['first','second','third','fourth'][occurrence - 1];
            var penaltyCode = rule.penalties[penaltyKey];
            if (!penaltyCode) return;

            var chapter = rule.id.startsWith('WH') ? 'مواعيد العمل' : rule.id.startsWith('WO') ? 'تنظيم العمل' : 'سلوك العامل';
            var newVio = {
              id: 'VIO' + Date.now() + emp.id,
              empId: emp.id,
              empName: emp.name,
              violationId: rule.id,
              chapter: chapter,
              description: rule.desc + (extraDesc ? ' — ' + extraDesc : ''),
              occurrence: occurrence,
              penaltyCode: penaltyCode,
              penaltyLabel: penaltyLabels[penaltyCode] || penaltyCode,
              source: 'auto',
              legalRef: 'لائحة تنظيم العمل المعتمدة رقم 978004 — الفصل الثامن عشر، جدول المخالفات، البند ' + rule.id,
              createdAt: new Date().toISOString(),
              createdBy: 'system_cron',
              status: autoApply ? 'ACTIVE' : 'PENDING_APPROVAL',
              autoGenerated: true,
            };
            violationsV2.push(newVio);
            generated.push({ empId: emp.id, name: emp.name, rule: rule.id, occurrence: occurrence, penalty: newVio.penaltyLabel, needsApproval: !autoApply });
          }

          // Check absence — account for Saudi Arabia timezone (UTC+3)
          // Server runs in UTC; 6pm Saudi = 15:00 UTC
          var nowUTC = new Date();
          var saudiHour = (nowUTC.getUTCHours() + 3) % 24;
          if (!checkin && saudiHour >= 18) {
            var absRule = laihaRules.find(r => r.absentDays === 1);
            if (absRule) applyRule(absRule, today);
          }

          // Check late arrival
          if (checkin && branch.start) {
            var checkinTime = new Date(checkin.ts);
            var startParts = branch.start.split(':');
            var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            var lateMinutes = checkinMin - startMin;
            if (lateMinutes > 0) {
              var lateRule = laihaRules.find(r => {
                var min = r.minLate !== undefined ? r.minLate : 1;
                var max = r.maxLate !== undefined ? r.maxLate : Infinity;
                return lateMinutes >= min && lateMinutes <= max && !r.absentDays;
              });
              if (lateRule) applyRule(lateRule, 'تأخر ' + lateMinutes + ' دقيقة');
            }
          }
        });

        await dbSet('violations_v2', violationsV2);
        // Auto-notify employees about their violations
        if (generated.length > 0) {
          try {
            var notifs = await dbGet('notifications') || [];
            generated.forEach(function(g) {
              notifs.push({
                id: 'NTF' + Date.now() + g.empId,
                empId: g.empId,
                type: 'violation',
                title: g.needsApproval ? '📋 مخالفة بانتظار الاعتماد' : '⚖️ مخالفة جديدة',
                body: 'البند ' + g.rule + ' — المرة ' + g.occurrence + ' — الجزاء: ' + g.penalty,
                read: false,
                createdAt: new Date().toISOString(),
              });
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
        }
        return res.json({ ok: true, generated: generated, count: generated.length, ranAt: new Date().toISOString() });
      }

      /* ═══ NOTIFICATIONS (إشعارات الموظفين) ═══ */
      case 'notifications': {
        if (req.method === 'GET') {
          var notifs = await dbGet('notifications') || [];
          if (req.query.empId) notifs = notifs.filter(n => n.empId === req.query.empId);
          if (req.query.unread === '1') notifs = notifs.filter(n => !n.read);
          return res.json(notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50));
        }
        if (req.method === 'POST') {
          var notifs = await dbGet('notifications') || [];
          var newNotif = {
            id: 'NTF' + Date.now(),
            empId: req.body.empId,
            type: req.body.type, // violation | investigation | appeal_result | complaint_update
            title: req.body.title,
            body: req.body.body,
            refId: req.body.refId || null, // ID of related entity
            read: false,
            createdAt: new Date().toISOString(),
          };
          notifs.push(newNotif);
          // Keep only last 200 per employee
          var empNotifs = notifs.filter(n => n.empId === req.body.empId);
          if (empNotifs.length > 200) {
            var keep = new Set(empNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200).map(n => n.id));
            notifs = notifs.filter(n => n.empId !== req.body.empId || keep.has(n.id));
          }
          await dbSet('notifications', notifs);
          return res.json({ ok: true, notification: newNotif });
        }
        if (req.method === 'PUT') {
          // Mark as read
          var notifs = await dbGet('notifications') || [];
          if (req.body.markAllRead && req.body.empId) {
            notifs = notifs.map(n => n.empId === req.body.empId ? { ...n, read: true } : n);
          } else if (req.body.id) {
            var idx = notifs.findIndex(n => n.id === req.body.id);
            if (idx >= 0) notifs[idx].read = true;
          }
          await dbSet('notifications', notifs);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ EXPORT INSURANCE (تصدير بيانات التأمين) ═══ */
      case 'export_insurance': {
        var emps = await dbGet('employees') || [];
        var deps = await dbGet('dependents') || [];
        var hd = await dbGet('health_disclosures') || [];
        var rows = ['رقم الموظف,الاسم,المرافق,القرابة,الميلاد,الهوية,تأمين خارجي,شركة التأمين,إفصاح صحي'];
        emps.forEach(function(emp) {
          // Employee row
          var empHd = hd.find(h => h.empId === emp.id);
          rows.push([emp.id, emp.name, '—', 'موظف', emp.dob || '', emp.idNumber || '', emp.externalInsurance ? 'نعم' : 'لا', emp.insurerName || '', empHd ? 'مقدّم' : 'لم يُقدّم'].join(','));
          // Dependents rows
          var empDeps = deps.filter(d => d.empId === emp.id && d.status === 'approved');
          empDeps.forEach(function(dep) {
            rows.push([emp.id, emp.name, dep.name, dep.relation, dep.dob || '', dep.idNumber || '', dep.externalInsurance ? 'نعم' : 'لا', dep.insurerName || '', '—'].join(','));
          });
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send('\uFEFF' + rows.join('\n'));
      }

      case 'diagnostic': {
        // Test database read/write
        var results = { token: !!process.env.BLOB_READ_WRITE_TOKEN, tokenPrefix: (process.env.BLOB_READ_WRITE_TOKEN || '').substring(0, 10) + '...', tests: {} };
        try {
          // Test write
          await put(PFX + 'test_diag.json', JSON.stringify({ test: true, ts: new Date().toISOString() }), { access: 'public', contentType: 'application/json' });
          results.tests.write = 'OK';
        } catch(e) { results.tests.write = 'FAIL: ' + e.message; }
        try {
          // Test read
          var { blobs } = await list({ prefix: PFX + 'test_diag.json' });
          results.tests.read = blobs.length > 0 ? 'OK (' + blobs.length + ' blobs)' : 'FAIL: no blobs found';
          // List all basma blobs
          var allBlobs = await list({ prefix: PFX });
          results.tests.totalBlobs = allBlobs.blobs.length;
          results.tests.blobNames = allBlobs.blobs.map(b => b.pathname);
          // Cleanup test
          for (var b of blobs) await del(b.url);
          results.tests.delete = 'OK';
        } catch(e) { results.tests.read = 'FAIL: ' + e.message; }
        // Test existing data
        try {
          var emps = await dbGet('employees');
          results.tests.employees = emps ? (Array.isArray(emps) ? emps.length + ' employees' : typeof emps) : 'NULL';
        } catch(e) { results.tests.employees = 'FAIL: ' + e.message; }
        try {
          var settings = await dbGet('settings');
          results.tests.settings = settings ? 'exists' : 'NULL';
        } catch(e) { results.tests.settings = 'FAIL: ' + e.message; }
        try {
          var reqs = await dbGet('admin_requests');
          results.tests.requests = reqs ? (Array.isArray(reqs) ? reqs.length + ' requests' : typeof reqs) : 'NULL (empty)';
        } catch(e) { results.tests.requests = 'FAIL: ' + e.message; }
        return res.json(results);
      }

      /* ═══ ORG HIERARCHY — مَن يدير مَن (managerId لكل موظف) ═══
         GET:  { ok, hierarchy: { <empId>: <managerId> }, employees: [...] }
         POST: { assignments: { <empId>: <managerId> } } — batch update
         Stored in Redis key 'org_hierarchy' as { <empId>: <managerId> } */
      case 'org_hierarchy': {
        try {
          if (req.method === 'POST') {
            var body = req.body || {};
            if (body.assignments) {
              // Batch update
              var h = (await dbGet('org_hierarchy')) || {};
              Object.keys(body.assignments).forEach(function(empId){
                var mgrId = body.assignments[empId];
                if (mgrId === null || mgrId === '' || mgrId === undefined) {
                  delete h[empId];
                } else {
                  h[empId] = String(mgrId);
                }
              });
              await dbSet('org_hierarchy', h);
              return res.json({ ok: true, hierarchy: h, updated: Object.keys(body.assignments).length });
            }
            // Single assignment
            if (body.empId) {
              var h2 = (await dbGet('org_hierarchy')) || {};
              if (body.managerId === null || body.managerId === '' || body.managerId === undefined) {
                delete h2[body.empId];
              } else {
                h2[body.empId] = String(body.managerId);
              }
              await dbSet('org_hierarchy', h2);
              return res.json({ ok: true, hierarchy: h2 });
            }
            return res.status(400).json({ error: 'assignments or empId required' });
          }
          // GET: return full hierarchy + list of employees with enriched managerId
          var hh = (await dbGet('org_hierarchy')) || {};
          var emps = (await dbGet('employees')) || [];
          var enriched = emps.map(function(e){
            var eid = String(e.id || e.username || '');
            return {
              id: e.id,
              username: e.username,
              name: e.name,
              department: e.department,
              role: e.role,
              isAdmin: !!e.isAdmin,
              isManager: !!e.isManager,
              managerId: hh[eid] || null,
            };
          });
          return res.json({ ok: true, hierarchy: hh, employees: enriched });
        } catch(e) {
          return res.status(500).json({ error: 'org_hierarchy: ' + (e.message || 'unknown') });
        }
      }

      case 'seed_questions': {
        // One-time seed: populates settings.questions with the default bank
        // for the admin to cherry-pick from. Does NOT overwrite existing questions.
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var DEFAULT_BANK = [
          // ذكر
          { type: "ذكر", q: "أكمل: سبحان الله وبحمده ...", correct: "سبحان الله العظيم", wrong1: "الحمد لله رب العالمين", wrong2: "لا إله إلا الله" },
          { type: "ذكر", q: "دعاء الصباح: اللهم بك أصبحنا وبك ...", correct: "أمسينا", wrong1: "حيينا", wrong2: "توكلنا" },
          { type: "ذكر", q: "أكمل الحديث: إنما الأعمال ...", correct: "بالنيات", wrong1: "بالخواتيم", wrong2: "بالإخلاص" },
          // هندسي
          { type: "هندسي", q: "ما وحدة قياس قوة الخرسانة؟", correct: "ميجا باسكال", wrong1: "نيوتن", wrong2: "كيلو جرام" },
          { type: "هندسي", q: "ما هو الحد الأدنى لغطاء الخرسانة للأعمدة؟", correct: "40 مم", wrong1: "25 مم", wrong2: "75 مم" },
          { type: "هندسي", q: "كم يوم يلزم لمعالجة الخرسانة بالماء؟", correct: "7 أيام", wrong1: "3 أيام", wrong2: "14 يوم" },
          { type: "هندسي", q: "ما هي نسبة الماء إلى الأسمنت المثالية؟", correct: "0.45", wrong1: "0.30", wrong2: "0.60" },
          { type: "هندسي", q: "ما أول شي يُراجع عند استلام موقع جديد؟", correct: "المخططات", wrong1: "الميزانية", wrong2: "المعدات" },
          { type: "هندسي", q: "ما الفرق بين الإسمنت البورتلاندي العادي والمقاوم؟", correct: "مقاومة الكبريتات", wrong1: "اللون", wrong2: "السعر" },
          { type: "هندسي", q: "ما الحد الأقصى لـ slump الخرسانة العادية؟", correct: "100 مم", wrong1: "50 مم", wrong2: "150 مم" },
          { type: "هندسي", q: "ما المسافة بين أعمدة القالب (الشدّة) عادة؟", correct: "100 سم", wrong1: "50 سم", wrong2: "200 سم" },
          { type: "هندسي", q: "كم يوم قبل فك شدّة البلاطة؟", correct: "21 يوم", wrong1: "3 أيام", wrong2: "7 أيام" },
          // نظام العمل
          { type: "سؤال", q: "كم يوم مدة التظلم من جزاء تأديبي؟", correct: "3 أيام عمل", wrong1: "يوم واحد", wrong2: "7 أيام" },
          { type: "سؤال", q: "بعد كم يوم غياب متصل يُفسخ العقد (م.80)؟", correct: "15 يوم", wrong1: "10 أيام", wrong2: "30 يوم" },
          { type: "سؤال", q: "كم يوم الإجازة السنوية لمن خدم أقل من 5 سنوات؟", correct: "21 يوم", wrong1: "15 يوم", wrong2: "30 يوم" },
          { type: "سؤال", q: "بعد كم يوم من المخالفة لا يُعتبر عائداً (م.44)؟", correct: "180 يوم", wrong1: "90 يوم", wrong2: "365 يوم" },
          { type: "سؤال", q: "كم ساعة عمل يومياً في رمضان للمسلمين؟", correct: "6 ساعات", wrong1: "5 ساعات", wrong2: "7 ساعات" },
          // سلامة
          { type: "معلومة", q: "ما أول إجراء عند اكتشاف حريق في الموقع؟", correct: "إنذار الجميع والإخلاء", wrong1: "إطفاء الحريق", wrong2: "الاتصال بالشرطة" },
          { type: "معلومة", q: "ما لون خوذة السلامة للمهندس عادة؟", correct: "أبيض", wrong1: "أصفر", wrong2: "أحمر" },
          { type: "معلومة", q: "كم المسافة الآمنة من حافة الحفريات؟", correct: "2 متر", wrong1: "0.5 متر", wrong2: "1 متر" },
          // ألغاز
          { type: "لغز", q: "ما الشيء الذي يمشي بلا أرجل؟", correct: "الوقت", wrong1: "الماء", wrong2: "الهواء" },
          { type: "لغز", q: "ما الطعم الذي لا تستطيع الطيور تذوقه؟", correct: "الحار", wrong1: "المالح", wrong2: "الحلو" },
          // عام
          { type: "سؤال", q: "كم عدد أركان الإسلام؟", correct: "خمسة", wrong1: "ثلاثة", wrong2: "سبعة" },
          { type: "سؤال", q: "كم ركعة صلاة التراويح؟", correct: "8 أو 20", wrong1: "12", wrong2: "6" },
          { type: "سؤال", q: "ما عاصمة المملكة العربية السعودية؟", correct: "الرياض", wrong1: "جدة", wrong2: "مكة" },
          { type: "سؤال", q: "في أي سنة تأسست المملكة؟", correct: "1932", wrong1: "1902", wrong2: "1945" },
          { type: "سؤال", q: "كم عدد مناطق المملكة الإدارية؟", correct: "13", wrong1: "10", wrong2: "15" },
          { type: "سؤال", q: "ما هي رؤية المملكة؟", correct: "رؤية 2030", wrong1: "رؤية 2025", wrong2: "رؤية 2035" },
          { type: "معلومة", q: "كم عدد العظام في جسم الإنسان البالغ؟", correct: "206", wrong1: "176", wrong2: "256" },
          { type: "معلومة", q: "ما أقوى عضلة في جسم الإنسان؟", correct: "الفك", wrong1: "القلب", wrong2: "اللسان" },
        ];
        try {
          var settingsCur = await dbGet('settings') || {};
          var mode = (req.body && req.body.mode) || 'append'; // 'append' | 'replace'
          var existing = Array.isArray(settingsCur.questions) ? settingsCur.questions : [];
          var nowTs = Date.now();
          var seeded = DEFAULT_BANK.map(function(q, i){ return Object.assign({ id: nowTs + i }, q); });
          var merged;
          if (mode === 'replace' || existing.length === 0) {
            merged = seeded;
          } else {
            // Append, avoiding duplicates by question text
            var existingTexts = new Set(existing.map(function(q){ return (q.q || '').trim(); }));
            var toAdd = seeded.filter(function(q){ return !existingTexts.has((q.q || '').trim()); });
            merged = existing.concat(toAdd);
          }
          settingsCur.questions = merged;
          await dbSet('settings', settingsCur);
          return res.json({ ok: true, total: merged.length, added: merged.length - existing.length, mode: mode });
        } catch (e) {
          return res.status(500).json({ error: 'seed_questions: ' + (e.message || 'unknown') });
        }
      }

      case 'system_check': {
        // Comprehensive system health check — runs 20+ tests across storage, data, integrations
        var report = {
          ts: new Date().toISOString(),
          overall: 'ok',
          sections: {},
        };

        async function safeTime(fn) {
          var t0 = Date.now();
          try { var v = await fn(); return { ok: true, ms: Date.now() - t0, value: v }; }
          catch(e) { return { ok: false, ms: Date.now() - t0, error: (e.message || String(e)).substring(0, 200) }; }
        }

        // ══════════ STORAGE LAYER ══════════
        var storage = {};
        // Redis
        storage.redis_configured = { ok: USE_REDIS, value: USE_REDIS ? 'Upstash URL + token present' : 'missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN' };
        if (USE_REDIS) {
          storage.redis_write = await safeTime(async function(){
            await redisSet('__health_check', { ts: new Date().toISOString() });
            return 'wrote';
          });
          storage.redis_read = await safeTime(async function(){
            var v = await redisGet('__health_check');
            return v && v.ts ? 'read back OK' : 'read failed';
          });
          storage.redis_delete = await safeTime(async function(){
            await redisRequest('DEL', PFX_REDIS + '__health_check');
            return 'deleted';
          });
        }
        // R2
        storage.r2_configured = { ok: USE_R2, value: USE_R2 ? 'R2 credentials present' : 'missing R2_ACCOUNT_ID/KEY/SECRET' };
        storage.r2_public_url = { ok: !!R2_PUBLIC_URL, value: R2_PUBLIC_URL || 'R2_PUBLIC_URL not set' };
        // Blob (legacy)
        storage.blob_configured = { ok: !!process.env.BLOB_READ_WRITE_TOKEN, value: process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB token present (fallback)' : 'no blob fallback' };
        report.sections.storage = storage;

        // ══════════ DATA INTEGRITY ══════════
        var dataChecks = {};
        var tables = [
          { key: 'employees', label: 'الموظفين' },
          { key: 'branches', label: 'الفروع' },
          { key: 'attendance', label: 'سجل الحضور' },
          { key: 'violations_v2', label: 'المخالفات' },
          { key: 'complaints', label: 'الشكاوى' },
          { key: 'investigations', label: 'التحقيقات' },
          { key: 'appeals', label: 'التظلمات' },
          { key: 'leaves', label: 'الإجازات' },
          { key: 'notifications', label: 'الإشعارات' },
          { key: 'announcements', label: 'التعاميم' },
          { key: 'banners', label: 'البنرات' },
          { key: 'events', label: 'المناسبات' },
          { key: 'faces', label: 'بصمات الوجه' },
          { key: 'custody', label: 'العهد' },
          { key: 'settings', label: 'الإعدادات' },
          { key: 'work_types', label: 'أنواع الدوام' },
          { key: 'laiha_settings', label: 'إعدادات اللائحة' },
        ];
        for (var tbl of tables) {
          var r = await safeTime(async function(){
            var data = await dbGet(tbl.key);
            if (data === null || data === undefined) return { type: 'empty', count: 0 };
            if (Array.isArray(data)) return { type: 'array', count: data.length };
            if (typeof data === 'object') return { type: 'object', count: Object.keys(data).length };
            return { type: typeof data, count: 1 };
          });
          dataChecks[tbl.key] = { label: tbl.label, ok: r.ok, ms: r.ms, value: r.value, error: r.error };
        }
        // Tawasul
        var twslR = await safeTime(async function(){
          var idx = await dbGet('twsl:idx');
          return { type: 'array', count: Array.isArray(idx) ? idx.length : 0 };
        });
        dataChecks['tawasul'] = { label: 'مهام التواصل', ok: twslR.ok, ms: twslR.ms, value: twslR.value, error: twslR.error };
        report.sections.data = dataChecks;

        // ══════════ CONFIGURATION ══════════
        var config = {};
        var settings = await dbGet('settings') || {};
        config.has_admin_email = { ok: !!(settings.adminEmail || settings.admin_email), value: settings.adminEmail || settings.admin_email || 'not set' };
        config.has_custom_questions = { ok: Array.isArray(settings.questions) && settings.questions.length > 0, value: Array.isArray(settings.questions) ? settings.questions.length + ' أسئلة' : 'none (uses defaults)' };
        config.email_lists = { ok: !!settings.emailLists, value: settings.emailLists ? Object.keys(settings.emailLists).length + ' lists' : 'none' };
        config.observed_employees = { ok: true, value: Array.isArray(settings.observed) ? settings.observed.length + ' موظف تحت الملاحظة' : '0' };
        // Laiha
        var laiha = await dbGet('laiha_settings') || {};
        config.laiha_auto_enabled = { ok: laiha.autoViolations !== false, value: laiha.autoViolations === false ? 'DISABLED' : 'ENABLED (3pm UTC cron)' };
        // Branches
        var branches = await dbGet('branches') || [];
        config.branches_count = { ok: branches.length > 0, value: branches.length + ' فروع' };
        config.branches_have_geofence = { ok: branches.every(function(b){ return b.lat && b.lng && b.radius; }), value: branches.filter(function(b){ return b.lat && b.lng && b.radius; }).length + '/' + branches.length + ' بنطاق جغرافي' };
        report.sections.config = config;

        // ══════════ INTEGRATIONS ══════════
        var integrations = {};
        // Push notifications (VAPID)
        integrations.vapid_public = { ok: !!process.env.VAPID_PUBLIC_KEY, value: process.env.VAPID_PUBLIC_KEY ? 'VAPID_PUBLIC_KEY set' : 'missing' };
        integrations.vapid_private = { ok: !!process.env.VAPID_PRIVATE_KEY, value: process.env.VAPID_PRIVATE_KEY ? 'VAPID_PRIVATE_KEY set' : 'missing' };
        integrations.vapid_email = { ok: !!process.env.VAPID_CONTACT_EMAIL, value: process.env.VAPID_CONTACT_EMAIL || 'not set' };
        // Push subscriptions
        var subs = await safeTime(async function(){ var s = await dbGet('push_subscriptions') || {}; return Object.keys(s).length + ' مشترك'; });
        integrations.push_subscriptions = { ok: subs.ok, value: subs.value, error: subs.error };
        // GitHub token (for update tool)
        integrations.github_token = { ok: !!process.env.GITHUB_TOKEN, value: process.env.GITHUB_TOKEN ? 'GITHUB_TOKEN present (update tool OK)' : 'missing — update tool disabled' };
        // Kadwar sync
        var kadwarR = await safeTime(async function(){
          var kd = await dbGet('kadwar_data');
          return kd ? 'synced (' + (Array.isArray(kd.employees) ? kd.employees.length : 0) + ' موظف من كوادر)' : 'no kadwar data';
        });
        integrations.kadwar_sync = { ok: kadwarR.ok, value: kadwarR.value, error: kadwarR.error };
        report.sections.integrations = integrations;

        // ══════════ TAWASUL SYSTEM ══════════
        var tawasul = {};
        tawasul.task_index = await safeTime(async function(){
          var idx = await dbGet('twsl:idx') || [];
          return idx.length + ' مهمة مفهرسة';
        });
        tawasul.categories = await safeTime(async function(){
          var c = await dbGet('twsl:categories') || [];
          return c.length + ' تصنيف';
        });
        tawasul.projects = await safeTime(async function(){
          var p = await dbGet('twsl:projects') || [];
          return p.length + ' مشروع';
        });
        tawasul.notifs = await safeTime(async function(){
          var n = await dbGet('twsl:notifs') || [];
          return n.length + ' إشعار';
        });
        tawasul.serial_counter = await safeTime(async function(){
          var s = await dbGet('twsl:serial') || 0;
          return 'CB' + String(s).padStart(4, '0') + ' (تالي: CB' + String(s+1).padStart(4,'0') + ')';
        });
        report.sections.tawasul = tawasul;

        // ══════════ COMPUTE OVERALL ══════════
        var failed = [];
        Object.keys(report.sections).forEach(function(sec){
          Object.keys(report.sections[sec]).forEach(function(key){
            var item = report.sections[sec][key];
            if (item && item.ok === false) failed.push(sec + '.' + key);
          });
        });
        report.overall = failed.length === 0 ? 'ok' : failed.length <= 2 ? 'warning' : 'error';
        report.failed_checks = failed;
        report.total_checks = Object.keys(report.sections).reduce(function(sum, sec){ return sum + Object.keys(report.sections[sec]).length; }, 0);

        return res.json(report);
      }

      default: return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
