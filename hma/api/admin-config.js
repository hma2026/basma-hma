// ─── HMA Admin Config API ────────────────────────────────────────────────
// إنشاء/ربط حساب المدير العام وربطه بسجل موظف
// يُستخدم مرة واحدة لإعداد النظام، أو لتحديث بيانات المدير العام
// ──────────────────────────────────────────────────────────────────────────

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

// SHA-256 + salt (نفس hash كوادر)
async function hashPassword(pass) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(pass + "hr_salt_2024").digest("hex");
}

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // حماية: password سري أو admin token
  const secret = req.query.secret || req.headers["x-admin-token"] || "";
  const REQUIRED = process.env.ADMIN_CONFIG_SECRET || "setup_2026_hma";
  if (secret !== REQUIRED) {
    return res.status(401).json({
      error: "unauthorized",
      hint: "add ?secret=<ADMIN_CONFIG_SECRET> or x-admin-token header",
    });
  }

  try {
    const redis = getRedis();
    const action = req.query.action || "status";

    // ══ status — فحص حالة الإعداد ══
    if (action === "status") {
      const usersIdx = JSON.parse((await redis("GET", "users:idx")) || "[]");
      const empIdx = JSON.parse((await redis("GET", "e:idx")) || "[]");
      const admins = [];
      for (const id of usersIdx) {
        const raw = await redis("GET", "user:" + id);
        if (!raw) continue;
        const u = JSON.parse(raw);
        if (u.role === "admin") admins.push({ id, username: u.username, displayName: u.displayName, linkedId: u.linkedId });
      }
      return res.json({
        totalUsers: usersIdx.length,
        totalEmployees: empIdx.length,
        admins,
        isReady: admins.some(a => a.linkedId),
      });
    }

    // ══ create-admin-employee — إنشاء/تحديث سجل موظف للمدير العام ══
    if (action === "create-admin-employee" && req.method === "POST") {
      const body = req.body || {};
      const idNumber = body.idNumber || "";
      if (!idNumber) return res.status(400).json({ error: "idNumber required" });

      // 1) إنشاء/تحديث سجل الموظف
      const uid = idNumber; // استخدم رقم الهوية كمعرّف موحّد
      const existingEmpRaw = await redis("GET", "e:" + uid);
      const existing = existingEmpRaw ? JSON.parse(existingEmpRaw) : null;

      const empRecord = {
        ...(existing || {}),
        uid,
        idNumber,
        fullName: body.fullName || existing?.fullName || "",
        fullNameEn: body.fullNameEn || existing?.fullNameEn || "",
        email: body.email || existing?.email || "",
        phone: body.phone || existing?.phone || "",
        dob: body.dob || existing?.dob || "",
        birthPlace: body.birthPlace || existing?.birthPlace || "",
        jobTitle: body.jobTitle || existing?.jobTitle || "",
        position: body.position || existing?.position || "",
        department: body.department || existing?.department || "الإدارة العليا",
        branch: body.branch || existing?.branch || "jed",
        city: body.city || existing?.city || "جدة",
        education: body.education || existing?.education || "",
        university: body.university || existing?.university || "",
        graduationYear: body.graduationYear || existing?.graduationYear || "",
        major: body.major || existing?.major || "",
        sceNumber: body.sceNumber || existing?.sceNumber || "",
        sceExpiry: body.sceExpiry || existing?.sceExpiry || "",
        sceStatus: body.sceStatus || "active",
        employeeType: body.employeeType || "office",
        status: "active",
        joinDate: body.joinDate || existing?.joinDate || new Date().toISOString().split("T")[0],
        hrCode: existing?.hrCode || "HREMP0001",
        updatedAt: new Date().toISOString(),
      };

      await redis("SET", "e:" + uid, JSON.stringify(empRecord));
      const eIdx = JSON.parse((await redis("GET", "e:idx")) || "[]");
      if (!eIdx.includes(uid)) {
        eIdx.push(uid);
        await redis("SET", "e:idx", JSON.stringify(eIdx));
      }

      // 1.5) إنشاء/ربط المسمى الوظيفي (للهيكل التنظيمي)
      const jobTitles = JSON.parse((await redis("GET", "jobTitles")) || "[]");
      const desiredTitle = body.jobTitle || body.position || "المدير العام";
      let jt = jobTitles.find(j => j.title === desiredTitle || j.title === body.position);
      if (!jt) {
        jt = {
          id: "jt_admin_" + Date.now(),
          title: desiredTitle,
          department: body.department || "الإدارة العليا",
          gradeRef: body.gradeCode || "G-1",
          salaryRange: body.salaryRange || "",
          level: 1, // أعلى مستوى
          parentId: null, // القمة
          createdAt: new Date().toISOString(),
        };
        jobTitles.push(jt);
        await redis("SET", "jobTitles", JSON.stringify(jobTitles));
      }
      // اربط الموظف بالمسمى
      empRecord.jobTitleId = jt.id;
      await redis("SET", "e:" + uid, JSON.stringify(empRecord));

      // 2) البحث عن حساب admin وربطه
      const usersIdx = JSON.parse((await redis("GET", "users:idx")) || "[]");
      let adminUser = null;
      let adminKey = null;
      for (const id of usersIdx) {
        const raw = await redis("GET", "user:" + id);
        if (!raw) continue;
        const u = JSON.parse(raw);
        if (u.role === "admin" && u.username === "admin") {
          adminUser = u;
          adminKey = "user:" + id;
          break;
        }
      }

      // 3) إنشاء حساب admin إذا لم يكن موجودًا
      if (!adminUser) {
        const newId = "admin";
        adminUser = {
          id: newId,
          username: "admin",
          passwordHash: await hashPassword(body.password || "admin2024"),
          role: "admin",
          displayName: body.fullName || "المشرف الرئيسي",
          email: body.email || "",
          linkedId: uid,
          createdAt: new Date().toISOString(),
          lastPasswordChange: new Date().toISOString(),
        };
        adminKey = "user:" + newId;
        await redis("SET", adminKey, JSON.stringify(adminUser));
        if (!usersIdx.includes(newId)) {
          usersIdx.push(newId);
          await redis("SET", "users:idx", JSON.stringify(usersIdx));
        }
      } else {
        // تحديث: ربط linkedId + تحديث البيانات
        adminUser = {
          ...adminUser,
          linkedId: uid,
          displayName: body.fullName || adminUser.displayName,
          email: body.email || adminUser.email,
          updatedAt: new Date().toISOString(),
        };
        // تحديث كلمة السر فقط إذا تم طلبها
        if (body.password) {
          adminUser.passwordHash = await hashPassword(body.password);
          adminUser.lastPasswordChange = new Date().toISOString();
        }
        await redis("SET", adminKey, JSON.stringify(adminUser));
      }

      return res.json({
        ok: true,
        employee: { uid: empRecord.uid, fullName: empRecord.fullName, idNumber: empRecord.idNumber, jobTitleId: empRecord.jobTitleId },
        jobTitle: { id: jt.id, title: jt.title, department: jt.department },
        adminAccount: { username: adminUser.username, linkedId: adminUser.linkedId, hasPassword: !!adminUser.passwordHash },
        message: "✅ تم إنشاء/تحديث سجل الموظف + المسمى الوظيفي + ربط حساب admin",
      });
    }

    return res.status(400).json({ error: "unknown action. Available: status, create-admin-employee (POST)" });
  } catch (e) {
    console.error("admin-config error:", e);
    return res.status(500).json({ error: e.message });
  }
}
