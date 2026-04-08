const { put, list } = require('@vercel/blob');

// GitHub API helper
async function ghAPI(path, method, body, token) {
  const r = await fetch(`https://api.github.com/repos/hma2026/basma-hma${path}`, {
    method: method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// Simple ZIP parser (for flat structure)
function parseZIP(buffer) {
  const files = [];
  const view = new DataView(buffer);
  let offset = 0;
  
  while (offset < buffer.byteLength - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Not a local file header
    
    const compressed = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const uncompSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    
    const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
    const name = new TextDecoder().decode(nameBytes);
    
    const dataOffset = offset + 30 + nameLen + extraLen;
    const size = compressed === 0 ? uncompSize : compSize;
    
    if (size > 0 && !name.endsWith('/')) {
      const data = new Uint8Array(buffer, dataOffset, size);
      // Only store uncompressed files (stored method = 0)
      if (compressed === 0) {
        files.push({ name, data, text: new TextDecoder().decode(data) });
      }
    }
    
    offset = dataOffset + size;
  }
  return files;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured', setup: 'Add GITHUB_TOKEN in Vercel → Settings → Environment Variables' });
  }
  
  try {
    // Read the uploaded data
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    
    // Check if it's JSON with base64 data or raw ZIP
    let zipBuffer;
    try {
      const json = JSON.parse(body.toString());
      if (json.zip) {
        zipBuffer = Buffer.from(json.zip, 'base64');
      } else {
        return res.status(400).json({ error: 'Missing zip field' });
      }
    } catch {
      zipBuffer = body;
    }
    
    // Store backup in Vercel Blob
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await put(`updates/backup-${timestamp}.zip`, zipBuffer, { access: 'public' });
    
    // Parse ZIP files
    const files = parseZIP(zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength));
    
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files found in ZIP (only uncompressed/stored ZIPs supported). Use: zip -0 -r update.zip files/' });
    }
    
    // Get current commit SHA
    const ref = await ghAPI('/git/ref/heads/main', 'GET', null, token);
    if (!ref.object) {
      // Try 'master' branch
      const refMaster = await ghAPI('/git/ref/heads/master', 'GET', null, token);
      if (!refMaster.object) {
        return res.status(500).json({ error: 'Could not find main/master branch', ref, refMaster });
      }
      ref.object = refMaster.object;
    }
    const parentSHA = ref.object.sha;
    
    // Get current tree
    const parentCommit = await ghAPI(`/git/commits/${parentSHA}`, 'GET', null, token);
    const baseTreeSHA = parentCommit.tree.sha;
    
    // Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      // Remove leading folder name if present (e.g., "basma-web/src/App.jsx" → "src/App.jsx")
      let path = file.name;
      if (path.startsWith('basma-web/')) path = path.substring('basma-web/'.length);
      
      const blob = await ghAPI('/git/blobs', 'POST', {
        content: Buffer.from(file.data).toString('base64'),
        encoding: 'base64'
      }, token);
      
      treeItems.push({
        path: path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }
    
    // Create new tree
    const newTree = await ghAPI('/git/trees', 'POST', {
      base_tree: baseTreeSHA,
      tree: treeItems,
    }, token);
    
    // Create commit
    const commit = await ghAPI('/git/commits', 'POST', {
      message: `[بصمة HMA] تحديث من التطبيق — ${timestamp}\n\nFiles: ${files.map(f => f.name).join(', ')}`,
      tree: newTree.sha,
      parents: [parentSHA],
    }, token);
    
    // Update ref
    const branch = ref.ref ? ref.ref.replace('refs/', '') : 'heads/main';
    await ghAPI(`/git/${branch}`, 'PATCH', {
      sha: commit.sha,
    }, token);
    
    return res.status(200).json({
      success: true,
      message: 'تم التحديث بنجاح! Vercel يبني الآن تلقائياً',
      commit: commit.sha?.substring(0, 7),
      files: files.map(f => f.name),
      backup: `updates/backup-${timestamp}.zip`,
    });
    
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 200) });
  }
};
