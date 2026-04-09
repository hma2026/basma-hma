export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.json({ ok: true, msg: 'update API v2 ready' });

  var token = process.env.GITHUB_TOKEN;
  if (!token) return res.json({ error: 'GITHUB_TOKEN غير موجود — أضفه في Vercel Environment Variables', setup: 'Vercel → basma-hma → Settings → Environment Variables → أضف GITHUB_TOKEN' });

  try {
    var body = req.body;
    if (!body || !body.zip) return res.json({ error: 'Missing zip field in body' });

    var zipBuf = Buffer.from(body.zip, 'base64');

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

    if (files.length === 0) return res.json({ error: 'لا توجد ملفات — استخدم: zip -0 -r update.zip src/ api/ public/ index.html package.json vercel.json vite.config.js' });

    async function gh(path, method, ghBody) {
      var r = await fetch('https://api.github.com/repos/hma2026/basma-hma' + path, {
        method: method || 'GET',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'basma-hma-updater' },
        body: ghBody ? JSON.stringify(ghBody) : undefined
      });
      var data = await r.json();
      if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (data.message || JSON.stringify(data)));
      return data;
    }

    var ref;
    try { ref = await gh('/git/ref/heads/main'); }
    catch(e) {
      try { ref = await gh('/git/ref/heads/master'); }
      catch(e2) { return res.json({ error: 'Branch not found' }); }
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

    return res.json({
      success: true,
      message: 'تم التحديث بنجاح!',
      commit: newCommit.sha.substring(0, 7),
      files: files.map(function(f) { return f.name; }),
      filesCount: files.length
    });

  } catch(err) {
    var errMsg = String(err.message || err);
    if (errMsg.includes('401') || errMsg.includes('Bad credentials')) {
      return res.json({ error: 'GITHUB_TOKEN منتهي أو غير صحيح', setup: 'github.com/settings/tokens → Generate new token (classic) → صلاحية repo → انسخ وحطه في Vercel' });
    }
    if (errMsg.includes('404')) {
      return res.json({ error: 'الريبو غير موجود أو التوكن ما عنده صلاحية' });
    }
    return res.json({ error: errMsg });
  }
}
