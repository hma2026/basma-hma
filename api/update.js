module.exports = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ error: 'POST only' });

  var token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(200).json({ error: 'GITHUB_TOKEN not set' });

  var chunks = [];
  req.on('data', function(chunk) { chunks.push(chunk); });
  req.on('end', function() {
    try {
      var raw = Buffer.concat(chunks);
      var json;
      try { json = JSON.parse(raw.toString()); } catch(e) { return res.status(200).json({ error: 'Invalid JSON' }); }
      if (!json.zip) return res.status(200).json({ error: 'Missing zip field' });

      var zipBuf = Buffer.from(json.zip, 'base64');

      // Parse ZIP (stored/uncompressed only)
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
        if (size > 0 && name.indexOf('/') !== name.length - 1 && comp === 0) {
          files.push({ name: name, b64: zipBuf.slice(dOff, dOff + size).toString('base64') });
        }
        off = dOff + size;
      }

      if (files.length === 0) return res.status(200).json({ error: 'No files. Use: zip -0 -r update.zip files/' });

      // GitHub API
      function ghReq(path, method, body) {
        return fetch('https://api.github.com/repos/hma2026/basma-hma' + path, {
          method: method || 'GET',
          headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        }).then(function(r) { return r.json(); });
      }

      // Get ref -> create blobs -> tree -> commit -> update ref
      ghReq('/git/ref/heads/main').then(function(ref) {
        if (!ref.object) return ghReq('/git/ref/heads/master');
        return ref;
      }).then(function(ref) {
        if (!ref.object) return res.status(200).json({ error: 'Branch not found' });
        var parentSHA = ref.object.sha;
        var branchPath = ref.ref ? ref.ref.replace('refs/', '') : 'heads/main';

        ghReq('/git/commits/' + parentSHA).then(function(commit) {
          // Create blobs in parallel
          Promise.all(files.map(function(f) {
            return ghReq('/git/blobs', 'POST', { content: f.b64, encoding: 'base64' });
          })).then(function(blobs) {
            var tree = files.map(function(f, i) {
              var p = f.name;
              if (p.indexOf('basma-web/') === 0) p = p.substring(10);
              return { path: p, mode: '100644', type: 'blob', sha: blobs[i].sha };
            });

            ghReq('/git/trees', 'POST', { base_tree: commit.tree.sha, tree: tree }).then(function(newTree) {
              var ts = new Date().toISOString().substring(0, 16);
              ghReq('/git/commits', 'POST', {
                message: '[بصمة] تحديث ' + ts + ' — ' + files.length + ' ملفات',
                tree: newTree.sha,
                parents: [parentSHA]
              }).then(function(newCommit) {
                ghReq('/git/' + branchPath, 'PATCH', { sha: newCommit.sha }).then(function() {
                  res.status(200).json({
                    success: true,
                    message: 'تم التحديث بنجاح!',
                    commit: newCommit.sha ? newCommit.sha.substring(0, 7) : 'done',
                    files: files.map(function(f) { return f.name; })
                  });
                });
              });
            });
          });
        });
      }).catch(function(err) {
        res.status(200).json({ error: 'GitHub: ' + String(err.message || err) });
      });

    } catch(err) {
      res.status(200).json({ error: String(err.message || err) });
    }
  });
};
