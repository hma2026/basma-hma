// Deploy via GitHub — chunked upload to stay under Vercel 4.5MB body limit
// Action "blob": create GitHub blobs for a batch of files
// Action "commit": create tree + commit from previously created blobs

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(400).json({ error: "GITHUB_TOKEN غير موجود" });

  const owner = "hma2026", repo = "hma-hr-system", branch = "main";
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "hma-deploy" };

  const gh = async (path, method, body) => {
    const r = await fetch(base + path, { method: method || "GET", headers: hdrs, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  };

  try {
    const { action, files, blobs } = req.body || {};

    // ── MODE 1: Create blobs for a batch of files ──
    if (action === "blob") {
      if (!files?.length) return res.json({ error: "لا توجد ملفات" });
      const results = await Promise.all(
        files.map(f => gh("/git/blobs", "POST", { content: f.data, encoding: "base64" }).then(r => ({ path: f.file, sha: r.sha })))
      );
      return res.json({ ok: true, blobs: results });
    }

    // ── MODE 2: Create tree + commit from collected blobs ──
    if (action === "commit") {
      if (!blobs?.length) return res.json({ error: "لا توجد blobs" });

      const ref = await gh(`/git/ref/heads/${branch}`);
      const latestSha = ref.object?.sha;
      if (!latestSha) return res.json({ error: "Branch not found" });

      const commit = await gh(`/git/commits/${latestSha}`);
      const tree = blobs.map(b => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha }));
      const newTree = await gh("/git/trees", "POST", { base_tree: commit.tree.sha, tree });
      const newCommit = await gh("/git/commits", "POST", {
        message: "تحديث النظام " + new Date().toLocaleString("ar-SA"),
        tree: newTree.sha, parents: [latestSha]
      });
      await gh(`/git/refs/heads/${branch}`, "PATCH", { sha: newCommit.sha, force: true });
      return res.json({ success: true, commit: newCommit.sha });
    }

    // ── LEGACY: old single-request mode (kept for compatibility) ──
    if (files?.length) {
      // redirect to chunked
      return res.json({ error: "استخدم action:'blob' ثم action:'commit'" });
    }

    return res.json({ error: "action مطلوب: blob أو commit" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
