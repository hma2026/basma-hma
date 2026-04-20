// backup.js — Backup API for Basma HMA using Vercel Blob
// v6.77 — Mirror of Kawader's proven backup system

export const config = { runtime: "nodejs", maxDuration: 60 };

const PFX_MANIFEST = "basma-manifest/";
const PFX_BACKUP = "basma-backup/";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { put, list, del } = await import("@vercel/blob");
    const action = req.query.action;

    /* ─── REGISTER — تسجيل نسخة بعد client upload ─── */
    if (action === "register" && req.method === "POST") {
      const { backupId, url, size, pathname, scope, keys } = req.body || {};
      if (!backupId || !url) return res.status(400).json({ error: "backupId و url مطلوبان" });

      // حذف النسخ القديمة (نبقي آخر 5 manifests + الفعلية المرتبطة بها)
      const KEEP = 5;
      try {
        const allManifests = await list({ prefix: PFX_MANIFEST });
        const sorted = (allManifests.blobs || []).sort(
          (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );

        // معرّفات الـ backups التي يجب الإبقاء عليها (بما فيها الجديد)
        const keepIds = new Set([backupId]);
        for (let i = 0; i < Math.min(KEEP - 1, sorted.length); i++) {
          // قراءة manifest لمعرفة الـ backupId
          try {
            const r = await fetch(sorted[i].url);
            const m = await r.json();
            if (m && m.backupId) keepIds.add(m.backupId);
          } catch (e) {}
        }

        // حذف manifests القديمة
        for (let i = 0; i < sorted.length; i++) {
          try {
            const r = await fetch(sorted[i].url);
            const m = await r.json();
            if (m && m.backupId && !keepIds.has(m.backupId)) {
              await del(sorted[i].url).catch(() => {});
            }
          } catch (e) {}
        }

        // حذف backups القديمة
        const allBackups = await list({ prefix: PFX_BACKUP });
        for (const blob of allBackups.blobs || []) {
          let found = false;
          for (const id of keepIds) {
            if (blob.pathname.includes(id)) {
              found = true;
              break;
            }
          }
          if (!found) {
            await del(blob.url).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("Cleanup warning:", e.message);
      }

      // حفظ manifest صغير
      const manifest = {
        backupId,
        url,
        pathname: pathname || "",
        size: size || 0,
        scope: scope || "all",
        keys: keys || [],
        createdAt: new Date().toISOString(),
      };
      await put(
        PFX_MANIFEST + backupId + ".json",
        JSON.stringify(manifest),
        {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      );

      return res.status(200).json({ success: true, backupId });
    }

    /* ─── LOAD — تحميل بيانات النسخة الأخيرة (أو محددة بـ id) ─── */
    if (action === "load") {
      const targetId = req.query.id;
      const manifestsList = await list({ prefix: PFX_MANIFEST });
      const manifests = manifestsList.blobs || [];
      if (manifests.length === 0) {
        return res.status(200).json({ success: false, error: "لا توجد نسخة احتياطية" });
      }

      let target;
      if (targetId) {
        target = manifests.find((b) => b.pathname.includes(targetId));
        if (!target) return res.status(404).json({ success: false, error: "النسخة غير موجودة" });
      } else {
        target = manifests.sort(
          (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
        )[0];
      }

      const mRes = await fetch(target.url);
      const manifest = await mRes.json();
      const dRes = await fetch(manifest.url);
      const data = await dRes.json();

      return res.status(200).json({
        success: true,
        data,
        backupId: manifest.backupId,
        date: manifest.createdAt,
        size: manifest.size || 0,
        scope: manifest.scope || "all",
        keys: manifest.keys || [],
      });
    }

    /* ─── INFO — آخر نسخة معلوماتها فقط بدون البيانات ─── */
    if (action === "info") {
      const manifestsList = await list({ prefix: PFX_MANIFEST });
      const manifests = manifestsList.blobs || [];
      if (manifests.length === 0) return res.status(200).json({ exists: false });
      const latest = manifests.sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
      )[0];
      const mRes = await fetch(latest.url);
      const manifest = await mRes.json();
      return res.status(200).json({
        exists: true,
        backupId: manifest.backupId,
        date: manifest.createdAt || latest.uploadedAt,
        size: manifest.size || 0,
        scope: manifest.scope || "all",
        keys: manifest.keys || [],
      });
    }

    /* ─── LIST — قائمة كل النسخ الموجودة ─── */
    if (action === "list") {
      const manifestsList = await list({ prefix: PFX_MANIFEST });
      const manifests = manifestsList.blobs || [];
      const items = [];
      for (const blob of manifests) {
        try {
          const r = await fetch(blob.url);
          const m = await r.json();
          items.push({
            backupId: m.backupId,
            date: m.createdAt || blob.uploadedAt,
            size: m.size || 0,
            scope: m.scope || "all",
            keys: m.keys || [],
          });
        } catch (e) {}
      }
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      return res.status(200).json({ success: true, backups: items });
    }

    /* ─── DELETE — حذف نسخة محددة ─── */
    if (action === "delete" && (req.method === "POST" || req.method === "DELETE")) {
      const { backupId } = req.body || {};
      if (!backupId) return res.status(400).json({ error: "backupId مطلوب" });

      const manifestsList = await list({ prefix: PFX_MANIFEST });
      const manifest = (manifestsList.blobs || []).find((b) =>
        b.pathname.includes(backupId)
      );
      if (manifest) await del(manifest.url).catch(() => {});

      const backupsList = await list({ prefix: PFX_BACKUP });
      const backup = (backupsList.blobs || []).find((b) =>
        b.pathname.includes(backupId)
      );
      if (backup) await del(backup.url).catch(() => {});

      return res.status(200).json({ success: true });
    }

    /* ─── RESTORE — استعادة كل البيانات إلى KV ─── */
    if (action === "restore" && req.method === "POST") {
      const { backupId, mode } = req.body || {};
      // mode: 'replace' (الافتراضي) | 'merge'
      if (!backupId) return res.status(400).json({ error: "backupId مطلوب" });

      const manifestsList = await list({ prefix: PFX_MANIFEST });
      const target = (manifestsList.blobs || []).find((b) =>
        b.pathname.includes(backupId)
      );
      if (!target) return res.status(404).json({ error: "النسخة غير موجودة" });

      const mRes = await fetch(target.url);
      const manifest = await mRes.json();
      const dRes = await fetch(manifest.url);
      const data = await dRes.json();

      // استدعاء KV من خلال data.js
      const { kv } = await import("@vercel/kv");
      let restoredCount = 0;
      const errors = [];

      for (const key of Object.keys(data)) {
        try {
          await kv.set(key, data[key]);
          restoredCount++;
        } catch (e) {
          errors.push({ key, error: e.message });
        }
      }

      return res.status(200).json({
        success: true,
        restoredCount,
        totalKeys: Object.keys(data).length,
        errors,
      });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (e) {
    console.error("Backup error:", e);
    return res.status(500).json({ error: e.message });
  }
}
