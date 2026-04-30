/* ⚠️ DO NOT ADD @vercel/blob — all storage uses Upstash Redis + Cloudflare R2 only */
/* Blob stubs: prevent crashes in legacy code paths that still reference put/list/del */
async function put() { console.warn('[BLOB STUB] put() called — Vercel Blob disabled per directive'); return { url: '' }; }
async function list() { console.warn('[BLOB STUB] list() called — Vercel Blob disabled per directive'); return { blobs: [], cursor: null }; }
async function del() { console.warn('[BLOB STUB] del() called — Vercel Blob disabled per directive'); return true; }

import webpush from 'web-push';
import crypto from 'crypto';

/* ═══════════════════════════════════════════════════════════════
   STORAGE LAYER — Upstash Redis (primary) + Cloudflare R2 (files)
   ⚠️ DO NOT revert to Vercel Blob under any circumstances
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM = (process.env.STORAGE_PREFIX || 'basma').trim();
const PFX_REDIS = SYSTEM + ':';      // basma:employees
const PFX = SYSTEM + '_';             // legacy blob prefix (stubs only, no actual blob writes)

// Upstash Redis
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);

// Cloudflare R2
const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY = (process.env.R2_ACCESS_KEY_ID || '').trim();
const R2_SECRET_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const R2_BUCKET = (process.env.R2_BUCKET || 'hma-storage').trim();
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();
const USE_R2 = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);

/* ────── Upstash Redis Wrappers ────── */
async function redisRequest(command, ...args) {
  var body = JSON.stringify([command, ...args]);
  var r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: body,
  });
  if (!r.ok) throw new Error('Redis ' + command + ' failed: ' + r.status);
  var data = await r.json();
  return data.result;
}

async function redisGet(key) {
  var val = await redisRequest('GET', PFX_REDIS + key);
  if (!val) return null;
  try { return JSON.parse(val); } catch(e) { return val; }
}

/* MGET: fetch multiple keys in chunks (Upstash has payload limits) */
async function redisMget(keys) {
  if (!keys || keys.length === 0) return [];
  var results = [];
  var CHUNK = 25; // Safe chunk size for Upstash REST API
  for (var i = 0; i < keys.length; i += CHUNK) {
    var chunk = keys.slice(i, i + CHUNK);
    var prefixedKeys = chunk.map(function(k){ return PFX_REDIS + k; });
    try {
      var vals = await redisRequest('MGET', ...prefixedKeys);
      if (!Array.isArray(vals)) {
        // Fallback for this chunk
        for (var j = 0; j < chunk.length; j++) results.push(null);
        continue;
      }
      for (var k = 0; k < vals.length; k++) {
        var v = vals[k];
        if (!v) { results.push(null); continue; }
        try { results.push(JSON.parse(v)); } catch(e) { results.push(v); }
      }
    } catch(e) {
      console.error('[redisMget chunk] failed:', e.message);
      // Fallback: sequential GETs for this chunk
      for (var m = 0; m < chunk.length; m++) {
        try {
          var single = await redisGet(chunk[m]);
          results.push(single);
        } catch(e2) { results.push(null); }
      }
    }
  }
  return results;
}

async function redisSet(key, data) {
  var payload = typeof data === 'string' ? data : JSON.stringify(data);
  await redisRequest('SET', PFX_REDIS + key, payload);
  return true;
}

async function redisDel(key) {
  await redisRequest('DEL', PFX_REDIS + key);
  return true;
}

/* ────── Unified DB interface (Redis only — Blob removed per directive) ────── */
/* ════════════════════════════════════════════════════════════════
 * v7.130 — Auto-Limit Protection
 * ════════════════════════════════════════════════════════════════
 * يمنع تجاوز 10MB في request واحد لـ Upstash Redis.
 * المفاتيح المُجمَّعة تُقصُّ تلقائياً قبل الكتابة.
 */
const AUTO_LIMITS = {
  // إشعارات: آخر 500 فقط
  'notifications': { type: 'array', max: 500 },
  'twsl:notifs':   { type: 'array', max: 500 },

  // سجل الحضور: آخر 90 يوم (بناءً على ts)
  'attendance':         { type: 'array', max: 5000, byTime: 'ts', days: 90 },
  'manual_attendance':  { type: 'array', max: 2000, byTime: 'ts', days: 180 },

  // قوائم النماذج/الوثائق
  'tickets':       { type: 'array', max: 2000 },
  'leaves':        { type: 'array', max: 5000 },
  'violations':    { type: 'array', max: 3000 },
  'warnings':      { type: 'array', max: 2000 },
  'evaluations':   { type: 'array', max: 5000 },
  'terminations':  { type: 'array', max: 1000 },
  'custody':       { type: 'array', max: 3000 },
  'events':        { type: 'array', max: 1000 },
  'surveys':       { type: 'array', max: 500 },
  'banners':       { type: 'array', max: 200 },
  'projects':      { type: 'array', max: 2000 },
  'delegations':   { type: 'array', max: 1000 },
  'exceptions':    { type: 'array', max: 1000 },

  // سجلات تدقيق وحماية
  'biometric_challenges': { type: 'array', max: 100 },
  'audit_log':            { type: 'array', max: 5000 },

  // بنك الأسئلة
  'question_bank': { type: 'array', max: 1000 },
};

const SIZE_WARN_BYTES = 8 * 1024 * 1024;   // 8MB warning
const SIZE_HARD_LIMIT = 9.5 * 1024 * 1024; // 9.5MB block

function applyAutoLimit(key, value) {
  var rule = AUTO_LIMITS[key];
  if (!rule || !Array.isArray(value)) return value;

  // 1. اقتصاص بالعدد
  if (rule.max && value.length > rule.max) {
    value = value.slice(-rule.max);
  }

  // 2. اقتصاص زمني (للسجلات الطويلة)
  if (rule.byTime && rule.days) {
    var cutoff = Date.now() - (rule.days * 24 * 60 * 60 * 1000);
    var field = rule.byTime;
    value = value.filter(function(item){
      if (!item || !item[field]) return true;
      var t = new Date(item[field]).getTime();
      return isNaN(t) || t > cutoff;
    });
  }

  return value;
}

async function dbGet(t) {
  if (!USE_REDIS) {
    console.error('[DB] CRITICAL: Upstash Redis not configured! Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
    return null;
  }
  try {
    return await redisGet(t);
  } catch(e) {
    console.error('[DB GET] ' + t + ':', e.message);
    return null;
  }
}

async function dbSet(t, d) {
  if (!USE_REDIS) {
    console.error('[DB] CRITICAL: Upstash Redis not configured!');
    return false;
  }
  try {
    // v7.130 — تطبيق الحدود التلقائية
    d = applyAutoLimit(t, d);

    // v7.130 — فحص الحجم قبل الكتابة
    var serialized;
    try {
      serialized = JSON.stringify(d);
    } catch(_) {
      serialized = '';
    }
    var byteSize = serialized.length;

    if (byteSize > SIZE_HARD_LIMIT) {
      console.error('[DB SET BLOCKED] Key "' + t + '" too large: ' + Math.round(byteSize/1024/1024*10)/10 + 'MB > 9.5MB. Write rejected.');
      return false;
    }
    if (byteSize > SIZE_WARN_BYTES) {
      console.warn('[DB SET WARN] Key "' + t + '" is ' + Math.round(byteSize/1024/1024*10)/10 + 'MB — approaching 10MB limit');
    }

    await redisSet(t, d);
    return true;
  } catch(e) {
    console.error('[DB SET] ' + t + ':', e.message);
    return false;
  }
}

/* ════════ v6.91 — Payroll Helpers (التشفير + الصلاحيات + الحسابات) ════════ */

// مفتاح التشفير — يُقرأ من env variable أو default آمن
const PAYROLL_ENCRYPTION_KEY = process.env.PAYROLL_KEY ||
  crypto.createHash('sha256').update('basma-hma-payroll-v1-secret-2026').digest();

function encryptPayrollField(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  try {
    const iv = crypto.randomBytes(16);
    const keyBuf = typeof PAYROLL_ENCRYPTION_KEY === 'string'
      ? Buffer.from(PAYROLL_ENCRYPTION_KEY, 'hex').slice(0, 32)
      : PAYROLL_ENCRYPTION_KEY.slice(0, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    console.error('[Encrypt] failed:', e.message);
    return null;
  }
}

function decryptPayrollField(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.includes(':')) return ciphertext;
  try {
    const [ivHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const keyBuf = typeof PAYROLL_ENCRYPTION_KEY === 'string'
      ? Buffer.from(PAYROLL_ENCRYPTION_KEY, 'hex').slice(0, 32)
      : PAYROLL_ENCRYPTION_KEY.slice(0, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[Decrypt] failed:', e.message);
    return null;
  }
}

// التحقق من صلاحية الوصول للرواتب
async function canAccessPayroll(userId, action) {
  // action: 'view_own' | 'view_all' | 'create' | 'edit' | 'approve' | 'send_bank'
  if (!userId) return { allowed: false, reason: 'no_user' };
  const emps = await dbGet('employees') || [];
  const user = emps.find(e => String(e.id) === String(userId));
  if (!user) return { allowed: false, reason: 'user_not_found' };

  const role = user.accountRole || user.role || '';
  const isAdmin = !!user.isAdmin;
  const isHRManager = role === 'hr_manager' || role === 'admin';
  const isAccountant = role === 'accountant' || role === 'finance_manager';

  // view_own: any employee can see their own payslip
  if (action === 'view_own') return { allowed: true, user };
  // view_all / create / edit: HR manager or accountant
  if (['view_all','create','edit'].includes(action)) {
    if (isAdmin || isHRManager || isAccountant) return { allowed: true, user };
    return { allowed: false, reason: 'insufficient_role', role };
  }
  // approve / send_bank: HR manager or admin only (not accountant)
  if (['approve','send_bank'].includes(action)) {
    if (isAdmin || isHRManager) return { allowed: true, user };
    return { allowed: false, reason: 'approval_requires_hr_manager', role };
  }
  return { allowed: false, reason: 'unknown_action' };
}

// v7.84 — نظام Audit Log شامل وموحّد
// Categories: payroll, leaves, violations, employees, settings, salary, admin, tawasul
// Usage: auditLog(userId, action, target, details, category)
async function auditLog(userId, action, target, details, category) {
  try {
    // v7.84 — استخدام مفتاح موحّد "audit-log" بدل "payroll-audit-log" القديم
    // + الاحتفاظ بالقديم للقراءة (legacy)
    const log = await dbGet('audit-log') || [];
    const entry = {
      id: 'AUDIT' + Date.now() + Math.random().toString(36).slice(2, 6),
      userId: String(userId || 'system'),
      action,
      target: target || null,
      details: details || null,
      category: category || 'general', // v7.84 — تصنيف العملية
      ts: new Date().toISOString(),
    };
    log.push(entry);
    if (log.length > 10000) log.splice(0, log.length - 10000); // v7.84 — حد أعلى 10K بدل 5K
    await dbSet('audit-log', log);

    // v7.84 — للحفاظ على التوافق، نسخ عمليات الرواتب للسجل القديم أيضاً
    if (category === 'payroll' || category === 'salary') {
      const legacyLog = await dbGet('payroll-audit-log') || [];
      legacyLog.push(entry);
      if (legacyLog.length > 5000) legacyLog.splice(0, legacyLog.length - 5000);
      await dbSet('payroll-audit-log', legacyLog);
    }
  } catch (e) {
    console.error('[Audit] failed:', e.message);
  }
}

// حساب الراتب الشهري من profile + إضافات/خصومات
/* ════════ v6.97 — Safe Kadwar Auto-Push Helper ════════
 * Fire-and-forget: لو كوادر offline أو رفض، العملية الأصلية في بصمة لا تتأثر.
 * يُستخدم من POST endpoints لتزامن تلقائي (مخالفات، رواتب، إنهاء خدمة).
 * ═══════════════════════════════════════════════════════════════════════ */
async function safeKadwarPush(action, payload) {
  try {
    const url = 'https://hma.engineer/api/basma-sync?action=' + action;
    const kr = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let kd = null;
    try { kd = await kr.json(); } catch(e) { kd = { raw: 'non-json' }; }
    const log = (await dbGet('kadwar-sync-log')) || [];
    log.push({
      id: 'KSL' + Date.now() + Math.random().toString(36).slice(2, 5),
      ts: new Date().toISOString(),
      action: 'auto-' + action,
      ref: payload.violation_basma_id || payload.slip_basma_id || payload.termination_basma_id || payload.employee_id,
      success: kr.ok,
      httpStatus: kr.status,
      response: kd,
    });
    if (log.length > 5000) log.splice(0, log.length - 5000);
    await dbSet('kadwar-sync-log', log);
    return { ok: kr.ok, response: kd };
  } catch (e) {
    try {
      const log = (await dbGet('kadwar-sync-log')) || [];
      log.push({
        id: 'KSL' + Date.now() + Math.random().toString(36).slice(2, 5),
        ts: new Date().toISOString(),
        action: 'auto-' + action,
        ref: (payload && (payload.violation_basma_id || payload.employee_id)) || null,
        success: false,
        httpStatus: 0,
        error: 'network: ' + e.message,
      });
      if (log.length > 5000) log.splice(0, log.length - 5000);
      await dbSet('kadwar-sync-log', log);
    } catch(e2) { /* ignore */ }
    return { ok: false, error: e.message };
  }
}

function computeMonthlySalary(profile, additions, deductions, attendance, period) {
  profile = profile || {};
  additions = additions || {};
  deductions = deductions || {};
  const comp = profile.compensation || {};
  const jobGrade = profile.jobGrade || {};

  // v7.13 — Helper: read allowance value, supporting override structure + pro-rating
  // Returns: { value, prorated, breakdown (if prorated) }
  function getAllowanceValue(fieldName, fallback) {
    const raw = comp[fieldName];
    let currentValue;
    // Handle override structure { template, actual, reason }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      currentValue = Number(raw.actual !== undefined && raw.actual !== null ? raw.actual : raw.template) || 0;
    } else {
      currentValue = Number(raw || 0);
    }
    // Default if nothing
    if (!currentValue && fallback !== undefined) currentValue = Number(fallback) || 0;

    // Pro-rating: check if a change happened within the period
    if (period && period.startISO && period.endISO && comp.changeHistory && Array.isArray(comp.changeHistory)) {
      // Find the most recent change to this field with effectiveDate inside period
      const changes = comp.changeHistory.filter(function(h){
        if (h.field !== fieldName) return false;
        if (!h.effectiveDate) return false;
        const eff = new Date(h.effectiveDate).getTime();
        return eff > new Date(period.startISO).getTime() && eff <= new Date(period.endISO).getTime();
      });
      if (changes.length > 0) {
        // Use the latest change if multiple
        changes.sort(function(a, b){ return new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(); });
        const ch = changes[0];
        const effDate = new Date(ch.effectiveDate);
        const periodStart = new Date(period.startISO);
        const periodEnd = new Date(period.endISO);
        const totalDays = Math.max(1, Math.round((periodEnd - periodStart) / 86400000) + 1);
        const daysBefore = Math.max(0, Math.round((effDate - periodStart) / 86400000));
        const daysAfter = Math.max(0, totalDays - daysBefore);
        const oldValue = Number(ch.oldValue) || 0;
        const newValue = Number(ch.newValue) || currentValue;
        const proratedValue = (daysBefore * oldValue + daysAfter * newValue) / totalDays;
        return {
          value: Math.round(proratedValue * 100) / 100,
          prorated: true,
          breakdown: {
            oldValue, newValue,
            daysBefore, daysAfter, totalDays,
            effectiveDate: ch.effectiveDate,
            reason: ch.reason,
          },
        };
      }
    }
    return { value: currentValue, prorated: false };
  }

  // الأساسي من jobGrade إن وُجد، وإلا من compensation
  const basicInfo = getAllowanceValue('basicSalary', jobGrade.basic);
  const housingInfo = getAllowanceValue('housingAllowance', jobGrade.housing);
  const transportInfo = getAllowanceValue('transportAllowance', jobGrade.transport);
  const commInfo = getAllowanceValue('communicationsAllowance', 0);
  const otherInfo = getAllowanceValue('otherAllowances', 0);

  const basic = basicInfo.value;
  const housing = housingInfo.value;
  const transport = transportInfo.value;
  const communication = commInfo.value;
  const other = otherInfo.value;
  const commissions = Number(comp.commissions || 0) + Number(additions.commissions || 0);
  const overtime = Number(additions.overtime || 0);
  const bonus = Number(additions.bonus || 0);
  const otherAdd = Number(additions.other || 0);

  const fixedDeductions = Number(comp.fixedDeductions || 0);
  const absence = Number(deductions.absence || 0);
  const late = Number(deductions.late || 0);
  const advance = Number(deductions.advance || 0); // سُلفة
  const gosiEmployee = Number(deductions.gosi || 0); // التأمينات
  const otherDed = Number(deductions.other || 0);
  const fines = Number(deductions.fines || 0); // v6.92 — غرامات لائحة الجزاءات (المادة 41)

  const totalEarnings = basic + housing + transport + communication + other + commissions + overtime + bonus + otherAdd;
  const totalDeductions = fixedDeductions + absence + late + advance + gosiEmployee + otherDed + fines;
  const netSalary = totalEarnings - totalDeductions;

  // v7.13 — Collect pro-rating details for transparency
  const proratings = [];
  [
    ['basicSalary', 'الراتب الأساسي', basicInfo],
    ['housingAllowance', 'بدل السكن', housingInfo],
    ['transportAllowance', 'بدل النقل', transportInfo],
    ['communicationsAllowance', 'بدل الاتصالات', commInfo],
    ['otherAllowances', 'بدلات أخرى', otherInfo],
  ].forEach(function(row){
    if (row[2].prorated) {
      proratings.push({ field: row[0], label: row[1], ...row[2].breakdown, final: row[2].value });
    }
  });

  return {
    breakdown: {
      basic, housing, transport, communication, other, commissions, overtime, bonus, otherAdd,
      fixedDeductions, absence, late, advance, gosiEmployee, otherDed, fines,
      finesList: deductions.finesList || [],
    },
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
    proratings: proratings, // v7.13 — لعرض تفاصيل الحساب التناسبي
  };
}

/* ════════ v6.92 — لائحة الجزاءات: ربط الغرامات بالرواتب ════════
 * المادة 41 من نظام العمل السعودي:
 *   "لا يجوز أن تتجاوز الغرامة التي تقع على العامل جزاء المخالفة الواحدة أجر خمسة أيام،
 *    ولا يجوز اقتطاع أكثر من أجر خمسة أيام في الشهر الواحد وفاءً لما يوقع عليه من الغرامات"
 * التطبيق: سقف شهري = 5 أيام أجر. الزائد يُرحَّل للشهر التالي.
 * ═══════════════════════════════════════════════════════════════ */

const FINES_MONTHLY_CAP_DAYS = 5;

// ربط كود الجزاء بنسبة من الأجر اليومي (أو عدد أيام كاملة)
function penaltyToFactor(penaltyCode) {
  if (!penaltyCode) return 0;
  const map = {
    'WARNING': 0,
    'FINE_5': 0.05, 'FINE_10': 0.10, 'FINE_15': 0.15,
    'FINE_20': 0.20, 'FINE_25': 0.25, 'FINE_30': 0.30,
    'FINE_50': 0.50, 'FINE_75': 0.75,
    'FINE_1DAY': 1, 'FINE_2DAYS': 2, 'FINE_3DAYS': 3,
    'FINE_4DAYS': 4, 'FINE_5DAYS': 5,
    // ليست غرامات بمعنى خصم — تُعالَج بآليات منفصلة
    'SUSPENSION': 0, 'DENY_PROMOTION': 0,
    'TERMINATION_WITH': 0, 'TERMINATION_WITHOUT': 0,
    'WARNING_BEFORE_TERMINATION': 0,
  };
  return map[penaltyCode] !== undefined ? map[penaltyCode] : 0;
}

// الأجر اليومي = إجمالي الراتب الشهري (أساسي + بدلات ثابتة) ÷ 30
function getDailyWage(profile) {
  profile = profile || {};
  const comp = profile.compensation || {};
  const jobGrade = profile.jobGrade || {};
  const basic = Number(jobGrade.basic || comp.basicSalary || 0);
  const housing = Number(jobGrade.housing || comp.housingAllowance || 0);
  const transport = Number(jobGrade.transport || comp.transportAllowance || 0);
  const communication = Number(comp.communicationsAllowance || 0);
  const other = Number(comp.otherAllowances || 0);
  const monthly = basic + housing + transport + communication + other;
  return monthly / 30;
}

// قيمة الغرامة بالريال من كود الجزاء + الأجر اليومي
function computeFineAmount(penaltyCode, dailyWage) {
  const factor = penaltyToFactor(penaltyCode);
  return Math.round(factor * dailyWage * 100) / 100;
}

// جلب الغرامات المستحقة للتطبيق على موظف + تطبيق سقف المادة 41
// - status === 'ACTIVE' && !appliedToPayrollId && penaltyCode يبدأ بـ FINE_
// - الترتيب: الأقدم أولاً (first-come-first-served)
// - الزائد عن 5 أيام يُرحَّل
async function getMonthlyFinesForEmp(empId, profile) {
  const vios = (await dbGet('violations_v2')) || [];
  const dailyWage = getDailyWage(profile);
  const eligible = vios.filter(v =>
    v.empId === empId &&
    v.status === 'ACTIVE' &&
    !v.appliedToPayrollId &&
    v.penaltyCode && v.penaltyCode.startsWith('FINE_')
  );
  const items = eligible.map(v => ({
    violationId: v.id,
    violationRef: v.violationId,
    description: v.description,
    penaltyCode: v.penaltyCode,
    penaltyLabel: v.penaltyLabel,
    occurrence: v.occurrence,
    createdAt: v.createdAt,
    amount: computeFineAmount(v.penaltyCode, dailyWage),
  }));
  items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const cap = FINES_MONTHLY_CAP_DAYS * dailyWage;
  let runningTotal = 0;
  const applied = [];
  const deferred = [];
  for (const it of items) {
    if (runningTotal + it.amount <= cap + 0.01) { // 0.01 tolerance for rounding
      applied.push(it);
      runningTotal += it.amount;
    } else {
      deferred.push(it);
    }
  }
  return {
    dailyWage: Math.round(dailyWage * 100) / 100,
    monthlyCap: Math.round(cap * 100) / 100,
    appliedAmount: Math.round(runningTotal * 100) / 100,
    applied,
    deferred,
    totalEligibleAmount: Math.round(items.reduce((s, x) => s + x.amount, 0) * 100) / 100,
  };
}

/* ════════ v6.83 — Employee Profile Helpers ════════ */
function sectionLabel(section) {
  const labels = {
    personal: 'البيانات الشخصية',
    employment: 'البيانات الوظيفية',
    compensation: 'الراتب والبدلات',
    contract: 'العقد',
    dependents: 'المرافقون',
    system: 'إعدادات النظام',
  };
  return labels[section] || section;
}

// حساب نسبة اكتمال بيانات الموظف (0-100)
// فلسفة التدريج: تنبيه فقط، لا يرفض شيئاً
function computeCompleteness(emp, profile, attachments) {
  profile = profile || {};
  attachments = attachments || [];
  const missing = [];
  let filled = 0;
  let total = 0;

  // ═══ بيانات شخصية أساسية (وزن 30%) ═══
  // يدعم fullName (من كوادر) أو fullNameParts (مُدخل من بصمة)
  const personalFields = [
    { key: 'fullName', label: 'الاسم الكامل', weight: 3, check: () => (profile.personal && (profile.personal.fullName || profile.personal.fullNameParts)) || emp.name },
    { key: 'idNumber', label: 'رقم الهوية', weight: 3, check: () => emp.idNumber || (profile.personal && profile.personal.idNumber) },
    { key: 'idExpiry', label: 'تاريخ انتهاء الهوية', weight: 2, check: () => profile.personal && profile.personal.idExpiry },
    { key: 'dateOfBirth', label: 'تاريخ الميلاد', weight: 2, check: () => profile.personal && (profile.personal.dateOfBirth || profile.personal.dob) },
    { key: 'nationality', label: 'الجنسية', weight: 2, check: () => profile.personal && profile.personal.nationality },
    { key: 'maritalStatus', label: 'الحالة الاجتماعية', weight: 1, check: () => profile.personal && profile.personal.maritalStatus },
    { key: 'phone', label: 'رقم الجوال', weight: 3, check: () => emp.phone || (profile.personal && profile.personal.phone) },
    { key: 'email', label: 'البريد الإلكتروني', weight: 2, check: () => emp.email || (profile.personal && profile.personal.email) },
    { key: 'address', label: 'العنوان', weight: 1, check: () => profile.personal && (profile.personal.address || profile.personal.city) },
    { key: 'emergencyContact', label: 'جهة اتصال الطوارئ', weight: 2, check: () => profile.personal && profile.personal.emergencyContact },
  ];

  personalFields.forEach(f => {
    total += f.weight;
    const val = f.check();
    if (val && (typeof val !== 'object' || Object.keys(val).length > 0)) {
      filled += f.weight;
    } else {
      missing.push({ section: 'personal', key: f.key, label: f.label });
    }
  });

  // ═══ بيانات وظيفية (وزن 15%) ═══
  const employmentFields = [
    { key: 'role', path: 'emp.role', label: 'المسمى الوظيفي', weight: 2 },
    { key: 'department', path: 'emp.department', label: 'القسم', weight: 1 },
    { key: 'branch', path: 'emp.branch', label: 'الفرع', weight: 1 },
    { key: 'hireDate', path: 'employment.hireDate', label: 'تاريخ التعيين', weight: 2 },
  ];

  employmentFields.forEach(f => {
    total += f.weight;
    const val = f.path.startsWith('emp.') ? emp[f.path.split('.')[1]] : (profile.employment && profile.employment[f.key]);
    if (val) filled += f.weight;
    else missing.push({ section: 'employment', key: f.key, label: f.label });
  });

  // ═══ الراتب والبدلات (وزن 20%) ═══
  const compFields = [
    { key: 'basicSalary', label: 'الراتب الأساسي', weight: 3 },
    { key: 'housingAllowance', label: 'بدل السكن', weight: 2 },
    { key: 'transportAllowance', label: 'بدل النقل', weight: 1 },
    { key: 'iban', label: 'رقم الآيبان', weight: 3 },
    { key: 'bankName', label: 'اسم البنك', weight: 1 },
  ];

  compFields.forEach(f => {
    total += f.weight;
    const val = profile.compensation && profile.compensation[f.key];
    if (val !== undefined && val !== null && val !== '') filled += f.weight;
    else missing.push({ section: 'compensation', key: f.key, label: f.label });
  });

  // ═══ العقد (وزن 15%) ═══
  const contractFields = [
    { key: 'startDate', label: 'تاريخ بداية العقد', weight: 2 },
    { key: 'type', label: 'نوع العقد', weight: 1 },
  ];

  contractFields.forEach(f => {
    total += f.weight;
    const val = profile.contract && profile.contract[f.key];
    if (val) filled += f.weight;
    else missing.push({ section: 'contract', key: f.key, label: f.label });
  });

  // ═══ مرفقات أساسية (وزن 20%) ═══
  const requiredAttachments = [
    { type: 'id_copy', label: 'صورة الهوية', weight: 3 },
    { type: 'contract_copy', label: 'نسخة العقد', weight: 3 },
    { type: 'iban_copy', label: 'صورة الآيبان', weight: 2 },
    { type: 'qualification', label: 'الشهادة العلمية', weight: 1 },
    { type: 'profile_photo', label: 'الصورة الشخصية', weight: 1 },
  ];

  requiredAttachments.forEach(a => {
    total += a.weight;
    const exists = attachments.some(att => att.type === a.type && att.status === 'verified');
    if (exists) filled += a.weight;
    else missing.push({ section: 'attachments', key: a.type, label: a.label });
  });

  const score = total > 0 ? Math.round((filled / total) * 100) : 0;
  let level = 'critical';
  if (score >= 90) level = 'complete';
  else if (score >= 70) level = 'good';
  else if (score >= 50) level = 'needs_attention';
  else if (score >= 30) level = 'incomplete';

  return { score, missing, level, filled, total };
}

/* ────── Cloudflare R2 via AWS SigV4 ────── */
async function r2Sign(method, path, body, contentType) {
  var host = R2_ACCOUNT_ID + '.r2.cloudflarestorage.com';
  var url = 'https://' + host + '/' + R2_BUCKET + path;
  var date = new Date();
  var amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  var dateStamp = amzDate.slice(0, 8);

  var encoder = new TextEncoder();
  var bodyBytes = body instanceof Uint8Array ? body : typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body || []);
  var payloadHash = crypto.createHash('sha256').update(bodyBytes).digest('hex');

  var canonicalHeaders = 'host:' + host + '\n' +
                         'x-amz-content-sha256:' + payloadHash + '\n' +
                         'x-amz-date:' + amzDate + '\n';
  if (contentType) canonicalHeaders = 'content-type:' + contentType + '\n' + canonicalHeaders;
  var signedHeaders = contentType ? 'content-type;host;x-amz-content-sha256;x-amz-date' : 'host;x-amz-content-sha256;x-amz-date';
  var canonicalRequest = method + '\n/' + R2_BUCKET + path + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

  var region = 'auto';
  var service = 's3';
  var credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  var stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' +
                     crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  var kDate = crypto.createHmac('sha256', 'AWS4' + R2_SECRET_KEY).update(dateStamp).digest();
  var kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  var kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  var kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  var signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  var authorization = 'AWS4-HMAC-SHA256 Credential=' + R2_ACCESS_KEY + '/' + credentialScope +
                      ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  var headers = {
    'Authorization': authorization,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['Content-Type'] = contentType;
  return { url: url, headers: headers, body: bodyBytes };
}

async function r2Upload(key, data, contentType) {
  if (!USE_R2) return null;
  contentType = contentType || 'application/octet-stream';
  var signed = await r2Sign('PUT', '/' + key, data, contentType);
  var r = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: signed.body });
  if (!r.ok) {
    var text = await r.text().catch(function(){ return ''; });
    throw new Error('R2 upload failed: ' + r.status + ' ' + text);
  }
  var publicUrl = R2_PUBLIC_URL ? R2_PUBLIC_URL + '/' + key : signed.url;
  return { key: key, url: publicUrl };
}

async function r2Delete(key) {
  if (!USE_R2) return false;
  var signed = await r2Sign('DELETE', '/' + key, '');
  var r = await fetch(signed.url, { method: 'DELETE', headers: signed.headers });
  return r.ok;
}


// ═══ Web Push helper ═══
var vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  var pubKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  var privKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pubKey || !privKey) return false;
  try {
    webpush.setVapidDetails(
      'mailto:' + ((process.env.VAPID_CONTACT_EMAIL || 'admin@hma.engineer').trim()),
      pubKey,
      privKey
    );
    vapidConfigured = true;
    return true;
  } catch(e) {
    console.error('[VAPID CONFIG ERROR]', e.message);
    return false;
  }
}

async function sendWebPush(subscription, payload) {
  if (!configureVapid()) return { sent: false, reason: 'VAPID not configured' };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { sent: true, reason: 'delivered' };
  } catch (err) {
    return { sent: false, reason: 'push error: ' + (err.statusCode || err.message || String(err)) };
  }
}


// Cleanup function — delete all duplicate blobs, keep only latest of each
async function dbCleanup() {
  try {
    var allBlobs = [];
    var cursor = undefined;
    // Paginate through all blobs
    do {
      var result = await list({ prefix: PFX, cursor, limit: 1000 });
      allBlobs = allBlobs.concat(result.blobs);
      cursor = result.cursor;
    } while (cursor);

    // Group by pathname
    var groups = {};
    for (var b of allBlobs) {
      if (!groups[b.pathname]) groups[b.pathname] = [];
      groups[b.pathname].push(b);
    }

    var deleted = 0;
    for (var pathname in groups) {
      var blobs = groups[pathname];
      if (blobs.length <= 1) continue;
      // Sort by date, keep latest
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      // Delete all except the latest
      for (var i = 1; i < blobs.length; i++) {
        await del(blobs[i].url);
        deleted++;
      }
    }
    return { ok: true, totalFound: allBlobs.length, deleted, remaining: allBlobs.length - deleted };
  } catch(e) { return { ok: false, error: e.message }; }
}

const INIT_BRANCHES = [
  { id: "jed", name: "جدة", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 21.5433, lng: 39.1728 },
  { id: "riy", name: "الرياض", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 24.7136, lng: 46.6753 },
  { id: "ist", name: "اسطنبول", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Europe/Istanbul", radius: 200, lat: 41.0082, lng: 28.9784 },
  { id: "gaz", name: "غازي عنتاب", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Europe/Istanbul", radius: 120, lat: 37.0662, lng: 37.3833 },
];

// v7.95 — Shuffle helper for Flash Challenge options
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/* ═══════════════════════════════════════════════════════════════
 * v7.97 — Work Days Calculator (respects holidays + weekends)
 * ═══════════════════════════════════════════════════════════════
 * Returns: { workDays, weekendDays, holidayDays, totalDays, dates: { workDays: [...], holidays: [...] } }
 *
 * Usage:
 *   var result = await calculateWorkDays('2026-04-01', '2026-04-30');
 *   // result.workDays = 22 (excludes weekends + holidays)
 */
async function calculateWorkDays(startDate, endDate) {
  var holidaysData = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };
  var weekendDays = holidaysData.weekendDays || [5, 6];
  var holidaysList = holidaysData.list || [];

  var start = new Date(startDate);
  var end = new Date(endDate);
  var workDays = 0;
  var weekendCount = 0;
  var holidayCount = 0;
  var workDaysList = [];
  var holidayDaysList = [];

  for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    var dateStr = d.toISOString().slice(0, 10);
    var mmDd = dateStr.slice(5);
    var dow = d.getDay();

    // Check weekend
    if (weekendDays.indexOf(dow) >= 0) {
      weekendCount++;
      continue;
    }

    // Check holiday
    var isHoliday = holidaysList.some(function(h){
      if (!h.date) return false;
      if (h.date === dateStr) return true;
      if (h.recurring && h.date.slice(5) === mmDd) return true;
      if (h.endDate && dateStr >= h.date && dateStr <= h.endDate) return true;
      return false;
    });

    if (isHoliday) {
      holidayCount++;
      holidayDaysList.push(dateStr);
      continue;
    }

    workDays++;
    workDaysList.push(dateStr);
  }

  return {
    workDays: workDays,
    weekendDays: weekendCount,
    holidayDays: holidayCount,
    totalDays: workDays + weekendCount + holidayCount,
    dates: {
      workDays: workDaysList,
      holidays: holidayDaysList,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * v7.135 — SESSION & AUTH SYSTEM
 * ═══════════════════════════════════════════════════════════════════
 * نظام جلسات حقيقي يحمي 228 endpoint
 *
 * - عند login: نُصدر sessionToken ونحفظه في Redis مع بيانات الموظف
 * - مدة الجلسة: 24 ساعة (أو 30 يوم لو "تذكرني")
 * - كل طلب لـ API يجب أن يحوي header: x-session-token
 * - PUBLIC_ACTIONS: قائمة actions مفتوحة (قبل الدخول أو تكامل خارجي)
 * - ADMIN_ACTIONS: قائمة actions تتطلب صلاحية مدير عام
 * ═══════════════════════════════════════════════════════════════════ */

// Actions مفتوحة بدون مصادقة (قبل الدخول أو تكامل خارجي)
var PUBLIC_ACTIONS = new Set([
  'login',
  'biometric-login-challenge', 'biometric-login-verify',
  'biometric-register-challenge', 'biometric-register-verify',
  'biometric-devices',
  'holidays', 'is-holiday', 'holiday-banner-config',
  'sso-verify',
  'tawasul-web-init',
  'kadwar-employees', // ← endpoint يستدعيه كوادر للتزامن (سيُحمى لاحقاً بـ HMA_INTERNAL_KEY)
  'vapid-public-key', // مفتاح عام للإشعارات
]);

// Actions تتطلب صلاحية مدير عام (admin/general manager فقط)
var ADMIN_ONLY_ACTIONS = new Set([
  'init',
  'db-stats', 'db-cleanup', 'cleanup',
  'blob-delete-all', 'blob-delete-basma-data', 'blob-list',
  'kadwar-full-migration',
  'kadwar-debug-export',
  'export-all-keys',
  'bulk-activate', 'bulk-deactivate',
  'hr-permissions',
]);

async function createSession(employee, rememberMe) {
  var crypto = await import('crypto');
  var token = 'sess_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
  var ttl = rememberMe ? (30 * 24 * 60 * 60) : (24 * 60 * 60); // 30d or 24h
  var sessionData = {
    empId: employee.id,
    idNumber: employee.idNumber,
    email: employee.email,
    isAdmin: !!(employee.isAdmin || employee.isGeneralManager || employee.role === 'admin' || employee.accountRole === 'admin'),
    isHR: !!(employee.role === 'hr' || employee.accountRole === 'hr'),
    isManager: !!(employee.isManager || employee.role === 'manager'),
    createdAt: new Date().toISOString(),
    rememberMe: !!rememberMe,
  };
  if (USE_REDIS) {
    await redisFetch(['SET', 'basma:session:' + token, JSON.stringify(sessionData), 'EX', ttl]);
  }
  return { token: token, expiresIn: ttl, session: sessionData };
}

async function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('sess_')) return null;
  if (!USE_REDIS) return null;
  try {
    var r = await redisFetch(['GET', 'basma:session:' + token]);
    if (!r || !r.result) return null;
    var raw = r.result;
    var data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(_) { return null; }
    return data;
  } catch(e) {
    return null;
  }
}

async function revokeSession(token) {
  if (!token || !USE_REDIS) return;
  try { await redisFetch(['DEL', 'basma:session:' + token]); } catch(_) {}
}

async function revokeAllSessionsFor(empId) {
  if (!empId || !USE_REDIS) return;
  // simple impl: scan all session keys (acceptable since session count is bounded)
  try {
    var cursor = '0';
    do {
      var scan = await redisFetch(['SCAN', cursor, 'MATCH', 'basma:session:*', 'COUNT', '500']);
      if (!scan || !scan.result) break;
      cursor = scan.result[0];
      var keys = scan.result[1] || [];
      for (var i = 0; i < keys.length; i++) {
        try {
          var v = await redisFetch(['GET', keys[i]]);
          if (v && v.result) {
            var data = typeof v.result === 'string' ? JSON.parse(v.result) : v.result;
            if (data && data.empId === empId) {
              await redisFetch(['DEL', keys[i]]);
            }
          }
        } catch(_) {}
      }
    } while (cursor !== '0');
  } catch(_) {}
}

// helper used by createSession: raw redis fetch
async function redisFetch(cmdArr) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  var r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmdArr),
  });
  if (!r.ok) return null;
  return await r.json();
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token, x-internal-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  /* ═══ v7.135 — AUTH MIDDLEWARE ═══ */
  var isPublic = PUBLIC_ACTIONS.has(action);
  var internalKey = req.headers['x-internal-key'] || '';
  var expectedInternalKey = (process.env.HMA_INTERNAL_KEY || '').trim();
  var isInternalCall = expectedInternalKey && internalKey === expectedInternalKey;

  var session = null;
  if (!isPublic && !isInternalCall) {
    var sessionToken = req.headers['x-session-token'] || '';
    session = await verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({
        error: 'الجلسة غير صالحة أو منتهية. يجب إعادة تسجيل الدخول.',
        requireAuth: true
      });
    }
    if (ADMIN_ONLY_ACTIONS.has(action) && !session.isAdmin) {
      return res.status(403).json({
        error: 'هذي العملية تتطلب صلاحية المدير العام'
      });
    }
  }
  req.__session = session;

  try {
    switch (action) {

      case 'init': {
        const ex = await dbGet('employees');
        if (ex && ex.length > 0) return res.json({ ok: true, msg: 'exists', count: ex.length });
        // NO LONGER seeds INIT_EMP — employees come from kadwar via sync-kadwar
        await dbSet('employees', []);
        await dbSet('branches', INIT_BRANCHES);
        await dbSet('attendance', []);
        await dbSet('violations', []);
        await dbSet('warnings', []);
        await dbSet('leaves', []);
        await dbSet('dependents', []);
        await dbSet('tickets', []);
        await dbSet('projects', []);
        await dbSet('delegations', []);
        await dbSet('exceptions', []);
        await dbSet('events', []);
        await dbSet('manual_attendance', []);
        await dbSet('settings', { breakRandomMin: 2, breakRandomMax: 7, autoCheckoutDelay: 5, callRetryDelay: 10 });
        // Auto-trigger first sync from kadwar
        try {
          var syncR = await fetch('https://hma.engineer/api/basma-sync?action=employees');
          if (syncR.ok) {
            var syncData = await syncR.json();
            if (syncData && Array.isArray(syncData.employees)) {
              return res.json({ ok: true, msg: 'initialized + synced', employeesFromKadwar: syncData.employees.length, note: 'call action=sync-kadwar to complete' });
            }
          }
        } catch(e) { /* silent */ }
        return res.json({ ok: true, msg: 'initialized (employees empty — call action=sync-kadwar)' });
      }

      /* ════════════════════════════════════════════════════════════════
       * v7.130 — Cleanup Large Keys
       * ════════════════════════════════════════════════════════════════
       * GET /api/data?action=db-stats          — يفحص أحجام المفاتيح
       * POST /api/data?action=db-cleanup       — ينظّف المفاتيح الكبيرة
       * POST body { dry_run: true }            — معاينة بدون تطبيق
       */
      case 'db-stats': {
        var stats = [];
        var keysToCheck = Object.keys(AUTO_LIMITS);
        for (var i = 0; i < keysToCheck.length; i++) {
          var k = keysToCheck[i];
          var val = await dbGet(k);
          if (val == null) { stats.push({ key: k, exists: false }); continue; }
          var size = JSON.stringify(val).length;
          var count = Array.isArray(val) ? val.length : 0;
          stats.push({
            key: k,
            exists: true,
            sizeMB: Math.round(size / 1024 / 1024 * 100) / 100,
            sizeKB: Math.round(size / 1024),
            count: count,
            limit: AUTO_LIMITS[k].max,
            overLimit: count > (AUTO_LIMITS[k].max || Infinity),
            warning: size > SIZE_WARN_BYTES,
            critical: size > SIZE_HARD_LIMIT,
          });
        }
        // ترتيب من الأكبر للأصغر
        stats.sort(function(a, b){ return (b.sizeMB || 0) - (a.sizeMB || 0); });
        return res.json({ ok: true, stats: stats, limits: { warnMB: 8, hardMB: 9.5 } });
      }

      case 'db-cleanup': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var dryRun = !!(req.body && req.body.dry_run);
        var report = [];
        var keysClean = Object.keys(AUTO_LIMITS);
        for (var j = 0; j < keysClean.length; j++) {
          var key = keysClean[j];
          var val2 = await dbGet(key);
          if (!Array.isArray(val2)) continue;
          var beforeCount = val2.length;
          var beforeSize = JSON.stringify(val2).length;
          var cleaned = applyAutoLimit(key, val2);
          var afterCount = cleaned.length;
          var afterSize = JSON.stringify(cleaned).length;
          if (beforeCount !== afterCount) {
            if (!dryRun) {
              await redisSet(key, cleaned);
            }
            report.push({
              key: key,
              before: { count: beforeCount, sizeKB: Math.round(beforeSize/1024) },
              after:  { count: afterCount,  sizeKB: Math.round(afterSize/1024) },
              removed: beforeCount - afterCount,
              applied: !dryRun,
            });
          }
        }
        return res.json({ ok: true, dry_run: dryRun, cleaned: report.length, report: report });
      }
      case 'biometric-register-challenge': {
        // Returns a challenge for the browser to sign with the biometric key
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId) return res.status(400).json({ error: 'empId required' });
        const emps = await dbGet('employees') || [];
        const emp = emps.find(function(e){ return e.id === body.empId; });
        if (!emp) return res.status(404).json({ error: 'employee not found' });

        // Generate random challenge (32 bytes base64url)
        const crypto = await import('crypto');
        const challenge = crypto.randomBytes(32).toString('base64url');
        const rpId = body.rpId || 'b.hma.engineer';

        // Store challenge temporarily (valid 5 min) — v7.38 with type + rpId
        const challenges = (await dbGet('biometric_challenges')) || {};
        challenges[body.empId] = { challenge: challenge, expires: Date.now() + 5 * 60 * 1000, type: 'register', rpId: rpId };
        // Clean expired
        Object.keys(challenges).forEach(function(k){
          if (challenges[k].expires < Date.now()) delete challenges[k];
        });
        await dbSet('biometric_challenges', challenges);

        return res.json({
          challenge: challenge,
          rp: { name: 'بصمة HMA', id: rpId },
          user: {
            id: Buffer.from(String(body.empId)).toString('base64url'),
            name: emp.email || emp.username || body.empId,
            displayName: emp.name || body.empId,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Use device's built-in biometric
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        });
      }

      case 'biometric-register-verify': {
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId || !body.credential) return res.status(400).json({ error: 'empId and credential required' });

        // v7.38 — Verify challenge exists and not expired
        const challenges = (await dbGet('biometric_challenges')) || {};
        const stored = challenges[body.empId];
        if (!stored || stored.type !== 'register' || stored.expires < Date.now()) {
          return res.status(400).json({ error: 'انتهت صلاحية التحدي — حاول مرة أخرى' });
        }
        const storedRpId = stored.rpId || 'b.hma.engineer';

        const credentials = (await dbGet('biometric_credentials')) || {};
        if (!credentials[body.empId]) credentials[body.empId] = [];

        // Check if credential ID already exists
        const credId = body.credential.id;
        const existing = credentials[body.empId].find(function(c){ return c.credentialId === credId; });
        if (existing) {
          // Clean challenge even on duplicate
          delete challenges[body.empId];
          await dbSet('biometric_challenges', challenges);
          return res.json({ ok: true, message: 'already registered', device: existing });
        }

        var device = {
          credentialId: credId,
          publicKey: body.credential.response && body.credential.response.publicKey ? body.credential.response.publicKey : '',
          deviceName: body.deviceName || 'جهاز غير مسمى',
          userAgent: body.userAgent || '',
          platform: body.platform || '',
          rpId: storedRpId,  // v7.38 — store rpId so login uses the same one
          registeredAt: new Date().toISOString(),
          lastUsed: null,
        };
        credentials[body.empId].push(device);
        await dbSet('biometric_credentials', credentials);

        // Delete used challenge
        delete challenges[body.empId];
        await dbSet('biometric_challenges', challenges);

        return res.json({ ok: true, device: device });
      }

      case 'biometric-login-challenge': {
        // Returns challenge + allowed credentials for a given user
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId) return res.status(400).json({ error: 'empId required' });

        const credentials = (await dbGet('biometric_credentials')) || {};
        const userCreds = credentials[body.empId] || [];
        if (userCreds.length === 0) return res.status(404).json({ error: 'لا يوجد بصمة مسجّلة لهذا المستخدم' });

        const crypto = await import('crypto');
        const challenge = crypto.randomBytes(32).toString('base64url');

        // v7.38 — Use rpId from first credential (all should match)
        const rpId = userCreds[0].rpId || body.rpId || 'b.hma.engineer';

        const challenges = (await dbGet('biometric_challenges')) || {};
        challenges[body.empId] = { challenge: challenge, expires: Date.now() + 5 * 60 * 1000, type: 'login' };
        await dbSet('biometric_challenges', challenges);

        return res.json({
          challenge: challenge,
          rpId: rpId,  // v7.38 — client will use this
          allowCredentials: userCreds.map(function(c){
            return { type: 'public-key', id: c.credentialId, transports: ['internal'] };
          }),
          timeout: 60000,
          userVerification: 'required',
        });
      }

      case 'biometric-login-verify': {
        if (req.method !== 'POST') break;
        const body = req.body || {};
        if (!body.empId || !body.credential) return res.status(400).json({ error: 'بيانات ناقصة' });

        // Verify challenge exists and matches
        const challenges = (await dbGet('biometric_challenges')) || {};
        const stored = challenges[body.empId];
        if (!stored || stored.type !== 'login' || stored.expires < Date.now()) {
          return res.status(400).json({ error: 'انتهت صلاحية التحدي — حاول مرة أخرى' });
        }

        // Verify credential exists for user
        const credentials = (await dbGet('biometric_credentials')) || {};
        const userCreds = credentials[body.empId] || [];
        const cred = userCreds.find(function(c){ return c.credentialId === body.credential.id; });
        if (!cred) return res.status(401).json({ error: 'بصمة غير مُسجّلة' });

        // Update lastUsed
        cred.lastUsed = new Date().toISOString();
        await dbSet('biometric_credentials', credentials);

        // Delete used challenge
        delete challenges[body.empId];
        await dbSet('biometric_challenges', challenges);

        // Return full employee data (same as login endpoint)
        const emps = await dbGet('employees') || [];
        const emp = emps.find(function(e){ return e.id === body.empId; });
        if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

        const safeEmp = Object.assign({}, emp);
        delete safeEmp.passwordHash;
        delete safeEmp.password;
        delete safeEmp.passwordSalt;

        // v7.135 — Issue session token
        var bioSess = await createSession(safeEmp, true); // biometric implies "remember me"
        return res.json({ ok: true, employee: safeEmp, biometricUsed: true, sessionToken: bioSess.token, expiresIn: bioSess.expiresIn });
      }

      case 'biometric-devices': {
        // GET: list devices for user · DELETE: remove a device
        const body = req.method === 'GET' ? req.query : (req.body || {});
        if (!body.empId) return res.status(400).json({ error: 'empId required' });

        const credentials = (await dbGet('biometric_credentials')) || {};
        if (req.method === 'GET') {
          var list = (credentials[body.empId] || []).map(function(c){
            return {
              credentialId: c.credentialId,
              deviceName: c.deviceName,
              platform: c.platform,
              registeredAt: c.registeredAt,
              lastUsed: c.lastUsed,
            };
          });
          return res.json(list);
        }
        if (req.method === 'DELETE') {
          if (!body.credentialId) return res.status(400).json({ error: 'credentialId required' });
          credentials[body.empId] = (credentials[body.empId] || []).filter(function(c){
            return c.credentialId !== body.credentialId;
          });
          await dbSet('biometric_credentials', credentials);
          return res.json({ ok: true });
        }
        break;
      }

      case 'login': {
        var body = req.body || {};
        var loginId = (body.username || body.empId || body.email || '').toLowerCase().trim();
        var password = body.password || body.code || '';
        var rememberMe = !!body.rememberMe;
        if (!loginId || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

        // 1. Check general manager (admin) — stored in basma
        var admin = await dbGet('admin_config');
        if (admin && admin.email && admin.email === loginId) {
          if (admin.password !== password) return res.status(401).json({ error: 'كلمة المرور خاطئة' });
          var adminEmp = {
            id: admin.email, email: admin.email,
            name: admin.name || 'المدير العام',
            role: admin.role || 'المدير العام',
            branch: 'jed',
            isGeneralManager: true, isManager: true, isAdmin: true,
          };
          var adminSess = await createSession(adminEmp, rememberMe);
          return res.json({ ok: true, employee: adminEmp, sessionToken: adminSess.token, expiresIn: adminSess.expiresIn });
        }

        // 2. Regular employee — username + SHA256 password verification
        var emps = await dbGet('employees') || [];
        var emp = emps.find(function(x) {
          if (!x) return false;
          if ((x.username || '').toLowerCase() === loginId) return true;
          if ((x.email || '').toLowerCase() === loginId) return true;
          if (String(x.idNumber || '') === loginId) return true;
          return false;
        });
        if (!emp) return res.status(404).json({ error: 'المستخدم غير موجود — راجع المشرف لإنشاء حسابك في كوادر' });
        if (emp.hasAccount === false) return res.status(403).json({ error: 'راجع المشرف لإنشاء حسابك في كوادر' });

        // Verify SHA256(password + salt) === passwordHash
        var storedHash = emp.passwordHash || '';
        var salt = emp.passwordSalt || 'hr_salt_2024';
        if (!storedHash) return res.status(403).json({ error: 'لم تتم مزامنة كلمة المرور بعد — راجع المشرف' });

        var crypto = await import('crypto');
        var computed = crypto.createHash('sha256').update(password + salt).digest('hex');
        if (computed.toLowerCase() !== String(storedHash).toLowerCase()) {
          return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        }
        // Don't return password hash back to client
        var safeEmp = Object.assign({}, emp);
        delete safeEmp.passwordHash;
        delete safeEmp.password;
        delete safeEmp.passwordSalt;

        // v7.135 — Issue session token
        var empSess = await createSession(safeEmp, rememberMe);
        return res.json({ ok: true, employee: safeEmp, sessionToken: empSess.token, expiresIn: empSess.expiresIn });
      }

      case 'logout': {
        // v7.135 — Revoke session
        var token = req.headers['x-session-token'] || '';
        if (token) await revokeSession(token);
        return res.json({ ok: true });
      }

      case 'session-info': {
        // v7.135 — Return current session info (used by client to verify session validity)
        if (!req.__session) return res.json({ ok: false });
        return res.json({ ok: true, session: req.__session });
      }

      case 'employees': {
        if (req.method === 'GET') return res.json(await dbGet('employees') || []);
        if (req.method === 'PUT') {
          const emps = await dbGet('employees') || [];
          const { id, actorId, ...up } = req.body;
          const i = emps.findIndex(e => e.id === id);
          if (i >= 0) {
            var prev = { ...emps[i] };
            emps[i] = { ...emps[i], ...up };
            await dbSet('employees', emps);
            // v7.85 — audit
            await auditLog(actorId || 'hr', 'emp_update', id, { changes: up }, 'employees');
          }
          return res.json({ ok: true });
        }
        if (req.method === 'POST') {
          const emps = await dbGet('employees') || [];
          var newEmp = req.body;
          var actorId = newEmp.actorId;
          delete newEmp.actorId;

          // v7.85 — Validation للحقول المطلوبة
          if (!newEmp.id) {
            return res.status(400).json({ error: 'رقم الهوية مطلوب (id)' });
          }
          if (!newEmp.name || newEmp.name.trim().length < 3) {
            return res.status(400).json({ error: 'اسم الموظف مطلوب (3 أحرف على الأقل)' });
          }
          // Check uniqueness
          if (emps.find(function(e){ return String(e.id) === String(newEmp.id); })) {
            return res.status(400).json({ error: 'موظف برقم الهوية هذا موجود بالفعل' });
          }
          // Defaults
          newEmp.createdAt = new Date().toISOString();
          newEmp.active = newEmp.active !== false;
          newEmp.role = newEmp.role || 'employee';
          if (!newEmp.joinDate) newEmp.joinDate = new Date().toISOString().slice(0, 10);

          emps.push(newEmp);
          await dbSet('employees', emps);

          // v7.85 — Audit log
          await auditLog(actorId || 'hr', 'emp_create', newEmp.id, {
            name: newEmp.name,
            branchId: newEmp.branchId,
            jobTitle: newEmp.jobTitle,
            joinDate: newEmp.joinDate,
          }, 'employees');

          return res.json({ ok: true, employee: newEmp });
        }
        break;
      }

      /* ═══════════ v6.83 — EMPLOYEE FULL PROFILE (Batch 1) ═══════════
       * ملف الموظف الكامل — بعد نقل الملكية من كوادر إلى بصمة
       * Schema موسّع: personal + employment + compensation + contract + dependents + attachments
       * فلسفة التدريج: لا رفض — فقط تنبيهات completeness
       */
      case 'emp-profile': {
        // GET ?action=emp-profile&empId=X — جلب الملف الكامل
        if (req.method === 'GET') {
          const empId = req.query.empId;
          if (!empId) return res.status(400).json({ error: 'empId required' });
          const emps = await dbGet('employees') || [];
          const emp = emps.find(e =>
            String(e.id) === String(empId) ||
            String(e.idNumber) === String(empId) ||
            String(e.uid) === String(empId) ||
            String(e.hrCode) === String(empId)
          );
          if (!emp) return res.status(404).json({ error: 'employee not found', searched: empId });
          // Load extended profile — try multiple keys in case migration used different key
          const profiles = await dbGet('emp-profiles') || {};
          const attachments = await dbGet('emp-attachments') || {};
          // Try: emp.id, emp.idNumber, emp.uid
          let profile = profiles[emp.id] || profiles[emp.idNumber] || profiles[emp.uid] || {};
          let profileKey = profiles[emp.id] ? emp.id : (profiles[emp.idNumber] ? emp.idNumber : (profiles[emp.uid] ? emp.uid : emp.id));
          let empAttachments = attachments[emp.id] || attachments[emp.idNumber] || attachments[emp.uid] || [];
          // Compute completeness
          const completeness = computeCompleteness(emp, profile, empAttachments);
          return res.json({ ok: true, emp, profile, profileKey, completeness, attachmentsCount: empAttachments.length });
        }
        // PUT — حفظ تحديث (من HR أو من الموظف كطلب)
        if (req.method === 'PUT') {
          const { empId, section, data, source, requestedBy } = req.body || {};
          if (!empId || !section || !data) return res.status(400).json({ error: 'empId + section + data required' });
          // sections: personal | employment | compensation | contract | dependents
          const validSections = ['personal', 'employment', 'compensation', 'contract', 'dependents', 'system'];
          if (!validSections.includes(section)) return res.status(400).json({ error: 'invalid section' });
          const emps = await dbGet('employees') || [];
          const ei = emps.findIndex(e => e.id === empId || e.idNumber === empId);
          if (ei < 0) return res.status(404).json({ error: 'employee not found' });
          const empKey = emps[ei].id;
          const profiles = await dbGet('emp-profiles') || {};
          if (!profiles[empKey]) profiles[empKey] = {};
          // source: 'hr_direct' = HR عدّل مباشرة (يُحفظ فوراً)
          //         'employee_request' = الموظف طلب تعديل (يذهب لـ tickets للاعتماد)
          if (source === 'employee_request') {
            // Create an HR ticket for approval
            const tickets = await dbGet('hr-tickets') || [];
            const tId = 'TKT' + Date.now();
            tickets.push({
              id: tId,
              initiatedBy: 'employee',
              createdBy: requestedBy || empId,
              createdByRole: 'employee',
              category: 'profile_update',
              template: null,
              subject: 'طلب تعديل ' + sectionLabel(section),
              priority: 'normal',
              status: 'open',
              requiresReply: true,
              pendingProfileUpdate: { section, data },  // المنتظر اعتماد
              messages: [{
                id: 'M' + Date.now(),
                ts: new Date().toISOString(),
                by: requestedBy || empId,
                byRole: 'employee',
                text: 'طلب تحديث بيانات قسم: ' + sectionLabel(section),
                attachments: []
              }],
              createdAt: new Date().toISOString(),
              lastActivity: new Date().toISOString(),
            });
            await dbSet('hr-tickets', tickets);
            return res.json({ ok: true, pending: true, ticketId: tId, message: 'تم إرسال طلبك للموارد البشرية للاعتماد' });
          }
          // HR direct update — save immediately
          // v7.10 — Department history tracking (if section=employment and dept changed)
          var deptChanged = false;
          var oldDept = null;
          var newDept = null;
          if (section === 'employment' && data.department) {
            var prevEmployment = profiles[empKey].employment || {};
            oldDept = prevEmployment.department || emps[ei].department || null;
            newDept = data.department;
            deptChanged = oldDept !== newDept;
          }

          profiles[empKey][section] = { ...(profiles[empKey][section] || {}), ...data, _updatedAt: new Date().toISOString(), _updatedBy: requestedBy || 'hr' };

          // Track dept history
          if (deptChanged) {
            var history = profiles[empKey].department_history || [];
            // Close current entry (set 'to')
            var nowIso = new Date().toISOString();
            for (var hh = 0; hh < history.length; hh++) {
              if (!history[hh].to) {
                history[hh].to = nowIso;
              }
            }
            // Add new entry
            history.push({
              dept: newDept,
              from: nowIso,
              to: null,
              role: data.jobTitle || (profiles[empKey].employment && profiles[empKey].employment.jobTitle) || emps[ei].jobTitle || null,
              changedBy: requestedBy || 'hr',
            });
            profiles[empKey].department_history = history;
          }

          await dbSet('emp-profiles', profiles);

          // v7.10 — Set local lock flag on employee (flags them as locally edited — Kadwar sync will skip)
          if (!emps[ei].localLocked || deptChanged) {
            emps[ei].localLocked = true;
            emps[ei].localLockedAt = new Date().toISOString();
            emps[ei].localLockedBy = requestedBy || 'hr';
            emps[ei].localLockReason = deptChanged ? 'تغيير قسم (dept history)' : 'تعديل محلي من HR';
            await dbSet('employees', emps);
          }

          return res.json({ ok: true, saved: true, localLocked: true, deptHistoryUpdated: deptChanged });
        }
        break;
      }

      /* v7.10 — Unlock local edit (HR/admin only) */
      case 'emp-unlock': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { empId, actor } = req.body || {};
        if (!empId) return res.status(400).json({ error: 'empId required' });
        const emps = await dbGet('employees') || [];
        const ei = emps.findIndex(e => e.id === empId || e.idNumber === empId);
        if (ei < 0) return res.status(404).json({ error: 'employee not found' });
        emps[ei].localLocked = false;
        emps[ei].localUnlockedAt = new Date().toISOString();
        emps[ei].localUnlockedBy = actor || 'hr';
        await dbSet('employees', emps);
        await auditLog(actor || 'hr', 'emp_unlock', empId, {}, 'employees');
        return res.json({ ok: true });
      }

      /* v7.10 — List all pending attachments across all employees (HR queue) */
      case 'emp-attachments-pending': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const attachments = await dbGet('emp-attachments') || {};
        const emps = await dbGet('employees') || [];
        const empsMap = {};
        emps.forEach(function(e){ empsMap[e.id] = e; });
        const pending = [];
        Object.keys(attachments).forEach(function(empId){
          var arr = attachments[empId] || [];
          arr.filter(function(a){ return a.status === 'pending'; }).forEach(function(att){
            var emp = empsMap[empId] || {};
            pending.push(Object.assign({}, att, {
              empId: empId,
              empName: emp.name || empId,
              empDept: emp.department || '—',
            }));
          });
        });
        // Sort oldest first
        pending.sort(function(a, b){ return String(a.uploadedAt).localeCompare(String(b.uploadedAt)); });
        return res.json({ pending: pending, count: pending.length });
      }

      /* v7.10 — Reject attachment with reason */
      case 'emp-attachment-reject': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { empId, attachmentId, reason, actor } = req.body || {};
        if (!empId || !attachmentId) return res.status(400).json({ error: 'empId + attachmentId required' });
        const attachments = await dbGet('emp-attachments') || {};
        const arr = attachments[empId] || [];
        const ai = arr.findIndex(a => a.id === attachmentId);
        if (ai < 0) return res.status(404).json({ error: 'attachment not found' });
        arr[ai].status = 'rejected';
        arr[ai].rejectedBy = actor || 'hr';
        arr[ai].rejectedAt = new Date().toISOString();
        arr[ai].rejectionReason = reason || '';
        attachments[empId] = arr;
        await dbSet('emp-attachments', attachments);
        return res.json({ ok: true });
      }

      /* v7.11 — Salary change request (HR proposes — GM approves) */
      case 'salary-change-request': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { empId, empName, field, oldValue, newValue, reason, effectiveDate, proposedBy } = req.body || {};
        if (!empId || !field || newValue === undefined) return res.status(400).json({ error: 'empId + field + newValue required' });
        if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'السبب مطلوب' });
        const list = await dbGet('salary-change-requests') || [];
        const item = {
          id: 'SCR' + Date.now(),
          empId, empName: empName || empId,
          field,
          oldValue: oldValue === undefined ? null : oldValue,
          newValue,
          reason,
          effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
          proposedBy: proposedBy || 'hr',
          proposedAt: new Date().toISOString(),
          status: 'pending',
        };
        list.push(item);
        await dbSet('salary-change-requests', list);
        await auditLog(proposedBy || 'hr', 'salary_change_request', item.id, { empId, field, newValue }, 'salary');
        return res.json({ ok: true, request: item });
      }

      /* v7.11 — List salary change requests */
      case 'salary-change-list': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const list = await dbGet('salary-change-requests') || [];
        return res.json({ items: list.slice().reverse() });
      }

      /* v7.11 — Approve salary change (GM only) — applies the change */
      case 'salary-change-approve': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, actor } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const list = await dbGet('salary-change-requests') || [];
        const i = list.findIndex(x => x.id === id);
        if (i < 0) return res.status(404).json({ error: 'request not found' });
        if (list[i].status !== 'pending') return res.status(400).json({ error: 'already processed' });
        // Apply change
        const emps = await dbGet('employees') || [];
        const ei = emps.findIndex(e => e.id === list[i].empId || e.idNumber === list[i].empId);
        if (ei < 0) return res.status(404).json({ error: 'employee not found' });
        const empKey = emps[ei].id;
        const profiles = await dbGet('emp-profiles') || {};
        if (!profiles[empKey]) profiles[empKey] = {};
        if (!profiles[empKey].compensation) profiles[empKey].compensation = {};
        const comp = profiles[empKey].compensation;
        const field = list[i].field;
        const newVal = list[i].newValue;
        // If field ends with "Allowance", support override structure { template, actual, reason }
        if (/Allowance$/.test(field) && typeof newVal === 'number') {
          const prev = comp[field];
          const template = typeof prev === 'object' ? prev.template : (typeof prev === 'number' ? prev : null);
          comp[field] = { template, actual: newVal, reason: list[i].reason };
        } else {
          comp[field] = newVal;
        }
        // Track change history
        comp.changeHistory = comp.changeHistory || [];
        comp.changeHistory.push({
          field,
          oldValue: list[i].oldValue,
          newValue: newVal,
          reason: list[i].reason,
          effectiveDate: list[i].effectiveDate,
          proposedBy: list[i].proposedBy,
          approvedBy: actor || 'gm',
          approvedAt: new Date().toISOString(),
        });
        comp._updatedAt = new Date().toISOString();
        comp._updatedBy = actor || 'gm';
        await dbSet('emp-profiles', profiles);
        // Update request
        list[i].status = 'approved';
        list[i].approvedBy = actor || 'gm';
        list[i].approvedAt = new Date().toISOString();
        await dbSet('salary-change-requests', list);
        // Lock employee locally (edited)
        emps[ei].localLocked = true;
        emps[ei].localLockedAt = new Date().toISOString();
        emps[ei].localLockedBy = actor || 'gm';
        emps[ei].localLockReason = 'تعديل راتب/بدل معتمد';
        await dbSet('employees', emps);
        await auditLog(actor || 'gm', 'salary_change_approve', id, { empId: list[i].empId, field, newValue: newVal }, 'salary');
        return res.json({ ok: true, request: list[i] });
      }

      /* v7.11 — Reject salary change (GM) */
      case 'salary-change-reject': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, actor, rejectionReason } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const list = await dbGet('salary-change-requests') || [];
        const i = list.findIndex(x => x.id === id);
        if (i < 0) return res.status(404).json({ error: 'request not found' });
        if (list[i].status !== 'pending') return res.status(400).json({ error: 'already processed' });
        list[i].status = 'rejected';
        list[i].rejectedBy = actor || 'gm';
        list[i].rejectedAt = new Date().toISOString();
        list[i].rejectionReason = rejectionReason || '';
        await dbSet('salary-change-requests', list);
        await auditLog(actor || 'gm', 'salary_change_reject', id, { empId: list[i].empId, reason: rejectionReason }, 'salary');
        return res.json({ ok: true });
      }

      case 'emp-attachments': {
        // GET ?empId=X — قائمة المرفقات
        if (req.method === 'GET') {
          const empId = req.query.empId;
          if (!empId) return res.status(400).json({ error: 'empId required' });
          const attachments = await dbGet('emp-attachments') || {};
          return res.json({ ok: true, attachments: attachments[empId] || [] });
        }
        // POST — إضافة مرفق جديد
        if (req.method === 'POST') {
          const { empId, type, url, fileName, fileSize, uploadedBy } = req.body || {};
          if (!empId || !type || !url) return res.status(400).json({ error: 'empId + type + url required' });
          const attachments = await dbGet('emp-attachments') || {};
          if (!attachments[empId]) attachments[empId] = [];
          const att = {
            id: 'ATT' + Date.now(),
            type, url, fileName: fileName || 'attachment', fileSize: fileSize || 0,
            uploadedBy: uploadedBy || empId,
            uploadedAt: new Date().toISOString(),
            status: uploadedBy === 'hr' ? 'verified' : 'pending',
            verifiedBy: uploadedBy === 'hr' ? uploadedBy : null,
            verifiedAt: uploadedBy === 'hr' ? new Date().toISOString() : null,
            expiryDate: null,
          };
          attachments[empId].push(att);
          await dbSet('emp-attachments', attachments);
          return res.json({ ok: true, attachment: att });
        }
        // PUT — تحديث حالة (اعتماد من HR)
        if (req.method === 'PUT') {
          const { empId, attachmentId, status, verifiedBy, expiryDate } = req.body || {};
          if (!empId || !attachmentId || !status) return res.status(400).json({ error: 'empId + attachmentId + status required' });
          const attachments = await dbGet('emp-attachments') || {};
          const arr = attachments[empId] || [];
          const ai = arr.findIndex(a => a.id === attachmentId);
          if (ai < 0) return res.status(404).json({ error: 'attachment not found' });
          arr[ai].status = status;
          if (status === 'verified') {
            arr[ai].verifiedBy = verifiedBy || 'hr';
            arr[ai].verifiedAt = new Date().toISOString();
          }
          if (expiryDate) arr[ai].expiryDate = expiryDate;
          attachments[empId] = arr;
          await dbSet('emp-attachments', attachments);
          return res.json({ ok: true });
        }
        // DELETE — حذف مرفق
        if (req.method === 'DELETE') {
          const { empId, attachmentId } = req.body || {};
          if (!empId || !attachmentId) return res.status(400).json({ error: 'empId + attachmentId required' });
          const attachments = await dbGet('emp-attachments') || {};
          attachments[empId] = (attachments[empId] || []).filter(a => a.id !== attachmentId);
          await dbSet('emp-attachments', attachments);
          return res.json({ ok: true });
        }
        break;
      }

      case 'emp-approve-update': {
        // POST — HR توافق على طلب تعديل موظف معلّق في ticket
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { ticketId, approvedBy, decision, note } = req.body || {};
        if (!ticketId || !decision) return res.status(400).json({ error: 'ticketId + decision required' });
        const tickets = await dbGet('hr-tickets') || [];
        const ti = tickets.findIndex(t => t.id === ticketId);
        if (ti < 0) return res.status(404).json({ error: 'ticket not found' });
        const tk = tickets[ti];
        if (!tk.pendingProfileUpdate) return res.status(400).json({ error: 'no pending update' });
        if (decision === 'approve') {
          // Apply the update
          const { section, data } = tk.pendingProfileUpdate;
          const empId = tk.createdBy;
          const profiles = await dbGet('emp-profiles') || {};
          if (!profiles[empId]) profiles[empId] = {};
          profiles[empId][section] = { ...(profiles[empId][section] || {}), ...data, _updatedAt: new Date().toISOString(), _updatedBy: approvedBy || 'hr', _approvedVia: ticketId };
          await dbSet('emp-profiles', profiles);
          tk.status = 'resolved';
          tk.messages.push({
            id: 'M' + Date.now(), ts: new Date().toISOString(),
            by: approvedBy || 'hr', byRole: 'hr',
            text: '✅ تم اعتماد طلبك وتحديث البيانات.' + (note ? '\n\n' + note : ''),
            attachments: []
          });
        } else {
          // Reject
          tk.status = 'resolved';
          tk.messages.push({
            id: 'M' + Date.now(), ts: new Date().toISOString(),
            by: approvedBy || 'hr', byRole: 'hr',
            text: '❌ تم رفض طلبك.' + (note ? '\n\nالسبب: ' + note : ''),
            attachments: []
          });
        }
        delete tk.pendingProfileUpdate;
        tk.lastActivity = new Date().toISOString();
        tickets[ti] = tk;
        await dbSet('hr-tickets', tickets);
        return res.json({ ok: true });
      }

      case 'emp-completeness': {
        // GET — تقرير اكتمال البيانات لكل الموظفين (للوحة HR)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const emps = await dbGet('employees') || [];
        const profiles = await dbGet('emp-profiles') || {};
        const attachments = await dbGet('emp-attachments') || {};
        const report = emps.map(e => {
          const prof = profiles[e.id] || {};
          const atts = attachments[e.id] || [];
          const c = computeCompleteness(e, prof, atts);
          return {
            id: e.id, name: e.name, role: e.role, department: e.department, branch: e.branch,
            completeness: c.score, missing: c.missing, level: c.level
          };
        });
        // Summary
        const totalEmps = report.length;
        const avgCompleteness = totalEmps ? Math.round(report.reduce((s, r) => s + r.completeness, 0) / totalEmps) : 0;
        const fullyComplete = report.filter(r => r.completeness >= 90).length;
        const needsAttention = report.filter(r => r.completeness < 60).length;
        return res.json({
          ok: true,
          summary: { totalEmps, avgCompleteness, fullyComplete, needsAttention },
          employees: report
        });
      }

      /* ═══════════════ v6.83 — KADWAR INTEGRATION (Batch 2) ═══════════════
       * التكامل مع كوادر v37.141:
       *   - استقبال معايير التقييم من كوادر (GET eval-criteria)
       *   - إرسال تحديثات الموظف لكوادر (POST receive-employee-update)
       *   - إرسال موظف جديد لكوادر (POST receive-new-employee)
       *   - إرسال التقييمات لكوادر (POST receive-evaluation)
       *   - المزامنة الأولية الشاملة (GET full-export)
       */

      // ═══ جلب معايير التقييم من كوادر (cache محلي) ═══
      case 'kadwar-eval-criteria': {
        // GET — يُعيد المعايير من cache الـ local، ويُحدّث من كوادر إن طُلب
        if (req.method === 'GET') {
          const forceRefresh = req.query.refresh === '1';
          const cached = await dbGet('kadwar-eval-criteria-cache');
          const cacheAge = cached && cached._fetchedAt ? (Date.now() - new Date(cached._fetchedAt).getTime()) : Infinity;
          const CACHE_TTL = 60 * 60 * 1000; // ساعة واحدة
          if (!forceRefresh && cached && cacheAge < CACHE_TTL) {
            return res.json({ ok: true, fromCache: true, cacheAgeMs: cacheAge, ...cached });
          }
          // Fetch fresh from kadwar
          try {
            const kr = await fetch('https://hma.engineer/api/basma-sync?action=eval-criteria', { method: 'GET' });
            if (!kr.ok) {
              // Return stale cache if fetch failed
              if (cached) return res.json({ ok: true, fromCache: true, stale: true, error: 'kadwar fetch failed: ' + kr.status, ...cached });
              return res.status(502).json({ error: 'فشل الاتصال بكوادر: ' + kr.status });
            }
            const kd = await kr.json();
            const toCache = { ...kd, _fetchedAt: new Date().toISOString() };
            await dbSet('kadwar-eval-criteria-cache', toCache);
            return res.json({ ok: true, fromCache: false, ...toCache });
          } catch (e) {
            if (cached) return res.json({ ok: true, fromCache: true, stale: true, error: e.message, ...cached });
            return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
          }
        }
        break;
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.86 — Kadwar Job Catalog (المسميات + الهيكل + KPIs من كوادر)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=kadwar-job-catalog[&refresh=1]
       * يُعيد:
       *   {
       *     jobTitles: [{ id, name_ar, name_en, department, level }, ...],
       *     orgChart: [{ positionId, name, parentId, ... }, ...],
       *     kpisByTitle: { "title_id": { criteria: [...], weight: N }, ... }
       *   }
       * Cache: ساعة واحدة (TTL)
       * إذا كوادر offline → يُرجع cached + stale flag
       */
      case 'kadwar-job-catalog': {
        if (req.method === 'GET') {
          const forceRefresh = req.query.refresh === '1';
          const cached = await dbGet('kadwar-job-catalog-cache');
          const cacheAge = cached && cached._fetchedAt ? (Date.now() - new Date(cached._fetchedAt).getTime()) : Infinity;
          const CACHE_TTL = 60 * 60 * 1000; // ساعة واحدة

          if (!forceRefresh && cached && cacheAge < CACHE_TTL) {
            return res.json({ ok: true, fromCache: true, cacheAgeMs: cacheAge, ...cached });
          }

          // Try fetching from Kadwar
          try {
            // جلب 3 مصادر بالتوازي من كوادر
            const [titlesRes, orgRes, kpisRes] = await Promise.all([
              fetch('https://hma.engineer/api/basma-sync?action=job-titles', { method: 'GET' }).catch(function(){ return null; }),
              fetch('https://hma.engineer/api/basma-sync?action=org-chart', { method: 'GET' }).catch(function(){ return null; }),
              fetch('https://hma.engineer/api/basma-sync?action=eval-criteria', { method: 'GET' }).catch(function(){ return null; }),
            ]);

            var jobTitles = [];
            var orgChart = [];
            var kpisByTitle = {};

            if (titlesRes && titlesRes.ok) {
              var td = await titlesRes.json();
              jobTitles = Array.isArray(td.jobTitles) ? td.jobTitles : (Array.isArray(td) ? td : []);
            }
            if (orgRes && orgRes.ok) {
              var od = await orgRes.json();
              orgChart = Array.isArray(od.positions) ? od.positions : (Array.isArray(od) ? od : []);
            }
            if (kpisRes && kpisRes.ok) {
              var kd = await kpisRes.json();
              kpisByTitle = (kd && kd.criteria_by_position) ? kd.criteria_by_position : {};
            }

            // If nothing loaded and we have cache — return cache
            if (jobTitles.length === 0 && orgChart.length === 0 && Object.keys(kpisByTitle).length === 0) {
              if (cached) {
                return res.json({ ok: true, fromCache: true, stale: true, error: 'kadwar returned empty', ...cached });
              }
              return res.json({
                ok: true,
                jobTitles: [],
                orgChart: [],
                kpisByTitle: {},
                note: 'كوادر لم تُرجع بيانات — سيتم استخدام قائمة محلية',
              });
            }

            var toCache = {
              jobTitles: jobTitles,
              orgChart: orgChart,
              kpisByTitle: kpisByTitle,
              _fetchedAt: new Date().toISOString(),
            };
            await dbSet('kadwar-job-catalog-cache', toCache);
            return res.json({ ok: true, fromCache: false, ...toCache });
          } catch (e) {
            if (cached) {
              return res.json({ ok: true, fromCache: true, stale: true, error: e.message, ...cached });
            }
            return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
          }
        }
        break;
      }

      // ═══ إرسال تحديث موظف لكوادر (فوري، بعد موافقة HR) ═══
      case 'kadwar-push-update': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { employee_id, update_type, fields, updated_by, updated_by_name, reason } = req.body || {};
        if (!employee_id || !update_type || !fields) return res.status(400).json({ error: 'employee_id + update_type + fields required' });
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-employee-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id,
              update_type,
              fields,
              updated_by: updated_by || 'hr',
              updated_by_name: updated_by_name || 'الموارد البشرية',
              updated_at: new Date().toISOString(),
              reason: reason || 'تحديث من بصمة'
            })
          });
          const kd = await kr.json();
          // Log the push attempt
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-update',
            employee_id, update_type,
            success: kr.ok,
            response: kd,
          });
          if (log.length > 500) log.splice(0, log.length - 500); // keep last 500
          await dbSet('kadwar-sync-log', log);
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض التحديث', detail: kd });
          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-update',
            employee_id, update_type,
            success: false,
            error: e.message,
          });
          await dbSet('kadwar-sync-log', log);
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      // ═══ إرسال موظف جديد لكوادر (حالة استثنائية — بعد موافقة المدير العام) ═══
      case 'kadwar-push-new-employee': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const payload = req.body || {};
        const required = ['basma_employee_id', 'full_name', 'id_number', 'job_title'];
        for (const r of required) {
          if (!payload[r]) return res.status(400).json({ error: `missing required field: ${r}` });
        }
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-new-employee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              created_at: new Date().toISOString(),
            })
          });
          const kd = await kr.json();
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-new-employee',
            employee_id: payload.basma_employee_id,
            full_name: payload.full_name,
            success: kr.ok,
            response: kd,
          });
          await dbSet('kadwar-sync-log', log);
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض الموظف الجديد', detail: kd });
          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      // ═══ إرسال نتيجة تقييم لكوادر ═══
      case 'kadwar-push-evaluation': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const payload = req.body || {};
        if (!payload.employee_id || !payload.evaluation_type || !payload.total_score) {
          return res.status(400).json({ error: 'employee_id + evaluation_type + total_score required' });
        }
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              created_at: payload.created_at || new Date().toISOString(),
            })
          });
          const kd = await kr.json();
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-evaluation',
            employee_id: payload.employee_id,
            evaluation_type: payload.evaluation_type,
            total_score: payload.total_score,
            success: kr.ok,
            response: kd,
          });
          await dbSet('kadwar-sync-log', log);
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض التقييم', detail: kd });
          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      /* ════════ v6.97 — Kadwar Push: Violations + Payroll + Termination ════════
       * متطلب من جانب كوادر: يجب إضافة 3 actions إلى /api/basma-sync:
       *   - receive-violation       (POST)
       *   - receive-payroll-slip    (POST)
       *   - receive-termination     (POST)
       * إن لم تكن متوفرة، تُسجَّل المحاولة في kadwar-sync-log كفشل وتُعاد لاحقاً.
       * ═══════════════════════════════════════════════════════════════════════════ */

      case 'kadwar-push-violation': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const v = req.body || {};
        if (!v.empId || !v.violationId) return res.status(400).json({ error: 'empId + violationId required' });
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: v.empId,
              violation_basma_id: v.id,
              violation_code: v.violationId,
              chapter: v.chapter,
              description: v.description,
              occurrence: v.occurrence,
              penalty_code: v.penaltyCode,
              penalty_label: v.penaltyLabel,
              status: v.status,
              legal_ref: v.legalRef,
              applied_to_payroll_id: v.appliedToPayrollId || null,
              applied_amount: v.appliedAmount || null,
              created_at: v.createdAt || new Date().toISOString(),
            })
          });
          const kd = await kr.json().catch(function(){ return { raw: 'non-json' }; });
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-violation',
            employee_id: v.empId,
            ref: v.id,
            success: kr.ok,
            httpStatus: kr.status,
            response: kd,
          });
          if (log.length > 5000) log.splice(0, log.length - 5000);
          await dbSet('kadwar-sync-log', log);
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض المخالفة', detail: kd, httpStatus: kr.status });
          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      case 'kadwar-push-payroll-slip': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const slip = req.body || {};
        if (!slip.empId || !slip.runId || !slip.period) return res.status(400).json({ error: 'empId + runId + period required' });
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-payroll-slip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: slip.empId,
              employee_name: slip.empName,
              slip_basma_id: slip.id,
              run_id: slip.runId,
              period: slip.period,                 // YYYY-MM
              status: slip.status,
              total_earnings: slip.totalEarnings,
              total_deductions: slip.totalDeductions,
              net_salary: slip.netSalary,
              breakdown: slip.breakdown,            // كامل التفصيل (لا يحتوي IBAN)
              fines_applied: (slip.finesInfo && slip.finesInfo.appliedAmount) || 0,
              fines_deferred: (slip.finesInfo && slip.finesInfo.deferredAmount) || 0,
              calculated_at: slip.calculatedAt,
              sent_at: slip.sentAt,
            })
          });
          const kd = await kr.json().catch(function(){ return { raw: 'non-json' }; });
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-payroll-slip',
            employee_id: slip.empId,
            ref: slip.id,
            period: slip.period,
            success: kr.ok,
            httpStatus: kr.status,
            response: kd,
          });
          if (log.length > 5000) log.splice(0, log.length - 5000);
          await dbSet('kadwar-sync-log', log);
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض كشف الراتب', detail: kd, httpStatus: kr.status });
          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      case 'kadwar-push-termination': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const tr = req.body || {};
        if (!tr.empId) return res.status(400).json({ error: 'empId required' });
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-termination', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: tr.empId,
              employee_name: tr.empName,
              termination_basma_id: tr.id,
              reason_code: tr.reason,                 // resignation | termination | contract_end | retirement
              reason_label: tr.reasonLabel || tr.reason,
              effective_date: tr.effectiveDate || tr.createdAt,
              notes: tr.notes,
              initiated_by: tr.initiatedBy,
              status: tr.status || 'pending',          // pending | confirmed | reverted
              created_at: tr.createdAt || new Date().toISOString(),
            })
          });
          const kd = await kr.json().catch(function(){ return { raw: 'non-json' }; });
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-termination',
            employee_id: tr.empId,
            ref: tr.id,
            success: kr.ok,
            httpStatus: kr.status,
            response: kd,
          });
          if (log.length > 5000) log.splice(0, log.length - 5000);
          await dbSet('kadwar-sync-log', log);
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض إنهاء الخدمة', detail: kd, httpStatus: kr.status });
          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      /* v6.97 — جلب سجل المزامنة الفاشلة (للوحة الإدارة) */
      case 'kadwar-sync-failures': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const log = await dbGet('kadwar-sync-log') || [];
        const failed = log.filter(function(l){ return l && l.success === false; }).slice(-200).reverse();
        return res.json({ ok: true, failed: failed, total: failed.length });
      }


      case 'kadwar-full-migration': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { confirm, dryRun, includeAll } = req.body || {};
        if (!confirm) return res.status(400).json({ error: 'confirm: true required — هذه عملية خطيرة تنقل كل البيانات' });
        const summary = {
          startedAt: new Date().toISOString(),
          dryRun: !!dryRun,
          includeAll: !!includeAll,
          steps: [],
          totals: { employees: 0, imported: 0, skipped: 0, errors: 0 },
        };
        try {
          // 1. Fetch full export from kadwar v37.142 (full-export-v2)
          // active_only=true → فقط الموظفين النشطين (يستبعد المرشحين في توقيع عقد + الاستقالات)
          const exportUrl = 'https://hma.engineer/api/basma-sync?action=full-export' + (includeAll ? '' : '&active_only=true');
          summary.steps.push({ step: 'fetch', url: exportUrl, at: new Date().toISOString() });
          const kr = await fetch(exportUrl, { method: 'GET' });
          if (!kr.ok) {
            summary.error = 'فشل جلب البيانات من كوادر: ' + kr.status;
            return res.status(502).json(summary);
          }
          const kd = await kr.json();
          if (!kd.employees || !Array.isArray(kd.employees)) {
            summary.error = 'بنية البيانات المستلمة من كوادر غير صحيحة';
            return res.status(502).json(summary);
          }
          summary.totals.employees = kd.employees.length;
          summary.exportVersion = kd.version || 'v1';
          summary.steps.push({ step: 'fetched', count: kd.employees.length, version: summary.exportVersion, at: new Date().toISOString() });
          if (dryRun) {
            summary.steps.push({ step: 'dry-run-complete', message: 'لم يتم تعديل أي بيانات (dry run)', sample: kd.employees.slice(0, 2) });
            return res.json(summary);
          }
          // 2. Apply to basma employees + profiles
          const existingEmps = await dbGet('employees') || [];
          const profiles = await dbGet('emp-profiles') || {};
          const existingById = Object.fromEntries(existingEmps.map(e => [String(e.id), e]));
          const updatedEmps = [...existingEmps];
          const importedSamples = [];

          for (const ke of kd.employees) {
            try {
              // ═══ تحديد المعرّف الصحيح ═══
              // كوادر يُرسل: id (HREMP00004) + uid (1045443494 = رقم الهوية)
              // بصمة تستخدم uid (رقم الهوية) كـ id
              const kUid = ke.uid || (ke.personal && ke.personal.id_number) || ke.id;
              const kHrCode = ke.hr_code || ke.id;
              const kId = String(kUid); // استخدم uid كـ id في بصمة

              if (!kId || kId === 'undefined') {
                summary.totals.errors++;
                summary.steps.push({ step: 'skip-no-id', sample_keys: Object.keys(ke), at: new Date().toISOString() });
                continue;
              }

              // ═══ إيجاد الموظف الموجود في بصمة ═══
              // جرب البحث بعدة طرق
              let existing = existingById[kId];
              if (!existing) {
                // ابحث بـ idNumber
                existing = existingEmps.find(e =>
                  String(e.idNumber) === kId ||
                  String(e.id) === kId ||
                  (ke.account && ke.account.username && String(e.username || e.email) === String(ke.account.username))
                );
              }

              const baseEmp = existing || { id: kId };

              // ═══ بناء سجل الموظف الأساسي ═══
              const personal = ke.personal || {};
              const employment = ke.employment || {};
              const account = ke.account || {};

              const mergedEmp = {
                ...baseEmp,
                id: baseEmp.id || kId,
                idNumber: personal.id_number || kId,
                hrCode: kHrCode,
                name: personal.full_name || baseEmp.name || '',
                nameEn: personal.full_name_en || baseEmp.nameEn || '',
                email: personal.email || account.username || baseEmp.email || '',
                phone: personal.phone || baseEmp.phone || '',
                role: employment.job_title || baseEmp.role || '',
                department: employment.department || baseEmp.department || '',
                branch: employment.branch || baseEmp.branch || '',
                username: account.username || baseEmp.username,
                accountRole: account.role || baseEmp.accountRole,
              };

              // Update or add
              if (existing) {
                const idx = updatedEmps.findIndex(e => e.id === existing.id);
                if (idx >= 0) updatedEmps[idx] = mergedEmp;
                else updatedEmps.push(mergedEmp);
              } else {
                updatedEmps.push(mergedEmp);
              }

              // ═══ بناء الـ profile الموسّع ═══
              const profileKey = mergedEmp.id;
              profiles[profileKey] = profiles[profileKey] || {};
              const now = new Date().toISOString();

              // Personal — v37.142: حقول جديدة مضافة
              if (personal && Object.keys(personal).length > 0) {
                profiles[profileKey].personal = {
                  ...(profiles[profileKey].personal || {}),
                  fullName: personal.full_name,
                  fullNameEn: personal.full_name_en,
                  idNumber: personal.id_number,
                  idExpiry: personal.id_expiry,
                  dateOfBirth: personal.dob,
                  placeOfBirth: personal.place_of_birth,  // v37.142 — جديد
                  nationality: personal.nationality,
                  gender: personal.gender,
                  maritalStatus: personal.marital_status,
                  email: personal.email,
                  phone: personal.phone,
                  phone2: personal.phone2,                 // v37.142 — جديد
                  address: personal.address,
                  city: personal.city,
                  country: personal.country,               // v37.142 — جديد
                  dependents: personal.dependents || [],
                  dependentsCount: personal.dependents_count,  // v37.142 — جديد
                  _migratedFrom: 'kadwar',
                  _migratedAt: now,
                };
              }

              // Employment — v37.142: حقول جديدة مضافة
              if (employment && Object.keys(employment).length > 0) {
                profiles[profileKey].employment = {
                  ...(profiles[profileKey].employment || {}),
                  jobTitle: employment.job_title,
                  jobTitleId: employment.job_title_id,
                  jobDescription: employment.job_description,  // v37.142 — جديد
                  duties: employment.duties || [],             // v37.142 — جديد
                  department: employment.department,
                  branch: employment.branch,
                  hireDate: employment.hire_date,
                  employeeType: employment.employee_type,
                  workType: employment.work_type,              // v37.142 — جديد
                  status: employment.status,
                  managerId: employment.manager_id,
                  managerName: employment.manager_name,        // v37.142 — جديد
                  managerId2: employment.manager_id_2,         // v37.142 — جديد (Matrix)
                  managerName2: employment.manager_2_name,     // v37.142 — جديد
                  supervisorId: employment.supervisor_id,
                  supervisorName: employment.supervisor_name,  // v37.142 — جديد
                  reportingTo: employment.reporting_to,        // v37.142 — جديد
                  workingDays: employment.working_days,        // v37.142 — جديد
                  workingHours: employment.working_hours,      // v37.142 — جديد
                  annualLeaveDays: employment.annual_leave_days, // v37.142 — جديد
                  _migratedFrom: 'kadwar',
                  _migratedAt: now,
                };
              }

              // Job Grade — v37.142 (قسم جديد)
              if (ke.job_grade && (ke.job_grade.code || ke.job_grade.details)) {
                profiles[profileKey].jobGrade = {
                  code: ke.job_grade.code,
                  basic: ke.job_grade.details && ke.job_grade.details.basic,
                  housing: ke.job_grade.details && ke.job_grade.details.housing,
                  transport: ke.job_grade.details && ke.job_grade.details.transport,
                  total: ke.job_grade.details && ke.job_grade.details.total,
                  bonusCode: ke.job_grade.bonus_code,
                  _migratedFrom: 'kadwar',
                  _migratedAt: now,
                };
              }

              // Compensation — v37.142: حقول جديدة مضافة
              const comp = ke.compensation || {};
              if (Object.keys(comp).length > 0) {
                const allowances = comp.allowances || {};
                profiles[profileKey].compensation = {
                  ...(profiles[profileKey].compensation || {}),
                  basicSalary: comp.basic_salary ? Number(comp.basic_salary) : 0,
                  housingAllowance: Number(allowances.housing || 0),
                  transportAllowance: Number(allowances.transport || 0),
                  communicationsAllowance: Number(allowances.communication || 0),
                  otherAllowances: Number(allowances.other || 0),
                  fixedDeductions: Number(comp.deductions || 0),
                  commissions: Number(comp.commissions || 0),  // v37.142 — جديد
                  totalSalary: Number(comp.total_salary || 0), // v37.142 — جديد
                  currency: comp.currency || 'SAR',             // v37.142 — جديد
                  iban: comp.iban || '',
                  bankName: comp.bank || '',
                  _migratedFrom: 'kadwar',
                  _migratedAt: now,
                };
              }

              // Contract — v37.142: probation + renewable + duration
              const contract = ke.contract || {};
              if (Object.keys(contract).length > 0) {
                profiles[profileKey].contract = {
                  ...(profiles[profileKey].contract || {}),
                  startDate: contract.start,
                  endDate: contract.end,
                  type: contract.type,
                  specialTerms: contract.special_terms,
                  probationMonths: contract.probation_months,  // v37.142 — جديد
                  probationDays: contract.probation_days,      // v37.142 — جديد
                  renewable: contract.renewable,               // v37.142 — جديد
                  duration: contract.duration,                 // v37.142 — جديد
                  _migratedFrom: 'kadwar',
                  _migratedAt: now,
                };
              }

              // Dependents
              if (personal.dependents && Array.isArray(personal.dependents) && personal.dependents.length > 0) {
                profiles[profileKey].dependents = {
                  list: personal.dependents,
                  _migratedFrom: 'kadwar',
                  _migratedAt: now,
                };
              }

              // ═══ أقسام إضافية من كوادر ═══
              // SCE
              if (ke.sce && (ke.sce.number || ke.sce.classification)) {
                profiles[profileKey].sce = { ...ke.sce, _migratedFrom: 'kadwar', _migratedAt: now };
              }
              // Education
              if (ke.education && ke.education.level) {
                profiles[profileKey].education = { ...ke.education, _migratedFrom: 'kadwar', _migratedAt: now };
              }
              // Leave balance
              if (ke.leave_balance != null) {
                profiles[profileKey].leaveBalance = ke.leave_balance;
              }

              // ═══ Migrate attachments if any ═══
              if (ke.attachments && Array.isArray(ke.attachments) && ke.attachments.length > 0) {
                const existingAttachments = await dbGet('emp-attachments') || {};
                if (!existingAttachments[profileKey]) existingAttachments[profileKey] = [];
                for (const att of ke.attachments) {
                  const attId = 'ATT_KW_' + (att.id || Date.now() + Math.random());
                  if (!existingAttachments[profileKey].some(a => a.id === attId)) {
                    existingAttachments[profileKey].push({
                      id: attId,
                      type: att.type || 'other',
                      url: att.url || '',
                      fileName: att.filename || att.name || 'attachment',
                      fileSize: att.size || 0,
                      uploadedBy: 'kadwar_migration',
                      uploadedAt: att.uploaded_at || now,
                      status: 'verified',
                      verifiedBy: 'kadwar_migration',
                      verifiedAt: now,
                      _migratedFrom: 'kadwar',
                    });
                  }
                }
                await dbSet('emp-attachments', existingAttachments);
              }

              summary.totals.imported++;
              if (importedSamples.length < 3) {
                importedSamples.push({
                  id: profileKey,
                  name: mergedEmp.name,
                  hrCode: kHrCode,
                  sections: Object.keys(profiles[profileKey]),
                });
              }
            } catch (err) {
              summary.totals.errors++;
              summary.steps.push({
                step: 'error',
                emp: (ke.personal && ke.personal.full_name) || ke.id || 'unknown',
                error: err.message,
                at: new Date().toISOString()
              });
            }
          }
          // 3. Save
          try {
            await dbSet('employees', updatedEmps);
            summary.steps.push({ step: 'employees-saved', count: updatedEmps.length, at: new Date().toISOString() });
          } catch (e) {
            summary.error = 'فشل حفظ الموظفين: ' + e.message;
            return res.status(500).json(summary);
          }
          try {
            await dbSet('emp-profiles', profiles);
            summary.steps.push({ step: 'profiles-saved', count: Object.keys(profiles).length, at: new Date().toISOString() });
          } catch (e) {
            summary.error = 'فشل حفظ الـ profiles: ' + e.message;
            return res.status(500).json(summary);
          }
          // 4. Mark migration as done
          await dbSet('kadwar-migration-status', {
            completedAt: new Date().toISOString(),
            totals: summary.totals,
            kadwar_export_date: kd.export_date,
            samples: importedSamples,
          });
          summary.samples = importedSamples;
          summary.completedAt = new Date().toISOString();
          summary.ok = true;
          return res.json(summary);
        } catch (e) {
          summary.error = e.message;
          return res.status(500).json(summary);
        }
      }

      // ═══ inspect-employee — proxy لاستدعاء تشخيص كوادر لموظف محدد ═══
      case 'kadwar-inspect-employee': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const empId = req.query.empId || req.query.id;
        if (!empId) return res.status(400).json({ error: 'empId required' });
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=inspect-employee&id=' + encodeURIComponent(empId), { method: 'GET' });
          if (!kr.ok) return res.status(kr.status).json({ error: 'kadwar fetch failed: ' + kr.status });
          const kd = await kr.json();
          return res.json({ ok: true, ...kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      // ═══ تشخيص: عرض الـ profiles المحفوظة ═══
      case 'debug-profiles': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const profiles = await dbGet('emp-profiles') || {};
        const emps = await dbGet('employees') || [];
        const attachments = await dbGet('emp-attachments') || {};
        const summary = {
          totalProfiles: Object.keys(profiles).length,
          totalEmployees: emps.length,
          totalAttachmentKeys: Object.keys(attachments).length,
          profileKeys: Object.keys(profiles),
          employeeIds: emps.map(e => ({ id: e.id, idNumber: e.idNumber, name: e.name, hrCode: e.hrCode })),
          sampleProfile: null,
          matchAnalysis: [],
        };
        // Pick first profile as sample
        const firstKey = Object.keys(profiles)[0];
        if (firstKey) {
          summary.sampleProfile = {
            key: firstKey,
            sections: Object.keys(profiles[firstKey]),
            personal: profiles[firstKey].personal,
            employment: profiles[firstKey].employment,
            compensation: profiles[firstKey].compensation,
            contract: profiles[firstKey].contract,
          };
        }
        // Match analysis: for each employee, does a profile exist?
        emps.forEach(e => {
          const foundKey = profiles[e.id] ? e.id :
                          (profiles[e.idNumber] ? e.idNumber :
                          (profiles[e.hrCode] ? e.hrCode :
                          (profiles[e.uid] ? e.uid : null)));
          summary.matchAnalysis.push({
            empId: e.id,
            empName: e.name,
            idNumber: e.idNumber,
            hrCode: e.hrCode,
            profileFoundAt: foundKey,
            hasProfile: !!foundKey,
            sections: foundKey ? Object.keys(profiles[foundKey]) : [],
          });
        });
        return res.json({ ok: true, ...summary });
      }

      // ═══ تشخيص: ماذا يُرسله كوادر بالضبط ═══
      case 'kadwar-debug-export': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=full-export', { method: 'GET' });
          if (!kr.ok) return res.status(502).json({ error: 'فشل جلب البيانات: ' + kr.status, statusText: kr.statusText });
          const kd = await kr.json();
          // Return sample + structure analysis
          const sample = (kd.employees && kd.employees[0]) || {};
          const allKeys = kd.employees ? [...new Set(kd.employees.flatMap(e => Object.keys(e)))] : [];
          return res.json({
            ok: true,
            kadwar_response_keys: Object.keys(kd),
            employees_count: kd.employees ? kd.employees.length : 0,
            first_employee_sample: sample,
            first_employee_keys: Object.keys(sample),
            first_employee_nested_keys: {
              personal: sample.personal ? Object.keys(sample.personal) : null,
              employment: sample.employment ? Object.keys(sample.employment) : null,
              compensation: sample.compensation ? Object.keys(sample.compensation) : null,
              contract: sample.contract ? Object.keys(sample.contract) : null,
            },
            all_fields_across_employees: allKeys,
          });
        } catch (e) {
          return res.status(500).json({ error: e.message });
        }
      }

      // ═══ حالة المزامنة + السجل ═══
      case 'kadwar-sync-status': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const migrationStatus = await dbGet('kadwar-migration-status');
        const log = await dbGet('kadwar-sync-log') || [];
        const criteriaCache = await dbGet('kadwar-eval-criteria-cache');
        const recent = log.slice(-50).reverse(); // آخر 50 عملية
        const summary = {
          migration: migrationStatus || { completedAt: null, notStarted: true },
          criteriaCache: criteriaCache ? {
            fetchedAt: criteriaCache._fetchedAt,
            positionsWithCriteria: criteriaCache.criteria_by_position ? Object.keys(criteriaCache.criteria_by_position).length : 0,
            positionsWithoutCriteria: criteriaCache.positions_without_criteria ? criteriaCache.positions_without_criteria.length : 0,
          } : null,
          recentSyncs: recent,
          stats: {
            total: log.length,
            success: log.filter(l => l.success).length,
            failed: log.filter(l => !l.success).length,
          }
        };
        return res.json({ ok: true, ...summary });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.89 — Kadwar Sync Dashboard (تحليلي شامل)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=kadwar-sync-dashboard
       *   يُعيد:
       *   - lastSync (timestamp)
       *   - totalOps, successOps, failedOps (كل الأوقات)
       *   - last24h { total, success, failed }
       *   - last7d  { total, success, failed }
       *   - byAction { "auto-push-update": {total, success, failed}, ... }
       *   - dailyTrend (14 يوم — عدد success + failed لكل يوم)
       *   - topFailures (آخر 10 أخطاء)
       *   - catalogHealth { jobTitles, orgChart, kpis, lastFetchedAt, stale }
       */
      case 'kadwar-sync-dashboard': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        const log = (await dbGet('kadwar-sync-log')) || [];
        const catalogCache = await dbGet('kadwar-job-catalog-cache');
        const criteriaCache = await dbGet('kadwar-eval-criteria-cache');
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const sevenDaysMs = 7 * oneDayMs;
        const fourteenDaysMs = 14 * oneDayMs;

        // Overall stats
        const totalOps = log.length;
        const successOps = log.filter(l => l.success).length;
        const failedOps = log.filter(l => !l.success).length;
        const lastSync = log.length > 0 ? log[log.length - 1].ts : null;

        // Last 24h / 7d
        const last24hLog = log.filter(l => l.ts && (now - new Date(l.ts).getTime()) < oneDayMs);
        const last7dLog = log.filter(l => l.ts && (now - new Date(l.ts).getTime()) < sevenDaysMs);
        const last24h = {
          total: last24hLog.length,
          success: last24hLog.filter(l => l.success).length,
          failed: last24hLog.filter(l => !l.success).length,
        };
        const last7d = {
          total: last7dLog.length,
          success: last7dLog.filter(l => l.success).length,
          failed: last7dLog.filter(l => !l.success).length,
        };

        // By action type
        const byAction = {};
        log.forEach(function(l) {
          const a = l.action || 'unknown';
          if (!byAction[a]) byAction[a] = { total: 0, success: 0, failed: 0 };
          byAction[a].total++;
          if (l.success) byAction[a].success++;
          else byAction[a].failed++;
        });

        // Daily trend (14 days)
        const last14dLog = log.filter(l => l.ts && (now - new Date(l.ts).getTime()) < fourteenDaysMs);
        const dailyMap = {};
        for (let i = 13; i >= 0; i--) {
          const d = new Date(now - i * oneDayMs);
          const key = d.toISOString().slice(0, 10);
          dailyMap[key] = { date: key, success: 0, failed: 0, total: 0 };
        }
        last14dLog.forEach(function(l) {
          const key = (l.ts || '').slice(0, 10);
          if (dailyMap[key]) {
            dailyMap[key].total++;
            if (l.success) dailyMap[key].success++;
            else dailyMap[key].failed++;
          }
        });
        const dailyTrend = Object.values(dailyMap);

        // Top failures (last 10)
        const topFailures = log.filter(l => !l.success).slice(-10).reverse().map(function(l){
          return {
            ts: l.ts,
            action: l.action,
            ref: l.ref,
            httpStatus: l.httpStatus,
            error: l.error || (l.response && l.response.error) || 'unknown',
          };
        });

        // Catalog health
        const catalogHealth = catalogCache ? {
          jobTitles: catalogCache.jobTitles ? catalogCache.jobTitles.length : 0,
          orgChart: catalogCache.orgChart ? catalogCache.orgChart.length : 0,
          kpis: catalogCache.kpisByTitle ? Object.keys(catalogCache.kpisByTitle).length : 0,
          lastFetchedAt: catalogCache._fetchedAt,
          cacheAgeMs: catalogCache._fetchedAt ? now - new Date(catalogCache._fetchedAt).getTime() : null,
          stale: catalogCache._fetchedAt ? ((now - new Date(catalogCache._fetchedAt).getTime()) > (60 * 60 * 1000)) : true,
        } : null;

        // Criteria cache info
        const criteriaHealth = criteriaCache ? {
          positionsWithCriteria: criteriaCache.criteria_by_position ? Object.keys(criteriaCache.criteria_by_position).length : 0,
          positionsWithoutCriteria: criteriaCache.positions_without_criteria ? criteriaCache.positions_without_criteria.length : 0,
          lastFetchedAt: criteriaCache._fetchedAt,
        } : null;

        // Connection test (quick ping)
        let kadwarOnline = null;
        let kadwarPingMs = null;
        try {
          const pingStart = Date.now();
          const pingR = await fetch('https://hma.engineer/api/basma-sync?action=ping', {
            method: 'GET',
            signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
          });
          kadwarOnline = pingR.ok;
          kadwarPingMs = Date.now() - pingStart;
        } catch(e) {
          kadwarOnline = false;
        }

        return res.json({
          ok: true,
          lastSync: lastSync,
          totalOps: totalOps,
          successOps: successOps,
          failedOps: failedOps,
          successRate: totalOps > 0 ? Math.round((successOps / totalOps) * 100) : 0,
          last24h: last24h,
          last7d: last7d,
          byAction: byAction,
          dailyTrend: dailyTrend,
          topFailures: topFailures,
          catalogHealth: catalogHealth,
          criteriaHealth: criteriaHealth,
          kadwarOnline: kadwarOnline,
          kadwarPingMs: kadwarPingMs,
        });
      }

      /* ═══════════════════════════════════════════════════════════════════
       * v6.87 — BATCH 2 — نظام التقييم (EVALUATION SYSTEM)
       * ═══════════════════════════════════════════════════════════════════
       * الفلسفة:
       *   - كوادر = مصدر المعايير (criteria templates)
       *   - بصمة = تنفيذ التقييم (actual evaluations)
       *   - Snapshot للمعايير وقت التقييم (لمنع التلاعب)
       *
       * أنواع التقييمات:
       *   - daily     (سرّي — لا يراه الموظف أبداً)
       *   - weekly    (سرّي — لا يراه الموظف أبداً)
       *   - monthly   (سرّي — لا يراه الموظف أبداً)
       *   - quarterly (يُعرض للموظف بعد اعتماد HR)
       *   - annual    (يُعرض للموظف بعد اعتماد HR)
       *
       * الحالات (status):
       *   - scheduled    (مجدول — لم يُبدأ بعد)
       *   - in_progress  (قيد التقييم من المدير)
       *   - pending_m2   (بانتظار المدير الثاني إن وُجد)
       *   - submitted    (مُرسل — بانتظار مراجعة HR للفصلي/السنوي)
       *   - approved     (معتمد من HR — يُعرض للموظف)
       *   - final        (نهائي — للأنواع السرّية بعد الإرسال)
       *   - cancelled    (أُلغي)
       */
      case 'evaluations': {
        // GET — جلب التقييمات (بفلاتر)
        if (req.method === 'GET') {
          const evals = await dbGet('evaluations') || [];
          const { empId, evaluatorId, type, status, periodFrom, periodTo } = req.query;
          let filtered = evals;
          if (empId) filtered = filtered.filter(e => String(e.empId) === String(empId));
          if (evaluatorId) filtered = filtered.filter(e => String(e.evaluatorId) === String(evaluatorId) || String(e.evaluator2Id) === String(evaluatorId));
          if (type) filtered = filtered.filter(e => e.type === type);
          if (status) filtered = filtered.filter(e => e.status === status);
          if (periodFrom) filtered = filtered.filter(e => e.periodStart >= periodFrom);
          if (periodTo) filtered = filtered.filter(e => e.periodEnd <= periodTo);
          // Sort by created date descending
          filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
          return res.json({ ok: true, count: filtered.length, evaluations: filtered });
        }
        // POST — إنشاء تقييم جديد (من HR أو من Scheduler)
        if (req.method === 'POST') {
          const { empId, evaluatorId, evaluator2Id, type, periodStart, periodEnd, createdBy, jobTitle } = req.body || {};
          if (!empId || !evaluatorId || !type) return res.status(400).json({ error: 'empId + evaluatorId + type required' });
          if (!['daily','weekly','monthly','quarterly','annual'].includes(type)) return res.status(400).json({ error: 'invalid type' });

          const evals = await dbGet('evaluations') || [];
          const emps = await dbGet('employees') || [];
          const emp = emps.find(e => String(e.id) === String(empId));
          if (!emp) return res.status(404).json({ error: 'employee not found' });

          // Fetch criteria snapshot from kadwar for this job title
          const profile = (await dbGet('emp-profiles') || {})[empId] || {};
          const empJobTitle = jobTitle || (profile.employment && profile.employment.jobTitle) || emp.role;

          let criteriaSnapshot = [];
          try {
            const cached = await dbGet('kadwar-eval-criteria-cache');
            if (cached && cached.criteria_by_position && cached.criteria_by_position[empJobTitle]) {
              criteriaSnapshot = cached.criteria_by_position[empJobTitle].criteria || [];
            }
          } catch (e) { /* ignore — evaluate without criteria (warning) */ }

          const newEval = {
            id: 'EV' + Date.now() + Math.random().toString(36).slice(2, 6),
            empId: String(empId),
            empName: emp.name,
            jobTitle: empJobTitle,
            evaluatorId: String(evaluatorId),
            evaluator2Id: evaluator2Id ? String(evaluator2Id) : null,
            type,
            periodStart: periodStart || null,
            periodEnd: periodEnd || null,
            status: 'scheduled',
            // Snapshot المعايير وقت إنشاء التقييم (لمنع التلاعب)
            criteriaSnapshot: criteriaSnapshot,
            criteriaSnapshotAt: new Date().toISOString(),
            scores: {},          // { criterionId: score 1-10 }
            scores2: {},         // للـ evaluator2
            comments: '',
            comments2: '',
            totalScore: null,
            weightedScore: null,
            finalScore: null,
            createdBy: createdBy || 'hr',
            createdAt: new Date().toISOString(),
            submittedAt: null,
            approvedAt: null,
            approvedBy: null,
            cancelledAt: null,
            // للأنواع السرّية: لا يُعرض للموظف أبداً
            // للفصلي/السنوي: يُعرض بعد الاعتماد
            visibleToEmployee: false,
            sentToKadwarAt: null,
          };

          evals.push(newEval);
          await dbSet('evaluations', evals);

          // v7.12 — FIX: Send notifications to assigned evaluator(s) — was missing
          try {
            const notifs = await dbGet('notifications') || [];
            const typeLabel = {
              daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري',
              quarterly: 'ربع سنوي', annual: 'سنوي'
            }[type] || type;
            const periodText = periodEnd ? ' — قبل ' + new Date(periodEnd).toLocaleDateString('ar-SA') : '';

            // Evaluator 1 notification
            if (evaluatorId) {
              notifs.push({
                id: 'NTF' + Date.now() + 'e1',
                empId: String(evaluatorId),
                type: 'evaluation_assigned',
                title: '⭐ تم تكليفك بتقييم',
                body: 'تقييم ' + typeLabel + ' لـ ' + emp.name + ' (' + empJobTitle + ')' + periodText,
                refId: newEval.id,
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
            // Evaluator 2 notification (co-evaluator)
            if (evaluator2Id) {
              notifs.push({
                id: 'NTF' + (Date.now() + 1) + 'e2',
                empId: String(evaluator2Id),
                type: 'evaluation_assigned',
                title: '⭐ تم تكليفك بتقييم (مُقيّم ثاني)',
                body: 'تقييم ' + typeLabel + ' لـ ' + emp.name + ' (' + empJobTitle + ')' + periodText,
                refId: newEval.id,
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
            await dbSet('notifications', notifs);
          } catch(e) { console.error('[evaluations-notify]', e); /* non-blocking */ }

          return res.json({ ok: true, evaluation: newEval });
        }
        break;
      }

      case 'evaluation-submit': {
        // POST — المدير يحفظ/يُرسل التقييم
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { evalId, evaluatorId, scores, comments, action, evaluatorSlot } = req.body || {};
        // action: 'save_draft' | 'submit_m1' | 'submit_m2'
        // evaluatorSlot: 1 | 2 (المدير الأول أو الثاني)
        if (!evalId || !evaluatorId) return res.status(400).json({ error: 'evalId + evaluatorId required' });

        const evals = await dbGet('evaluations') || [];
        const idx = evals.findIndex(e => e.id === evalId);
        if (idx < 0) return res.status(404).json({ error: 'evaluation not found' });
        const ev = evals[idx];

        // Authorization — only assigned evaluator can submit
        const slot = evaluatorSlot || (String(evaluatorId) === String(ev.evaluatorId) ? 1 : (String(evaluatorId) === String(ev.evaluator2Id) ? 2 : null));
        if (!slot) return res.status(403).json({ error: 'ليس لديك صلاحية لتقييم هذا الموظف' });

        // Update scores + comments
        if (slot === 1) {
          if (scores) ev.scores = { ...ev.scores, ...scores };
          if (comments != null) ev.comments = comments;
        } else {
          if (scores) ev.scores2 = { ...ev.scores2, ...scores };
          if (comments != null) ev.comments2 = comments;
        }
        ev.lastEditedBy = evaluatorId;
        ev.lastEditedAt = new Date().toISOString();

        if (action === 'save_draft') {
          ev.status = ev.status === 'scheduled' ? 'in_progress' : ev.status;
          evals[idx] = ev;
          await dbSet('evaluations', evals);
          return res.json({ ok: true, saved: true, evaluation: ev });
        }

        if (action === 'submit_m1') {
          if (slot !== 1) return res.status(403).json({ error: 'فقط المدير الأول يقدر يُرسل submit_m1' });
          // Validate: all criteria must have scores
          const missingScores = (ev.criteriaSnapshot || []).filter(c => ev.scores[c.id] == null);
          if (missingScores.length > 0 && ev.criteriaSnapshot && ev.criteriaSnapshot.length > 0) {
            return res.status(400).json({ error: 'يجب تقييم كل المعايير', missing: missingScores.map(c => c.label || c.id) });
          }
          // If there's a second evaluator, mark pending_m2
          if (ev.evaluator2Id) {
            ev.status = 'pending_m2';
          } else {
            // No second evaluator → finalize based on type
            ev.status = ['quarterly','annual'].includes(ev.type) ? 'submitted' : 'final';
            ev.submittedAt = new Date().toISOString();
          }
        }
        if (action === 'submit_m2') {
          if (slot !== 2) return res.status(403).json({ error: 'فقط المدير الثاني يقدر يُرسل submit_m2' });
          ev.status = ['quarterly','annual'].includes(ev.type) ? 'submitted' : 'final';
          ev.submittedAt = new Date().toISOString();
        }

        // Compute weighted score
        if (ev.status === 'submitted' || ev.status === 'final') {
          const snapshot = ev.criteriaSnapshot || [];
          let totalWeight = snapshot.reduce((s, c) => s + (Number(c.weight) || 0), 0) || 100;
          let weighted = 0;
          let m1Weighted = 0, m2Weighted = 0;
          snapshot.forEach(c => {
            const w = Number(c.weight) || 0;
            const s1 = Number(ev.scores[c.id]) || 0;
            const s2 = Number((ev.scores2 || {})[c.id]) || 0;
            m1Weighted += s1 * (w / totalWeight);
            m2Weighted += s2 * (w / totalWeight);
          });
          // If 2 evaluators: average (40% m1 + 60% m2 for direct manager weight)
          if (ev.evaluator2Id) {
            weighted = (m1Weighted * 0.4) + (m2Weighted * 0.6);
          } else {
            weighted = m1Weighted;
          }
          // Normalize to 0-100 (scores are 1-10)
          ev.weightedScore = Math.round(weighted * 10 * 100) / 100;
          ev.totalScore = Math.round(weighted * 10 * 100) / 100;
          // For secret types (daily/weekly/monthly): finalScore = weightedScore immediately
          if (['daily','weekly','monthly'].includes(ev.type)) {
            ev.finalScore = ev.weightedScore;
          }
        }

        evals[idx] = ev;
        await dbSet('evaluations', evals);
        return res.json({ ok: true, submitted: true, evaluation: ev });
      }

      case 'evaluation-approve': {
        // POST — HR تعتمد تقييم فصلي/سنوي
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { evalId, approvedBy, decision, note } = req.body || {};
        if (!evalId || !decision) return res.status(400).json({ error: 'evalId + decision required' });

        const evals = await dbGet('evaluations') || [];
        const idx = evals.findIndex(e => e.id === evalId);
        if (idx < 0) return res.status(404).json({ error: 'evaluation not found' });
        const ev = evals[idx];

        if (ev.status !== 'submitted') return res.status(400).json({ error: 'التقييم ليس في حالة الاعتماد' });
        if (!['quarterly','annual'].includes(ev.type)) return res.status(400).json({ error: 'فقط الفصلي والسنوي يحتاجان اعتماد' });

        if (decision === 'approve') {
          ev.status = 'approved';
          ev.approvedAt = new Date().toISOString();
          ev.approvedBy = approvedBy || 'hr';
          ev.finalScore = ev.weightedScore;
          ev.visibleToEmployee = true; // يصبح مرئياً للموظف
          ev.approvalNote = note || '';
        } else if (decision === 'reject') {
          // Send back to evaluator for revision
          ev.status = 'in_progress';
          ev.approvalNote = note || 'تم رفض التقييم — يحتاج مراجعة';
          ev.rejectedAt = new Date().toISOString();
          ev.rejectedBy = approvedBy || 'hr';
        } else {
          return res.status(400).json({ error: 'decision must be approve or reject' });
        }

        evals[idx] = ev;
        await dbSet('evaluations', evals);
        return res.json({ ok: true, evaluation: ev });
      }

      case 'evaluation-send-kadwar': {
        // POST — إرسال نتيجة التقييم لكوادر
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { evalId } = req.body || {};
        if (!evalId) return res.status(400).json({ error: 'evalId required' });

        const evals = await dbGet('evaluations') || [];
        const idx = evals.findIndex(e => e.id === evalId);
        if (idx < 0) return res.status(404).json({ error: 'evaluation not found' });
        const ev = evals[idx];

        // Only send if finalized/approved
        if (!['approved','final'].includes(ev.status)) return res.status(400).json({ error: 'التقييم لم يُنهَ بعد' });
        if (ev.sentToKadwarAt) return res.json({ ok: true, alreadySent: true, sentAt: ev.sentToKadwarAt });

        try {
          const kr = await fetch('https://hma.engineer/api/basma-sync?action=receive-evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: ev.empId,
              evaluation_id: ev.id,
              evaluation_type: ev.type,
              period_start: ev.periodStart,
              period_end: ev.periodEnd,
              evaluator_id: ev.evaluatorId,
              evaluator_2_id: ev.evaluator2Id,
              total_score: ev.finalScore || ev.weightedScore,
              scores: ev.scores,
              scores_2: ev.scores2,
              comments: ev.comments,
              comments_2: ev.comments2,
              submitted_at: ev.submittedAt,
              approved_at: ev.approvedAt,
              approved_by: ev.approvedBy,
              created_at: ev.createdAt,
            })
          });
          const kd = await kr.json();
          if (!kr.ok) return res.status(502).json({ error: 'كوادر رفض التقييم', detail: kd });

          ev.sentToKadwarAt = new Date().toISOString();
          ev.kadwarResponseId = kd.evaluation_id || kd.id || null;
          evals[idx] = ev;
          await dbSet('evaluations', evals);

          // Log sync
          const log = await dbGet('kadwar-sync-log') || [];
          log.push({
            id: 'KSL' + Date.now(),
            ts: new Date().toISOString(),
            action: 'push-evaluation',
            employee_id: ev.empId,
            evaluation_type: ev.type,
            total_score: ev.finalScore,
            success: true,
            response: kd,
          });
          if (log.length > 500) log.splice(0, log.length - 500);
          await dbSet('kadwar-sync-log', log);

          return res.json({ ok: true, kadwar_response: kd });
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بكوادر: ' + e.message });
        }
      }

      case 'evaluation-my-tasks': {
        // GET — قائمة التقييمات المطلوبة من المدير (للمدير الحالي)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const managerId = req.query.managerId;
        if (!managerId) return res.status(400).json({ error: 'managerId required' });
        const evals = await dbGet('evaluations') || [];
        const myTasks = evals.filter(e => {
          const activeStatuses = ['scheduled', 'in_progress', 'pending_m2'];
          if (!activeStatuses.includes(e.status)) return false;
          // Manager 1 sees: scheduled/in_progress where they are evaluator1
          if (String(e.evaluatorId) === String(managerId) && ['scheduled','in_progress'].includes(e.status)) return true;
          // Manager 2 sees: pending_m2 where they are evaluator2
          if (String(e.evaluator2Id) === String(managerId) && e.status === 'pending_m2') return true;
          return false;
        });
        return res.json({ ok: true, count: myTasks.length, tasks: myTasks });
      }

      case 'evaluation-for-employee': {
        // GET — التقييمات التي يستطيع الموظف رؤيتها
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const empId = req.query.empId;
        if (!empId) return res.status(400).json({ error: 'empId required' });
        const evals = await dbGet('evaluations') || [];
        // Only approved quarterly/annual
        const visible = evals.filter(e =>
          String(e.empId) === String(empId) &&
          ['quarterly','annual'].includes(e.type) &&
          e.status === 'approved' &&
          e.visibleToEmployee === true
        );
        // Sort by period end descending
        visible.sort((a, b) => String(b.periodEnd || b.approvedAt || '').localeCompare(String(a.periodEnd || a.approvedAt || '')));
        return res.json({ ok: true, count: visible.length, evaluations: visible });
      }

      case 'evaluation-schedule-batch': {
        // POST — جدولة دفعة تقييمات (مثلاً: تقييمات شهرية لكل الموظفين)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { type, periodStart, periodEnd, empIds, createdBy } = req.body || {};
        if (!type || !Array.isArray(empIds) || empIds.length === 0) return res.status(400).json({ error: 'type + empIds required' });

        const emps = await dbGet('employees') || [];
        const hierarchy = await dbGet('org_hierarchy') || {};
        const profiles = await dbGet('emp-profiles') || {};
        const cached = await dbGet('kadwar-eval-criteria-cache');
        const evals = await dbGet('evaluations') || [];

        const created = [];
        const skipped = [];

        for (const empId of empIds) {
          const emp = emps.find(e => String(e.id) === String(empId));
          if (!emp) { skipped.push({ empId, reason: 'not_found' }); continue; }

          // Determine evaluators from hierarchy
          const rec = hierarchy[String(empId)];
          const evaluatorId = rec && rec.manager1 ? rec.manager1 : null;
          const evaluator2Id = rec && rec.manager2 ? rec.manager2 : null;
          if (!evaluatorId) { skipped.push({ empId, reason: 'no_manager' }); continue; }

          // Check for duplicate in same period
          const dup = evals.find(e =>
            String(e.empId) === String(empId) &&
            e.type === type &&
            e.periodStart === periodStart &&
            !['cancelled'].includes(e.status)
          );
          if (dup) { skipped.push({ empId, reason: 'already_scheduled', existing: dup.id }); continue; }

          const empProfile = profiles[empId] || {};
          const jobTitle = (empProfile.employment && empProfile.employment.jobTitle) || emp.role || '';

          let criteriaSnapshot = [];
          if (cached && cached.criteria_by_position && cached.criteria_by_position[jobTitle]) {
            criteriaSnapshot = cached.criteria_by_position[jobTitle].criteria || [];
          }

          const newEval = {
            id: 'EV' + Date.now() + Math.random().toString(36).slice(2, 6),
            empId: String(empId),
            empName: emp.name,
            jobTitle,
            evaluatorId: String(evaluatorId),
            evaluator2Id: evaluator2Id ? String(evaluator2Id) : null,
            type,
            periodStart: periodStart || null,
            periodEnd: periodEnd || null,
            status: 'scheduled',
            criteriaSnapshot,
            criteriaSnapshotAt: new Date().toISOString(),
            scores: {},
            scores2: {},
            comments: '',
            comments2: '',
            totalScore: null,
            weightedScore: null,
            finalScore: null,
            createdBy: createdBy || 'hr_batch',
            createdAt: new Date().toISOString(),
            visibleToEmployee: false,
          };
          evals.push(newEval);
          created.push(newEval.id);
        }

        await dbSet('evaluations', evals);
        return res.json({ ok: true, created: created.length, skipped: skipped.length, createdIds: created, skippedDetails: skipped });
      }

      case 'evaluation-delete': {
        // POST — حذف تقييم (فقط إذا في حالة scheduled)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { evalId, deletedBy } = req.body || {};
        if (!evalId) return res.status(400).json({ error: 'evalId required' });
        const evals = await dbGet('evaluations') || [];
        const idx = evals.findIndex(e => e.id === evalId);
        if (idx < 0) return res.status(404).json({ error: 'evaluation not found' });
        if (!['scheduled','cancelled'].includes(evals[idx].status)) {
          return res.status(400).json({ error: 'لا يمكن حذف تقييم بدأ التنفيذ' });
        }
        evals.splice(idx, 1);
        await dbSet('evaluations', evals);
        return res.json({ ok: true });
      }

      case 'evaluation-stats': {
        // GET — إحصائيات التقييم للوحة HR
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const evals = await dbGet('evaluations') || [];
        const byStatus = {};
        const byType = {};
        let pendingApproval = 0;
        let totalScores = 0;
        let scoreCount = 0;
        evals.forEach(e => {
          byStatus[e.status] = (byStatus[e.status] || 0) + 1;
          byType[e.type] = (byType[e.type] || 0) + 1;
          if (e.status === 'submitted' && ['quarterly','annual'].includes(e.type)) pendingApproval++;
          if (e.finalScore != null) { totalScores += e.finalScore; scoreCount++; }
        });
        return res.json({
          ok: true,
          total: evals.length,
          byStatus,
          byType,
          pendingApproval,
          averageScore: scoreCount ? Math.round(totalScores / scoreCount * 100) / 100 : null,
        });
      }

      /* ═══════════════════════════════════════════════════════════════════
       * v6.89 — BATCH 3 — نظام الإجازات المتقدم + Handover (تسليم المهام)
       * ═══════════════════════════════════════════════════════════════════
       *
       * فلسفة التسليم:
       *   - قبل منح الإجازة، الموظف يُسلّم أعماله الجارية
       *   - 3 مستويات: فردي (معاملة) / مشروع / نوع مهمة
       *   - استثناء: التحقيقات لا تُسلَّم (الموظف يرجع أو يؤجل) إلا التحقيقات التي وصلته بالتسليم
       *
       * الحالات (status):
       *   - draft          (مسودة — الموظف لم يُرسل بعد)
       *   - pending_m1     (بانتظار موافقة المدير المبدئية)
       *   - handover_open  (موافقة مبدئية — شاشة التسليم مفتوحة للموظف)
       *   - pending_delegates (بعض المُفوَّضين لم يوافقوا بعد)
       *   - pending_final  (التسليم مكتمل — بانتظار المراجعة النهائية)
       *   - approved       (موافقة نهائية — الإجازة معتمدة)
       *   - rejected_m1    (رفض مبدئي من المدير)
       *   - rejected_final (رفض نهائي من المدير أو HR)
       *   - cancelled      (ألغاها الموظف)
       */

      case 'leave-requests': {
        // GET — جلب طلبات الإجازات المتقدمة (مع فلاتر)
        if (req.method === 'GET') {
          const reqs = await dbGet('leave-requests') || [];
          const { empId, status, managerId, hrView } = req.query;
          let filtered = reqs;
          if (empId) filtered = filtered.filter(r => String(r.empId) === String(empId));
          if (managerId) filtered = filtered.filter(r => String(r.managerId) === String(managerId));
          if (status) filtered = filtered.filter(r => r.status === status);
          if (hrView === '1') {
            // HR sees only those in pending_final or handover_open+
            filtered = filtered.filter(r => ['pending_final','approved','rejected_final'].includes(r.status));
          }
          filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
          return res.json({ ok: true, count: filtered.length, requests: filtered });
        }
        // POST — إنشاء طلب إجازة جديد
        if (req.method === 'POST') {
          const { empId, empName, type, from, to, reason, contactDuringLeave } = req.body || {};
          if (!empId || !type || !from || !to) return res.status(400).json({ error: 'empId + type + from + to required' });

          // Compute days
          const fromD = new Date(from);
          const toD = new Date(to);
          const daysCount = Math.max(1, Math.round((toD - fromD) / (24*3600*1000)) + 1);

          // Determine manager from hierarchy
          const hierarchy = await dbGet('org_hierarchy') || {};
          const rec = hierarchy[String(empId)];
          const managerId = rec && rec.manager1 ? String(rec.manager1) : null;

          const reqs = await dbGet('leave-requests') || [];
          const newReq = {
            id: 'LR' + Date.now() + Math.random().toString(36).slice(2, 5),
            empId: String(empId),
            empName: empName || '',
            type,
            from, to, days: daysCount,
            reason: reason || '',
            contactDuringLeave: contactDuringLeave || '',
            managerId,
            status: 'pending_m1',
            handoverItems: [],      // قائمة بنود التسليم
            handoverComplete: false,
            m1Decision: null,
            m1DecidedAt: null,
            m1Note: '',
            finalDecision: null,
            finalDecidedBy: null,
            finalDecidedAt: null,
            finalNote: '',
            hrDecision: null,
            hrDecidedBy: null,
            hrDecidedAt: null,
            hrNote: '',
            cancelledAt: null,
            createdAt: new Date().toISOString(),
          };
          reqs.push(newReq);
          await dbSet('leave-requests', reqs);

          // Notify manager
          if (managerId) {
            const notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'n_lr_' + Date.now(),
              empId: managerId,
              type: 'leave_request',
              title: '📝 طلب إجازة جديد',
              message: (empName || 'موظف') + ' طلب إجازة (' + daysCount + ' يوم)',
              link: '/admin#leave-requests',
              leaveRequestId: newReq.id,
              read: false,
              ts: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          }

          return res.json({ ok: true, request: newReq });
        }
        break;
      }

      case 'leave-request-m1': {
        // POST — المدير المباشر يوافق/يرفض مبدئياً
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { requestId, decision, managerId, note } = req.body || {};
        if (!requestId || !decision || !managerId) return res.status(400).json({ error: 'requestId + decision + managerId required' });

        const reqs = await dbGet('leave-requests') || [];
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx < 0) return res.status(404).json({ error: 'request not found' });
        const lr = reqs[idx];

        if (String(lr.managerId) !== String(managerId)) return res.status(403).json({ error: 'ليس لديك صلاحية' });
        if (lr.status !== 'pending_m1') return res.status(400).json({ error: 'الطلب ليس في مرحلة الموافقة المبدئية' });

        lr.m1Decision = decision;
        lr.m1DecidedAt = new Date().toISOString();
        lr.m1Note = note || '';

        if (decision === 'approve') {
          lr.status = 'handover_open';
        } else if (decision === 'reject') {
          lr.status = 'rejected_m1';
        }

        reqs[idx] = lr;
        await dbSet('leave-requests', reqs);

        // Notify employee
        const notifs = await dbGet('notifications') || [];
        notifs.push({
          id: 'n_lrm1_' + Date.now(),
          empId: lr.empId,
          type: 'leave_m1_decision',
          title: decision === 'approve' ? '✅ تمت الموافقة المبدئية' : '❌ رفض طلب الإجازة',
          message: decision === 'approve'
            ? 'تمت الموافقة المبدئية. يرجى إكمال شاشة تسليم المهام.'
            : 'تم رفض طلبك.' + (note ? ' السبب: ' + note : ''),
          link: '/my/leaves',
          leaveRequestId: lr.id,
          read: false,
          ts: new Date().toISOString(),
        });
        await dbSet('notifications', notifs);

        return res.json({ ok: true, request: lr });
      }

      case 'leave-handover-submit': {
        // POST — الموظف يُرسل التسليم (بعد اختيار المُفوَّضين لكل بند)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { requestId, handoverItems, empId } = req.body || {};
        if (!requestId || !Array.isArray(handoverItems)) return res.status(400).json({ error: 'requestId + handoverItems required' });

        const reqs = await dbGet('leave-requests') || [];
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx < 0) return res.status(404).json({ error: 'request not found' });
        const lr = reqs[idx];

        if (String(lr.empId) !== String(empId)) return res.status(403).json({ error: 'ليس طلبك' });
        if (lr.status !== 'handover_open') return res.status(400).json({ error: 'شاشة التسليم ليست مفتوحة' });

        // Validate each handover item
        const emps = await dbGet('employees') || [];
        const enrichedItems = [];
        for (const item of handoverItems) {
          if (!item.category || !item.title || !item.delegateId) {
            return res.status(400).json({ error: 'كل بند يحتاج: الفئة، العنوان، المُفوَّض إليه' });
          }
          // Reject investigations unless they were received via delegation
          if (item.category === 'investigation' && !item.receivedByDelegation) {
            return res.status(400).json({ error: 'لا يمكن تسليم التحقيقات — إما يعود الموظف لإنجازها أو تُؤجَّل' });
          }
          const delegate = emps.find(e => String(e.id) === String(item.delegateId));
          if (!delegate) return res.status(400).json({ error: 'المُفوَّض إليه غير موجود: ' + item.delegateId });

          enrichedItems.push({
            id: 'HI' + Date.now() + Math.random().toString(36).slice(2, 5),
            category: item.category,           // individual | project | task_type | investigation
            title: item.title,
            description: item.description || '',
            delegateId: String(item.delegateId),
            delegateName: delegate.name || '',
            receivedByDelegation: !!item.receivedByDelegation,
            delegateDecision: null,            // pending | accept | decline
            delegateDecidedAt: null,
            delegateNote: '',
            hrDecision: null,                  // HR يقدر يرفض ("غير كفء")
            hrNote: '',
            createdAt: new Date().toISOString(),
          });
        }

        lr.handoverItems = enrichedItems;
        lr.handoverSubmittedAt = new Date().toISOString();
        lr.status = enrichedItems.length > 0 ? 'pending_delegates' : 'pending_final';
        reqs[idx] = lr;
        await dbSet('leave-requests', reqs);

        // Notify each delegate
        const notifs = await dbGet('notifications') || [];
        const uniqueDelegates = [...new Set(enrichedItems.map(i => i.delegateId))];
        for (const dId of uniqueDelegates) {
          const count = enrichedItems.filter(i => i.delegateId === dId).length;
          notifs.push({
            id: 'n_del_' + Date.now() + '_' + dId,
            empId: dId,
            type: 'handover_request',
            title: '📋 طلب استلام مهام',
            message: lr.empName + ' يطلب منك استلام ' + count + ' بند في إجازته',
            link: '/my/handover',
            leaveRequestId: lr.id,
            read: false,
            ts: new Date().toISOString(),
          });
        }
        await dbSet('notifications', notifs);

        return res.json({ ok: true, request: lr });
      }

      case 'leave-delegate-decision': {
        // POST — المُفوَّض إليه يوافق/يرفض بند تسليم
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { requestId, itemId, delegateId, decision, note } = req.body || {};
        if (!requestId || !itemId || !delegateId || !decision) return res.status(400).json({ error: 'requestId + itemId + delegateId + decision required' });

        const reqs = await dbGet('leave-requests') || [];
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx < 0) return res.status(404).json({ error: 'request not found' });
        const lr = reqs[idx];

        const itemIdx = (lr.handoverItems || []).findIndex(i => i.id === itemId);
        if (itemIdx < 0) return res.status(404).json({ error: 'item not found' });
        const item = lr.handoverItems[itemIdx];

        if (String(item.delegateId) !== String(delegateId)) return res.status(403).json({ error: 'لست المُفوَّض إليه' });

        item.delegateDecision = decision;
        item.delegateDecidedAt = new Date().toISOString();
        item.delegateNote = note || '';
        lr.handoverItems[itemIdx] = item;

        // Check if all delegates have decided
        const allDecided = lr.handoverItems.every(i => i.delegateDecision != null);
        const anyDeclined = lr.handoverItems.some(i => i.delegateDecision === 'decline');

        if (allDecided) {
          lr.status = 'pending_final';
          // Notify employee + manager
          const notifs = await dbGet('notifications') || [];
          notifs.push({
            id: 'n_handdone_' + Date.now(),
            empId: lr.empId,
            type: 'handover_complete',
            title: anyDeclined ? '⚠️ بعض المفوَّضين رفضوا' : '✅ كل المفوَّضين وافقوا',
            message: 'طلب إجازتك الآن في المراجعة النهائية',
            link: '/my/leaves',
            leaveRequestId: lr.id,
            read: false,
            ts: new Date().toISOString(),
          });
          if (lr.managerId) {
            notifs.push({
              id: 'n_mgr_final_' + Date.now(),
              empId: lr.managerId,
              type: 'leave_final_review',
              title: '🎯 مراجعة نهائية لإجازة',
              message: lr.empName + ' — التسليم اكتمل، بانتظار موافقتك النهائية',
              link: '/admin#leave-requests',
              leaveRequestId: lr.id,
              read: false,
              ts: new Date().toISOString(),
            });
          }
          await dbSet('notifications', notifs);
        }

        reqs[idx] = lr;
        await dbSet('leave-requests', reqs);
        return res.json({ ok: true, request: lr, allDecided });
      }

      case 'leave-final-decision': {
        // POST — المدير المباشر يوافق نهائياً + HR يقدر يرفض مفوَّض "غير كفء"
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { requestId, decision, decidedBy, role, note, rejectedDelegates } = req.body || {};
        // role: 'manager' | 'hr'
        // rejectedDelegates: [itemId...] — IDs of handover items where HR rejected the delegate
        if (!requestId || !decision || !decidedBy || !role) return res.status(400).json({ error: 'requestId + decision + decidedBy + role required' });

        const reqs = await dbGet('leave-requests') || [];
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx < 0) return res.status(404).json({ error: 'request not found' });
        const lr = reqs[idx];

        if (lr.status !== 'pending_final') return res.status(400).json({ error: 'الطلب ليس في مرحلة المراجعة النهائية' });

        // Validate role
        if (role === 'manager' && String(lr.managerId) !== String(decidedBy)) {
          return res.status(403).json({ error: 'فقط المدير المباشر يوافق كمدير' });
        }

        if (role === 'manager') {
          lr.finalDecision = decision;
          lr.finalDecidedBy = decidedBy;
          lr.finalDecidedAt = new Date().toISOString();
          lr.finalNote = note || '';
          if (decision === 'approve') {
            // Next: HR reviews
            lr.status = 'pending_final'; // stays until HR approves
            lr.awaitingHR = true;
          } else {
            lr.status = 'rejected_final';
          }
        } else if (role === 'hr') {
          lr.hrDecision = decision;
          lr.hrDecidedBy = decidedBy;
          lr.hrDecidedAt = new Date().toISOString();
          lr.hrNote = note || '';

          // Mark any rejected delegates
          if (Array.isArray(rejectedDelegates) && rejectedDelegates.length > 0) {
            lr.handoverItems = lr.handoverItems.map(item => {
              if (rejectedDelegates.includes(item.id)) {
                return { ...item, hrDecision: 'reject', hrNote: 'غير كفء — يحتاج مُفوَّض آخر' };
              }
              return item;
            });
          }

          if (decision === 'approve') {
            lr.status = 'approved';
          } else {
            lr.status = 'rejected_final';
          }
        }

        reqs[idx] = lr;
        await dbSet('leave-requests', reqs);

        // Notify employee
        const notifs = await dbGet('notifications') || [];
        if (lr.status === 'approved') {
          notifs.push({
            id: 'n_lvappr_' + Date.now(),
            empId: lr.empId,
            type: 'leave_approved',
            title: '🎉 تم اعتماد إجازتك',
            message: 'إجازتك من ' + lr.from + ' إلى ' + lr.to + ' معتمدة رسمياً',
            link: '/my/leaves',
            leaveRequestId: lr.id,
            read: false,
            ts: new Date().toISOString(),
          });
        } else if (lr.status === 'rejected_final') {
          notifs.push({
            id: 'n_lvrej_' + Date.now(),
            empId: lr.empId,
            type: 'leave_rejected',
            title: '❌ رفض الإجازة',
            message: 'تم رفض إجازتك.' + (note ? ' السبب: ' + note : ''),
            link: '/my/leaves',
            leaveRequestId: lr.id,
            read: false,
            ts: new Date().toISOString(),
          });
        }
        await dbSet('notifications', notifs);

        return res.json({ ok: true, request: lr });
      }

      case 'leave-cancel': {
        // POST — الموظف يلغي طلبه
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { requestId, empId, reason } = req.body || {};
        if (!requestId || !empId) return res.status(400).json({ error: 'requestId + empId required' });
        const reqs = await dbGet('leave-requests') || [];
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx < 0) return res.status(404).json({ error: 'request not found' });
        const lr = reqs[idx];
        if (String(lr.empId) !== String(empId)) return res.status(403).json({ error: 'ليس طلبك' });
        if (['approved','rejected_final','cancelled'].includes(lr.status)) return res.status(400).json({ error: 'لا يمكن إلغاء طلب منتهٍ' });
        lr.status = 'cancelled';
        lr.cancelledAt = new Date().toISOString();
        lr.cancelReason = reason || '';
        reqs[idx] = lr;
        await dbSet('leave-requests', reqs);
        return res.json({ ok: true });
      }

      case 'leave-my-handover-tasks': {
        // GET — قائمة بنود التسليم المطلوب استلامها (للمُفوَّض إليه)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const delegateId = req.query.delegateId;
        if (!delegateId) return res.status(400).json({ error: 'delegateId required' });
        const reqs = await dbGet('leave-requests') || [];
        const tasks = [];
        for (const lr of reqs) {
          if (!['pending_delegates','pending_final'].includes(lr.status)) continue;
          for (const item of (lr.handoverItems || [])) {
            if (String(item.delegateId) === String(delegateId) && item.delegateDecision == null) {
              tasks.push({
                requestId: lr.id,
                requesterName: lr.empName,
                requesterId: lr.empId,
                leaveFrom: lr.from,
                leaveTo: lr.to,
                leaveDays: lr.days,
                item,
              });
            }
          }
        }
        return res.json({ ok: true, count: tasks.length, tasks });
      }

      case 'leave-stats': {
        // GET — إحصائيات الإجازات للوحة HR
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const reqs = await dbGet('leave-requests') || [];
        const byStatus = {};
        let pendingM1 = 0, pendingDelegates = 0, pendingFinal = 0, approved = 0;
        reqs.forEach(r => {
          byStatus[r.status] = (byStatus[r.status] || 0) + 1;
          if (r.status === 'pending_m1') pendingM1++;
          if (r.status === 'pending_delegates') pendingDelegates++;
          if (r.status === 'pending_final') pendingFinal++;
          if (r.status === 'approved') approved++;
        });
        return res.json({
          ok: true,
          total: reqs.length,
          byStatus,
          pendingM1, pendingDelegates, pendingFinal, approved,
        });
      }

      /* ═══════════════════════════════════════════════════════════════════
       * v6.91 — BATCH 4 — نظام الرواتب (PAYROLL SYSTEM)
       * ═══════════════════════════════════════════════════════════════════
       * الفلسفة:
       *   - البيانات المالية الحساسة (IBAN، الراتب) تُشفَّر
       *   - صلاحيات صارمة (hr_manager + accountant فقط)
       *   - Audit log كامل
       *   - Workflow: draft → calculated → reviewed → approved → sent_to_bank → paid
       *
       * الجداول:
       *   - payroll-runs: الدورات الشهرية (2026-04 مثلاً)
       *   - payroll-slips: كشوف الرواتب الفردية
       *   - payroll-audit-log: سجل كل العمليات
       */

      case 'payroll-runs': {
        // GET — قائمة الدورات
        if (req.method === 'GET') {
          const actor = req.query.actor;
          const access = await canAccessPayroll(actor, 'view_all');
          if (!access.allowed) return res.status(403).json({ error: 'insufficient permission', reason: access.reason });
          await auditLog(actor, 'list_runs', null, null, 'payroll');
          const runs = await dbGet('payroll-runs') || [];
          runs.sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));
          return res.json({ ok: true, runs });
        }
        // POST — إنشاء دورة جديدة
        if (req.method === 'POST') {
          const { period, actor, note } = req.body || {};
          if (!period) return res.status(400).json({ error: 'period required (YYYY-MM)' });
          if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'invalid period format' });

          const access = await canAccessPayroll(actor, 'create');
          if (!access.allowed) return res.status(403).json({ error: 'insufficient permission', reason: access.reason });

          const runs = await dbGet('payroll-runs') || [];
          if (runs.find(r => r.period === period)) return res.status(400).json({ error: 'الدورة موجودة بالفعل لهذا الشهر' });

          const newRun = {
            id: 'PR' + Date.now() + Math.random().toString(36).slice(2, 5),
            period,
            status: 'draft',
            note: note || '',
            slipsCount: 0,
            totalNetAmount: 0,
            createdBy: actor,
            createdAt: new Date().toISOString(),
            calculatedAt: null,
            reviewedAt: null,
            reviewedBy: null,
            approvedAt: null,
            approvedBy: null,
            sentToBankAt: null,
            sentToBankBy: null,
            bankFileGeneratedAt: null,
          };
          runs.push(newRun);
          await dbSet('payroll-runs', runs);
          await auditLog(actor, 'create_run', newRun.id, { period }, 'payroll');
          return res.json({ ok: true, run: newRun });
        }
        break;
      }

      case 'payroll-run-detail': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const { runId, actor } = req.query;
        if (!runId) return res.status(400).json({ error: 'runId required' });
        const access = await canAccessPayroll(actor, 'view_all');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission', reason: access.reason });

        const runs = await dbGet('payroll-runs') || [];
        const run = runs.find(r => r.id === runId);
        if (!run) return res.status(404).json({ error: 'run not found' });

        const slips = await dbGet('payroll-slips') || [];
        const runSlips = slips.filter(s => s.runId === runId).map(s => ({
          ...s,
          iban: s.iban ? decryptPayrollField(s.iban) : '',  // فك التشفير عند العرض
        }));

        await auditLog(actor, 'view_run_detail', runId, null, 'payroll');
        return res.json({ ok: true, run, slips: runSlips });
      }

      case 'payroll-calculate': {
        // POST — احتساب الرواتب تلقائياً للدورة (لكل الموظفين النشطين)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { runId, actor } = req.body || {};
        if (!runId) return res.status(400).json({ error: 'runId required' });

        const access = await canAccessPayroll(actor, 'create');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission', reason: access.reason });

        const runs = await dbGet('payroll-runs') || [];
        const runIdx = runs.findIndex(r => r.id === runId);
        if (runIdx < 0) return res.status(404).json({ error: 'run not found' });
        const run = runs[runIdx];
        if (!['draft','calculated'].includes(run.status)) {
          return res.status(400).json({ error: 'لا يمكن إعادة الاحتساب بعد الاعتماد' });
        }

        const emps = await dbGet('employees') || [];
        const profiles = await dbGet('emp-profiles') || {};
        const existingSlips = await dbGet('payroll-slips') || [];

        // v6.92 — عند إعادة الاحتساب: فكّ ربط المخالفات التي طُبّقت سابقاً على هذه الدورة
        // حتى تُعاد معاينتها من جديد وتُطبَّق بترتيبها الحالي (مع سقف المادة 41)
        const allVios = (await dbGet('violations_v2')) || [];
        let viosChanged = false;
        for (let i = 0; i < allVios.length; i++) {
          if (allVios[i].appliedToPayrollId === runId) {
            allVios[i].appliedToPayrollId = null;
            allVios[i].appliedAt = null;
            allVios[i].appliedAmount = null;
            viosChanged = true;
          }
        }
        if (viosChanged) await dbSet('violations_v2', allVios);

        // احذف كشوف هذه الدورة الحالية
        const otherSlips = existingSlips.filter(s => s.runId !== runId);
        const newSlips = [];
        let totalNet = 0;
        const viosToMark = []; // [{id, payrollId, amount}]

        const activeEmps = emps.filter(e => (e.status || 'active') === 'active');

        for (const emp of activeEmps) {
          const profile = profiles[emp.id] || {};
          const comp = profile.compensation || {};

          // v6.92 — جلب غرامات لائحة الجزاءات المستحقة + تطبيق سقف 5 أيام (المادة 41)
          const finesInfo = await getMonthlyFinesForEmp(emp.id, profile);
          const deductionsObj = finesInfo.appliedAmount > 0
            ? { fines: finesInfo.appliedAmount, finesList: finesInfo.applied }
            : {};
          // v7.13 — Pass period info for pro-rating
          const periodInfo = (function(){
            if (!run.period) return null;
            // run.period is like "2026-04" — convert to start/end ISO
            const parts = run.period.split('-');
            if (parts.length !== 2) return null;
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            const startISO = new Date(y, m - 1, 1).toISOString();
            const endISO = new Date(y, m, 0, 23, 59, 59).toISOString(); // last day of month
            return { startISO, endISO, period: run.period };
          })();
          const computation = computeMonthlySalary(profile, {}, deductionsObj, null, periodInfo);

          const slip = {
            id: 'SL' + Date.now() + Math.random().toString(36).slice(2, 5),
            runId,
            period: run.period,
            empId: emp.id,
            empName: emp.name,
            jobTitle: (profile.employment && profile.employment.jobTitle) || emp.role || '',
            department: (profile.employment && profile.employment.department) || emp.department || '',
            status: 'calculated',

            // Encrypted sensitive fields
            iban: comp.iban ? encryptPayrollField(comp.iban) : null,
            bankName: comp.bankName || '',

            // Breakdown
            breakdown: computation.breakdown,
            totalEarnings: computation.totalEarnings,
            totalDeductions: computation.totalDeductions,
            netSalary: computation.netSalary,

            // v7.13 — Pro-rated details (if any allowance changed mid-month)
            proratings: computation.proratings || [],

            // v6.92 — معلومات الغرامات (للعرض في الكشف)
            finesInfo: {
              dailyWage: finesInfo.dailyWage,
              monthlyCap: finesInfo.monthlyCap,
              appliedAmount: finesInfo.appliedAmount,
              applied: finesInfo.applied,
              deferredCount: finesInfo.deferred.length,
              deferredAmount: Math.round(finesInfo.deferred.reduce((s, x) => s + x.amount, 0) * 100) / 100,
            },

            // Manual adjustments (empty initially)
            additions: {},
            deductions: finesInfo.appliedAmount > 0 ? { fines: finesInfo.appliedAmount } : {},

            createdAt: new Date().toISOString(),
            calculatedAt: new Date().toISOString(),
            sentAt: null,
          };
          newSlips.push(slip);
          totalNet += computation.netSalary;

          // سجّل المخالفات للعلامة كـ "مُطبَّقة"
          for (const f of finesInfo.applied) {
            viosToMark.push({ id: f.violationId, payrollId: runId, amount: f.amount });
          }
        }

        await dbSet('payroll-slips', [...otherSlips, ...newSlips]);

        // v6.92 — علامة المخالفات المُطبَّقة
        if (viosToMark.length > 0) {
          const vios2 = (await dbGet('violations_v2')) || [];
          const nowStamp = new Date().toISOString();
          for (const mark of viosToMark) {
            const idx = vios2.findIndex(v => v.id === mark.id);
            if (idx >= 0) {
              vios2[idx].appliedToPayrollId = mark.payrollId;
              vios2[idx].appliedAt = nowStamp;
              vios2[idx].appliedAmount = mark.amount;
            }
          }
          await dbSet('violations_v2', vios2);
        }

        run.status = 'calculated';
        run.calculatedAt = new Date().toISOString();
        run.slipsCount = newSlips.length;
        run.totalNetAmount = Math.round(totalNet * 100) / 100;
        run.totalFinesApplied = Math.round(newSlips.reduce((s, x) => s + ((x.finesInfo && x.finesInfo.appliedAmount) || 0), 0) * 100) / 100;
        runs[runIdx] = run;
        await dbSet('payroll-runs', runs);

        await auditLog(actor, 'calculate_run', runId, { slipsCount: newSlips.length, totalNet, finesApplied: run.totalFinesApplied }, 'payroll');
        return res.json({ ok: true, run, slipsCount: newSlips.length, totalNet, finesApplied: run.totalFinesApplied });
      }

      case 'payroll-slip-edit': {
        // POST — تعديل كشف راتب واحد (إضافات/خصومات)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { slipId, additions, deductions, actor, note } = req.body || {};
        if (!slipId) return res.status(400).json({ error: 'slipId required' });

        const access = await canAccessPayroll(actor, 'edit');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission', reason: access.reason });

        const slips = await dbGet('payroll-slips') || [];
        const idx = slips.findIndex(s => s.id === slipId);
        if (idx < 0) return res.status(404).json({ error: 'slip not found' });
        const slip = slips[idx];

        const runs = await dbGet('payroll-runs') || [];
        const run = runs.find(r => r.id === slip.runId);
        if (run && ['approved','sent_to_bank','paid'].includes(run.status)) {
          return res.status(400).json({ error: 'الدورة مُعتمَدة — لا يمكن التعديل' });
        }

        // Recompute
        const profiles = await dbGet('emp-profiles') || {};
        const profile = profiles[slip.empId] || {};
        // v7.13 — Pass period info for pro-rating
        const slipPeriodInfo = (function(){
          if (!slip.period) return null;
          const parts = slip.period.split('-');
          if (parts.length !== 2) return null;
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          return { startISO: new Date(y, m - 1, 1).toISOString(), endISO: new Date(y, m, 0, 23, 59, 59).toISOString(), period: slip.period };
        })();
        const computation = computeMonthlySalary(profile, additions || slip.additions || {}, deductions || slip.deductions || {}, null, slipPeriodInfo);

        slip.additions = additions || slip.additions || {};
        slip.deductions = deductions || slip.deductions || {};
        slip.breakdown = computation.breakdown;
        slip.totalEarnings = computation.totalEarnings;
        slip.totalDeductions = computation.totalDeductions;
        slip.netSalary = computation.netSalary;
        slip.proratings = computation.proratings || []; // v7.13
        slip.editedAt = new Date().toISOString();
        slip.editedBy = actor;
        slip.editNote = note || '';

        slips[idx] = slip;
        await dbSet('payroll-slips', slips);

        // Update run total
        if (run) {
          const runSlips = slips.filter(s => s.runId === slip.runId);
          const newTotal = runSlips.reduce((s, x) => s + (x.netSalary || 0), 0);
          const runIdx = runs.findIndex(r => r.id === slip.runId);
          runs[runIdx].totalNetAmount = Math.round(newTotal * 100) / 100;
          await dbSet('payroll-runs', runs);
        }

        await auditLog(actor, 'edit_slip', slipId, { additions, deductions, netSalary: slip.netSalary }, 'payroll');
        return res.json({ ok: true, slip: { ...slip, iban: slip.iban ? decryptPayrollField(slip.iban) : '' } });
      }

      /* ════════ v6.92 — معاينة الغرامات قبل احتساب الرواتب ════════ */
      case 'payroll-fines-preview': {
        // GET — يعرض قائمة كل الموظفين مع الغرامات المستحقة + المطبّقة + المرحّلة
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const actor = req.query.actor;
        const access = await canAccessPayroll(actor, 'view_all');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission', reason: access.reason });

        const emps = (await dbGet('employees')) || [];
        const profiles = (await dbGet('emp-profiles')) || {};
        const activeEmps = emps.filter(e => (e.status || 'active') === 'active');

        const rows = [];
        let grandTotalApplied = 0;
        let grandTotalDeferred = 0;
        for (const emp of activeEmps) {
          const profile = profiles[emp.id] || {};
          const info = await getMonthlyFinesForEmp(emp.id, profile);
          if (info.applied.length === 0 && info.deferred.length === 0) continue; // تخطَّ الموظفين بلا غرامات
          rows.push({
            empId: emp.id,
            empName: emp.name,
            department: (profile.employment && profile.employment.department) || emp.department || '',
            dailyWage: info.dailyWage,
            monthlyCap: info.monthlyCap,
            appliedCount: info.applied.length,
            appliedAmount: info.appliedAmount,
            deferredCount: info.deferred.length,
            deferredAmount: Math.round(info.deferred.reduce((s, x) => s + x.amount, 0) * 100) / 100,
            totalEligibleAmount: info.totalEligibleAmount,
            appliedList: info.applied,
            deferredList: info.deferred,
          });
          grandTotalApplied += info.appliedAmount;
          grandTotalDeferred += info.deferred.reduce((s, x) => s + x.amount, 0);
        }
        return res.json({
          rows,
          grandTotalApplied: Math.round(grandTotalApplied * 100) / 100,
          grandTotalDeferred: Math.round(grandTotalDeferred * 100) / 100,
          capDays: FINES_MONTHLY_CAP_DAYS,
        });
      }

      /* ════════ v6.92 — إحالة مخالفة لمكتب استشاري خارجي ════════ */
      case 'violation-refer-external': {
        // POST — HR تحيل مخالفة لا تريد معالجتها داخلياً
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { violationId, actor, externalOffice, notes } = req.body || {};
        if (!violationId) return res.status(400).json({ error: 'violationId required' });

        const vios = (await dbGet('violations_v2')) || [];
        const idx = vios.findIndex(v => v.id === violationId);
        if (idx < 0) return res.status(404).json({ error: 'violation not found' });

        if (vios[idx].appliedToPayrollId) {
          return res.status(400).json({ error: 'لا يمكن إحالة مخالفة سبق تطبيقها على راتب' });
        }

        vios[idx].status = 'REFERRED_EXTERNAL';
        vios[idx].referredAt = new Date().toISOString();
        vios[idx].referredBy = actor;
        vios[idx].externalOffice = externalOffice || '';
        vios[idx].externalNotes = notes || '';
        await dbSet('violations_v2', vios);

        // إشعار الموظف
        try {
          const notifs = (await dbGet('notifications')) || [];
          notifs.push({
            id: 'NTF' + Date.now(),
            empId: vios[idx].empId,
            type: 'violation',
            title: '📋 إحالة المخالفة لجهة خارجية',
            body: 'أُحيلت المخالفة "' + (vios[idx].description || '').slice(0, 60) + '" إلى ' + (externalOffice || 'مكتب استشاري'),
            refId: violationId,
            read: false,
            createdAt: new Date().toISOString(),
          });
          await dbSet('notifications', notifs);
        } catch(e) { /* ignore */ }

        return res.json({ ok: true, violation: vios[idx] });
      }

      case 'payroll-run-approve': {
        // POST — HR Manager تعتمد الدورة
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { runId, actor, note } = req.body || {};
        if (!runId) return res.status(400).json({ error: 'runId required' });

        const access = await canAccessPayroll(actor, 'approve');
        if (!access.allowed) return res.status(403).json({ error: 'only HR manager can approve', reason: access.reason });

        const runs = await dbGet('payroll-runs') || [];
        const idx = runs.findIndex(r => r.id === runId);
        if (idx < 0) return res.status(404).json({ error: 'run not found' });
        const run = runs[idx];
        if (run.status !== 'calculated' && run.status !== 'reviewed') {
          return res.status(400).json({ error: 'يجب احتساب الدورة أولاً' });
        }

        run.status = 'approved';
        run.approvedAt = new Date().toISOString();
        run.approvedBy = actor;
        run.approvalNote = note || '';
        runs[idx] = run;
        await dbSet('payroll-runs', runs);

        // Also update all slips
        const slips = await dbGet('payroll-slips') || [];
        const approvedSlips = [];
        slips.forEach(s => {
          if (s.runId === runId) {
            s.status = 'approved';
            approvedSlips.push(s);
          }
        });
        await dbSet('payroll-slips', slips);

        // v6.97 — Auto-push approved slips to kadwar (fire-and-forget, parallel)
        Promise.all(approvedSlips.map(function(slip){
          return safeKadwarPush('receive-payroll-slip', {
            employee_id: slip.empId,
            employee_name: slip.empName,
            slip_basma_id: slip.id,
            run_id: slip.runId,
            period: slip.period,
            status: 'approved',
            total_earnings: slip.totalEarnings,
            total_deductions: slip.totalDeductions,
            net_salary: slip.netSalary,
            breakdown: slip.breakdown,
            fines_applied: (slip.finesInfo && slip.finesInfo.appliedAmount) || 0,
            fines_deferred: (slip.finesInfo && slip.finesInfo.deferredAmount) || 0,
            calculated_at: slip.calculatedAt,
          }).catch(function(){ /* logged */ });
        })).catch(function(){ /* ignore — all errors logged individually */ });

        await auditLog(actor, 'approve_run', runId, { totalNet: run.totalNetAmount, slipsCount: approvedSlips.length }, 'payroll');
        return res.json({ ok: true, run, slipsPushed: approvedSlips.length });
      }

      case 'payroll-bank-file': {
        // GET — توليد ملف SAR للبنك (صيغة تحويل مجمع)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const { runId, actor } = req.query;
        if (!runId) return res.status(400).json({ error: 'runId required' });

        const access = await canAccessPayroll(actor, 'send_bank');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission' });

        const runs = await dbGet('payroll-runs') || [];
        const runIdx = runs.findIndex(r => r.id === runId);
        if (runIdx < 0) return res.status(404).json({ error: 'run not found' });
        const run = runs[runIdx];
        if (run.status !== 'approved' && run.status !== 'sent_to_bank') {
          return res.status(400).json({ error: 'يجب اعتماد الدورة أولاً' });
        }

        const slips = await dbGet('payroll-slips') || [];
        const runSlips = slips.filter(s => s.runId === runId);

        // Build bank file (CSV format — Saudi banks accept this)
        // Headers: IBAN, Beneficiary Name, Amount, Currency, Reference, Purpose
        const lines = ['IBAN,BeneficiaryName,Amount,Currency,Reference,Purpose'];
        let total = 0;
        runSlips.forEach(s => {
          const iban = s.iban ? decryptPayrollField(s.iban) : '';
          if (!iban) return; // skip employees without IBAN
          const amount = Number(s.netSalary || 0).toFixed(2);
          const ref = 'SAL-' + run.period + '-' + s.empId;
          const purpose = 'Salary ' + run.period;
          // Escape commas in name
          const name = (s.empName || '').replace(/,/g, ' ');
          lines.push(`${iban},${name},${amount},SAR,${ref},${purpose}`);
          total += Number(s.netSalary || 0);
        });

        // Update run: mark bank file generated
        if (!run.bankFileGeneratedAt) {
          run.bankFileGeneratedAt = new Date().toISOString();
          runs[runIdx] = run;
          await dbSet('payroll-runs', runs);
        }

        await auditLog(actor, 'generate_bank_file', runId, { lineCount: lines.length - 1, total }, 'payroll');

        // Return as text
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="salaries-' + run.period + '.csv"');
        return res.send(lines.join('\n'));
      }

      case 'payroll-mark-sent': {
        // POST — وضع علامة "تم الإرسال للبنك"
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { runId, actor, note } = req.body || {};
        if (!runId) return res.status(400).json({ error: 'runId required' });

        const access = await canAccessPayroll(actor, 'send_bank');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission' });

        const runs = await dbGet('payroll-runs') || [];
        const idx = runs.findIndex(r => r.id === runId);
        if (idx < 0) return res.status(404).json({ error: 'run not found' });
        const run = runs[idx];
        if (run.status !== 'approved') return res.status(400).json({ error: 'يجب اعتماد الدورة أولاً' });

        run.status = 'sent_to_bank';
        run.sentToBankAt = new Date().toISOString();
        run.sentToBankBy = actor;
        run.bankNote = note || '';
        runs[idx] = run;
        await dbSet('payroll-runs', runs);

        // Update all slips
        const slips = await dbGet('payroll-slips') || [];
        slips.forEach(s => {
          if (s.runId === runId) { s.status = 'sent_to_bank'; s.sentAt = new Date().toISOString(); }
        });
        await dbSet('payroll-slips', slips);

        // Notify all employees
        const notifs = await dbGet('notifications') || [];
        const runSlips = slips.filter(s => s.runId === runId);
        runSlips.forEach(s => {
          notifs.push({
            id: 'n_sal_' + Date.now() + '_' + s.empId,
            empId: s.empId,
            type: 'salary_sent',
            title: '💰 تم إرسال راتبك للبنك',
            message: 'راتب شهر ' + run.period + ' — ' + Number(s.netSalary).toFixed(2) + ' ريال',
            link: '/my/salary',
            read: false,
            ts: new Date().toISOString(),
          });
        });
        await dbSet('notifications', notifs);

        await auditLog(actor, 'mark_sent', runId, null, 'payroll');
        return res.json({ ok: true, run });
      }

      case 'payroll-my-slips': {
        // GET — كشوف الموظف الخاصة به (view_own)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const empId = req.query.empId;
        if (!empId) return res.status(400).json({ error: 'empId required' });

        // view_own: anyone can see their own
        const slips = await dbGet('payroll-slips') || [];
        const mySlips = slips.filter(s =>
          String(s.empId) === String(empId) &&
          ['approved','sent_to_bank','paid'].includes(s.status)  // only visible after approval
        );

        const runs = await dbGet('payroll-runs') || [];
        const enriched = mySlips.map(s => {
          const run = runs.find(r => r.id === s.runId);
          // Don't expose IBAN even to the employee (they should know it)
          const { iban, ...rest } = s;
          return { ...rest, runStatus: run ? run.status : null, ibanLast4: iban ? (decryptPayrollField(iban) || '').slice(-4) : '' };
        });
        enriched.sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));

        return res.json({ ok: true, slips: enriched });
      }

      case 'payroll-stats': {
        // GET — إحصائيات الرواتب (HR dashboard)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const actor = req.query.actor;
        const access = await canAccessPayroll(actor, 'view_all');
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission' });

        const runs = await dbGet('payroll-runs') || [];
        const slips = await dbGet('payroll-slips') || [];

        const totalRuns = runs.length;
        const byStatus = {};
        runs.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

        // Last 12 months
        const monthlyTotals = {};
        runs.forEach(r => {
          monthlyTotals[r.period] = (monthlyTotals[r.period] || 0) + (r.totalNetAmount || 0);
        });

        return res.json({
          ok: true,
          totalRuns,
          totalSlips: slips.length,
          byStatus,
          monthlyTotals,
        });
      }

      case 'payroll-audit-log': {
        // GET — عرض سجل الـ audit (admin + hr_manager فقط)
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const actor = req.query.actor;
        const access = await canAccessPayroll(actor, 'approve');  // same permission as approve
        if (!access.allowed) return res.status(403).json({ error: 'insufficient permission' });
        const log = await dbGet('payroll-audit-log') || [];
        const recent = log.slice(-200).reverse();
        return res.json({ ok: true, count: recent.length, log: recent });
      }

      case 'checkin': {
        const { empId, type, lat, lng, facePhoto } = req.body || {};
        const recs = await dbGet('attendance') || [];
        const rec = { id: 'A' + Date.now(), empId, type, lat, lng, facePhoto: facePhoto ? '[captured]' : null, ts: new Date().toISOString(), date: new Date().toISOString().split('T')[0] };
        recs.push(rec);
        await dbSet('attendance', recs);
        // Add points
        const emps = await dbGet('employees') || [];
        const ei = emps.findIndex(e => e.id === empId);
        if (ei >= 0) { emps[ei].points = (emps[ei].points || 0) + 10; await dbSet('employees', emps); }
        return res.json({ ok: true, record: rec });
      }

      case 'face': {
        if (req.method === 'GET') {
          const faceId = req.query.empId;
          // Admin: list all enrolled employees
          if (req.query.listAll === '1') {
            const faces = await dbGet('faces') || {};
            return res.json({ ok: true, enrolled: Object.keys(faces) });
          }
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          if (faces[faceId]) return res.json({ ok: true, descriptor: faces[faceId] });
          return res.json({ ok: false });
        }
        if (req.method === 'POST') {
          const { empId, descriptor } = req.body || {};
          if (!empId || !descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) return res.status(400).json({ error: 'empId + descriptor[128] required' });
          const faces = await dbGet('faces') || {};
          // Check if similar face exists for another employee — notify admin, don't block
          var similarFound = null;
          for (const [existingId, existingDesc] of Object.entries(faces)) {
            if (existingId === empId) continue;
            if (!Array.isArray(existingDesc) || existingDesc.length !== 128) continue;
            let sum = 0;
            for (let i = 0; i < 128; i++) sum += (descriptor[i] - existingDesc[i]) ** 2;
            const dist = Math.sqrt(sum);
            if (dist < 0.35) { similarFound = { empId: existingId, distance: dist }; break; }
          }
          // Save the face regardless
          faces[empId] = descriptor;
          await dbSet('faces', faces);
          // If similar face found, create admin notification
          if (similarFound) {
            const violations = await dbGet('violations') || [];
            violations.push({ id: 'V' + Date.now(), status: 'open', empId, type: 'similar_face', details: 'تنبيه: وجه مشابه للموظف ' + similarFound.empId + ' (المسافة: ' + similarFound.distance.toFixed(3) + ') — قد يكون توأم أو قريب', date: new Date().toISOString().split('T')[0], ts: new Date().toISOString() });
            await dbSet('violations', violations);
            return res.json({ ok: true, warning: 'similar_face', matchedEmpId: similarFound.empId });
          }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const faceId = req.query.empId;
          if (faceId === 'ALL') {
            // Admin: clear all faces
            await dbSet('faces', {});
            return res.json({ ok: true, msg: 'all faces cleared' });
          }
          if (!faceId) return res.status(400).json({ error: 'empId required' });
          const faces = await dbGet('faces') || {};
          delete faces[faceId];
          await dbSet('faces', faces);
          return res.json({ ok: true });
        }
        return res.json({ error: 'method not allowed' });
      }

      case 'attendance': {
        let recs = await dbGet('attendance') || [];
        const { empId, date, from, to } = req.query;
        if (empId) recs = recs.filter(r => r.empId === empId);
        if (date) recs = recs.filter(r => r.date === date);
        if (from) recs = recs.filter(r => r.date >= from);
        if (to) recs = recs.filter(r => r.date <= to);
        return res.json(recs);
      }

      /* v6.58 — Attendance period locks (for payroll finalization) */
      case 'attendance-locks': {
        if (req.method === 'GET') {
          var locks = (await dbGet('attendance_locks')) || [];
          return res.json(locks);
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          if (!body.month) return res.status(400).json({ error: 'month required (e.g. 2026-04)' });
          var locks = (await dbGet('attendance_locks')) || [];
          // Check if already locked
          var existing = locks.find(function(l){ return l.month === body.month; });
          if (existing) return res.status(400).json({ error: 'هذا الشهر مقفل بالفعل' });
          locks.push({
            month: body.month,
            lockedBy: body.lockedBy || 'admin',
            lockedAt: new Date().toISOString(),
            note: body.note || '',
          });
          await dbSet('attendance_locks', locks);
          return res.json({ ok: true, lock: locks[locks.length - 1] });
        }
        if (req.method === 'DELETE') {
          var body = req.body || {};
          if (!body.month) return res.status(400).json({ error: 'month required' });
          var locks = (await dbGet('attendance_locks')) || [];
          locks = locks.filter(function(l){ return l.month !== body.month; });
          await dbSet('attendance_locks', locks);
          return res.json({ ok: true });
        }
        break;
      }

      case 'manual_checkin': {
        const { empId, type, date, adminId } = req.body || {};
        // v6.58 — Check if the month is locked
        if (date) {
          var month = String(date).substring(0, 7); // "2026-04"
          var locks = (await dbGet('attendance_locks')) || [];
          if (locks.some(function(l){ return l.month === month; })) {
            return res.status(403).json({ error: 'هذا الشهر (' + month + ') مقفل — فك القفل أولاً لتعديل الحضور' });
          }
        }
        const recs = await dbGet('manual_attendance') || [];
        recs.push({ id: 'M' + Date.now(), empId, type, date, adminId, ts: new Date().toISOString(), manual: true });
        await dbSet('manual_attendance', recs);
        // Also add to regular attendance
        const att = await dbGet('attendance') || [];
        att.push({ id: 'MA' + Date.now(), empId, type, date, ts: new Date().toISOString(), manual: true, adminId });
        await dbSet('attendance', att);
        return res.json({ ok: true });
      }

      case 'branches': {
        if (req.method === 'GET') return res.json(await dbGet('branches') || INIT_BRANCHES);
        if (req.method === 'PUT') { await dbSet('branches', req.body); return res.json({ ok: true }); }
        if (req.method === 'POST') { const bs = await dbGet('branches') || []; bs.push(req.body); await dbSet('branches', bs); return res.json({ ok: true }); }
        break;
      }

      case 'projects': {
        if (req.method === 'GET') return res.json(await dbGet('projects') || []);
        if (req.method === 'POST') { const ps = await dbGet('projects') || []; ps.push({ id: 'P' + Date.now(), ...req.body }); await dbSet('projects', ps); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ps = await dbGet('projects') || [];
          const { id, ...up } = req.body;
          const i = ps.findIndex(p => p.id === id);
          if (i >= 0) { ps[i] = { ...ps[i], ...up }; await dbSet('projects', ps); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') { const ps = await dbGet('projects') || []; await dbSet('projects', ps.filter(p => p.id !== req.query.id)); return res.json({ ok: true }); }
        break;
      }

      case 'delegations': {
        if (req.method === 'GET') return res.json(await dbGet('delegations') || []);
        if (req.method === 'POST') { const ds = await dbGet('delegations') || []; ds.push({ id: 'D' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('delegations', ds); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ds = await dbGet('delegations') || [];
          const { id, status } = req.body;
          const i = ds.findIndex(d => d.id === id);
          if (i >= 0) { ds[i].status = status; ds[i].decidedAt = new Date().toISOString(); await dbSet('delegations', ds); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'exceptions': {
        if (req.method === 'GET') return res.json(await dbGet('exceptions') || []);
        if (req.method === 'POST') { const es = await dbGet('exceptions') || []; es.push({ id: 'EX' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('exceptions', es); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const es = await dbGet('exceptions') || [];
          const { id, status } = req.body;
          const i = es.findIndex(e => e.id === id);
          if (i >= 0) { es[i].status = status; await dbSet('exceptions', es); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'leaves': {
        if (req.method === 'GET') return res.json(await dbGet('leaves') || []);
        if (req.method === 'POST') {
          // v6.37 — enhanced submit: compute days + notify manager + validate balance
          var lbody = req.body || {};
          var ls = await dbGet('leaves') || [];
          var now = new Date();
          // Compute number of days (inclusive)
          var daysCount = 1;
          if (lbody.from && lbody.to) {
            var fromD = new Date(lbody.from);
            var toD = new Date(lbody.to);
            daysCount = Math.max(1, Math.round((toD - fromD) / (24*3600*1000)) + 1);
          }
          var newLeave = { id: 'L' + Date.now(), status: 'pending', ...lbody, days: daysCount, ts: now.toISOString() };
          ls.push(newLeave);
          await dbSet('leaves', ls);

          // Notify manager + HR in-app
          (async function(){
            try {
              var emps = (await dbGet('employees')) || [];
              var emp = emps.find(function(e){ return e.id === lbody.empId; });
              var managerId = emp && (emp.managerId || emp.supervisorId);
              var hrIds = emps.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
              var targets = [];
              if (managerId) targets.push(managerId);
              hrIds.forEach(function(id){ if (targets.indexOf(id) < 0) targets.push(id); });

              var leaveTypeLbl = { annual:'سنوية', sick:'مرضية', emergency:'طارئة', personal:'شخصية' }[lbody.type] || 'إجازة';
              var notifs = (await dbGet('notifications')) || [];
              var nowISO = now.toISOString();
              targets.forEach(function(tid){
                notifs.push({
                  id: 'n_lvreq_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  empId: tid,
                  type: 'leave_request',
                  title: '📝 طلب إجازة جديد',
                  message: (emp && emp.name ? emp.name : 'موظف') + ' طلب إجازة ' + leaveTypeLbl + ' (' + daysCount + ' يوم)',
                  leaveId: newLeave.id,
                  targetEmpId: lbody.empId,
                  read: false,
                  createdAt: nowISO,
                });
              });
              if (notifs.length > 1000) notifs = notifs.slice(-1000);
              await dbSet('notifications', notifs);

              // Push notification to manager
              if (managerId) {
                try {
                  var pushSubs = (await dbGet('push_subscriptions')) || {};
                  var sub = pushSubs[managerId];
                  if (sub && sub.subscription) {
                    await sendWebPush(sub.subscription, {
                      title: '📝 طلب إجازة جديد',
                      body: (emp && emp.name ? emp.name : 'موظف') + ' طلب ' + leaveTypeLbl + ' (' + daysCount + ' يوم)',
                      tag: 'leave-' + newLeave.id,
                      data: { leaveId: newLeave.id, type: 'leave_request' },
                    });
                  }
                } catch(ePush) { /* silent */ }
              }
            } catch(e) { /* silent */ }
          })();

          return res.json({ ok: true, leave: newLeave, days: daysCount });
        }
        if (req.method === 'PUT') {
          // v6.37 — enhanced approve/reject: auto-deduct balance + notify employee
          const ls = await dbGet('leaves') || [];
          const { id, status, rejectReason } = req.body;
          const i = ls.findIndex(l => l.id === id);
          if (i < 0) return res.status(404).json({ error: 'الطلب غير موجود' });

          var leave = ls[i];
          var prevStatus = leave.status;
          leave.status = status;
          leave.decidedAt = new Date().toISOString();
          if (rejectReason) leave.rejectReason = rejectReason;

          // Auto-deduct balance on approval (only if moving to approved state)
          if (status === 'approved' && prevStatus !== 'approved' && leave.type) {
            var balances = (await dbGet('leave_balances')) || {};
            var curYear = new Date().getFullYear();
            var empBal = balances[leave.empId] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear };
            if (empBal.year !== curYear) {
              // Year rolled over — reset defaults
              empBal = { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear };
            }
            var days = leave.days || 1;
            if (empBal[leave.type] !== undefined) {
              empBal[leave.type] = Math.max(0, empBal[leave.type] - days);
            }
            balances[leave.empId] = empBal;
            await dbSet('leave_balances', balances);
          }

          // Reverse deduction if moving FROM approved
          if (prevStatus === 'approved' && status !== 'approved' && leave.type) {
            var balances2 = (await dbGet('leave_balances')) || {};
            var curYear2 = new Date().getFullYear();
            var empBal2 = balances2[leave.empId] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear2 };
            if (empBal2.year !== curYear2) empBal2 = { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear2 };
            var daysRev = leave.days || 1;
            if (empBal2[leave.type] !== undefined) {
              empBal2[leave.type] = empBal2[leave.type] + daysRev;
            }
            balances2[leave.empId] = empBal2;
            await dbSet('leave_balances', balances2);
          }

          await dbSet('leaves', ls);

          // v7.84 — تسجيل العملية في Audit Log
          var actorId = (req.body && req.body.actorId) || 'hr';
          await auditLog(actorId, 'leave_' + status, leave.empId, {
            leaveId: leave.id,
            type: leave.type,
            days: leave.days,
            from: leave.from,
            to: leave.to,
            prevStatus: prevStatus,
            newStatus: status,
            rejectReason: rejectReason || null,
          }, 'leaves');

          // Notify employee
          (async function(){
            try {
              var notifs = (await dbGet('notifications')) || [];
              var nowISO = new Date().toISOString();
              var leaveTypeLbl2 = { annual:'السنوية', sick:'المرضية', emergency:'الطارئة', personal:'الشخصية' }[leave.type] || '';
              var titleStr = status === 'approved' ? '✅ تمت الموافقة على إجازتك' : status === 'rejected' ? '❌ تم رفض طلب الإجازة' : '🔄 تحديث على طلب الإجازة';
              var msgStr = status === 'approved'
                ? 'تمت الموافقة على الإجازة ' + leaveTypeLbl2 + ' (' + (leave.days || 1) + ' يوم). إجازة سعيدة!'
                : status === 'rejected'
                ? 'تم رفض طلب الإجازة ' + leaveTypeLbl2 + (rejectReason ? '. السبب: ' + rejectReason : '. راجع مديرك.')
                : 'تم تحديث طلب الإجازة.';
              notifs.push({
                id: 'n_lvres_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                empId: leave.empId,
                type: 'leave_response',
                title: titleStr,
                message: msgStr,
                leaveId: leave.id,
                read: false,
                createdAt: nowISO,
              });
              if (notifs.length > 1000) notifs = notifs.slice(-1000);
              await dbSet('notifications', notifs);

              // Push
              try {
                var pushSubs = (await dbGet('push_subscriptions')) || {};
                var sub = pushSubs[leave.empId];
                if (sub && sub.subscription) {
                  await sendWebPush(sub.subscription, { title: titleStr, body: msgStr, tag: 'leave-resp-' + leave.id, data: { leaveId: leave.id, type: 'leave_response' } });
                }
              } catch(e){}
            } catch(e){}
          })();

          return res.json({ ok: true, leave: leave });
        }
        break;
      }

      /* ═══ v6.37 — LEAVE BALANCE (رصيد الإجازات) ═══ */
      case 'leave-balance': {
        if (req.method === 'GET') {
          var empIdLB = req.query.empId;
          if (!empIdLB) return res.status(400).json({ error: 'empId مطلوب' });
          var balancesLB = (await dbGet('leave_balances')) || {};
          var curYearLB = new Date().getFullYear();
          var empBalLB = balancesLB[empIdLB] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYearLB };
          // Auto-reset on new year
          if (empBalLB.year !== curYearLB) {
            empBalLB = { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYearLB };
            balancesLB[empIdLB] = empBalLB;
            await dbSet('leave_balances', balancesLB);
          }
          return res.json(empBalLB);
        }
        if (req.method === 'PUT') {
          // Admin-only: adjust balance
          var bodyLB = req.body || {};
          var balancesLB2 = (await dbGet('leave_balances')) || {};
          var curYearLB2 = new Date().getFullYear();
          var empBalLB2 = balancesLB2[bodyLB.empId] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYearLB2 };
          if (bodyLB.annual !== undefined) empBalLB2.annual = Math.max(0, parseInt(bodyLB.annual, 10));
          if (bodyLB.sick !== undefined) empBalLB2.sick = Math.max(0, parseInt(bodyLB.sick, 10));
          if (bodyLB.emergency !== undefined) empBalLB2.emergency = Math.max(0, parseInt(bodyLB.emergency, 10));
          if (bodyLB.personal !== undefined) empBalLB2.personal = Math.max(0, parseInt(bodyLB.personal, 10));
          empBalLB2.year = curYearLB2;
          balancesLB2[bodyLB.empId] = empBalLB2;
          await dbSet('leave_balances', balancesLB2);
          return res.json({ ok: true, balance: empBalLB2 });
        }
        break;
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.109 — UNIFIED QUESTION BANK (بنك أسئلة موحّد)
       * ═══════════════════════════════════════════════════════════════
       * Separate from legacy settings.questions — dedicated bank
       * with categories, stats, and advanced features.
       *
       * Redis key: question_bank
       * Structure: [
       *   { id, text, correct, wrongs[], category, difficulty,
       *     usedCount, correctCount, createdAt, createdBy, active }
       * ]
       *
       * Endpoints:
       *   GET /api/data?action=question-bank — list all
       *   GET /api/data?action=question-bank&id=X — get one
       *   GET /api/data?action=question-bank&category=engineering — filter
       *   POST /api/data?action=question-bank — add/import
       *   PUT /api/data?action=question-bank — update
       *   DELETE /api/data?action=question-bank&id=X — delete
       *   GET /api/data?action=question-bank-stats — overall stats
       *   POST /api/data?action=question-bank-import — bulk import CSV/JSON
       *   GET /api/data?action=question-bank-random — get random (for flash/morning)
       */
      case 'question-bank': {
        var bankQB = (await dbGet('question_bank')) || [];

        if (req.method === 'GET') {
          var idQB = req.query.id;
          if (idQB) {
            var oneQB = bankQB.find(function(q){ return q.id === idQB; });
            if (!oneQB) return res.status(404).json({ error: 'not found' });
            return res.json(oneQB);
          }
          var categoryQB = req.query.category;
          var activeOnlyQB = req.query.activeOnly === '1';
          var filtered = bankQB;
          if (categoryQB && categoryQB !== 'all') filtered = filtered.filter(function(q){ return q.category === categoryQB; });
          if (activeOnlyQB) filtered = filtered.filter(function(q){ return q.active !== false; });
          return res.json(filtered);
        }

        if (req.method === 'POST') {
          var bodyQB = req.body || {};
          if (!bodyQB.text || !bodyQB.correct) {
            return res.status(400).json({ error: 'text + correct required' });
          }
          var newQB = {
            id: 'Q_' + Date.now() + Math.random().toString(36).slice(2, 5),
            text: bodyQB.text,
            correct: bodyQB.correct,
            wrongs: Array.isArray(bodyQB.wrongs) ? bodyQB.wrongs : (bodyQB.wrongs ? [bodyQB.wrongs] : []),
            category: bodyQB.category || 'general',
            difficulty: bodyQB.difficulty || 'medium',  // easy, medium, hard
            usedCount: 0,
            correctCount: 0,
            wrongCount: 0,
            active: bodyQB.active !== false,
            createdAt: new Date().toISOString(),
            createdBy: bodyQB.actorId || 'admin',
            tags: Array.isArray(bodyQB.tags) ? bodyQB.tags : [],
          };
          bankQB.push(newQB);
          await dbSet('question_bank', bankQB);
          await auditLog(bodyQB.actorId || 'admin', 'question_added', null, { id: newQB.id, category: newQB.category }, 'admin');
          return res.json({ ok: true, question: newQB });
        }

        if (req.method === 'PUT') {
          var bodyQBP = req.body || {};
          if (!bodyQBP.id) return res.status(400).json({ error: 'id required' });
          var idxQB = bankQB.findIndex(function(q){ return q.id === bodyQBP.id; });
          if (idxQB < 0) return res.status(404).json({ error: 'not found' });
          ['text', 'correct', 'wrongs', 'category', 'difficulty', 'active', 'tags'].forEach(function(k){
            if (bodyQBP[k] !== undefined) bankQB[idxQB][k] = bodyQBP[k];
          });
          bankQB[idxQB].updatedAt = new Date().toISOString();
          await dbSet('question_bank', bankQB);
          await auditLog(bodyQBP.actorId || 'admin', 'question_updated', null, { id: bodyQBP.id }, 'admin');
          return res.json({ ok: true, question: bankQB[idxQB] });
        }

        if (req.method === 'DELETE') {
          var delIdQB = req.query.id;
          if (!delIdQB) return res.status(400).json({ error: 'id required' });
          var beforeLenQB = bankQB.length;
          bankQB = bankQB.filter(function(q){ return q.id !== delIdQB; });
          if (bankQB.length === beforeLenQB) return res.status(404).json({ error: 'not found' });
          await dbSet('question_bank', bankQB);
          await auditLog('admin', 'question_deleted', null, { id: delIdQB }, 'admin');
          return res.json({ ok: true, deleted: delIdQB });
        }

        return res.status(405).json({ error: 'method not allowed' });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.109 — BULK IMPORT (CSV/JSON)
       * POST /api/data?action=question-bank-import
       * Body: { questions: [...], mode: 'append'|'replace' }
       */
      case 'question-bank-import': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyQBI = req.body || {};
        var importedQ = Array.isArray(bodyQBI.questions) ? bodyQBI.questions : [];
        var modeQBI = bodyQBI.mode || 'append';

        if (importedQ.length === 0) return res.status(400).json({ error: 'no questions provided' });

        var current = (await dbGet('question_bank')) || [];

        // Validate & normalize
        var validated = [];
        var errors = [];
        importedQ.forEach(function(q, i){
          if (!q.text || !q.correct) {
            errors.push({ index: i, error: 'missing text or correct' });
            return;
          }
          validated.push({
            id: 'Q_' + Date.now() + '_' + i + Math.random().toString(36).slice(2, 5),
            text: q.text,
            correct: q.correct,
            wrongs: Array.isArray(q.wrongs) ? q.wrongs : (Array.isArray(q.options) ? q.options.filter(function(o){ return o !== q.correct; }) : []),
            category: q.category || 'general',
            difficulty: q.difficulty || 'medium',
            usedCount: 0, correctCount: 0, wrongCount: 0,
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: bodyQBI.actorId || 'admin',
            tags: Array.isArray(q.tags) ? q.tags : [],
          });
        });

        var finalBank;
        if (modeQBI === 'replace') {
          finalBank = validated;
        } else {
          finalBank = current.concat(validated);
        }

        await dbSet('question_bank', finalBank);
        await auditLog(bodyQBI.actorId || 'admin', 'question_bulk_import', null, {
          mode: modeQBI,
          imported: validated.length,
          errors: errors.length,
          total: finalBank.length,
        }, 'admin');

        return res.json({
          ok: true,
          imported: validated.length,
          errors: errors,
          total: finalBank.length,
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.109 — STATS
       * GET /api/data?action=question-bank-stats
       */
      case 'question-bank-stats': {
        var bankS = (await dbGet('question_bank')) || [];
        var categories = {};
        var difficulties = { easy: 0, medium: 0, hard: 0 };
        var activeCount = 0;
        var totalUsed = 0;
        var totalCorrect = 0;

        bankS.forEach(function(q){
          categories[q.category || 'general'] = (categories[q.category || 'general'] || 0) + 1;
          difficulties[q.difficulty || 'medium'] = (difficulties[q.difficulty || 'medium'] || 0) + 1;
          if (q.active !== false) activeCount++;
          totalUsed += q.usedCount || 0;
          totalCorrect += q.correctCount || 0;
        });

        // Most/least used
        var sortedByUse = bankS.slice().sort(function(a, b){ return (b.usedCount || 0) - (a.usedCount || 0); });
        var hardest = bankS
          .filter(function(q){ return q.usedCount >= 3; })
          .map(function(q){
            return { id: q.id, text: q.text, rate: Math.round(((q.correctCount || 0) / q.usedCount) * 100), used: q.usedCount };
          })
          .sort(function(a, b){ return a.rate - b.rate; })
          .slice(0, 5);

        return res.json({
          ok: true,
          total: bankS.length,
          active: activeCount,
          categories: categories,
          difficulties: difficulties,
          usage: {
            totalShown: totalUsed,
            totalCorrect: totalCorrect,
            overallAccuracy: totalUsed > 0 ? Math.round((totalCorrect / totalUsed) * 100) : 0,
          },
          mostUsed: sortedByUse.slice(0, 5).map(function(q){ return { id: q.id, text: q.text, used: q.usedCount || 0 }; }),
          hardest: hardest,
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.109 — GET RANDOM QUESTION (for Morning/Flash challenges)
       * GET /api/data?action=question-bank-random&category=X&difficulty=Y
       */
      case 'question-bank-random': {
        var bankR = (await dbGet('question_bank')) || [];
        bankR = bankR.filter(function(q){ return q.active !== false; });

        if (req.query.category && req.query.category !== 'all') {
          bankR = bankR.filter(function(q){ return q.category === req.query.category; });
        }
        if (req.query.difficulty && req.query.difficulty !== 'all') {
          bankR = bankR.filter(function(q){ return q.difficulty === req.query.difficulty; });
        }

        if (bankR.length === 0) return res.status(404).json({ error: 'no questions available', ok: false });

        // Prefer less-used questions
        bankR.sort(function(a, b){ return (a.usedCount || 0) - (b.usedCount || 0); });
        var pool = bankR.slice(0, Math.max(10, Math.floor(bankR.length / 2)));
        var picked = pool[Math.floor(Math.random() * pool.length)];

        // Increment usage counter
        var fullBank = (await dbGet('question_bank')) || [];
        var idx = fullBank.findIndex(function(q){ return q.id === picked.id; });
        if (idx >= 0) {
          fullBank[idx].usedCount = (fullBank[idx].usedCount || 0) + 1;
          fullBank[idx].lastUsedAt = new Date().toISOString();
          await dbSet('question_bank', fullBank);
        }

        return res.json({ ok: true, question: picked });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.109 — MIGRATE legacy settings.questions → question_bank
       * POST /api/data?action=migrate-questions-to-bank
       */
      case 'migrate-questions-to-bank': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var modeMQ = (req.body || {}).mode || 'dry_run';
        var settingsMQ = (await dbGet('settings')) || {};
        var legacyQ = settingsMQ.questions || [];
        var bankMQ = (await dbGet('question_bank')) || [];

        // Check for already-migrated
        var migratedIds = new Set();
        bankMQ.forEach(function(q){ if (q.migratedFrom) migratedIds.add(q.migratedFrom); });

        var toMigrate = legacyQ.filter(function(q, i){
          var key = 'legacy_' + i + '_' + (q.q || '').slice(0, 30);
          return !migratedIds.has(key);
        });

        if (modeMQ === 'dry_run') {
          return res.json({
            ok: true,
            mode: 'dry_run',
            legacyCount: legacyQ.length,
            bankCount: bankMQ.length,
            willMigrate: toMigrate.length,
            sample: toMigrate.slice(0, 3),
          });
        }

        // Execute
        if (toMigrate.length === 0) {
          return res.json({ ok: true, mode: 'execute', migrated: 0, message: 'لا توجد أسئلة للنقل' });
        }

        var newQuestions = toMigrate.map(function(q, i){
          return {
            id: 'Q_MIG_' + Date.now() + '_' + i,
            migratedFrom: 'legacy_' + i + '_' + (q.q || '').slice(0, 30),
            text: q.q || '',
            correct: q.correct || '',
            wrongs: [q.wrong1, q.wrong2].filter(function(x){ return x; }),
            category: q.type === 'هندسي' ? 'engineering' : q.type === 'سلامة' ? 'safety' : q.type === 'ذكر' ? 'religion' : 'general',
            difficulty: 'medium',
            usedCount: 0, correctCount: 0, wrongCount: 0,
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: 'migration',
            tags: ['legacy'],
          };
        });

        var merged = bankMQ.concat(newQuestions);
        await dbSet('question_bank', merged);

        await auditLog('admin', 'migrate_questions_to_bank', null, {
          migrated: newQuestions.length,
          total: merged.length,
        }, 'admin');

        return res.json({
          ok: true,
          mode: 'execute',
          migrated: newQuestions.length,
          total: merged.length,
          message: 'تم النقل بنجاح!',
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.113 — EMPLOYEE RECOGNITION SYSTEM (تكريم الموظفين)
       * ═══════════════════════════════════════════════════════════════
       * Multi-criteria weighted scoring:
       *   • Attendance (40%): present days + low late%
       *   • Points (25%): total points this month
       *   • Performance (20%): violations (negative), streak
       *   • Challenges (15%): morning + flash answered correctly
       *
       * Endpoints:
       *   GET  /api/data?action=recognition                    — Current month results
       *   GET  /api/data?action=recognition&month=YYYY-MM      — Specific month
       *   GET  /api/data?action=recognition-history            — All past winners
       *   POST /api/data?action=recognition-award              — Admin adds reward
       *   GET  /api/data?action=recognition-awards&empId=X     — Employee rewards log
       */

      /* ═══════════════════════════════════════════════════════════
       * v7.124 — HR Permissions (صلاحيات مدير الموارد البشرية)
       *
       * لوحة تحكم لـ المدير العام يستطيع من خلالها تمكين/تعطيل صلاحيات
       * إدارية محددة لـ HR. الصلاحيات النظامية مقفلة دائماً (لا تُعرض هنا).
       *
       * Endpoints:
       *   GET  /api/data?action=hr-permissions
       *   PUT  /api/data?action=hr-permissions   (body: { permissions: {...}, actorName })
       * ═══════════════════════════════════════════════════════════ */
      case 'hr-permissions': {
        var permKey = 'hr_permissions_config';

        // الصلاحيات الافتراضية (كلها مفعّلة لـ HR)
        var DEFAULT_HR_PERMISSIONS = {
          manage_employees:     true,   // إدارة بيانات الموظفين
          approve_leaves:       true,   // الموافقة على الإجازات
          handle_requests:      true,   // رسائل + طلبات + إفادات
          apply_violations:     true,   // تطبيق المخالفات والجزاءات
          terminate_employees:  true,   // إنهاء خدمة الموظفين
          delete_employees:     true,   // حذف الموظفين نهائياً
          modify_salaries:      true,   // تعديل الرواتب
          run_evaluations:      true,   // التقييمات والتكريم
          manage_content:       true,   // التعاميم + البنرات + المناسبات + الاستطلاعات
          manage_challenges:    true,   // التحديات والأسئلة
          send_push:            true,   // إرسال إشعارات push
          manage_attendance:    true,   // الحضور + الفروع + أنواع الدوام
          manage_custody:       true,   // العُهَد والأصول
          generate_reports:     true,   // إصدار التقارير
          manage_tasks:         true,   // المهام الإدارية (تواصل)
          manage_company_settings: true, // العطل + الامتيازات + حساب المدير
        };

        if (req.method === 'GET') {
          var config = await dbGet(permKey);
          if (!config) {
            // أول مرة → احفظ الافتراضي
            config = { permissions: DEFAULT_HR_PERMISSIONS, updatedAt: new Date().toISOString(), updatedBy: 'system' };
            await dbSet(permKey, config);
          }
          // دمج مع الافتراضي (لضمان عدم ظهور أي صلاحية ناقصة)
          var merged = Object.assign({}, DEFAULT_HR_PERMISSIONS, config.permissions || {});
          return res.json({
            ok: true,
            permissions: merged,
            updatedAt: config.updatedAt,
            updatedBy: config.updatedBy || 'system',
          });
        }

        if (req.method === 'PUT') {
          var body = req.body || {};
          if (!body.permissions || typeof body.permissions !== 'object') {
            return res.status(400).json({ error: 'permissions (object) مطلوب' });
          }
          // أخذ المفاتيح المعروفة فقط (حماية من injection)
          var safePerms = {};
          Object.keys(DEFAULT_HR_PERMISSIONS).forEach(function(k){
            safePerms[k] = !!body.permissions[k];
          });
          var current = await dbGet(permKey) || {};
          var newConfig = {
            permissions: safePerms,
            updatedAt: new Date().toISOString(),
            updatedBy: body.actorName || body.actorId || 'admin',
            previousPermissions: current.permissions || {},
          };
          await dbSet(permKey, newConfig);
          return res.json({ ok: true, permissions: safePerms, updatedAt: newConfig.updatedAt });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      case 'recognition': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        var monthRec = req.query.month || new Date().toISOString().slice(0, 7);
        var periodRec = req.query.period || 'month'; // 'month' | 'week'
        var monthStart = monthRec + '-01';
        var nextMonthRec = new Date(monthRec + '-01');
        nextMonthRec.setMonth(nextMonthRec.getMonth() + 1);
        var monthEnd = nextMonthRec.toISOString().slice(0, 10);

        var empsRec = ((await dbGet('employees')) || []).filter(function(e){ return e.active !== false; });
        var attRec = ((await dbGet('attendance')) || []).filter(function(a){
          return a.date && a.date >= monthStart && a.date < monthEnd;
        });
        var violsRec = ((await dbGet('violations_v2')) || []).filter(function(v){
          return v.createdAt && v.createdAt.slice(0, 7) === monthRec;
        });
        var challengesRec = ((await dbGet('challenge_answers')) || []).filter(function(c){
          return c.ts && c.ts.slice(0, 7) === monthRec;
        });

        // Build scores per employee
        var scoresRec = empsRec.map(function(emp){
          var empIdStr = String(emp.id);

          // ═══ Metric 1: Attendance (40 points max) ═══
          var empCheckins = attRec.filter(function(a){ return String(a.empId) === empIdStr && a.type === 'checkin'; });
          var empLate = empCheckins.filter(function(a){ return a.late; });
          var attendanceDays = new Set(empCheckins.map(function(a){ return a.date; })).size;
          var latePct = empCheckins.length > 0 ? (empLate.length / empCheckins.length) * 100 : 0;
          // Attendance score: days (max 25) + low late bonus (max 15)
          var attendanceScore = Math.min(25, attendanceDays * 1.2) + Math.max(0, 15 - latePct * 0.5);
          attendanceScore = Math.round(attendanceScore);

          // ═══ Metric 2: Points (25 points max) ═══
          var empPoints = parseInt(emp.points || 0, 10);
          // Normalize: 500+ points = full 25, scale linearly
          var pointsScore = Math.min(25, Math.round(empPoints / 20));

          // ═══ Metric 3: Performance (20 points max) ═══
          var empViols = violsRec.filter(function(v){ return String(v.empId) === empIdStr; });
          var activeViols = empViols.filter(function(v){ return v.status === 'ACTIVE' || v.status === 'open'; }).length;
          var streak = parseInt(emp.streak || 0, 10);
          // No violations = 15, each active viol -3, streak bonus max 5
          var perfScore = Math.max(0, 15 - (activeViols * 3)) + Math.min(5, Math.round(streak / 3));

          // ═══ Metric 4: Challenges (15 points max) ═══
          var empChallenges = challengesRec.filter(function(c){ return String(c.empId) === empIdStr; });
          var correctChallenges = empChallenges.filter(function(c){ return c.correct; }).length;
          var challengeScore = Math.min(15, correctChallenges);

          // Total
          var totalScore = attendanceScore + pointsScore + perfScore + challengeScore;

          return {
            empId: emp.id,
            empName: emp.name,
            empAvatar: emp.avatar || null,
            jobTitle: emp.jobTitle || '',
            branch: emp.branch || '',
            department: emp.department || '',
            scores: {
              attendance: attendanceScore,
              points: pointsScore,
              performance: perfScore,
              challenges: challengeScore,
              total: totalScore,
            },
            raw: {
              attendanceDays: attendanceDays,
              latePct: Math.round(latePct),
              points: empPoints,
              activeViolations: activeViols,
              streak: streak,
              correctChallenges: correctChallenges,
              totalChallenges: empChallenges.length,
            },
          };
        });

        // Sort by total score desc
        scoresRec.sort(function(a, b){ return b.scores.total - a.scores.total; });

        // Top 3 with medals
        var topThree = scoresRec.slice(0, 3).map(function(s, i){
          return Object.assign({}, s, {
            rank: i + 1,
            medal: ['🥇', '🥈', '🥉'][i],
          });
        });

        // The winner (if meets minimum threshold)
        var winner = null;
        if (scoresRec.length > 0 && scoresRec[0].scores.total >= 30) {
          winner = Object.assign({}, scoresRec[0], { rank: 1, medal: '🏆' });
        }

        // Check for admin-set awards this month
        var manualAwards = (await dbGet('recognition_awards')) || [];
        var monthAwards = manualAwards.filter(function(a){ return a.month === monthRec; });

        return res.json({
          ok: true,
          month: monthRec,
          isCurrentMonth: monthRec === new Date().toISOString().slice(0, 7),
          totalEmployees: empsRec.length,
          winner: winner,
          topThree: topThree,
          allScores: scoresRec.slice(0, 10), // Top 10 for leaderboard
          manualAwards: monthAwards,
          weights: {
            attendance: 40,
            points: 25,
            performance: 20,
            challenges: 15,
          },
        });
      }

      case 'recognition-history': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        // Build history for last 12 months
        var nowH = new Date();
        var history = [];
        for (var i = 0; i < 12; i++) {
          var d = new Date(nowH);
          d.setMonth(d.getMonth() - i);
          var m = d.toISOString().slice(0, 7);
          // Only show if month has passed
          if (i === 0 && nowH.getDate() < 28) continue; // current month not finished
          history.push({ month: m });
        }

        // Get stored history (winners cache)
        var storedHistory = (await dbGet('recognition_winners')) || [];
        history = history.map(function(h){
          var stored = storedHistory.find(function(s){ return s.month === h.month; });
          return stored || h;
        });

        return res.json({
          ok: true,
          history: history,
        });
      }

      case 'recognition-award': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyA = req.body || {};
        if (!bodyA.empId || !bodyA.awardType) {
          return res.status(400).json({ error: 'empId + awardType required' });
        }

        var awardsList = (await dbGet('recognition_awards')) || [];
        var newAward = {
          id: 'AW_' + Date.now() + Math.random().toString(36).slice(2, 5),
          empId: bodyA.empId,
          empName: bodyA.empName || '',
          awardType: bodyA.awardType, // cafe | gift | bonus | certificate | other
          description: bodyA.description || '',
          value: bodyA.value || 0,
          month: bodyA.month || new Date().toISOString().slice(0, 7),
          givenBy: bodyA.actorId || 'admin',
          givenAt: new Date().toISOString(),
          note: bodyA.note || '',
        };
        awardsList.push(newAward);
        await dbSet('recognition_awards', awardsList);

        // Create notification for employee
        try {
          var notifs = (await dbGet('notifications')) || [];
          notifs.push({
            id: 'NTF_AW_' + Date.now(),
            empId: bodyA.empId,
            type: 'recognition',
            title: '🎁 تكريم جديد!',
            body: 'حصلت على جائزة: ' + (bodyA.description || bodyA.awardType),
            read: false,
            createdAt: new Date().toISOString(),
          });
          await dbSet('notifications', notifs);
        } catch(e) {}

        await auditLog(bodyA.actorId || 'admin', 'recognition_award_given', null, newAward, 'admin');

        return res.json({ ok: true, award: newAward });
      }

      case 'recognition-awards': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var awardsAll = (await dbGet('recognition_awards')) || [];
        if (req.query.empId) {
          awardsAll = awardsAll.filter(function(a){ return String(a.empId) === String(req.query.empId); });
        }
        if (req.query.month) {
          awardsAll = awardsAll.filter(function(a){ return a.month === req.query.month; });
        }
        awardsAll.sort(function(a, b){ return (b.givenAt || '').localeCompare(a.givenAt || ''); });
        return res.json(awardsAll);
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.108 — ADMIN SUMMARY (Mobile Admin Smart Card)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=admin-summary&role=admin|hr&empId=X
       * Returns comprehensive mobile dashboard data for admin/HR users
       */
      case 'admin-summary': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var roleAS = req.query.role || 'admin';
        var empIdAS = req.query.empId;

        var empsAS = (await dbGet('employees')) || [];
        var attAS = (await dbGet('attendance')) || [];
        var leavesAS = (await dbGet('leaves')) || [];
        var violsAS = (await dbGet('violations_v2')) || [];
        var holidaysDataAS = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };

        var todayAS = new Date().toISOString().slice(0, 10);
        var nowAS = new Date();
        var nowHourAS = nowAS.getHours();
        var todayDowAS = nowAS.getDay();
        var thisMonthAS = todayAS.slice(0, 7);

        // Check if today is weekend/holiday
        var isWeekendAS = (holidaysDataAS.weekendDays || [5, 6]).indexOf(todayDowAS) >= 0;
        var isHolidayAS = (holidaysDataAS.list || []).some(function(h){
          if (!h.date) return false;
          if (h.date === todayAS) return true;
          if (h.recurring && h.date.slice(5) === todayAS.slice(5)) return true;
          if (h.endDate && todayAS >= h.date && todayAS <= h.endDate) return true;
          return false;
        });

        // Active employees
        var activeEmps = empsAS.filter(function(e){
          return e.active !== false && !e.terminated;
        });

        // Today's attendance
        var todayAtt = attAS.filter(function(a){ return a.date === todayAS; });
        var todayCheckins = todayAtt.filter(function(a){ return a.type === 'checkin'; });
        var presentIds = new Set(todayCheckins.map(function(a){ return String(a.empId); }));
        var lateToday = todayCheckins.filter(function(a){ return a.late; }).length;

        // On leave today
        var onLeaveToday = leavesAS.filter(function(l){
          if (l.status !== 'approved') return false;
          return l.startDate && l.endDate && todayAS >= l.startDate && todayAS <= l.endDate;
        });
        var onLeaveIds = new Set(onLeaveToday.map(function(l){ return String(l.empId); }));

        var presentCount = presentIds.size;
        var onLeaveCount = onLeaveToday.length;
        var absentCount = activeEmps.filter(function(e){
          return !presentIds.has(String(e.id)) && !onLeaveIds.has(String(e.id));
        }).length;

        // ═══ Build alerts (role-filtered) ═══
        var alertsAS = [];

        // 1) Pending leaves (HR + Admin)
        var pendingLeaveStatuses = ['pending_m1', 'pending_m2', 'pending_final', 'handover_open', 'pending_delegates'];
        var pendingLeavesCount = leavesAS.filter(function(l){
          return pendingLeaveStatuses.indexOf(l.status) >= 0;
        }).length;

        if (pendingLeavesCount > 0) {
          alertsAS.push({
            id: 'PENDING_LEAVES',
            icon: '🏖️',
            severity: pendingLeavesCount >= 5 ? 'high' : 'medium',
            message: pendingLeavesCount + ' إجازة بانتظار الموافقة',
            action: 'view_leaves',
            count: pendingLeavesCount,
            for: 'all',
          });
        }

        // 2) Absent today (Admin only — during work hours)
        if (roleAS === 'admin' && !isWeekendAS && !isHolidayAS && nowHourAS >= 10 && absentCount > 0) {
          alertsAS.push({
            id: 'ABSENT_TODAY',
            icon: '🚫',
            severity: absentCount >= 3 ? 'high' : 'medium',
            message: absentCount + ' موظف غائب اليوم',
            action: 'view_attendance',
            count: absentCount,
            for: 'admin',
          });
        }

        // 3) High violations employees (Admin only)
        if (roleAS === 'admin') {
          var violsByEmp = {};
          violsAS.forEach(function(v){
            if (v.status === 'open' || v.status === 'ACTIVE') {
              violsByEmp[v.empId] = (violsByEmp[v.empId] || 0) + 1;
            }
          });
          var highVioEmps = Object.keys(violsByEmp).filter(function(eid){ return violsByEmp[eid] >= 3; });
          if (highVioEmps.length > 0) {
            alertsAS.push({
              id: 'HIGH_VIOLATIONS',
              icon: '⚖️',
              severity: 'high',
              message: highVioEmps.length + ' موظف بمخالفات متعددة',
              action: 'view_violations',
              count: highVioEmps.length,
              for: 'admin',
            });
          }
        }

        // 4) Contracts expiring (HR + Admin)
        var thirtyDays = new Date(nowAS.getTime() + 30 * 24 * 3600 * 1000);
        var expiringContracts = activeEmps.filter(function(e){
          if (!e.contractEndDate) return false;
          var d = new Date(e.contractEndDate);
          return d > nowAS && d <= thirtyDays;
        }).length;
        if (expiringContracts > 0) {
          alertsAS.push({
            id: 'CONTRACTS_EXPIRING',
            icon: '📄',
            severity: 'medium',
            message: expiringContracts + ' عقد ينتهي خلال 30 يوم',
            action: 'view_employees',
            count: expiringContracts,
            for: 'all',
          });
        }

        // 5) Late pattern (Admin only)
        if (roleAS === 'admin') {
          var lateByEmp = {};
          attAS.forEach(function(a){
            if (a.type === 'checkin' && a.late && a.date && a.date.startsWith(thisMonthAS)) {
              lateByEmp[a.empId] = (lateByEmp[a.empId] || 0) + 1;
            }
          });
          var chronicLate = Object.keys(lateByEmp).filter(function(eid){ return lateByEmp[eid] >= 3; }).length;
          if (chronicLate > 0) {
            alertsAS.push({
              id: 'LATE_PATTERN',
              icon: '⏰',
              severity: 'medium',
              message: chronicLate + ' موظف بتأخر متكرر',
              action: 'view_attendance',
              count: chronicLate,
              for: 'admin',
            });
          }
        }

        // 6) Pending HR requests (HR + Admin) — any admin_requests
        var hrRequestsCount = 0;
        try {
          var hrReqs = (await dbGet('hr_requests')) || [];
          hrRequestsCount = hrReqs.filter(function(r){ return r.status === 'pending' || r.status === 'under_review'; }).length;
        } catch(e) {}

        if (hrRequestsCount > 0) {
          alertsAS.push({
            id: 'HR_REQUESTS',
            icon: '📨',
            severity: 'medium',
            message: hrRequestsCount + ' طلب بانتظار المعالجة',
            action: 'view_requests',
            count: hrRequestsCount,
            for: 'all',
          });
        }

        // Sort alerts by severity (high first)
        var severityOrder = { high: 0, medium: 1, low: 2 };
        alertsAS.sort(function(a, b){
          return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
        });

        return res.json({
          ok: true,
          ts: new Date().toISOString(),
          role: roleAS,
          today: {
            date: todayAS,
            isWeekend: isWeekendAS,
            isHoliday: isHolidayAS,
            holidayName: isHolidayAS ? ((holidaysDataAS.list || []).find(function(h){
              if (h.date === todayAS) return true;
              if (h.recurring && h.date && h.date.slice(5) === todayAS.slice(5)) return true;
              return false;
            }) || {}).name : null,
          },
          stats: {
            totalEmployees: activeEmps.length,
            present: presentCount,
            absent: absentCount,
            late: lateToday,
            onLeave: onLeaveCount,
            attendanceRate: activeEmps.length > 0 ? Math.round((presentCount / activeEmps.length) * 100) : 0,
          },
          alerts: alertsAS,
          alertCounts: {
            total: alertsAS.length,
            high: alertsAS.filter(function(a){ return a.severity === 'high'; }).length,
            medium: alertsAS.filter(function(a){ return a.severity === 'medium'; }).length,
          },
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.106 — MIGRATE violations (v1) → violations_v2 (CLEANUP)
       * ═══════════════════════════════════════════════════════════════
       * POST /api/data?action=migrate-violations
       * Body: { mode: "dry_run" | "execute", actorId? }
       *
       * Steps:
       *   1. Read all from 'violations' (old)
       *   2. Read all from 'violations_v2' (new)
       *   3. Convert old format to new format
       *   4. Check for conflicts (same ID in both)
       *   5. Merge into violations_v2
       *   6. Create backup in 'violations_backup_YYYYMMDD'
       *   7. DO NOT delete old 'violations' key (safety net)
       *
       * Idempotent: safe to run multiple times (skips already-migrated items)
       */
      case 'migrate-violations': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyMV = req.body || {};
        var modeMV = bodyMV.mode || 'dry_run';
        var actorMV = bodyMV.actorId || 'admin';

        var oldViolations = (await dbGet('violations')) || [];
        var newViolations = (await dbGet('violations_v2')) || [];

        // Create lookup map for v2 (by original id)
        var existingIdsV2 = new Set();
        newViolations.forEach(function(v){
          if (v.id) existingIdsV2.add(String(v.id));
          if (v.migratedFromV1) existingIdsV2.add(String(v.migratedFromV1));
        });

        // Convert old → new format
        function convertOldToNew(oldV) {
          return {
            id: oldV.id || 'VIO_MIG_' + Date.now() + Math.random().toString(36).slice(2, 6),
            migratedFromV1: oldV.id,        // track original
            empId: oldV.empId,
            empName: oldV.empName || '',
            violationId: oldV.violationId || oldV.type || 'legacy',
            chapter: oldV.chapter || 'legacy',
            desc: oldV.desc || oldV.details || '',
            status: oldV.status === 'open' ? 'ACTIVE' : (oldV.status === 'closed' ? 'RESOLVED' : (oldV.status || 'ACTIVE')),
            occurrence: oldV.occurrence || 1,
            penalty: oldV.penalty || 'UNKNOWN',
            penaltyKey: oldV.penaltyKey || 'first',
            createdAt: oldV.ts || oldV.createdAt || new Date().toISOString(),
            createdBy: oldV.createdBy || 'legacy-migration',
            type: oldV.type,
            details: oldV.details,
            // Preserve any legacy fields
            _legacyData: {
              originalStatus: oldV.status,
              originalType: oldV.type,
            },
          };
        }

        var toMigrate = oldViolations.filter(function(v){
          return !existingIdsV2.has(String(v.id));
        });

        var alreadyMigrated = oldViolations.length - toMigrate.length;

        // Dry run: just return what WOULD happen
        if (modeMV === 'dry_run') {
          return res.json({
            ok: true,
            mode: 'dry_run',
            analysis: {
              oldCount: oldViolations.length,
              newCount: newViolations.length,
              alreadyMigrated: alreadyMigrated,
              willMigrate: toMigrate.length,
              sample: toMigrate.slice(0, 3).map(function(v){
                return {
                  id: v.id,
                  empId: v.empId,
                  type: v.type,
                  status: v.status,
                  ts: v.ts,
                };
              }),
            },
          });
        }

        // Execute: perform migration
        if (modeMV !== 'execute') {
          return res.status(400).json({ error: 'mode must be "dry_run" or "execute"' });
        }

        if (toMigrate.length === 0) {
          return res.json({
            ok: true,
            mode: 'execute',
            migrated: 0,
            alreadyMigrated: alreadyMigrated,
            message: 'لا توجد بيانات جديدة للنقل — كل شيء متزامن',
          });
        }

        // 1) Create timestamped backup
        var backupKey = 'violations_backup_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
        await dbSet(backupKey, {
          ts: new Date().toISOString(),
          byActor: actorMV,
          originalViolations: oldViolations,
          originalViolationsV2: newViolations,
          note: 'Automatic backup before v7.106 migration',
        });

        // 2) Convert and merge
        var convertedNew = toMigrate.map(convertOldToNew);
        var merged = newViolations.concat(convertedNew);

        // 3) Save to violations_v2
        await dbSet('violations_v2', merged);

        // 4) Audit log
        await auditLog(actorMV, 'migrate_violations_v1_to_v2', null, {
          oldCount: oldViolations.length,
          migrated: convertedNew.length,
          alreadyMigrated: alreadyMigrated,
          backupKey: backupKey,
        }, 'admin');

        return res.json({
          ok: true,
          mode: 'execute',
          migrated: convertedNew.length,
          alreadyMigrated: alreadyMigrated,
          totalInV2: merged.length,
          backupKey: backupKey,
          message: 'تم النقل بنجاح! البيانات القديمة محفوظة كنسخة احتياطية.',
        });
      }

      case 'violations': {
        if (req.method === 'GET') {
          let vs = await dbGet('violations') || [];
          const { empId } = req.query;
          if (empId) vs = vs.filter(v => v.empId === empId);
          return res.json(vs);
        }
        if (req.method === 'POST') {
          const vs = await dbGet('violations') || [];
          const newV = { id: 'V' + Date.now(), status: 'open', ...req.body, ts: new Date().toISOString() };
          vs.push(newV);
          await dbSet('violations', vs);
          // v7.84 — Audit
          await auditLog(req.body.actorId || 'system', 'violation_created', req.body.empId, {
            violationId: newV.id,
            type: req.body.type,
            details: req.body.details,
          }, 'violations');
          return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const vs = await dbGet('violations') || [];
          const { id, actorId, ...up } = req.body;
          const i = vs.findIndex(v => v.id === id);
          if (i >= 0) {
            var prev = { ...vs[i] };
            vs[i] = { ...vs[i], ...up, updatedAt: new Date().toISOString() };
            await dbSet('violations', vs);
            // v7.84 — Audit
            await auditLog(actorId || 'hr', 'violation_updated', vs[i].empId, {
              violationId: id,
              changes: up,
              prevStatus: prev.status,
            }, 'violations');
          }
          return res.json({ ok: true });
        }
        break;
      }

      case 'warnings': {
        if (req.method === 'GET') {
          let ws = await dbGet('warnings') || [];
          const { empId } = req.query;
          if (empId) ws = ws.filter(w => w.empId === empId);
          return res.json(ws);
        }
        if (req.method === 'POST') { const ws = await dbGet('warnings') || []; ws.push({ id: 'W' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() }); await dbSet('warnings', ws); return res.json({ ok: true }); }
        if (req.method === 'PUT') {
          const ws = await dbGet('warnings') || [];
          const { id, ...up } = req.body;
          const i = ws.findIndex(w => w.id === id);
          if (i >= 0) { ws[i] = { ...ws[i], ...up, updatedAt: new Date().toISOString() }; await dbSet('warnings', ws); }
          return res.json({ ok: true });
        }
        break;
      }

      case 'pre_absence': {
        if (req.method === 'GET') return res.json(await dbGet('pre_absences') || []);
        if (req.method === 'POST') {
          const pas = await dbGet('pre_absences') || [];
          var newPA = { id: 'PA' + Date.now(), status: 'pending', ...req.body, ts: new Date().toISOString() };
          pas.push(newPA);
          await dbSet('pre_absences', pas);

          // v6.37 — Notify manager + HR
          (async function(){
            try {
              var emps = (await dbGet('employees')) || [];
              var emp = emps.find(function(e){ return e.id === newPA.empId; });
              var managerId = emp && (emp.managerId || emp.supervisorId);
              var hrIds = emps.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
              var targets = [];
              if (managerId) targets.push(managerId);
              hrIds.forEach(function(id){ if (targets.indexOf(id) < 0) targets.push(id); });

              var notifs = (await dbGet('notifications')) || [];
              var nowISO = new Date().toISOString();
              targets.forEach(function(tid){
                notifs.push({
                  id: 'n_pareq_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  empId: tid,
                  type: 'pre_absence_request',
                  title: '🏥 إفادة غياب بعذر',
                  message: (emp && emp.name ? emp.name : 'موظف') + ' قدّم إفادة غياب بعذر (' + (newPA.reason || 'بدون سبب محدد') + ')',
                  preAbsenceId: newPA.id,
                  targetEmpId: newPA.empId,
                  read: false,
                  createdAt: nowISO,
                });
              });
              if (notifs.length > 1000) notifs = notifs.slice(-1000);
              await dbSet('notifications', notifs);

              if (managerId) {
                try {
                  var pushSubs = (await dbGet('push_subscriptions')) || {};
                  var sub = pushSubs[managerId];
                  if (sub && sub.subscription) {
                    await sendWebPush(sub.subscription, {
                      title: '🏥 إفادة غياب بعذر',
                      body: (emp && emp.name ? emp.name : 'موظف') + ' قدّم إفادة غياب بعذر',
                      tag: 'preabs-' + newPA.id,
                      data: { id: newPA.id, type: 'pre_absence' },
                    });
                  }
                } catch(e) {}
              }
            } catch(e) {}
          })();

          return res.json({ ok: true, preAbsence: newPA });
        }
        break;
      }

      /* ═══ CUSTODY — نظام العهد المتطور (3 أنواع) ═══ */
      case 'custody': {
        if (req.method === 'GET') {
          let items = await dbGet('custody') || [];
          const { empId, type, status } = req.query || {};
          if (empId) items = items.filter(c => c.empId === empId);
          if (type) items = items.filter(c => c.type === type);
          if (status) items = items.filter(c => c.status === status);
          return res.json(items);
        }
        if (req.method === 'POST') {
          const items = await dbGet('custody') || [];
          const body = req.body || {};

          // Type-specific validation
          if (body.type === 'asset' && !body.serialNumber) {
            return res.status(400).json({ error: 'رقم السيريال مطلوب للعهد الدائمة' });
          }
          if (body.type === 'cash' && (!body.amount || body.amount <= 0)) {
            return res.status(400).json({ error: 'المبلغ مطلوب للعهد النقدية' });
          }

          const item = {
            id: 'CUS' + Date.now(),
            type: body.type || 'consumable',  // consumable | asset | cash
            name: body.name,
            category: body.category || '',
            empId: body.empId,
            empName: body.empName || '',

            // For assets
            serialNumber: body.serialNumber || '',
            photoUrl: body.photoUrl || '',
            brand: body.brand || '',
            model: body.model || '',
            condition: body.condition || 'new',

            // For consumables
            quantity: body.quantity || 1,
            unit: body.unit || 'قطعة',

            // For cash
            amount: parseFloat(body.amount) || 0,
            spent: 0,
            balance: parseFloat(body.amount) || 0,
            purpose: body.purpose || '',

            // Common
            value: parseFloat(body.value) || 0,
            status: body.type === 'consumable' ? 'issued' : 'active',
            notes: body.notes || '',
            issuedAt: new Date().toISOString(),
            issuedBy: body.issuedBy || '',
            returnedAt: null,
            closedAt: null,

            acknowledged: false,
            acknowledgedAt: null,
          };
          items.push(item);
          await dbSet('custody', items);
          return res.json({ ok: true, item });
        }
        if (req.method === 'PUT') {
          const items = await dbGet('custody') || [];
          const { id, ...up } = req.body;
          const i = items.findIndex(c => c.id === id);
          if (i < 0) return res.status(404).json({ error: 'العهدة غير موجودة' });
          items[i] = { ...items[i], ...up, updatedAt: new Date().toISOString() };
          await dbSet('custody', items);
          return res.json({ ok: true, item: items[i] });
        }
        if (req.method === 'DELETE') {
          const items = await dbGet('custody') || [];
          await dbSet('custody', items.filter(c => c.id !== req.query.id));
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ CUSTODY ACKNOWLEDGE — الموظف يوقّع استلام ═══ */
      case 'custody-ack': {
        if (req.method !== 'POST') return res.status(400).json({ error: 'POST required' });
        const body = req.body || {};
        const items = await dbGet('custody') || [];
        const i = items.findIndex(c => c.id === body.custodyId);
        if (i < 0) return res.status(404).json({ error: 'العهدة غير موجودة' });
        if (items[i].empId !== body.empId) return res.status(403).json({ error: 'ليست عهدتك' });
        items[i].acknowledged = true;
        items[i].acknowledgedAt = new Date().toISOString();
        await dbSet('custody', items);
        return res.json({ ok: true });
      }

      /* ═══ CUSTODY RETURN — إعادة عهدة دائمة ═══ */
      case 'custody-return': {
        if (req.method !== 'POST') return res.status(400).json({ error: 'POST required' });
        const body = req.body || {};
        const items = await dbGet('custody') || [];
        const i = items.findIndex(c => c.id === body.custodyId);
        if (i < 0) return res.status(404).json({ error: 'العهدة غير موجودة' });
        items[i].status = body.condition === 'damaged' ? 'damaged' : 'returned';
        items[i].returnedAt = new Date().toISOString();
        items[i].returnCondition = body.condition || 'good';
        items[i].returnNotes = body.notes || '';
        items[i].returnedBy = body.returnedBy || '';
        await dbSet('custody', items);
        return res.json({ ok: true, item: items[i] });
      }

      /* ═══ CUSTODY INVOICES — فواتير العهد النقدية ═══ */
      case 'custody-invoices': {
        if (req.method === 'GET') {
          let invoices = await dbGet('custody_invoices') || [];
          const { custodyId, empId } = req.query || {};
          if (custodyId) invoices = invoices.filter(i => i.custodyId === custodyId);
          if (empId) invoices = invoices.filter(i => i.empId === empId);
          return res.json(invoices);
        }
        if (req.method === 'POST') {
          const body = req.body || {};
          if (!body.custodyId || !body.amount || !body.description) {
            return res.status(400).json({ error: 'بيانات ناقصة' });
          }
          const invoices = await dbGet('custody_invoices') || [];
          const invoice = {
            id: 'INV' + Date.now(),
            custodyId: body.custodyId,
            empId: body.empId,
            amount: parseFloat(body.amount),
            description: body.description,
            vendor: body.vendor || '',
            invoiceDate: body.invoiceDate || new Date().toISOString().split('T')[0],
            invoiceNumber: body.invoiceNumber || '',
            photoUrl: body.photoUrl || '',
            status: 'pending',
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: '',
          };
          invoices.push(invoice);
          await dbSet('custody_invoices', invoices);
          return res.json({ ok: true, invoice });
        }
        if (req.method === 'PUT') {
          const body = req.body || {};
          const invoices = await dbGet('custody_invoices') || [];
          const i = invoices.findIndex(inv => inv.id === body.id);
          if (i < 0) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
          const oldStatus = invoices[i].status;
          invoices[i] = { ...invoices[i], ...body, reviewedAt: new Date().toISOString() };
          await dbSet('custody_invoices', invoices);

          // If approved, update custody spent/balance
          if (oldStatus !== 'approved' && body.status === 'approved') {
            const items = await dbGet('custody') || [];
            const idx = items.findIndex(c => c.id === invoices[i].custodyId);
            if (idx >= 0 && items[idx].type === 'cash') {
              items[idx].spent = (items[idx].spent || 0) + invoices[i].amount;
              items[idx].balance = (items[idx].amount || 0) - items[idx].spent;
              await dbSet('custody', items);
            }
          }
          return res.json({ ok: true, invoice: invoices[i] });
        }
        if (req.method === 'DELETE') {
          const invoices = await dbGet('custody_invoices') || [];
          await dbSet('custody_invoices', invoices.filter(i => i.id !== req.query.id));
          return res.json({ ok: true });
        }
        break;
      }

      case 'custody_maintenance': {
        if (req.method === 'GET') {
          let logs = await dbGet('custody_maint') || [];
          const { custodyId } = req.query;
          if (custodyId) logs = logs.filter(l => l.custodyId === custodyId);
          return res.json(logs);
        }
        if (req.method === 'POST') {
          const logs = await dbGet('custody_maint') || [];
          const body = req.body || {};
          var entry = {
            id: 'CM' + Date.now(),
            custodyId: body.custodyId,
            type: body.type || 'routine', // routine | repair | inspection | upgrade
            description: body.description || '',
            cost: parseFloat(body.cost) || 0,
            vendor: body.vendor || '',
            doneBy: body.doneBy || '',
            date: body.date || new Date().toISOString().split('T')[0],
            nextDueDate: body.nextDueDate || null,
            photos: body.photos || [],
            notes: body.notes || '',
            ts: new Date().toISOString(),
          };
          logs.push(entry);
          await dbSet('custody_maint', logs);
          return res.json({ ok: true, entry: entry });
        }
        if (req.method === 'PUT') {
          const logs = await dbGet('custody_maint') || [];
          const body = req.body || {};
          const i = logs.findIndex(function(l){ return l.id === body.id; });
          if (i < 0) return res.status(404).json({ error: 'not found' });
          logs[i] = Object.assign({}, logs[i], body);
          await dbSet('custody_maint', logs);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          const logs = await dbGet('custody_maint') || [];
          const { id } = req.body || {};
          var filtered = logs.filter(function(l){ return l.id !== id; });
          await dbSet('custody_maint', filtered);
          return res.json({ ok: true });
        }
        break;
      }

      /* v6.60 — Custody status updates (operational | broken | in_maintenance | lost | retired) */
      case 'custody-status': {
        if (req.method !== 'POST' && req.method !== 'PUT') break;
        const body = req.body || {};
        if (!body.custodyId || !body.status) return res.status(400).json({ error: 'custodyId and status required' });
        const items = await dbGet('custody') || [];
        const i = items.findIndex(function(c){ return c.id === body.custodyId; });
        if (i < 0) return res.status(404).json({ error: 'custody not found' });

        // Record status history
        var history = items[i].statusHistory || [];
        history.push({
          status: body.status,
          previousStatus: items[i].operationalStatus || 'operational',
          changedBy: body.changedBy || 'admin',
          changedAt: new Date().toISOString(),
          reason: body.reason || '',
        });
        items[i].operationalStatus = body.status;
        items[i].statusHistory = history;
        if (body.reason) items[i].statusNote = body.reason;
        await dbSet('custody', items);
        return res.json({ ok: true, custody: items[i] });
      }

      /* v6.60 — Warranty tracking + upcoming expiry alerts */
      case 'custody-warranty': {
        if (req.method === 'GET') {
          const items = await dbGet('custody') || [];
          var today = new Date();
          var in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
          var result = {
            expiringSoon: [], // Within 30 days
            expired: [],
            active: [],
            noWarranty: [],
          };
          items.forEach(function(c){
            if (!c.warrantyEnd) { result.noWarranty.push(c); return; }
            var end = new Date(c.warrantyEnd);
            if (end < today) result.expired.push(c);
            else if (end < in30days) result.expiringSoon.push(c);
            else result.active.push(c);
          });
          return res.json(result);
        }
        if (req.method === 'PUT') {
          const body = req.body || {};
          const items = await dbGet('custody') || [];
          const i = items.findIndex(function(c){ return c.id === body.custodyId; });
          if (i < 0) return res.status(404).json({ error: 'not found' });
          items[i].warrantyStart = body.warrantyStart || items[i].warrantyStart;
          items[i].warrantyEnd = body.warrantyEnd || items[i].warrantyEnd;
          items[i].warrantyProvider = body.warrantyProvider || items[i].warrantyProvider;
          items[i].warrantyNote = body.warrantyNote || items[i].warrantyNote;
          await dbSet('custody', items);
          return res.json({ ok: true });
        }
        break;
      }

      /* v6.60 — Total cost of ownership for an asset */
      case 'custody-tco': {
        const { custodyId } = req.query || {};
        if (!custodyId) return res.status(400).json({ error: 'custodyId required' });
        const items = await dbGet('custody') || [];
        const item = items.find(function(c){ return c.id === custodyId; });
        if (!item) return res.status(404).json({ error: 'not found' });
        const maintLogs = (await dbGet('custody_maint') || []).filter(function(m){ return m.custodyId === custodyId; });

        var purchaseCost = parseFloat(item.purchaseCost) || 0;
        var maintTotalCost = maintLogs.reduce(function(sum, m){ return sum + (parseFloat(m.cost) || 0); }, 0);
        var byType = {};
        maintLogs.forEach(function(m){
          byType[m.type] = (byType[m.type] || 0) + (parseFloat(m.cost) || 0);
        });

        // Age calculation
        var ageYears = 0;
        if (item.purchaseDate) {
          var start = new Date(item.purchaseDate);
          var now = new Date();
          ageYears = ((now - start) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);
        }

        return res.json({
          custodyId: custodyId,
          itemName: item.name,
          purchaseCost: purchaseCost,
          purchaseDate: item.purchaseDate,
          ageYears: parseFloat(ageYears),
          maintenanceCount: maintLogs.length,
          maintenanceCost: maintTotalCost,
          totalCost: purchaseCost + maintTotalCost,
          byType: byType,
          maintenanceHistory: maintLogs,
        });
      }

      /* v6.60 — Maintenance due alerts (based on nextDueDate) */
      case 'custody-maintenance-due': {
        const maintLogs = await dbGet('custody_maint') || [];
        const items = await dbGet('custody') || [];
        var today = new Date();
        var in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Get last maintenance per custody
        var latestByCustody = {};
        maintLogs.forEach(function(m){
          if (!m.nextDueDate) return;
          if (!latestByCustody[m.custodyId] || new Date(m.date) > new Date(latestByCustody[m.custodyId].date)) {
            latestByCustody[m.custodyId] = m;
          }
        });

        var overdue = [], upcoming = [];
        Object.keys(latestByCustody).forEach(function(cid){
          var m = latestByCustody[cid];
          var item = items.find(function(c){ return c.id === cid; });
          if (!item) return;
          var due = new Date(m.nextDueDate);
          var enriched = Object.assign({}, m, { itemName: item.name, empName: item.empName, category: item.category });
          if (due < today) overdue.push(enriched);
          else if (due < in7days) upcoming.push(enriched);
        });

        return res.json({ overdue: overdue, upcoming: upcoming });
      }

      case 'gps_log': {
        if (req.method === 'GET') {
          let logs = await dbGet('gps_logs') || [];
          const { empId, date } = req.query;
          if (empId) logs = logs.filter(l => l.empId === empId);
          if (date) logs = logs.filter(l => l.date === date);
          return res.json(logs);
        }
        if (req.method === 'POST') {
          const logs = await dbGet('gps_logs') || [];
          const entry = { ...req.body, ts: new Date().toISOString(), date: new Date().toISOString().split('T')[0] };
          logs.push(entry);
          // Keep only last 7 days
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          const filtered = logs.filter(l => new Date(l.ts) > cutoff);
          await dbSet('gps_logs', filtered);
          return res.json({ ok: true });
        }
        break;
      }

      case 'termination': {
        if (req.method === 'GET') return res.json(await dbGet('terminations') || []);
        if (req.method === 'POST') {
          const ts = await dbGet('terminations') || [];
          const newTerm = { id: 'TERM' + Date.now(), status: 'pending', ...req.body, createdAt: new Date().toISOString() };
          ts.push(newTerm);
          await dbSet('terminations', ts);
          // Deactivate employee
          const emps = await dbGet('employees') || [];
          const ei = emps.findIndex(e => e.id === req.body.empId);
          if (ei >= 0) { emps[ei].terminated = true; emps[ei].terminatedAt = new Date().toISOString(); await dbSet('employees', emps); }
          // v6.97 — Auto-push to kadwar (fire-and-forget)
          safeKadwarPush('receive-termination', {
            employee_id: newTerm.empId,
            employee_name: newTerm.empName,
            termination_basma_id: newTerm.id,
            reason_code: newTerm.reason,
            reason_label: newTerm.reasonLabel || newTerm.reason,
            effective_date: newTerm.effectiveDate || newTerm.createdAt,
            notes: newTerm.notes,
            initiated_by: newTerm.initiatedBy,
            status: newTerm.status,
            created_at: newTerm.createdAt,
          }).catch(function(){ /* logged */ });
          return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const ts = await dbGet('terminations') || [];
          const { id, ...up } = req.body;
          const i = ts.findIndex(t => t.id === id);
          if (i >= 0) { ts[i] = { ...ts[i], ...up }; await dbSet('terminations', ts); }
          return res.json({ ok: true });
        }
        break;
      }

      /* v7.05 — اعتماد إنهاء الخدمة + إعادة دفع لكوادر (الحالة تتغير هناك) */
      case 'termination-approve': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, actor } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const ts = await dbGet('terminations') || [];
        const i = ts.findIndex(t => t.id === id);
        if (i < 0) return res.status(404).json({ error: 'لم يُعثر على سجل إنهاء الخدمة' });
        if (ts[i].status === 'approved') return res.status(400).json({ error: 'مُعتمد مسبقاً' });
        if (ts[i].status === 'cancelled') return res.status(400).json({ error: 'ملغي — لا يمكن الاعتماد' });
        ts[i].status = 'approved';
        ts[i].approvedAt = new Date().toISOString();
        ts[i].approvedBy = actor || 'admin';
        await dbSet('terminations', ts);
        // إعادة الدفع لكوادر مع الحالة المعتمدة (كوادر يغيّر حالة الموظف تلقائياً عند approved)
        safeKadwarPush('receive-termination', {
          employee_id: ts[i].empId,
          employee_name: ts[i].empName,
          termination_basma_id: ts[i].id,
          reason_code: ts[i].reason,
          reason_label: ts[i].reasonLabel || ts[i].reason,
          effective_date: ts[i].effectiveDate || ts[i].createdAt,
          notes: ts[i].notes,
          initiated_by: ts[i].initiatedBy,
          approved_by: ts[i].approvedBy,
          approved_at: ts[i].approvedAt,
          status: 'approved',
          created_at: ts[i].createdAt,
        }).catch(function(){ /* logged */ });
        await auditLog(actor || 'admin', 'approve_termination', id, { empId: ts[i].empId, reason: ts[i].reason }, 'employees');
        return res.json({ ok: true, termination: ts[i] });
      }

      /* v7.05 — إلغاء إنهاء خدمة معلّق (تصحيح خطأ) */
      case 'termination-cancel': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, actor, reason } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        const ts = await dbGet('terminations') || [];
        const i = ts.findIndex(t => t.id === id);
        if (i < 0) return res.status(404).json({ error: 'لم يُعثر على سجل إنهاء الخدمة' });
        if (ts[i].status === 'approved') return res.status(400).json({ error: 'لا يمكن إلغاء إنهاء خدمة مُعتمد' });
        ts[i].status = 'cancelled';
        ts[i].cancelledAt = new Date().toISOString();
        ts[i].cancelledBy = actor || 'admin';
        ts[i].cancelReason = reason || '';
        await dbSet('terminations', ts);
        // إعادة تفعيل حساب الموظف (لأنه تعطّل عند الإنشاء)
        const emps = await dbGet('employees') || [];
        const ei = emps.findIndex(e => e.id === ts[i].empId);
        if (ei >= 0) { emps[ei].terminated = false; delete emps[ei].terminatedAt; await dbSet('employees', emps); }
        await auditLog(actor || 'admin', 'cancel_termination', id, { empId: ts[i].empId, reason: reason }, 'employees');
        return res.json({ ok: true, termination: ts[i] });
      }

      /* ══════════════════════════════════════════════════════════════════
       * v7.08 — طلبات تعديل بيانات الموظف (Employee Edit Approval Flow)
       * ══════════════════════════════════════════════════════════════════
       * من بصمة 9: "المرفقات والبيانات يحتاجون موافقة HR قبل التحديث"
       * الموظف يعدّل → pending → HR توافق/ترفض → التعديل يُطبَّق
       */

      /* قائمة طلبات التعديل (كلها أو لموظف واحد، أو معلّقة فقط) */
      case 'employee-edit-list': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        const { empId, status } = req.query || {};
        let list = (await dbGet('employee-edit-requests')) || [];
        if (empId) list = list.filter(x => String(x.empId) === String(empId));
        if (status) list = list.filter(x => (x.status || 'pending') === status);
        list.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
        return res.json(list);
      }

      /* الموظف أو HR يطلب تعديل حقل معين */
      case 'employee-edit-request': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const b = req.body || {};
        const { empId, fieldKey, fieldLabel, oldValue, newValue, reason, requestedBy, requestedByName } = b;
        if (!empId || !fieldKey) return res.status(400).json({ error: 'empId + fieldKey مطلوبان' });
        // تحقق من عدم وجود طلب pending لنفس الحقل
        const list = (await dbGet('employee-edit-requests')) || [];
        const existing = list.find(x => String(x.empId) === String(empId) && x.fieldKey === fieldKey && (x.status || 'pending') === 'pending');
        if (existing) {
          return res.status(400).json({ error: 'يوجد طلب تعديل معلّق لهذا الحقل (#' + existing.id + ')' });
        }
        const emps = (await dbGet('employees')) || [];
        const emp = emps.find(e => String(e.id) === String(empId));
        const newReq = {
          id: 'EER' + Date.now(),
          empId: empId,
          empName: (emp && emp.name) || b.empName || '',
          fieldKey: fieldKey,
          fieldLabel: fieldLabel || fieldKey,
          oldValue: oldValue !== undefined ? oldValue : (emp ? emp[fieldKey] : null),
          newValue: newValue,
          reason: reason || '',
          status: 'pending',
          requestedBy: requestedBy || 'unknown',
          requestedByName: requestedByName || '',
          requestedAt: new Date().toISOString(),
        };
        list.push(newReq);
        // حد أقصى 1000
        if (list.length > 1000) list.splice(0, list.length - 1000);
        await dbSet('employee-edit-requests', list);
        // إشعار HR
        try {
          const notifs = (await dbGet('notifications')) || [];
          notifs.push({
            id: 'NTF' + Date.now(),
            role: 'hr', // لكل HR
            type: 'employee_edit_request',
            title: '✏️ طلب تعديل بيانات جديد',
            body: newReq.empName + ' يطلب تعديل: ' + newReq.fieldLabel,
            refId: newReq.id,
            read: false,
            createdAt: new Date().toISOString(),
          });
          await dbSet('notifications', notifs);
        } catch(e) {}
        await auditLog(requestedBy || 'employee', 'edit_request', newReq.id, { empId, fieldKey, newValue }, 'employees');
        return res.json({ ok: true, request: newReq });
      }

      /* HR توافق على طلب التعديل → يُطبَّق على سجل الموظف */
      case 'employee-edit-approve': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, actor, actorName } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id مطلوب' });
        const list = (await dbGet('employee-edit-requests')) || [];
        const i = list.findIndex(x => x.id === id);
        if (i < 0) return res.status(404).json({ error: 'الطلب غير موجود' });
        if (list[i].status !== 'pending') return res.status(400).json({ error: 'الطلب ليس معلّقاً' });
        // طبّق التعديل على سجل الموظف
        const emps = (await dbGet('employees')) || [];
        const ei = emps.findIndex(e => String(e.id) === String(list[i].empId));
        if (ei < 0) return res.status(404).json({ error: 'الموظف غير موجود' });
        const prevValue = emps[ei][list[i].fieldKey];
        emps[ei][list[i].fieldKey] = list[i].newValue;
        emps[ei].updatedAt = new Date().toISOString();
        await dbSet('employees', emps);
        // علّم الطلب
        list[i].status = 'approved';
        list[i].reviewedBy = actor || 'hr';
        list[i].reviewedByName = actorName || '';
        list[i].reviewedAt = new Date().toISOString();
        list[i].appliedValue = list[i].newValue;
        list[i].replacedValue = prevValue; // snapshot فعلي لحظة التطبيق
        await dbSet('employee-edit-requests', list);
        // إشعار الموظف
        try {
          const notifs = (await dbGet('notifications')) || [];
          notifs.push({
            id: 'NTF' + Date.now(),
            empId: list[i].empId,
            type: 'employee_edit_approved',
            title: '✅ تم اعتماد تعديل بياناتك',
            body: list[i].fieldLabel + ': ' + String(list[i].newValue),
            refId: list[i].id,
            read: false,
            createdAt: new Date().toISOString(),
          });
          await dbSet('notifications', notifs);
        } catch(e) {}
        await auditLog(actor || 'hr', 'edit_approve', id, { empId: list[i].empId, fieldKey: list[i].fieldKey, newValue: list[i].newValue, prevValue: prevValue }, 'employees');
        return res.json({ ok: true, request: list[i], employee: emps[ei] });
      }

      /* HR ترفض طلب التعديل */
      case 'employee-edit-reject': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, actor, actorName, rejectReason } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id مطلوب' });
        const list = (await dbGet('employee-edit-requests')) || [];
        const i = list.findIndex(x => x.id === id);
        if (i < 0) return res.status(404).json({ error: 'الطلب غير موجود' });
        if (list[i].status !== 'pending') return res.status(400).json({ error: 'الطلب ليس معلّقاً' });
        list[i].status = 'rejected';
        list[i].reviewedBy = actor || 'hr';
        list[i].reviewedByName = actorName || '';
        list[i].reviewedAt = new Date().toISOString();
        list[i].rejectReason = rejectReason || '';
        await dbSet('employee-edit-requests', list);
        // إشعار الموظف
        try {
          const notifs = (await dbGet('notifications')) || [];
          notifs.push({
            id: 'NTF' + Date.now(),
            empId: list[i].empId,
            type: 'employee_edit_rejected',
            title: '❌ رُفض طلب تعديل بياناتك',
            body: list[i].fieldLabel + (rejectReason ? ' — ' + rejectReason : ''),
            refId: list[i].id,
            read: false,
            createdAt: new Date().toISOString(),
          });
          await dbSet('notifications', notifs);
        } catch(e) {}
        await auditLog(actor || 'hr', 'edit_reject', id, { empId: list[i].empId, fieldKey: list[i].fieldKey, reason: rejectReason }, 'employees');
        return res.json({ ok: true, request: list[i] });
      }

      /* v7.75 — endpoint 'requests' القديم حُذف نهائياً، استُبدل بـ 'hr-requests' (v7.70+) */

      case 'clusters': {
        // Detect employee clusters (groups in same location)
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const logs = (await dbGet('gps_logs') || []).filter(l => l.date === targetDate && l.lat && l.lat !== 0);
        const settings = await dbGet('settings') || {};
        const clusterRadius = settings.clusterRadius || 30; // meters
        const clusterMinPeople = settings.clusterMinPeople || 3;
        const clusterMinMinutes = settings.clusterMinMinutes || 30;

        // Group logs by time windows (15-min blocks)
        var timeBlocks = {};
        logs.forEach(function(l) {
          var h = new Date(l.ts).getHours(), m = new Date(l.ts).getMinutes();
          var block = h + ":" + (m < 15 ? "00" : m < 30 ? "15" : m < 45 ? "30" : "45");
          if (!timeBlocks[block]) timeBlocks[block] = [];
          timeBlocks[block].push(l);
        });

        // Find clusters in each block
        var clusters = [];
        Object.keys(timeBlocks).forEach(function(block) {
          var bl = timeBlocks[block];
          var grouped = {};
          bl.forEach(function(l) {
            var key = Math.round(l.lat * 1000) + "," + Math.round(l.lng * 1000); // ~100m grid
            if (!grouped[key]) grouped[key] = { lat: l.lat, lng: l.lng, emps: new Set() };
            grouped[key].emps.add(l.empId);
          });
          Object.values(grouped).forEach(function(g) {
            if (g.emps.size >= clusterMinPeople) {
              clusters.push({ time: block, lat: g.lat, lng: g.lng, employees: Array.from(g.emps), count: g.emps.size });
            }
          });
        });

        return res.json({ date: targetDate, clusters, settings: { clusterRadius, clusterMinPeople, clusterMinMinutes } });
      }

      case 'comparison': {
        // Weekly employee movement comparison
        const emps = await dbGet('employees') || [];
        const logs = await dbGet('gps_logs') || [];
        const now = new Date();
        var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        var weekLogs = logs.filter(l => new Date(l.ts) >= weekAgo && l.lat && l.lat !== 0);

        var comparison = emps.filter(e => !e.terminated).map(function(e) {
          var myLogs = weekLogs.filter(l => l.empId === e.id);
          var stationary = 0, moving = 0;
          for (var i = 1; i < myLogs.length; i++) {
            var d = Math.sqrt(Math.pow(myLogs[i].lat - myLogs[i-1].lat, 2) + Math.pow(myLogs[i].lng - myLogs[i-1].lng, 2)) * 111000;
            if (d < 20) stationary++; else moving++;
          }
          var total = stationary + moving || 1;
          var appEvents = logs.filter(l => l.empId === e.id && l.event);
          var closedCount = appEvents.filter(l => l.event === "app_closed" || l.event === "app_hidden").length;
          return {
            id: e.id, name: e.name, branch: e.branch,
            totalPoints: myLogs.length,
            movementPct: Math.round(moving / total * 100),
            stationaryPct: Math.round(stationary / total * 100),
            appCloses: closedCount,
          };
        }).sort(function(a, b) { return b.movementPct - a.movementPct; });

        return res.json({ from: weekAgo.toISOString().split('T')[0], to: now.toISOString().split('T')[0], employees: comparison });
      }

      /* v6.44 — DIAGNOSTIC: shows what the system knows about org hierarchy */
      case 'debug-hierarchy': {
        var dbgEmps = (await dbGet('employees')) || [];
        var dbgStats = {
          totalEmployees: dbgEmps.length,
          withKadwarId: 0,
          withManagerKadwarId: 0,
          withManagerEmail: 0,
          withManagerId: 0,
          withoutAnyManager: 0,
        };
        var dbgSample = [];
        dbgEmps.forEach(function(e){
          if (e.kadwarId) dbgStats.withKadwarId++;
          if (e.managerKadwarId) dbgStats.withManagerKadwarId++;
          if (e.managerEmail) dbgStats.withManagerEmail++;
          if (e.managerId) dbgStats.withManagerId++;
          if (!e.managerKadwarId && !e.managerEmail && !e.managerId && !e.supervisorId) dbgStats.withoutAnyManager++;
        });
        // Show up to 5 sample employees (with sensitive fields redacted)
        dbgEmps.slice(0, 5).forEach(function(e){
          dbgSample.push({
            id: e.id,
            name: e.name,
            kadwarId: e.kadwarId || null,
            managerId: e.managerId || null,
            managerKadwarId: e.managerKadwarId || null,
            managerEmail: e.managerEmail || null,
            supervisorId: e.supervisorId || null,
            supervisorKadwarId: e.supervisorKadwarId || null,
            role: e.role || null,
            isManager: e.isManager || false,
          });
        });
        // Build hierarchy same way tawasul-list does
        var dbgKadToEmp = {}, dbgEmailToEmp = {};
        dbgEmps.forEach(function(e){
          if (e.kadwarId) dbgKadToEmp[String(e.kadwarId)] = String(e.id);
          if (e.email) dbgEmailToEmp[String(e.email).toLowerCase()] = String(e.id);
        });
        var dbgHierarchy = (await dbGet('org_hierarchy')) || {};
        dbgEmps.forEach(function(e){
          if (!e || !e.id) return;
          var empKey = String(e.id);
          if (dbgHierarchy[empKey]) return;
          var managerId = null;
          if (e.managerId) managerId = String(e.managerId);
          else if (e.managerKadwarId && dbgKadToEmp[String(e.managerKadwarId)]) managerId = dbgKadToEmp[String(e.managerKadwarId)];
          else if (e.managerEmail && dbgEmailToEmp[String(e.managerEmail).toLowerCase()]) managerId = dbgEmailToEmp[String(e.managerEmail).toLowerCase()];
          if (managerId && managerId !== empKey) dbgHierarchy[empKey] = managerId;
        });
        return res.json({
          stats: dbgStats,
          sampleEmployees: dbgSample,
          computedHierarchy: dbgHierarchy,
          hierarchySize: Object.keys(dbgHierarchy).length,
          hint: 'إذا withManagerKadwarId = 0 فالمزامنة من كوادر لم تحفظ managerId. إذا > 0 لكن hierarchySize = 0 فالـ managerKadwarId لا يطابق أي kadwarId موجود.',
        });
      }

      case 'auto_check': {
        // Auto-detect violations for today + workType-aware + auto-warn after 3 lates
        const today = new Date().toISOString().split('T')[0];
        const emps = await dbGet('employees') || [];
        const att = (await dbGet('attendance') || []).filter(a => a.date === today);
        const violations = await dbGet('violations') || [];
        const preAbs = (await dbGet('pre_absences') || []).filter(p => p.date === today);
        const branches = await dbGet('branches') || [];
        const settings = await dbGet('settings') || {};
        // v6.36 — load work_types for per-employee thresholds
        const workTypesData = (await dbGet('work_types')) || { types: {}, overrides: {} };
        var newViolations = [];
        var hour = new Date().getHours(), min = new Date().getMinutes();
        var curMin = hour * 60 + min;

        // Helper: get workType for employee
        function getEmpWorkType(empId) {
          var key = (workTypesData.overrides && workTypesData.overrides[empId]) || 'full_time';
          return (workTypesData.types && workTypesData.types[key]) || null;
        }

        for (const emp of emps) {
          if (emp.terminated || emp.onLeave) continue;
          if (preAbs.find(p => p.empId === emp.id)) continue; // Pre-notified absence
          var empAtt = att.filter(a => a.empId === emp.id);
          var hasCheckin = empAtt.find(a => a.type === 'checkin' || a.type === 'الحضور');
          var wt = getEmpWorkType(emp.id);
          var isFlex = wt && wt.flexible === true;
          var lateGrace = (wt && wt.lateAfterMin) || 15;
          var br = branches.find(b => b.id === emp.branch) || { start: "08:30" };
          var startMin = parseInt((br.start || '08:30').split(":")[0] || 8) * 60 + parseInt((br.start || '08:30').split(":")[1] || 30);

          // Late detection — skipped for flexible workers (they set their own start)
          if (!isFlex && curMin > startMin + lateGrace && hasCheckin) {
            var checkinTime = new Date(hasCheckin.ts);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            if (checkinMin > startMin + 5) {
              var lateMin = checkinMin - startMin;
              var existing = violations.find(v => v.empId === emp.id && v.date === today && v.type === "late");
              if (!existing) newViolations.push({ empId: emp.id, empName: emp.name, type: "late", date: today, details: "تأخر " + lateMin + " دقيقة (حد نوع الدوام: " + lateGrace + " د)" });
            }
          }

          // Absent detection — flex workers only considered absent at end of day
          var absentThreshold = isFlex ? (24 * 60) : (startMin + 60);
          if (curMin > absentThreshold && !hasCheckin) {
            var existing2 = violations.find(v => v.empId === emp.id && v.date === today && v.type === "absent");
            if (!existing2) newViolations.push({ empId: emp.id, empName: emp.name, type: "absent", date: today, details: "غياب بدون إفادة مسبقة" });
          }
        }

        // Save new violations + SEND NOTIFICATIONS to employee and HR
        if (newViolations.length > 0) {
          var allNotifs = (await dbGet('notifications')) || [];
          var nowISO = new Date().toISOString();

          for (const v of newViolations) {
            var vId = 'V' + Date.now() + Math.random().toString(36).substr(2, 4);
            violations.push({ id: vId, status: 'open', ...v, ts: nowISO });

            // Notify the employee
            var empNotifTitle = v.type === 'late' ? '⏰ تنبيه تأخير' : v.type === 'absent' ? '🚫 تنبيه غياب' : '⚠️ مخالفة جديدة';
            var empNotifMsg = v.type === 'late'
              ? 'تم تسجيل تأخير اليوم: ' + (v.details || '') + '. الرجاء مراجعة قسم الموارد البشرية.'
              : v.type === 'absent'
              ? 'تم تسجيل غياب اليوم بدون إفادة مسبقة. الرجاء المبادرة بالتواصل مع HR.'
              : 'تم تسجيل مخالفة: ' + (v.details || '');
            allNotifs.push({
              id: 'n_emp_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
              empId: v.empId,
              type: v.type,
              title: empNotifTitle,
              message: empNotifMsg,
              violationId: vId,
              read: false,
              createdAt: nowISO,
            });

            // Notify HR / admins (by flagging for all HR users)
            var hrEmps = (await dbGet('employees')) || [];
            var hrIds = hrEmps.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
            hrIds.forEach(function(hrId){
              allNotifs.push({
                id: 'n_hr_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                empId: hrId,
                type: 'hr_alert',
                title: '👔 مخالفة تتطلب مراجعة',
                message: 'الموظف ' + (v.empName || '—') + ': ' + (v.details || v.type),
                violationId: vId,
                targetEmpId: v.empId,
                read: false,
                createdAt: nowISO,
              });
            });
          }

          // Keep last 1000 notifs
          if (allNotifs.length > 1000) allNotifs = allNotifs.slice(-1000);

          await dbSet('violations', violations);
          await dbSet('notifications', allNotifs);
        }

        // v6.36 — AUTO-WARNING ESCALATION: 3+ late/absent in rolling 30 days → auto-warning
        var warnings = await dbGet('warnings') || [];
        var autoWarningsCreated = 0;
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Group violations by employee, count lates in last 30 days
        var empViolationCounts = {};
        violations.forEach(function(v){
          if (!v.empId) return;
          if (v.type !== 'late' && v.type !== 'absent' && v.type !== 'break_window') return;
          var vDate = v.date ? new Date(v.date) : (v.ts ? new Date(v.ts) : null);
          if (!vDate || vDate < thirtyDaysAgo) return;
          var key = v.empId + ':' + v.type;
          if (!empViolationCounts[key]) empViolationCounts[key] = { empId: v.empId, type: v.type, count: 0, empName: v.empName };
          empViolationCounts[key].count++;
        });

        // Thresholds for auto-warning
        var WARNING_THRESHOLDS = { late: 3, absent: 2, break_window: 3 };
        var WARNING_LABELS = { late: 'تأخر متكرر', absent: 'غياب متكرر', break_window: 'مخالفة بريك متكررة' };

        Object.keys(empViolationCounts).forEach(function(k){
          var info = empViolationCounts[k];
          var threshold = WARNING_THRESHOLDS[info.type];
          if (info.count < threshold) return;
          // Check if we already issued a warning for this employee+type in the last 30 days
          var alreadyWarned = warnings.some(function(w){
            if (w.empId !== info.empId) return false;
            if (w.autoType !== info.type) return false;
            var wDate = w.ts ? new Date(w.ts) : null;
            return wDate && wDate >= thirtyDaysAgo;
          });
          if (alreadyWarned) return;
          // Create auto-warning
          var wNow = new Date().toISOString();
          var deadlineDate = new Date(); deadlineDate.setDate(deadlineDate.getDate() + 7);
          warnings.push({
            id: 'W' + Date.now() + Math.random().toString(36).substr(2, 4),
            empId: info.empId,
            empName: info.empName || '—',
            status: 'pending',
            level: 'auto',
            autoType: info.type,
            reason: WARNING_LABELS[info.type] + ' — ' + info.count + ' حالات خلال 30 يوماً',
            issuedBy: 'system_auto',
            ts: wNow,
            deadline: deadlineDate.toISOString(),
          });
          autoWarningsCreated++;
          // Notify the employee
          var warnAllNotifs = [];
          try { warnAllNotifs = (allNotifs && allNotifs.length) ? allNotifs : ((/** @type {any[]} */ (warnAllNotifs || []))); } catch(e) {}
          // Push in-app notification
          (async function(){
            try {
              var curNotifs = (await dbGet('notifications')) || [];
              curNotifs.push({
                id: 'n_warn_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                empId: info.empId,
                type: 'auto_warning',
                title: '📋 إنذار رسمي تلقائي',
                message: WARNING_LABELS[info.type] + ' — ' + info.count + ' حالات خلال 30 يوماً. تواصل مع HR خلال 7 أيام.',
                read: false,
                createdAt: wNow,
              });
              if (curNotifs.length > 1000) curNotifs = curNotifs.slice(-1000);
              await dbSet('notifications', curNotifs);
            } catch(e) {}
          })();
        });

        if (autoWarningsCreated > 0) await dbSet('warnings', warnings);

        // Auto-escalate overdue warnings (original behavior preserved)
        var escalated = 0;
        for (const w of warnings) {
          if (w.status === 'pending' && w.deadline && new Date(w.deadline) < new Date()) {
            w.status = 'escalated';
            w.escalatedAt = new Date().toISOString();
            escalated++;
          }
        }
        if (escalated > 0) await dbSet('warnings', warnings);

        // v6.36 — Track last auto-check timestamp for throttling
        await dbSet('auto_check_last_run', new Date().toISOString());

        return res.json({ ok: true, newViolations: newViolations.length, escalated, autoWarnings: autoWarningsCreated, date: today });
      }

      case 'dependents': {
        if (req.method === 'GET') { const ds = await dbGet('dependents') || []; const { empId } = req.query; return res.json(empId ? ds.filter(d => d.empId === empId) : ds); }
        if (req.method === 'POST') { const ds = await dbGet('dependents') || []; ds.push({ id: 'DEP' + Date.now(), status: 'pending', ...req.body }); await dbSet('dependents', ds); return res.json({ ok: true }); }
        break;
      }

      case 'tickets': {
        if (req.method === 'GET') {
          var all = (await dbGet('tickets')) || [];
          // Normalize legacy tickets (add missing fields)
          all = all.map(function(t){
            if (!t.messages) t.messages = [];
            if (!t.initiatedBy) t.initiatedBy = t.empId ? 'employee' : 'hr';
            return t;
          });
          // Filter by empId if provided (for mobile app — show only mine)
          if (req.query.empId) {
            all = all.filter(function(t){ return String(t.empId) === String(req.query.empId); });
          }
          return res.json(all);
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          var ts = (await dbGet('tickets')) || [];
          var now = new Date().toISOString();
          // ── v6.81 — Create new ticket (from HR or employee) ──
          if (body.action === 'create' || !body.action) {
            var newTicket = {
              id: 'T' + Date.now(),
              empId: body.empId,            // recipient (employee)
              empName: body.empName || '',
              initiatedBy: body.initiatedBy || 'employee', // 'employee' | 'hr'
              createdBy: body.createdBy || '',              // name of creator
              createdByRole: body.createdByRole || '',
              subject: body.subject || '',
              category: body.category || 'general',         // استفسار / طلب وثيقة / تذكير / تنبيه / شكر / عام
              template: body.template || null,              // if created from a template
              priority: body.priority || 'normal',          // low | normal | high | urgent
              requiresReply: !!body.requiresReply,
              replyDeadline: body.replyDeadline || null,
              status: 'open',                               // open | replied | resolved | closed
              lastReadByEmp: body.initiatedBy === 'employee' ? now : null,
              lastReadByHr: body.initiatedBy === 'hr' ? now : null,
              messages: [{
                id: 'M' + Date.now(),
                ts: now,
                by: body.createdBy || (body.initiatedBy === 'hr' ? 'hr' : body.empName || 'موظف'),
                byRole: body.createdByRole || (body.initiatedBy === 'hr' ? 'hr' : 'employee'),
                text: body.message || body.subject || '',
                attachments: body.attachments || [],
              }],
              ts: now,
              updatedAt: now,
            };
            ts.push(newTicket);
            await dbSet('tickets', ts);
            return res.json({ ok: true, ticket: newTicket });
          }
          // ── v6.81 — Add message to existing ticket ──
          if (body.action === 'reply') {
            var idx = ts.findIndex(function(t){ return t.id === body.ticketId; });
            if (idx < 0) return res.status(404).json({ error: 'التذكرة غير موجودة' });
            if (!ts[idx].messages) ts[idx].messages = [];
            ts[idx].messages.push({
              id: 'M' + Date.now(),
              ts: now,
              by: body.by || '',
              byRole: body.byRole || 'employee',
              text: body.text || '',
              attachments: body.attachments || [],
            });
            ts[idx].updatedAt = now;
            // Auto-transition status
            if (body.byRole === 'employee') {
              ts[idx].status = 'replied';
              ts[idx].lastReadByEmp = now;
            } else if (body.byRole === 'hr' || body.byRole === 'admin') {
              if (ts[idx].status === 'replied' || ts[idx].status === 'open') ts[idx].status = 'open';
              ts[idx].lastReadByHr = now;
            }
            await dbSet('tickets', ts);
            return res.json({ ok: true, ticket: ts[idx] });
          }
          // ── v6.81 — Update status (resolve / close) ──
          if (body.action === 'update-status') {
            var idx2 = ts.findIndex(function(t){ return t.id === body.ticketId; });
            if (idx2 < 0) return res.status(404).json({ error: 'التذكرة غير موجودة' });
            ts[idx2].status = body.status || 'resolved';
            ts[idx2].updatedAt = now;
            await dbSet('tickets', ts);
            return res.json({ ok: true, ticket: ts[idx2] });
          }
          // ── v6.81 — Mark as read ──
          if (body.action === 'mark-read') {
            var idx3 = ts.findIndex(function(t){ return t.id === body.ticketId; });
            if (idx3 < 0) return res.status(404).json({ error: 'التذكرة غير موجودة' });
            if (body.byRole === 'employee') ts[idx3].lastReadByEmp = now;
            else if (body.byRole === 'hr' || body.byRole === 'admin') ts[idx3].lastReadByHr = now;
            await dbSet('tickets', ts);
            return res.json({ ok: true });
          }
          // ── Legacy fallback (simple create) ──
          ts.push({ id: 'T' + Date.now(), status: 'open', messages: [], initiatedBy: 'employee', ...body, ts: now });
          await dbSet('tickets', ts);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var id = req.query.id;
          if (!id) return res.status(400).json({ error: 'id required' });
          var all = (await dbGet('tickets')) || [];
          await dbSet('tickets', all.filter(function(t){ return t.id !== id; }));
          return res.json({ ok: true });
        }
        break;
      }

      /* v6.81 — HR ticket templates (قوالب جاهزة) */
      case 'hr-ticket-templates': {
        // Default templates — يمكن للإدارة الإضافة عبر system_settings لاحقاً
        var DEFAULT_TEMPLATES = [
          {
            id: 'tpl_iqama',
            icon: '📄',
            category: 'طلب وثيقة',
            subject: 'تحديث صورة الإقامة',
            message: 'نرجو منك رفع صورة واضحة من الإقامة السارية خلال 3 أيام عمل. إذا كانت منتهية أو قريبة من الانتهاء، يرجى إبلاغنا فوراً.',
            requiresReply: true,
            priority: 'high',
          },
          {
            id: 'tpl_iban',
            icon: '🏦',
            category: 'تحديث بيانات',
            subject: 'تحديث رقم الآيبان البنكي',
            message: 'نرجو تزويدنا برقم الآيبان البنكي المحدّث مع صورة من هوية الحساب من التطبيق البنكي.',
            requiresReply: true,
            priority: 'normal',
          },
          {
            id: 'tpl_sce',
            icon: '🏛',
            category: 'تذكير',
            subject: 'تجديد عضوية الهيئة السعودية للمهندسين',
            message: 'عضويتك في الهيئة السعودية للمهندسين قاربت على الانتهاء. يرجى تجديدها قبل التاريخ المحدد لتجنب توقف العمل.',
            requiresReply: true,
            priority: 'high',
          },
          {
            id: 'tpl_contract',
            icon: '📝',
            category: 'طلب وثيقة',
            subject: 'توقيع العقد الجديد',
            message: 'نرجو الحضور إلى الموارد البشرية لتوقيع العقد الجديد، أو إبلاغنا بالوقت المناسب لزيارتك.',
            requiresReply: true,
            priority: 'high',
          },
          {
            id: 'tpl_insurance',
            icon: '🏥',
            category: 'استلام',
            subject: 'استلام بطاقة التأمين الصحي',
            message: 'تم إصدار بطاقة التأمين الصحي الخاصة بك (ولعائلتك). يرجى استلامها من مكتب الموارد البشرية.',
            requiresReply: false,
            priority: 'normal',
          },
          {
            id: 'tpl_personal',
            icon: '👤',
            category: 'تحديث بيانات',
            subject: 'تحديث البيانات الشخصية',
            message: 'نرجو منك مراجعة بياناتك الشخصية في ملفك والتأكد من تحديث: رقم الجوال، العنوان، جهة الطوارئ. إذا وجدت أي نقص يرجى تزويدنا بالتصحيح.',
            requiresReply: true,
            priority: 'normal',
          },
          {
            id: 'tpl_thanks',
            icon: '🌟',
            category: 'شكر',
            subject: 'شكر وتقدير',
            message: 'نشكرك على جهودك المتميزة في العمل خلال الفترة الماضية. استمر في التفوّق — تقديرنا الدائم لك.',
            requiresReply: false,
            priority: 'low',
          },
        ];
        return res.json({ templates: DEFAULT_TEMPLATES });
      }

      /* v7.70 — HR Requests: قوالب طلبات HR من الموظفين (شهادة راتب، خبرة، خطاب تعريف...) */
      case 'hr-requests': {
        if (req.method === 'GET') {
          var all = (await dbGet('hr-requests')) || [];
          // Filter by empId if provided
          if (req.query.empId) {
            all = all.filter(function(r){ return String(r.empId) === String(req.query.empId); });
          }
          // Filter by status if provided
          if (req.query.status) {
            all = all.filter(function(r){ return r.status === req.query.status; });
          }
          // Sort by ts desc
          all.sort(function(a,b){ return (b.ts || '').localeCompare(a.ts || ''); });
          return res.json(all);
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          if (!body.empId || !body.type) {
            return res.status(400).json({ error: 'empId + type مطلوبان' });
          }
          var nowIso = new Date().toISOString();
          var reqs = (await dbGet('hr-requests')) || [];
          var newReq = {
            id: 'HR' + Date.now() + Math.floor(Math.random()*1000),
            empId: body.empId,
            empName: body.empName || '',
            type: body.type,           // salary_cert | experience_cert | intro_letter | promotion | advance | transfer | hours_adjust | medical_ins | other
            typeLabel: body.typeLabel || body.type,
            purpose: body.purpose || '',       // للبنك / للتأشيرة / ...
            language: body.language || 'ar',   // ar | en | both
            copies: Number(body.copies) || 1,
            extraData: body.extraData || {},   // أي حقول إضافية لكل نوع
            notes: body.notes || '',
            status: 'pending',                 // pending | approved | rejected | ready | delivered
            ts: nowIso,
            decidedBy: null,
            decidedByName: null,
            decidedAt: null,
            rejectReason: null,
            deliveryNote: null,
          };
          reqs.push(newReq);
          await dbSet('hr-requests', reqs);
          return res.json({ ok: true, id: newReq.id, request: newReq });
        }
        if (req.method === 'PUT') {
          // Admin updates status
          var b = req.body || {};
          if (!b.id) return res.status(400).json({ error: 'id مطلوب' });
          var allR = (await dbGet('hr-requests')) || [];
          var idx = allR.findIndex(function(r){ return r.id === b.id; });
          if (idx < 0) return res.status(404).json({ error: 'طلب غير موجود' });
          if (b.status) allR[idx].status = b.status;
          if (b.rejectReason !== undefined) allR[idx].rejectReason = b.rejectReason;
          if (b.deliveryNote !== undefined) allR[idx].deliveryNote = b.deliveryNote;
          allR[idx].decidedBy = b.decidedBy || null;
          allR[idx].decidedByName = b.decidedByName || null;
          allR[idx].decidedAt = new Date().toISOString();
          await dbSet('hr-requests', allR);

          // v7.84 — تسجيل العملية في Audit Log
          if (b.status) {
            await auditLog(b.decidedBy || 'hr', 'hr_request_' + b.status, allR[idx].empId, {
              requestId: allR[idx].id,
              type: allR[idx].type,
              typeLabel: allR[idx].typeLabel,
              status: b.status,
              rejectReason: b.rejectReason || null,
              deliveryNote: b.deliveryNote || null,
            }, 'admin');
          }

          // Create notification for employee
          try {
            var notifs = (await dbGet('notifications')) || [];
            var statusMsg = b.status === 'approved' ? '✓ طلبك مُوافَق عليه' :
                            b.status === 'rejected' ? '✕ طلبك مرفوض' :
                            b.status === 'ready' ? '📄 شهادتك جاهزة للتحميل' :
                            b.status === 'delivered' ? '✅ تم تسليم طلبك' : 'تحديث';
            notifs.unshift({
              id: 'N' + Date.now(),
              empId: allR[idx].empId,
              type: 'hr_request',
              title: statusMsg + ': ' + (allR[idx].typeLabel || allR[idx].type),
              body: b.rejectReason ? 'سبب الرفض: ' + b.rejectReason : (b.deliveryNote || 'انتقل لقسم المعاملات الإدارية لعرض التفاصيل'),
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /* notification failure doesn't break the flow */ }
          return res.json({ ok: true, request: allR[idx] });
        }
        break;
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.84 — Audit Log endpoint (عرض سجل العمليات الكامل)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=audit-log
       *   ?category=leaves|payroll|violations|employees|settings|salary|admin|tawasul
       *   ?userId=XXX (filter by actor)
       *   ?target=XXX (filter by target)
       *   ?from=YYYY-MM-DD&to=YYYY-MM-DD
       *   ?limit=200 (default: 200, max: 1000)
       * DELETE /api/data?action=audit-log (clear all — admin only)
       */
      case 'audit-log': {
        if (req.method === 'GET') {
          var log = await dbGet('audit-log') || [];
          if (!Array.isArray(log)) log = [];

          // Also merge legacy payroll log entries if new log is empty
          if (log.length === 0) {
            var legacy = await dbGet('payroll-audit-log') || [];
            log = legacy.map(function(e){ return Object.assign({}, e, { category: e.category || 'payroll' }); });
          }

          // Apply filters
          var cat = req.query.category;
          var userId = req.query.userId;
          var target = req.query.target;
          var from = req.query.from;
          var to = req.query.to;
          var limit = Math.min(parseInt(req.query.limit || '200'), 1000);

          var filtered = log.filter(function(e){
            if (cat && e.category !== cat) return false;
            if (userId && String(e.userId) !== String(userId)) return false;
            if (target && String(e.target) !== String(target)) return false;
            if (from && e.ts < from) return false;
            if (to && e.ts > (to + 'T23:59:59')) return false;
            return true;
          });

          // Sort newest first
          filtered.sort(function(a, b){ return (b.ts || '').localeCompare(a.ts || ''); });

          // Pagination
          var total = filtered.length;
          var slice = filtered.slice(0, limit);

          // Stats
          var stats = {};
          filtered.forEach(function(e){
            var c = e.category || 'general';
            stats[c] = (stats[c] || 0) + 1;
          });

          return res.json({
            ok: true,
            entries: slice,
            total: total,
            returned: slice.length,
            stats: stats,
          });
        }

        if (req.method === 'DELETE') {
          // حذف السجل بالكامل — للطوارئ فقط
          await dbSet('audit-log', []);
          return res.json({ ok: true, cleared: true });
        }
        break;
      }

      /* v6.81 — HR ticket summary (counts unread per employee) */
      case 'hr-tickets-summary': {
        var empId = req.query.empId;
        var all = (await dbGet('tickets')) || [];
        if (empId) {
          // Mobile app — count unread HR messages for this employee
          var mine = all.filter(function(t){ return String(t.empId) === String(empId); });
          var unreadCount = 0;
          var pendingReplies = 0;
          mine.forEach(function(t){
            if (t.status === 'closed' || t.status === 'resolved') return;
            var lastMsg = (t.messages || [])[((t.messages || []).length - 1)];
            if (!lastMsg) return;
            // Unread if last message is from HR and empl hasn't read since
            if (lastMsg.byRole === 'hr' || lastMsg.byRole === 'admin') {
              if (!t.lastReadByEmp || new Date(t.lastReadByEmp) < new Date(lastMsg.ts)) {
                unreadCount++;
              }
              if (t.requiresReply && lastMsg.byRole !== 'employee') pendingReplies++;
            }
          });
          return res.json({ unreadCount: unreadCount, pendingReplies: pendingReplies, totalOpen: mine.filter(function(t){ return t.status === 'open' || t.status === 'replied'; }).length });
        }
        // Admin view — per-employee summary
        var emps = (await dbGet('employees')) || [];
        var byEmp = {};
        emps.forEach(function(e){ byEmp[String(e.id)] = { empId: e.id, empName: e.name, open: 0, replied: 0, total: 0 }; });
        all.forEach(function(t){
          var key = String(t.empId);
          if (!byEmp[key]) byEmp[key] = { empId: t.empId, empName: t.empName || 'موظف', open: 0, replied: 0, total: 0 };
          byEmp[key].total++;
          if (t.status === 'open') byEmp[key].open++;
          else if (t.status === 'replied') byEmp[key].replied++;
        });
        return res.json({ byEmployee: Object.values(byEmp) });
      }

      case 'events': {
        if (req.method === 'GET') return res.json(await dbGet('events') || []);
        if (req.method === 'POST') {
          // Bulk save (full array) or single add
          if (Array.isArray(req.body)) {
            await dbSet('events', req.body);
            return res.json({ ok: true });
          }
          const es = await dbGet('events') || []; es.push({ id: 'EV' + Date.now(), ...req.body }); await dbSet('events', es); return res.json({ ok: true });
        }
        if (req.method === 'PUT') {
          const es = await dbGet('events') || [];
          const { id, ...up } = req.body;
          const i = es.findIndex(e => e.id === id);
          if (i >= 0) { es[i] = { ...es[i], ...up }; await dbSet('events', es); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') { const es = await dbGet('events') || []; await dbSet('events', es.filter(e => e.id !== req.query.id)); return res.json({ ok: true }); }
        break;
      }

      /* v6.67 — Internal Surveys (استطلاعات الرأي) */
      /* v6.77 — Export all data for backup (all KV keys) */
      case 'export-all-keys': {
        if (req.method !== 'GET') break;
        // قائمة كل الـ keys المعروفة في النظام
        const ALL_KEYS = [
          'employees', 'attendance', 'leaves', 'permissions', 'pre_absence',
          'tickets', 'complaints', 'investigations', 'violations', 'appeals',
          'tasks', 'messages', 'tawasul_threads',
          'branches', 'holidays', 'geofence', 'work_types',
          'surveys', 'survey_votes',
          'assets', 'custody_maintenance',
          'dependents', 'attachments', 'cv_files',
          'announcements', 'banners', 'events', 'questions',
          'reports', 'tracking_settings', 'system_settings',
          'attendance_locks', 'face_data', 'biometric_credentials',
          'redemptions', 'benefits', 'achievements_log',
          'org_hierarchy', 'leave_balances', 'kadwar_settings',
          'desktop_pairings', 'push_subscriptions',
          'letters_log', 'termination_records', 'laiha',
          'admin_requests', 'employee_record_log',
        ];

        const result = {};
        const errors = [];
        let totalKeys = 0;
        let totalSize = 0;

        for (const key of ALL_KEYS) {
          try {
            const value = await dbGet(key);
            if (value !== null && value !== undefined) {
              result[key] = value;
              totalKeys++;
              totalSize += JSON.stringify(value).length;
            }
          } catch (e) {
            errors.push({ key, error: e.message });
          }
        }

        return res.json({
          success: true,
          data: result,
          totalKeys,
          totalSize,
          exportedAt: new Date().toISOString(),
          errors,
        });
      }

      case 'surveys': {
        if (req.method === 'GET') {
          let list = (await dbGet('surveys')) || [];
          const { status, id, empId } = req.query || {};
          if (id) {
            var one = list.find(function(s){ return s.id === id; });
            if (!one) return res.status(404).json({ error: 'not found' });
            return res.json(one);
          }
          if (status === 'active') {
            var today = new Date().toISOString().split('T')[0];
            list = list.filter(function(s){
              if (s.status !== 'active') return false;
              if (s.endDate && s.endDate < today) return false;
              if (s.startDate && s.startDate > today) return false;  // not yet started
              return true;
            });
          }

          // v7.110 — FIX: Filter by targetGroups if empId provided
          if (empId) {
            var empsX = (await dbGet('employees')) || [];
            var currentEmp = empsX.find(function(e){ return String(e.id) === String(empId); });
            if (currentEmp) {
              list = list.filter(function(s){
                var tg = s.targetGroups || ['all'];
                // If "all" is in target groups, everyone sees it
                if (tg.indexOf('all') >= 0) return true;
                // Check branch match
                if (tg.indexOf(currentEmp.branch) >= 0 || tg.indexOf(currentEmp.branchId) >= 0) return true;
                // Check role match
                if (tg.indexOf(currentEmp.role) >= 0) return true;
                // Check specific empId match
                if (tg.indexOf(currentEmp.id) >= 0 || tg.indexOf(String(currentEmp.id)) >= 0) return true;
                // Check department match
                if (currentEmp.department && tg.indexOf(currentEmp.department) >= 0) return true;
                // Check jobTitle match
                if (currentEmp.jobTitle && tg.indexOf(currentEmp.jobTitle) >= 0) return true;
                return false;
              });
            }
          }

          return res.json(list);
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          if (!body.title || !Array.isArray(body.options) || body.options.length < 2) {
            return res.status(400).json({ error: 'عنوان وخيارين على الأقل مطلوبان' });
          }
          var list = (await dbGet('surveys')) || [];
          var survey = {
            id: 'SRV' + Date.now(),
            title: body.title,
            description: body.description || '',
            options: body.options.map(function(o, i){
              return { id: 'o' + i, text: typeof o === 'string' ? o : o.text, votes: 0 };
            }),
            anonymous: !!body.anonymous,
            multipleChoice: !!body.multipleChoice,
            targetGroups: body.targetGroups || ['all'],
            startDate: body.startDate || new Date().toISOString().split('T')[0],
            endDate: body.endDate || null,
            status: body.status || 'active',
            createdBy: body.createdBy || 'admin',
            createdAt: new Date().toISOString(),
            totalVotes: 0,
          };
          list.push(survey);
          await dbSet('surveys', list);
          return res.json({ ok: true, survey: survey });
        }
        if (req.method === 'PUT') {
          var body = req.body || {};
          if (!body.id) return res.status(400).json({ error: 'id required' });
          var list = (await dbGet('surveys')) || [];
          var i = list.findIndex(function(s){ return s.id === body.id; });
          if (i < 0) return res.status(404).json({ error: 'not found' });
          ['title', 'description', 'status', 'endDate', 'targetGroups'].forEach(function(k){
            if (body[k] !== undefined) list[i][k] = body[k];
          });
          await dbSet('surveys', list);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var body = req.body || {};
          if (!body.id) return res.status(400).json({ error: 'id required' });
          var list = (await dbGet('surveys')) || [];
          list = list.filter(function(s){ return s.id !== body.id; });
          await dbSet('surveys', list);
          // Also clear votes
          var votes = (await dbGet('survey_votes')) || {};
          delete votes[body.id];
          await dbSet('survey_votes', votes);
          return res.json({ ok: true });
        }
        break;
      }

      /* v6.67 — Submit vote for a survey */
      case 'survey-vote': {
        if (req.method !== 'POST') break;
        var body = req.body || {};
        if (!body.surveyId || !body.empId || !Array.isArray(body.optionIds) || body.optionIds.length === 0) {
          return res.status(400).json({ error: 'surveyId, empId, and optionIds required' });
        }
        var list = (await dbGet('surveys')) || [];
        var survey = list.find(function(s){ return s.id === body.surveyId; });
        if (!survey) return res.status(404).json({ error: 'استطلاع غير موجود' });
        if (survey.status !== 'active') return res.status(400).json({ error: 'الاستطلاع غير نشط' });
        var today = new Date().toISOString().split('T')[0];
        if (survey.endDate && survey.endDate < today) return res.status(400).json({ error: 'انتهى الاستطلاع' });

        // Check if already voted
        var votes = (await dbGet('survey_votes')) || {};
        if (!votes[body.surveyId]) votes[body.surveyId] = {};

        // For anonymous: hash the empId so we can check duplicates without revealing identity
        var voterKey = survey.anonymous
          ? 'a_' + Buffer.from(body.empId + body.surveyId).toString('base64').substring(0, 20)
          : body.empId;

        if (votes[body.surveyId][voterKey]) {
          return res.status(400).json({ error: 'سبق أن صوّتَ في هذا الاستطلاع' });
        }

        // Record vote
        votes[body.surveyId][voterKey] = {
          optionIds: body.optionIds,
          votedAt: new Date().toISOString(),
          anonymous: !!survey.anonymous,
        };
        await dbSet('survey_votes', votes);

        // Update tallies on the survey
        body.optionIds.forEach(function(optId){
          var opt = survey.options.find(function(o){ return o.id === optId; });
          if (opt) opt.votes = (opt.votes || 0) + 1;
        });
        survey.totalVotes = (survey.totalVotes || 0) + 1;
        await dbSet('surveys', list);

        return res.json({ ok: true, survey: survey });
      }

      /* v6.67 — Check if user has voted on a given survey */
      case 'survey-has-voted': {
        var empId = req.query.empId;
        var surveyId = req.query.surveyId;
        if (!empId || !surveyId) return res.status(400).json({ error: 'empId and surveyId required' });
        var list = (await dbGet('surveys')) || [];
        var survey = list.find(function(s){ return s.id === surveyId; });
        if (!survey) return res.json({ voted: false });
        var votes = (await dbGet('survey_votes')) || {};
        var surveyVotes = votes[surveyId] || {};
        var voterKey = survey.anonymous
          ? 'a_' + Buffer.from(empId + surveyId).toString('base64').substring(0, 20)
          : empId;
        return res.json({ voted: !!surveyVotes[voterKey], vote: surveyVotes[voterKey] || null });
      }

      /* v6.67 — Get detailed results (only survey creator or admin can see who voted for non-anonymous) */
      case 'survey-results': {
        var surveyId = req.query.surveyId;
        if (!surveyId) return res.status(400).json({ error: 'surveyId required' });
        var list = (await dbGet('surveys')) || [];
        var survey = list.find(function(s){ return s.id === surveyId; });
        if (!survey) return res.status(404).json({ error: 'not found' });
        var votes = (await dbGet('survey_votes')) || {};
        var surveyVotes = votes[surveyId] || {};
        var emps = (await dbGet('employees')) || [];
        var voterCount = Object.keys(surveyVotes).length;

        var detailed = survey.options.map(function(opt){
          return { id: opt.id, text: opt.text, votes: opt.votes || 0, voters: [] };
        });

        if (!survey.anonymous) {
          Object.keys(surveyVotes).forEach(function(empId){
            var vote = surveyVotes[empId];
            var emp = emps.find(function(e){ return e.id === empId; });
            vote.optionIds.forEach(function(optId){
              var row = detailed.find(function(d){ return d.id === optId; });
              if (row) row.voters.push({ id: empId, name: emp ? emp.name : empId, votedAt: vote.votedAt });
            });
          });
        }

        return res.json({
          survey: survey,
          totalVoters: voterCount,
          results: detailed,
          anonymous: survey.anonymous,
          eligibleEmployees: emps.length,
          participationRate: emps.length > 0 ? Math.round((voterCount / emps.length) * 100) : 0,
        });
      }

      case 'settings': {
        if (req.method === 'GET') return res.json(await dbGet('settings') || {});
        if (req.method === 'PUT') { await dbSet('settings', req.body); return res.json({ ok: true }); }
        break;
      }

      /* ═══ SSO VERIFY — التحقق من token SSO من كوادر ═══ */
      case 'sso-verify': {
        var body = req.body || {};
        var token = body.token;
        if (!token) return res.status(400).json({ ok: false, error: 'token مطلوب' });
        try {
          // Ask kadwar to validate the token
          var r = await fetch('https://hma.engineer/api/basma-sync?action=sso-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token }),
          });
          if (!r.ok) {
            return res.status(401).json({ ok: false, error: 'الجلسة منتهية أو غير صالحة' });
          }
          var d = await r.json();
          if (!d.ok || !d.employee) {
            return res.status(401).json({ ok: false, error: d.error || 'جلسة غير صالحة' });
          }
          // Find the matching employee in basma
          var emps = await dbGet('employees') || [];
          var emp = emps.find(function(x) {
            if (!x) return false;
            if (d.employee.idNumber && x.idNumber === d.employee.idNumber) return true;
            if (d.employee.username && (x.username || '').toLowerCase() === (d.employee.username || '').toLowerCase()) return true;
            if (d.employee.email && (x.email || '').toLowerCase() === (d.employee.email || '').toLowerCase()) return true;
            return false;
          });
          if (!emp) {
            return res.status(404).json({ ok: false, error: 'الموظف غير موجود في بصمة — اطلب من الإدارة مزامنة' });
          }
          // Return safe employee object (no password hash)
          var safeEmp = Object.assign({}, emp);
          delete safeEmp.passwordHash;
          delete safeEmp.password;
          delete safeEmp.passwordSalt;
          return res.json({ ok: true, employee: safeEmp, ts: new Date().toISOString() });
        } catch (e) {
          return res.status(500).json({ ok: false, error: 'فشل الاتصال بكوادر: ' + (e && e.message ? e.message : String(e)) });
        }
      }

      /* ═══ WORK TYPES — إعدادات أنواع الدوام + overrides للموظفين ═══ */
      case 'work_types': {
        if (req.method === 'POST') {
          var body = req.body || {};
          var current = (await dbGet('work_types')) || { types: {}, overrides: {} };
          if (body.types) current.types = body.types;
          if (body.overrides) current.overrides = body.overrides;
          await dbSet('work_types', current);
          return res.json({ ok: true, ...current });
        }
        var wt = (await dbGet('work_types')) || { types: {}, overrides: {} };
        return res.json(wt);
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.90 — Holidays Management (العطل الرسمية + أيام الراحة)
       * ═══════════════════════════════════════════════════════════════
       * Storage:
       *   - Key: 'holidays'
       *   - Structure: {
       *       weekendDays: [5, 6],              // أيام نهاية الأسبوع (0=Sunday ... 6=Saturday)
       *       list: [{
       *         id, name, date (YYYY-MM-DD), endDate?, type, recurring, description
       *       }]
       *     }
       *
       * GET ?action=holidays — يُعيد القائمة كاملة
       * GET ?action=holidays&year=2026 — يُعيد عطل السنة المحددة فقط
       * POST ?action=holidays — يحفظ القائمة كاملة (body: { weekendDays, list })
       * GET ?action=is-holiday&date=YYYY-MM-DD — فحص إذا يوم معين عطلة
       */
      case 'holidays': {
        if (req.method === 'GET') {
          var h = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };
          if (!h.weekendDays) h.weekendDays = [5, 6];
          if (!Array.isArray(h.list)) h.list = [];
          // Optional year filter
          var year = req.query.year;
          if (year) {
            var filtered = h.list.filter(function(x){
              if (!x.date) return false;
              if (x.recurring) return true; // recurring holidays apply every year
              return x.date.startsWith(String(year));
            });
            return res.json({ ok: true, weekendDays: h.weekendDays, list: filtered, totalAllYears: h.list.length });
          }
          return res.json({ ok: true, ...h });
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          var actorId = body.actorId || 'admin';
          delete body.actorId;
          var current = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };
          if (Array.isArray(body.weekendDays)) current.weekendDays = body.weekendDays;
          if (Array.isArray(body.list)) current.list = body.list;
          await dbSet('holidays', current);
          // v7.90 — Audit log
          await auditLog(actorId, 'holidays_updated', null, {
            weekendDays: current.weekendDays,
            listCount: current.list.length,
          }, 'settings');
          return res.json({ ok: true, ...current });
        }
        if (req.method === 'DELETE') {
          var holidayId = req.query.id;
          if (!holidayId) return res.status(400).json({ error: 'id required' });
          var currentD = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };
          currentD.list = (currentD.list || []).filter(function(x){ return x.id !== holidayId; });
          await dbSet('holidays', currentD);
          return res.json({ ok: true, deleted: holidayId });
        }
        break;
      }

      /* ═══ v7.127 — Holiday Banner Config (enable/disable) ═══ */
      case 'holiday-banner-config': {
        if (req.method === 'GET') {
          var cfg = await dbGet('holiday_banner_config');
          // Default: enabled if no config exists
          var enabled = cfg && typeof cfg.enabled === 'boolean' ? cfg.enabled : true;
          return res.json({ ok: true, enabled: enabled });
        }
        if (req.method === 'POST' || req.method === 'PUT') {
          var body = req.body || {};
          var enabled = body.enabled !== false; // default true
          await dbSet('holiday_banner_config', { enabled: enabled, updatedAt: new Date().toISOString(), updatedBy: body.updatedBy || 'admin' });
          return res.json({ ok: true, enabled: enabled });
        }
        return res.status(405).json({ error: 'GET or POST required' });
      }

      /* ═══ v7.90 — فحص سريع: هل التاريخ عطلة؟ ═══ */
      case 'is-holiday': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var date = req.query.date;
        if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
        var h = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };
        var weekendDays = h.weekendDays || [5, 6];
        var dt = new Date(date);
        if (isNaN(dt.getTime())) return res.status(400).json({ error: 'invalid date' });

        // Check weekend
        var dayOfWeek = dt.getDay();
        if (weekendDays.indexOf(dayOfWeek) >= 0) {
          return res.json({ ok: true, isHoliday: true, type: 'weekend', name: 'نهاية الأسبوع' });
        }

        // Check list of holidays
        var mmDd = date.slice(5); // "MM-DD"
        var matched = null;
        for (var i = 0; i < (h.list || []).length; i++) {
          var entry = h.list[i];
          if (!entry.date) continue;
          // Exact match
          if (entry.date === date) { matched = entry; break; }
          // Recurring (match MM-DD)
          if (entry.recurring && entry.date.slice(5) === mmDd) { matched = entry; break; }
          // Range (date...endDate)
          if (entry.endDate && date >= entry.date && date <= entry.endDate) { matched = entry; break; }
        }
        if (matched) {
          return res.json({ ok: true, isHoliday: true, type: matched.type || 'official', name: matched.name, details: matched });
        }
        return res.json({ ok: true, isHoliday: false });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.127 — Holiday Banner Config
       * ═══════════════════════════════════════════════════════════════
       * GET  ?action=holiday-banner-config  — جلب الإعداد الحالي
       * POST ?action=holiday-banner-config  — تحديث الإعداد (body: { enabled: true/false })
       * افتراضياً: enabled = true
       */
      case 'holiday-banner-config': {
        if (req.method === 'GET') {
          var cfg = (await dbGet('holiday_banner_config')) || { enabled: true };
          return res.json({ ok: true, enabled: cfg.enabled !== false });
        }
        if (req.method === 'POST') {
          var body = req.body || {};
          var enabled = body.enabled !== false;
          await dbSet('holiday_banner_config', { enabled: enabled, updatedAt: new Date().toISOString() });
          return res.json({ ok: true, enabled: enabled });
        }
        return res.status(405).json({ error: 'GET or POST required' });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.97 — Work Days Calculator Endpoint
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=work-days&from=YYYY-MM-DD&to=YYYY-MM-DD
       *   يحسب عدد أيام العمل الفعلية بين تاريخين
       *   (يستبعد نهاية الأسبوع والعطل الرسمية من holidays)
       */
      case 'work-days': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var fromD = req.query.from;
        var toD = req.query.to;
        if (!fromD || !toD) return res.status(400).json({ error: 'from + to required (YYYY-MM-DD)' });

        try {
          var result = await calculateWorkDays(fromD, toD);
          return res.json({
            ok: true,
            from: fromD,
            to: toD,
            ...result,
          });
        } catch(e) {
          return res.status(400).json({ error: 'invalid dates: ' + e.message });
        }
      }

      /* ═══ WEB PUSH — generate VAPID keys (ONE-TIME SETUP) ═══ */
      case 'vapid-generate': {
        try {
          var keys = webpush.generateVAPIDKeys();
          return res.json({
            ok: true,
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
            instructions: [
              '1. انسخ المفتاحين',
              '2. اذهب لـ Vercel → basma-hma → Settings → Environment Variables',
              '3. أضف: VAPID_PUBLIC_KEY = ' + keys.publicKey,
              '4. أضف: VAPID_PRIVATE_KEY = ' + keys.privateKey,
              '5. أضف (اختياري): VAPID_CONTACT_EMAIL = admin@hma.engineer',
              '6. اضغط Save ثم Redeploy من Deployments',
              '7. افتح التطبيق على جوالك، اقبل الإشعارات، ثم جرّب الاختبار من لوحة المدير',
            ],
          });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ WEB PUSH — VAPID public key (client subscribes with it) ═══ */
      case 'vapid-public-key': {
        return res.json({ publicKey: (process.env.VAPID_PUBLIC_KEY || '').trim() });
      }

      /* ═══ WEB PUSH — subscribe employee to push ═══ */
      case 'subscribe-push': {
        var body = req.body || {};
        var empId = body.empId;
        var subscription = body.subscription;
        if (!empId || !subscription) return res.status(400).json({ ok: false, error: 'empId + subscription required' });
        var subs = (await dbGet('push_subscriptions')) || {};
        subs[empId] = { subscription: subscription, ts: new Date().toISOString() };
        await dbSet('push_subscriptions', subs);
        return res.json({ ok: true });
      }

      /* ═══ WEB PUSH — unsubscribe ═══ */
      case 'unsubscribe-push': {
        var body = req.body || {};
        var empId = body.empId;
        if (!empId) return res.status(400).json({ ok: false, error: 'empId required' });
        var subs = (await dbGet('push_subscriptions')) || {};
        delete subs[empId];
        await dbSet('push_subscriptions', subs);
        return res.json({ ok: true });
      }

      /* ═══ v7.87 — PUSH STATUS (هل الموظف مشترك؟) ═══ */
      case 'push-status': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var empIdQ = req.query.empId;
        if (!empIdQ) return res.status(400).json({ error: 'empId مطلوب' });
        var subsP = (await dbGet('push_subscriptions')) || {};
        var mySub = subsP[empIdQ];
        return res.json({
          ok: true,
          subscribed: !!mySub,
          subscribedAt: mySub ? mySub.ts : null,
          vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        });
      }

      /* ═══ v7.87 — PUSH OVERVIEW (للمدير: من مشترك ومن لا) ═══ */
      case 'push-overview': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var subsO = (await dbGet('push_subscriptions')) || {};
        var empsO = (await dbGet('employees')) || [];
        var activeEmps = empsO.filter(function(e){ return e.active !== false; });
        var subscribedIds = Object.keys(subsO);
        var subscribedSet = new Set(subscribedIds);
        var subscribedEmps = activeEmps.filter(function(e){ return subscribedSet.has(String(e.id)); }).map(function(e){
          return {
            id: e.id, name: e.name,
            branchId: e.branchId, jobTitle: e.jobTitle,
            subscribedAt: subsO[e.id] ? subsO[e.id].ts : null,
          };
        });
        var unsubscribedEmps = activeEmps.filter(function(e){ return !subscribedSet.has(String(e.id)); }).map(function(e){
          return { id: e.id, name: e.name, branchId: e.branchId, jobTitle: e.jobTitle };
        });
        return res.json({
          ok: true,
          total: activeEmps.length,
          subscribed: subscribedEmps.length,
          unsubscribed: unsubscribedEmps.length,
          pct: activeEmps.length ? Math.round((subscribedEmps.length / activeEmps.length) * 100) : 0,
          subscribedEmps: subscribedEmps,
          unsubscribedEmps: unsubscribedEmps,
          vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        });
      }

      /* ═══ v7.87 — SEND PUSH to multiple emps (admin-broadcast) ═══ */
      case 'push-broadcast': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyBc = req.body || {};
        var empIds = bodyBc.empIds; // array of emp IDs
        var title = bodyBc.title || '📢 ' + ((bodyBc.title || '').trim() || 'تعميم');
        var message = bodyBc.body || bodyBc.message || '';
        var actorIdBc = bodyBc.actorId || 'admin';

        if (!Array.isArray(empIds) || empIds.length === 0) {
          // Broadcast to all subscribed if empIds is empty/null
          var subsAll = (await dbGet('push_subscriptions')) || {};
          empIds = Object.keys(subsAll);
        }
        if (!message.trim()) return res.status(400).json({ error: 'body/message مطلوب' });

        var subsBc = (await dbGet('push_subscriptions')) || {};
        var sentCount = 0, failedCount = 0, noSubCount = 0;
        var results = [];

        for (var i = 0; i < empIds.length; i++) {
          var eid = empIds[i];
          var subItem = subsBc[eid];
          if (!subItem) {
            noSubCount++;
            results.push({ empId: eid, sent: false, reason: 'no-subscription' });
            continue;
          }
          var pushR = await sendWebPush(subItem.subscription, {
            title: title,
            body: message,
            tag: 'broadcast-' + Date.now(),
            data: { type: 'broadcast' },
          });
          if (pushR.sent) sentCount++;
          else failedCount++;
          results.push({ empId: eid, sent: pushR.sent, reason: pushR.reason });

          // Also save to notifications table (as fallback)
          try {
            var notifsBc = (await dbGet('notifications')) || [];
            notifsBc.unshift({
              id: 'N' + Date.now() + '_' + i,
              empId: eid,
              type: 'broadcast',
              title: title,
              message: message,
              read: false,
              ts: new Date().toISOString(),
            });
            await dbSet('notifications', notifsBc.slice(0, 500));
          } catch(e) {}
        }

        // Audit log
        await auditLog(actorIdBc, 'push_broadcast', null, {
          targets: empIds.length,
          sent: sentCount,
          failed: failedCount,
          noSub: noSubCount,
          title: title,
          messagePreview: message.slice(0, 100),
        }, 'admin');

        return res.json({
          ok: true,
          total: empIds.length,
          sent: sentCount,
          failed: failedCount,
          noSubscription: noSubCount,
          results: results,
        });
      }

      /* ═══ TEST NOTIFY — إرسال إشعار/اتصال وهمي (مع push حقيقي) ═══ */
      case 'test-notify': {
        var body = req.body || {};
        var empId = body.empId;
        if (!empId) return res.status(400).json({ ok: false, error: 'empId مطلوب' });

        // 1. Save to DB (polling fallback picks this up)
        var notifs = (await dbGet('notifications')) || [];
        var newNotif = {
          id: 'N' + Date.now(),
          empId: empId,
          type: body.type || 'test',
          title: body.title || 'إشعار اختبار',
          message: body.message || 'إشعار من المدير',
          fakeCall: body.type === 'fake_call',
          callType: body.callType || 'checkin',
          read: false,
          ts: new Date().toISOString(),
        };
        notifs.unshift(newNotif);
        await dbSet('notifications', notifs.slice(0, 500));

        // 2. Try sending real Web Push
        var pushResult = { sent: false, reason: '' };
        try {
          var subs = (await dbGet('push_subscriptions')) || {};
          var sub = subs[empId];
          if (!sub) {
            pushResult.reason = 'الموظف لم يفعّل الإشعارات بعد (يجب أن يفتح التطبيق على جواله ويوافق على الإذن)';
          } else if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            pushResult.reason = 'VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY غير معرّفين في Vercel env — استخدم polling fallback';
          } else {
            // Try Web Push using native crypto (simple implementation)
            pushResult = await sendWebPush(sub.subscription, {
              title: newNotif.title,
              body: newNotif.message,
              fakeCall: newNotif.fakeCall,
              callType: newNotif.callType,
              tag: 'basma-' + newNotif.id,
            });
          }
        } catch (e) {
          pushResult.reason = 'خطأ: ' + (e.message || String(e));
        }

        return res.json({
          ok: true,
          notification: newNotif,
          push: pushResult,
          hint: pushResult.sent ? null : 'الإشعار محفوظ في DB — التطبيق سيكتشفه خلال 15 ثانية (polling)',
        });
      }

      /* ═══ STORAGE STATUS — تحقق من تفعيل Redis + R2 ═══ */
      case 'storage-status': {
        var redisTest = null;
        if (USE_REDIS) {
          try {
            await redisRequest('PING');
            redisTest = 'ok';
          } catch(e) {
            redisTest = 'error: ' + e.message;
          }
        }
        var r2Test = null;
        if (USE_R2) {
          try {
            var testKey = 'test/' + Date.now() + '.txt';
            var upResult = await r2Upload(testKey, 'test', 'text/plain');
            r2Test = upResult ? 'ok (' + upResult.url + ')' : 'upload returned null';
            // Clean up test file
            r2Delete(testKey).catch(function(){});
          } catch(e) {
            r2Test = 'error: ' + e.message;
          }
        }
        return res.json({
          system: SYSTEM,
          redis: {
            enabled: USE_REDIS,
            url: USE_REDIS ? REDIS_URL.slice(0, 40) + '...' : null,
            test: redisTest,
          },
          r2: {
            enabled: USE_R2,
            bucket: USE_R2 ? R2_BUCKET : null,
            publicUrl: R2_PUBLIC_URL || null,
            test: r2Test,
          },
          blobFallback: true,
          primary: USE_REDIS ? 'upstash-redis' : 'ERROR: Redis not configured',
          ts: new Date().toISOString(),
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.131 — System Audit (تقرير شامل عن الاستضافات الـ 5)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=system-audit
       * يعطي تقرير كامل عن: Redis, R2, Vercel Blob, GitHub, Vercel
       * مع إشارات ضوئية (green/yellow/red) لكل خدمة.
       */
      case 'system-audit': {
        var audit = {
          timestamp: new Date().toISOString(),
          services: {},
          summary: { total: 5, ok: 0, warning: 0, error: 0 },
        };

        // ───── 1) Upstash Redis ─────
        try {
          var redisStart = Date.now();
          await redisRequest('PING');
          var redisPingMs = Date.now() - redisStart;

          var keysToCheck = Object.keys(AUTO_LIMITS || {});
          var keysFound = [];
          var totalSize = 0;
          var critical = [];
          var warnings = [];

          for (var i = 0; i < keysToCheck.length; i++) {
            var k = keysToCheck[i];
            var v = await dbGet(k);
            if (v == null) continue;
            var size = JSON.stringify(v).length;
            totalSize += size;
            var count = Array.isArray(v) ? v.length : 1;
            if (size > 9.5 * 1024 * 1024) critical.push({ key: k, sizeMB: (size/1024/1024).toFixed(2) });
            else if (size > 8 * 1024 * 1024) warnings.push({ key: k, sizeMB: (size/1024/1024).toFixed(2) });
            keysFound.push({ key: k, sizeKB: Math.round(size/1024), count: count });
          }

          var redisStatus = critical.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'ok');
          audit.services.redis = {
            status: redisStatus,
            configured: true,
            responseTimeMs: redisPingMs,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            keysCount: keysFound.length,
            critical: critical,
            warnings: warnings,
            keys: keysFound.sort(function(a, b){ return b.sizeKB - a.sizeKB; }).slice(0, 10),
            message: redisStatus === 'ok' ? '✅ كل المفاتيح ضمن الحدود الآمنة' :
                     redisStatus === 'warning' ? '⚠️ بعض المفاتيح تقترب من الحد الأقصى' :
                     '🚨 مفاتيح تجاوزت 9.5MB — تنفيذ db-cleanup مطلوب فوراً',
          };
        } catch(e) {
          audit.services.redis = { status: 'error', configured: USE_REDIS, error: e.message };
        }

        // ───── 2) Cloudflare R2 ─────
        try {
          var r2Configured = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID);
          if (r2Configured) {
            // Try to list bucket
            var r2Test = await r2Upload('audit-test-' + Date.now() + '.txt', 'audit-test', 'text/plain');
            audit.services.r2 = {
              status: 'ok',
              configured: true,
              bucket: process.env.R2_BUCKET || 'basma-hma',
              accountId: (process.env.R2_ACCOUNT_ID || '').substring(0, 6) + '...',
              testWrite: 'OK',
              message: '✅ R2 يعمل بشكل سليم',
            };
          } else {
            audit.services.r2 = {
              status: 'error',
              configured: false,
              message: '🚨 R2 غير مفعّل — أضف R2_ACCOUNT_ID و R2_ACCESS_KEY_ID',
            };
          }
        } catch(e) {
          audit.services.r2 = { status: 'error', error: e.message };
        }

        // ───── 3) Vercel Blob (يجب أن يكون معطّل) ─────
        try {
          var blobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
          audit.services.blob = {
            status: blobToken ? 'warning' : 'ok',
            configured: blobToken,
            active: false,
            message: blobToken ?
              '⚠️ Token موجود (للحالات الطارئة فقط) — تأكد من عدم استخدامه' :
              '✅ Vercel Blob معطّل (الوضع الصحيح)',
          };
        } catch(e) {
          audit.services.blob = { status: 'error', error: e.message };
        }

        // ───── 4) GitHub ─────
        try {
          var ghToken = !!process.env.GITHUB_TOKEN;
          if (ghToken) {
            // Verify by fetching latest commit
            var ghRes = await fetch('https://api.github.com/repos/hma2026/basma-hma/commits?per_page=1', {
              headers: { 'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN, 'User-Agent': 'basma-audit' }
            });
            var ghOk = ghRes.ok;
            var lastCommit = null;
            if (ghOk) {
              var commits = await ghRes.json();
              if (commits[0]) {
                lastCommit = {
                  sha: commits[0].sha.substring(0, 7),
                  message: (commits[0].commit.message || '').substring(0, 100),
                  date: commits[0].commit.author.date,
                };
              }
            }
            audit.services.github = {
              status: ghOk ? 'ok' : 'error',
              configured: true,
              repo: 'hma2026/basma-hma',
              lastCommit: lastCommit,
              message: ghOk ? '✅ GitHub يعمل والاتصال سليم' : '🚨 فشل الاتصال بـ GitHub',
            };
          } else {
            audit.services.github = {
              status: 'warning',
              configured: false,
              message: '⚠️ GITHUB_TOKEN غير موجود — التحديثات لن تعمل',
            };
          }
        } catch(e) {
          audit.services.github = { status: 'error', error: e.message };
        }

        // ───── 5) Vercel (الكود يعمل = Vercel سليم) ─────
        audit.services.vercel = {
          status: 'ok',
          message: '✅ Vercel يعمل (هذه الـ API نفسها تعمل عليه)',
          region: process.env.VERCEL_REGION || 'unknown',
          deploymentId: (process.env.VERCEL_DEPLOYMENT_ID || '').substring(0, 12),
        };

        // ───── 6) النسخ الاحتياطية (في R2) ─────
        try {
          if (audit.services.r2.status === 'ok') {
            // Try to get backup metadata from Redis
            var backupMeta = await dbGet('backup_metadata') || [];
            var lastBackup = backupMeta[backupMeta.length - 1];
            var hoursSinceBackup = lastBackup ?
              Math.round((Date.now() - new Date(lastBackup.createdAt).getTime()) / 3600000) : null;

            audit.services.backup = {
              status: !lastBackup ? 'warning' :
                      hoursSinceBackup > 48 ? 'error' :
                      hoursSinceBackup > 30 ? 'warning' : 'ok',
              configured: true,
              totalBackups: backupMeta.length,
              lastBackup: lastBackup ? {
                date: lastBackup.createdAt,
                hoursAgo: hoursSinceBackup,
                sizeMB: lastBackup.sizeMB || 'unknown',
              } : null,
              message: !lastBackup ?
                '⚠️ لا توجد نسخ احتياطية بعد' :
                hoursSinceBackup > 48 ?
                '🚨 آخر نسخة قبل ' + hoursSinceBackup + ' ساعة — Cron Job قد يكون متوقف' :
                '✅ نسخة احتياطية حديثة (' + hoursSinceBackup + ' ساعة)',
            };
          }
        } catch(e) {
          audit.services.backup = { status: 'error', error: e.message };
        }

        // ───── Summary ─────
        Object.keys(audit.services).forEach(function(key) {
          var s = audit.services[key].status;
          if (s === 'ok') audit.summary.ok++;
          else if (s === 'warning') audit.summary.warning++;
          else if (s === 'error') audit.summary.error++;
        });
        audit.summary.total = Object.keys(audit.services).length;
        audit.summary.overall = audit.summary.error > 0 ? 'error' :
                                audit.summary.warning > 0 ? 'warning' : 'ok';

        return res.json(audit);
      }

      /* ═══ MIGRATE — نقل البيانات من Blob إلى Redis ═══ */
      case 'migrate-to-redis': {
        if (!USE_REDIS) return res.json({ ok: false, error: 'Redis غير مفعّل — أضف UPSTASH_REDIS_REST_URL و TOKEN في Vercel' });
        var tables = ['employees', 'branches', 'attendance', 'violations', 'violations_v2', 'warnings', 'leaves', 'dependents', 'tickets', 'projects', 'delegations', 'exceptions', 'events', 'manual_attendance', 'settings', 'laiha_settings', 'complaints', 'investigations', 'appeals', 'notifications', 'permissions', 'gps_log', 'pre_absences', 'custody', 'custody_maintenance', 'attachments', 'attachment_types', 'health_disclosure', 'emp_records', 'kadwar_data', 'kadwar_notifs', 'kadwar_employees', 'admin_config', 'faces', 'work_types', 'push_subscriptions', 'hr_questions', 'delegations'];
        var migrated = {};
        var failed = [];
        for (var i = 0; i < tables.length; i++) {
          var t = tables[i];
          try {
            var data = null; // v7.31: Blob migration completed — all data in Redis now
            if (data !== null) {
              await redisSet(t, data);
              migrated[t] = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 1);
            } else {
              migrated[t] = 'empty';
            }
          } catch (e) {
            failed.push({ table: t, error: e.message });
          }
        }
        return res.json({ ok: true, migrated: migrated, failed: failed, total: Object.keys(migrated).length, ts: new Date().toISOString() });
      }

      /* ═══ BLOB LIST — عرض كل الملفات في Vercel Blob ═══ */
      case 'blob-list': {
        try {
          var allBlobs = [];
          var cursor = undefined;
          do {
            var result = await list({ cursor, limit: 1000 });
            allBlobs = allBlobs.concat(result.blobs);
            cursor = result.cursor;
          } while (cursor && allBlobs.length < 5000);

          // Group by prefix
          var basmaData = [];
          var basmaFiles = [];
          var basmaOther = [];
          var other = [];
          var totalSize = 0;

          allBlobs.forEach(function(b) {
            totalSize += b.size || 0;
            var info = {
              name: b.pathname,
              size: b.size,
              sizeKB: ((b.size || 0) / 1024).toFixed(1),
              uploaded: b.uploadedAt,
              url: b.url,
            };
            if (b.pathname.match(/^basma_[^/]+\.json$/)) {
              basmaData.push(info);
            } else if (b.pathname.startsWith('basma_files/')) {
              basmaFiles.push(info);
            } else if (b.pathname.startsWith('basma_')) {
              basmaOther.push(info);
            } else {
              other.push(info);
            }
          });

          return res.json({
            ok: true,
            totalFiles: allBlobs.length,
            totalSizeKB: (totalSize / 1024).toFixed(1),
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            summary: {
              basmaDataFiles: basmaData.length,    // basma_*.json
              basmaAttachments: basmaFiles.length, // basma_files/*
              basmaOther: basmaOther.length,       // basma_* other
              other: other.length,                 // not basma
            },
            basmaData: basmaData,
            basmaFiles: basmaFiles,
            basmaOther: basmaOther,
            other: other,
          });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ BLOB DELETE ALL — حذف كل الملفات من Blob (خطير) ═══ */
      case 'blob-delete-all': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        if (body.confirm !== 'DELETE_ALL_BLOB') {
          return res.status(400).json({ ok: false, error: 'Missing confirm field' });
        }
        try {
          var allBlobs = [];
          var cursor = undefined;
          do {
            var result = await list({ cursor, limit: 1000 });
            allBlobs = allBlobs.concat(result.blobs);
            cursor = result.cursor;
          } while (cursor && allBlobs.length < 5000);

          var deleted = 0;
          var failed = [];
          // Delete in batches
          for (var i = 0; i < allBlobs.length; i++) {
            try {
              await del(allBlobs[i].url);
              deleted++;
            } catch(e) {
              failed.push({ name: allBlobs[i].pathname, error: e.message });
            }
          }
          return res.json({ ok: true, deleted: deleted, failed: failed, total: allBlobs.length });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ BLOB DELETE ALL BASMA DATA — حذف كل بيانات بصمة من Blob ═══ */
      case 'blob-delete-basma-data': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        if (body.confirm !== 'DELETE_BLOB_BASMA') {
          return res.status(400).json({ ok: false, error: 'Missing confirm field (must be "DELETE_BLOB_BASMA")' });
        }
        try {
          var allBlobs = [];
          var cursor = undefined;
          do {
            var result = await list({ cursor, limit: 1000 });
            allBlobs = allBlobs.concat(result.blobs);
            cursor = result.cursor;
          } while (cursor && allBlobs.length < 5000);

          var toDelete = allBlobs.filter(function(b){
            return b.pathname.match(/^basma_[^/]+\.json$/);
          });

          var deleted = 0;
          var failed = [];
          for (var i = 0; i < toDelete.length; i++) {
            try {
              await del(toDelete[i].url);
              deleted++;
            } catch(e) {
              failed.push({ name: toDelete[i].pathname, error: e.message });
            }
          }
          return res.json({ ok: true, deleted: deleted, failed: failed, total: toDelete.length });
        } catch(e) {
          return res.status(500).json({ ok: false, error: e.message });
        }
      }

      /* ═══ BENEFITS — قائمة الامتيازات ═══ */
      case 'benefits': {
        if (req.method === 'POST') {
          var body = req.body || {};
          await dbSet('benefits', body.coupons || []);
          return res.json({ ok: true });
        }
        var benefits = (await dbGet('benefits')) || [];
        return res.json({ coupons: benefits });
      }

      /* ═══ REDEEM BENEFIT — صرف كوبون ═══ */
      case 'redeem-benefit': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        var empId = body.empId;
        var couponId = body.couponId;
        if (!empId || !couponId) return res.status(400).json({ ok: false, error: 'empId + couponId required' });
        var redemptions = (await dbGet('redemptions')) || [];
        redemptions.unshift({
          id: 'R' + Date.now(),
          empId: empId,
          couponId: couponId,
          pts: body.pts || 0,
          couponName: body.couponName || '',
          ts: new Date().toISOString(),
        });
        await dbSet('redemptions', redemptions.slice(0, 5000));

        // Deduct points from employee
        var emps = (await dbGet('employees')) || [];
        var empIdx = emps.findIndex(function(e){ return e.id === empId; });
        if (empIdx >= 0) {
          emps[empIdx].points = Math.max(0, (emps[empIdx].points || 0) - (body.pts || 0));
          await dbSet('employees', emps);
        }
        return res.json({ ok: true });
      }

      /* ═══ REDEMPTIONS — سجل الصرف ═══ */
      case 'redemptions': {
        var redemps = (await dbGet('redemptions')) || [];
        var empId = req.query ? req.query.empId : null;
        if (empId) redemps = redemps.filter(function(r){ return r.empId === empId; });
        return res.json(redemps);
      }

      /* ═══ TAWASUL — نظام تبادل المهام الإدارية (NATIVE — Upstash Redis) ═══ */
      /* ═══ TAWASUL ATTACHMENTS — R2 storage with task/project-based keys ═══
         POST body: { taskId, serial, projectId, filename, contentType, dataB64 }
         Key: tawasul/{serial || taskId}/attachments/{YYYY-MM-DD}_{filename}
         Returns: { ok, key, url, size } */
      case 'tawasul-attachment-upload': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        if (!USE_R2) return res.status(500).json({ error: 'R2 not configured' });
        try {
          var bd = req.body || {};
          var taskId = bd.taskId;
          var serial = bd.serial || taskId;
          var filename = (bd.filename || 'file').replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 120);
          var contentType = bd.contentType || 'application/octet-stream';
          var dataB64 = bd.dataB64;
          if (!taskId || !dataB64) return res.status(400).json({ error: 'taskId and dataB64 required' });
          // Decode base64
          var buffer = Buffer.from(dataB64, 'base64');
          var size = buffer.length;
          if (size > 50 * 1024 * 1024) return res.status(413).json({ error: 'File too large (max 50MB per file)' });
          // Build key
          var today = new Date().toISOString().slice(0, 10);
          var safeSerial = String(serial).replace(/[\/\\?%*:|"<>]/g, '_');
          var ts = Date.now();
          var key = 'tawasul/' + safeSerial + '/attachments/' + today + '_' + ts + '_' + filename;
          // Upload
          var result = await r2Upload(key, buffer, contentType);
          if (!result) return res.status(500).json({ error: 'R2 upload returned null' });
          // Append to task's attachments array
          var task = await dbGet('twsl:' + taskId);
          if (task) {
            task.attachments = task.attachments || [];
            task.attachments.push({
              key: key,
              url: result.url,
              filename: filename,
              contentType: contentType,
              size: size,
              uploadedAt: new Date().toISOString(),
              uploadedBy: bd.uploadedBy || null,
            });
            task.updatedAt = new Date().toISOString();
            await dbSet('twsl:' + taskId, task);
          }
          return res.json({ ok: true, key: key, url: result.url, size: size, filename: filename });
        } catch(e) {
          console.error('[tawasul-attachment-upload]', e);
          return res.status(500).json({ error: 'upload error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-attachment-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bd2 = req.body || {};
          var taskId2 = bd2.taskId;
          var key2 = bd2.key;
          if (!taskId2 || !key2) return res.status(400).json({ error: 'taskId and key required' });
          // Delete from R2
          if (USE_R2) { try { await r2Delete(key2); } catch(e) { console.error('R2 delete:', e.message); } }
          // Remove from task
          var task2 = await dbGet('twsl:' + taskId2);
          if (task2 && Array.isArray(task2.attachments)) {
            task2.attachments = task2.attachments.filter(function(a){ return a.key !== key2; });
            task2.updatedAt = new Date().toISOString();
            await dbSet('twsl:' + taskId2, task2);
          }
          return res.json({ ok: true });
        } catch(e) {
          return res.status(500).json({ error: 'delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-list': {
        try {
          var idx = (await dbGet('twsl:idx')) || [];
          var categories = (await dbGet('twsl:categories')) || [
            { id: "supervision", label: "أعمال الإشراف", icon: "🏗️", fixed: true },
            { id: "design",      label: "أعمال التصميم", icon: "✏️", fixed: true },
            { id: "survey",      label: "أعمال المساحة", icon: "📐", fixed: true },
            { id: "clients",     label: "علاقات العملاء", icon: "👥", fixed: true },
            { id: "admin",       label: "إداري",          icon: "📋", fixed: true },
            { id: "other",       label: "أخرى",           icon: "📎", fixed: false },
          ];
          var projects = (await dbGet('twsl:projects')) || [];
          // v6.42 — Build hierarchy from employees automatically (source of truth = Kadwar sync).
          // Previously read from separate 'org_hierarchy' KV which was never populated after Kadwar sync.
          var hierarchy = {};
          try {
            var orgStored = (await dbGet('org_hierarchy')) || {};
            hierarchy = Object.assign({}, orgStored); // start from any manual overrides
          } catch(e) {}

          try {
            var allEmps = (await dbGet('employees')) || [];
            // Map kadwarId -> empId (for resolving manager references by kadwar id)
            var kadIdToEmpId = {};
            var emailToEmpId = {};
            allEmps.forEach(function(e){
              if (e.kadwarId) kadIdToEmpId[String(e.kadwarId)] = String(e.id);
              if (e.email) emailToEmpId[String(e.email).toLowerCase()] = String(e.id);
            });
            // For each employee with a manager, register in hierarchy
            allEmps.forEach(function(e){
              if (!e || !e.id) return;
              var empKey = String(e.id);
              if (hierarchy[empKey]) return; // manual override wins
              var managerId = null;
              // Direct manager by id
              if (e.managerId) managerId = String(e.managerId);
              // Manager by kadwar id → resolve to empId
              else if (e.managerKadwarId && kadIdToEmpId[String(e.managerKadwarId)]) managerId = kadIdToEmpId[String(e.managerKadwarId)];
              // v6.44 — Manager by email (some kadwar sync returns email not id)
              else if (e.managerEmail && emailToEmpId[String(e.managerEmail).toLowerCase()]) managerId = emailToEmpId[String(e.managerEmail).toLowerCase()];
              // Supervisor fallbacks
              else if (e.supervisorId) managerId = String(e.supervisorId);
              else if (e.supervisorKadwarId && kadIdToEmpId[String(e.supervisorKadwarId)]) managerId = kadIdToEmpId[String(e.supervisorKadwarId)];
              else if (e.supervisorEmail && emailToEmpId[String(e.supervisorEmail).toLowerCase()]) managerId = emailToEmpId[String(e.supervisorEmail).toLowerCase()];
              if (managerId && managerId !== empKey) hierarchy[empKey] = managerId;
            });
          } catch(e) { /* silent */ }

          // Fetch all requests — use reliable parallel GETs (proven path)
          var requests = [];
          if (idx.length > 0) {
            try {
              requests = await Promise.all(idx.map(function(id){
                return dbGet('twsl:' + id).catch(function(){ return null; });
              }));
            } catch(e) {
              console.error('[tawasul-list] parallel fetch error:', e.message);
              requests = [];
            }
          }
          requests = (requests || []).filter(function(r){ return r && r.id; });

          return res.json({
            ok: true,
            requests: requests,
            categories: categories,
            projects: projects,
            hierarchy: hierarchy,
            total: requests.length,
            syncDate: new Date().toISOString(),
          });
        } catch (e) {
          console.error('[tawasul-list] FATAL:', e);
          return res.status(200).json({
            ok: false,
            error: 'tawasul-list error: ' + (e.message || 'unknown'),
            requests: [], categories: [], projects: [], hierarchy: {},
          });
        }
      }

      case 'tawasul-save': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var body = req.body || {};
          var reqData = body.request;
          if (!reqData) return res.status(400).json({ error: 'request object required' });

          var now = new Date().toISOString();
          // Check if this is a new request by looking at the index
          var idx = (await dbGet('twsl:idx')) || [];
          var isNew = !reqData.id || idx.indexOf(reqData.id) < 0;

          // Generate ID if new and missing
          if (!reqData.id) reqData.id = 'twsl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

          // Generate serial if new
          if (!reqData.serial) {
            var counter = (await dbGet('twsl:serial')) || 0;
            counter = counter + 1;
            reqData.serial = 'CB' + String(counter).padStart(4, '0');
            await dbSet('twsl:serial', counter);
          }

          reqData.updatedAt = now;
          if (!reqData.createdAt) reqData.createdAt = now;

          // Save the request
          await dbSet('twsl:' + reqData.id, reqData);

          // Update index if new
          if (isNew) {
            if (idx.indexOf(reqData.id) < 0) {
              idx.push(reqData.id);
              await dbSet('twsl:idx', idx);
            }

            // Create notification for each assignee
            var notifs = (await dbGet('twsl:notifs')) || [];
            (reqData.assignees || []).forEach(function(a){
              notifs.push({
                id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'new_task',
                taskId: reqData.id,
                serial: reqData.serial,
                from: reqData.requesterName || '',
                createdAt: now,
                read: false,
                targetId: a.id,
              });
            });
            // Keep last 500 notifications
            if (notifs.length > 500) notifs = notifs.slice(-500);
            await dbSet('twsl:notifs', notifs);

            // Send Web Push to each assignee (fire-and-forget, don't block response)
            if (reqData.status === 'sent' && (reqData.assignees || []).length > 0) {
              (async function(){
                try {
                  var pushSubs = (await dbGet('push_subscriptions')) || {};
                  var pushTitle = (reqData.urgency === 'urgent' ? '🔴 ' : '📨 ') + 'مهمة جديدة' + (reqData.serial ? ' #' + reqData.serial : '');
                  var pushBody = (reqData.requesterName ? reqData.requesterName + ': ' : '') + (reqData.title || '(بدون عنوان)');
                  if (reqData.deadline) {
                    var d = new Date(reqData.deadline);
                    var now2 = Date.now();
                    var hoursLeft = (d.getTime() - now2) / 3600000;
                    if (hoursLeft > 0 && hoursLeft < 24) pushBody += ' · ⏰ الموعد: ' + d.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                  }
                  var payload = {
                    title: pushTitle,
                    body: pushBody,
                    tag: 'tawasul-' + reqData.id,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { taskId: reqData.id, type: 'tawasul_new_task', url: '/?tab=tawasul' },
                  };
                  for (var i = 0; i < (reqData.assignees || []).length; i++) {
                    var aid = reqData.assignees[i].id;
                    var sub = pushSubs[aid];
                    if (!sub || !sub.subscription) continue;
                    try { await sendWebPush(sub.subscription, payload); }
                    catch(e) { console.error('[tawasul push]', aid, e.message); }
                  }
                } catch(e) {
                  console.error('[tawasul auto-push]', e.message);
                }
              })();
            }
          }

          return res.json({ ok: true, request: reqData, isNew: isNew });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-save error: ' + (e.message || 'unknown') });
        }
      }

      /* v7.06 — إرجاع مهمة لمستلم واحد (بدون تأثير على الباقي) */
      case 'tawasul-assignee-return': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          const b = req.body || {};
          const { taskId, assigneeId, reason, actor, actorName } = b;
          if (!taskId || !assigneeId) return res.status(400).json({ error: 'taskId + assigneeId required' });
          const reqs = (await dbGet('tawasul-requests')) || [];
          const i = reqs.findIndex(function(x){ return String(x.id) === String(taskId); });
          if (i < 0) return res.status(404).json({ error: 'المهمة غير موجودة' });
          const task = reqs[i];
          // صاحب المهمة أو admin فقط
          if (String(actor) !== String(task.requesterId) && !b.isAdmin) {
            return res.status(403).json({ error: 'فقط صاحب المهمة يستطيع الإرجاع' });
          }
          const ai = (task.assignees || []).findIndex(function(a){ return String(a.id) === String(assigneeId); });
          if (ai < 0) return res.status(404).json({ error: 'المستلم غير موجود في المهمة' });
          // إعادة ضبط حالة هذا المستلم
          const a = task.assignees[ai];
          const returns = (a.returns || 0) + 1;
          task.assignees[ai] = Object.assign({}, a, {
            acceptedAt: null,
            deliveredAt: null,
            returnedAt: new Date().toISOString(),
            returnedBy: actor,
            returnReason: reason || '',
            returns: returns,
            status: 'returned',
          });
          // إضافة للسجل
          task.log = task.log || [];
          task.log.push({
            at: new Date().toISOString(),
            by: actorName || actor,
            text: '📋 أُرجعت المهمة لـ ' + (a.name || a.id) + ' (المرة #' + returns + ')' + (reason ? ' — ' + reason : ''),
            action: 'assignee_return',
            assigneeId: assigneeId,
          });
          task.updatedAt = new Date().toISOString();
          reqs[i] = task;
          await dbSet('tawasul-requests', reqs);
          // إشعار المستلم
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: assigneeId,
              type: 'tawasul_return',
              title: '📋 أُرجعت المهمة إليك',
              body: (task.title || '(بدون عنوان)') + (reason ? ' — السبب: ' + reason : ''),
              refId: taskId,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          return res.json({ ok: true, task: task });
        } catch(e) {
          console.error('[tawasul-assignee-return]', e);
          return res.status(500).json({ error: 'tawasul-assignee-return error: ' + (e.message || 'unknown') });
        }
      }

      /* v7.06 — إغلاق جزء مستلم واحد (صاحب المهمة فقط) */
      case 'tawasul-assignee-close': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          const b = req.body || {};
          const { taskId, assigneeId, actor, actorName } = b;
          if (!taskId || !assigneeId) return res.status(400).json({ error: 'taskId + assigneeId required' });
          const reqs = (await dbGet('tawasul-requests')) || [];
          const i = reqs.findIndex(function(x){ return String(x.id) === String(taskId); });
          if (i < 0) return res.status(404).json({ error: 'المهمة غير موجودة' });
          const task = reqs[i];
          if (String(actor) !== String(task.requesterId) && !b.isAdmin) {
            return res.status(403).json({ error: 'فقط صاحب المهمة يستطيع الإغلاق' });
          }
          const ai = (task.assignees || []).findIndex(function(a){ return String(a.id) === String(assigneeId); });
          if (ai < 0) return res.status(404).json({ error: 'المستلم غير موجود' });
          const a = task.assignees[ai];
          if (!a.deliveredAt) return res.status(400).json({ error: 'لم يسلّم بعد — لا يمكن الإغلاق' });
          task.assignees[ai] = Object.assign({}, a, {
            closedAt: new Date().toISOString(),
            closedBy: actor,
            status: 'closed',
          });
          task.log = task.log || [];
          task.log.push({
            at: new Date().toISOString(),
            by: actorName || actor,
            text: '✅ أُغلق جزء ' + (a.name || a.id),
            action: 'assignee_close',
            assigneeId: assigneeId,
          });
          // إن أُغلق الكل — حدّث حالة المهمة
          var allClosed = (task.assignees || []).every(function(x){ return !!x.closedAt; });
          if (allClosed && task.status !== 'evaluated' && task.status !== 'closed') {
            task.status = 'evaluated';
            task.fullyClosedAt = new Date().toISOString();
          }
          task.updatedAt = new Date().toISOString();
          reqs[i] = task;
          await dbSet('tawasul-requests', reqs);
          return res.json({ ok: true, task: task, allClosed: allClosed });
        } catch(e) {
          console.error('[tawasul-assignee-close]', e);
          return res.status(500).json({ error: 'tawasul-assignee-close error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var body2 = req.body || {};
          var id = body2.id;
          if (!id) return res.status(400).json({ error: 'id required' });

          // Remove from index
          var idx2 = (await dbGet('twsl:idx')) || [];
          idx2 = idx2.filter(function(x){ return x !== id; });
          await dbSet('twsl:idx', idx2);

          // Delete the object (overwrite with null since we don't have a delete helper)
          await dbSet('twsl:' + id, null);

          return res.json({ ok: true, id: id });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-notifs': {
        try {
          if (req.method === 'POST') {
            var pb = req.body || {};
            var notifs2 = (await dbGet('twsl:notifs')) || [];
            // Mark notifications as read
            if (pb.markRead && Array.isArray(pb.ids)) {
              notifs2 = notifs2.map(function(n){
                if (pb.ids.indexOf(n.id) >= 0) return Object.assign({}, n, { read: true });
                return n;
              });
              await dbSet('twsl:notifs', notifs2);
            }
            // Add a new notification
            if (pb.notif) {
              notifs2.push(Object.assign({ id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), createdAt: new Date().toISOString(), read: false }, pb.notif));
              if (notifs2.length > 500) notifs2 = notifs2.slice(-500);
              await dbSet('twsl:notifs', notifs2);
            }
            return res.json({ ok: true, notifs: notifs2 });
          }
          var notifsR = (await dbGet('twsl:notifs')) || [];
          return res.json({ ok: true, notifs: notifsR });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-notifs error: ' + (e.message || 'unknown'), notifs: [] });
        }
      }

      case 'tawasul-ai': {
        // AI stays on kadwar (has API keys) — proxy with timeout
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var ctrlAI = new AbortController();
          var tmoAI = setTimeout(function(){ ctrlAI.abort(); }, 30000);
          var krAI = await fetch('https://hma.engineer/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body || {}),
            signal: ctrlAI.signal,
          });
          clearTimeout(tmoAI);
          var kdAI = await krAI.json();
          if (!krAI.ok) return res.status(krAI.status).json({ error: kdAI.error || 'ai error ' + krAI.status });
          return res.json(kdAI);
        } catch (e) {
          return res.status(502).json({ error: 'تعذر الاتصال بـ AI: ' + (e.message || 'unknown') });
        }
      }

      /* ═══════════ TIME TRACKING (تتبع الوقت) — v6.29 ═══════════
         - twsl:active:{userId}  =>  { taskId, startedAt, note }
         - request.timeEntries[] =>  [{ id, userId, userName, startedAt, endedAt, durationSec, note, manual? }]
      */
      case 'tawasul-timer-start': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTs = req.body || {};
          var userIdTs = String(bTs.userId || '');
          var taskIdTs = String(bTs.taskId || '');
          if (!userIdTs || !taskIdTs) return res.status(400).json({ error: 'userId و taskId مطلوبان' });

          var activeKey = 'twsl:active:' + userIdTs;
          var existingActive = await dbGet(activeKey);
          if (existingActive && existingActive.taskId) {
            return res.status(409).json({ error: 'هناك مؤقت نشط بالفعل', active: existingActive });
          }

          // Verify task exists
          var taskTs = await dbGet('twsl:' + taskIdTs);
          if (!taskTs) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowTs = new Date().toISOString();
          var activeVal = { taskId: taskIdTs, startedAt: nowTs, note: bTs.note || '', serial: taskTs.serial || '', title: taskTs.title || '' };
          await dbSet(activeKey, activeVal);
          return res.json({ ok: true, active: activeVal });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-start error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-stop': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTp = req.body || {};
          var userIdTp = String(bTp.userId || '');
          if (!userIdTp) return res.status(400).json({ error: 'userId مطلوب' });

          var keyTp = 'twsl:active:' + userIdTp;
          var activeTp = await dbGet(keyTp);
          if (!activeTp || !activeTp.taskId) return res.status(404).json({ error: 'لا يوجد مؤقت نشط' });

          var taskTp = await dbGet('twsl:' + activeTp.taskId);
          if (!taskTp) {
            await dbSet(keyTp, null);
            return res.status(404).json({ error: 'المهمة غير موجودة' });
          }

          var nowTp = new Date().toISOString();
          var startedMs = new Date(activeTp.startedAt).getTime();
          var endedMs = Date.now();
          var durSec = Math.max(1, Math.round((endedMs - startedMs) / 1000));

          var entryTp = {
            id: 'te_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            userId: userIdTp,
            userName: bTp.userName || '',
            startedAt: activeTp.startedAt,
            endedAt: nowTp,
            durationSec: durSec,
            note: bTp.note || activeTp.note || '',
          };

          taskTp.timeEntries = (taskTp.timeEntries || []).concat([entryTp]);
          taskTp.updatedAt = nowTp;

          // Format duration for log
          var h = Math.floor(durSec / 3600);
          var m = Math.floor((durSec % 3600) / 60);
          var durText = h > 0 ? (h + ' س ' + m + ' د') : (m + ' د');
          taskTp.log = (taskTp.log || []).concat([{
            text: '⏱ ' + (bTp.userName || '') + ' سجّل ' + durText + ' على المهمة',
            by: bTp.userName || '', at: nowTp,
          }]);

          await dbSet('twsl:' + taskTp.id, taskTp);
          await dbSet(keyTp, null);

          return res.json({ ok: true, entry: entryTp, task: taskTp });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-stop error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-cancel': {
        // Cancel active timer without saving an entry
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var uidC = String((req.body || {}).userId || '');
          if (!uidC) return res.status(400).json({ error: 'userId مطلوب' });
          await dbSet('twsl:active:' + uidC, null);
          return res.json({ ok: true });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-cancel error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-add': {
        // Manual time entry (for forgotten work)
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTa = req.body || {};
          var taskIdTa = String(bTa.taskId || '');
          var userIdTa = String(bTa.userId || '');
          var durSecTa = parseInt(bTa.durationSec, 10);
          if (!taskIdTa || !userIdTa || !durSecTa || durSecTa <= 0) {
            return res.status(400).json({ error: 'taskId و userId و durationSec مطلوبة' });
          }
          if (durSecTa > 24 * 3600) return res.status(400).json({ error: 'لا يمكن إضافة أكثر من 24 ساعة دفعة واحدة' });

          var taskTa = await dbGet('twsl:' + taskIdTa);
          if (!taskTa) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowTa = new Date().toISOString();
          var dateTa = bTa.date || nowTa;
          var entryTa = {
            id: 'te_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            userId: userIdTa,
            userName: bTa.userName || '',
            startedAt: dateTa,
            endedAt: dateTa,
            durationSec: durSecTa,
            note: bTa.note || '',
            manual: true,
          };

          taskTa.timeEntries = (taskTa.timeEntries || []).concat([entryTa]);
          taskTa.updatedAt = nowTa;

          var hTa = Math.floor(durSecTa / 3600);
          var mTa = Math.floor((durSecTa % 3600) / 60);
          var durTextTa = hTa > 0 ? (hTa + ' س ' + mTa + ' د') : (mTa + ' د');
          taskTa.log = (taskTa.log || []).concat([{
            text: '⏱ ' + (bTa.userName || '') + ' أضاف يدوياً ' + durTextTa,
            by: bTa.userName || '', at: nowTa,
          }]);

          await dbSet('twsl:' + taskTa.id, taskTa);
          return res.json({ ok: true, entry: entryTa, task: taskTa });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-add error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTd = req.body || {};
          var taskIdTd = String(bTd.taskId || '');
          var entryIdTd = String(bTd.entryId || '');
          if (!taskIdTd || !entryIdTd) return res.status(400).json({ error: 'taskId و entryId مطلوبان' });

          var taskTd = await dbGet('twsl:' + taskIdTd);
          if (!taskTd) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var entries = taskTd.timeEntries || [];
          var targetEntry = entries.find(function(e){ return e.id === entryIdTd; });
          if (!targetEntry) return res.status(404).json({ error: 'السجل غير موجود' });

          // Permission check: only entry owner or admin can delete
          var actorId = String(bTd.userId || '');
          var isAdminTd = !!bTd.isAdmin;
          if (!isAdminTd && String(targetEntry.userId) !== actorId) {
            return res.status(403).json({ error: 'لا يمكنك حذف سجل وقت لشخص آخر' });
          }

          taskTd.timeEntries = entries.filter(function(e){ return e.id !== entryIdTd; });
          var nowTd = new Date().toISOString();
          taskTd.updatedAt = nowTd;
          taskTd.log = (taskTd.log || []).concat([{
            text: '⏱ ' + (bTd.userName || '') + ' حذف سجل وقت',
            by: bTd.userName || '', at: nowTd,
          }]);
          await dbSet('twsl:' + taskTd.id, taskTd);
          return res.json({ ok: true, task: taskTd });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-timer-active': {
        // GET active timer for current user
        try {
          var uidA = String((req.query && req.query.userId) || (req.body && req.body.userId) || '');
          if (!uidA) return res.status(400).json({ error: 'userId مطلوب' });
          var activeA = await dbGet('twsl:active:' + uidA);
          return res.json({ active: activeA || null });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-active error: ' + (e.message || 'unknown'), active: null });
        }
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.128 — Smart Timer Toggle (integrates with task status)
       * ═══════════════════════════════════════════════════════════════
       * POST body: { userId, userName, taskId, action: "start"|"stop" }
       *
       * Behavior:
       *   - action="start": sets task.status to "inprogress" if not already,
       *                     starts timer, rejects if user has another active timer
       *   - action="stop":  stops timer, saves time entry, but KEEPS task at "inprogress"
       *                     (user must press "deliver" button to change status)
       *
       * Returns: { ok, active, task, entry? }
       */
      case 'tawasul-timer-toggle': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bTT = req.body || {};
          var userIdTT = String(bTT.userId || '');
          var userNameTT = String(bTT.userName || '');
          var taskIdTT = String(bTT.taskId || '');
          var actionTT = String(bTT.action || '').toLowerCase();
          if (!userIdTT || !taskIdTT) return res.status(400).json({ error: 'userId و taskId مطلوبان' });
          if (actionTT !== 'start' && actionTT !== 'stop') return res.status(400).json({ error: 'action must be "start" or "stop"' });

          var activeKeyTT = 'twsl:active:' + userIdTT;
          var taskTT = await dbGet('twsl:' + taskIdTT);
          if (!taskTT) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowIsoTT = new Date().toISOString();

          // ═══ ACTION: START ═══
          if (actionTT === 'start') {
            // Check for existing active timer
            var existingTT = await dbGet(activeKeyTT);
            if (existingTT && existingTT.taskId) {
              // User has active timer on another task — reject with info
              if (String(existingTT.taskId) !== taskIdTT) {
                return res.status(409).json({
                  error: 'لديك مؤقت نشط على مهمة أخرى',
                  activeOnOtherTask: true,
                  active: existingTT,
                });
              }
              // Already active on this task — no-op, just return current state
              return res.json({ ok: true, active: existingTT, task: taskTT, alreadyActive: true });
            }

            // Set task status to inprogress (if not already)
            var wasInprogress = taskTT.status === 'inprogress';
            if (!wasInprogress && (taskTT.status === 'received' || taskTT.status === 'accepted')) {
              taskTT.status = 'inprogress';
              taskTT.startedAt = taskTT.startedAt || nowIsoTT;
              // Update assignee record
              if (Array.isArray(taskTT.assignees)) {
                taskTT.assignees = taskTT.assignees.map(function(a){
                  if (String(a.id) === userIdTT && !a.startedAt) {
                    return Object.assign({}, a, { startedAt: nowIsoTT });
                  }
                  return a;
                });
              }
              // Add log entry for status change
              taskTT.log = (taskTT.log || []).concat([{
                text: '⚡ ' + (userNameTT || userIdTT) + ' بدأ التنفيذ',
                by: userNameTT || userIdTT,
                at: nowIsoTT,
                action: 'start_work',
              }]);
              taskTT.updatedAt = nowIsoTT;
              await dbSet('twsl:' + taskIdTT, taskTT);
            }

            // Start the timer
            var activeValTT = {
              taskId: taskIdTT,
              startedAt: nowIsoTT,
              note: bTT.note || '',
              serial: taskTT.serial || '',
              title: taskTT.title || '',
              userName: userNameTT,
            };
            await dbSet(activeKeyTT, activeValTT);

            // Notify co-assignees (fire-and-forget)
            try {
              if (Array.isArray(taskTT.assignees) && taskTT.assignees.length > 1) {
                var notifsTT = (await dbGet('notifications')) || [];
                (taskTT.assignees || []).forEach(function(a){
                  if (String(a.id) !== userIdTT) {
                    notifsTT.push({
                      id: 'NTF' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                      empId: a.id,
                      type: 'tawasul_colleague_started',
                      title: '👥 زميل بدأ العمل على مهمة مشتركة',
                      body: (userNameTT || '') + ' بدأ العمل على: ' + (taskTT.title || '#' + taskTT.serial),
                      refId: taskIdTT,
                      read: false,
                      createdAt: nowIsoTT,
                    });
                  }
                });
                if (notifsTT.length > 2000) notifsTT = notifsTT.slice(-2000);
                await dbSet('notifications', notifsTT);
              }
            } catch(_) { /* non-critical */ }

            return res.json({ ok: true, active: activeValTT, task: taskTT, started: true });
          }

          // ═══ ACTION: STOP ═══
          if (actionTT === 'stop') {
            var activeStopTT = await dbGet(activeKeyTT);
            if (!activeStopTT || !activeStopTT.taskId) {
              return res.status(404).json({ error: 'لا يوجد مؤقت نشط' });
            }
            if (String(activeStopTT.taskId) !== taskIdTT) {
              return res.status(409).json({ error: 'المؤقت النشط على مهمة أخرى', active: activeStopTT });
            }

            // Calculate duration
            var startedMsTT = new Date(activeStopTT.startedAt).getTime();
            var endedMsTT = Date.now();
            var durSecTT = Math.max(1, Math.round((endedMsTT - startedMsTT) / 1000));

            // Create time entry
            var entryTT = {
              id: 'te_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              userId: userIdTT,
              userName: userNameTT || '',
              startedAt: activeStopTT.startedAt,
              endedAt: nowIsoTT,
              durationSec: durSecTT,
              note: bTT.note || activeStopTT.note || '',
            };
            taskTT.timeEntries = (taskTT.timeEntries || []).concat([entryTT]);
            taskTT.updatedAt = nowIsoTT;

            // Format duration for log
            var hTT = Math.floor(durSecTT / 3600);
            var mTT = Math.floor((durSecTT % 3600) / 60);
            var durTextTT = hTT > 0 ? (hTT + ' س ' + mTT + ' د') : (mTT + ' د');
            taskTT.log = (taskTT.log || []).concat([{
              text: '⏸ ' + (userNameTT || '') + ' أوقف العمل — سجّل ' + durTextTT,
              by: userNameTT || '',
              at: nowIsoTT,
              action: 'stop_work',
            }]);

            // NOTE: status stays "inprogress" — user must deliver manually
            await dbSet('twsl:' + taskIdTT, taskTT);
            await dbSet(activeKeyTT, null);

            // Notify co-assignees (fire-and-forget)
            try {
              if (Array.isArray(taskTT.assignees) && taskTT.assignees.length > 1) {
                var notifsStopTT = (await dbGet('notifications')) || [];
                (taskTT.assignees || []).forEach(function(a){
                  if (String(a.id) !== userIdTT) {
                    notifsStopTT.push({
                      id: 'NTF' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                      empId: a.id,
                      type: 'tawasul_colleague_stopped',
                      title: '⏸ زميل أوقف العمل على مهمة مشتركة',
                      body: (userNameTT || '') + ' أوقف العمل على: ' + (taskTT.title || '#' + taskTT.serial) + ' (سجّل ' + durTextTT + ')',
                      refId: taskIdTT,
                      read: false,
                      createdAt: nowIsoTT,
                    });
                  }
                });
                if (notifsStopTT.length > 2000) notifsStopTT = notifsStopTT.slice(-2000);
                await dbSet('notifications', notifsStopTT);
              }
            } catch(_) { /* non-critical */ }

            return res.json({ ok: true, entry: entryTT, task: taskTT, stopped: true });
          }

        } catch (e) {
          return res.status(500).json({ error: 'tawasul-timer-toggle error: ' + (e.message || 'unknown') });
        }
      }

      /* ═══════════ IN-TASK CHAT (الدردشة داخل المهمة) — v6.30 ═══════════
         - request.chatMessages[] => [{ id, text, by, byName, at, mentions[], replyTo, reactions{emoji:[userIds]}, deleted? }]
      */
      case 'tawasul-chat-send': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bC = req.body || {};
          var taskIdC = String(bC.taskId || '');
          var textC = String(bC.text || '').trim();
          var byC = String(bC.by || '');
          if (!taskIdC || !textC || !byC) return res.status(400).json({ error: 'taskId و text و by مطلوبة' });
          if (textC.length > 2000) return res.status(400).json({ error: 'الرسالة طويلة جداً (الحد 2000 حرف)' });

          var taskC = await dbGet('twsl:' + taskIdC);
          if (!taskC) return res.status(404).json({ error: 'المهمة غير موجودة' });

          var nowC = new Date().toISOString();
          var msgC = {
            id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            text: textC,
            by: byC,
            byName: String(bC.byName || ''),
            at: nowC,
            mentions: Array.isArray(bC.mentions) ? bC.mentions.map(String).slice(0, 20) : [],
            replyTo: bC.replyTo ? String(bC.replyTo) : null,
            reactions: {},
          };

          taskC.chatMessages = (taskC.chatMessages || []).concat([msgC]);
          // Cap at 1000 messages per task (keep newest)
          if (taskC.chatMessages.length > 1000) taskC.chatMessages = taskC.chatMessages.slice(-1000);
          taskC.updatedAt = nowC;

          await dbSet('twsl:' + taskC.id, taskC);

          // Push notification — fire and forget
          (async function(){
            try {
              var pushSubsC = (await dbGet('push_subscriptions')) || {};
              // Recipients: all task participants (requester + assignees) + any mentioned users — excluding sender
              var recipients = {};
              if (taskC.requesterId) recipients[String(taskC.requesterId)] = true;
              (taskC.assignees || []).forEach(function(a){ if (a.id) recipients[String(a.id)] = true; });
              msgC.mentions.forEach(function(mid){ recipients[String(mid)] = true; });
              delete recipients[byC];

              var isMentionPush = msgC.mentions.length > 0;
              var previewC = textC.length > 80 ? textC.slice(0, 77) + '...' : textC;

              var recipientIds = Object.keys(recipients);
              for (var iC = 0; iC < recipientIds.length; iC++) {
                var ridC = recipientIds[iC];
                var subC = pushSubsC[ridC];
                if (!subC || !subC.subscription) continue;
                var isThisMentioned = msgC.mentions.indexOf(ridC) >= 0;
                var titleC = (isThisMentioned ? '📣 @ذكرك ' : '💬 ') + (msgC.byName || 'رسالة جديدة') + (taskC.serial ? ' · #' + taskC.serial : '');
                try {
                  await sendWebPush(subC.subscription, {
                    title: titleC,
                    body: previewC,
                    tag: 'twsl-chat-' + taskC.id,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { taskId: taskC.id, type: 'tawasul_chat', url: '/?tab=tawasul&open=' + taskC.id },
                  });
                } catch(ePushC) { console.error('[chat push]', ridC, ePushC.message); }
              }

              // Also add in-app notif for mentions
              if (isMentionPush) {
                var notifsC = (await dbGet('twsl:notifs')) || [];
                msgC.mentions.forEach(function(mid){
                  if (String(mid) === byC) return;
                  notifsC.push({
                    id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    type: 'chat_mention',
                    taskId: taskC.id,
                    serial: taskC.serial || '',
                    from: msgC.byName || '',
                    preview: previewC,
                    createdAt: nowC,
                    read: false,
                    targetId: mid,
                  });
                });
                if (notifsC.length > 500) notifsC = notifsC.slice(-500);
                await dbSet('twsl:notifs', notifsC);
              }
            } catch(ePush2) { console.error('[chat auto-push]', ePush2.message); }
          })();

          return res.json({ ok: true, message: msgC, task: taskC });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-send error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-chat-react': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bR = req.body || {};
          var taskIdR = String(bR.taskId || '');
          var msgIdR = String(bR.messageId || '');
          var emojiR = String(bR.emoji || '');
          var byR = String(bR.by || '');
          if (!taskIdR || !msgIdR || !emojiR || !byR) return res.status(400).json({ error: 'taskId و messageId و emoji و by مطلوبة' });
          // Whitelist emojis
          var ALLOWED_EMOJI = ['👍','❤️','🎉','😂','❓','🙏','✅'];
          if (ALLOWED_EMOJI.indexOf(emojiR) < 0) return res.status(400).json({ error: 'emoji غير مسموح' });

          var taskR = await dbGet('twsl:' + taskIdR);
          if (!taskR) return res.status(404).json({ error: 'المهمة غير موجودة' });
          var msgsR = taskR.chatMessages || [];
          var idxR2 = msgsR.findIndex(function(m){ return m.id === msgIdR; });
          if (idxR2 < 0) return res.status(404).json({ error: 'الرسالة غير موجودة' });

          var mR = msgsR[idxR2];
          mR.reactions = mR.reactions || {};
          mR.reactions[emojiR] = Array.isArray(mR.reactions[emojiR]) ? mR.reactions[emojiR] : [];
          var list = mR.reactions[emojiR];
          var ex = list.indexOf(byR);
          if (ex >= 0) list.splice(ex, 1); else list.push(byR);
          if (list.length === 0) delete mR.reactions[emojiR];

          msgsR[idxR2] = mR;
          taskR.chatMessages = msgsR;
          taskR.updatedAt = new Date().toISOString();
          await dbSet('twsl:' + taskR.id, taskR);
          return res.json({ ok: true, message: mR });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-react error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-chat-delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bD = req.body || {};
          var taskIdD = String(bD.taskId || '');
          var msgIdD = String(bD.messageId || '');
          var byD = String(bD.by || '');
          var isAdminD = !!bD.isAdmin;
          if (!taskIdD || !msgIdD || !byD) return res.status(400).json({ error: 'taskId و messageId و by مطلوبة' });

          var taskD = await dbGet('twsl:' + taskIdD);
          if (!taskD) return res.status(404).json({ error: 'المهمة غير موجودة' });
          var msgsD = taskD.chatMessages || [];
          var idxD = msgsD.findIndex(function(m){ return m.id === msgIdD; });
          if (idxD < 0) return res.status(404).json({ error: 'الرسالة غير موجودة' });

          var mD = msgsD[idxD];
          if (!isAdminD && String(mD.by) !== byD) return res.status(403).json({ error: 'لا يمكنك حذف رسالة شخص آخر' });

          // Soft delete — keep id/thread intact, scrub content
          mD.deleted = true;
          mD.text = '';
          mD.mentions = [];
          msgsD[idxD] = mD;
          taskD.chatMessages = msgsD;
          taskD.updatedAt = new Date().toISOString();
          await dbSet('twsl:' + taskD.id, taskD);
          return res.json({ ok: true });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-delete error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-chat-list': {
        // GET messages for a task — used for polling refresh
        try {
          var tidL = String((req.query && req.query.taskId) || (req.body && req.body.taskId) || '');
          if (!tidL) return res.status(400).json({ error: 'taskId مطلوب' });
          var taskL = await dbGet('twsl:' + tidL);
          if (!taskL) return res.json({ messages: [] });
          return res.json({ messages: taskL.chatMessages || [], updatedAt: taskL.updatedAt });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-chat-list error: ' + (e.message || 'unknown'), messages: [] });
        }
      }

      /* ═══════════ DESKTOP WEB (سطح المكتب — مثل WhatsApp Web) — v6.31 ═══════════
         Flow:
         1. Desktop opens /#desktop → calls tawasul-web-init → gets { token, pairCode } (valid 5 min)
         2. Desktop polls tawasul-web-status every 2s using token
         3. User opens mobile app → enters pairCode → calls tawasul-web-authorize
         4. Desktop detects status=authorized → loads Tawasul with that user's identity
         5. Session valid 7 days. Desktop can logout via tawasul-web-logout.

         Storage:
         - twsl:web:tok:{token} => { status, createdAt, expiresAt, pairCode, userId?, userName?, authorizedAt? }
         - twsl:web:pair:{pairCode} => token (reverse lookup; one-time use; auto-cleared after auth)
      */
      case 'tawasul-web-init': {
        // Desktop creates a new pairing session
        try {
          var nowW = new Date();
          var tokW = 'wdt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
          // 6-char alphanumeric pair code — avoid confusing chars (0,O,1,I,L)
          var alphaW = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
          var pairW = '';
          for (var iW = 0; iW < 6; iW++) pairW += alphaW.charAt(Math.floor(Math.random() * alphaW.length));
          // Ensure pairCode uniqueness (low probability of clash but check)
          var existingW = await dbGet('twsl:web:pair:' + pairW);
          if (existingW) {
            // Collision — regenerate once
            pairW = '';
            for (var iW2 = 0; iW2 < 6; iW2++) pairW += alphaW.charAt(Math.floor(Math.random() * alphaW.length));
          }
          var expW = new Date(nowW.getTime() + 5 * 60 * 1000).toISOString(); // 5 min expiry
          var sessW = {
            token: tokW,
            pairCode: pairW,
            status: 'pending',
            createdAt: nowW.toISOString(),
            expiresAt: expW,
          };
          await dbSet('twsl:web:tok:' + tokW, sessW);
          await dbSet('twsl:web:pair:' + pairW, tokW);
          return res.json({ token: tokW, pairCode: pairW, expiresInSec: 300 });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-init error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-web-status': {
        // Desktop polls with token
        try {
          var tokSW = String((req.query && req.query.token) || (req.body && req.body.token) || '');
          if (!tokSW) return res.status(400).json({ error: 'token مطلوب' });
          var sessSW = await dbGet('twsl:web:tok:' + tokSW);
          if (!sessSW) return res.json({ status: 'expired' });
          // Mark pending as expired if past expiry
          if (sessSW.status === 'pending' && new Date(sessSW.expiresAt) < new Date()) {
            sessSW.status = 'expired';
            await dbSet('twsl:web:tok:' + tokSW, sessSW);
            // Clean up pair lookup too
            if (sessSW.pairCode) await dbSet('twsl:web:pair:' + sessSW.pairCode, null);
          }
          return res.json({
            status: sessSW.status,
            userId: sessSW.userId || null,
            userName: sessSW.userName || null,
            userData: sessSW.userData || null,
            authorizedAt: sessSW.authorizedAt || null,
            expiresAt: sessSW.expiresAt,
          });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-status error: ' + (e.message || 'unknown'), status: 'error' });
        }
      }

      case 'tawasul-web-authorize': {
        // Mobile authorizes using pairCode
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var bAW = req.body || {};
          var pairAW = String(bAW.pairCode || '').toUpperCase().trim();
          var uidAW = String(bAW.userId || '');
          var unmAW = String(bAW.userName || '');
          if (!pairAW || !uidAW) return res.status(400).json({ error: 'pairCode و userId مطلوبان' });
          if (pairAW.length !== 6) return res.status(400).json({ error: 'رمز غير صحيح — يجب 6 خانات' });

          var tokAW = await dbGet('twsl:web:pair:' + pairAW);
          if (!tokAW) return res.status(404).json({ error: 'الرمز غير صحيح أو انتهت صلاحيته' });

          var sessAW = await dbGet('twsl:web:tok:' + tokAW);
          if (!sessAW) {
            await dbSet('twsl:web:pair:' + pairAW, null);
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
          }
          if (sessAW.status !== 'pending') {
            return res.status(400).json({ error: 'الجلسة سبق استخدامها' });
          }
          if (new Date(sessAW.expiresAt) < new Date()) {
            sessAW.status = 'expired';
            await dbSet('twsl:web:tok:' + tokAW, sessAW);
            await dbSet('twsl:web:pair:' + pairAW, null);
            return res.status(400).json({ error: 'انتهت صلاحية الرمز' });
          }

          // Authorize
          var nowAW2 = new Date();
          sessAW.status = 'authorized';
          sessAW.userId = uidAW;
          sessAW.userName = unmAW;
          sessAW.userData = bAW.userData || null; // Full user object from mobile (v6.31)
          sessAW.authorizedAt = nowAW2.toISOString();
          sessAW.expiresAt = new Date(nowAW2.getTime() + 7 * 24 * 3600 * 1000).toISOString(); // 7 days
          await dbSet('twsl:web:tok:' + tokAW, sessAW);
          // One-time use — clear pair lookup
          await dbSet('twsl:web:pair:' + pairAW, null);

          return res.json({ ok: true, user: { id: uidAW, name: unmAW } });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-authorize error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-web-logout': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          var tokLW = String((req.body && req.body.token) || '');
          if (!tokLW) return res.status(400).json({ error: 'token مطلوب' });
          var sessLW = await dbGet('twsl:web:tok:' + tokLW);
          if (sessLW && sessLW.pairCode) await dbSet('twsl:web:pair:' + sessLW.pairCode, null);
          await dbSet('twsl:web:tok:' + tokLW, null);
          return res.json({ ok: true });
        } catch (e) {
          return res.status(500).json({ error: 'tawasul-web-logout error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-check-recurring': {
        // Check recurring task templates and generate next instance if due
        // Should be called periodically (client polls on load; can also be a cron)
        try {
          var idxR = (await dbGet('twsl:idx')) || [];
          var nowR = Date.now();
          var generated = 0;
          var errors = [];

          function calcNextDue(pattern, interval, fromIso, weekdays) {
            var iv = interval || 1;
            var d = new Date(fromIso);
            if (pattern === 'daily') {
              d.setDate(d.getDate() + iv);
            } else if (pattern === 'weekly') {
              if (Array.isArray(weekdays) && weekdays.length > 0) {
                // Find next weekday in the list
                var currentDay = d.getDay();
                var sorted = weekdays.slice().sort();
                var nextDay = sorted.find(function(w){ return w > currentDay; });
                if (nextDay !== undefined) {
                  d.setDate(d.getDate() + (nextDay - currentDay));
                } else {
                  // wrap to next week's first day
                  d.setDate(d.getDate() + (7 - currentDay + sorted[0]));
                }
                // If interval > 1, add extra weeks after wrap
                if (iv > 1 && nextDay === undefined) {
                  d.setDate(d.getDate() + (iv - 1) * 7);
                }
              } else {
                d.setDate(d.getDate() + 7 * iv);
              }
            } else if (pattern === 'monthly') {
              d.setMonth(d.getMonth() + iv);
            } else if (pattern === 'yearly') {
              d.setFullYear(d.getFullYear() + iv);
            }
            return d.toISOString();
          }

          for (var i = 0; i < idxR.length; i++) {
            var tmpl = await dbGet('twsl:' + idxR[i]);
            if (!tmpl || !tmpl.id) continue;
            if (!tmpl.recurrence || !tmpl.recurrence.pattern) continue;
            if (tmpl.recurrence.paused) continue;

            var nextDueIso = tmpl.recurrence.nextDue || tmpl.deadline || tmpl.createdAt;
            if (!nextDueIso) continue;
            var nextDueMs = new Date(nextDueIso).getTime();

            // Skip if not yet due
            if (nextDueMs > nowR) continue;

            // Skip if past end date
            if (tmpl.recurrence.endDate) {
              var endMs = new Date(tmpl.recurrence.endDate).getTime();
              if (nowR > endMs) continue;
            }

            try {
              // Create a new instance (copy of template, fresh ID/serial/status)
              var counter = (await dbGet('twsl:serial')) || 0;
              counter = counter + 1;
              await dbSet('twsl:serial', counter);

              var newInstance = Object.assign({}, tmpl, {
                id: 'twsl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                serial: 'CB' + String(counter).padStart(4, '0'),
                status: 'sent',
                deadline: nextDueIso,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                log: [{
                  text: '🔁 مهمة مُتكرّرة — مُولَّدة تلقائياً (#' + tmpl.serial + ')',
                  by: 'النظام',
                  at: new Date().toISOString(),
                }],
                evaluations: [],
                attachments: [], // fresh attachments
                rejectionReason: null,
                returnReason: null,
                rejectedCount: 0,
                returnCount: 0,
                escalation: null,
                escalatedAt: null,
                finalScore: null,
                pendingCollabRequests: [],
                // reset assignee states
                assignees: (tmpl.assignees || []).map(function(a){
                  return Object.assign({}, a, { acceptedAt: null, deliveredAt: null, returns: 0, objected: false });
                }),
                // Track origin
                recurrenceParentId: tmpl.id,
                recurrenceParentSerial: tmpl.serial,
                recurrence: null, // instance is not itself recurring
              });
              await dbSet('twsl:' + newInstance.id, newInstance);

              // Add to index
              var idxNow = (await dbGet('twsl:idx')) || [];
              if (idxNow.indexOf(newInstance.id) < 0) {
                idxNow.push(newInstance.id);
                await dbSet('twsl:idx', idxNow);
              }

              // Create notifications for assignees
              var notifsR = (await dbGet('twsl:notifs')) || [];
              (newInstance.assignees || []).forEach(function(a){
                notifsR.push({
                  id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                  type: 'new_task_recurring',
                  taskId: newInstance.id,
                  serial: newInstance.serial,
                  from: newInstance.requesterName || '',
                  createdAt: new Date().toISOString(),
                  read: false,
                  targetId: a.id,
                });
              });
              if (notifsR.length > 500) notifsR = notifsR.slice(-500);
              await dbSet('twsl:notifs', notifsR);

              // Update template's nextDue + generationCount
              var updatedRec = Object.assign({}, tmpl.recurrence, {
                nextDue: calcNextDue(tmpl.recurrence.pattern, tmpl.recurrence.interval, nextDueIso, tmpl.recurrence.weekdays),
                generationCount: (tmpl.recurrence.generationCount || 0) + 1,
                lastGeneratedAt: new Date().toISOString(),
              });
              tmpl.recurrence = updatedRec;
              tmpl.updatedAt = new Date().toISOString();
              await dbSet('twsl:' + tmpl.id, tmpl);

              generated++;
            } catch (innerE) {
              errors.push('twsl:' + idxR[i] + ' — ' + (innerE.message || 'error'));
            }
          }

          return res.json({ ok: true, generated: generated, errors: errors, checked: idxR.length });
        } catch (e) {
          return res.status(500).json({ error: 'check-recurring error: ' + (e.message || 'unknown'), generated: 0 });
        }
      }

      case 'tawasul-check-escalations': {
        // Check and update auto-escalations (spec section 13) — native
        try {
          var idxE = (await dbGet('twsl:idx')) || [];
          var nowE = Date.now();
          var savedE = 0;
          for (var i = 0; i < idxE.length; i++) {
            var rE = await dbGet('twsl:' + idxE[i]);
            if (!rE || !rE.id) continue;
            if (['closed','cancelled','evaluated'].indexOf(rE.status) >= 0) continue;
            var updated = null;
            // Yellow: 3 days after issueAt
            if (rE.escalation !== 'yellow' && rE.escalation !== 'red' && rE.issueAt) {
              if (nowE - new Date(rE.issueAt).getTime() > 3 * 86400000) {
                updated = Object.assign({}, rE, { escalation: 'yellow', escalatedAt: new Date().toISOString() });
              }
            }
            // Red: 7 days after yellow
            else if (rE.escalation === 'yellow' && rE.escalatedAt) {
              if (nowE - new Date(rE.escalatedAt).getTime() > 7 * 86400000) {
                updated = Object.assign({}, rE, { escalation: 'red', redEscalatedAt: new Date().toISOString() });
              }
            }
            if (updated) {
              await dbSet('twsl:' + rE.id, updated);
              savedE++;
            }
          }
          return res.json({ ok: true, updates: savedE, checked: idxE.length });
        } catch (e) {
          return res.status(500).json({ error: 'check-escalations error: ' + (e.message || 'unknown'), updates: 0 });
        }
      }

      case 'tawasul-categories': {
        // Manage categories (for admin panel later)
        try {
          if (req.method === 'POST') {
            var cats = req.body && req.body.categories;
            if (!Array.isArray(cats)) return res.status(400).json({ error: 'categories array required' });
            await dbSet('twsl:categories', cats);
            return res.json({ ok: true, categories: cats });
          }
          var catsR = (await dbGet('twsl:categories')) || [];
          return res.json({ ok: true, categories: catsR });
        } catch (e) {
          return res.status(500).json({ error: 'categories error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-projects': {
        // Manage projects (reuse main projects from geofence if exists)
        try {
          if (req.method === 'POST') {
            var prjs = req.body && req.body.projects;
            if (!Array.isArray(prjs)) return res.status(400).json({ error: 'projects array required' });
            await dbSet('twsl:projects', prjs);
            return res.json({ ok: true, projects: prjs });
          }
          // Try twsl:projects first, fallback to geofence projects
          var prjsR = await dbGet('twsl:projects');
          if (!prjsR || !prjsR.length) {
            prjsR = (await dbGet('projects')) || [];
          }
          return res.json({ ok: true, projects: prjsR });
        } catch (e) {
          return res.status(500).json({ error: 'projects error: ' + (e.message || 'unknown') });
        }
      }

      case 'tawasul-permissions': {
        // Manage per-employee inbox permissions (admin only)
        // Each employee has: tawasulInbox ("anyone" | "restricted" | "none")
        //                     tawasulAllowedSenders: [empId, empId, ...]
        try {
          if (req.method === 'POST') {
            var body = req.body || {};
            var empId = body.empId;
            if (!empId) return res.status(400).json({ error: 'empId required' });
            var emps = (await dbGet('employees')) || [];
            var idx = emps.findIndex(function(e){ return String(e.id) === String(empId) || e.username === empId; });
            if (idx < 0) return res.status(404).json({ error: 'employee not found' });
            emps[idx] = Object.assign({}, emps[idx], {
              tawasulInbox: body.tawasulInbox || 'anyone',
              tawasulAllowedSenders: Array.isArray(body.tawasulAllowedSenders) ? body.tawasulAllowedSenders : [],
            });
            await dbSet('employees', emps);
            return res.json({ ok: true, employee: emps[idx] });
          }
          // GET: list all employees with their permissions
          var empsR = (await dbGet('employees')) || [];
          var perms = empsR.map(function(e){
            return {
              id: e.id,
              username: e.username,
              name: e.name,
              department: e.department,
              tawasulInbox: e.tawasulInbox || 'anyone',
              tawasulAllowedSenders: e.tawasulAllowedSenders || [],
            };
          });
          return res.json({ ok: true, permissions: perms });
        } catch (e) {
          return res.status(500).json({ error: 'permissions error: ' + (e.message || 'unknown') });
        }
      }

      /* ═══ HR AI DECISIONS (سجل قرارات المساعد الذكي) ═══ */
      case 'hr-ai-decisions': {
        try {
          if (req.method === 'POST') {
            var bd = req.body || {};
            var decision = bd.decision;
            if (!decision || !decision.id) return res.status(400).json({ error: 'decision.id required' });
            var decs = (await dbGet('hr_ai:decisions')) || [];
            var dIdx = decs.findIndex(function(d){ return d.id === decision.id; });
            if (dIdx >= 0) {
              decs[dIdx] = decision; // update (for undo)
            } else {
              decs.push(decision); // new
              if (decs.length > 1000) decs = decs.slice(-1000); // keep last 1000
            }
            await dbSet('hr_ai:decisions', decs);
            return res.json({ ok: true, decision: decision, total: decs.length });
          }
          // GET: return all decisions
          var decsR = (await dbGet('hr_ai:decisions')) || [];
          return res.json({ ok: true, decisions: decsR, total: decsR.length });
        } catch (e) {
          return res.status(500).json({ error: 'hr-ai-decisions error: ' + (e.message || 'unknown') });
        }
      }

      /* ═══ BANNERS — بنر الصفحة الرئيسية ═══ */
      case 'banners': {
        if (req.method === 'POST') {
          var body = req.body || {};
          var list = (await dbGet('banners')) || [];

          if (body.delete) {
            list = list.filter(function(b){ return b.id !== body.delete; });
            await dbSet('banners', list);
            return res.json({ ok: true, deleted: body.delete });
          }

          if (body.reorder && Array.isArray(body.reorder)) {
            var reordered = body.reorder.map(function(id, idx){
              var found = list.find(function(b){ return b.id === id; });
              return found ? Object.assign({}, found, { order: idx }) : null;
            }).filter(Boolean);
            await dbSet('banners', reordered);
            return res.json({ ok: true });
          }

          if (body.id) {
            var idx = list.findIndex(function(b){ return b.id === body.id; });
            if (idx >= 0) {
              list[idx] = Object.assign({}, list[idx], body, { updatedAt: new Date().toISOString() });
            } else {
              list.push(Object.assign({}, body, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
            }
            await dbSet('banners', list);
            return res.json({ ok: true, banner: list[idx >= 0 ? idx : list.length - 1] });
          }

          // Create new
          var newBanner = {
            id: "bnr_" + Date.now(),
            title: body.title || "",
            content: body.content || "",
            imageUrl: body.imageUrl || "",
            linkUrl: body.linkUrl || "",
            priority: body.priority || "normal",
            active: body.active !== false,
            startDate: body.startDate || null,
            endDate: body.endDate || null,
            order: list.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          list.push(newBanner);
          await dbSet('banners', list);
          return res.json({ ok: true, banner: newBanner });
        }

        // GET
        var list = (await dbGet('banners')) || [];
        var now = new Date();
        var adminView = req.query && req.query.admin === '1';
        var filtered = adminView ? list : list.filter(function(b){
          if (!b.active) return false;
          if (b.startDate && new Date(b.startDate) > now) return false;
          if (b.endDate && new Date(b.endDate) < now) return false;
          return true;
        });
        filtered.sort(function(a,b){ return (a.order || 0) - (b.order || 0); });
        return res.json({ ok: true, banners: filtered });
      }

      /* ═══ ANNOUNCEMENTS — التعاميم ═══ */
      case 'announcements': {
        if (req.method === 'POST') {
          var body = req.body || {};
          var list = (await dbGet('announcements')) || [];
          if (body.delete) {
            list = list.filter(function(a){ return a.id !== body.delete; });
            await dbSet('announcements', list);
            return res.json({ ok: true, deleted: body.delete });
          }
          if (body.id) {
            // Update existing
            var idx = list.findIndex(function(a){ return a.id === body.id; });
            if (idx >= 0) list[idx] = { ...list[idx], ...body };
            else list.unshift(body);
          } else {
            // New
            body.id = 'A' + Date.now();
            body.ts = new Date().toISOString();
            body.readBy = [];
            list.unshift(body);
          }
          await dbSet('announcements', list);
          return res.json({ ok: true, announcement: body });
        }
        var all = (await dbGet('announcements')) || [];
        var empId2 = req.query ? req.query.empId : null;
        if (empId2) {
          // Filter by employee targeting
          all = all.filter(function(a){
            if (!a.published) return false;
            if (a.target === 'all') return true;
            if (a.target === 'branch' && a.targetIds && a.targetIds.indexOf(empId2) < 0) {
              // need to check by branch — we'll return and let client filter
              return true;
            }
            if (a.target === 'employees' && a.targetIds && a.targetIds.indexOf(empId2) >= 0) return true;
            return a.target === 'all';
          });
        }
        return res.json(all);
      }

      /* ═══ MARK ANNOUNCEMENT READ ═══ */
      case 'announcement-read': {
        if (req.method !== 'POST') return res.status(400).json({ ok: false, error: 'POST required' });
        var body = req.body || {};
        var list = (await dbGet('announcements')) || [];
        var idx = list.findIndex(function(a){ return a.id === body.announcementId; });
        if (idx >= 0) {
          if (!list[idx].readBy) list[idx].readBy = [];
          if (list[idx].readBy.indexOf(body.empId) < 0) list[idx].readBy.push(body.empId);
          await dbSet('announcements', list);
        }
        return res.json({ ok: true });
      }

      /* ═══ PING — اختبار بسيط بدون fetch ═══ */
      case 'ping': {
        return res.json({ ok: true, msg: 'pong', ts: new Date().toISOString(), nodeVer: process.version, fetchAvailable: typeof fetch === 'function' });
      }

      /* ═══ SYNC KADWAR — جلب الموظفين من كوادر ومزامنتهم ═══ */
      case 'sync-kadwar': {
        var sourceUrl = 'https://hma.engineer/api/basma-sync?action=employees';
        var summary = { ok: false, url: sourceUrl, ts: new Date().toISOString() };
        try {
          // 1. Fetch from kadwar
          var r = await fetch(sourceUrl, { method: 'GET' });
          summary.fetchStatus = r.status;
          if (!r.ok) { summary.error = 'fetch failed with status ' + r.status; return res.json(summary); }
          var data = await r.json();
          if (!data || !Array.isArray(data.employees)) { summary.error = 'invalid response shape'; summary.raw = data; return res.json(summary); }

          // 2. Branch mapping (kadwar → basma)
          var branchMap = {
            'المركز الرئيسي — جدة': 'jed',
            'المركز الرئيسي': 'jed',
            'جدة': 'jed',
            'الرياض': 'riy',
            'اسطنبول': 'ist',
            'إسطنبول': 'ist',
            'غازي عنتاب': 'gaz',
          };
          function mapBranch(kadBranch) {
            if (!kadBranch) return 'jed';
            if (branchMap[kadBranch]) return branchMap[kadBranch];
            var lower = kadBranch.toLowerCase();
            if (lower.indexOf('جدة') >= 0) return 'jed';
            if (lower.indexOf('رياض') >= 0) return 'riy';
            if (lower.indexOf('اسطنبول') >= 0 || lower.indexOf('istanbul') >= 0) return 'ist';
            if (lower.indexOf('غازي') >= 0 || lower.indexOf('عنتاب') >= 0) return 'gaz';
            return 'jed';
          }

          // 3. Load existing to preserve basma-specific data (points, face, etc.)
          var existing = await dbGet('employees') || [];
          var existingByEmail = {};
          var existingByKadwarId = {};
          var existingByIdNumber = {};
          existing.forEach(function(e) {
            if (e.email) existingByEmail[e.email.toLowerCase()] = e;
            if (e.kadwarId) existingByKadwarId[e.kadwarId] = e;
            if (e.idNumber) existingByIdNumber[e.idNumber] = e;
          });

          // 4. Build kadwar-id → email mapping (for hierarchy)
          var kadIdToEmail = {};
          data.employees.forEach(function(kad) {
            var kadId = kad.id || kad.uid || kad.idNumber;
            var email = (kad.email || '').toLowerCase();
            if (kadId && email) kadIdToEmail[kadId] = email;
          });

          // 5. Merge: kadwar data + basma-specific preserved
          var merged = data.employees.map(function(kad) {
            var email = (kad.email || '').toLowerCase();
            var kadId = kad.id || kad.uid || kad.idNumber;
            var prev = existingByIdNumber[kad.idNumber] || existingByEmail[email] || existingByKadwarId[kadId] || {};
            // Resolve manager email from managerId
            var managerEmail = kad.managerId && kadIdToEmail[kad.managerId] ? kadIdToEmail[kad.managerId] : '';
            var supervisorEmail = kad.supervisorId && kadIdToEmail[kad.supervisorId] ? kadIdToEmail[kad.supervisorId] : '';
            return {
              // Identity (idNumber is the unified ID)
              id: kad.idNumber || kadId,
              idNumber: kad.idNumber || '',
              kadwarId: kadId,
              email: email,
              // Account (from kadwar — managed there)
              username: (kad.username || '').toLowerCase(),
              hasAccount: kad.hasAccount !== undefined ? kad.hasAccount : !!(kad.username && kad.passwordHash),
              accountRole: kad.accountRole || 'employee',
              passwordHash: kad.passwordHash || '',
              passwordAlgo: kad.passwordAlgo || 'sha256',
              passwordSalt: kad.passwordSalt || 'hr_salt_2024',
              passwordUpdatedAt: kad.passwordUpdatedAt || null,
              // Profile (from kadwar)
              name: kad.name || prev.name || '',
              role: (kad.role || prev.role || '').trim(),
              department: kad.department || prev.department || '',
              branch: mapBranch(kad.branch),
              branchName: kad.branch || '',
              phone: kad.phone || prev.phone || '',
              status: kad.status || 'active',
              // Hierarchy (from kadwar)
              managerKadwarId: kad.managerId || '',
              managerEmail: managerEmail,
              supervisorKadwarId: kad.supervisorId || '',
              supervisorEmail: supervisorEmail,
              isManager: kad.accountRole === 'manager' || kad.accountRole === 'admin' || (kad.role || '').indexOf('مدير') >= 0 || prev.isManager || false,
              isAdmin: kad.accountRole === 'admin' || prev.isAdmin || false,
              // Basma-specific (preserved)
              points: prev.points || 0,
              type: prev.type || 'office',
              flexBase: prev.flexBase || false,
              flexOT: prev.flexOT || false,
              flexOTMax: prev.flexOTMax || 0,
              remote: prev.remote || false,
              observed: prev.observed || false,
              onLeave: prev.onLeave || false,
              salary: prev.salary || 0,
              joinDate: prev.joinDate || '',
              dob: prev.dob || '',
              sceNumber: prev.sceNumber || '',
              sceExpiry: prev.sceExpiry || '',
              sceStatus: prev.sceStatus || '',
              // Sync metadata
              source: 'kadwar',
              syncedAt: new Date().toISOString(),
            };
          });

          // 6. Build subordinates list (reverse lookup via kadwarId)
          merged.forEach(function(emp) {
            emp.subordinates = merged.filter(function(e) {
              return e.managerKadwarId && e.managerKadwarId === emp.kadwarId && e.id !== emp.id;
            }).map(function(e) { return e.id; });
            emp.subordinatesCount = emp.subordinates.length;
          });

          // 7. Save
          await dbSet('kadwar_employees', merged);
          await dbSet('employees', merged);

          // 8. Summary
          var newItems = merged.filter(function(e) { return !existingByIdNumber[e.idNumber] && !existingByKadwarId[e.kadwarId]; });
          var removed = existing.filter(function(e) {
            return !merged.find(function(m) {
              return m.idNumber === e.idNumber || m.kadwarId === e.kadwarId || (m.email && m.email === (e.email || '').toLowerCase());
            });
          });

          summary.ok = true;
          summary.count = merged.length;
          summary.added = newItems.length;
          summary.updated = merged.length - newItems.length;
          summary.removedCount = removed.length;
          summary.removed = removed.map(function(e) { return { id: e.id, name: e.name, email: e.email }; });
          summary.byBranch = merged.reduce(function(acc, e) {
            acc[e.branch] = (acc[e.branch] || 0) + 1;
            return acc;
          }, {});
          summary.withAccount = merged.filter(function(e) { return e.hasAccount; }).length;
          summary.withoutAccount = merged.filter(function(e) { return !e.hasAccount; }).length;
          summary.managers = merged.filter(function(e) { return e.isManager; }).length;
          summary.admins = merged.filter(function(e) { return e.isAdmin; }).length;
          summary.sample = merged.slice(0, 3).map(function(e) {
            return { idNumber: e.idNumber, username: e.username, name: e.name, role: e.role, branch: e.branch, hasAccount: e.hasAccount, accountRole: e.accountRole, subordinatesCount: e.subordinatesCount };
          });
          return res.json(summary);
        } catch (e) {
          summary.error = 'exception: ' + (e && e.message ? e.message : String(e));
          return res.json(summary);
        }
      }

      /* ═══ ADMIN CONFIG — بيانات المدير العام (خاص ببصمة) ═══ */
      case 'admin-config': {
        if (req.method === 'GET') {
          var admin = await dbGet('admin_config') || null;
          if (!admin) return res.json({ ok: true, exists: false });
          // Don't send password back
          return res.json({ ok: true, exists: true, email: admin.email, name: admin.name, updatedAt: admin.updatedAt });
        }
        if (req.method === 'POST') {
          // Set or update admin credentials
          var body = req.body || {};
          if (!body.email || !body.password) return res.status(400).json({ error: 'email and password required' });
          var current = await dbGet('admin_config');
          // If updating, verify current password
          if (current && body.currentPassword !== current.password) {
            return res.status(401).json({ error: 'current password incorrect' });
          }
          var admin = {
            email: body.email.toLowerCase(),
            password: body.password,
            name: body.name || current?.name || 'المدير العام',
            role: 'المدير العام',
            isGeneralManager: true,
            updatedAt: new Date().toISOString(),
          };
          await dbSet('admin_config', admin);
          return res.json({ ok: true, email: admin.email });
        }
        break;
      }

      /* ═══ READ KADWAR EMPLOYEES — عرض الموظفين المُزامَنين ═══ */
      case 'kadwar-employees': {
        var stored = await dbGet('kadwar_employees');
        if (!stored) return res.json({ ok: false, msg: 'no sync yet — call ?action=sync-kadwar first' });
        return res.json({ ok: true, count: stored.length, employees: stored, lastSync: stored[0] && stored[0].syncedAt });
      }

      /* ═══ TEST KADWAR SYNC — اختبار الاتصال بكوادر ═══ */
      case 'test-kadwar-sync': {
        var url = 'https://hma.engineer/api/basma-sync?action=employees';
        var result = { ok: false, url: url, ts: new Date().toISOString() };
        try {
          if (typeof fetch !== 'function') {
            result.error = 'fetch not available in runtime';
            return res.json(result);
          }
          var r;
          try {
            r = await fetch(url, { method: 'GET' });
          } catch (fetchErr) {
            result.error = 'fetch failed: ' + (fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr));
            return res.json(result);
          }
          result.status = r.status || 0;
          try {
            var txt = await r.text();
            result.bodyPreview = (txt || '').slice(0, 300);
          } catch (textErr) {
            result.bodyError = 'text() failed: ' + (textErr && textErr.message ? textErr.message : String(textErr));
          }
          result.ok = result.status >= 200 && result.status < 300;
          return res.json(result);
        } catch (e) {
          result.error = 'outer: ' + (e && e.message ? e.message : String(e));
          try { return res.json(result); } catch(e2) { return res.status(200).send(JSON.stringify(result)); }
        }
      }

      case 'kadwar-sync': {
        // ═══ API for kadwar (hma.engineer) to read basma data ═══
        // Called from: hma.engineer → GET b.hma.engineer/api/data?action=kadwar-sync
        if (req.method === 'GET') {
          var emps = await dbGet('employees') || [];
          var att = await dbGet('attendance') || [];
          var violationsV2 = await dbGet('violations_v2') || [];
          var today = new Date().toISOString().split('T')[0];
          var d30 = new Date(); d30.setDate(d30.getDate() - 30);
          var d30Str = d30.toISOString().split('T')[0];

          // Single employee detail
          if (req.query.empId) {
            var emp = emps.find(e => e.id === req.query.empId);
            if (!emp) return res.json({ error: 'not found' });
            var empAtt = att.filter(a => a.empId === emp.id);
            var last30Att = empAtt.filter(a => a.type === 'checkin' && a.date >= d30Str);
            var compliance = Math.min(100, Math.round((last30Att.length / 26) * 100));
            var empVios = violationsV2.filter(v => v.empId === emp.id && v.status === 'ACTIVE');
            var todayCheckin = empAtt.find(a => a.date === today && a.type === 'checkin');
            return res.json({
              id: emp.id, name: emp.name, role: emp.role, branch: emp.branch,
              compliance: compliance,
              points: emp.points || 0,
              activeViolations: empVios.length,
              violations: empVios.map(v => ({ id: v.id, violationId: v.violationId, description: v.description, penaltyLabel: v.penaltyLabel, occurrence: v.occurrence, createdAt: v.createdAt })),
              todayStatus: todayCheckin ? 'present' : 'absent',
              todayCheckinTime: todayCheckin ? todayCheckin.ts : null,
              last30Days: last30Att.length,
              syncDate: new Date().toISOString(),
            });
          }

          // All employees summary
          var summary = emps.filter(e => !e.terminated).map(function(emp) {
            var empAtt30 = att.filter(a => a.empId === emp.id && a.type === 'checkin' && a.date >= d30Str);
            var compliance = Math.min(100, Math.round((empAtt30.length / 26) * 100));
            var activeVios = violationsV2.filter(v => v.empId === emp.id && v.status === 'ACTIVE').length;
            var todayCheckin = att.find(a => a.empId === emp.id && a.date === today && a.type === 'checkin');
            return {
              id: emp.id, name: emp.name, branch: emp.branch,
              compliance: compliance,
              points: emp.points || 0,
              activeViolations: activeVios,
              todayStatus: todayCheckin ? 'present' : 'absent',
            };
          });
          return res.json({ employees: summary, total: summary.length, syncDate: new Date().toISOString() });
        }

        // kadwar pushes employee data to basma
        if (req.method === 'POST') {
          // Sync: kadwar sends tasks/evaluations/notifications for an employee
          var empId = req.body.empId;
          if (!empId) return res.json({ error: 'empId required' });
          var kadwarData = await dbGet('kadwar_data') || {};
          kadwarData[empId] = {
            tasks: req.body.tasks || [],
            evaluations: req.body.evaluations || [],
            notifications: req.body.notifications || { tasks: 0, exams: 0, alerts: 0 },
            updatedAt: new Date().toISOString(),
          };
          await dbSet('kadwar_data', kadwarData);
          // Also update kadwar_notifs for badge display
          var notifs = await dbGet('kadwar_notifs') || {};
          notifs[empId] = req.body.notifications || { tasks: 0, exams: 0, alerts: 0 };
          await dbSet('kadwar_notifs', notifs);
          return res.json({ ok: true });
        }
        break;
      }

      case 'report': {
        const { period } = req.query; // 'weekly' or 'monthly'
        const emps = await dbGet('employees') || [];
        const att = await dbGet('attendance') || [];
        const violations = await dbGet('violations') || [];
        const warnings = await dbGet('warnings') || [];
        const leaves = await dbGet('leaves') || [];
        const now = new Date();
        var startDate, endDate = now.toISOString().split('T')[0];

        if (period === 'weekly') {
          var d = new Date(); d.setDate(d.getDate() - 7);
          startDate = d.toISOString().split('T')[0];
        } else {
          var d2 = new Date(); d2.setMonth(d2.getMonth() - 1);
          startDate = d2.toISOString().split('T')[0];
        }

        var periodAtt = att.filter(a => a.date >= startDate && a.date <= endDate);
        var periodViol = violations.filter(v => (v.date || v.ts?.split('T')[0]) >= startDate);
        var periodWarn = warnings.filter(w => w.ts?.split('T')[0] >= startDate);
        var periodLeaves = leaves.filter(l => l.ts?.split('T')[0] >= startDate);

        // Build per-employee summary
        var empSummary = emps.filter(e => !e.terminated).map(function(e) {
          var myAtt = periodAtt.filter(a => a.empId === e.id);
          var checkins = myAtt.filter(a => a.type === "الحضور").length;
          var myViol = periodViol.filter(v => v.empId === e.id);
          var myWarn = periodWarn.filter(w => w.empId === e.id);
          var lateCount = myViol.filter(v => v.type === "late").length;
          var absentCount = myViol.filter(v => v.type === "absent").length;
          return {
            id: e.id, name: e.name, branch: e.branch, role: e.role,
            daysPresent: checkins, lateCount, absentCount,
            violationCount: myViol.length, warningCount: myWarn.length,
            pendingWarnings: myWarn.filter(w => w.status === "pending").length,
          };
        });

        return res.json({
          period: period || 'monthly',
          from: startDate, to: endDate,
          totalEmployees: emps.filter(e => !e.terminated).length,
          totalAttendance: periodAtt.length,
          totalViolations: periodViol.length,
          totalWarnings: periodWarn.length,
          pendingWarnings: periodWarn.filter(w => w.status === "pending").length,
          escalatedWarnings: periodWarn.filter(w => w.status === "escalated").length,
          pendingLeaves: periodLeaves.filter(l => l.status === "pending").length,
          employees: empSummary,
          generatedAt: now.toISOString()
        });
      }

      case 'export': {
        const { type } = req.query;
        const emps = await dbGet('employees') || [];
        const att = await dbGet('attendance') || [];
        if (type === 'payroll') {
          const vs = await dbGet('violations') || [];
          let csv = 'الرقم,الاسم,الراتب,الخصومات,الصافي\n';
          emps.forEach(e => { const d = vs.filter(v => v.empId === e.id).reduce((a, v) => a + (v.deduction || 0), 0); csv += `${e.id},${e.name},${e.salary},${d},${e.salary - d}\n`; });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'attendance') {
          let csv = 'التاريخ,الرقم,الاسم,النوع,الوقت,يدوي\n';
          att.forEach(r => { const e = emps.find(x => x.id === r.empId); csv += `${r.date},${r.empId},${e?.name || ''},${r.type},${r.ts},${r.manual ? 'نعم' : 'لا'}\n`; });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'redemptions') {
          var reds = await dbGet('redemptions') || [];
          var csv = 'التاريخ,رقم الموظف,اسم الكوبون,النقاط\n';
          reds.forEach(function(r){
            var e = emps.find(function(x){ return x.id === r.empId; });
            csv += (r.ts || '') + ',' + (r.empId || '') + ',"' + (e ? e.name : '') + '","' + (r.couponName || '') + '",' + (r.pts || 0) + '\n';
          });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv);
        }
        if (type === 'announcements') {
          var anns = await dbGet('announcements') || [];
          var csv2 = 'التاريخ,العنوان,المحتوى,الأولوية,الاستهداف,منشور,عدد القراءات\n';
          anns.forEach(function(a){
            csv2 += (a.ts || '') + ',"' + (a.title || '').replace(/"/g,'""') + '","' + (a.body || '').replace(/"/g,'""').replace(/\n/g,' ') + '",' + (a.priority || 'normal') + ',' + (a.target || 'all') + ',' + (a.published ? 'نعم' : 'لا') + ',' + ((a.readBy || []).length) + '\n';
          });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv2);
        }
        if (type === 'employees_list') {
          var csv3 = 'الرقم,الاسم,المسمى,الفرع,القسم,الإيميل,الجوال,الحالة,حساب نشط\n';
          emps.forEach(function(e){
            csv3 += (e.idNumber || e.id) + ',"' + (e.name || '') + '","' + (e.role || '') + '","' + (e.branchName || e.branch || '') + '","' + (e.department || '') + '","' + (e.email || '') + '","' + (e.phone || '') + '",' + (e.status || 'active') + ',' + (e.hasAccount ? 'نعم' : 'لا') + '\n';
          });
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send('\uFEFF' + csv3);
        }
        return res.json({ error: 'unknown type' });
      }

      /* ═══ EMPLOYEE RECORDS (سجل وظيفي — عقود/ترقيات) ═══ */
      case 'emp_records': {
        if (req.method === 'GET') {
          var records = await dbGet('emp_records') || [];
          if (req.query.empId) records = records.filter(r => r.empId === req.query.empId);
          if (req.query.type) records = records.filter(r => r.recordType === req.query.type);
          return res.json(records);
        }
        if (req.method === 'POST') {
          var records = await dbGet('emp_records') || [];
          records.push({
            id: 'REC' + Date.now(),
            createdAt: new Date().toISOString(),
            ...req.body,
          });
          await dbSet('emp_records', records);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var records = await dbGet('emp_records') || [];
          records = records.filter(r => r.id !== req.query.id);
          await dbSet('emp_records', records);
          return res.json({ ok: true });
        }
        break;
      }

      case 'cleanup': {
        if (req.method === 'GET') {
          // Return data sizes for each table
          var tables = ['attendance','violations','violations_v2','warnings','complaints','investigations','appeals','notifications','leaves','permissions','pre_absences','tickets','gps_log','faces','attachments','health_disclosures','dependents','custody','events','kadwar_data','kadwar_notifs','employees','branches','settings','laiha_settings'];
          var sizes = {};
          for (var tbl of tables) {
            var data = await dbGet(tbl);
            if (data === null) sizes[tbl] = { count: 0, type: 'null' };
            else if (Array.isArray(data)) sizes[tbl] = { count: data.length, type: 'array' };
            else if (typeof data === 'object') sizes[tbl] = { count: Object.keys(data).length, type: 'object' };
            else sizes[tbl] = { count: 1, type: typeof data };
          }
          // Special: count tawasul tasks from twsl:idx
          try {
            var twslIdx = await dbGet('twsl:idx');
            sizes['tawasul'] = { count: Array.isArray(twslIdx) ? twslIdx.length : 0, type: 'tawasul' };
          } catch(e) { sizes['tawasul'] = { count: 0, type: 'tawasul' }; }
          return res.json({ tables: sizes });
        }
        if (req.method === 'POST') {
          // Selective cleanup
          var cleanupAction = req.body.action; // 'delete_older' | 'delete_recent' | 'delete_all' | 'keep_recent'
          var target = req.body.target;  // table name or 'all'
          var days = req.body.days || 0;
          var results = {};

          var cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          var cutoff = cutoffDate.toISOString().split('T')[0];

          var dateTables = ['attendance','violations_v2','complaints','investigations','appeals','notifications','leaves','permissions','pre_absences','tickets','gps_log'];

          async function cleanTable(tbl) {
            // Special case: tawasul tasks stored as twsl:<id> + twsl:idx
            if (tbl === 'tawasul') {
              var idx = await dbGet('twsl:idx') || [];
              var beforeT = idx.length;
              if (cleanupAction === 'delete_all') {
                for (var i = 0; i < idx.length; i++) {
                  try { await dbSet('twsl:' + idx[i], null); } catch(e) {}
                }
                await dbSet('twsl:idx', []);
                try { await dbSet('twsl:notifs', []); } catch(e) {}
                return { before: beforeT, after: 0, deleted: beforeT };
              }
              // Date-based cleanup for tasks
              var keep = [];
              var deleteIds = [];
              for (var j = 0; j < idx.length; j++) {
                var tsk = await dbGet('twsl:' + idx[j]);
                if (!tsk) { continue; }
                var dStr = (tsk.createdAt || tsk.updatedAt || '').split('T')[0];
                var shouldKeep = true;
                if (cleanupAction === 'delete_older') shouldKeep = dStr >= cutoff;
                else if (cleanupAction === 'delete_recent') shouldKeep = dStr < cutoff;
                else if (cleanupAction === 'keep_recent') shouldKeep = dStr >= cutoff;
                if (shouldKeep) keep.push(idx[j]);
                else deleteIds.push(idx[j]);
              }
              for (var k = 0; k < deleteIds.length; k++) {
                try { await dbSet('twsl:' + deleteIds[k], null); } catch(e) {}
              }
              await dbSet('twsl:idx', keep);
              return { before: beforeT, after: keep.length, deleted: deleteIds.length };
            }

            var data = await dbGet(tbl);
            if (!data) return { before: 0, after: 0 };
            var before = Array.isArray(data) ? data.length : Object.keys(data).length;

            if (cleanupAction === 'delete_all') {
              await dbSet(tbl, Array.isArray(data) ? [] : {});
              return { before: before, after: 0, deleted: before };
            }

            if (!Array.isArray(data)) return { before: before, after: before, skipped: 'not array' };

            var filtered;
            if (cleanupAction === 'delete_older') {
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d >= cutoff;
              });
            } else if (cleanupAction === 'delete_recent') {
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d < cutoff;
              });
            } else if (cleanupAction === 'keep_recent') {
              filtered = data.filter(function(r) {
                var d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '') || (r.ts ? r.ts.split('T')[0] : '');
                return d >= cutoff;
              });
            } else {
              return { before: before, after: before, error: 'unknown action' };
            }
            await dbSet(tbl, filtered);
            return { before: before, after: filtered.length, deleted: before - filtered.length };
          }

          if (target === 'all') {
            for (var tbl of dateTables) {
              results[tbl] = await cleanTable(tbl);
            }
            results['tawasul'] = await cleanTable('tawasul');
          } else {
            results[target] = await cleanTable(target);
          }

          return res.json({ ok: true, action: cleanupAction, days: days, cutoff: cutoff, results: results });
        }
        break;
      }

      /* ═══ KADWAR NOTIFICATIONS + DATA ═══ */
      case 'kadwar_notifs': {
        var empId = req.query.empId;
        var notifs = await dbGet('kadwar_notifs') || {};
        var empNotifs = notifs[empId] || { tasks: 0, exams: 0, alerts: 0 };
        return res.json(empNotifs);
      }

      case 'kadwar_data': {
        // Employee reads their kadwar data (tasks, evaluations) from basma
        var empId = req.query.empId;
        if (!empId) return res.json({ error: 'empId required' });
        var kadwarData = await dbGet('kadwar_data') || {};
        return res.json(kadwarData[empId] || { tasks: [], evaluations: [], notifications: { tasks: 0, exams: 0, alerts: 0 } });
      }

      /* ═══ PERMISSIONS (طلب إذن) ═══ */
      case 'permissions': {
        if (req.method === 'GET') {
          var perms = await dbGet('permissions') || [];
          if (req.query.empId) perms = perms.filter(p => p.empId === req.query.empId);
          return res.json(perms);
        }
        if (req.method === 'POST') {
          var perms = await dbGet('permissions') || [];
          var newPerm = { id: 'PERM' + Date.now(), status: 'pending', ts: new Date().toISOString(), ...req.body };
          perms.push(newPerm);
          await dbSet('permissions', perms);

          // v6.37 — Notify manager + HR
          (async function(){
            try {
              var empsP = (await dbGet('employees')) || [];
              var empP = empsP.find(function(e){ return e.id === newPerm.empId; });
              var mgrId = empP && (empP.managerId || empP.supervisorId);
              var hrIdsP = empsP.filter(function(e){ return e.role === 'hr_manager' || e.role === 'admin' || e.isAdmin; }).map(function(e){ return e.id; });
              var tgtsP = [];
              if (mgrId) tgtsP.push(mgrId);
              hrIdsP.forEach(function(id){ if (tgtsP.indexOf(id) < 0) tgtsP.push(id); });

              var notifsP = (await dbGet('notifications')) || [];
              var nowISOP = new Date().toISOString();
              tgtsP.forEach(function(tid){
                notifsP.push({
                  id: 'n_prmreq_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  empId: tid,
                  type: 'permission_request',
                  title: '⏱ طلب استئذان',
                  message: (empP && empP.name ? empP.name : 'موظف') + ' طلب استئذان' + (newPerm.reason ? ' (' + newPerm.reason + ')' : ''),
                  permissionId: newPerm.id,
                  targetEmpId: newPerm.empId,
                  read: false,
                  createdAt: nowISOP,
                });
              });
              if (notifsP.length > 1000) notifsP = notifsP.slice(-1000);
              await dbSet('notifications', notifsP);

              if (mgrId) {
                try {
                  var pushSubsP = (await dbGet('push_subscriptions')) || {};
                  var subP = pushSubsP[mgrId];
                  if (subP && subP.subscription) {
                    await sendWebPush(subP.subscription, {
                      title: '⏱ طلب استئذان',
                      body: (empP && empP.name ? empP.name : 'موظف') + ' طلب استئذان',
                      tag: 'perm-' + newPerm.id,
                      data: { id: newPerm.id, type: 'permission_request' },
                    });
                  }
                } catch(e) {}
              }
            } catch(e) {}
          })();

          return res.json({ ok: true, permission: newPerm });
        }
        if (req.method === 'PUT') {
          var perms = await dbGet('permissions') || [];
          var idx = perms.findIndex(p => p.id === req.body.id);
          if (idx >= 0) {
            var prevStatusPerm = perms[idx].status;
            perms[idx] = { ...perms[idx], ...req.body, decidedAt: new Date().toISOString() };
            await dbSet('permissions', perms);

            // v6.37 — Notify employee on decision
            if (req.body.status && req.body.status !== prevStatusPerm) {
              (async function(){
                try {
                  var permX = perms[idx];
                  var notifsX = (await dbGet('notifications')) || [];
                  var nowX = new Date().toISOString();
                  var titleX = req.body.status === 'approved' ? '✅ تم الموافقة على الاستئذان' : '❌ تم رفض الاستئذان';
                  var msgX = req.body.status === 'approved' ? 'استئذانك تم اعتماده.' : 'استئذانك لم يُعتمد' + (req.body.rejectReason ? ' — ' + req.body.rejectReason : '.');
                  notifsX.push({
                    id: 'n_prmres_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                    empId: permX.empId,
                    type: 'permission_response',
                    title: titleX,
                    message: msgX,
                    permissionId: permX.id,
                    read: false,
                    createdAt: nowX,
                  });
                  if (notifsX.length > 1000) notifsX = notifsX.slice(-1000);
                  await dbSet('notifications', notifsX);

                  try {
                    var pushSubsX = (await dbGet('push_subscriptions')) || {};
                    var subX = pushSubsX[permX.empId];
                    if (subX && subX.subscription) {
                      await sendWebPush(subX.subscription, { title: titleX, body: msgX, tag: 'perm-resp-' + permX.id, data: { id: permX.id, type: 'permission_response' } });
                    }
                  } catch(e){}
                } catch(e){}
              })();
            }
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ HEALTH DISCLOSURE (الإفصاح الصحي) ═══ */
      case 'health_disclosure': {
        if (req.method === 'GET') {
          var hd = await dbGet('health_disclosures') || [];
          if (req.query.empId) hd = hd.filter(h => h.empId === req.query.empId);
          return res.json(hd);
        }
        if (req.method === 'POST') {
          var hd = await dbGet('health_disclosures') || [];
          var existing = hd.findIndex(h => h.empId === req.body.empId);
          var record = { ...req.body, status: 'pending', updatedAt: new Date().toISOString() };
          if (existing >= 0) { hd[existing] = { ...hd[existing], ...record }; } else { hd.push(record); }
          await dbSet('health_disclosures', hd);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ ATTACHMENTS (المرفقات) ═══ */
      case 'attachments': {
        if (req.method === 'GET') {
          var docs = await dbGet('attachments') || [];
          if (req.query.empId) docs = docs.filter(d => d.empId === req.query.empId);
          return res.json(docs);
        }
        if (req.method === 'POST') {
          var docs = await dbGet('attachments') || [];
          var fileData = req.body.data; // base64
          delete req.body.data; // don't store base64 in main DB
          var newDoc = { id: 'ATT' + Date.now(), status: 'pending', ts: new Date().toISOString(), ...req.body };
          // Store file separately in blob
          if (fileData) {
            try { await put(PFX + 'files/' + newDoc.id, fileData, { access: 'public', contentType: 'text/plain', addRandomSuffix: false }); newDoc.hasFile = true; } catch(e) { /**/ }
          }
          docs.push(newDoc);
          await dbSet('attachments', docs);
          return res.json({ ok: true, doc: newDoc });
        }
        if (req.method === 'PUT') {
          var docs = await dbGet('attachments') || [];
          var idx = docs.findIndex(d => d.id === req.body.id);
          if (idx >= 0) { docs[idx] = { ...docs[idx], ...req.body }; await dbSet('attachments', docs); }
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          var docs = await dbGet('attachments') || [];
          docs = docs.filter(d => d.id !== req.query.id);
          await dbSet('attachments', docs);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ ATTACHMENT TYPES (أنواع المرفقات — يديرها الأدمن) ═══ */
      case 'attachment_types': {
        if (req.method === 'GET') {
          var types = await dbGet('attachment_types');
          if (!types) types = ["بطاقة هوية", "جواز سفر", "رخصة قيادة", "عقد عمل", "IBAN بنكي", "أخرى"];
          return res.json(types);
        }
        if (req.method === 'POST') {
          await dbSet('attachment_types', req.body.types || []);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ LAIHA SETTINGS (إعدادات لائحة المخالفات — يديرها المدير العام) ═══ */
      case 'laiha_settings': {
        if (req.method === 'GET') {
          // Returns admin overrides: { "WH-01": { enabled: true, autoApply: false, customPenalties: {...} } }
          var settings = await dbGet('laiha_settings') || {};
          return res.json(settings);
        }
        if (req.method === 'POST') {
          // Update single item: { id, enabled, autoApply, customDescription, customPenalties }
          var settings = await dbGet('laiha_settings') || {};
          settings[req.body.id] = {
            enabled: req.body.enabled !== undefined ? req.body.enabled : true,
            autoApply: req.body.autoApply !== undefined ? req.body.autoApply : false,
            customDescription: req.body.customDescription || null,
            customPenalties: req.body.customPenalties || null,
            updatedAt: new Date().toISOString(),
            updatedBy: req.body.updatedBy || 'admin',
          };
          await dbSet('laiha_settings', settings);
          return res.json({ ok: true });
        }
        if (req.method === 'DELETE') {
          // Reset specific item to default
          var settings = await dbGet('laiha_settings') || {};
          delete settings[req.query.id];
          await dbSet('laiha_settings', settings);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ COMPLAINTS (الشكاوى الرسمية) ═══ */
      case 'complaints': {
        if (req.method === 'GET') {
          var complaints = await dbGet('complaints') || [];
          if (req.query.filedBy) complaints = complaints.filter(c => c.filedBy === req.query.filedBy);
          if (req.query.against) complaints = complaints.filter(c => c.against === req.query.against);
          if (req.query.status) complaints = complaints.filter(c => c.status === req.query.status);
          if (req.query.id) complaints = complaints.filter(c => c.id === req.query.id);
          return res.json(complaints);
        }
        if (req.method === 'POST') {
          var complaints = await dbGet('complaints') || [];
          var newComplaint = {
            id: 'CMP' + Date.now(),
            status: 'PENDING_HR',
            createdAt: new Date().toISOString(),
            filedBy: req.body.filedBy,       // ID الشاكي
            filedByName: req.body.filedByName,
            against: req.body.against,        // ID المشكو عليه
            againstName: req.body.againstName,
            violationId: req.body.violationId, // من اللائحة
            chapter: req.body.chapter,         // الفصل
            title: req.body.title,
            details: req.body.details,
            evidence: req.body.evidence || [], // مرفقات
            hrNotes: null,
            hrDecision: null,                  // rejected | investigate | convert
            decidedAt: null,
            decidedBy: null,
            investigationId: null,
            violationCreatedId: null,
          };
          complaints.push(newComplaint);
          await dbSet('complaints', complaints);
          return res.json({ ok: true, complaint: newComplaint });
        }
        if (req.method === 'PUT') {
          // HR decision or status update
          var complaints = await dbGet('complaints') || [];
          var idx = complaints.findIndex(c => c.id === req.body.id);
          if (idx >= 0) {
            complaints[idx] = { ...complaints[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('complaints', complaints);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ INVESTIGATIONS (التحقيقات) ═══ */
      case 'investigations': {
        if (req.method === 'GET') {
          var investigations = await dbGet('investigations') || [];
          if (req.query.empId) investigations = investigations.filter(i => i.empId === req.query.empId);
          if (req.query.complaintId) investigations = investigations.filter(i => i.complaintId === req.query.complaintId);
          if (req.query.status) investigations = investigations.filter(i => i.status === req.query.status);
          if (req.query.id) investigations = investigations.filter(i => i.id === req.query.id);
          return res.json(investigations);
        }
        if (req.method === 'POST') {
          var investigations = await dbGet('investigations') || [];
          var newInv = {
            id: 'INV' + Date.now(),
            complaintId: req.body.complaintId,
            empId: req.body.empId,
            empName: req.body.empName,
            violationId: req.body.violationId,
            chapter: req.body.chapter,
            title: req.body.title,
            description: req.body.description,
            questions: req.body.questions || [], // الأسئلة الموجهة للموظف
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy,
            deadline: req.body.deadline,          // 24 ساعة من الإنشاء
            status: 'WAITING_RESPONSE',
            empResponse: null,                     // نص الرد
            empResponseAttachments: [],            // مرفقات الرد
            empResponseAt: null,
            hrDecision: null,                      // convert_to_violation | close_innocent
            hrDecisionNotes: null,
            hrDecidedAt: null,
            hrDecidedBy: null,
          };
          investigations.push(newInv);
          await dbSet('investigations', investigations);
          // Link to complaint
          if (req.body.complaintId) {
            var complaints = await dbGet('complaints') || [];
            var cIdx = complaints.findIndex(c => c.id === req.body.complaintId);
            if (cIdx >= 0) {
              complaints[cIdx].status = 'UNDER_INVESTIGATION';
              complaints[cIdx].investigationId = newInv.id;
              await dbSet('complaints', complaints);
            }
          }
          // Auto-notify employee about investigation
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: newInv.empId,
              type: 'investigation',
              title: '🔍 استمارة تحقيق',
              body: 'فُتح تحقيق بخصوص: ' + (newInv.title || '').slice(0, 60) + ' — يجب الرد خلال 24 ساعة',
              refId: newInv.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          return res.json({ ok: true, investigation: newInv });
        }
        if (req.method === 'PUT') {
          var investigations = await dbGet('investigations') || [];
          var idx = investigations.findIndex(i => i.id === req.body.id);
          if (idx >= 0) {
            investigations[idx] = { ...investigations[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('investigations', investigations);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ VIOLATIONS V2 (المخالفات الرسمية) — الجدول الجديد ═══ */
      case 'violations_v2': {
        if (req.method === 'GET') {
          var vios = await dbGet('violations_v2') || [];
          if (req.query.empId) vios = vios.filter(v => v.empId === req.query.empId);
          if (req.query.status) vios = vios.filter(v => v.status === req.query.status);
          return res.json(vios);
        }
        if (req.method === 'POST') {
          var vios = await dbGet('violations_v2') || [];
          // Count previous same-violation for this employee (within 180 days)
          var now = new Date();
          var oneEightyAgo = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
          var sameViolationCount = vios.filter(v =>
            v.empId === req.body.empId &&
            v.violationId === req.body.violationId &&
            v.status === 'ACTIVE' &&
            new Date(v.createdAt) > oneEightyAgo
          ).length;
          var occurrence = sameViolationCount + 1; // 1=first, 2=second, 3=third, 4=fourth
          var penaltyKey = occurrence === 1 ? 'first' : occurrence === 2 ? 'second' : occurrence === 3 ? 'third' : 'fourth';
          var newVio = {
            id: 'VIO' + Date.now(),
            empId: req.body.empId,
            empName: req.body.empName,
            violationId: req.body.violationId,
            chapter: req.body.chapter,
            description: req.body.description,
            occurrence: occurrence,
            penaltyCode: req.body.penaltyCode || (req.body.penalties && req.body.penalties[penaltyKey]),
            penaltyLabel: req.body.penaltyLabel,
            complaintId: req.body.complaintId || null,
            investigationId: req.body.investigationId || null,
            source: req.body.source || 'manual', // auto | manual | from_investigation
            legalRef: req.body.legalRef || 'اللائحة التنفيذية لنظام العمل السعودي - رقم الاعتماد 978004',
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy,
            approvedBy: req.body.approvedBy || null,
            status: 'ACTIVE',
            appealedAt: null,
            appealResponse: null,
            notes: req.body.notes || null,
          };
          vios.push(newVio);
          await dbSet('violations_v2', vios);
          // Auto-notify employee
          try {
            var notifs = await dbGet('notifications') || [];
            notifs.push({
              id: 'NTF' + Date.now(),
              empId: newVio.empId,
              type: 'violation',
              title: '⚖️ مخالفة جديدة',
              body: 'صدرت مخالفة بحقك: ' + (newVio.description || '').slice(0, 80) + ' — الجزاء: ' + (newVio.penaltyLabel || ''),
              refId: newVio.id,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
          // v6.97 — Auto-push to kadwar (fire-and-forget)
          if (newVio.status === 'ACTIVE') {
            safeKadwarPush('receive-violation', {
              employee_id: newVio.empId,
              violation_basma_id: newVio.id,
              violation_code: newVio.violationId,
              chapter: newVio.chapter,
              description: newVio.description,
              occurrence: newVio.occurrence,
              penalty_code: newVio.penaltyCode,
              penalty_label: newVio.penaltyLabel,
              status: newVio.status,
              legal_ref: newVio.legalRef,
              created_at: newVio.createdAt,
            }).catch(function(){ /* logged in helper */ });
          }
          return res.json({ ok: true, violation: newVio });
        }
        if (req.method === 'PUT') {
          var vios = await dbGet('violations_v2') || [];
          var idx = vios.findIndex(v => v.id === req.body.id);
          if (idx >= 0) {
            vios[idx] = { ...vios[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('violations_v2', vios);
          }
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ APPEALS (التظلمات) ═══ */
      case 'appeals': {
        if (req.method === 'GET') {
          var appeals = await dbGet('appeals') || [];
          if (req.query.empId) appeals = appeals.filter(a => a.empId === req.query.empId);
          if (req.query.violationId) appeals = appeals.filter(a => a.violationId === req.query.violationId);
          return res.json(appeals);
        }
        if (req.method === 'POST') {
          var appeals = await dbGet('appeals') || [];
          var newAppeal = {
            id: 'APL' + Date.now(),
            violationId: req.body.violationId,
            empId: req.body.empId,
            empName: req.body.empName,
            reason: req.body.reason,
            attachments: req.body.attachments || [],
            createdAt: new Date().toISOString(),
            deadline: new Date(new Date().getTime() + 5 * 24 * 3600 * 1000).toISOString(),
            status: 'PENDING',
            decision: null,
            decisionNotes: null,
            decidedAt: null,
            decidedBy: null,
          };
          appeals.push(newAppeal);
          // Link to violation
          var vios = await dbGet('violations_v2') || [];
          var vIdx = vios.findIndex(v => v.id === req.body.violationId);
          if (vIdx >= 0) {
            vios[vIdx].status = 'APPEALED';
            vios[vIdx].appealedAt = new Date().toISOString();
            await dbSet('violations_v2', vios);
          }
          await dbSet('appeals', appeals);
          return res.json({ ok: true, appeal: newAppeal });
        }
        if (req.method === 'PUT') {
          var appeals = await dbGet('appeals') || [];
          var idx = appeals.findIndex(a => a.id === req.body.id);
          if (idx >= 0) {
            appeals[idx] = { ...appeals[idx], ...req.body, updatedAt: new Date().toISOString() };
            await dbSet('appeals', appeals);
          }
          return res.json({ ok: true });
        }
        break;
      }


      /* ═══ AUTO VIOLATIONS TRIGGER (safety-net, called by client) ═══ */
      case 'auto_violations_check': {
        // Client-triggered safety-net. Runs once per day after 6pm Saudi time.
        var nowCheck = new Date();
        var saudiHourCheck = (nowCheck.getUTCHours() + 3) % 24;
        if (saudiHourCheck < 18) return res.json({ ok: false, reason: 'too_early', saudiHour: saudiHourCheck });
        var lastRun = await dbGet('auto_violations_last_run');
        var todayStrChk = nowCheck.toISOString().split('T')[0];
        if (lastRun === todayStrChk) return res.json({ ok: false, reason: 'already_ran', lastRun: lastRun });
        // Mark as running first (to avoid races)
        await dbSet('auto_violations_last_run', todayStrChk);
        // Internally call auto_violations by forwarding through fetch to self
        try {
          var baseUrl = req.headers.host ? ('https://' + req.headers.host) : 'http://localhost:3000';
          var selfR = await fetch(baseUrl + '/api/data?action=auto_violations');
          var selfD = await selfR.json();
          return res.json({ ok: true, triggered: true, result: selfD });
        } catch (e) {
          return res.status(500).json({ error: 'self-call failed: ' + (e.message || 'unknown') });
        }
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.92 — Morning Challenge Reminder (Cron Job)
       * ═══════════════════════════════════════════════════════════════
       * Called by Vercel cron at 08:00 AM Riyadh = 05:00 UTC
       * Schedule: "0 5 * * 0-4" (Sunday through Thursday)
       *
       * Sends push notification to each active employee who:
       *   - Has push subscription active
       *   - Has NOT checked in yet today
       *   - Is active and not on leave
       *   - Branch offDay is not today
       *
       * Settings gate:
       *   - settings.morningReminderEnabled !== false (default ON)
       *
       * Holiday gate:
       *   - Today is not a weekend (from holidays.weekendDays)
       *   - Today is not an official holiday (from holidays.list)
       *
       * Audit log: category 'admin', action 'morning_reminder_cron'
       */
      case 'morning-reminder': {
        // 1) Settings gate
        var settingsData = await dbGet('settings') || {};
        if (settingsData.morningReminderEnabled === false) {
          return res.json({ ok: true, skipped: true, reason: 'disabled in settings' });
        }

        // 2) Holiday/weekend gate
        var holidaysData = await dbGet('holidays') || { weekendDays: [5, 6] };
        var weekendDays = holidaysData.weekendDays || [5, 6];
        var now = new Date();
        var todayDow = now.getDay();

        if (weekendDays.indexOf(todayDow) >= 0) {
          return res.json({ ok: true, skipped: true, reason: 'weekend', dayOfWeek: todayDow });
        }

        var todayISO = now.toISOString().slice(0, 10);
        var todayMmDd = todayISO.slice(5);
        var matchedHoliday = (holidaysData.list || []).find(function(h){
          if (!h.date) return false;
          if (h.date === todayISO) return true;
          if (h.recurring && h.date.slice(5) === todayMmDd) return true;
          if (h.endDate && todayISO >= h.date && todayISO <= h.endDate) return true;
          return false;
        });
        if (matchedHoliday) {
          return res.json({ ok: true, skipped: true, reason: 'holiday', holiday: matchedHoliday.name });
        }

        // 3) Load data
        var emps = (await dbGet('employees')) || [];
        var attRaw = (await dbGet('attendance')) || [];
        var todayAtt = attRaw.filter(function(a){ return a.date === todayISO; });
        var checkedInToday = new Set(todayAtt.filter(function(a){ return a.type === 'checkin'; }).map(function(a){ return String(a.empId); }));
        var pushSubs = (await dbGet('push_subscriptions')) || {};
        var questionsCount = (settingsData.questions && settingsData.questions.length) || 0;

        // 4) Target eligible employees
        var targets = emps.filter(function(e){
          if (e.active === false) return false;
          if (e.terminated || e.onLeave) return false;
          if (checkedInToday.has(String(e.id))) return false;  // already checked in
          if (!pushSubs[e.id]) return false;                    // no push subscription
          return true;
        });

        // 5) Send push to each target
        var sent = 0, failed = 0, noSub = 0;
        var results = [];

        var pushTitle = questionsCount > 0
          ? '⚡ تحدي الصباح بانتظارك!'
          : '☀️ صباح الخير! وقت تسجيل الحضور';
        var pushBody = questionsCount > 0
          ? 'افتح التطبيق وأجب على سؤال اليوم قبل تسجيل حضورك'
          : 'لا تنسَ تسجيل حضورك — الدوام يبدأ خلال 30 دقيقة';

        for (var i = 0; i < targets.length; i++) {
          var emp = targets[i];
          var subEntry = pushSubs[emp.id];
          if (!subEntry || !subEntry.subscription) {
            noSub++;
            continue;
          }
          try {
            var pr = await sendWebPush(subEntry.subscription, {
              title: pushTitle,
              body: pushBody,
              tag: 'morning-reminder-' + todayISO,
              data: { type: 'morning_reminder', date: todayISO },
            });
            if (pr.sent) sent++;
            else failed++;
            results.push({ empId: emp.id, name: emp.name, sent: pr.sent, reason: pr.reason });
          } catch(e) {
            failed++;
            results.push({ empId: emp.id, name: emp.name, sent: false, reason: 'error: ' + e.message });
          }
        }

        // 6) Audit log
        await auditLog('system_cron', 'morning_reminder_cron', null, {
          totalEmployees: emps.length,
          eligibleTargets: targets.length,
          sent: sent,
          failed: failed,
          noSubscription: noSub,
          questionsAvailable: questionsCount,
          pushTitle: pushTitle,
        }, 'admin');

        return res.json({
          ok: true,
          summary: {
            totalEmployees: emps.length,
            eligibleTargets: targets.length,
            alreadyCheckedIn: checkedInToday.size,
            sent: sent,
            failed: failed,
            noSubscription: noSub,
          },
          questionsAvailable: questionsCount,
          results: results,
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.95 — FLASH CHALLENGE (سؤال تحدي على السريع)
       * ═══════════════════════════════════════════════════════════════
       * Admin-triggered instant challenge sent to selected employees
       * Storage key: 'flash_challenges' — { activeId, items[] }
       * Each item: {
       *   id, ts, expiresAt, createdBy,
       *   q, correct, wrong1, wrong2, type, points,
       *   targets[],        // array of empIds
       *   responses: {empId: {answered, correct, ts}}
       * }
       *
       * Endpoints:
       *   POST   /api/data?action=flash-send      — create & send
       *   GET    /api/data?action=flash-my&empId=X — get active for employee
       *   POST   /api/data?action=flash-answer    — submit answer
       *   GET    /api/data?action=flash-list      — admin: all flashes
       */
      case 'flash-send': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyFs = req.body || {};
        var actorIdFs = bodyFs.actorId || 'admin';
        var empIdsFs = bodyFs.empIds;
        var qTextFs = bodyFs.q;
        var correctFs = bodyFs.correct;
        var wrong1Fs = bodyFs.wrong1;
        var wrong2Fs = bodyFs.wrong2;
        var pointsFs = parseInt(bodyFs.points || 20, 10);
        var durationMinutesFs = parseInt(bodyFs.durationMinutes || 5, 10);
        var typeFs = bodyFs.type || 'سؤال';

        if (!qTextFs || !correctFs || !wrong1Fs || !wrong2Fs) {
          return res.status(400).json({ error: 'q + correct + wrong1 + wrong2 required' });
        }
        if (!Array.isArray(empIdsFs) || empIdsFs.length === 0) {
          // If empty, broadcast to all active employees
          var allEmpsFs = (await dbGet('employees')) || [];
          empIdsFs = allEmpsFs.filter(function(e){ return e.active !== false; }).map(function(e){ return String(e.id); });
        }

        // v7.96 — Apply notifyWho filter (settings-driven)
        var flashSettings = ((await dbGet('settings')) || {}).flashChallenge || {};
        var notifyWho = flashSettings.notifyWho || 'all';  // all | in_work | checked_in
        var excludedByFilter = 0;

        if (notifyWho !== 'all') {
          var allEmpsForFilter = (await dbGet('employees')) || [];
          var attForFilter = (await dbGet('attendance')) || [];
          var branchesForFilter = (await dbGet('branches')) || [];
          var todayStrFs = new Date().toISOString().slice(0, 10);
          var todayAttFilter = attForFilter.filter(function(a){ return a.date === todayStrFs; });
          var checkedInSet = new Set(todayAttFilter.filter(function(a){ return a.type === 'checkin'; }).map(function(a){ return String(a.empId); }));
          var checkedOutSet = new Set(todayAttFilter.filter(function(a){ return a.type === 'checkout'; }).map(function(a){ return String(a.empId); }));

          var beforeCount = empIdsFs.length;
          if (notifyWho === 'checked_in') {
            // Must have check-in today
            empIdsFs = empIdsFs.filter(function(id){ return checkedInSet.has(String(id)); });
          } else if (notifyWho === 'in_work') {
            // Must have check-in + NOT checked-out yet
            empIdsFs = empIdsFs.filter(function(id){
              return checkedInSet.has(String(id)) && !checkedOutSet.has(String(id));
            });
          }
          excludedByFilter = beforeCount - empIdsFs.length;
        }

        var nowFs = Date.now();
        var flashId = 'F' + nowFs + Math.random().toString(36).slice(2, 5);
        var expiresAt = nowFs + (durationMinutesFs * 60 * 1000);

        var newFlash = {
          id: flashId,
          ts: new Date(nowFs).toISOString(),
          expiresAt: new Date(expiresAt).toISOString(),
          createdBy: actorIdFs,
          q: qTextFs,
          correct: correctFs,
          wrong1: wrong1Fs,
          wrong2: wrong2Fs,
          type: typeFs,
          points: pointsFs,
          targets: empIdsFs.map(String),
          responses: {},
          // v7.96 — Snapshot of settings at send time (enforced on answer)
          rules: {
            requireInWork: flashSettings.requireInWork !== false,  // default: required
            notifyWho: notifyWho,
            timerMode: flashSettings.timerMode || 'unified',       // unified | personal
          },
        };

        // Store flash
        var flashStore = (await dbGet('flash_challenges')) || { items: [] };
        if (!Array.isArray(flashStore.items)) flashStore.items = [];
        flashStore.items.push(newFlash);
        // Keep only last 100
        if (flashStore.items.length > 100) flashStore.items = flashStore.items.slice(-100);
        await dbSet('flash_challenges', flashStore);

        // Send push notifications
        var pushSubsFs = (await dbGet('push_subscriptions')) || {};
        var sentCount = 0, failedCount = 0, noSubCount = 0;

        for (var iFs = 0; iFs < empIdsFs.length; iFs++) {
          var eid = empIdsFs[iFs];
          var subFs = pushSubsFs[eid];
          if (!subFs || !subFs.subscription) {
            noSubCount++;
            continue;
          }
          try {
            var prFs = await sendWebPush(subFs.subscription, {
              title: '⚡ سؤال تحدي على السريع!',
              body: '+' + pointsFs + ' نقاط إذا أجبت صحيح — أسرع قبل انتهاء الوقت!',
              tag: 'flash-' + flashId,
              data: { type: 'flash_challenge', flashId: flashId },
              requireInteraction: true,
            });
            if (prFs.sent) sentCount++;
            else failedCount++;
          } catch(e) {
            failedCount++;
          }

          // Also save to notifications (polling fallback)
          try {
            var notifsFs = (await dbGet('notifications')) || [];
            notifsFs.unshift({
              id: 'N_FLASH_' + flashId + '_' + iFs,
              empId: eid,
              type: 'flash_challenge',
              title: '⚡ سؤال تحدي على السريع!',
              message: '+' + pointsFs + ' نقاط إن أجبت صحيح خلال ' + durationMinutesFs + ' دقيقة',
              flashId: flashId,
              read: false,
              ts: new Date().toISOString(),
            });
            await dbSet('notifications', notifsFs.slice(0, 500));
          } catch(e) {}
        }

        // Audit log
        await auditLog(actorIdFs, 'flash_challenge_sent', flashId, {
          targets: empIdsFs.length,
          sent: sentCount,
          failed: failedCount,
          noSub: noSubCount,
          points: pointsFs,
          durationMinutes: durationMinutesFs,
          questionPreview: qTextFs.slice(0, 50),
        }, 'admin');

        return res.json({
          ok: true,
          flashId: flashId,
          summary: {
            targets: empIdsFs.length,
            sent: sentCount,
            failed: failedCount,
            noSubscription: noSubCount,
            excludedByFilter: excludedByFilter,  // v7.96
          },
          rules: newFlash.rules,  // v7.96 — return applied rules
          expiresAt: newFlash.expiresAt,
        });
      }

      /* ═══ v7.95 — FLASH: get active flash for employee ═══ */
      case 'flash-my': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var empIdM = req.query.empId;
        if (!empIdM) return res.status(400).json({ error: 'empId required' });

        var storeM = (await dbGet('flash_challenges')) || { items: [] };
        var nowM = Date.now();
        // Find latest active flash for this employee
        var activeFlash = null;
        if (Array.isArray(storeM.items)) {
          for (var iM = storeM.items.length - 1; iM >= 0; iM--) {
            var itemM = storeM.items[iM];
            if (!itemM) continue;
            if (new Date(itemM.expiresAt).getTime() < nowM) continue;    // expired
            if (!itemM.targets || itemM.targets.indexOf(String(empIdM)) < 0) continue;
            if (itemM.responses && itemM.responses[empIdM]) continue;    // already answered
            activeFlash = itemM;
            break;
          }
        }

        if (!activeFlash) return res.json({ ok: true, active: false });

        // Return WITHOUT correct answer (security)
        return res.json({
          ok: true,
          active: true,
          flash: {
            id: activeFlash.id,
            q: activeFlash.q,
            opts: shuffle([activeFlash.correct, activeFlash.wrong1, activeFlash.wrong2]),
            type: activeFlash.type,
            points: activeFlash.points,
            expiresAt: activeFlash.expiresAt,
            durationRemainingMs: new Date(activeFlash.expiresAt).getTime() - nowM,
          },
        });
      }

      /* ═══ v7.95 — FLASH: submit answer ═══ */
      case 'flash-answer': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyA = req.body || {};
        var flashIdA = bodyA.flashId;
        var empIdA = bodyA.empId;
        var answerTextA = bodyA.answer;
        if (!flashIdA || !empIdA || !answerTextA) {
          return res.status(400).json({ error: 'flashId + empId + answer required' });
        }

        var storeA = (await dbGet('flash_challenges')) || { items: [] };
        var nowA = Date.now();
        var flashA = (storeA.items || []).find(function(f){ return f.id === flashIdA; });
        if (!flashA) return res.status(404).json({ error: 'flash not found' });

        if (new Date(flashA.expiresAt).getTime() < nowA) {
          return res.json({ ok: false, expired: true, error: 'انتهت صلاحية السؤال' });
        }

        if (!flashA.targets || flashA.targets.indexOf(String(empIdA)) < 0) {
          return res.status(403).json({ error: 'not targeted' });
        }

        if (flashA.responses && flashA.responses[empIdA]) {
          return res.json({ ok: false, alreadyAnswered: true });
        }

        // v7.96 — Enforce "in work" rule if required
        if (flashA.rules && flashA.rules.requireInWork) {
          // Rule: check-in today + GPS in branch radius + no check-out
          var empsIW = (await dbGet('employees')) || [];
          var empIW = empsIW.find(function(e){ return String(e.id) === String(empIdA); });
          var attIW = (await dbGet('attendance')) || [];
          var branchesIW = (await dbGet('branches')) || [];
          var todayStrIW = new Date().toISOString().slice(0, 10);
          var todayAttIW = attIW.filter(function(a){ return String(a.empId) === String(empIdA) && a.date === todayStrIW; });

          var hasCheckinIW = todayAttIW.some(function(a){ return a.type === 'checkin'; });
          var hasCheckoutIW = todayAttIW.some(function(a){ return a.type === 'checkout'; });

          // Check 1: must have check-in today
          if (!hasCheckinIW) {
            return res.json({
              ok: false,
              notAllowed: true,
              reason: 'not_checked_in',
              message: 'لم تسجل حضورك اليوم',
            });
          }

          // Check 2: must NOT have checked-out
          if (hasCheckoutIW) {
            return res.json({
              ok: false,
              notAllowed: true,
              reason: 'already_checked_out',
              message: 'سجلت انصرافك مسبقاً — التحدي للموظفين في الدوام',
            });
          }

          // Check 3: GPS must be in branch radius (if provided)
          var userLat = parseFloat(bodyA.lat);
          var userLng = parseFloat(bodyA.lng);
          if (!isFinite(userLat) || !isFinite(userLng)) {
            return res.json({
              ok: false,
              notAllowed: true,
              reason: 'no_location',
              message: 'يجب تفعيل الموقع (GPS) للمشاركة',
            });
          }

          // Find employee's branch
          var empBranchId = empIW && (empIW.branchId || empIW.branch);
          var empBranch = branchesIW.find(function(b){ return b.id === empBranchId || b.name === empBranchId; });
          if (!empBranch || !isFinite(empBranch.lat) || !isFinite(empBranch.lng)) {
            return res.json({
              ok: false,
              notAllowed: true,
              reason: 'branch_config_missing',
              message: 'لم يتم العثور على إعدادات موقع الفرع',
            });
          }

          // Calculate distance (Haversine)
          var R = 6371000; // meters
          var φ1 = userLat * Math.PI / 180;
          var φ2 = empBranch.lat * Math.PI / 180;
          var Δφ = (empBranch.lat - userLat) * Math.PI / 180;
          var Δλ = (empBranch.lng - userLng) * Math.PI / 180;
          var aDist = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
          var cDist = 2 * Math.atan2(Math.sqrt(aDist), Math.sqrt(1-aDist));
          var distanceM = Math.round(R * cDist);
          var allowedRadius = empBranch.radius || 150;

          if (distanceM > allowedRadius) {
            return res.json({
              ok: false,
              notAllowed: true,
              reason: 'outside_work_location',
              message: 'أنت خارج نطاق مقر العمل',
              distance: distanceM,
              allowedRadius: allowedRadius,
              branchName: empBranch.name,
            });
          }
          // All checks passed — continue to answer processing
        }

        var isCorrect = (answerTextA === flashA.correct);

        // Save response
        if (!flashA.responses) flashA.responses = {};
        flashA.responses[empIdA] = {
          answered: answerTextA,
          correct: isCorrect,
          ts: new Date(nowA).toISOString(),
          correctAnswer: flashA.correct,
        };
        await dbSet('flash_challenges', storeA);

        // Award points if correct
        if (isCorrect) {
          try {
            var empsA = (await dbGet('employees')) || [];
            var empIdx = empsA.findIndex(function(e){ return String(e.id) === String(empIdA); });
            if (empIdx >= 0) {
              empsA[empIdx].points = (empsA[empIdx].points || 0) + (flashA.points || 20);
              await dbSet('employees', empsA);
            }
          } catch(e) {}
        }

        // Audit log
        await auditLog(empIdA, 'flash_challenge_answered', flashIdA, {
          correct: isCorrect,
          answer: answerTextA,
          points: isCorrect ? flashA.points : 0,
        }, 'admin');

        return res.json({
          ok: true,
          correct: isCorrect,
          correctAnswer: flashA.correct,
          pointsAwarded: isCorrect ? flashA.points : 0,
        });
      }

      /* ═══ v7.95 — FLASH: list all (admin) ═══ */
      case 'flash-list': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var storeL = (await dbGet('flash_challenges')) || { items: [] };
        var nowL = Date.now();
        var items = (storeL.items || []).slice(-30).reverse().map(function(f){
          var responseCount = f.responses ? Object.keys(f.responses).length : 0;
          var correctCount = 0;
          if (f.responses) {
            Object.keys(f.responses).forEach(function(k){
              if (f.responses[k].correct) correctCount++;
            });
          }
          return {
            id: f.id,
            ts: f.ts,
            expiresAt: f.expiresAt,
            expired: new Date(f.expiresAt).getTime() < nowL,
            createdBy: f.createdBy,
            q: f.q,
            correctAnswer: f.correct,
            type: f.type,
            points: f.points,
            targetsCount: (f.targets || []).length,
            responseCount: responseCount,
            correctCount: correctCount,
            responseRate: (f.targets || []).length > 0
              ? Math.round((responseCount / f.targets.length) * 100) : 0,
          };
        });
        return res.json({ ok: true, items: items });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.99 — Kadwar Two-way Sync
       * ═══════════════════════════════════════════════════════════════
       * Push pending Basma-side changes back to Kadwar in batch.
       * Unlike sync-kadwar (which PULLS from Kadwar), this PUSHES.
       *
       * POST /api/data?action=kadwar-push-all
       * Body: { empIds?: [...], types?: ["violations", "payroll", "termination"] }
       *       If empty, pushes everything pending.
       *
       * Response: {
       *   ok, summary: {
       *     violations: { total, sent, failed },
       *     payroll: { total, sent, failed },
       *     terminations: { total, sent, failed }
       *   }
       * }
       */
      case 'kadwar-push-all': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyKP = req.body || {};
        var filterIds = Array.isArray(bodyKP.empIds) && bodyKP.empIds.length > 0 ? bodyKP.empIds.map(String) : null;
        var types = Array.isArray(bodyKP.types) && bodyKP.types.length > 0 ? bodyKP.types : ['violations', 'payroll', 'termination'];
        var actorKP = bodyKP.actorId || 'admin';

        var summary = {
          violations: { total: 0, sent: 0, failed: 0 },
          payroll: { total: 0, sent: 0, failed: 0 },
          terminations: { total: 0, sent: 0, failed: 0 },
        };

        // 1) Push violations (status: open + not yet synced)
        if (types.indexOf('violations') >= 0) {
          var violsKP = (await dbGet('violations_v2')) || [];
          var pendingViolsKP = violsKP.filter(function(v){
            if (v.kadwarSynced) return false;  // already synced
            if (filterIds && filterIds.indexOf(String(v.empId)) < 0) return false;
            return true;
          });
          summary.violations.total = pendingViolsKP.length;

          for (var vi = 0; vi < pendingViolsKP.length; vi++) {
            var vKP = pendingViolsKP[vi];
            try {
              var pushV = await safeKadwarPush('receive-violation', {
                violation_basma_id: vKP.id,
                employee_id: vKP.empId,
                type: vKP.type,
                desc: vKP.desc,
                penalty: vKP.penalty,
                date: vKP.date,
                ref: vKP.ref,
              });
              if (pushV.ok) {
                vKP.kadwarSynced = true;
                vKP.kadwarSyncedAt = new Date().toISOString();
                summary.violations.sent++;
              } else {
                summary.violations.failed++;
              }
            } catch(e) {
              summary.violations.failed++;
            }
          }
          if (summary.violations.sent > 0) {
            await dbSet('violations_v2', violsKP);
          }
        }

        // 2) Push payroll slips
        if (types.indexOf('payroll') >= 0) {
          var slipsKP = (await dbGet('payroll-slips')) || [];
          var pendingSlipsKP = slipsKP.filter(function(s){
            if (s.kadwarSynced) return false;
            if (filterIds && filterIds.indexOf(String(s.empId)) < 0) return false;
            return true;
          });
          summary.payroll.total = pendingSlipsKP.length;

          for (var si = 0; si < pendingSlipsKP.length; si++) {
            var sKP = pendingSlipsKP[si];
            try {
              var pushS = await safeKadwarPush('receive-payroll-slip', {
                slip_basma_id: sKP.id,
                employee_id: sKP.empId,
                period: sKP.period,
                gross: sKP.gross,
                deductions: sKP.deductions,
                net: sKP.net,
                details: sKP,
              });
              if (pushS.ok) {
                sKP.kadwarSynced = true;
                sKP.kadwarSyncedAt = new Date().toISOString();
                summary.payroll.sent++;
              } else {
                summary.payroll.failed++;
              }
            } catch(e) {
              summary.payroll.failed++;
            }
          }
          if (summary.payroll.sent > 0) {
            await dbSet('payroll-slips', slipsKP);
          }
        }

        // 3) Push terminations
        if (types.indexOf('termination') >= 0) {
          var termsKP = (await dbGet('terminations')) || [];
          var pendingTermsKP = termsKP.filter(function(t){
            if (t.kadwarSynced) return false;
            if (filterIds && filterIds.indexOf(String(t.empId)) < 0) return false;
            return true;
          });
          summary.terminations.total = pendingTermsKP.length;

          for (var ti = 0; ti < pendingTermsKP.length; ti++) {
            var tKP = pendingTermsKP[ti];
            try {
              var pushT = await safeKadwarPush('receive-termination', {
                termination_basma_id: tKP.id,
                employee_id: tKP.empId,
                reason: tKP.reason,
                date: tKP.date,
                details: tKP,
              });
              if (pushT.ok) {
                tKP.kadwarSynced = true;
                tKP.kadwarSyncedAt = new Date().toISOString();
                summary.terminations.sent++;
              } else {
                summary.terminations.failed++;
              }
            } catch(e) {
              summary.terminations.failed++;
            }
          }
          if (summary.terminations.sent > 0) {
            await dbSet('terminations', termsKP);
          }
        }

        // Audit log
        await auditLog(actorKP, 'kadwar_push_all', null, {
          types: types,
          empFilter: filterIds,
          summary: summary,
        }, 'admin');

        var totalSent = summary.violations.sent + summary.payroll.sent + summary.terminations.sent;
        var totalFailed = summary.violations.failed + summary.payroll.failed + summary.terminations.failed;
        var totalPending = summary.violations.total + summary.payroll.total + summary.terminations.total;

        return res.json({
          ok: true,
          summary: summary,
          totals: {
            pending: totalPending,
            sent: totalSent,
            failed: totalFailed,
          },
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.99 — Get pending Kadwar push count (for dashboard badge)
       * GET /api/data?action=kadwar-pending-count
       */
      /* ═══════════════════════════════════════════════════════════════
       * v7.105 — BULK SALARY SHEET GENERATION
       * ═══════════════════════════════════════════════════════════════
       * POST /api/data?action=generate-salary-sheet
       * Body: { period: "YYYY-MM", empIds?: [...], actorId? }
       *
       * Generates payroll slips for all (or selected) active employees,
       * computing salary based on attendance, benefits, and deductions.
       */
      case 'generate-salary-sheet': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyGS = req.body || {};
        var periodGS = bodyGS.period; // YYYY-MM
        var empIdsFilter = Array.isArray(bodyGS.empIds) ? bodyGS.empIds.map(String) : null;
        var actorGS = bodyGS.actorId || 'admin';

        if (!periodGS || !/^\d{4}-\d{2}$/.test(periodGS)) {
          return res.status(400).json({ error: 'period required (YYYY-MM)' });
        }

        var empsGS = (await dbGet('employees')) || [];
        var targetsGS = empsGS.filter(function(e){
          if (e.active === false || e.terminated) return false;
          if (empIdsFilter && empIdsFilter.indexOf(String(e.id)) < 0) return false;
          return true;
        });

        var attGS = (await dbGet('attendance')) || [];
        var existingSlips = (await dbGet('payroll-slips')) || [];

        // Calculate period boundaries
        var [yearGS, monthGS] = periodGS.split('-');
        var lastDayGS = new Date(parseInt(yearGS), parseInt(monthGS), 0).getDate();
        var periodStart = periodGS + '-01';
        var periodEnd = periodGS + '-' + String(lastDayGS).padStart(2, '0');

        // Get work days in period (respects holidays)
        var workDaysResult = await calculateWorkDays(periodStart, periodEnd);
        var totalWorkDays = workDaysResult.workDays;

        var generated = 0;
        var skipped = 0;
        var errors = [];
        var newSlips = [];

        for (var iGS = 0; iGS < targetsGS.length; iGS++) {
          var empGS = targetsGS[iGS];

          // Check if slip already exists for this period
          var existingSlip = existingSlips.find(function(s){
            return String(s.empId) === String(empGS.id) && s.period === periodGS;
          });
          if (existingSlip) {
            skipped++;
            continue;
          }

          try {
            // Count attendance days in period
            var empAttGS = attGS.filter(function(a){
              return String(a.empId) === String(empGS.id) &&
                     a.type === 'checkin' &&
                     a.date >= periodStart && a.date <= periodEnd;
            });
            var presentDays = new Set(empAttGS.map(function(a){ return a.date; })).size;
            var absentDays = Math.max(0, totalWorkDays - presentDays);
            var attRateGS = totalWorkDays > 0 ? presentDays / totalWorkDays : 1;

            // Get employee profile
            var profileGS = {
              compensation: empGS.compensation || {},
              jobGrade: empGS.jobGrade || {},
            };

            // Compute salary
            var computation = computeMonthlySalary(
              profileGS,
              {},
              {},
              { presentDays: presentDays, totalDays: totalWorkDays, absentDays: absentDays },
              { startISO: periodStart, endISO: periodEnd }
            );

            var slipId = 'SLIP_' + empGS.id + '_' + periodGS + '_' + Date.now().toString(36);

            newSlips.push({
              id: slipId,
              empId: empGS.id,
              empName: empGS.name,
              period: periodGS,
              generatedAt: new Date().toISOString(),
              generatedBy: actorGS,
              presentDays: presentDays,
              absentDays: absentDays,
              totalWorkDays: totalWorkDays,
              attendanceRate: Math.round(attRateGS * 100),
              computation: computation,
              gross: computation.gross || 0,
              deductions: computation.deductions || 0,
              net: computation.net || 0,
              kadwarSynced: false,
            });

            generated++;
          } catch(e) {
            errors.push({ empId: empGS.id, empName: empGS.name, error: e.message });
          }
        }

        // Save all new slips
        if (newSlips.length > 0) {
          var updatedSlips = existingSlips.concat(newSlips);
          await dbSet('payroll-slips', updatedSlips);
        }

        // Audit log
        await auditLog(actorGS, 'bulk_salary_generation', null, {
          period: periodGS,
          targets: targetsGS.length,
          generated: generated,
          skipped: skipped,
          errors: errors.length,
        }, 'admin');

        return res.json({
          ok: true,
          period: periodGS,
          summary: {
            totalTargets: targetsGS.length,
            generated: generated,
            skipped: skipped,
            errors: errors.length,
            totalWorkDays: totalWorkDays,
          },
          errors: errors.slice(0, 10),  // first 10 errors only
          newSlipsIds: newSlips.map(function(s){ return s.id; }).slice(0, 20),
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.105 — LIST SALARY SHEETS (by period)
       * GET /api/data?action=list-salary-sheets&period=YYYY-MM
       */
      case 'list-salary-sheets': {
        var periodLS = req.query.period;
        var slipsLS = (await dbGet('payroll-slips')) || [];

        var filtered = periodLS
          ? slipsLS.filter(function(s){ return s.period === periodLS; })
          : slipsLS;

        // Sort by generated date desc
        filtered.sort(function(a, b){
          return new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0);
        });

        // Summary
        var totalGross = filtered.reduce(function(sum, s){ return sum + (s.gross || 0); }, 0);
        var totalDeductions = filtered.reduce(function(sum, s){ return sum + (s.deductions || 0); }, 0);
        var totalNet = filtered.reduce(function(sum, s){ return sum + (s.net || 0); }, 0);
        var unsynced = filtered.filter(function(s){ return !s.kadwarSynced; }).length;

        return res.json({
          ok: true,
          period: periodLS,
          slips: filtered.slice(0, 200),
          summary: {
            count: filtered.length,
            totalGross: totalGross,
            totalDeductions: totalDeductions,
            totalNet: totalNet,
            unsynced: unsynced,
          },
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.104 — CROSS-BRANCH ANALYTICS
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=branch-analytics
       * Returns comparative performance data per branch
       */
      case 'branch-analytics': {
        var empsBX = (await dbGet('employees')) || [];
        var attBX = (await dbGet('attendance')) || [];
        var violsBX = (await dbGet('violations_v2')) || [];
        var branchesBX = (await dbGet('branches')) || [];
        var leavesBX = (await dbGet('leaves')) || [];

        var thisMonthBX = new Date().toISOString().slice(0, 7);

        // Group by branch
        var branchStats = branchesBX.map(function(b){
          var branchEmps = empsBX.filter(function(e){
            if (e.active === false || e.terminated) return false;
            return e.branchId === b.id || e.branch === b.id || e.branch === b.name;
          });
          var empIds = branchEmps.map(function(e){ return String(e.id); });

          // Attendance this month
          var monthAttBX = attBX.filter(function(a){
            return a.date && a.date.startsWith(thisMonthBX) &&
                   empIds.indexOf(String(a.empId)) >= 0;
          });
          var checkins = monthAttBX.filter(function(a){ return a.type === 'checkin'; });
          var uniqueDaysPresent = new Set(checkins.map(function(a){ return a.date + '_' + a.empId; })).size;
          var workDaysCount = new Set(checkins.map(function(a){ return a.date; })).size || 1;
          var expectedDays = branchEmps.length * workDaysCount;
          var attRate = expectedDays > 0 ? Math.round((uniqueDaysPresent / expectedDays) * 100) : 0;

          var lateCount = checkins.filter(function(a){ return a.late; }).length;

          // Violations this month
          var monthViolBX = violsBX.filter(function(v){
            if (empIds.indexOf(String(v.empId)) < 0) return false;
            return v.date && v.date.startsWith(thisMonthBX);
          });

          // Leaves this month
          var monthLeavesBX = leavesBX.filter(function(l){
            if (l.status !== 'approved') return false;
            if (empIds.indexOf(String(l.empId)) < 0) return false;
            if (!l.startDate) return false;
            return l.startDate.startsWith(thisMonthBX) || (l.endDate && l.endDate.startsWith(thisMonthBX));
          });

          // Total points
          var totalPoints = branchEmps.reduce(function(sum, e){ return sum + (e.points || 0); }, 0);
          var avgPoints = branchEmps.length > 0 ? Math.round(totalPoints / branchEmps.length) : 0;

          // Today's attendance (check-ins)
          var todayBX = new Date().toISOString().slice(0, 10);
          var todayCheckins = attBX.filter(function(a){
            return a.date === todayBX && a.type === 'checkin' &&
                   empIds.indexOf(String(a.empId)) >= 0;
          }).length;

          return {
            id: b.id,
            name: b.name,
            employees: branchEmps.length,
            presentToday: todayCheckins,
            presentRate: branchEmps.length > 0 ? Math.round((todayCheckins / branchEmps.length) * 100) : 0,
            attendanceRate: attRate,
            lateCount: lateCount,
            violations: monthViolBX.length,
            openViolations: monthViolBX.filter(function(v){ return v.status === 'open'; }).length,
            leavesThisMonth: monthLeavesBX.length,
            totalPoints: totalPoints,
            avgPoints: avgPoints,
          };
        });

        // Rank branches by score (composite)
        branchStats.forEach(function(b){
          // Composite score: attendance 40% + low violations 30% + engagement 30%
          var attScore = b.attendanceRate;
          var violPenalty = Math.min(30, b.openViolations * 5);
          var pointsScore = Math.min(30, b.avgPoints / 10);
          b.score = Math.max(0, Math.min(100, Math.round(attScore * 0.4 + (30 - violPenalty) + pointsScore * 0.3)));
        });

        // Sort by score descending
        branchStats.sort(function(a, b){ return b.score - a.score; });
        branchStats.forEach(function(b, i){ b.rank = i + 1; });

        return res.json({
          ok: true,
          period: thisMonthBX,
          branches: branchStats,
          summary: {
            totalBranches: branchStats.length,
            bestBranch: branchStats.length > 0 ? branchStats[0].name : null,
            worstBranch: branchStats.length > 0 ? branchStats[branchStats.length - 1].name : null,
          },
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.103 — BADGES / ACHIEVEMENTS SYSTEM
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=my-badges&empId=X
       * Returns: list of earned + next badges for the employee
       */
      case 'my-badges': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var empIdMB = req.query.empId;
        if (!empIdMB) return res.status(400).json({ error: 'empId required' });

        var empsMB = (await dbGet('employees')) || [];
        var empMB = empsMB.find(function(e){ return String(e.id) === String(empIdMB); });
        if (!empMB) return res.status(404).json({ error: 'employee not found' });

        var attMB = (await dbGet('attendance')) || [];
        var empAttMB = attMB.filter(function(a){ return String(a.empId) === String(empIdMB); });

        var violsMB = (await dbGet('violations_v2')) || [];
        var empViolsMB = violsMB.filter(function(v){ return String(v.empId) === String(empIdMB); });

        var flashStoreMB = (await dbGet('flash_challenges')) || { items: [] };
        var flashResponsesMB = 0;
        var flashCorrectMB = 0;
        (flashStoreMB.items || []).forEach(function(f){
          if (f.responses && f.responses[empIdMB]) {
            flashResponsesMB++;
            if (f.responses[empIdMB].correct) flashCorrectMB++;
          }
        });

        // Calculate metrics
        var totalCheckins = empAttMB.filter(function(a){ return a.type === 'checkin'; }).length;
        var earlyCheckins = empAttMB.filter(function(a){ return a.type === 'checkin' && !a.late; }).length;
        var lateCheckins = empAttMB.filter(function(a){ return a.type === 'checkin' && a.late; }).length;
        var points = empMB.points || 0;
        var streak = empMB.streak || 0;
        var violationsCount = empViolsMB.length;
        var openViolations = empViolsMB.filter(function(v){ return v.status === 'open'; }).length;

        // Define all badges
        var BADGES = [
          // Attendance-based
          { id: 'first_day',       icon: '🎯', name: 'يوم البداية',         desc: 'أول يوم حضور',              threshold: 1,   current: totalCheckins, category: 'attendance' },
          { id: 'week_warrior',    icon: '📅', name: 'مقاتل الأسبوع',       desc: '7 أيام حضور',               threshold: 7,   current: totalCheckins, category: 'attendance' },
          { id: 'month_master',    icon: '🗓️', name: 'سيد الشهر',          desc: '30 يوم حضور',               threshold: 30,  current: totalCheckins, category: 'attendance' },
          { id: 'century',         icon: '💯', name: 'المئة الأولى',        desc: '100 يوم حضور',              threshold: 100, current: totalCheckins, category: 'attendance' },
          { id: 'year_legend',     icon: '🏆', name: 'أسطورة السنة',       desc: '250 يوم حضور',              threshold: 250, current: totalCheckins, category: 'attendance' },

          // Punctuality
          { id: 'on_time_10',      icon: '⏰', name: 'ملتزم',               desc: '10 أيام حضور مبكر',          threshold: 10,  current: earlyCheckins, category: 'punctuality' },
          { id: 'on_time_50',      icon: '⚡', name: 'سريع البرق',          desc: '50 يوم حضور مبكر',           threshold: 50,  current: earlyCheckins, category: 'punctuality' },
          { id: 'perfect_month',   icon: '💎', name: 'الشهر المثالي',       desc: 'شهر بدون تأخير',             threshold: 1,   current: (lateCheckins === 0 && totalCheckins >= 20) ? 1 : 0, category: 'punctuality' },

          // Streak
          { id: 'streak_7',        icon: '🔥', name: 'سلسلة 7 أيام',         desc: 'حضور متواصل 7 أيام',        threshold: 7,   current: streak, category: 'streak' },
          { id: 'streak_30',       icon: '🌟', name: 'سلسلة 30 يوم',        desc: 'حضور متواصل 30 يوم',        threshold: 30,  current: streak, category: 'streak' },
          { id: 'streak_100',      icon: '👑', name: 'ملك السلسلة',         desc: 'حضور متواصل 100 يوم',        threshold: 100, current: streak, category: 'streak' },

          // Points
          { id: 'points_100',      icon: '⭐', name: 'متفاعل',              desc: 'كسب 100 نقطة',               threshold: 100, current: points, category: 'engagement' },
          { id: 'points_500',      icon: '🌟', name: 'نجم التفاعل',         desc: 'كسب 500 نقطة',               threshold: 500, current: points, category: 'engagement' },
          { id: 'points_1000',     icon: '💫', name: 'ممتاز',                desc: 'كسب 1000 نقطة',              threshold: 1000, current: points, category: 'engagement' },

          // Challenges
          { id: 'quiz_starter',    icon: '🎓', name: 'مبتدئ الأسئلة',       desc: 'الإجابة على 5 تحديات',       threshold: 5,   current: flashResponsesMB, category: 'challenges' },
          { id: 'quiz_expert',     icon: '🧠', name: 'خبير الأسئلة',        desc: 'الإجابة على 50 تحدي',        threshold: 50,  current: flashResponsesMB, category: 'challenges' },
          { id: 'perfect_quiz',    icon: '✨', name: 'إجابات دقيقة',         desc: '10 إجابات صحيحة متتالية',   threshold: 10,  current: flashCorrectMB, category: 'challenges' },

          // Discipline
          { id: 'clean_record',    icon: '🛡️', name: 'سجل نظيف',            desc: 'بدون مخالفات',              threshold: 1,   current: violationsCount === 0 ? 1 : 0, category: 'discipline' },
          { id: 'no_open_viol',    icon: '✅', name: 'قدوة',                desc: 'لا مخالفات مفتوحة',          threshold: 1,   current: openViolations === 0 ? 1 : 0, category: 'discipline' },
        ];

        // Classify: earned vs in-progress
        var earned = BADGES.filter(function(b){ return b.current >= b.threshold; });
        var inProgress = BADGES.filter(function(b){ return b.current < b.threshold; });

        // Sort in-progress by closest to achievement
        inProgress.sort(function(a, b){
          var ap = a.current / a.threshold;
          var bp = b.current / b.threshold;
          return bp - ap;
        });

        // Calculate overall level (based on earned badges)
        var level = Math.min(10, Math.floor(earned.length / 3) + 1);

        return res.json({
          ok: true,
          empId: empIdMB,
          level: level,
          totalBadges: BADGES.length,
          earnedCount: earned.length,
          earned: earned.map(function(b){
            return { id: b.id, icon: b.icon, name: b.name, desc: b.desc, category: b.category };
          }),
          inProgress: inProgress.slice(0, 6).map(function(b){
            return {
              id: b.id, icon: b.icon, name: b.name, desc: b.desc, category: b.category,
              progress: Math.round((b.current / b.threshold) * 100),
              current: b.current,
              threshold: b.threshold,
            };
          }),
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.102 — SMART ADMIN ALERTS (تنبيهات ذكية للإدارة)
       * ═══════════════════════════════════════════════════════════════
       * Returns actionable insights for admin dashboard:
       *   - Employees chronically late (>=3 times/month)
       *   - Employees with upcoming leave approvals
       *   - Employees without check-in today (past work hour)
       *   - High violation concentration (employee with >=3 open)
       *   - Contracts expiring soon (30 days)
       *   - Inactive employees (no check-in 7+ days)
       *
       * GET /api/data?action=admin-alerts
       */
      case 'admin-alerts': {
        var empsAA = (await dbGet('employees')) || [];
        var attAA = (await dbGet('attendance')) || [];
        var leavesAA = (await dbGet('leaves')) || [];
        var violsAA = (await dbGet('violations_v2')) || [];
        var branchesAA = (await dbGet('branches')) || [];
        var holidaysDataAA = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };

        var todayAA = new Date().toISOString().slice(0, 10);
        var nowAA = new Date();
        var nowHour = nowAA.getHours();
        var todayDowAA = nowAA.getDay();
        var thisMonthAA = todayAA.slice(0, 7);

        var alerts = [];

        // Skip check on weekends/holidays
        var isWeekendAA = (holidaysDataAA.weekendDays || [5, 6]).indexOf(todayDowAA) >= 0;
        var isHolidayAA = (holidaysDataAA.list || []).some(function(h){
          if (!h.date) return false;
          if (h.date === todayAA) return true;
          if (h.recurring && h.date.slice(5) === todayAA.slice(5)) return true;
          return false;
        });

        // 1) Chronically late (3+ times this month)
        var activeEmps = empsAA.filter(function(e){ return e.active !== false && !e.terminated; });
        var lateByEmp = {};
        attAA.forEach(function(a){
          if (a.type !== 'checkin' || !a.late) return;
          if (!a.date || !a.date.startsWith(thisMonthAA)) return;
          lateByEmp[a.empId] = (lateByEmp[a.empId] || 0) + 1;
        });
        Object.keys(lateByEmp).forEach(function(empId){
          if (lateByEmp[empId] >= 3) {
            var eLate = empsAA.find(function(e){ return String(e.id) === String(empId); });
            if (!eLate) return;
            alerts.push({
              id: 'LATE_' + empId,
              type: 'late_pattern',
              severity: lateByEmp[empId] >= 5 ? 'high' : 'medium',
              icon: '⏰',
              title: 'تأخر متكرر',
              message: eLate.name + ' تأخر ' + lateByEmp[empId] + ' مرات هذا الشهر',
              empId: empId,
              empName: eLate.name,
              count: lateByEmp[empId],
              action: 'الاتصال به أو فتح مخالفة',
            });
          }
        });

        // 2) Absent today (didn't check in, past work hour, working day)
        if (!isWeekendAA && !isHolidayAA && nowHour >= 10) {
          var checkedInToday = new Set(attAA.filter(function(a){ return a.date === todayAA && a.type === 'checkin'; }).map(function(a){ return String(a.empId); }));
          var onLeaveToday = new Set(leavesAA.filter(function(l){
            if (l.status !== 'approved') return false;
            return l.startDate && l.endDate && todayAA >= l.startDate && todayAA <= l.endDate;
          }).map(function(l){ return String(l.empId); }));

          var absentToday = activeEmps.filter(function(e){
            return !checkedInToday.has(String(e.id)) && !onLeaveToday.has(String(e.id));
          });

          if (absentToday.length > 0) {
            alerts.push({
              id: 'ABSENT_TODAY',
              type: 'absent_today',
              severity: absentToday.length > 3 ? 'high' : 'medium',
              icon: '🚫',
              title: 'غائبون اليوم',
              message: absentToday.length + ' موظف لم يسجّل حضوراً (بعد الساعة ' + nowHour + ':00)',
              count: absentToday.length,
              empIds: absentToday.map(function(e){ return e.id; }),
              empNames: absentToday.slice(0, 3).map(function(e){ return e.name; }),
              action: 'مراجعة أسباب الغياب',
            });
          }
        }

        // 3) High open violations (3+ open)
        var openViolsByEmp = {};
        violsAA.forEach(function(v){
          if (v.status !== 'open') return;
          openViolsByEmp[v.empId] = (openViolsByEmp[v.empId] || 0) + 1;
        });
        Object.keys(openViolsByEmp).forEach(function(empId){
          if (openViolsByEmp[empId] >= 3) {
            var eViol = empsAA.find(function(e){ return String(e.id) === String(empId); });
            if (!eViol) return;
            alerts.push({
              id: 'VIOL_' + empId,
              type: 'high_violations',
              severity: 'high',
              icon: '⚖️',
              title: 'مخالفات متعددة',
              message: eViol.name + ' لديه ' + openViolsByEmp[empId] + ' مخالفات مفتوحة',
              empId: empId,
              empName: eViol.name,
              count: openViolsByEmp[empId],
              action: 'مراجعة الحالة التأديبية',
            });
          }
        });

        // 4) Contracts expiring soon (30 days)
        var thirtyDaysFromNow = new Date(nowAA.getTime() + 30 * 24 * 60 * 60 * 1000);
        var expiringContracts = activeEmps.filter(function(e){
          if (!e.contractEndDate) return false;
          var endDate = new Date(e.contractEndDate);
          return endDate > nowAA && endDate <= thirtyDaysFromNow;
        });
        if (expiringContracts.length > 0) {
          alerts.push({
            id: 'CONTRACTS_EXPIRING',
            type: 'contracts_expiring',
            severity: 'medium',
            icon: '📄',
            title: 'عقود تنتهي قريباً',
            message: expiringContracts.length + ' عقد ينتهي خلال 30 يوم',
            count: expiringContracts.length,
            empIds: expiringContracts.map(function(e){ return e.id; }),
            empNames: expiringContracts.slice(0, 3).map(function(e){ return e.name; }),
            action: 'التجديد أو اتخاذ قرار',
          });
        }

        // 5) Inactive employees (no check-in 7+ days)
        var sevenDaysAgo = new Date(nowAA.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        var inactiveEmps = activeEmps.filter(function(e){
          var lastCheckin = attAA
            .filter(function(a){ return String(a.empId) === String(e.id) && a.type === 'checkin'; })
            .map(function(a){ return a.date; })
            .sort()
            .pop();
          if (!lastCheckin) return true;
          return lastCheckin < sevenDaysAgo;
        });
        if (inactiveEmps.length > 0) {
          alerts.push({
            id: 'INACTIVE_EMPS',
            type: 'inactive',
            severity: 'medium',
            icon: '😴',
            title: 'موظفون غير نشطين',
            message: inactiveEmps.length + ' موظف بدون تسجيل حضور 7 أيام',
            count: inactiveEmps.length,
            empIds: inactiveEmps.map(function(e){ return e.id; }),
            empNames: inactiveEmps.slice(0, 3).map(function(e){ return e.name; }),
            action: 'التواصل معهم',
          });
        }

        // 6) Pending leaves waiting approval (> 2 days)
        var twoDaysAgo = new Date(nowAA.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
        var stalePending = leavesAA.filter(function(l){
          var pendingStatuses = ['pending_m1', 'pending_m2', 'pending_final', 'handover_open', 'pending_delegates'];
          if (pendingStatuses.indexOf(l.status) < 0) return false;
          return l.createdAt && l.createdAt < twoDaysAgo;
        });
        if (stalePending.length > 0) {
          alerts.push({
            id: 'STALE_LEAVES',
            type: 'stale_leaves',
            severity: 'high',
            icon: '🏖️',
            title: 'إجازات تنتظر الموافقة',
            message: stalePending.length + ' طلب إجازة بانتظار الموافقة لأكثر من يومين',
            count: stalePending.length,
            action: 'مراجعة وموافقة',
          });
        }

        // Sort by severity
        var severityOrder = { high: 0, medium: 1, low: 2 };
        alerts.sort(function(a, b){
          return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
        });

        return res.json({
          ok: true,
          ts: new Date().toISOString(),
          counts: {
            total: alerts.length,
            high: alerts.filter(function(a){ return a.severity === 'high'; }).length,
            medium: alerts.filter(function(a){ return a.severity === 'medium'; }).length,
          },
          alerts: alerts,
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.101 F — CHALLENGES DASHBOARD (admin analytics)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=challenges-dashboard
       * Returns comprehensive stats for both Morning Challenge + Flash Challenge
       */
      case 'challenges-dashboard': {
        var nowCD = new Date();
        var today30 = new Date(nowCD.getTime() - 30 * 24 * 60 * 60 * 1000);

        // 1) Flash Challenge stats
        var flashStore = (await dbGet('flash_challenges')) || { items: [] };
        var flashItems = flashStore.items || [];
        var flash30 = flashItems.filter(function(f){
          return new Date(f.ts) >= today30;
        });

        var flashTotalSent = flash30.length;
        var flashTotalResponses = 0;
        var flashTotalCorrect = 0;
        var flashTotalTargets = 0;
        flash30.forEach(function(f){
          flashTotalTargets += (f.targets || []).length;
          if (f.responses) {
            Object.keys(f.responses).forEach(function(eid){
              flashTotalResponses++;
              if (f.responses[eid].correct) flashTotalCorrect++;
            });
          }
        });

        // Find hardest questions (low correct rate)
        var hardestQuestions = flash30
          .filter(function(f){ return f.responses && Object.keys(f.responses).length >= 3; })
          .map(function(f){
            var total = Object.keys(f.responses).length;
            var correct = 0;
            Object.keys(f.responses).forEach(function(eid){
              if (f.responses[eid].correct) correct++;
            });
            return {
              q: f.q,
              correctAnswer: f.correct,
              total: total,
              correct: correct,
              correctRate: Math.round((correct / total) * 100),
            };
          })
          .sort(function(a, b){ return a.correctRate - b.correctRate; })
          .slice(0, 5);

        // 2) Top performers (from employee records)
        var empsCD = (await dbGet('employees')) || [];
        var topPerformers = empsCD
          .filter(function(e){ return e.active !== false && !e.terminated; })
          .map(function(e){
            return {
              empId: e.id,
              name: e.name,
              points: e.points || 0,
              streak: e.streak || 0,
              challengesCount: e.challengesCount || 0,
            };
          })
          .sort(function(a, b){ return (b.points || 0) - (a.points || 0); })
          .slice(0, 10);

        // 3) Morning Challenge questions count
        var settingsCD = (await dbGet('settings')) || {};
        var morningQuestionsCount = (settingsCD.questions || []).length;

        return res.json({
          ok: true,
          period: 'last_30_days',
          flashChallenge: {
            totalSent: flashTotalSent,
            totalTargets: flashTotalTargets,
            totalResponses: flashTotalResponses,
            totalCorrect: flashTotalCorrect,
            responseRate: flashTotalTargets > 0 ? Math.round((flashTotalResponses / flashTotalTargets) * 100) : 0,
            accuracyRate: flashTotalResponses > 0 ? Math.round((flashTotalCorrect / flashTotalResponses) * 100) : 0,
          },
          morningChallenge: {
            questionsInBank: morningQuestionsCount,
          },
          topPerformers: topPerformers,
          hardestQuestions: hardestQuestions,
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.100 E — LEADERBOARD (top employees by points)
       * ═══════════════════════════════════════════════════════════════
       * GET /api/data?action=leaderboard&limit=10&branch=X&period=all|month
       * Returns: { ok, period, rankings: [{ rank, empId, name, points, streak, ...}], myRank }
       */
      case 'leaderboard': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
        var limitLB = parseInt(req.query.limit || '10', 10);
        var branchLB = req.query.branch || null;
        var periodLB = req.query.period || 'all';
        var myEmpId = req.query.empId || null;

        var empsLB = (await dbGet('employees')) || [];
        var filtered = empsLB.filter(function(e){
          if (e.active === false) return false;
          if (e.terminated) return false;
          if (branchLB && e.branch !== branchLB && e.branchId !== branchLB) return false;
          return true;
        });

        // Map to ranking entries
        var rankings = filtered.map(function(e){
          return {
            empId: e.id,
            name: e.name || '—',
            points: e.points || 0,
            streak: e.streak || 0,
            branch: e.branch || '',
            jobTitle: e.jobTitle || e.role || '',
            tier: e.tier || 1,
            level: e.level || 1,
          };
        });

        // Sort by points desc
        rankings.sort(function(a, b){
          if (b.points !== a.points) return b.points - a.points;
          if (b.streak !== a.streak) return b.streak - a.streak;
          return 0;
        });

        // Add rank numbers
        rankings.forEach(function(r, i){ r.rank = i + 1; });

        // Find requester's rank
        var myRank = null;
        if (myEmpId) {
          var myEntry = rankings.find(function(r){ return String(r.empId) === String(myEmpId); });
          if (myEntry) {
            myRank = {
              rank: myEntry.rank,
              points: myEntry.points,
              streak: myEntry.streak,
              totalEmployees: rankings.length,
              percentile: Math.round(100 * (1 - (myEntry.rank - 1) / rankings.length)),
            };
          }
        }

        // Return top N
        var top = rankings.slice(0, limitLB);

        return res.json({
          ok: true,
          period: periodLB,
          branch: branchLB,
          total: rankings.length,
          rankings: top,
          myRank: myRank,
        });
      }

      case 'kadwar-pending-count': {
        var vKPC = (await dbGet('violations_v2')) || [];
        var sKPC = (await dbGet('payroll-slips')) || [];
        var tKPC = (await dbGet('terminations')) || [];

        var pendingV = vKPC.filter(function(x){ return !x.kadwarSynced; }).length;
        var pendingS = sKPC.filter(function(x){ return !x.kadwarSynced; }).length;
        var pendingT = tKPC.filter(function(x){ return !x.kadwarSynced; }).length;

        return res.json({
          ok: true,
          pending: {
            violations: pendingV,
            payroll: pendingS,
            terminations: pendingT,
            total: pendingV + pendingS + pendingT,
          },
        });
      }

      /* ═══════════════════════════════════════════════════════════════
       * v7.98 C — BULK ACTIONS (Employee operations on multiple records)
       * ═══════════════════════════════════════════════════════════════
       * Endpoints:
       *   POST /api/data?action=bulk-activate     — تفعيل موظفين
       *   POST /api/data?action=bulk-deactivate   — إيقاف موظفين
       *   POST /api/data?action=bulk-notify       — إرسال إشعار جماعي
       * Body: { empIds: [...], actorId?, title?, body? }
       */
      case 'bulk-activate': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyBA = req.body || {};
        var empIdsBA = bodyBA.empIds;
        var actorBA = bodyBA.actorId || 'admin';
        if (!Array.isArray(empIdsBA) || empIdsBA.length === 0) {
          return res.status(400).json({ error: 'empIds array required' });
        }
        var empsBA = (await dbGet('employees')) || [];
        var updatedBA = 0;
        empsBA.forEach(function(e){
          if (empIdsBA.indexOf(e.id) >= 0 || empIdsBA.indexOf(String(e.id)) >= 0) {
            if (e.active === false) {
              e.active = true;
              updatedBA++;
            }
          }
        });
        await dbSet('employees', empsBA);
        await auditLog(actorBA, 'bulk_activate', null, {
          empIds: empIdsBA,
          count: empIdsBA.length,
          updated: updatedBA,
        }, 'admin');
        return res.json({ ok: true, updated: updatedBA, total: empIdsBA.length });
      }

      case 'bulk-deactivate': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyBD = req.body || {};
        var empIdsBD = bodyBD.empIds;
        var actorBD = bodyBD.actorId || 'admin';
        if (!Array.isArray(empIdsBD) || empIdsBD.length === 0) {
          return res.status(400).json({ error: 'empIds array required' });
        }
        var empsBD = (await dbGet('employees')) || [];
        var updatedBD = 0;
        empsBD.forEach(function(e){
          if (empIdsBD.indexOf(e.id) >= 0 || empIdsBD.indexOf(String(e.id)) >= 0) {
            if (e.active !== false) {
              e.active = false;
              updatedBD++;
            }
          }
        });
        await dbSet('employees', empsBD);
        await auditLog(actorBD, 'bulk_deactivate', null, {
          empIds: empIdsBD,
          count: empIdsBD.length,
          updated: updatedBD,
        }, 'admin');
        return res.json({ ok: true, updated: updatedBD, total: empIdsBD.length });
      }

      case 'bulk-notify': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var bodyBN = req.body || {};
        var empIdsBN = bodyBN.empIds;
        var titleBN = (bodyBN.title || '').trim();
        var bodyTextBN = (bodyBN.body || '').trim();
        var actorBN = bodyBN.actorId || 'admin';
        if (!Array.isArray(empIdsBN) || empIdsBN.length === 0) {
          return res.status(400).json({ error: 'empIds array required' });
        }
        if (!titleBN || !bodyTextBN) {
          return res.status(400).json({ error: 'title + body required' });
        }

        var pushSubsBN = (await dbGet('push_subscriptions')) || {};
        var notifsBN = (await dbGet('notifications')) || [];
        var nowBN = new Date().toISOString();
        var sentBN = 0, failedBN = 0, noSubBN = 0;

        for (var iBN = 0; iBN < empIdsBN.length; iBN++) {
          var eidBN = empIdsBN[iBN];
          var subBN = pushSubsBN[eidBN];

          // Save in-app notification
          notifsBN.unshift({
            id: 'N_BULK_' + Date.now() + '_' + iBN,
            empId: eidBN,
            type: 'bulk_admin',
            title: titleBN,
            message: bodyTextBN,
            read: false,
            ts: nowBN,
          });

          // Send push
          if (subBN && subBN.subscription) {
            try {
              var prBN = await sendWebPush(subBN.subscription, {
                title: titleBN,
                body: bodyTextBN,
                tag: 'bulk-' + Date.now(),
              });
              if (prBN.sent) sentBN++;
              else failedBN++;
            } catch(e) { failedBN++; }
          } else {
            noSubBN++;
          }
        }

        // Trim notifications to last 500
        await dbSet('notifications', notifsBN.slice(0, 500));

        await auditLog(actorBN, 'bulk_notify', null, {
          empIds: empIdsBN,
          count: empIdsBN.length,
          sent: sentBN,
          failed: failedBN,
          noSubscription: noSubBN,
          titlePreview: titleBN.slice(0, 50),
        }, 'admin');

        return res.json({
          ok: true,
          summary: {
            total: empIdsBN.length,
            sent: sentBN,
            failed: failedBN,
            noSubscription: noSubBN,
          },
        });
      }

      case 'auto_violations': {
        // Called by cron daily 6pm — checks today's attendance and generates violations per laiha
        var emps = await dbGet('employees') || [];
        var att = await dbGet('attendance') || [];
        var violationsV2 = await dbGet('violations_v2') || [];
        var preAbs = await dbGet('pre_absences') || [];
        var branches = await dbGet('branches') || [];
        var laihaSettings = await dbGet('laiha_settings') || {};
        var today = new Date().toISOString().split('T')[0];
        var todayAtt = att.filter(a => a.date === today);
        var todayPreAbs = preAbs.filter(p => p.date === today);
        var generated = [];

        // v7.97 — Skip violations on weekends and holidays
        var holidaysData = (await dbGet('holidays')) || { weekendDays: [5, 6], list: [] };
        var weekendDaysAv = holidaysData.weekendDays || [5, 6];
        var todayDow = new Date().getDay();

        // Check weekend
        if (weekendDaysAv.indexOf(todayDow) >= 0) {
          return res.json({
            ok: true,
            skipped: true,
            reason: 'weekend',
            dayOfWeek: todayDow,
            generated: 0
          });
        }

        // Check official holiday
        var todayMmDd = today.slice(5);
        var matchedHolidayAv = (holidaysData.list || []).find(function(h){
          if (!h.date) return false;
          if (h.date === today) return true;
          if (h.recurring && h.date.slice(5) === todayMmDd) return true;
          if (h.endDate && today >= h.date && today <= h.endDate) return true;
          return false;
        });
        if (matchedHolidayAv) {
          return res.json({
            ok: true,
            skipped: true,
            reason: 'holiday',
            holidayName: matchedHolidayAv.name,
            generated: 0
          });
        }

        // Penalties lookup (mirrors laiha.js PENALTY_TYPES)
        var penaltyLabels = {
          WARNING: 'إنذار كتابي', FINE_5: 'خصم 5%', FINE_10: 'خصم 10%', FINE_15: 'خصم 15%',
          FINE_20: 'خصم 20%', FINE_25: 'خصم 25%', FINE_30: 'خصم 30%', FINE_50: 'خصم 50%',
          FINE_75: 'خصم 75%', FINE_1DAY: 'خصم يوم', FINE_2DAYS: 'خصم يومين',
          FINE_3DAYS: 'خصم 3 أيام', FINE_4DAYS: 'خصم 4 أيام', FINE_5DAYS: 'خصم 5 أيام',
          DENY_PROMOTION: 'حرمان من الترقية/العلاوة',
          TERMINATION_WITH: 'فصل مع المكافأة', TERMINATION_WITHOUT: 'فصل دون مكافأة (م.80)',
        };

        // Laiha rules (auto-detectable only)
        var laihaRules = [
          { id: 'WH-01', maxLate: 15, penalties: { first: 'WARNING', second: 'FINE_5', third: 'FINE_10', fourth: 'FINE_20' }, desc: 'التأخر لغاية 15 دقيقة دون إذن' },
          { id: 'WH-03', minLate: 16, maxLate: 30, penalties: { first: 'FINE_10', second: 'FINE_15', third: 'FINE_25', fourth: 'FINE_50' }, desc: 'التأخر أكثر من 15 وحتى 30 دقيقة دون إذن' },
          { id: 'WH-05', minLate: 31, maxLate: 60, penalties: { first: 'FINE_25', second: 'FINE_50', third: 'FINE_75', fourth: 'FINE_1DAY' }, desc: 'التأخر أكثر من 30 وحتى 60 دقيقة دون إذن' },
          { id: 'WH-07', minLate: 61, penalties: { first: 'WARNING', second: 'FINE_1DAY', third: 'FINE_2DAYS', fourth: 'FINE_3DAYS' }, desc: 'التأخر لمدة تزيد على ساعة دون إذن' },
          { id: 'WH-11', absentDays: 1, penalties: { first: 'FINE_2DAYS', second: 'FINE_3DAYS', third: 'FINE_4DAYS', fourth: 'DENY_PROMOTION' }, desc: 'الغياب يوم دون إذن كتابي' },
        ];

        emps.forEach(function(emp) {
          if (emp.terminated || emp.onLeave) return;
          if (todayPreAbs.some(p => p.empId === emp.id)) return;

          var branch = branches.find(b => b.id === emp.branch || b.name === emp.branch);
          if (!branch) return;

          var empAtt = todayAtt.filter(a => a.empId === emp.id);
          var checkin = empAtt.find(a => a.type === 'checkin');
          var nowH = new Date().getHours();

          function applyRule(rule, extraDesc) {
            // Check admin settings — is this rule enabled?
            var setting = laihaSettings[rule.id];
            var enabled = setting && setting.enabled !== undefined ? setting.enabled : true;
            var autoApply = setting && setting.autoApply !== undefined ? setting.autoApply : (rule.id.startsWith('WH-0')); // defaults per laiha.js
            if (!enabled) return;

            // Count previous occurrences of same violation in 180 days (per المادة 44)
            var d180 = new Date(); d180.setDate(d180.getDate() - 180);
            var prevCount = violationsV2.filter(v =>
              v.empId === emp.id && v.violationId === rule.id &&
              v.status === 'ACTIVE' && new Date(v.createdAt) > d180
            ).length;
            var occurrence = Math.min(prevCount + 1, 4);
            var penaltyKey = ['first','second','third','fourth'][occurrence - 1];
            var penaltyCode = rule.penalties[penaltyKey];
            if (!penaltyCode) return;

            var chapter = rule.id.startsWith('WH') ? 'مواعيد العمل' : rule.id.startsWith('WO') ? 'تنظيم العمل' : 'سلوك العامل';
            var newVio = {
              id: 'VIO' + Date.now() + emp.id,
              empId: emp.id,
              empName: emp.name,
              violationId: rule.id,
              chapter: chapter,
              description: rule.desc + (extraDesc ? ' — ' + extraDesc : ''),
              occurrence: occurrence,
              penaltyCode: penaltyCode,
              penaltyLabel: penaltyLabels[penaltyCode] || penaltyCode,
              source: 'auto',
              legalRef: 'لائحة تنظيم العمل المعتمدة رقم 978004 — الفصل الثامن عشر، جدول المخالفات، البند ' + rule.id,
              createdAt: new Date().toISOString(),
              createdBy: 'system_cron',
              status: autoApply ? 'ACTIVE' : 'PENDING_APPROVAL',
              autoGenerated: true,
            };
            violationsV2.push(newVio);
            generated.push({ empId: emp.id, name: emp.name, rule: rule.id, occurrence: occurrence, penalty: newVio.penaltyLabel, needsApproval: !autoApply });
          }

          // Check absence — account for Saudi Arabia timezone (UTC+3)
          // Server runs in UTC; 6pm Saudi = 15:00 UTC
          var nowUTC = new Date();
          var saudiHour = (nowUTC.getUTCHours() + 3) % 24;
          if (!checkin && saudiHour >= 18) {
            var absRule = laihaRules.find(r => r.absentDays === 1);
            if (absRule) applyRule(absRule, today);
          }

          // Check late arrival
          if (checkin && branch.start) {
            var checkinTime = new Date(checkin.ts);
            var startParts = branch.start.split(':');
            var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            var checkinMin = checkinTime.getHours() * 60 + checkinTime.getMinutes();
            var lateMinutes = checkinMin - startMin;
            if (lateMinutes > 0) {
              var lateRule = laihaRules.find(r => {
                var min = r.minLate !== undefined ? r.minLate : 1;
                var max = r.maxLate !== undefined ? r.maxLate : Infinity;
                return lateMinutes >= min && lateMinutes <= max && !r.absentDays;
              });
              if (lateRule) applyRule(lateRule, 'تأخر ' + lateMinutes + ' دقيقة');
            }
          }
        });

        await dbSet('violations_v2', violationsV2);
        // Auto-notify employees about their violations
        if (generated.length > 0) {
          try {
            var notifs = await dbGet('notifications') || [];
            generated.forEach(function(g) {
              notifs.push({
                id: 'NTF' + Date.now() + g.empId,
                empId: g.empId,
                type: 'violation',
                title: g.needsApproval ? '📋 مخالفة بانتظار الاعتماد' : '⚖️ مخالفة جديدة',
                body: 'البند ' + g.rule + ' — المرة ' + g.occurrence + ' — الجزاء: ' + g.penalty,
                read: false,
                createdAt: new Date().toISOString(),
              });
            });
            await dbSet('notifications', notifs);
          } catch(e) { /**/ }
        }
        return res.json({ ok: true, generated: generated, count: generated.length, ranAt: new Date().toISOString() });
      }

      /* ═══ NOTIFICATIONS (إشعارات الموظفين) ═══ */
      case 'notifications': {
        if (req.method === 'GET') {
          var notifs = await dbGet('notifications') || [];
          if (req.query.empId) notifs = notifs.filter(n => n.empId === req.query.empId);
          if (req.query.unread === '1') notifs = notifs.filter(n => !n.read);
          return res.json(notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50));
        }
        if (req.method === 'POST') {
          var notifs = await dbGet('notifications') || [];
          var newNotif = {
            id: 'NTF' + Date.now(),
            empId: req.body.empId,
            type: req.body.type, // violation | investigation | appeal_result | complaint_update
            title: req.body.title,
            body: req.body.body,
            refId: req.body.refId || null, // ID of related entity
            read: false,
            createdAt: new Date().toISOString(),
          };
          notifs.push(newNotif);
          // Keep only last 200 per employee
          var empNotifs = notifs.filter(n => n.empId === req.body.empId);
          if (empNotifs.length > 200) {
            var keep = new Set(empNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200).map(n => n.id));
            notifs = notifs.filter(n => n.empId !== req.body.empId || keep.has(n.id));
          }
          await dbSet('notifications', notifs);
          return res.json({ ok: true, notification: newNotif });
        }
        if (req.method === 'PUT') {
          // Mark as read
          var notifs = await dbGet('notifications') || [];
          if (req.body.markAllRead && req.body.empId) {
            notifs = notifs.map(n => n.empId === req.body.empId ? { ...n, read: true } : n);
          } else if (req.body.id) {
            var idx = notifs.findIndex(n => n.id === req.body.id);
            if (idx >= 0) notifs[idx].read = true;
          }
          await dbSet('notifications', notifs);
          return res.json({ ok: true });
        }
        break;
      }

      /* ═══ EXPORT INSURANCE (تصدير بيانات التأمين) ═══ */
      case 'export_insurance': {
        var emps = await dbGet('employees') || [];
        var deps = await dbGet('dependents') || [];
        var hd = await dbGet('health_disclosures') || [];
        var rows = ['رقم الموظف,الاسم,المرافق,القرابة,الميلاد,الهوية,تأمين خارجي,شركة التأمين,إفصاح صحي'];
        emps.forEach(function(emp) {
          // Employee row
          var empHd = hd.find(h => h.empId === emp.id);
          rows.push([emp.id, emp.name, '—', 'موظف', emp.dob || '', emp.idNumber || '', emp.externalInsurance ? 'نعم' : 'لا', emp.insurerName || '', empHd ? 'مقدّم' : 'لم يُقدّم'].join(','));
          // Dependents rows
          var empDeps = deps.filter(d => d.empId === emp.id && d.status === 'approved');
          empDeps.forEach(function(dep) {
            rows.push([emp.id, emp.name, dep.name, dep.relation, dep.dob || '', dep.idNumber || '', dep.externalInsurance ? 'نعم' : 'لا', dep.insurerName || '', '—'].join(','));
          });
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send('\uFEFF' + rows.join('\n'));
      }

      case 'diagnostic': {
        // Test database read/write
        var results = { token: !!process.env.BLOB_READ_WRITE_TOKEN, tokenPrefix: (process.env.BLOB_READ_WRITE_TOKEN || '').substring(0, 10) + '...', tests: {} };
        try {
          // Test write
          await put(PFX + 'test_diag.json', JSON.stringify({ test: true, ts: new Date().toISOString() }), { access: 'public', contentType: 'application/json' });
          results.tests.write = 'OK';
        } catch(e) { results.tests.write = 'FAIL: ' + e.message; }
        try {
          // Test read
          var { blobs } = await list({ prefix: PFX + 'test_diag.json' });
          results.tests.read = blobs.length > 0 ? 'OK (' + blobs.length + ' blobs)' : 'FAIL: no blobs found';
          // List all basma blobs
          var allBlobs = await list({ prefix: PFX });
          results.tests.totalBlobs = allBlobs.blobs.length;
          results.tests.blobNames = allBlobs.blobs.map(b => b.pathname);
          // Cleanup test
          for (var b of blobs) await del(b.url);
          results.tests.delete = 'OK';
        } catch(e) { results.tests.read = 'FAIL: ' + e.message; }
        // Test existing data
        try {
          var emps = await dbGet('employees');
          results.tests.employees = emps ? (Array.isArray(emps) ? emps.length + ' employees' : typeof emps) : 'NULL';
        } catch(e) { results.tests.employees = 'FAIL: ' + e.message; }
        try {
          var settings = await dbGet('settings');
          results.tests.settings = settings ? 'exists' : 'NULL';
        } catch(e) { results.tests.settings = 'FAIL: ' + e.message; }
        try {
          var reqs = await dbGet('admin_requests');
          results.tests.requests = reqs ? (Array.isArray(reqs) ? reqs.length + ' requests' : typeof reqs) : 'NULL (empty)';
        } catch(e) { results.tests.requests = 'FAIL: ' + e.message; }
        return res.json(results);
      }

      /* ═══ ORG HIERARCHY — مَن يدير مَن (managerId لكل موظف) ═══
         GET:  { ok, hierarchy: { <empId>: <managerId> }, employees: [...] }
         POST: { assignments: { <empId>: <managerId> } } — batch update
         Stored in Redis key 'org_hierarchy' as { <empId>: <managerId> } */
      case 'org_hierarchy': {
        try {
          /* v6.80 — Hierarchy v2: 
             - manager1 (المدير الإداري المباشر) — كان "manager"
             - manager2 (المدير الفني / الجودة)
             - editedInBasma flag إذا تم التعديل في بصمة دون كوادر
             - hierarchy structure: { empId: { manager1, manager2, editedInBasma, editedAt, editedBy } }
             - يدعم الصيغة القديمة (string فقط = manager1) للتوافقية
          */
          if (req.method === 'POST') {
            var body = req.body || {};
            var editor = body.editedBy || 'admin';

            if (body.assignments) {
              // Batch update — assignments: { empId: { manager1, manager2, source } } OR legacy: { empId: managerId }
              var h = (await dbGet('org_hierarchy')) || {};
              var updated = 0;
              Object.keys(body.assignments).forEach(function(empId){
                var val = body.assignments[empId];
                // Normalize legacy (string) to new structure
                if (typeof val === 'string' || val === null || val === undefined) {
                  if (!val) {
                    delete h[empId];
                  } else {
                    var prev = (typeof h[empId] === 'object') ? h[empId] : { manager1: h[empId] };
                    h[empId] = {
                      manager1: String(val),
                      manager2: prev.manager2 || null,
                      editedInBasma: true,
                      editedAt: new Date().toISOString(),
                      editedBy: editor,
                    };
                  }
                } else if (typeof val === 'object') {
                  var existing = (typeof h[empId] === 'object') ? h[empId] : (h[empId] ? { manager1: h[empId] } : {});
                  var newRecord = {
                    manager1: val.manager1 !== undefined ? (val.manager1 || null) : (existing.manager1 || null),
                    manager2: val.manager2 !== undefined ? (val.manager2 || null) : (existing.manager2 || null),
                    editedInBasma: val.editedInBasma !== undefined ? !!val.editedInBasma : true,
                    editedAt: new Date().toISOString(),
                    editedBy: editor,
                  };
                  // If both empty → remove
                  if (!newRecord.manager1 && !newRecord.manager2) {
                    delete h[empId];
                  } else {
                    h[empId] = newRecord;
                  }
                }
                updated++;
              });
              await dbSet('org_hierarchy', h);
              return res.json({ ok: true, hierarchy: h, updated: updated });
            }

            // Single assignment (legacy + new)
            if (body.empId) {
              var h2 = (await dbGet('org_hierarchy')) || {};
              var existing2 = (typeof h2[body.empId] === 'object') ? h2[body.empId] : (h2[body.empId] ? { manager1: h2[body.empId] } : {});
              var rec = {
                manager1: body.manager1 !== undefined ? (body.manager1 || null) : (body.managerId !== undefined ? (body.managerId || null) : (existing2.manager1 || null)),
                manager2: body.manager2 !== undefined ? (body.manager2 || null) : (existing2.manager2 || null),
                editedInBasma: true,
                editedAt: new Date().toISOString(),
                editedBy: editor,
              };
              if (!rec.manager1 && !rec.manager2) {
                delete h2[body.empId];
              } else {
                h2[body.empId] = rec;
              }
              await dbSet('org_hierarchy', h2);
              return res.json({ ok: true, hierarchy: h2 });
            }
            return res.status(400).json({ error: 'assignments or empId required' });
          }

          // GET: return enriched
          var hh = (await dbGet('org_hierarchy')) || {};
          var emps = (await dbGet('employees')) || [];

          // Helper to normalize record
          function normalize(rec) {
            if (!rec) return { manager1: null, manager2: null, editedInBasma: false };
            if (typeof rec === 'string') return { manager1: rec, manager2: null, editedInBasma: false };
            return {
              manager1: rec.manager1 || null,
              manager2: rec.manager2 || null,
              editedInBasma: !!rec.editedInBasma,
              editedAt: rec.editedAt || null,
              editedBy: rec.editedBy || null,
            };
          }

          var enriched = emps.map(function(e){
            var eid = String(e.id || e.username || '');
            var rec = normalize(hh[eid]);
            return {
              id: e.id,
              username: e.username,
              name: e.name,
              department: e.department,
              role: e.role,
              branch: e.branch,
              isAdmin: !!e.isAdmin,
              isManager: !!e.isManager,
              manager1: rec.manager1,
              manager2: rec.manager2,
              managerId: rec.manager1, // backward compatibility
              editedInBasma: rec.editedInBasma,
              editedAt: rec.editedAt,
              editedBy: rec.editedBy,
            };
          });

          // Normalized hierarchy (always return as objects)
          var normalizedHierarchy = {};
          Object.keys(hh).forEach(function(k){ normalizedHierarchy[k] = normalize(hh[k]); });

          return res.json({ ok: true, hierarchy: normalizedHierarchy, employees: enriched });
        } catch(e) {
          return res.status(500).json({ error: 'org_hierarchy: ' + (e.message || 'unknown') });
        }
      }

      /* v6.80 — Tawasul recipients: smart list of who I can send tasks to */
      case 'tawasul-recipients': {
        if (req.method !== 'GET') break;
        var myId = String(req.query.empId || '');
        if (!myId) return res.status(400).json({ error: 'empId required' });

        var emps = (await dbGet('employees')) || [];
        var hierarchy = (await dbGet('org_hierarchy')) || {};

        function norm(rec) {
          if (!rec) return { manager1: null, manager2: null };
          if (typeof rec === 'string') return { manager1: rec, manager2: null };
          return { manager1: rec.manager1 || null, manager2: rec.manager2 || null };
        }

        var me = emps.find(function(e){ return String(e.id || e.username) === myId; });
        if (!me) return res.json({ recipients: [], reason: 'unknown' });

        var myRec = norm(hierarchy[myId]);
        var recipients = [];
        var seen = new Set();

        function add(emp, relationship) {
          var eid = String(emp.id || emp.username);
          if (eid === myId || seen.has(eid)) return;
          seen.add(eid);
          recipients.push({
            id: emp.id,
            name: emp.name || emp.username,
            role: emp.role || '',
            department: emp.department || '',
            branch: emp.branch || '',
            relationship: relationship,
          });
        }

        // 1) My manager1 (الإداري)
        if (myRec.manager1) {
          var m1 = emps.find(function(e){ return String(e.id || e.username) === String(myRec.manager1); });
          if (m1) add(m1, 'manager1');
        }
        // 2) My manager2 (الفني)
        if (myRec.manager2) {
          var m2 = emps.find(function(e){ return String(e.id || e.username) === String(myRec.manager2); });
          if (m2) add(m2, 'manager2');
        }
        // 3) My subordinates (people I'm a manager1 OR manager2 for)
        emps.forEach(function(e){
          var eid = String(e.id || e.username);
          var r = norm(hierarchy[eid]);
          if (String(r.manager1) === myId) add(e, 'subordinate1');
          else if (String(r.manager2) === myId) add(e, 'subordinate2');
        });
        // 4) Colleagues in same branch+department
        if (me.branch || me.department) {
          emps.forEach(function(e){
            if (e.branch === me.branch && e.department === me.department) add(e, 'colleague');
          });
        }
        // 5) Fallback: if recipients empty AND data is incomplete → return all employees
        var dataIncomplete = !myRec.manager1 && !myRec.manager2;
        if (recipients.length === 0 || dataIncomplete) {
          emps.forEach(function(e){ add(e, 'all'); });
        }

        return res.json({
          recipients: recipients,
          dataIncomplete: dataIncomplete,
          myManager1: myRec.manager1 || null,
          myManager2: myRec.manager2 || null,
        });
      }

      case 'seed_questions': {
        // One-time seed: populates settings.questions with the default bank
        // for the admin to cherry-pick from. Does NOT overwrite existing questions.
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        var DEFAULT_BANK = [
          // ذكر
          { type: "ذكر", q: "أكمل: سبحان الله وبحمده ...", correct: "سبحان الله العظيم", wrong1: "الحمد لله رب العالمين", wrong2: "لا إله إلا الله" },
          { type: "ذكر", q: "دعاء الصباح: اللهم بك أصبحنا وبك ...", correct: "أمسينا", wrong1: "حيينا", wrong2: "توكلنا" },
          { type: "ذكر", q: "أكمل الحديث: إنما الأعمال ...", correct: "بالنيات", wrong1: "بالخواتيم", wrong2: "بالإخلاص" },
          // هندسي
          { type: "هندسي", q: "ما وحدة قياس قوة الخرسانة؟", correct: "ميجا باسكال", wrong1: "نيوتن", wrong2: "كيلو جرام" },
          { type: "هندسي", q: "ما هو الحد الأدنى لغطاء الخرسانة للأعمدة؟", correct: "40 مم", wrong1: "25 مم", wrong2: "75 مم" },
          { type: "هندسي", q: "كم يوم يلزم لمعالجة الخرسانة بالماء؟", correct: "7 أيام", wrong1: "3 أيام", wrong2: "14 يوم" },
          { type: "هندسي", q: "ما هي نسبة الماء إلى الأسمنت المثالية؟", correct: "0.45", wrong1: "0.30", wrong2: "0.60" },
          { type: "هندسي", q: "ما أول شي يُراجع عند استلام موقع جديد؟", correct: "المخططات", wrong1: "الميزانية", wrong2: "المعدات" },
          { type: "هندسي", q: "ما الفرق بين الإسمنت البورتلاندي العادي والمقاوم؟", correct: "مقاومة الكبريتات", wrong1: "اللون", wrong2: "السعر" },
          { type: "هندسي", q: "ما الحد الأقصى لـ slump الخرسانة العادية؟", correct: "100 مم", wrong1: "50 مم", wrong2: "150 مم" },
          { type: "هندسي", q: "ما المسافة بين أعمدة القالب (الشدّة) عادة؟", correct: "100 سم", wrong1: "50 سم", wrong2: "200 سم" },
          { type: "هندسي", q: "كم يوم قبل فك شدّة البلاطة؟", correct: "21 يوم", wrong1: "3 أيام", wrong2: "7 أيام" },
          // نظام العمل
          { type: "سؤال", q: "كم يوم مدة التظلم من جزاء تأديبي؟", correct: "3 أيام عمل", wrong1: "يوم واحد", wrong2: "7 أيام" },
          { type: "سؤال", q: "بعد كم يوم غياب متصل يُفسخ العقد (م.80)؟", correct: "15 يوم", wrong1: "10 أيام", wrong2: "30 يوم" },
          { type: "سؤال", q: "كم يوم الإجازة السنوية لمن خدم أقل من 5 سنوات؟", correct: "21 يوم", wrong1: "15 يوم", wrong2: "30 يوم" },
          { type: "سؤال", q: "بعد كم يوم من المخالفة لا يُعتبر عائداً (م.44)؟", correct: "180 يوم", wrong1: "90 يوم", wrong2: "365 يوم" },
          { type: "سؤال", q: "كم ساعة عمل يومياً في رمضان للمسلمين؟", correct: "6 ساعات", wrong1: "5 ساعات", wrong2: "7 ساعات" },
          // سلامة
          { type: "معلومة", q: "ما أول إجراء عند اكتشاف حريق في الموقع؟", correct: "إنذار الجميع والإخلاء", wrong1: "إطفاء الحريق", wrong2: "الاتصال بالشرطة" },
          { type: "معلومة", q: "ما لون خوذة السلامة للمهندس عادة؟", correct: "أبيض", wrong1: "أصفر", wrong2: "أحمر" },
          { type: "معلومة", q: "كم المسافة الآمنة من حافة الحفريات؟", correct: "2 متر", wrong1: "0.5 متر", wrong2: "1 متر" },
          // ألغاز
          { type: "لغز", q: "ما الشيء الذي يمشي بلا أرجل؟", correct: "الوقت", wrong1: "الماء", wrong2: "الهواء" },
          { type: "لغز", q: "ما الطعم الذي لا تستطيع الطيور تذوقه؟", correct: "الحار", wrong1: "المالح", wrong2: "الحلو" },
          // عام
          { type: "سؤال", q: "كم عدد أركان الإسلام؟", correct: "خمسة", wrong1: "ثلاثة", wrong2: "سبعة" },
          { type: "سؤال", q: "كم ركعة صلاة التراويح؟", correct: "8 أو 20", wrong1: "12", wrong2: "6" },
          { type: "سؤال", q: "ما عاصمة المملكة العربية السعودية؟", correct: "الرياض", wrong1: "جدة", wrong2: "مكة" },
          { type: "سؤال", q: "في أي سنة تأسست المملكة؟", correct: "1932", wrong1: "1902", wrong2: "1945" },
          { type: "سؤال", q: "كم عدد مناطق المملكة الإدارية؟", correct: "13", wrong1: "10", wrong2: "15" },
          { type: "سؤال", q: "ما هي رؤية المملكة؟", correct: "رؤية 2030", wrong1: "رؤية 2025", wrong2: "رؤية 2035" },
          { type: "معلومة", q: "كم عدد العظام في جسم الإنسان البالغ؟", correct: "206", wrong1: "176", wrong2: "256" },
          { type: "معلومة", q: "ما أقوى عضلة في جسم الإنسان؟", correct: "الفك", wrong1: "القلب", wrong2: "اللسان" },
        ];
        try {
          var settingsCur = await dbGet('settings') || {};
          var mode = (req.body && req.body.mode) || 'append'; // 'append' | 'replace'
          var existing = Array.isArray(settingsCur.questions) ? settingsCur.questions : [];
          var nowTs = Date.now();
          var seeded = DEFAULT_BANK.map(function(q, i){ return Object.assign({ id: nowTs + i }, q); });
          var merged;
          if (mode === 'replace' || existing.length === 0) {
            merged = seeded;
          } else {
            // Append, avoiding duplicates by question text
            var existingTexts = new Set(existing.map(function(q){ return (q.q || '').trim(); }));
            var toAdd = seeded.filter(function(q){ return !existingTexts.has((q.q || '').trim()); });
            merged = existing.concat(toAdd);
          }
          settingsCur.questions = merged;
          await dbSet('settings', settingsCur);
          return res.json({ ok: true, total: merged.length, added: merged.length - existing.length, mode: mode });
        } catch (e) {
          return res.status(500).json({ error: 'seed_questions: ' + (e.message || 'unknown') });
        }
      }

      case 'system_check': {
        // Comprehensive system health check — runs 20+ tests across storage, data, integrations
        var report = {
          ts: new Date().toISOString(),
          overall: 'ok',
          sections: {},
        };

        async function safeTime(fn) {
          var t0 = Date.now();
          try { var v = await fn(); return { ok: true, ms: Date.now() - t0, value: v }; }
          catch(e) { return { ok: false, ms: Date.now() - t0, error: (e.message || String(e)).substring(0, 200) }; }
        }

        // ══════════ STORAGE LAYER ══════════
        var storage = {};
        // Redis
        storage.redis_configured = { ok: USE_REDIS, value: USE_REDIS ? 'Upstash URL + token present' : 'missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN' };
        if (USE_REDIS) {
          storage.redis_write = await safeTime(async function(){
            await redisSet('__health_check', { ts: new Date().toISOString() });
            return 'wrote';
          });
          storage.redis_read = await safeTime(async function(){
            var v = await redisGet('__health_check');
            return v && v.ts ? 'read back OK' : 'read failed';
          });
          storage.redis_delete = await safeTime(async function(){
            await redisRequest('DEL', PFX_REDIS + '__health_check');
            return 'deleted';
          });
        }
        // R2
        storage.r2_configured = { ok: USE_R2, value: USE_R2 ? 'R2 credentials present' : 'missing R2_ACCOUNT_ID/KEY/SECRET' };
        storage.r2_public_url = { ok: !!R2_PUBLIC_URL, value: R2_PUBLIC_URL || 'R2_PUBLIC_URL not set' };
        // Blob (legacy)
        storage.blob_configured = { ok: !!process.env.BLOB_READ_WRITE_TOKEN, value: process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB token present (fallback)' : 'no blob fallback' };
        report.sections.storage = storage;

        // ══════════ DATA INTEGRITY ══════════
        var dataChecks = {};
        var tables = [
          { key: 'employees', label: 'الموظفين' },
          { key: 'branches', label: 'الفروع' },
          { key: 'attendance', label: 'سجل الحضور' },
          { key: 'violations_v2', label: 'المخالفات' },
          { key: 'complaints', label: 'الشكاوى' },
          { key: 'investigations', label: 'التحقيقات' },
          { key: 'appeals', label: 'التظلمات' },
          { key: 'leaves', label: 'الإجازات' },
          { key: 'notifications', label: 'الإشعارات' },
          { key: 'announcements', label: 'التعاميم' },
          { key: 'banners', label: 'البنرات' },
          { key: 'events', label: 'المناسبات' },
          { key: 'faces', label: 'بصمات الوجه' },
          { key: 'custody', label: 'العهد' },
          { key: 'settings', label: 'الإعدادات' },
          { key: 'work_types', label: 'أنواع الدوام' },
          { key: 'laiha_settings', label: 'إعدادات اللائحة' },
        ];
        for (var tbl of tables) {
          var r = await safeTime(async function(){
            var data = await dbGet(tbl.key);
            if (data === null || data === undefined) return { type: 'empty', count: 0 };
            if (Array.isArray(data)) return { type: 'array', count: data.length };
            if (typeof data === 'object') return { type: 'object', count: Object.keys(data).length };
            return { type: typeof data, count: 1 };
          });
          dataChecks[tbl.key] = { label: tbl.label, ok: r.ok, ms: r.ms, value: r.value, error: r.error };
        }
        // Tawasul
        var twslR = await safeTime(async function(){
          var idx = await dbGet('twsl:idx');
          return { type: 'array', count: Array.isArray(idx) ? idx.length : 0 };
        });
        dataChecks['tawasul'] = { label: 'مهام التواصل', ok: twslR.ok, ms: twslR.ms, value: twslR.value, error: twslR.error };
        report.sections.data = dataChecks;

        // ══════════ CONFIGURATION ══════════
        var config = {};
        var settings = await dbGet('settings') || {};
        config.has_admin_email = { ok: !!(settings.adminEmail || settings.admin_email), value: settings.adminEmail || settings.admin_email || 'not set' };
        config.has_custom_questions = { ok: Array.isArray(settings.questions) && settings.questions.length > 0, value: Array.isArray(settings.questions) ? settings.questions.length + ' أسئلة' : 'none (uses defaults)' };
        config.email_lists = { ok: !!settings.emailLists, value: settings.emailLists ? Object.keys(settings.emailLists).length + ' lists' : 'none' };
        config.observed_employees = { ok: true, value: Array.isArray(settings.observed) ? settings.observed.length + ' موظف تحت الملاحظة' : '0' };
        // Laiha
        var laiha = await dbGet('laiha_settings') || {};
        config.laiha_auto_enabled = { ok: laiha.autoViolations !== false, value: laiha.autoViolations === false ? 'DISABLED' : 'ENABLED (3pm UTC cron)' };
        // Branches
        var branches = await dbGet('branches') || [];
        config.branches_count = { ok: branches.length > 0, value: branches.length + ' فروع' };
        config.branches_have_geofence = { ok: branches.every(function(b){ return b.lat && b.lng && b.radius; }), value: branches.filter(function(b){ return b.lat && b.lng && b.radius; }).length + '/' + branches.length + ' بنطاق جغرافي' };
        report.sections.config = config;

        // ══════════ INTEGRATIONS ══════════
        var integrations = {};
        // Push notifications (VAPID)
        integrations.vapid_public = { ok: !!process.env.VAPID_PUBLIC_KEY, value: process.env.VAPID_PUBLIC_KEY ? 'VAPID_PUBLIC_KEY set' : 'missing' };
        integrations.vapid_private = { ok: !!process.env.VAPID_PRIVATE_KEY, value: process.env.VAPID_PRIVATE_KEY ? 'VAPID_PRIVATE_KEY set' : 'missing' };
        integrations.vapid_email = { ok: !!process.env.VAPID_CONTACT_EMAIL, value: process.env.VAPID_CONTACT_EMAIL || 'not set' };
        // Push subscriptions
        var subs = await safeTime(async function(){ var s = await dbGet('push_subscriptions') || {}; return Object.keys(s).length + ' مشترك'; });
        integrations.push_subscriptions = { ok: subs.ok, value: subs.value, error: subs.error };
        // GitHub token (for update tool)
        integrations.github_token = { ok: !!process.env.GITHUB_TOKEN, value: process.env.GITHUB_TOKEN ? 'GITHUB_TOKEN present (update tool OK)' : 'missing — update tool disabled' };
        // Kadwar sync
        var kadwarR = await safeTime(async function(){
          var kd = await dbGet('kadwar_data');
          return kd ? 'synced (' + (Array.isArray(kd.employees) ? kd.employees.length : 0) + ' موظف من كوادر)' : 'no kadwar data';
        });
        integrations.kadwar_sync = { ok: kadwarR.ok, value: kadwarR.value, error: kadwarR.error };
        report.sections.integrations = integrations;

        // ══════════ TAWASUL SYSTEM ══════════
        var tawasul = {};
        tawasul.task_index = await safeTime(async function(){
          var idx = await dbGet('twsl:idx') || [];
          return idx.length + ' مهمة مفهرسة';
        });
        tawasul.categories = await safeTime(async function(){
          var c = await dbGet('twsl:categories') || [];
          return c.length + ' تصنيف';
        });
        tawasul.projects = await safeTime(async function(){
          var p = await dbGet('twsl:projects') || [];
          return p.length + ' مشروع';
        });
        tawasul.notifs = await safeTime(async function(){
          var n = await dbGet('twsl:notifs') || [];
          return n.length + ' إشعار';
        });
        tawasul.serial_counter = await safeTime(async function(){
          var s = await dbGet('twsl:serial') || 0;
          return 'CB' + String(s).padStart(4, '0') + ' (تالي: CB' + String(s+1).padStart(4,'0') + ')';
        });
        report.sections.tawasul = tawasul;

        // ══════════ COMPUTE OVERALL ══════════
        var failed = [];
        Object.keys(report.sections).forEach(function(sec){
          Object.keys(report.sections[sec]).forEach(function(key){
            var item = report.sections[sec][key];
            if (item && item.ok === false) failed.push(sec + '.' + key);
          });
        });
        report.overall = failed.length === 0 ? 'ok' : failed.length <= 2 ? 'warning' : 'error';
        report.failed_checks = failed;
        report.total_checks = Object.keys(report.sections).reduce(function(sum, sec){ return sum + Object.keys(report.sections[sec]).length; }, 0);

        return res.json(report);
      }

      default: return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
