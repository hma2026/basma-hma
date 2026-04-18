// ─── HMA Database API v3 — Upstash Redis ─────────────────────────────────
// كل مفتاح مستقل في Redis — لا يمكن فقدان بيانات بالكتابة فوقها
// Migration تلقائي من Vercel Blob القديم
// ────────────────────────────────────────────────────────────────────────────

export const config = { runtime: "nodejs", maxDuration: 30 };

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV_REST_API_URL or KV_REST_API_TOKEN missing");

  return async (command, ...args) => {
    const res = await fetch(`${url}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([command, ...args]),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  };
}

// ── Migration from Vercel Blob ──
async function migrateFromBlob(redis) {
  try {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix: "kv/" });
    const blobs = (result.blobs || []).filter(b => b.size > 0);
    if (blobs.length === 0) return 0;

    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const resp = await fetch(latest.downloadUrl || latest.url, {
      headers: token ? { Authorization: "Bearer " + token } : {}
    });
    if (!resp.ok) return 0;

    const oldData = await resp.json();
    const keys = Object.keys(oldData);
    console.log("📦 Migrating " + keys.length + " keys from Blob to Redis...");

    // Pipeline: write all keys at once
    const pipeline = keys.map(k => ["SET", k, JSON.stringify(oldData[k])]);
    for (let i = 0; i < pipeline.length; i += 20) {
      const batch = pipeline.slice(i, i + 20);
      await Promise.allSettled(batch.map(cmd => redis(cmd[0], cmd[1], cmd[2])));
    }

    console.log("✅ Migration complete: " + keys.length + " keys");
    return keys.length;
  } catch (e) {
    console.warn("Migration failed:", e.message);
    return 0;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const redis = getRedis();
    const body = req.method === "POST" ? (req.body || {}) : {};
    const action = body.action || req.query.action || "loadAll";

    // ══ TEST ══
    if (action === "test") {
      const results = { token: false, write: false, read: false, version: "v3-upstash-redis", error: null };
      try {
        results.token = true;
        await redis("SET", "_test:ping", JSON.stringify({ t: Date.now() }));
        results.write = true;
        const val = await redis("GET", "_test:ping");
        results.read = !!val;
        await redis("DEL", "_test:ping");
        // Count keys
        const allKeys = await redis("KEYS", "*");
        results.dbKeys = (allKeys || []).filter(k => !k.startsWith("_test")).length;
      } catch (e) { results.error = e.message; }
      return res.json(results);
    }

    // ══ loadAll ══
    if (action === "loadAll") {
      let allKeys = await redis("KEYS", "*");
      allKeys = (allKeys || []).filter(k => !k.startsWith("_test"));

      // Migration: if Redis empty, try Blob
      if (allKeys.length === 0) {
        const migrated = await migrateFromBlob(redis);
        if (migrated > 0) {
          allKeys = await redis("KEYS", "*");
          allKeys = (allKeys || []).filter(k => !k.startsWith("_test"));
        }
      }

      if (allKeys.length === 0) {
        return res.json({ ok: true, data: {}, keys: 0 });
      }

      // MGET all values at once
      const values = await redis("MGET", ...allKeys);
      const data = {};
      allKeys.forEach((k, i) => {
        if (values[i]) {
          try { data[k] = JSON.parse(values[i]); } catch { data[k] = values[i]; }
        }
      });

      return res.json({ ok: true, data, keys: allKeys.length });
    }

    // ══ sync ══
    if (action === "sync" && req.method === "POST") {
      const { data } = body;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ ok: false, error: "Invalid data" });
      }
      const keys = Object.keys(data);
      // 🛡️ حماية التصنيفات: لو sync يحتوي libs بالنسخة القديمة — احذفها من الـ sync
      if (data.libs && data.libs.specs) {
        const hasOldMEP = data.libs.specs.some(s => s.id === "mep" && (s.label||"").includes("ميكانيكا وكهرباء"));
        if (hasOldMEP) {
          console.warn("🛡️ BLOCKED: Removing old libs from sync");
          delete data.libs;
          keys.splice(keys.indexOf("libs"), 1);
        }
      }
      // Write all keys in batches of 20
      let written = 0;
      for (let i = 0; i < keys.length; i += 20) {
        const batch = keys.slice(i, i + 20);
        await Promise.allSettled(batch.map(k =>
          redis("SET", k, JSON.stringify(data[k]))
        ));
        written += batch.length;
      }
      return res.json({ ok: true, written, keys: keys.length, size: JSON.stringify(data).length });
    }

    // ══ set ══
    if (action === "set" && req.method === "POST") {
      const { key, value } = body;
      if (!key) return res.status(400).json({ ok: false, error: "Missing key" });
      
      // 🛡️ حماية التصنيفات: لا تقبل النسخة القديمة
      if (key === "libs" && value && value.specs) {
        const hasOldMEP = value.specs.some(s => s.id === "mep" && (s.label||"").includes("ميكانيكا وكهرباء"));
        if (hasOldMEP) {
          console.warn("🛡️ BLOCKED: Attempt to save old combined MEP spec");
          return res.json({ ok: false, error: "blocked_old_libs" });
        }
      }
      
      await redis("SET", key, JSON.stringify(value));
      return res.json({ ok: true });
    }

    // ══ get ══
    if (action === "get") {
      const key = body.key || req.query.key;
      if (!key) return res.status(400).json({ ok: false, error: "Missing key" });
      const val = await redis("GET", key);
      if (val === null || val === undefined) return res.json({ ok: true, value: null });
      try { return res.json({ ok: true, value: JSON.parse(val) }); }
      catch { return res.json({ ok: true, value: val }); }
    }

    // ══ del — supports both POST and GET ══
    if (action === "del") {
      const key = body.key || req.query.key;
      if (!key) return res.status(400).json({ ok: false, error: "Missing key" });
      await redis("DEL", key);
      // Also update index if it's a record key
      if (key.startsWith("c:") && key !== "c:idx") {
        const idx = JSON.parse(await redis("GET", "c:idx") || "[]");
        await redis("SET", "c:idx", JSON.stringify(idx.filter(x => x !== key.slice(2))));
      }
      if (key.startsWith("e:") && key !== "e:idx") {
        const idx = JSON.parse(await redis("GET", "e:idx") || "[]");
        await redis("SET", "e:idx", JSON.stringify(idx.filter(x => x !== key.slice(2))));
      }
      if (key.startsWith("user:") && key !== "users:idx") {
        const idx = JSON.parse(await redis("GET", "users:idx") || "[]");
        await redis("SET", "users:idx", JSON.stringify(idx.filter(x => x !== key.slice(5))));
      }
      return res.json({ ok: true, deleted: key });
    }

    // ══ keys ══
    if (action === "keys") {
      const allKeys = await redis("KEYS", "*");
      return res.json((allKeys || []).filter(k => !k.startsWith("_test")));
    }

    // ══ migrate — نقل البيانات من Blob القديم لـ Redis ══
    if (action === "migrate") {
      const migrated = await migrateFromBlob(redis);
      if (migrated > 0) {
        return res.json({ ok: true, migrated, message: "✅ تم نقل " + migrated + " مفتاح من Blob إلى Redis" });
      }
      return res.json({ ok: false, migrated: 0, message: "❌ لا توجد بيانات في Blob أو فشل النقل" });
    }

    // ══ restoreFromBackup — استرجاع من النسخة الاحتياطية ══
    if (action === "restoreFromBackup") {
      try {
        const { list } = await import("@vercel/blob");
        const result = await list({ prefix: "backup/" });
        const blobs = (result.blobs || []).filter(b => b.size > 0);
        if (blobs.length === 0) return res.json({ ok: false, error: "لا توجد نسخة احتياطية" });
        const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const resp = await fetch(latest.downloadUrl || latest.url, {
          headers: token ? { Authorization: "Bearer " + token } : {}
        });
        if (!resp.ok) return res.json({ ok: false, error: "فشل قراءة النسخة الاحتياطية" });
        const backupData = await resp.json();
        const keys = Object.keys(backupData);
        let written = 0;
        for (let i = 0; i < keys.length; i += 20) {
          const batch = keys.slice(i, i + 20);
          await Promise.allSettled(batch.map(k =>
            redis("SET", k, JSON.stringify(backupData[k]))
          ));
          written += batch.length;
        }
        return res.json({ ok: true, restored: written, message: "✅ تم استرجاع " + written + " مفتاح من النسخة الاحتياطية" });
      } catch (e) {
        return res.json({ ok: false, error: e.message });
      }
    }

    return res.status(400).json({ ok: false, error: "Unknown action: " + action });
  } catch (e) {
    console.error("DB API error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
