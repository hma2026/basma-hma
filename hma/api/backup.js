// Backup API — save/load/info using Vercel Blob
// Requires BLOB_READ_WRITE_TOKEN (auto-created when Blob is added to project)

export const config = { runtime: "nodejs", maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { put, list, del } = await import("@vercel/blob");
    const action = req.query.action || (req.method === "POST" ? "save" : "info");

    // ── SAVE backup ──
    if (action === "save" && req.method === "POST") {
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: "لا توجد بيانات للحفظ" });

      const json = JSON.stringify(data);
      const size = Buffer.byteLength(json, "utf-8");

      // Delete old backup first (keep only latest)
      try {
        const existing = await list({ prefix: "backup/" });
        for (const blob of existing.blobs || []) {
          await del(blob.url);
        }
      } catch (e) { /* ignore if no old backups */ }

      // Save new backup
      const filename = "backup/hma-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      const blob = await put(filename, json, {
        access: "public",
        contentType: "application/json",
      });

      return res.status(200).json({
        success: true,
        url: blob.url,
        size,
        date: new Date().toISOString(),
      });
    }

    // ── LOAD backup ──
    if (action === "load") {
      const existing = await list({ prefix: "backup/" });
      const blobs = existing.blobs || [];
      if (blobs.length === 0) {
        return res.status(200).json({ success: false, error: "لا توجد نسخة احتياطية" });
      }

      // Get the latest
      const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const response = await fetch(latest.url, {
        headers: process.env.BLOB_READ_WRITE_TOKEN ? { Authorization: "Bearer " + process.env.BLOB_READ_WRITE_TOKEN } : {}
      });
      const data = await response.json();

      return res.status(200).json({
        success: true,
        data,
        date: latest.uploadedAt,
        size: latest.size,
      });
    }

    // ── INFO — check last backup date ──
    if (action === "info") {
      const existing = await list({ prefix: "backup/" });
      const blobs = existing.blobs || [];
      if (blobs.length === 0) {
        return res.status(200).json({ exists: false });
      }
      const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      return res.status(200).json({
        exists: true,
        date: latest.uploadedAt,
        size: latest.size,
        url: latest.url,
      });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    console.error("Backup error:", e);
    return res.status(500).json({ error: e.message });
  }
}
