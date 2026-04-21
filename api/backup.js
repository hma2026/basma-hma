/* ═══════════════════════════════════════════════════════════════════
 *  api/backup.js — Backup API using Cloudflare R2 + Upstash Redis
 * ═══════════════════════════════════════════════════════════════════
 *  ⚠️ DO NOT use @vercel/blob or @vercel/kv — R2 + Redis only (v7.31)
 *
 *  Actions:
 *    upload-chunk   — accept chunk of backup data (stores in Redis temp)
 *    upload-finalize — assemble chunks, store in R2, register metadata
 *    register       — register a backup (metadata in Redis)
 *    list           — list all backups
 *    load           — download backup data (returns R2 public URL)
 *    restore        — read backup from R2, write to Redis
 *    delete         — delete from R2 + Redis metadata
 *    info           — storage info
 * ═══════════════════════════════════════════════════════════════════ */

import crypto from 'crypto';

export const config = { runtime: "nodejs", maxDuration: 60, api: { bodyParser: { sizeLimit: '4mb' } } };

/* ────── Environment ────── */
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY = (process.env.R2_ACCESS_KEY_ID || '').trim();
const R2_SECRET_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const R2_BUCKET = (process.env.R2_BUCKET || 'basma-hma').trim();
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();
const USE_R2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);
const SYSTEM = (process.env.STORAGE_PREFIX || 'basma').trim();
const PFX = SYSTEM + ':';
const META_KEY = PFX + 'backup_manifests';
const KEEP_MAX = 5;

/* ────── Redis ────── */
async function redis(cmd, ...args) {
  var r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd, ...args]),
  });
  if (!r.ok) throw new Error('Redis ' + cmd + ': ' + r.status);
  return (await r.json()).result;
}

/* ────── R2 via AWS SigV4 ────── */
function r2Sign(method, path, body, contentType) {
  var host = R2_ACCOUNT_ID + '.r2.cloudflarestorage.com';
  var url = 'https://' + host + '/' + R2_BUCKET + path;
  var date = new Date();
  var amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  var dateStamp = amzDate.slice(0, 8);
  var encoder = new TextEncoder();
  var bodyBytes = body instanceof Uint8Array ? body : typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body || []);
  var payloadHash = crypto.createHash('sha256').update(bodyBytes).digest('hex');
  var canonicalHeaders = 'host:' + host + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + amzDate + '\n';
  if (contentType) canonicalHeaders = 'content-type:' + contentType + '\n' + canonicalHeaders;
  var signedHeaders = contentType ? 'content-type;host;x-amz-content-sha256;x-amz-date' : 'host;x-amz-content-sha256;x-amz-date';
  var canonicalRequest = method + '\n/' + R2_BUCKET + path + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;
  var credentialScope = dateStamp + '/auto/s3/aws4_request';
  var stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  var kDate = crypto.createHmac('sha256', 'AWS4' + R2_SECRET_KEY).update(dateStamp).digest();
  var kRegion = crypto.createHmac('sha256', kDate).update('auto').digest();
  var kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
  var kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  var signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  var authorization = 'AWS4-HMAC-SHA256 Credential=' + R2_ACCESS_KEY + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
  var headers = { 'Authorization': authorization, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['Content-Type'] = contentType;
  return { url, headers, body: bodyBytes };
}

async function r2Put(key, data, ct) {
  var s = r2Sign('PUT', '/' + key, data, ct || 'application/json');
  var r = await fetch(s.url, { method: 'PUT', headers: s.headers, body: s.body });
  if (!r.ok) throw new Error('R2 PUT failed: ' + r.status);
  return R2_PUBLIC_URL ? R2_PUBLIC_URL + '/' + key : s.url;
}

async function r2Get(key) {
  var s = r2Sign('GET', '/' + key, '');
  var r = await fetch(s.url, { method: 'GET', headers: s.headers });
  if (!r.ok) return null;
  return await r.text();
}

async function r2Del(key) {
  var s = r2Sign('DELETE', '/' + key, '');
  await fetch(s.url, { method: 'DELETE', headers: s.headers });
}

/* ────── Metadata helpers ────── */
async function getManifests() {
  var raw = await redis('GET', META_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveManifests(list) {
  await redis('SET', META_KEY, JSON.stringify(list));
}

/* ────── Handler ────── */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!REDIS_URL || !REDIS_TOKEN) return res.json({ error: 'Redis غير مفعّل' });

  try {
    var action = req.query.action;

    /* ═══ UPLOAD CHUNK ═══ */
    if (action === 'upload-chunk' && req.method === 'POST') {
      var { sessionId, chunkIndex, totalChunks, data } = req.body || {};
      if (!sessionId || chunkIndex === undefined || !data) return res.json({ error: 'missing fields' });
      await redis('SET', PFX + 'bkup_' + sessionId + '_' + chunkIndex, data, 'EX', 600);
      return res.json({ ok: true, chunkIndex });
    }

    /* ═══ UPLOAD FINALIZE ═══ */
    if (action === 'upload-finalize' && req.method === 'POST') {
      var { sessionId, totalChunks, backupId, scope, keys } = req.body || {};
      if (!sessionId || !totalChunks || !backupId) return res.json({ error: 'missing fields' });

      // Assemble chunks
      var allData = '';
      for (var i = 0; i < totalChunks; i++) {
        var chunk = await redis('GET', PFX + 'bkup_' + sessionId + '_' + i);
        if (!chunk) return res.json({ error: 'Chunk ' + i + ' missing/expired' });
        allData += chunk;
      }
      // Cleanup temp
      for (var i = 0; i < totalChunks; i++) redis('DEL', PFX + 'bkup_' + sessionId + '_' + i).catch(function(){});

      // Store in R2
      var r2Key = 'basma-backup/' + backupId + '.json';
      if (USE_R2) {
        var url = await r2Put(r2Key, allData, 'application/json');
      }

      // Save metadata
      var manifests = await getManifests();
      manifests.unshift({
        backupId: backupId,
        r2Key: r2Key,
        url: url || '',
        size: allData.length,
        scope: scope || 'all',
        keys: keys || [],
        createdAt: new Date().toISOString(),
      });
      // Keep only last N
      if (manifests.length > KEEP_MAX) {
        var removed = manifests.splice(KEEP_MAX);
        for (var rm of removed) {
          if (USE_R2 && rm.r2Key) r2Del(rm.r2Key).catch(function(){});
        }
      }
      await saveManifests(manifests);

      return res.json({ success: true, backupId, size: allData.length });
    }

    /* ═══ REGISTER (legacy compat) ═══ */
    if (action === 'register' && req.method === 'POST') {
      var { backupId, url, size, scope, keys } = req.body || {};
      if (!backupId) return res.json({ error: 'backupId required' });
      var manifests = await getManifests();
      manifests.unshift({ backupId, url: url || '', size: size || 0, scope: scope || 'all', keys: keys || [], createdAt: new Date().toISOString() });
      if (manifests.length > KEEP_MAX) manifests.splice(KEEP_MAX);
      await saveManifests(manifests);
      return res.json({ success: true });
    }

    /* ═══ LIST ═══ */
    if (action === 'list') {
      var manifests = await getManifests();
      return res.json({ backups: manifests });
    }

    /* ═══ INFO ═══ */
    if (action === 'info') {
      var manifests = await getManifests();
      return res.json({
        exists: manifests.length > 0,
        count: manifests.length,
        latest: manifests[0] || null,
        storage: 'cloudflare-r2',
        r2Configured: USE_R2,
      });
    }

    /* ═══ LOAD ═══ */
    if (action === 'load') {
      var id = req.query.id;
      var manifests = await getManifests();
      var m = id ? manifests.find(function(x){ return x.backupId === id; }) : manifests[0];
      if (!m) return res.json({ success: false, error: 'لا توجد نسخة' });

      // Try to load from R2
      var data = null;
      if (USE_R2 && m.r2Key) {
        var raw = await r2Get(m.r2Key);
        if (raw) try { data = JSON.parse(raw); } catch {}
      }
      // Fallback: try URL directly (for old blob-based backups)
      if (!data && m.url) {
        try {
          var r = await fetch(m.url);
          if (r.ok) data = await r.json();
        } catch {}
      }
      if (!data) return res.json({ success: false, error: 'فشل قراءة النسخة' });
      return res.json({ success: true, backupId: m.backupId, data: data });
    }

    /* ═══ RESTORE ═══ */
    if (action === 'restore' && req.method === 'POST') {
      var { backupId } = req.body || {};
      var manifests = await getManifests();
      var m = backupId ? manifests.find(function(x){ return x.backupId === backupId; }) : manifests[0];
      if (!m) return res.json({ success: false, error: 'لا توجد نسخة' });

      var data = null;
      if (USE_R2 && m.r2Key) {
        var raw = await r2Get(m.r2Key);
        if (raw) try { data = JSON.parse(raw); } catch {}
      }
      if (!data && m.url) {
        try { var r = await fetch(m.url); if (r.ok) data = await r.json(); } catch {}
      }
      if (!data) return res.json({ success: false, error: 'فشل قراءة بيانات النسخة' });

      // Write each key to Redis
      var restored = 0;
      var totalKeys = Object.keys(data).length;
      for (var key in data) {
        try {
          await redis('SET', PFX + key, JSON.stringify(data[key]));
          restored++;
        } catch {}
      }
      return res.json({ success: true, restoredCount: restored, totalKeys: totalKeys });
    }

    /* ═══ DELETE ═══ */
    if (action === 'delete' && req.method === 'POST') {
      var { backupId } = req.body || {};
      if (!backupId) return res.json({ error: 'backupId required' });
      var manifests = await getManifests();
      var idx = manifests.findIndex(function(x){ return x.backupId === backupId; });
      if (idx < 0) return res.json({ error: 'النسخة غير موجودة' });
      var m = manifests[idx];
      if (USE_R2 && m.r2Key) r2Del(m.r2Key).catch(function(){});
      manifests.splice(idx, 1);
      await saveManifests(manifests);
      return res.json({ success: true });
    }

    return res.json({ error: 'Unknown action: ' + action });
  } catch(e) {
    return res.json({ error: e.message || String(e) });
  }
}
