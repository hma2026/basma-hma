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

      case 'manual_checkin': {
        const { empId, type, date, adminId } = req.body || {};
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
        if (req.method === 'POST') { const ls = await dbGet('leaves') || []; ls.push({ id: 'L' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('leaves', ls); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ls = await dbGet('leaves') || [];
          const { id, status } = req.body;
          const i = ls.findIndex(l => l.id === id);
          if (i >= 0) { ls[i].status = status; await dbSet('leaves', ls); }
          return res.json({ ok: true });
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
          pas.push({ id: 'PA' + Date.now(), ...req.body, ts: new Date().toISOString() });
          await dbSet('pre_absences', pas);
          return res.json({ ok: true });
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
          logs.push({ id: 'CM' + Date.now(), ...req.body, ts: new Date().toISOString() });
          await dbSet('custody_maint', logs);
          return res.json({ ok: true });
        }
        break;
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

      case 'auto_check': {
        // Auto-detect violations for today
        const today = new Date().toISOString().split('T')[0];
        const emps = await dbGet('employees') || [];
        const att = (await dbGet('attendance') || []).filter(a => a.date === today);
        const violations = await dbGet('violations') || [];
        const preAbs = (await dbGet('pre_absences') || []).filter(p => p.date === today);
        const branches = await dbGet('branches') || [];
        const settings = await dbGet('settings') || {};
        var newViolations = [];
        var hour = new Date().getHours(), min = new Date().getMinutes();
        var curMin = hour * 60 + min;

        for (const emp of emps) {
          if (emp.terminated || emp.onLeave) continue;
          if (preAbs.find(p => p.empId === emp.id)) continue; // Pre-notified absence
          var empAtt = att.filter(a => a.empId === emp.id);
          var hasCheckin = empAtt.find(a => a.type === "الحضور");
          var br = branches.find(b => b.id === emp.branch) || { start: "08:30" };
          var startMin = parseInt(br.start?.split(":")[0] || 8) * 60 + parseInt(br.start?.split(":")[1] || 30);

          // Late detection (after start + 15 min grace)
          if (curMin > startMin + 15 && hasCheckin) {
            var checkinTime = new Date(hasCheckin.ts);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            if (checkinMin > startMin + 5) {
              var lateMin = checkinMin - startMin;
              var existing = violations.find(v => v.empId === emp.id && v.date === today && v.type === "late");
              if (!existing) newViolations.push({ empId: emp.id, empName: emp.name, type: "late", date: today, details: "تأخر " + lateMin + " دقيقة" });
            }
          }

          // Absent detection (after start + 60 min, no checkin)
          if (curMin > startMin + 60 && !hasCheckin) {
            var existing2 = violations.find(v => v.empId === emp.id && v.date === today && v.type === "absent");
            if (!existing2) newViolations.push({ empId: emp.id, empName: emp.name, type: "absent", date: today, details: "غياب بدون إفادة مسبقة" });
          }
        }

        // Save new violations
        if (newViolations.length > 0) {
          for (const v of newViolations) violations.push({ id: 'V' + Date.now() + Math.random().toString(36).substr(2, 4), status: 'open', ...v, ts: new Date().toISOString() });
          await dbSet('violations', violations);
        }

        // Auto-escalate overdue warnings
        const warnings = await dbGet('warnings') || [];
        var escalated = 0;
        for (const w of warnings) {
          if (w.status === 'pending' && w.deadline && new Date(w.deadline) < new Date()) {
            w.status = 'escalated';
            w.escalatedAt = new Date().toISOString();
            escalated++;
          }
        }
        if (escalated > 0) await dbSet('warnings', warnings);

        return res.json({ ok: true, newViolations: newViolations.length, escalated, date: today });
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
          // Fetch all requests in parallel
          var requests = await Promise.all(idx.map(function(id){
            return dbGet('twsl:' + id).then(function(r){ return r; }).catch(function(){ return null; });
          }));
          requests = requests.filter(function(r){ return r && r.id; });
          return res.json({
            ok: true,
            requests: requests,
            categories: categories,
            projects: projects,
            total: requests.length,
            syncDate: new Date().toISOString(),
          });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-list error: ' + (e.message || 'unknown'), requests: [], categories: [], projects: [] });
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
            var data = await dbGet(tbl);
            if (!data) return { before: 0, after: 0 };
            var before = Array.isArray(data) ? data.length : Object.keys(data).length;

            if (cleanupAction === 'delete_all') {
              await dbSet(tbl, Array.isArray(data) ? [] : {});
              return { before: before, after: 0 };
            }

            if (!Array.isArray(data)) return { before: before, after: before, skipped: 'not array' };

            var filtered;
            if (cleanupAction === 'delete_older') {
              // Delete records OLDER than X days (keep recent)
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d >= cutoff;
              });
            } else if (cleanupAction === 'delete_recent') {
              // Delete records from the LAST X days (keep older)
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d < cutoff;
              });
            } else if (cleanupAction === 'keep_recent') {
              // Keep ONLY the last X days
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
          return res.json({ ok: true, permission: newPerm });
        }
        if (req.method === 'PUT') {
          var perms = await dbGet('permissions') || [];
          var idx = perms.findIndex(p => p.id === req.body.id);
          if (idx >= 0) { perms[idx] = { ...perms[idx], ...req.body }; await dbSet('permissions', perms); }
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


      /* ═══ AUTO VIOLATIONS (الإنذارات التلقائية) ═══ */
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

          // Check absence
          if (!checkin && nowH >= 18) { // 6pm or later
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

      default: return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
