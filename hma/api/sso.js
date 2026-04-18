// ─── HMA SSO API ──────────────────────────────────────────────────────────
// يُصدر tokens مؤقتة للدخول الموحد بين كوادر وبصمة
// - POST /api/sso?action=create   → كوادر ينشئ token للمستخدم الحالي
// - GET  /api/sso?action=verify&token=xxx → بصمة تتحقق من token
// ─────────────────────────────────────────────────────────────────────────

export const config = { runtime: "nodejs", maxDuration: 15 };

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV config missing");
  return async (cmd, ...args) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([cmd, ...args]),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  };
}

function generateToken() {
  // 32 bytes random hex
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function setCors(req, res) {
  const origin = req.headers?.origin || "";
  const allowed = !origin || origin.includes("hma.engineer") || origin.endsWith(".vercel.app");
  res.setHeader("Access-Control-Allow-Origin", allowed ? (origin || "*") : "https://b.hma.engineer");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-basma-token");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const redis = getRedis();
    const action = req.query.action;

    // ══ create — إنشاء token جديد (من كوادر) ══
    if (action === "create" && req.method === "POST") {
      const body = req.body || {};
      const username = body.username;
      const empIdNumber = body.empIdNumber;

      if (!username) return res.status(400).json({ error: "username required" });

      // التحقق أن الحساب موجود في كوادر
      const userRaw = await redis("GET", "user:" + username);
      if (!userRaw) return res.status(404).json({ error: "user not found" });
      const user = JSON.parse(userRaw);

      // إنشاء token
      const token = generateToken();
      const ttl = 300; // 5 دقائق
      const payload = {
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        linkedId: user.linkedId || empIdNumber || "",
        idNumber: empIdNumber || user.linkedId || "",
        email: user.email || "",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      };

      // احفظ في Redis مع TTL
      await redis("SET", "sso:" + token, JSON.stringify(payload), "EX", ttl);

      return res.json({
        ok: true,
        token,
        expiresIn: ttl,
        redirectUrl: "https://b.hma.engineer?sso=" + token,
      });
    }

    // ══ verify — تحقق من token (من بصمة) ══
    if (action === "verify") {
      const token = req.query.token || req.headers["x-sso-token"];
      if (!token) return res.status(400).json({ error: "token required" });

      // اقرأ من Redis
      const payloadRaw = await redis("GET", "sso:" + token);
      if (!payloadRaw) {
        return res.status(401).json({ valid: false, error: "token expired or invalid" });
      }

      const payload = JSON.parse(payloadRaw);

      // one-time use — احذف بعد أول تحقق
      await redis("DEL", "sso:" + token);

      return res.json({
        valid: true,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
        idNumber: payload.idNumber,
        linkedId: payload.linkedId,
        email: payload.email,
        issuedAt: payload.issuedAt,
      });
    }

    // ══ ping — فحص ══
    if (action === "ping") {
      return res.json({ ok: true, service: "hma-sso", version: "1.0" });
    }

    return res.status(400).json({ error: "unknown action. Available: create (POST), verify (GET), ping" });
  } catch (e) {
    console.error("sso error:", e);
    return res.status(500).json({ error: e.message });
  }
}
