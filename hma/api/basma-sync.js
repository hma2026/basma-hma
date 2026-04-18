// ─── HMA Basma Sync API ──────────────────────────────────────────────────
// كوادر → بصمة: تصدير الموظفين والهيكل التنظيمي
// كوادر هو المصدر الوحيد للموظفين — بصمة تقرأ فقط
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

// تعيين الفرع من المدينة
function mapBranch(emp) {
  if (emp.branch) return emp.branch; // لو محدد صراحة
  const city = (emp.city || "").toLowerCase();
  if (city.includes("جدة") || city.includes("jed")) return "jed";
  if (city.includes("رياض") || city.includes("riy")) return "riy";
  if (city.includes("اسطنبول") || city.includes("istanbul") || city.includes("ist")) return "ist";
  if (city.includes("غازي") || city.includes("gaz")) return "gaz";
  return "jed"; // افتراضي
}

// تعيين نوع الموظف
function mapType(emp) {
  if (emp.employeeType) return emp.employeeType;
  if (emp.workMode === "remote") return "remote";
  if (emp.workMode === "field") return "field";
  if (emp.workMode === "mixed") return "mixed";
  return "office";
}

// تصدير بيانات موظف واحد بالشكل الذي تفهمه بصمة
function exportEmployee(emp) {
  return {
    id: emp.idNumber || emp.uid || emp.email, // رقم الهوية كمعرّف موحّد
    uid: emp.uid || "",
    name: emp.fullName || "",
    role: emp.jobTitle || emp.position || emp.lastJob || "موظف",
    department: emp.department || "",
    branch: mapBranch(emp),
    managerId: emp.managerId || "",
    supervisorId: emp.supervisorId || "",
    email: emp.email || "",
    phone: emp.phone || "",
    idNumber: emp.idNumber || "",
    hrCode: emp.hrCode || "",
    joinDate: emp.joinDate || emp.contractDate || emp.hireDate || "",
    type: mapType(emp),
    active: !(emp.status === "terminated" || emp.status === "resigned" || emp.status === "frozen"),
    // حقول اختيارية لبصمة (لا تؤثر)
    dob: emp.dob || "",
    nationality: emp.nationality || "",
    gender: emp.gender || "",
    sceNumber: emp.sceNumber || "",
    sceExpiry: emp.sceExpiry || "",
  };
}

// CORS — السماح لبصمة
function setCors(req, res) {
  const origin = req.headers?.origin || "";
  const allowed = !origin || origin.includes("hma.engineer") || origin.endsWith(".vercel.app");
  res.setHeader("Access-Control-Allow-Origin", allowed ? (origin || "*") : "https://b.hma.engineer");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-basma-token");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // حماية بـ token مشترك — اختياري حاليًا للتجربة
  const token = req.headers["x-basma-token"] || req.query.token;
  const requiredToken = process.env.BASMA_SYNC_TOKEN;
  if (requiredToken && token !== requiredToken) {
    return res.status(401).json({ error: "unauthorized — invalid or missing x-basma-token" });
  }

  try {
    const redis = getRedis();
    const action = req.query.action || "employees";

    // ══ register-admin — إنشاء سجل موظف للمدير العام وربطه بحساب admin ══
    // POST /api/basma-sync?action=register-admin
    // Body: { fullName, idNumber, ... }
    if (action === "register-admin") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

      const body = req.body || {};
      const idNumber = body.idNumber;
      if (!idNumber) return res.status(400).json({ error: "idNumber required" });

      // تحقق من وجود حساب admin
      const userIdx = JSON.parse((await redis("GET", "users:idx")) || "[]");
      let adminUserId = null;
      let adminUser = null;
      for (const id of userIdx) {
        const raw = await redis("GET", "user:" + id);
        if (!raw) continue;
        const u = JSON.parse(raw);
        if (u.username === "admin") { adminUserId = id; adminUser = u; break; }
      }
      if (!adminUser) return res.status(404).json({ error: "admin user not found — login to create it first" });

      // تحقق من عدم وجود موظف مسبقاً بنفس idNumber
      const eIdx = JSON.parse((await redis("GET", "e:idx")) || "[]");
      let existingEmp = null;
      for (const id of eIdx) {
        const raw = await redis("GET", "e:" + id);
        if (!raw) continue;
        const e = JSON.parse(raw);
        if (e.idNumber === idNumber || e.uid === idNumber) { existingEmp = e; break; }
      }

      const now = new Date().toISOString();
      const empRecord = {
        uid: idNumber, // رقم الهوية كمعرّف ثابت
        idNumber: idNumber,
        fullName: body.fullName || "هاني محمد عسيري",
        fullNameEn: body.fullNameEn || "",
        email: body.email || "",
        phone: body.phone || "",
        dob: body.dob || "",
        placeOfBirth: body.placeOfBirth || "",
        nationality: body.nationality || "سعودي",
        gender: body.gender || "ذكر",
        jobTitle: body.jobTitle || "المدير العام",
        department: body.department || "الإدارة العليا",
        branch: body.branch || "jed",
        city: body.city || "جدة",
        employeeType: body.employeeType || "office",
        status: "active",
        joinDate: body.joinDate || now.split("T")[0],
        // SCE (عضوية الهيئة)
        sceNumber: body.sceNumber || "",
        sceClassification: body.sceClassification || "",
        sceSpecialization: body.sceSpecialization || "",
        sceExpiry: body.sceExpiry || "",
        sceStatus: "active",
        // التعليم
        education: body.education || "",
        university: body.university || "",
        graduationYear: body.graduationYear || "",
        major: body.major || "",
        // حقول إضافية
        hrCode: body.hrCode || "EMP-0001",
        isDirector: true,
        createdAt: now,
        updatedAt: now,
        createdBy: "system_register_admin",
        ...(existingEmp || {}), // احتفظ بأي بيانات موجودة
        // override المهم
        uid: idNumber,
        idNumber: idNumber,
        fullName: body.fullName || (existingEmp ? existingEmp.fullName : "هاني محمد عسيري"),
        updatedAt: now,
      };

      // احفظ الموظف
      await redis("SET", "e:" + idNumber, JSON.stringify(empRecord));
      if (!eIdx.includes(idNumber)) {
        eIdx.push(idNumber);
        await redis("SET", "e:idx", JSON.stringify(eIdx));
      }

      // اربط حساب admin بهذا الموظف
      const updatedAdminUser = {
        ...adminUser,
        linkedId: idNumber,
        email: body.email || adminUser.email || "",
        displayName: body.fullName || adminUser.displayName || "المشرف الرئيسي",
        updatedAt: now,
      };
      await redis("SET", "user:" + adminUserId, JSON.stringify(updatedAdminUser));

      return res.json({
        ok: true,
        message: existingEmp ? "تم تحديث سجل الموظف وربطه بحساب admin" : "تم إنشاء سجل الموظف وربطه بحساب admin",
        employee: exportEmployee(empRecord),
        linkedUser: { username: "admin", linkedId: idNumber },
      });
    }

    // ══ employees — قائمة كل الموظفين ══
    if (action === "employees") {
      const idx = JSON.parse((await redis("GET", "e:idx")) || "[]");
      if (!idx.length) return res.json({ employees: [], total: 0, syncDate: new Date().toISOString() });

      const emps = await Promise.all(
        idx.map(id => redis("GET", "e:" + id).then(v => {
          if (!v) return null;
          try { return JSON.parse(v); } catch { return null; }
        }))
      );

      // جلب كل حسابات users لربطها بالموظفين
      const userIdx = JSON.parse((await redis("GET", "users:idx")) || "[]");
      const users = await Promise.all(
        userIdx.map(id => redis("GET", "user:" + id).then(v => {
          if (!v) return null;
          try { return JSON.parse(v); } catch { return null; }
        }))
      );
      const userByLinkedId = {};
      const userByEmail = {};
      users.filter(Boolean).forEach(u => {
        if (u.linkedId) userByLinkedId[String(u.linkedId).toLowerCase()] = u;
        if (u.email) userByEmail[String(u.email).toLowerCase()] = u;
      });

      const exported = emps.filter(Boolean).map(emp => {
        const base = exportEmployee(emp);
        // ابحث عن حساب user المرتبط بالموظف
        const linkedUser =
          userByLinkedId[String(emp.uid || "").toLowerCase()] ||
          userByLinkedId[String(emp.idNumber || "").toLowerCase()] ||
          userByEmail[String(emp.email || "").toLowerCase()];
        if (linkedUser) {
          base.username = linkedUser.username || "";
          base.passwordHash = linkedUser.passwordHash || "";
          base.passwordAlgo = "SHA-256";
          base.passwordSalt = "hr_salt_2024";
          base.passwordUpdatedAt = linkedUser.lastPasswordChange || linkedUser.updatedAt || linkedUser.createdAt || "";
          base.hasAccount = !!linkedUser.passwordHash;
          base.accountRole = linkedUser.role || "";
        } else {
          base.hasAccount = false;
        }
        return base;
      });

      return res.json({
        employees: exported,
        total: exported.length,
        authInfo: {
          algo: "SHA-256",
          salt: "hr_salt_2024",
          note: "To verify: hash = SHA256(password + salt), compare with passwordHash",
        },
        syncDate: new Date().toISOString(),
        source: "kadwar",
      });
    }

    // ══ employee — موظف واحد بالـ uid أو idNumber ══
    if (action === "employee") {
      const uid = req.query.uid || req.query.id;
      if (!uid) return res.status(400).json({ error: "uid or id required" });

      // جرّب uid مباشرة
      let empRaw = await redis("GET", "e:" + uid);
      let emp = empRaw ? JSON.parse(empRaw) : null;

      // لو ما وجدنا، ابحث في الفهرس بـ idNumber
      if (!emp) {
        const idx = JSON.parse((await redis("GET", "e:idx")) || "[]");
        for (const id of idx) {
          const raw = await redis("GET", "e:" + id);
          if (!raw) continue;
          const e = JSON.parse(raw);
          if (e.idNumber === uid || e.email === uid || e.uid === uid) {
            emp = e;
            break;
          }
        }
      }

      if (!emp) return res.status(404).json({ error: "employee not found" });

      // ابحث عن حساب user المرتبط
      const userIdx = JSON.parse((await redis("GET", "users:idx")) || "[]");
      let linkedUser = null;
      for (const id of userIdx) {
        const raw = await redis("GET", "user:" + id);
        if (!raw) continue;
        const u = JSON.parse(raw);
        if (
          (u.linkedId && String(u.linkedId).toLowerCase() === String(emp.uid || "").toLowerCase()) ||
          (u.linkedId && String(u.linkedId).toLowerCase() === String(emp.idNumber || "").toLowerCase()) ||
          (u.email && String(u.email).toLowerCase() === String(emp.email || "").toLowerCase())
        ) {
          linkedUser = u;
          break;
        }
      }

      const result = exportEmployee(emp);
      if (linkedUser) {
        result.username = linkedUser.username || "";
        result.passwordHash = linkedUser.passwordHash || "";
        result.passwordAlgo = "SHA-256";
        result.passwordSalt = "hr_salt_2024";
        result.passwordUpdatedAt = linkedUser.lastPasswordChange || linkedUser.updatedAt || linkedUser.createdAt || "";
        result.hasAccount = !!linkedUser.passwordHash;
        result.accountRole = linkedUser.role || "";
      } else {
        result.hasAccount = false;
      }
      return res.json(result);
    }

    // ══ structure — الهيكل التنظيمي (المديرون والمشرفون) ══
    if (action === "structure") {
      const userIdx = JSON.parse((await redis("GET", "users:idx")) || "[]");
      const users = await Promise.all(
        userIdx.map(id => redis("GET", "user:" + id).then(v => {
          if (!v) return null;
          try { return JSON.parse(v); } catch { return null; }
        }))
      );

      const managers = users
        .filter(u => u && ["admin", "hr_manager", "supervisor", "assistant_supervisor"].includes(u.role))
        .map(u => ({
          id: u.linkedId || u.username,
          username: u.username,
          name: u.displayName || u.username,
          role: u.role,
          email: u.email || "",
          linkedId: u.linkedId || "",
        }));

      return res.json({ managers, total: managers.length, syncDate: new Date().toISOString() });
    }

    // ══ branches — الفروع ══
    if (action === "branches") {
      // الفروع الافتراضية (يمكن لاحقاً جلبها من DB)
      const branches = [
        { id: "jed", name: "جدة", tz: "Asia/Riyadh" },
        { id: "riy", name: "الرياض", tz: "Asia/Riyadh" },
        { id: "ist", name: "اسطنبول", tz: "Europe/Istanbul" },
        { id: "gaz", name: "غازي عنتاب", tz: "Europe/Istanbul" },
      ];
      return res.json({ branches, total: branches.length, syncDate: new Date().toISOString() });
    }

    // ══ ping — فحص الاتصال ══
    if (action === "ping") {
      return res.json({
        ok: true,
        service: "kadwar-basma-sync",
        version: "1.0",
        time: new Date().toISOString(),
      });
    }

    return res.status(400).json({ error: "unknown action. Available: employees, employee, structure, branches, ping" });
  } catch (e) {
    console.error("basma-sync error:", e);
    return res.status(500).json({ error: e.message });
  }
}
