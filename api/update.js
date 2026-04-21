/* ═══════════════════════════════════════════════════════════════════
 *  api/update.js — نظام تحديث الكود عبر Chunked Upload + GitHub API
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ⚠️ DO NOT MODIFY THIS FILE — نظام رفع حرج ومستقر (v7.31)
 *  ⚠️ DO NOT use @vercel/blob — all storage via Upstash Redis + Cloudflare R2
 *
 *  آلية العمل:
 *    1. المتصفح يُجزّئ zip إلى أجزاء صغيرة (~2MB لكل جزء)
 *    2. كل جزء يُرسل إلى هذا الـ API ويُحفظ مؤقتاً في Redis
 *    3. عند وصول الجزء الأخير: يُجمّع → يُفكّ → يُرفع لـ GitHub
 *    4. Vercel يبني التطبيق تلقائياً من GitHub
 *
 *  POST actions:
 *    { action: "chunk", sessionId, chunkIndex, totalChunks, data }
 *    { action: "finalize", sessionId, totalChunks }
 *    { zip: "base64..." }  ← fallback للملفات الصغيرة (< 3MB)
 *
 *  متطلبات env vars:
 *    - GITHUB_TOKEN (صلاحية repo)
 *    - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * ═══════════════════════════════════════════════════════════════════ */

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } }
};

/* ────── Redis helpers (standalone, no imports from data.js) ────── */
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

async function redis(command, ...args) {
  var r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify([command, ...args]),
  });
  if (!r.ok) throw new Error('Redis ' + command + ' failed: ' + r.status);
  return (await r.json()).result;
}

/* ────── GitHub API helper ────── */
async function gh(path, method, ghBody) {
  var token = process.env.GITHUB_TOKEN;
  var r = await fetch('https://api.github.com/repos/hma2026/basma-hma' + path, {
    method: method || 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'basma-hma-updater' },
    body: ghBody ? JSON.stringify(ghBody) : undefined
  });
  var data = await r.json();
  if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (data.message || JSON.stringify(data)));
  return data;
}

/* ────── Unzip (store method only, zip -0) ────── */
function unzipBuffer(zipBuf) {
  var files = [];
  var off = 0;
  while (off < zipBuf.length - 4) {
    if (zipBuf.readUInt32LE(off) !== 0x04034b50) break;
    var comp = zipBuf.readUInt16LE(off + 8);
    var cSize = zipBuf.readUInt32LE(off + 18);
    var uSize = zipBuf.readUInt32LE(off + 22);
    var nLen = zipBuf.readUInt16LE(off + 26);
    var eLen = zipBuf.readUInt16LE(off + 28);
    var name = zipBuf.slice(off + 30, off + 30 + nLen).toString('utf8');
    var dOff = off + 30 + nLen + eLen;
    var size = comp === 0 ? uSize : cSize;
    if (size > 0 && !name.endsWith('/') && comp === 0) {
      files.push({ name: name, b64: zipBuf.slice(dOff, dOff + size).toString('base64') });
    }
    off = dOff + size;
  }
  return files;
}

/* ────── Push files to GitHub ────── */
async function pushToGitHub(files) {
  var ref;
  try { ref = await gh('/git/ref/heads/main'); }
  catch(e) {
    try { ref = await gh('/git/ref/heads/master'); }
    catch(e2) { throw new Error('Branch not found'); }
  }
  var parentSHA = ref.object.sha;
  var branchName = ref.ref.replace('refs/', '');
  var commit = await gh('/git/commits/' + parentSHA);

  var blobs = [];
  for (var i = 0; i < files.length; i++) {
    var blob = await gh('/git/blobs', 'POST', { content: files[i].b64, encoding: 'base64' });
    blobs.push(blob);
  }

  var tree = files.map(function(f, idx) {
    var p = f.name;
    if (p.indexOf('basma-web/') === 0) p = p.substring(10);
    else if (p.indexOf('basma/') === 0) p = p.substring(6);
    return { path: p, mode: '100644', type: 'blob', sha: blobs[idx].sha };
  });
  var newTree = await gh('/git/trees', 'POST', { base_tree: commit.tree.sha, tree: tree });

  var ts = new Date().toISOString().substring(0, 16).replace('T', ' ');
  var newCommit = await gh('/git/commits', 'POST', {
    message: '[basma] update ' + ts + ' — ' + files.length + ' files',
    tree: newTree.sha,
    parents: [parentSHA]
  });

  await gh('/git/refs/' + branchName, 'PATCH', { sha: newCommit.sha, force: true });

  return { commit: newCommit.sha.substring(0, 7), filesCount: files.length, fileNames: files.map(f => f.name) };
}

/* ────── Main handler ────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.json({ ok: true, msg: 'update API v4 ready (chunked via Redis)' });

  var token = process.env.GITHUB_TOKEN;
  if (!token) return res.json({ error: 'GITHUB_TOKEN غير موجود' });
  if (!REDIS_URL || !REDIS_TOKEN) return res.json({ error: 'Upstash Redis غير مفعّل' });

  try {
    var body = req.body;
    if (!body) return res.json({ error: 'Missing request body' });

    /* ═══ طريقة 1: Chunked upload (للملفات الكبيرة) ═══ */
    if (body.action === 'chunk') {
      var { sessionId, chunkIndex, totalChunks, data } = body;
      if (!sessionId || chunkIndex === undefined || !totalChunks || !data) {
        return res.json({ error: 'Missing chunk fields' });
      }
      // Store chunk in Redis with 10-minute expiry
      var key = 'basma:update_' + sessionId + '_' + chunkIndex;
      await redis('SET', key, data, 'EX', 600);
      return res.json({ ok: true, chunkIndex: chunkIndex, stored: true });
    }

    if (body.action === 'finalize') {
      var { sessionId, totalChunks } = body;
      if (!sessionId || !totalChunks) {
        return res.json({ error: 'Missing finalize fields' });
      }

      // Read all chunks from Redis
      var allBase64 = '';
      for (var i = 0; i < totalChunks; i++) {
        var key = 'basma:update_' + sessionId + '_' + i;
        var chunk = await redis('GET', key);
        if (!chunk) return res.json({ error: 'Chunk ' + i + ' not found — expired or missing' });
        allBase64 += chunk;
      }

      // Cleanup chunks from Redis
      for (var i = 0; i < totalChunks; i++) {
        redis('DEL', 'basma:update_' + sessionId + '_' + i).catch(function(){});
      }

      // Process zip
      var zipBuf = Buffer.from(allBase64, 'base64');
      var files = unzipBuffer(zipBuf);
      if (files.length === 0) return res.json({ error: 'لا توجد ملفات في الـ ZIP' });

      var result = await pushToGitHub(files);
      return res.json({ success: true, message: 'تم التحديث بنجاح!', ...result });
    }

    /* ═══ طريقة 2: Direct upload (fallback للملفات الصغيرة < 3MB) ═══ */
    if (body.zip) {
      var zipBuf = Buffer.from(body.zip, 'base64');
      var files = unzipBuffer(zipBuf);
      if (files.length === 0) return res.json({ error: 'لا توجد ملفات في الـ ZIP' });

      var result = await pushToGitHub(files);
      return res.json({ success: true, message: 'تم التحديث بنجاح!', ...result });
    }

    return res.json({ error: 'Missing action or zip field' });

  } catch(err) {
    var errMsg = String(err.message || err);
    if (errMsg.includes('401') || errMsg.includes('Bad credentials')) {
      return res.json({ error: 'GITHUB_TOKEN منتهي أو غير صحيح' });
    }
    if (errMsg.includes('404')) {
      return res.json({ error: 'الريبو غير موجود أو التوكن ما عنده صلاحية' });
    }
    return res.json({ error: errMsg });
  }
}
