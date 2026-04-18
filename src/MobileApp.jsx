import React, { useState, useEffect, useRef, useCallback } from "react";
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, Button, Card, Section, Icons, setTheme } from "./theme";
import { ALL_VIOLATIONS_DEFAULT, PENALTY_TYPES, LAIHA_INFO, COMPLAINT_STATUS, VIOLATION_STATUS } from "./laiha";

/* ═══════════════════════════════════════════
   بصمة HMA v4.51 — Mobile App
   Built from scratch — Approved Design
   + Face Verify + Challenge + Toasts
   ═══════════════════════════════════════════ */

/* ═══════════ APP CONFIG (إعدادات التطبيق) ═══════════ */
const APP_CONFIG = {
  VER: "4.80",
  NAME: "بصمة HMA",
  FULL_NAME: "نظام الحضور والانصراف الذكي",
  COMPANY: "هاني محمد عسيري للاستشارات الهندسية",
  URL: "b.hma.engineer",
  KADWAR_URL: "https://hma.engineer",
};
const VER = APP_CONFIG.VER;

/* ── Colors ── */
const LIGHT = {
  hdr1: "#e8ebf0", hdr2: "#d5dae2", hdr3: "#c2c9d4",
  green: "#10b981", greenDark: "#059669",
  orange: "#d4a017", orangeDark: "#b8860b",
  red: "#E2192C", redDark: "#c0392b",
  blue: "#2b5ea7", blueBright: "#3a7bd5",
  bg: "#d5dae2", card: "#ffffff", text: "#0f172a", sub: "#64748b",
  gold: "#475569", goldLight: "#64748b", goldDark: "#1e293b",
  cardBorder: "rgba(71,85,105,.35)",
};
const DARK = {
  hdr1: "#0d2445", hdr2: "#091a38", hdr3: "#071428",
  green: "#10b981", greenDark: "#059669",
  orange: "#d4a017", orangeDark: "#b8860b",
  red: "#E2192C", redDark: "#c0392b",
  blue: "#2b5ea7", blueBright: "#3a7bd5",
  bg: "#0e1d35", card: "#142537", text: "#e8edf4", sub: "#7a8fa8",
  gold: "#c9a84c", goldLight: "#e8d5a3", goldDark: "#8b6914",
  cardBorder: "#1f3a55",
};
var C = DARK;
function CB() { return C.cardBorder || C.bg; }

// Initialize theme from localStorage BEFORE first render
(function initTheme() {
  try {
    var saved = localStorage.getItem("basma_dark");
    var isDark = saved === null ? true : saved === "1";
    C = isDark ? DARK : LIGHT;
    setTheme(isDark);
  } catch(e) { setTheme(true); }
})();

/* ── Inject Global CSS ── */
if (typeof document !== "undefined" && !document.getElementById("basma-css")) {
  const style = document.createElement("style");
  style.id = "basma-css";
  style.textContent = [
    "@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}",
    "@keyframes pageIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}",
    ".basma-fadein{animation:fadeIn .4s ease both}",
    ".basma-fadein-d1{animation:fadeIn .4s ease .1s both}",
    ".basma-fadein-d2{animation:fadeIn .4s ease .2s both}",
    ".basma-fadein-d3{animation:fadeIn .4s ease .3s both}",
    ".basma-slideup{animation:slideUp .35s ease both}",
    ".basma-slidedown{animation:slideDown .3s ease both}",
    ".basma-pulse{animation:pulse 1.5s ease infinite}",
    ".basma-flip-container{perspective:600px;width:100%}",
    ".basma-flip-inner{position:relative;width:100%;transition:transform .6s;transform-style:preserve-3d}",
    ".basma-flip-inner.flipped{transform:rotateX(180deg)}",
    ".basma-flip-front,.basma-flip-back{backface-visibility:hidden;width:100%}",
    ".basma-flip-back{transform:rotateX(180deg);position:absolute;top:0;left:0;right:0}",
    "input::placeholder{color:rgba(255,255,255,.4)!important}",
    "button:active{transform:scale(.96)!important}",
  ].join("\n");
  document.head.appendChild(style);
}

/* ── API Helper ── */
async function api(action, opts = {}) {
  const { method = "GET", body, params = {} } = opts;
  const q = new URLSearchParams({ action, ...params }).toString();
  const cfg = { method, headers: {} };
  if (body) { cfg.headers["Content-Type"] = "application/json"; cfg.body = JSON.stringify(body); }
  const r = await fetch("/api/data?" + q, cfg);
  return r.json();
}

/* ── Date Helpers ── */
const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function formatArabicDate(d) {
  return AR_DAYS[d.getDay()] + "، " + d.getDate() + " " + AR_MONTHS[d.getMonth()] + " " + d.getFullYear();
}

function formatTime(d) {
  let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  const ampm = h >= 12 ? "م" : "ص";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { time: String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"), sec: String(s).padStart(2, "0"), ampm };
}

function formatTimeStr(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const { time, ampm } = formatTime(d);
  return time + " " + ampm;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

function timeToMin(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/* ── Membership Levels (المتفق عليه) ── */
const MEMBERSHIP = [
  { id: 0, name: "عضوية فعّال", icon: "🔹", color: "#2b5ea7", bg: "#2b5ea718", min: 0 },
  { id: 1, name: "عضوية تميّز", icon: "🥈", color: "#6B7280", bg: "#F3F4F6", min: 750 },
  { id: 2, name: "عضوية نخبة", icon: "🥇", color: "#D4A017", bg: "#FFF3C4", min: 1500 },
];

function memberBadge(points) {
  var lvl = MEMBERSHIP[0];
  for (var i = MEMBERSHIP.length - 1; i >= 0; i--) {
    if (points >= MEMBERSHIP[i].min) { lvl = MEMBERSHIP[i]; break; }
  }
  var nextLvl = MEMBERSHIP[lvl.id + 1] || null;
  var progress = nextLvl ? Math.round(((points - lvl.min) / (nextLvl.min - lvl.min)) * 100) : 100;
  return {
    icon: lvl.icon, label: lvl.name, color: lvl.color, bg: lvl.bg, tier: lvl.id,
    next: nextLvl ? nextLvl.min : null,
    nextLabel: nextLvl ? nextLvl.name + " " + nextLvl.icon : null,
    progress: Math.min(100, progress),
    remaining: nextLvl ? nextLvl.min - points : 0,
  };
}

/* ── Points Rules (نظام النقاط المتفق عليه) ── */
const POINTS = {
  checkin_ontime: 10,      // بصمة بوقتها
  checkin_early: 10,       // بونص بصمة مبكرة (أول 15 ثانية)
  challenge_correct: 25,   // تحدي الصباح — إجابة صحيحة
  adhkar: 5,               // أذكار رمضان
  profile_complete: 50,    // اكتمال الملف الشخصي (مرة واحدة)
  app_daily_use: 2,        // استخدام التطبيق يومياً
};

/* ── Points Criteria Weights (أوزان معايير العضوية) ── */
const CRITERIA_WEIGHTS = {
  attendance: 40,   // حضور وانصراف
  challenge: 15,    // تحدي الصباح والتفاعل
  profile: 15,      // اكتمال الملف الشخصي
  apps: 15,         // استخدام تطبيقات المكتب (كوادر + بصمة)
  ai: 15,           // الذكاء الاصطناعي (مستقبلاً)
};

/* ── Membership Note ── */
const MEMBERSHIP_NOTE = "هذه العضوية مقياس ذاتي تلقائي لانضباط الموظف والتزامه باستخدام وسائل وتطبيقات المكتب — وليست مقياساً للأداء الوظيفي السنوي.";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeToAngle(h, m) { return ((h % 12) + (m || 0) / 60) * 30 - 90; }

/* ── Clock Checkpoint Positions ── */
var CPS = [
  { label: "حضور", h: 8, m: 30, icon: "☀️", color: "#2b5ea7" },
  { label: "استراحة", h: 12, m: 30, icon: "☕", color: "#f59e0b" },
  { label: "عودة", h: 13, m: 0, icon: "🔄", color: "#10b981" },
  { label: "انصراف", h: 17, m: 0, icon: "🌙", color: "#6366f1" },
];

/* ── Challenge Questions (5 أنواع متفق عليها) ── */
const CHALLENGES = [
  { q: "أكمل: سبحان الله وبحمده ...", opts: ["سبحان الله العظيم","الحمد لله رب العالمين","لا إله إلا الله"], correct: 0, type: "ذكر" },
  { q: "دعاء الصباح: اللهم بك أصبحنا وبك ...", opts: ["أمسينا","حيينا","توكلنا"], correct: 0, type: "ذكر" },
  { q: "ما وحدة قياس قوة الخرسانة؟", opts: ["نيوتن","ميجا باسكال","كيلو جرام"], correct: 1, type: "هندسي" },
  { q: "ما هو الحد الأدنى لغطاء الخرسانة للأعمدة؟", opts: ["25 مم","40 مم","75 مم"], correct: 1, type: "هندسي" },
  { q: "كم يوم يلزم لمعالجة الخرسانة بالماء؟", opts: ["3 أيام","7 أيام","14 يوم"], correct: 1, type: "هندسي" },
  { q: "ما الشيء الذي يمشي بلا أرجل؟", opts: ["الماء","الوقت","الهواء"], correct: 1, type: "لغز" },
  { q: "كم عدد أركان الإسلام؟", opts: ["ثلاثة","خمسة","سبعة"], correct: 1, type: "عام" },
  { q: "كم ركعة صلاة التراويح؟", opts: ["8 أو 20","12","6"], correct: 0, type: "عام" },
  { q: "ما هي نسبة الماء إلى الأسمنت المثالية؟", opts: ["0.30","0.45","0.60"], correct: 1, type: "هندسي" },
  { q: "ما أول شي يُراجع عند استلام موقع جديد؟", opts: ["المخططات","الميزانية","المعدات"], correct: 0, type: "هندسي" },
  // أسئلة نظام العمل
  { q: "كم يوم مدة التظلم من جزاء تأديبي؟", opts: ["يوم واحد","3 أيام عمل","7 أيام"], correct: 1, type: "نظام العمل" },
  { q: "بعد كم يوم غياب متصل يُفسخ العقد (م.80)؟", opts: ["10 أيام","15 يوم","30 يوم"], correct: 1, type: "نظام العمل" },
  { q: "كم يوم الإجازة السنوية لمن خدم أقل من 5 سنوات؟", opts: ["15 يوم","21 يوم","30 يوم"], correct: 1, type: "نظام العمل" },
  { q: "بعد كم يوم من المخالفة لا يُعتبر عائداً (م.44)؟", opts: ["90 يوم","180 يوم","365 يوم"], correct: 1, type: "نظام العمل" },
  { q: "كم ساعة عمل يومياً في رمضان للمسلمين؟", opts: ["5 ساعات","6 ساعات","7 ساعات"], correct: 1, type: "نظام العمل" },
  // أسئلة سلامة
  { q: "ما أول إجراء عند اكتشاف حريق في الموقع؟", opts: ["إطفاء الحريق","إنذار الجميع والإخلاء","الاتصال بالشرطة"], correct: 1, type: "سلامة" },
  { q: "ما لون خوذة السلامة للمهندس عادة؟", opts: ["أبيض","أصفر","أحمر"], correct: 0, type: "سلامة" },
  { q: "كم المسافة الآمنة من حافة الحفريات؟", opts: ["0.5 متر","1 متر","2 متر"], correct: 2, type: "سلامة" },
  // أسئلة هندسية
  { q: "ما الفرق بين الإسمنت البورتلاندي العادي والمقاوم؟", opts: ["اللون","مقاومة الكبريتات","السعر"], correct: 1, type: "هندسي" },
  { q: "ما الحد الأقصى لـ slump الخرسانة العادية؟", opts: ["50 مم","100 مم","150 مم"], correct: 1, type: "هندسي" },
  { q: "ما المسافة بين أعمدة القالب (الشدّة) عادة؟", opts: ["50 سم","100 سم","200 سم"], correct: 1, type: "هندسي" },
  { q: "كم يوم قبل فك شدّة البلاطة؟", opts: ["3 أيام","7 أيام","21 يوم"], correct: 2, type: "هندسي" },
  // أسئلة عامة
  { q: "ما عاصمة المملكة العربية السعودية؟", opts: ["جدة","الرياض","مكة"], correct: 1, type: "عام" },
  { q: "في أي سنة تأسست المملكة؟", opts: ["1902","1932","1945"], correct: 1, type: "عام" },
  { q: "كم عدد مناطق المملكة الإدارية؟", opts: ["10","13","15"], correct: 1, type: "عام" },
  { q: "ما هي رؤية المملكة؟", opts: ["رؤية 2025","رؤية 2030","رؤية 2035"], correct: 1, type: "عام" },
  { q: "ما الطعم الذي لا تستطيع الطيور تذوقه؟", opts: ["المالح","الحار","الحلو"], correct: 1, type: "لغز" },
  { q: "كم عدد العظام في جسم الإنسان البالغ؟", opts: ["176","206","256"], correct: 1, type: "عام" },
  { q: "ما أقوى عضلة في جسم الإنسان؟", opts: ["القلب","اللسان","الفك"], correct: 2, type: "عام" },
  { q: "أكمل الحديث: إنما الأعمال ...", opts: ["بالنيات","بالخواتيم","بالإخلاص"], correct: 0, type: "ذكر" },
];

/* ── Mascot Messages ── */
const MASCOT = {
  idle: "صباح الخير! يوم عمل موفّق ☀️",
  challenge: "حان وقت تحدي الصباح! ⚡",
  correct: "إجابة صحيحة! ممتاز 🎉",
  wrong: "حاول مرة ثانية غداً 💪",
  checkin: "وقت تسجيل الحضور! 📍",
  scanning: "انظر إلى الكاميرا... 📸",
  done: "تم التسجيل بنجاح! ✓",
  streak: "استمر! أنت في سلسلة رائعة 🔥",
  offday: "يوم إجازة — استمتع بوقتك 🏖️",
};

/* ── Adhkar (Ramadan) ── */
const ADHKAR = [
  "سبحان الله وبحمده، سبحان الله العظيم",
  "لا حول ولا قوة إلا بالله",
  "اللهم إنك عفو تحب العفو فاعفُ عني",
  "رب اغفر لي وتب عليّ إنك أنت التواب الرحيم",
  "اللهم بارك لنا في رمضان وبلّغنا ليلة القدر",
];

/* ── Coupons (امتيازات العضوية) ── */
const COUPONS = [
  { id: 1, brand: "مطعم البيك", discount: "خصم 15%", icon: "🍔", pts: 50, cat: "مطاعم", minTier: 0 },
  { id: 2, brand: "كافيه سبشالتي", discount: "قهوة مجانية", icon: "☕", pts: 15, cat: "مطاعم", minTier: 0 },
  { id: 3, brand: "غسيل سيارات بريق", discount: "غسلة مجانية", icon: "🚗", pts: 30, cat: "خدمات", minTier: 0 },
  { id: 4, brand: "مكتبة جرير", discount: "خصم 20%", icon: "📚", pts: 80, cat: "تسوق", minTier: 0 },
  { id: 5, brand: "صالة فيتنس تايم", discount: "شهر مجاني", icon: "💪", pts: 200, cat: "رياضة", minTier: 1 },
  { id: 6, brand: "مركز صيانة", discount: "خصم 30%", icon: "📱", pts: 60, cat: "خدمات", minTier: 1 },
  { id: 7, brand: "مطعم الرومانسية", discount: "وجبة عائلية", icon: "🍽", pts: 120, cat: "مطاعم", minTier: 1 },
  { id: 8, brand: "فندق إقامة VIP", discount: "ليلة مجانية", icon: "🏨", pts: 500, cat: "سفر", minTier: 2 },
];

const RAMADAN_COUPONS = [
  { id: 101, brand: "بوفيه إفطار فندقي", discount: "خصم 40%", icon: "🌙", pts: 80, cat: "رمضان", minTier: 0 },
  { id: 102, brand: "تمور العجوة", discount: "علبة هدية", icon: "🌴", pts: 40, cat: "رمضان", minTier: 0 },
  { id: 103, brand: "قهوة عربية فاخرة", discount: "علبة مجانية", icon: "☕", pts: 60, cat: "رمضان", minTier: 1 },
];

/* ── GPS Tracking Config ── */
const GPS_TRACK_INTERVAL = 300000; // كل 5 دقائق
const GPS_OFFLINE_KEY = "basma_gps_queue";

function queueGpsOffline(record) {
  try {
    var queue = JSON.parse(localStorage.getItem(GPS_OFFLINE_KEY) || "[]");
    queue.push(record);
    if (queue.length > 288) queue = queue.slice(-288);
    localStorage.setItem(GPS_OFFLINE_KEY, JSON.stringify(queue));
  } catch(e) { /**/ }
}

/* ── Call Notification System (4 أوقات متفق عليها) ── */
// اتصال 1: بداية الدوام بالضبط
// اتصال 2: بعد 10 دقائق لو ما حضر (فقط لو في النطاق)
// اتصال 3: قبل الاستراحة بـ 2-7 دقائق (عشوائي لكل موظف)
// اتصال 4: بعد انتهاء الاستراحة بـ 2-7 دقائق (عشوائي)
// لا اتصال عند الانصراف — فقط الدائرة
// لا اتصال لو الموظف في إجازة
const CALL_RETRY_DELAY = 10; // دقائق
const BREAK_RANDOM_MIN = 2;
const BREAK_RANDOM_MAX = 7;

function getBreakOffset() {
  return BREAK_RANDOM_MIN + Math.floor(Math.random() * (BREAK_RANDOM_MAX - BREAK_RANDOM_MIN + 1));
}

/* ── Labor Law Violations (لائحة العمل السعودية) ── */
/* ═══════════ ERROR BOUNDARY ═══════════ */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", { style: { minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" } },
        React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "⚠️"),
        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, fontFamily: "'Cairo',sans-serif", marginBottom: 8 } }, "حدث خطأ غير متوقع"),
        React.createElement("div", { style: { fontSize: 12, color: C.sub, marginBottom: 20 } }, String(this.state.error && this.state.error.message || "")),
        React.createElement("button", { onClick: function(){ window.location.reload(); }, style: { padding: "12px 32px", borderRadius: 14, background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" } }, "🔄 إعادة تحميل")
      );
    }
    return this.props.children;
  }
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function MobileApp() {
  return React.createElement(ErrorBoundary, null, React.createElement(MobileAppInner, null));
}

function MobileAppInner() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(function(){ return localStorage.getItem("basma_page") || "home"; });

  // Persist page across refresh
  useEffect(function(){ localStorage.setItem("basma_page", page); }, [page]);

  // Listen for "go to legal" event from InvestigationBanner
  useEffect(function() {
    function handleGotoLegal() {
      setPage("profile");
      // Set profile to legal tab
      setTimeout(function(){ localStorage.setItem("basma_profile_tab", "legal"); window.dispatchEvent(new CustomEvent("basma:profile-tab-changed")); }, 50);
    }
    window.addEventListener("basma:goto-legal", handleGotoLegal);
    return function() { window.removeEventListener("basma:goto-legal", handleGotoLegal); };
  }, []);
  const [branch, setBranch] = useState(null);
  const [darkMode, setDarkMode] = useState(function(){ 
    var saved = localStorage.getItem("basma_dark");
    return saved === null ? true : saved === "1";
  });
  const [todayAtt, setTodayAtt] = useState([]);
  const [allAtt, setAllAtt] = useState([]);
  const [now, setNow] = useState(new Date());
  const [gps, setGps] = useState(null);
  const [gpsDist, setGpsDist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [consentGiven, setConsentGiven] = useState(function(){
    var saved = localStorage.getItem("basma_consent_date");
    if (!saved) return false;
    // Reset at beginning of each month
    var now = new Date();
    var savedDate = new Date(saved);
    if (now.getFullYear() !== savedDate.getFullYear() || now.getMonth() !== savedDate.getMonth()) return false;
    return true;
  });
  const [confirmModal, setConfirmModal] = useState(null);
  const [faceModal, setFaceModal] = useState(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [ticketModal, setTicketModal] = useState(false);
  const [daySummary, setDaySummary] = useState(false);
  const [preAbsModal, setPreAbsModal] = useState(false);
  const [manualAttModal, setManualAttModal] = useState(false);
  const [permModal, setPermModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [teamToday, setTeamToday] = useState([]);
  const [allEmps, setAllEmps] = useState([]);
  const [kadwarNotifs, setKadwarNotifs] = useState({ tasks: 0, exams: 0, alerts: 0 });
  const [legalAlerts, setLegalAlerts] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [callBanner, setCallBanner] = useState(null); // { type, msg }
  const [fakeCall, setFakeCall] = useState(null); // { type, label } — fake incoming call screen
  const [autoCheckinPrompt, setAutoCheckinPrompt] = useState(null); // { type, label } — auto-triggered checkin
  const [faceVerifyModal, setFaceVerifyModal] = useState(null); // { type, label, source }
  const [initDone, setInitDone] = useState(false);

  // Apply dark mode
  useEffect(function() {
    C = darkMode ? DARK : LIGHT;
    S = buildS();
    setTheme(darkMode);  // Sync new theme system
    document.body.style.background = darkMode ? DARK.hdr3 : LIGHT.hdr3;
    localStorage.setItem("basma_dark", darkMode ? "1" : "0");
    // Force re-render by updating a state
    setThemeVersion(function(v){ return v + 1; });
  }, [darkMode]);

  var [themeVersion, setThemeVersion] = useState(0);

  function toggleDark() { setDarkMode(function(d){ return !d; }); }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function isOffDay() {
    if (!branch) return false;
    const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return now.getDay() === (dayMap[branch.offDay] !== undefined ? dayMap[branch.offDay] : 5);
  }

  async function refresh() {
    if (!user || refreshing) return;
    setRefreshing(true);
    await loadData(user);
    setRefreshing(false);
    showToast("تم التحديث ✓");
  }

  useEffect(() => {
    const saved = localStorage.getItem("basma_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        loadData(u).then(() => setInitDone(true));
      } catch { setInitDone(true); }
    } else { setInitDone(true); }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // PWA install prompt
  useEffect(() => {
    function handlePrompt(e) { e.preventDefault(); setPwaPrompt(e); }
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  useEffect(() => {
    if (!user || !navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, [user]);

  useEffect(() => {
    if (gps && branch) setGpsDist(Math.round(haversine(gps.lat, gps.lng, branch.lat, branch.lng)));
  }, [gps, branch]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => { loadData(user); }, 300000);
    return () => clearInterval(t);
  }, [user]);

  // GPS tracking every 5 minutes + offline queue
  useEffect(() => {
    if (!user || !navigator.geolocation) return;
    function trackGps() {
      navigator.geolocation.getCurrentPosition(function(pos) {
        var record = { empId: user.id, lat: pos.coords.latitude, lng: pos.coords.longitude, ts: new Date().toISOString(), accuracy: pos.coords.accuracy };
        if (navigator.onLine) {
          // Send directly
          api("gps_log", { method: "POST", body: record }).catch(function(){
            // If send fails, queue locally
            queueGpsOffline(record);
          });
        } else {
          // Store locally for later upload
          queueGpsOffline(record);
        }
      }, function(){}, { enableHighAccuracy: true, timeout: 15000 });
    }
    // Track immediately + every 5 minutes
    trackGps();
    var t = setInterval(trackGps, GPS_TRACK_INTERVAL);
    return function() { clearInterval(t); };
  }, [user]);

  // Sync offline GPS queue when back online
  useEffect(() => {
    function syncGpsQueue() {
      try {
        var queue = JSON.parse(localStorage.getItem(GPS_OFFLINE_KEY) || "[]");
        if (queue.length === 0) return;
        // Send all queued records
        var remaining = [];
        queue.forEach(function(record) {
          api("gps_log", { method: "POST", body: record }).catch(function() {
            remaining.push(record);
          });
        });
        // Keep failed ones
        setTimeout(function() {
          localStorage.setItem(GPS_OFFLINE_KEY, JSON.stringify(remaining));
        }, 5000);
      } catch(e) { /**/ }
    }
    if (online && user) syncGpsQueue();
  }, [online, user]);

  // ═══ New Call Engine + Auto-Checkin ═══
  useEffect(function() {
    if (!user || !branch) return;
    if (user.onLeave) return;

    var hasCheckin = todayAtt.some(function(r){ return r.type === "checkin"; });
    var hasBreakS = todayAtt.some(function(r){ return r.type === "break_start"; });
    var hasBreakE = todayAtt.some(function(r){ return r.type === "break_end"; });
    var inR = gpsDist !== null && gpsDist <= (branch.radius || 150);

    var mins = now.getHours() * 60 + now.getMinutes();
    var startMin = timeToMin(branch.start);
    var breakSMin = branch.breakS ? timeToMin(branch.breakS) : startMin + 240;
    var breakEMin = branch.breakE ? timeToMin(branch.breakE) : breakSMin + 30;

    // Generate stable random offset per session (0-4 minutes)
    if (!window.__basmaCallOffsets) {
      var seed = parseInt(String(user.id).replace(/\D/g, '').slice(-4) || '0', 10);
      window.__basmaCallOffsets = {
        checkin: (seed * 7) % 5,       // 0-4 min after start
        breakEnd: (seed * 11) % 5,     // 0-4 min after break end
      };
    }
    var offsets = window.__basmaCallOffsets;
    var fakeCallKey = 'basma_fake_call_' + todayStr();
    var shown = {};
    try { shown = JSON.parse(sessionStorage.getItem(fakeCallKey) || '{}'); } catch(e) { shown = {}; }

    // 1. إذا الموظف داخل النطاق ولم يسجل حضور → سجل تلقائياً
    if (inR && !hasCheckin && mins >= startMin - 30 && mins <= startMin + 60) {
      // auto-trigger face verification modal
      if (!window.__autoCheckinTriggered) {
        window.__autoCheckinTriggered = true;
        setAutoCheckinPrompt({ type: "checkin", label: "تسجيل الحضور" });
      }
    }

    // 2. اتصال تذكير: إذا لم يبصم خلال 5 دقائق من بداية الدوام (بتوقيت عشوائي)
    var checkinCallAt = startMin + offsets.checkin;
    if (mins === checkinCallAt && !hasCheckin && !shown.checkinCall) {
      shown.checkinCall = true;
      sessionStorage.setItem(fakeCallKey, JSON.stringify(shown));
      setFakeCall({ type: "checkin", label: "تسجيل الحضور" });
    }

    // 3. اتصال تذكير: إذا انتهت الاستراحة ولم يسجل عودة (بتوقيت عشوائي)
    var breakEndCallAt = breakEMin + offsets.breakEnd;
    if (mins === breakEndCallAt && hasBreakS && !hasBreakE && !shown.breakCall) {
      shown.breakCall = true;
      sessionStorage.setItem(fakeCallKey, JSON.stringify(shown));
      setFakeCall({ type: "break_end", label: "العودة من الاستراحة" });
    }
  }, [user, branch, now, todayAtt, gpsDist]);

  // ═══ Listen for Service Worker messages (fake call from notification click) ═══
  useEffect(function() {
    if (!user) return;
    function handleSwMsg(event) {
      if (event.data && event.data.type === 'fake_call') {
        var callType = event.data.callType || 'checkin';
        var label = callType === 'checkin' ? 'تسجيل الحضور' : callType === 'break_end' ? 'العودة من الاستراحة' : 'التسجيل';
        setFakeCall({ type: callType, label: label });
      }
    }
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleSwMsg);
    }

    // ═══ Subscribe to Web Push ═══
    async function subscribeToPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (typeof Notification === 'undefined') return;

      try {
        // Request permission if needed
        if (Notification.permission === 'default') {
          var perm = await Notification.requestPermission();
          if (perm !== 'granted') return;
        }
        if (Notification.permission !== 'granted') return;

        // Get VAPID public key from server
        var keyR = await fetch('/api/data?action=vapid-public-key');
        var keyD = await keyR.json();
        if (!keyD.publicKey) {
          console.log('[PUSH] VAPID public key not configured on server');
          return;
        }

        // Convert base64 public key to Uint8Array
        function urlBase64ToUint8Array(base64String) {
          var padding = '='.repeat((4 - base64String.length % 4) % 4);
          var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
          var raw = window.atob(base64);
          var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          return arr;
        }

        // Register SW and subscribe
        var reg = await navigator.serviceWorker.ready;
        var existingSub = await reg.pushManager.getSubscription();
        var subscription = existingSub;
        if (!existingSub) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyD.publicKey),
          });
        }

        // Send subscription to server
        await fetch('/api/data?action=subscribe-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empId: user.id, subscription: subscription }),
        });
        console.log('[PUSH] Subscribed successfully');
      } catch(e) {
        console.log('[PUSH] Subscribe failed:', e.message);
      }
    }
    subscribeToPush();

    // ═══ Polling fallback — check for new notifications every 15 seconds ═══
    var lastCheckedId = null;
    async function pollNotifications() {
      try {
        var r = await fetch('/api/data?action=notifications&empId=' + user.id);
        var notifs = await r.json();
        if (!Array.isArray(notifs) || notifs.length === 0) return;
        // Find most recent unread notification
        var unread = notifs.filter(function(n){ return !n.read; });
        if (unread.length === 0) return;
        var latest = unread[0];
        if (latest.id === lastCheckedId) return;
        lastCheckedId = latest.id;

        // Trigger fake call if it's a fake_call type
        if (latest.fakeCall || latest.type === 'fake_call') {
          var ct = latest.callType || 'checkin';
          var label = ct === 'checkin' ? 'تسجيل الحضور' : ct === 'break_end' ? 'العودة من الاستراحة' : 'التسجيل';
          setFakeCall({ type: ct, label: label });
        } else if (latest.type === 'test') {
          // Show in-app toast for regular notifications
          setToast({ msg: '📢 ' + latest.title + ': ' + latest.message, type: 'info' });
        }
      } catch(e) { /**/ }
    }
    var pollInterval = setInterval(pollNotifications, 15000);
    pollNotifications(); // immediate first check

    return function() {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleSwMsg);
      }
      clearInterval(pollInterval);
    };
  }, [user]);

  async function loadData(emp) {
    try {
      const branches = await api("branches");
      const b = branches.find(x => x.id === emp.branch);
      if (b) setBranch(b);
      const recs = await api("attendance", { params: { empId: emp.id } });
      setAllAtt(recs);
      setTodayAtt(recs.filter(r => r.date === todayStr()));
      let s = 0;
      const d = new Date();
      for (let i = 1; i <= 60; i++) {
        d.setDate(d.getDate() - 1);
        if (recs.some(r => r.date === d.toISOString().split("T")[0] && r.type === "checkin")) s++;
        else break;
      }
      setStreak(s);
      // Fetch leaves and tickets
      try {
        const allLeaves = await api("leaves");
        setMyLeaves((allLeaves || []).filter(function(l){ return l.empId === emp.id; }));
      } catch(e) { /**/ }
      try {
        const allTickets = await api("tickets");
        setMyTickets((allTickets || []).filter(function(t){ return t.empId === emp.id; }));
      } catch(e) { /**/ }
      // Fetch team data for managers
      if (emp.isManager || emp.isAssistant) {
        try {
          var emps = await api("employees");
          setAllEmps(emps || []);
          var todayAllAtt = await api("attendance", { params: { date: todayStr() } });
          var presentIds = new Set((todayAllAtt || []).filter(function(r){ return r.type === "checkin"; }).map(function(r){ return r.empId; }));
          setTeamToday((emps || []).map(function(e) {
            return { id: e.id, name: e.name, role: e.role, present: presentIds.has(e.id) };
          }));
        } catch(e) { /**/ }
      }
      // Fetch kadwar notifications (from shared database)
      try {
        var notifs = await api("kadwar_notifs", { params: { empId: emp.id } });
        if (notifs && !notifs.error) setKadwarNotifs({ tasks: notifs.tasks || 0, exams: notifs.exams || 0, alerts: notifs.alerts || 0 });
      } catch(e) { /**/ }
      // Fetch legal alerts (pending investigations + active violations)
      try {
        var invs = await api("investigations", { params: { empId: emp.id, status: "WAITING_RESPONSE" } });
        var vios = await api("violations_v2", { params: { empId: emp.id, status: "ACTIVE" } });
        setLegalAlerts(((invs || []).length) + ((vios || []).length));
      } catch(e) { /**/ }
      // Fetch notifications
      try {
        var allNotifs = await api("notifications", { params: { empId: emp.id } });
        setNotifications(allNotifs || []);
        setUnreadCount((allNotifs || []).filter(function(n){ return !n.read; }).length);
      } catch(e) { /**/ }
    } catch { /**/ }
  }

  async function handleLogin(username, password) {
    setLoading(true);
    try {
      const r = await api("login", { method: "POST", body: { username: username, password: password } });
      if (r.ok) {
        setUser(r.employee);
        localStorage.setItem("basma_user", JSON.stringify(r.employee));
        await loadData(r.employee);
        setInitDone(true);
        return null;
      }
      return r.error || "خطأ غير متوقع";
    } catch (e) { return e.message; }
    finally { setLoading(false); }
  }

  function requestCheckin(type, label) { setConfirmModal({ type, label }); }

  function confirmCheckin() {
    const { type } = confirmModal;
    setConfirmModal(null);
    var badge = memberBadge(user.points || 0);
    // Silver+ (tier >= 2): skip face verification
    if (badge.tier >= 2) { doCheckin(type); return; }
    if (type === "checkin" || type === "checkout") { setFaceModal({ type }); }
    else { doCheckin(type); }
  }

  async function doCheckin(type, facePhoto) {
    setFaceModal(null);
    if (!user) return;
    setLoading(true);
    try {
      var badge = memberBadge(user.points || 0);
      var outsideRange = branch && gpsDist !== null && gpsDist > (branch.radius || 150);

      // Geofence violation — عضوية نخبة معفاة
      if (outsideRange && (type === "checkin" || type === "checkout") && badge.tier < 2) {
        try { await api("violations", { method: "POST", body: { empId: user.id, type: "geofence", details: "تسجيل من خارج النطاق (" + gpsDist + " م)", date: todayStr() } }); } catch(e) { /**/ }
      }

      var checkinBody = { empId: user.id, type: type, lat: gps ? gps.lat : null, lng: gps ? gps.lng : null, facePhoto: facePhoto };

      // Offline support — تخزين محلي + رفع لاحق
      if (!navigator.onLine) {
        var offlineRec = { ...checkinBody, ts: new Date().toISOString(), date: todayStr(), id: "OFF_" + Date.now(), offline: true };
        var offQ = JSON.parse(localStorage.getItem("basma_checkin_queue") || "[]");
        offQ.push(offlineRec);
        localStorage.setItem("basma_checkin_queue", JSON.stringify(offQ));
        setTodayAtt(function(prev) { return [].concat(prev, [offlineRec]); });
        showToast("📴 تم الحفظ محلياً — سيُرفع عند عودة الاتصال");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setLoading(false);
        return;
      }

      var r = await api("checkin", { method: "POST", body: checkinBody });
      if (r.ok) {
        setTodayAtt(function(prev) { return [].concat(prev, [r.record]); });
        var labels = { checkin: MASCOT.done, break_start: "بداية الاستراحة ☕", break_end: "تم تسجيل العودة 🔄", checkout: "تم تسجيل الانصراف 🌙" };
        showToast(labels[type] || "تم التسجيل ✓");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        if (outsideRange && badge.tier < 2) setTimeout(function(){ showToast("⚠️ تم التسجيل من خارج نطاق العمل", "warning"); }, 3200);

        // Bonus points — بصمة مبكرة (أول 15 ثانية من بداية الدوام)
        if (type === "checkin" && branch) {
          var startMin = timeToMin(branch.start);
          var nowMin = now.getHours() * 60 + now.getMinutes();
          var diff = nowMin - startMin;
          if (diff >= 0 && diff * 60 + now.getSeconds() <= 15) {
            showToast("🎯 بونص بصمة مبكرة! +" + POINTS.checkin_early + " نقطة", "success");
          }
        }

        // Refresh employee data
        var emps = await api("employees");
        var me = emps.find(function(e) { return e.id === user.id; });
        if (me) { setUser(me); localStorage.setItem("basma_user", JSON.stringify(me)); }

        if (type === "checkout") setTimeout(function(){ setDaySummary(true); }, 1500);
      } else { showToast("حدث خطأ في التسجيل", "error"); }
    } catch(e) { showToast("خطأ في الاتصال — تم الحفظ محلياً", "error"); }
    finally { setLoading(false); }
  }

  // Sync offline checkin queue when back online
  useEffect(function() {
    if (!online || !user) return;
    var queue = JSON.parse(localStorage.getItem("basma_checkin_queue") || "[]");
    if (queue.length === 0) return;
    var synced = 0;
    queue.forEach(function(rec) {
      api("checkin", { method: "POST", body: rec }).then(function() { synced++; }).catch(function(){});
    });
    localStorage.setItem("basma_checkin_queue", "[]");
    setTimeout(function() {
      if (synced > 0) showToast("☁️ تم رفع " + synced + " بصمة محفوظة", "success");
      loadData(user);
    }, 3000);
  }, [online]);

  function logout() {
    setUser(null); setBranch(null); setTodayAtt([]); setAllAtt([]);
    localStorage.removeItem("basma_user");
    setPage("home");
  }

  function getDayState() {
    if (!branch) return "before";
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < timeToMin(branch.start)) return "before";
    if (mins >= timeToMin(branch.end)) return "after";
    return "during";
  }

  function getCheckpoints() {
    const has = t => todayAtt.some(r => r.type === t);
    return { checkin: has("checkin"), breakStart: has("break_start"), breakEnd: has("break_end"), checkout: has("checkout") };
  }

  if (!initDone) return <SplashScreen />;
  if (!user) return <LoginScreen onLogin={handleLogin} loading={loading} />;
  if (!consentGiven) return <ConsentScreen onAccept={function(){ localStorage.setItem("basma_consent_date", new Date().toISOString()); setConsentGiven(true); }} />;

  return (
    <div style={S.phone}>
      {!online && <div style={{ background: C.red, color: "#fff", textAlign: "center", padding: "6px 0", fontSize: 11, fontWeight: 700 }}>⚠️ لا يوجد اتصال بالإنترنت</div>}

      <div key={page} style={{ flex: 1, display: "flex", flexDirection: "column", animation: "pageIn .3s ease" }}>
        {page === "home" && <HomePage user={user} branch={branch} now={now} todayAtt={todayAtt} allAtt={allAtt} gps={gps} gpsDist={gpsDist} streak={streak} loading={loading} refreshing={refreshing} dayState={getDayState()} checkpoints={getCheckpoints()} isOffDay={isOffDay()} pendingCount={myLeaves.filter(function(l){ return l.status === "pending"; }).length + myTickets.filter(function(t){ return t.status === "pending"; }).length} teamToday={teamToday} pwaPrompt={pwaPrompt} onPwaInstall={async function(){ if(pwaPrompt){pwaPrompt.prompt();await pwaPrompt.userChoice;setPwaPrompt(null);} }} onCheckin={requestCheckin} onChallenge={function(pts) { var u = { ...user, points: (user.points||0)+pts }; setUser(u); localStorage.setItem("basma_user", JSON.stringify(u)); showToast("🎉 +" + pts + " نقطة!"); }} onLeave={() => setLeaveModal(true)} onRefresh={refresh} onPreAbsence={function(){ setPreAbsModal(true); }} onManualAtt={function(){ setManualAttModal(true); }} onPermission={function(){ setPermModal(true); }} kadwarNotifs={kadwarNotifs} darkMode={darkMode} />}
        {page === "report" && <ReportPage user={user} allAtt={allAtt} todayAtt={todayAtt} branch={branch} isOffDay={isOffDay()} myLeaves={myLeaves} allEmps={allEmps} />}
        {page === "benefits" && <BenefitsPage user={user} />}
        {page === "profile" && <ProfilePage user={user} branch={branch} onLogout={logout} onTicket={() => setTicketModal(true)} myTickets={myTickets} darkMode={darkMode} toggleDark={toggleDark} />}
      </div>

      <BottomNav page={page} setPage={setPage} legalAlerts={legalAlerts} />

      {/* Notification Bell — floating */}
      {user && unreadCount > 0 && !showNotifs && (
        <button onClick={function(){ setShowNotifs(true); }} style={{ position: "fixed", top: 16, left: 16, zIndex: 60, width: 44, height: 44, borderRadius: 22, background: COLORS.textDanger, border: "none", boxShadow: "0 4px 12px rgba(226,25,44,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 2s infinite" }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <div style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: COLORS.textDanger }}>{unreadCount}</div>
        </button>
      )}

      {/* Notification Panel */}
      {showNotifs && <NotificationPanel notifications={notifications} onClose={function(){ setShowNotifs(false); }} onMarkRead={async function(){
        try { await api("notifications", { method: "PUT", body: { markAllRead: true, empId: user.id } }); setUnreadCount(0); setNotifications(function(prev){ return prev.map(function(n){ return {...n, read: true}; }); }); } catch(e) {}
      }} onGoToLegal={function(){ setShowNotifs(false); setPage("profile"); setTimeout(function(){ localStorage.setItem("basma_profile_tab","legal"); window.dispatchEvent(new CustomEvent("basma:profile-tab-changed")); }, 50); }} />}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {callBanner && <CallBanner type={callBanner.type} msg={callBanner.msg} onDismiss={function(){ setCallBanner(null); }} />}
      {fakeCall && <FakeCallScreen type={fakeCall.type} label={fakeCall.label} user={user} onAnswer={function(){ var fc = fakeCall; setFakeCall(null); setFaceVerifyModal({ type: fc.type, label: fc.label, source: "call" }); }} onDecline={function(){ setFakeCall(null); }} />}
      {autoCheckinPrompt && <AutoCheckinBanner label={autoCheckinPrompt.label} onConfirm={function(){ var p = autoCheckinPrompt; setAutoCheckinPrompt(null); setFaceVerifyModal({ type: p.type, label: p.label, source: "auto" }); }} onDismiss={function(){ setAutoCheckinPrompt(null); window.__autoCheckinTriggered = false; }} />}
      {faceVerifyModal && <FaceModal empId={user.id} onVerified={function(photo){ doCheckin(faceVerifyModal.type, photo); setFaceVerifyModal(null); }} onSkip={function(){ setFaceVerifyModal(null); }} onCancel={function(){ setFaceVerifyModal(null); }} />}
      {confirmModal && <ConfirmModal label={confirmModal.label} onConfirm={confirmCheckin} onCancel={() => setConfirmModal(null)} />}
      {faceModal && <FaceModal empId={user.id} onVerified={(photo) => doCheckin(faceModal.type, photo)} onSkip={() => doCheckin(faceModal.type)} onCancel={() => setFaceModal(null)} />}
      {challengeOpen && <ChallengeModal user={user} onClose={() => setChallengeOpen(false)} onPoints={(pts) => { const u = { ...user, points: (user.points||0)+pts }; setUser(u); localStorage.setItem("basma_user", JSON.stringify(u)); showToast("🎉 +" + pts + " نقطة!"); }} />}
      {leaveModal && <LeaveModal user={user} onClose={() => setLeaveModal(false)} onSubmit={async (data) => { try { await api("leaves", { method: "POST", body: { empId: user.id, ...data } }); setLeaveModal(false); showToast("تم إرسال طلب الإجازة ✓"); } catch { showToast("خطأ في الإرسال", "error"); } }} />}
      {ticketModal && <TicketModal user={user} onClose={() => setTicketModal(false)} onSubmit={async (data) => { try { await api("tickets", { method: "POST", body: { empId: user.id, empName: user.name, ...data } }); setTicketModal(false); showToast("تم إرسال التذكرة ✓"); } catch { showToast("خطأ في الإرسال", "error"); } }} />}
      {daySummary && <DaySummaryModal todayAtt={todayAtt} branch={branch} user={user} onClose={() => setDaySummary(false)} />}
      {preAbsModal && <PreAbsenceModal allEmps={allEmps} user={user} onClose={function(){ setPreAbsModal(false); }} onSubmit={async function(data) { try { await api("pre_absence", { method: "POST", body: { ...data, reportedBy: user.id } }); setPreAbsModal(false); showToast("✅ تم تسجيل الإفادة المسبقة"); } catch(e) { showToast("خطأ في الإرسال", "error"); } }} />}
      {manualAttModal && <ManualAttModal allEmps={allEmps} user={user} onClose={function(){ setManualAttModal(false); }} onSubmit={async function(data) { try { await api("manual_checkin", { method: "POST", body: { ...data, adminId: user.id } }); setManualAttModal(false); showToast("✅ تم التحضير اليدوي"); loadData(user); } catch(e) { showToast("خطأ", "error"); } }} />}
      {permModal && <PermissionModal user={user} branch={branch} onClose={function(){ setPermModal(false); }} onSubmit={async function(data) { try { await api("permissions", { method: "POST", body: { empId: user.id, ...data, date: todayStr() } }); setPermModal(false); showToast("✅ تم إرسال طلب الإذن"); } catch(e) { showToast("خطأ في الإرسال", "error"); } }} />}
    </div>
  );
}

/* ═══════════ SPLASH ═══════════ */
function SplashScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,"+C.hdr1+","+C.hdr3+")", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 52 }} className="basma-pulse">🕐</span>
      <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif", marginTop: 16 }}>بصمة HMA</div>
      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 8 }}>جارِ التحميل...</div>
    </div>
  );
}

/* ═══════════ CONSENT SCREEN — تنبيه عند تسجيل الدخول ═══════════ */
function ConsentScreen({ onAccept }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg," + COLORS.bg1 + "," + COLORS.bg2 + "," + COLORS.bg3 + ")", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", direction: "rtl", fontFamily: TYPOGRAPHY.fontTajawal, padding: SPACING.lg }}>

      <div style={{ maxWidth: 420, width: "100%" }}>
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: SPACING.md }}>
          <div style={{ width: 56, height: 56, borderRadius: RADIUS.xl, background: COLORS.metallic, border: "1px solid " + COLORS.goldLight, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SHADOWS.gold }}>
            <Icons.alert size={28} color={COLORS.goldLight} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.xl, padding: SPACING.lg, boxShadow: SHADOWS.button, marginBottom: SPACING.lg }}>

          {/* Title */}
          <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo, textAlign: "center", marginBottom: SPACING.md }}>تنبيه عند تسجيل الدخول</div>

          {/* Intro */}
          <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary, lineHeight: 1.9, marginBottom: SPACING.md }}>
            باستخدامك للنظام، فإنك تقر وتوافق على ما يلي:
          </div>

          {/* Terms */}
          <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm, marginBottom: SPACING.lg }}>
            {[
              "يُستخدم النظام لأغراض العمل وخلال أوقات الدوام الرسمي فقط.",
              "يتم تحويل بيانات التحقق إلى بيانات رقمية مشفرة دون تخزينها بصورتها الأصلية.",
              "لا يتم مشاركة البيانات خارج نطاق الأنظمة المعتمدة.",
              "تلتزم بالمحافظة على بيانات ومعلومات المكتب، وعدم نشرها أو استخدامها لأي جهة أخرى إلا بموجب موافقة خطية.",
            ].map(function(text, i) {
              return (
                <div key={i} style={{ display: "flex", gap: SPACING.sm, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.goldLight, marginTop: 7, flexShrink: 0 }} />
                  <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary, lineHeight: 1.9 }}>{text}</div>
                </div>
              );
            })}
          </div>

          {/* Important notice */}
          <div style={{ padding: SPACING.md, background: COLORS.goldDark + "25", border: "1px solid " + COLORS.goldLight + "50", borderRadius: RADIUS.md }}>
            <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.goldLight, marginBottom: SPACING.sm }}>تنبيه هام:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
              {[
                "عند أول تسجيل دخول، يعتبر استمرارك في استخدام النظام موافقة ضمنية على هذه الشروط.",
                "في حال عدم رغبتك باستخدام خاصية بصمة الوجه، يمكنك التقدم بطلب جهاز بديل عن طريق الإدارة المختصة.",
                "إلى حين توفير البديل، يتم التنسيق مع إدارة الموارد البشرية لتسجيل الحضور والانصراف عبر الوسائل المعتمدة لديهم (مثل التوقيع أو أي وسيلة أخرى وفق توجيهاتهم).",
              ].map(function(text, i) {
                return (
                  <div key={i} style={{ display: "flex", gap: SPACING.sm, alignItems: "flex-start" }}>
                    <div style={{ width: 5, height: 5, borderRadius: 3, background: COLORS.textMuted, marginTop: 7, flexShrink: 0 }} />
                    <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.9 }}>{text}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer text */}
          <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.goldLight, textAlign: "center", marginTop: SPACING.md, lineHeight: 1.8 }}>
            نحرص على حماية حقوقك وخصوصيتك، وضمان الالتزام التام بالأنظمة المعمول بها.
          </div>
        </div>

        {/* Accept button */}
        <button onClick={onAccept} style={{ width: "100%", height: 54, borderRadius: RADIUS.xl, background: COLORS.goldGradient, border: "1px solid " + COLORS.goldLight, color: COLORS.textOnGold, fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: SHADOWS.gold }}>
          موافق
        </button>
      </div>
    </div>
  );
}

/* ═══════════ LOGIN ═══════════ */
function LoginScreen({ onLogin, loading }) {
  const [username, setUsername] = useState(function(){ return localStorage.getItem("basma_last_username") || ""; });
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!username || !password) { setErr("أدخل اسم المستخدم وكلمة المرور"); return; }
    var cleanUser = username.toLowerCase().trim();
    localStorage.setItem("basma_last_username", cleanUser);
    const e = await onLogin(cleanUser, password);
    if (e) setErr(e);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,"+C.hdr1+" 0%,"+C.hdr2+" 50%,"+C.hdr3+" 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="basma-fadein" style={{ width: 90, height: 90, borderRadius: 28, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, border: "2px solid rgba(255,255,255,.2)" }}>
        <span style={{ fontSize: 42 }}>🕐</span>
      </div>
      <div className="basma-fadein-d1" style={{ color: "#fff", fontSize: 26, fontWeight: 900, fontFamily: "'Cairo',sans-serif", marginBottom: 4 }}>بصمة HMA</div>
      <div className="basma-fadein-d1" style={{ color: "rgba(255,255,255,.6)", fontSize: 12, fontWeight: 500, marginBottom: 32 }}>نظام الحضور والانصراف الذكي</div>
      <div className="basma-fadein-d2" style={{ width: "100%", maxWidth: 340, background: "rgba(255,255,255,.1)", borderRadius: 24, padding: 24, border: "1px solid rgba(255,255,255,.15)" }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.85)", marginBottom: 6, fontFamily: "'Cairo',sans-serif" }}>اسم المستخدم</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin أو البريد" autoCapitalize="none" autoCorrect="off" style={S.loginInput} />
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.85)", marginTop: 12, marginBottom: 6, fontFamily: "'Cairo',sans-serif" }}>كلمة المرور</label>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={S.loginInput} onKeyDown={e => e.key === "Enter" && submit()} />
        {err && <div style={{ color: "#FF6B6B", fontSize: 12, fontWeight: 700, marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>{err}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 16, background: loading ? "rgba(255,255,255,.2)" : "#fff", color: loading ? "rgba(255,255,255,.5)" : C.hdr1, fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", border: "none", cursor: "pointer" }}>
          {loading ? "جارِ الدخول..." : "تسجيل دخول"}
        </button>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
          استخدم نفس بيانات الدخول الخاصة بنظام كوادر<br/>
          <a href="https://hma.engineer" target="_blank" style={{ color: "rgba(255,255,255,.75)", textDecoration: "underline" }}>↗ فتح كوادر</a>
        </div>
      </div>
      <div className="basma-fadein-d3" style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 24 }}>{"v"+VER+" · b.hma.engineer"}</div>
    </div>
  );
}

/* ═══════════ HOME ═══════════ */
function HomePage({ user, branch, now, todayAtt, allAtt, gps, gpsDist, streak, loading, refreshing, dayState, checkpoints, isOffDay, pendingCount, teamToday, pwaPrompt, onPwaInstall, onCheckin, onChallenge, onLeave, onRefresh, onPreAbsence, onManualAtt, onPermission, kadwarNotifs, darkMode }) {
  const { time, sec, ampm } = formatTime(now);
  const badge = memberBadge(user.points || 0);
  const inRange = branch && gpsDist !== null && gpsDist <= (branch.radius || 150);

  // Challenge state — inside the circle
  var [challengeQ] = useState(function() { return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]; });
  var [challengeAnswer, setChallengeAnswer] = useState(null); // null = not answered, true = correct, false = wrong
  var [kadwarFlip, setKadwarFlip] = useState(false);
  var challengeDoneToday = localStorage.getItem("basma_challenge_" + todayStr()) === "1";
  var showChallenge = dayState === "before" && !challengeDoneToday && challengeAnswer === null;

  function answerChallenge(idx) {
    if (challengeAnswer !== null) return;
    var correct = idx === challengeQ.correct;
    setChallengeAnswer(correct);
    localStorage.setItem("basma_challenge_" + todayStr(), "1");
    if (correct) {
      onChallenge(POINTS.challenge_correct);
    }
  }

  const SIZE = 280, STROKE = 10, R = (SIZE - STROKE) / 2, CIRC = 2 * Math.PI * R;
  let pct = dayState === "before" ? 5 : dayState === "after" ? 100 : 50;
  if (branch && dayState === "during") {
    const mins = now.getHours() * 60 + now.getMinutes();
    pct = Math.min(100, Math.round(((mins - timeToMin(branch.start)) / (timeToMin(branch.end) - timeToMin(branch.start))) * 100));
  }
  const ringOff = CIRC - (pct / 100) * CIRC;
  var outsideNoCheckin = !checkpoints.checkin && gpsDist !== null && branch && gpsDist > (branch.radius || 150);
  const ringCol = outsideNoCheckin ? C.red : dayState === "during" ? "#5ec47a" : dayState === "after" ? C.gold : "#80b4f0";

  // Analog clock angles
  var hA = timeToAngle(now.getHours(), now.getMinutes());
  var mA = (now.getMinutes() / 60) * 360 - 90;
  var sA = (now.getSeconds() / 60) * 360 - 90;
  var nowMin = now.getHours() * 60 + now.getMinutes();

  let btnText, btnAction, btnLabel;
  if (dayState === "before") { btnText = "☀️ سجّل حضورك"; btnAction = "checkin"; btnLabel = "تسجيل الحضور"; }
  else if (dayState === "during") {
    if (!checkpoints.checkin) { btnText = "☀️ سجّل حضورك"; btnAction = "checkin"; btnLabel = "تسجيل الحضور"; }
    else if (!checkpoints.breakStart) { btnText = "☕ بداية الاستراحة"; btnAction = "break_start"; btnLabel = "بداية الاستراحة"; }
    else if (!checkpoints.breakEnd) { btnText = "🔄 عودة من الاستراحة"; btnAction = "break_end"; btnLabel = "العودة من الاستراحة"; }
    else if (!checkpoints.checkout) { btnText = "🌙 تسجيل انصراف"; btnAction = "checkout"; btnLabel = "تسجيل الانصراف"; }
    else { btnText = "✓ اكتمل الدوام"; btnAction = null; }
  } else {
    if (!checkpoints.checkout && checkpoints.checkin) { btnText = "🌙 تسجيل انصراف"; btnAction = "checkout"; btnLabel = "تسجيل الانصراف"; }
    else { btnText = "✓ اكتمل الدوام"; btnAction = null; }
  }

  const thisMonth = todayStr().slice(0, 7);
  const monthAtt = allAtt.filter(r => r.date && r.date.startsWith(thisMonth));
  const presentDays = new Set(monthAtt.filter(r => r.type === "checkin").map(r => r.date)).size;
  const lateTol = badge.tier >= 3 ? 15 : 5;
  const lateDays = branch ? monthAtt.filter(r => r.type === "checkin" && (new Date(r.ts).getHours() * 60 + new Date(r.ts).getMinutes()) > timeToMin(branch.start) + lateTol).length : 0;
  const attendPct = presentDays > 0 ? Math.round((presentDays / Math.max(1, new Date().getDate())) * 100) : 0;
  const todayLate = branch && todayAtt.some(r => r.type === "checkin" && (new Date(r.ts).getHours() * 60 + new Date(r.ts).getMinutes()) > timeToMin(branch.start) + lateTol);

  function cpTime(type) {
    const r = todayAtt.find(a => a.type === type);
    return r ? formatTimeStr(r.ts) : "--:--";
  }

  return (
    <div style={{ flex: 1, paddingBottom: 70, minHeight: "100vh", background: "linear-gradient(180deg,"+C.hdr1+" 0%,"+C.hdr2+" 40%,"+C.hdr3+" 100%)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "'Cairo',sans-serif" }}>{"أهلاً، " + (user.name || "").split(" ")[0] + " 👋"}</div>
          <div style={{ color: C.sub, fontSize: 11 }}>{formatArabicDate(now)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: C.sub }}>{badge.icon + " " + badge.label}</span>
          <span style={{ fontSize: 10, color: C.gold, fontWeight: 800 }}>{"⭐" + (user.points || 0)}</span>
          {pendingCount > 0 && <div style={{ position: "relative" }}><span style={{ fontSize: 14 }}>🔔</span><div style={{ position: "absolute", top: -4, right: -6, width: 14, height: 14, borderRadius: 7, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff" }}>{pendingCount}</div></div>}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}><InvestigationBanner user={user} /><MembershipFreezeNotice user={user} /><BranchHolidayBanner branch={branch} /><OccasionBanner user={user} /></div>

      {/* Clock centered */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 8px", overflow: "visible" }}>
        {showChallenge ? (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>{"⚡ " + challengeQ.type}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.6, marginBottom: 12 }}>{challengeQ.q}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280, margin: "0 auto" }}>
              {challengeQ.opts.map(function(opt, idx) { return <button key={idx} onClick={function(){ answerChallenge(idx); }} style={{ padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", textAlign: "center" }}>{opt}</button>; })}
            </div>
          </div>
        ) : challengeAnswer !== null && dayState === "before" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 42 }}>{challengeAnswer ? "🎉" : "😅"}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 6 }}>{challengeAnswer ? MASCOT.correct : MASCOT.wrong}</div>
            {challengeAnswer && <div style={{ fontSize: 12, color: C.gold, marginTop: 4 }}>{"+" + POINTS.challenge_correct + " نقطة"}</div>}
          </div>
        ) : (
          <>
          <div style={{ width: "100%", maxWidth: SIZE, aspectRatio: "1 / 1", position: "relative", padding: "10px" }}>
            <svg viewBox={"0 0 " + SIZE + " " + SIZE} width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
              <defs>
                <radialGradient id="lxFace" cx="50%" cy="45%" r="48%"><stop offset="0%" stopColor="#151c2c"/><stop offset="70%" stopColor="#0a0f1e"/><stop offset="100%" stopColor="#060a12"/></radialGradient>
                {darkMode ? (
                  <>
                    <linearGradient id="lxRim" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f5e6b8"/><stop offset="20%" stopColor="#e8d5a3"/><stop offset="50%" stopColor="#c9a84c"/><stop offset="80%" stopColor="#8b6914"/><stop offset="100%" stopColor="#a08430"/></linearGradient>
                    <linearGradient id="lxRim2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b6914"/><stop offset="50%" stopColor="#c9a84c"/><stop offset="100%" stopColor="#e8d5a3"/></linearGradient>
                  </>
                ) : (
                  <>
                    {/* TITANIUM rim for light mode */}
                    <linearGradient id="lxRim" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f1f5f9"/><stop offset="15%" stopColor="#cbd5e1"/><stop offset="35%" stopColor="#94a3b8"/><stop offset="55%" stopColor="#475569"/><stop offset="75%" stopColor="#1e293b"/><stop offset="100%" stopColor="#334155"/></linearGradient>
                    <linearGradient id="lxRim2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#334155"/><stop offset="50%" stopColor="#94a3b8"/><stop offset="100%" stopColor="#f1f5f9"/></linearGradient>
                  </>
                )}
                {/* ANIMATED SHINE — every 60 seconds */}
                <linearGradient id="lxShine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)"/>
                  <stop offset="45%" stopColor="rgba(255,255,255,0)"/>
                  <stop offset="50%" stopColor={darkMode ? "rgba(255,248,220,.85)" : "rgba(255,255,255,.8)"}/>
                  <stop offset="55%" stopColor="rgba(255,255,255,0)"/>
                  <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
                  <animate attributeName="x1" values="-100%;200%" dur="60s" repeatCount="indefinite"/>
                  <animate attributeName="x2" values="0%;300%" dur="60s" repeatCount="indefinite"/>
                </linearGradient>
                <filter id="lxSh"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,.5)"/></filter>
              </defs>
              {/* Outer bezel — thick metallic rim */}
              <circle cx={SIZE/2} cy={SIZE/2} r={R+8} fill="none" stroke="url(#lxRim)" strokeWidth={7} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R+4} fill="none" stroke={darkMode ? "#8b6914" : "#1e293b"} strokeWidth={1} opacity={0.6} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R+1.5} fill="none" stroke="url(#lxRim2)" strokeWidth={0.8} />
              {/* Animated shine sweep over rim */}
              <circle cx={SIZE/2} cy={SIZE/2} r={R+8} fill="none" stroke="url(#lxShine)" strokeWidth={8} opacity={0.9} />
              {/* Face */}
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="url(#lxFace)" />
              <circle cx={SIZE/2} cy={SIZE/2} r={R-14} fill="none" stroke={darkMode ? "rgba(201,168,76,.08)" : "rgba(148,163,184,.08)"} strokeWidth={0.5} />
              {/* Work arcs */}
              {(function() {
                var AR = R - 16;
                function mkArc(cx,cy,r,s,e) { var a={x:cx+r*Math.cos(e*Math.PI/180),y:cy+r*Math.sin(e*Math.PI/180)}, b={x:cx+r*Math.cos(s*Math.PI/180),y:cy+r*Math.sin(s*Math.PI/180)}; return "M "+a.x+" "+a.y+" A "+r+" "+r+" 0 "+(e-s<=180?"0":"1")+" 0 "+b.x+" "+b.y; }
                return React.createElement("g", null,
                  React.createElement("path", { d: mkArc(SIZE/2,SIZE/2,AR,timeToAngle(8,30),timeToAngle(12,30)), fill: "none", stroke: "#2b5ea7", strokeWidth: 6, strokeLinecap: "round", opacity: 0.8 }),
                  React.createElement("path", { d: mkArc(SIZE/2,SIZE/2,AR,timeToAngle(12,30),timeToAngle(13,0)), fill: "none", stroke: "#d4a017", strokeWidth: 6, strokeLinecap: "round", opacity: 0.7 }),
                  React.createElement("path", { d: mkArc(SIZE/2,SIZE/2,AR,timeToAngle(13,0),timeToAngle(17,0)), fill: "none", stroke: "#10b981", strokeWidth: 6, strokeLinecap: "round", opacity: 0.8 }),
                  CPS.map(function(cp,i) { var a=timeToAngle(cp.h,cp.m)*Math.PI/180; var px=SIZE/2+AR*Math.cos(a),py=SIZE/2+AR*Math.sin(a); var passed=nowMin>=cp.h*60+cp.m; return React.createElement("g",{key:i,transform:"translate("+px+","+py+") rotate(45)"},React.createElement("rect",{x:-5,y:-5,width:10,height:10,rx:2,fill:passed?cp.color:"rgba(201,168,76,.3)",stroke:passed?"#fff":"rgba(201,168,76,.6)",strokeWidth:1.5})); })
                );
              })()}
              {/* Hour ticks */}
              {[0,1,2,3,4,5,6,7,8,9,10,11].map(function(i) { var a=(i*30-90)*Math.PI/180; var major=i%3===0; return React.createElement("line",{key:i,x1:SIZE/2+(R-4)*Math.cos(a),y1:SIZE/2+(R-4)*Math.sin(a),x2:SIZE/2+(R-4-(major?16:8))*Math.cos(a),y2:SIZE/2+(R-4-(major?16:8))*Math.sin(a),stroke:darkMode?"#c9a84c":"#cbd5e1",strokeWidth:major?2.5:1.2,strokeLinecap:"round"}); })}
              {/* Minute ticks */}
              {Array.from({length:60},function(_,i){if(i%5===0)return null;var a=(i*6-90)*Math.PI/180;return React.createElement("line",{key:i,x1:SIZE/2+(R-4)*Math.cos(a),y1:SIZE/2+(R-4)*Math.sin(a),x2:SIZE/2+(R-8)*Math.cos(a),y2:SIZE/2+(R-8)*Math.sin(a),stroke:darkMode?"rgba(201,168,76,.25)":"rgba(203,213,225,.25)",strokeWidth:0.5});})}
              {/* Roman numerals */}
              {["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"].map(function(num,i) { var a=(i*30-90)*Math.PI/180; var major=i%3===0; return React.createElement("text",{key:i,x:SIZE/2+(R-(major?30:26))*Math.cos(a),y:SIZE/2+(R-(major?30:26))*Math.sin(a),textAnchor:"middle",dominantBaseline:"central",fill:darkMode?"#e8d5a3":"#cbd5e1",fontSize:major?16:10,fontWeight:major?"900":"600",fontFamily:"'Times New Roman',Georgia,serif",opacity:major?1:0.5},num); })}
              {/* Brand */}
              <text x={SIZE/2} y={SIZE/2-44} textAnchor="middle" fill={darkMode?"#c9a84c":"#94a3b8"} fontSize={8} fontWeight="700" fontFamily="'Times New Roman',serif" letterSpacing="3" opacity={0.6}>HMA ENGINEERING</text>
              <text x={SIZE/2} y={SIZE/2-33} textAnchor="middle" fill={darkMode?"rgba(201,168,76,.4)":"rgba(148,163,184,.4)"} fontSize={6} fontFamily="'Times New Roman',serif" letterSpacing="2">ATTENDANCE SYSTEM</text>
              {/* Hour hand */}
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+60*Math.cos(hA*Math.PI/180)} y2={SIZE/2+60*Math.sin(hA*Math.PI/180)} stroke={darkMode?"#e8d5a3":"#e2e8f0"} strokeWidth={5.5} strokeLinecap="round" filter="url(#lxSh)" />
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+14*Math.cos((hA+180)*Math.PI/180)} y2={SIZE/2+14*Math.sin((hA+180)*Math.PI/180)} stroke={darkMode?"#e8d5a3":"#e2e8f0"} strokeWidth={3.5} strokeLinecap="round" />
              {/* Minute hand */}
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+85*Math.cos(mA*Math.PI/180)} y2={SIZE/2+85*Math.sin(mA*Math.PI/180)} stroke={darkMode?"#e8d5a3":"#e2e8f0"} strokeWidth={3} strokeLinecap="round" filter="url(#lxSh)" />
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+18*Math.cos((mA+180)*Math.PI/180)} y2={SIZE/2+18*Math.sin((mA+180)*Math.PI/180)} stroke={darkMode?"#e8d5a3":"#e2e8f0"} strokeWidth={2.5} strokeLinecap="round" />
              {/* Second hand — red */}
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+92*Math.cos(sA*Math.PI/180)} y2={SIZE/2+92*Math.sin(sA*Math.PI/180)} stroke="#E2192C" strokeWidth={1} />
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+22*Math.cos((sA+180)*Math.PI/180)} y2={SIZE/2+22*Math.sin((sA+180)*Math.PI/180)} stroke="#E2192C" strokeWidth={1.5} />
              {/* Center jewel */}
              <circle cx={SIZE/2} cy={SIZE/2} r={7} fill={darkMode?"#c9a84c":"#64748b"} stroke={darkMode?"#e8d5a3":"#e2e8f0"} strokeWidth={2} />
              <circle cx={SIZE/2} cy={SIZE/2} r={3.5} fill={darkMode?"#e8d5a3":"#e2e8f0"} />
              {/* Date window */}
              <rect x={SIZE/2+34} y={SIZE/2-9} width={30} height={18} rx={3} fill="#080c14" stroke={darkMode?"rgba(201,168,76,.4)":"rgba(148,163,184,.5)"} strokeWidth={0.8} />
              <text x={SIZE/2+49} y={SIZE/2+1} textAnchor="middle" dominantBaseline="central" fill={darkMode?"#e8d5a3":"#cbd5e1"} fontSize={11} fontWeight="800" fontFamily="system-ui">{now.getDate()}</text>
            </svg>
          </div>
          {/* Digital time — below clock, not absolute */}
          <div style={{ textAlign: "center", marginTop: SPACING.md }}>
            {outsideNoCheckin && (
              <div style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)", border: "2px solid #ef4444", borderRadius: 12, padding: "10px 14px", marginBottom: 8, animation: "basmaRedPulse 1.5s ease-in-out infinite" }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", fontFamily: TYPOGRAPHY.fontCairo, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span> خارج نطاق العمل
                </div>
                {gpsDist !== null && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fecaca", marginTop: 4 }}>
                    تبعد {gpsDist} م • يجب الاقتراب من المكتب لتسجيل الحضور
                  </div>
                )}
                <style>{`@keyframes basmaRedPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } }`}</style>
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.goldDark, fontFamily: TYPOGRAPHY.fontSerif, letterSpacing: 3, marginTop: 4, textShadow: darkMode ? "0 0 10px rgba(201,168,76,.3)" : "none" }}>{time}<span style={{ fontSize: 12, opacity: .4 }}>:{sec}</span> <span style={{ fontSize: 11, opacity: .4 }}>{ampm}</span></div>
          </div>
          </>
        )}

        {/* Challenge text below clock */}
        {dayState === "before" && !showChallenge && challengeAnswer === null && challengeDoneToday && <div style={{ marginTop: SPACING.sm, ...TYPOGRAPHY.caption, color: COLORS.textSecondary }}>{"✓ أجبت على تحدي اليوم"}</div>}
      </div>

      {/* ═══ BOTTOM (unified buttons, uniform height) ═══ */}
      <div style={{ padding: SPACING.lg, display: "flex", flexDirection: "column", gap: SPACING.sm }}>

        {/* PRIMARY — سجّل حضورك (gold) */}
        {!showChallenge && challengeAnswer === null && btnAction && (
          <Button variant="primary" size="lg" icon={<Icons.sun size={20} />} onClick={function(){ if(!loading) onCheckin(btnAction, btnLabel); }} disabled={loading}>
            {loading ? "جارٍ التسجيل..." : btnText}
          </Button>
        )}

        {/* GPS indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: SPACING.sm }}>
          <div style={{ width: 7, height: 7, borderRadius: RADIUS.pill, background: gps ? (inRange ? COLORS.goldLight : COLORS.textDanger) : COLORS.textMuted }} />
          <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{gps ? (inRange ? "في النطاق" : "خارج النطاق") + (branch ? " — " + branch.name : "") : "تحديد الموقع..."}</span>
          {streak > 0 && <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.goldLight }}>{"🔥 " + streak}</span>}
        </div>

        {/* إجازة + إذن (secondary) */}
        <div style={{ display: "flex", gap: SPACING.sm }}>
          <Button variant="secondary" size="md" icon={<Icons.clipboard size={20} />} onClick={onLeave}>إجازة</Button>
          <Button variant="secondary" size="md" icon={<Icons.hand size={20} />} onClick={onPermission}>إذن</Button>
        </div>

        {/* كوادر — secondary flippable */}
        <div className="basma-flip-container">
          <div className={"basma-flip-inner" + (kadwarFlip ? " flipped" : "")} style={{ minHeight: 44 }}>
            <div className="basma-flip-front">
              <Button variant="secondary" size="md" icon={<Icons.building size={20} />} onClick={function(){ setKadwarFlip(true); }}>
                الدخول إلى منصة كوادر
              </Button>
            </div>
            <div className="basma-flip-back">
              <div style={{ display: "flex", gap: SPACING.xs }}>
                <KadwarBtn icon={<Icons.message size={18} />} label="تواصل" count={kadwarNotifs.tasks} />
                <KadwarBtn icon={<Icons.edit size={18} />} label="اختبار" count={kadwarNotifs.exams} />
                <KadwarBtn icon={<Icons.user size={18} />} label="حسابي" count={kadwarNotifs.alerts} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function ReportPage({ user, allAtt, todayAtt, branch, isOffDay, myLeaves, allEmps }) {
  var [showRecords, setShowRecords] = useState(false);
  const thisMonth = todayStr().slice(0, 7);
  const monthAtt = allAtt.filter(r => r.date && r.date.startsWith(thisMonth));
  const checkins = monthAtt.filter(r => r.type === "checkin");
  const presentDays = new Set(checkins.map(r => r.date)).size;
  const lateDays = branch ? checkins.filter(r => (new Date(r.ts).getHours()*60+new Date(r.ts).getMinutes()) > timeToMin(branch.start)+5).length : 0;
  const workDays = Math.max(1, new Date().getDate());
  const absentDays = Math.max(0, workDays - presentDays - Math.floor(workDays/7)*2);
  const attendPct = Math.round((presentDays / workDays) * 100);
  const monthName = AR_MONTHS[new Date().getMonth()];
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  const recent = [...monthAtt].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8);
  const typeMap = { checkin: { label: "حاضر", color: C.green, icon: "👷" }, break_start: { label: "استراحة", color: C.orange, icon: "☕" }, break_end: { label: "عودة", color: C.blue, icon: "🔄" }, checkout: { label: "انصراف", color: C.hdr1, icon: "🌙" } };

  // Today summary
  const todayCheckin = (todayAtt || []).some(r => r.type === "checkin");
  const todayLate = branch && (todayAtt || []).some(r => r.type === "checkin" && (new Date(r.ts).getHours()*60+new Date(r.ts).getMinutes()) > timeToMin(branch.start)+5);
  const todayAbsent = !todayCheckin && !isOffDay && new Date().getHours() >= (branch ? timeToMin(branch.end)/60 : 17);

  // Export CSV
  function exportCSV() {
    var rows = ["التاريخ,النوع,الوقت"];
    monthAtt.forEach(function(r) {
      var typeLabel = typeMap[r.type] ? typeMap[r.type].label : r.type;
      rows.push(r.date + "," + typeLabel + "," + formatTimeStr(r.ts));
    });
    var csv = "\uFEFF" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "basma-report-" + thisMonth + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Overtime calculation
  var overtimeMin = 0;
  var expectedDailyMin = branch ? (timeToMin(branch.end) - timeToMin(branch.start) - 30) : 480;
  var checkinDates = new Set(checkins.map(function(r){ return r.date; }));
  checkinDates.forEach(function(date) {
    var dayRecs = monthAtt.filter(function(r){ return r.date === date; });
    var cin = dayRecs.find(function(r){ return r.type === "checkin"; });
    var cout = dayRecs.find(function(r){ return r.type === "checkout"; });
    if (cin && cout) {
      var worked = (new Date(cout.ts) - new Date(cin.ts)) / 60000;
      var bStart = dayRecs.find(function(r){ return r.type === "break_start"; });
      var bEnd = dayRecs.find(function(r){ return r.type === "break_end"; });
      if (bStart && bEnd) worked -= (new Date(bEnd.ts) - new Date(bStart.ts)) / 60000;
      if (worked > expectedDailyMin) overtimeMin += (worked - expectedDailyMin);
    }
  });
  var overtimeHrs = Math.round(overtimeMin / 60);

  // Approved leave days
  var approvedLeaves = (myLeaves || []).filter(function(l){ return l.status === "approved"; });
  var leaveDays = 0;
  approvedLeaves.forEach(function(l) {
    if (l.from && l.to) {
      var d1 = new Date(l.from), d2 = new Date(l.to);
      leaveDays += Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
    }
  });

  // Calendar data — which days have attendance
  var yr = new Date().getFullYear(), mo = new Date().getMonth();
  var firstDow = new Date(yr, mo, 1).getDay();
  var daysInMonth = new Date(yr, mo + 1, 0).getDate();
  var calDays = [];
  for (var ci = 0; ci < firstDow; ci++) calDays.push(null);
  for (var cd = 1; cd <= daysInMonth; cd++) {
    var ds = yr + "-" + String(mo+1).padStart(2,"0") + "-" + String(cd).padStart(2,"0");
    var hasAtt = monthAtt.some(function(r){ return r.date === ds && r.type === "checkin"; });
    var isLate = branch && monthAtt.some(function(r){ return r.date === ds && r.type === "checkin" && (new Date(r.ts).getHours()*60+new Date(r.ts).getMinutes()) > timeToMin(branch.start)+5; });
    var isToday = ds === todayStr();
    calDays.push({ day: cd, hasAtt: hasAtt, isLate: isLate, isToday: isToday });
  }

  return (
    <div style={{ flex: 1, paddingBottom: 80, background: "linear-gradient(180deg, "+COLORS.bg1+" 0%, "+COLORS.bg2+" 50%, "+COLORS.bg3+" 100%)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: SPACING.lg, textAlign: "center" }}>
        <div style={{ ...TYPOGRAPHY.h1, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo }}>تقريري</div>
      </div>

      <div style={{ padding: "0 " + SPACING.lg + "px", display: "flex", flexDirection: "column", gap: SPACING.md }}>

        <ExportButtons user={user} allAtt={allAtt} branch={branch} allEmps={allEmps} />

        {/* ملخص اليوم */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
            <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>ملخص اليوم</span>
            <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{todayStr()}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: SPACING.sm }}>
            {[
              { num: todayCheckin ? 1 : 0, label: "حاضر", color: COLORS.goldLight },
              { num: todayLate ? 1 : 0, label: "متأخر", color: COLORS.goldLight },
              { num: todayAbsent ? 1 : 0, label: "غائب", color: COLORS.goldLight },
              { num: 0, label: "إجازة", color: COLORS.goldLight },
            ].map(function(s, i){
              return <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: TYPOGRAPHY.fontCairo }}>{s.num}</div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>;
            })}
          </div>
        </Card>

        {/* Period indicator */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block", background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, padding: SPACING.sm + "px " + SPACING.lg + "px", borderRadius: RADIUS.md, ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.goldLight, boxShadow: SHADOWS.button }}>
            {"1 " + monthName + " — " + lastDay + " " + monthName}
          </div>
        </div>

        {/* Month stats — 3 cards */}
        <div style={{ display: "flex", gap: SPACING.sm }}>
          {[
            { num: presentDays, label: "حاضر", color: COLORS.goldLight },
            { num: lateDays, label: "متأخر", color: COLORS.goldLight },
            { num: absentDays, label: "غائب", color: COLORS.goldLight },
          ].map(function(s, i){
            return <div key={i} style={{ flex: 1, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.lg, padding: SPACING.md, textAlign: "center", boxShadow: SHADOWS.button }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: TYPOGRAPHY.fontCairo }}>{s.num}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>يوم · {s.label}</div>
            </div>;
          })}
        </div>

        {/* Monthly stats */}
        <Card>
          <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>إحصائيات الشهر</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: SPACING.sm }}>
            {[
              { num: attendPct + "%", label: "نسبة الحضور", color: COLORS.goldLight },
              { num: overtimeHrs, label: "ساعات إضافية", color: COLORS.goldLight },
              { num: leaveDays, label: "أيام إجازة", color: COLORS.goldLight },
            ].map(function(s, i){
              return <div key={i} style={{ textAlign: "center", padding: SPACING.sm, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: TYPOGRAPHY.fontCairo }}>{s.num}</div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>;
            })}
          </div>
        </Card>

        {/* Calendar */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
            <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>التقويم</span>
            <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{monthName + " " + yr}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
            {["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"].map(function(d){ return <div key={d} style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, padding: 4 }}>{d}</div>; })}
            {calDays.map(function(cd, idx) {
              if (!cd) return <div key={"e"+idx} />;
              var bg = cd.isToday ? "rgba(201,168,76,.3)" : cd.hasAtt ? "rgba(232,213,163,.1)" : "transparent";
              var color = cd.isToday ? COLORS.goldLight : cd.hasAtt ? COLORS.goldLight : COLORS.textMuted;
              var border = cd.isToday ? "none" : cd.hasAtt ? "1px solid " + (cd.isLate ? COLORS.warning+"40" : COLORS.success+"40") : "1px solid " + COLORS.cardBorder;
              return (
                <div key={cd.day} style={{ width: "100%", aspectRatio: "1", borderRadius: RADIUS.sm, background: bg, border: border, display: "flex", alignItems: "center", justifyContent: "center", ...TYPOGRAPHY.caption, fontWeight: 700, color: color }}>
                  {cd.day}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: SPACING.md, justifyContent: "center", marginTop: SPACING.md }}>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.goldLight }}>● حاضر</span>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>● متأخر</span>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.goldLight, fontWeight: 800 }}>● اليوم</span>
          </div>
        </Card>

        <WeeklyChart allAtt={monthAtt} branch={branch} />

        {/* آخر البصمات (collapsible) */}
        <Card>
          <div onClick={function(){ setShowRecords(!showRecords); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>{"آخر البصمات (" + recent.length + ")"}</span>
            <span style={{ color: COLORS.goldLight, transition: "transform .3s", transform: showRecords ? "rotate(180deg)" : "rotate(0)", display: "inline-flex" }}>▼</span>
          </div>
          {showRecords && (
            <div style={{ marginTop: SPACING.md }}>
              {recent.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, ...TYPOGRAPHY.bodySm, padding: SPACING.lg }}>لا توجد بصمات بعد</div>}
              {recent.map(function(r, i) {
                var info = typeMap[r.type] || { label: r.type, color: COLORS.textMuted, icon: "📌" };
                return (
                  <div key={r.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.md, padding: SPACING.md + "px 0", borderBottom: i < recent.length - 1 ? "1px solid " + COLORS.cardBorder : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: RADIUS.pill, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.goldLight, boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)" }}>
                      <Icons.check size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{user.name}</div>
                      <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 }}>{info.label + " · " + r.date}</div>
                    </div>
                    <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textMuted }}>{formatTimeStr(r.ts)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* إجازاتي */}
        {myLeaves && myLeaves.length > 0 && (
          <Card>
            <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>إجازاتي</div>
            {myLeaves.slice(0, 5).map(function(l, i) {
              var statusMap = { pending: { label: "قيد المراجعة", color: COLORS.textMuted }, approved: { label: "مقبولة", color: COLORS.goldLight }, rejected: { label: "مرفوضة", color: COLORS.textDanger } };
              var s = statusMap[l.status] || statusMap.pending;
              var typeLabels = { annual: "سنوية", sick: "مرضية", emergency: "طارئة", personal: "شخصية" };
              return (
                <div key={l.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.md, padding: SPACING.sm + "px 0", borderBottom: i < myLeaves.length - 1 ? "1px solid " + COLORS.cardBorder : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{typeLabels[l.type] || l.type}</div>
                    <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{l.from + " → " + l.to}</div>
                  </div>
                  <span style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: s.color, padding: "3px 10px", borderRadius: RADIUS.sm, background: s.color + "20" }}>{s.label}</span>
                </div>
              );
            })}
          </Card>
        )}

        {/* رسم بياني أسبوعي */}
        <WeeklyChart allAtt={allAtt} empId={user.id} branch={branch} />

        <InvestigationBanner user={user} />
        <ViolationsCard user={user} />
        <DelegationCard user={user} />

        <Button variant="primary" size="md" icon={<Icons.chart size={20} />} onClick={exportCSV}>
          تصدير التقرير
        </Button>
      </div>
    </div>
  );
}

/* ═══════════ PROFILE ═══════════ */
function ProfilePage({ user, branch, onLogout, onTicket, myTickets, darkMode, toggleDark }) {
  var [tab, setTab] = useState(function(){ return localStorage.getItem("basma_profile_tab") || "info"; });
  useEffect(function(){ localStorage.setItem("basma_profile_tab", tab); }, [tab]);
  useEffect(function() {
    function handleTabChange() {
      var saved = localStorage.getItem("basma_profile_tab");
      if (saved) setTab(saved);
    }
    window.addEventListener("basma:profile-tab-changed", handleTabChange);
    return function() { window.removeEventListener("basma:profile-tab-changed", handleTabChange); };
  }, []);
  const typeMap = { office: "مكتبي", field: "ميداني", mixed: "مختلط", remote: "عن بعد" };
  const badge = memberBadge(user.points || 0);
  const rows = [
    ["الفرع", branch ? branch.name : "—"],
    ["المسمى", user.role || "—"],
    ["الرقم", user.id],
    ["التصنيف", typeMap[user.type] || user.type || "—"],
    ["الالتحاق", user.joinDate || "—"],
    ["النقاط", badge.icon + " " + (user.points || 0) + " نقطة"],
  ];
  var tabs = [
    { id: "info", icon: <Icons.user size={18} />, label: "بياناتي" },
    { id: "deps", icon: <Icons.user size={18} />, label: "المرافقين" },
    { id: "docs", icon: <Icons.clipboard size={18} />, label: "المرفقات" },
    { id: "custody", icon: <Icons.building size={18} />, label: "العهد" },
    { id: "record", icon: <Icons.clipboard size={18} />, label: "السجل الوظيفي" },
    { id: "legal", icon: <Icons.alert size={18} />, label: "القانونية" },
  ];

  return (
    <div style={{ flex: 1, paddingBottom: 80, background: "linear-gradient(180deg, "+COLORS.bg1+" 0%, "+COLORS.bg2+" 50%, "+COLORS.bg3+" 100%)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: SPACING.lg, textAlign: "center" }}>
        <div style={{ ...TYPOGRAPHY.h1, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo }}>حسابي</div>
      </div>

      <div style={{ padding: "0 " + SPACING.lg + "px", display: "flex", flexDirection: "column", gap: SPACING.md }}>
        {/* Avatar */}
        <div style={{ textAlign: "center", padding: SPACING.lg + "px 0" }} className="basma-fadein">
          <div style={{ width: 80, height: 80, borderRadius: RADIUS.pill, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, margin: "0 auto " + SPACING.md + "px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SHADOWS.button }}>
            <Icons.user size={36} color={COLORS.goldLight} />
          </div>
          <div style={{ ...TYPOGRAPHY.h1, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo, marginBottom: SPACING.xs }}>{user.name}</div>
          <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{user.role + " — " + user.id}</div>
        </div>

        {/* Profile Tabs */}
        <div style={{ display: "flex", gap: 2, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.lg, padding: 4, boxShadow: SHADOWS.button, overflowX: "auto", justifyContent: "center" }}>
          {tabs.map(function(t) {
            var active = tab === t.id;
            return (
              <button key={t.id} onClick={function(){ setTab(t.id); }} style={{ flex: 1, minWidth: 56, padding: "8px 4px", borderRadius: RADIUS.md, background: active ? COLORS.metallic : "transparent", border: "1px solid " + (active ? COLORS.goldLight : "transparent"), cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: active ? COLORS.goldLight : COLORS.textMuted }}>
                {t.icon}
                <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab: بياناتي */}
        {tab === "info" && (
          <>
            <Card>
              {rows.map(function(row, i) {
                return (
                  <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: SPACING.md + "px 0", borderBottom: i < rows.length - 1 ? "1px solid " + COLORS.cardBorder : "none" }}>
                    <span style={{ ...TYPOGRAPHY.body, fontWeight: 700, color: COLORS.textPrimary }}>{row[1]}</span>
                    <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{row[0]}</span>
                  </div>
                );
              })}
            </Card>

            <MembershipCard points={user.points || 0} />
            <PointsLogCard user={user} allAtt={[]} />

            {/* Settings card */}
            <Card>
              <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>الإعدادات</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: SPACING.sm + "px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                <span style={{ ...TYPOGRAPHY.bodySm, fontWeight: 600, color: COLORS.textPrimary }}>الوضع الليلي</span>
                <div onClick={toggleDark} style={{ width: 44, height: 24, borderRadius: 12, background: darkMode ? COLORS.goldLight : COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, position: "relative", cursor: "pointer", transition: "background .3s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: COLORS.white, position: "absolute", top: 3, transition: "all .3s", left: darkMode ? 3 : undefined, right: darkMode ? undefined : 3, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                </div>
              </div>
              <ToggleRow label="تذكير بالحضور" storeKey="remind_in" border={true} />
              <ToggleRow label="تذكير بالانصراف" storeKey="remind_out" border={true} />
              <FaceResetRow empId={user.id} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: SPACING.sm + "px 0", borderTop: "1px solid " + COLORS.cardBorder }}>
                <span style={{ ...TYPOGRAPHY.bodySm, fontWeight: 600, color: COLORS.textPrimary }}>إصدار التطبيق</span>
                <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.goldLight }}>{"v" + VER}</span>
              </div>
            </Card>

            {user.sceNumber && (
              <Card>
                <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>الهيئة السعودية للمهندسين</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: SPACING.sm + "px 0" }}>
                  <span style={{ ...TYPOGRAPHY.body, fontWeight: 700, color: COLORS.textPrimary }}>{user.sceNumber}</span>
                  <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>رقم العضوية</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: SPACING.sm + "px 0", borderTop: "1px solid " + COLORS.cardBorder }}>
                  <span style={{ ...TYPOGRAPHY.body, fontWeight: 700, color: user.sceStatus === "active" ? COLORS.goldLight : COLORS.textDanger }}>{user.sceStatus === "active" ? "ساري" : "منتهي"}</span>
                  <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{"انتهاء: " + user.sceExpiry}</span>
                </div>
              </Card>
            )}

            {myTickets && myTickets.length > 0 && (
              <Card>
                <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>تذاكري</div>
                {myTickets.slice(0, 5).map(function(t, i) {
                  var statusMap = { pending: { label: "قيد المراجعة", color: COLORS.textMuted }, open: { label: "مفتوحة", color: COLORS.goldLight }, resolved: { label: "تم الحل", color: COLORS.goldLight }, closed: { label: "مغلقة", color: COLORS.textMuted } };
                  var st = statusMap[t.status] || statusMap.pending;
                  return (
                    <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm + "px 0", borderBottom: i < Math.min(myTickets.length, 5) - 1 ? "1px solid " + COLORS.cardBorder : "none" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{t.subject}</div>
                        <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{t.ts ? t.ts.split("T")[0] : ""}</div>
                      </div>
                      <span style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: st.color, padding: "3px 8px", borderRadius: RADIUS.sm, background: st.color + "20" }}>{st.label}</span>
                    </div>
                  );
                })}
              </Card>
            )}

            <HelpGuideSection />

            <Button variant="secondary" size="md" icon={<Icons.alert size={20} />} onClick={onTicket}>
              تذكرة دعم جديدة
            </Button>
          </>
        )}

        {tab === "deps" && <Card><DependentsTab user={user} /></Card>}
        {tab === "docs" && <Card><AttachmentsTab user={user} /></Card>}
        {tab === "custody" && <Card><CustodyTab user={user} /></Card>}
        {tab === "record" && <EmployeeRecordTab user={user} />}
        {tab === "legal" && <LegalTab user={user} />}

        {/* Manager panel button */}
        {(user.isManager || user.isAssistant) && (
          <Button variant="primary" size="md" icon={<Icons.building size={20} />} onClick={function(){ window.location.hash = "admin"; }}>
            لوحة الإدارة
          </Button>
        )}

        {/* Logout */}
        <Button variant="danger" size="md" onClick={onLogout}>
          تسجيل خروج
        </Button>

        {/* Footer */}
        <Card padding={SPACING.md}>
          <div style={{ textAlign: "center" }}>
            <div style={{ ...TYPOGRAPHY.h3, color: COLORS.goldLight, fontFamily: TYPOGRAPHY.fontCairo }}>بصمة HMA</div>
            <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: SPACING.xs }}>نظام الحضور والانصراف الذكي</div>
            <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>هاني محمد عسيري للاستشارات الهندسية</div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: SPACING.sm }}>{"v" + VER + " · b.hma.engineer"}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════ BENEFITS PAGE (امتيازات العضوية) ═══════════ */
function BenefitsPage({ user }) {
  var badge = memberBadge(user.points || 0);
  var [filter, setFilter] = useState("all");
  var isRamadan = false;
  var allCoupons = isRamadan ? COUPONS.concat(RAMADAN_COUPONS) : COUPONS;
  var cats = ["all"].concat(Array.from(new Set(allCoupons.map(function(c){ return c.cat; }))));
  var filtered = filter === "all" ? allCoupons : allCoupons.filter(function(c){ return c.cat === filter; });
  var catLabels = { all: "الكل", "مطاعم": "مطاعم", "خدمات": "خدمات", "رياضة": "رياضة", "تسوق": "تسوق", "سفر": "سفر", "رمضان": "رمضان" };

  return (
    <div style={{ flex: 1, paddingBottom: 80, background: "linear-gradient(180deg, "+COLORS.bg1+" 0%, "+COLORS.bg2+" 50%, "+COLORS.bg3+" 100%)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: SPACING.lg, textAlign: "center" }}>
        <div style={{ ...TYPOGRAPHY.h1, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo }}>امتيازات العضوية</div>
      </div>

      <div style={{ padding: "0 " + SPACING.lg + "px", display: "flex", flexDirection: "column", gap: SPACING.md }}>

        {/* Current level */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
            <div style={{ width: 56, height: 56, borderRadius: RADIUS.pill, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: SHADOWS.button }}>{badge.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPOGRAPHY.h2, color: COLORS.goldLight }}>{badge.label}</div>
              <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{(user.points || 0) + " نقطة"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ ...TYPOGRAPHY.h3, color: COLORS.goldLight }}>{filtered.filter(function(c){ return c.minTier <= badge.tier; }).length}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{"متاح من " + filtered.length}</div>
            </div>
          </div>
        </Card>

        {/* Category filter */}
        <div style={{ display: "flex", gap: SPACING.xs, overflowX: "auto", paddingBottom: 4 }}>
          {cats.map(function(cat) {
            var active = filter === cat;
            return (
              <button key={cat} onClick={function(){ setFilter(cat); }} style={{ padding: SPACING.sm + "px " + SPACING.lg + "px", borderRadius: RADIUS.md, background: COLORS.metallic, color: active ? COLORS.goldLight : COLORS.textMuted, ...TYPOGRAPHY.caption, fontWeight: 700, border: "1px solid " + (active ? COLORS.goldLight : COLORS.metallicBorder), boxShadow: SHADOWS.button, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: TYPOGRAPHY.fontTajawal }}>
                {catLabels[cat] || cat}
              </button>
            );
          })}
        </div>

        {/* Coupons */}
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
          {filtered.map(function(coupon) {
            var available = coupon.minTier <= badge.tier;
            var canAfford = (user.points || 0) >= coupon.pts;
            var tierName = MEMBERSHIP[coupon.minTier] ? MEMBERSHIP[coupon.minTier].name.replace("عضوية ","") : "فعّال";
            return (
              <div key={coupon.id} style={{ display: "flex", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl, background: COLORS.metallic, border: "1px solid " + (available ? COLORS.goldLight + "60" : COLORS.metallicBorder), minHeight: 72, opacity: available ? 1 : 0.5, boxShadow: SHADOWS.card }}>
                <div style={{ width: 44, height: 44, borderRadius: RADIUS.md, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{coupon.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{coupon.brand}</div>
                  <div style={{ ...TYPOGRAPHY.caption, color: available ? COLORS.goldLight : COLORS.textMuted, fontWeight: 600 }}>{coupon.discount}</div>
                  {!available && <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{"يتطلب " + tierName}</div>}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: canAfford && available ? COLORS.goldLight : COLORS.textMuted, fontFamily: TYPOGRAPHY.fontCairo }}>{coupon.pts}</div>
                  <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>نقطة</div>
                  {available && canAfford && (
                    <button style={{ marginTop: 4, padding: "4px 12px", borderRadius: RADIUS.sm, background: COLORS.metallic, border: "1px solid " + COLORS.goldLight, color: COLORS.goldLight, ...TYPOGRAPHY.tiny, fontWeight: 800, cursor: "pointer" }}>استبدال</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isRamadan && (
          <Card>
            <div style={{ textAlign: "center", ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.goldLight }}>
              عروض رمضان الخاصة متاحة
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ═══════════ MODALS ═══════════ */

function Toast({ msg, type }) {
  var bg = type === "error" ? C.red : type === "warning" ? C.orange : C.green;
  return (
    <div className="basma-slidedown" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: bg, color: "#fff", padding: "10px 24px", borderRadius: 14, fontSize: 13, fontWeight: 700, boxShadow: "0 4px 20px rgba(0,0,0,.25)", fontFamily: "'Tajawal',sans-serif", maxWidth: "90vw", textAlign: "center" }}>
      {msg}
    </div>
  );
}

/* ── Call Banner (اتصال تنبيهي) ── */
function CallBanner({ type, msg, onDismiss }) {
  var icons = { checkin: "📞", retry: "📞", break: "☕", breakEnd: "🔄" };
  var colors = { checkin: C.green, retry: C.red, break: C.orange, breakEnd: C.blue };

  useEffect(function() {
    // Auto-dismiss after 30 seconds
    var t = setTimeout(onDismiss, 30000);
    return function() { clearTimeout(t); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onDismiss}>
      <div className="basma-pulse" style={{ width: 100, height: 100, borderRadius: "50%", background: (colors[type] || C.blue) + "30", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, border: "3px solid " + (colors[type] || C.blue) }}>
        <span style={{ fontSize: 42 }}>{icons[type] || "📞"}</span>
      </div>
      <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, fontFamily: "'Cairo',sans-serif", marginBottom: 8, textAlign: "center" }}>{msg}</div>
      <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginBottom: 24 }}>اضغط لإغلاق التنبيه</div>
      <button onClick={onDismiss} style={{ padding: "12px 40px", borderRadius: 16, background: colors[type] || C.blue, color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
        حسناً ✓
      </button>
    </div>
  );
}

function ConfirmModal({ label, onConfirm, onCancel }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div className="basma-slideup" style={S.modal} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>📍</div>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 6, color: C.text }}>{"تأكيد " + label}</div>
        <div style={{ fontSize: 12, color: C.sub, textAlign: "center", marginBottom: 20 }}>{"هل تريد " + label + " الآن؟"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إلغاء</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>تأكيد ✓</button>
        </div>
      </div>
    </div>
  );
}

function FaceModal({ empId, onVerified, onSkip, onCancel }) {
  var videoRef = useRef(null);
  var canvasRef = useRef(null);
  var [status, setStatus] = useState("init"); // init, loading_models, ready, detecting, captured, matched, mismatch, registering, error
  var [stream, setStream] = useState(null);
  var [msg, setMsg] = useState("جارِ تشغيل الكاميرا...");
  var [storedDesc, setStoredDesc] = useState(null); // null = not checked, false = no face stored, array = stored descriptor
  var faceapi = typeof window !== "undefined" ? window.faceapi : null;

  useEffect(function() {
    var s = null;
    var cancelled = false;
    (async function() {
      // 1. Check stored face
      try {
        var r = await api("face", { params: { empId: empId } });
        if (!cancelled) setStoredDesc(r.ok && r.descriptor ? r.descriptor : false);
      } catch(e) { if (!cancelled) setStoredDesc(false); }

      // 2. Start camera
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 320 } });
        if (cancelled) { s.getTracks().forEach(function(t){ t.stop(); }); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch(e) { if (!cancelled) { setStatus("error"); setMsg("لا يمكن الوصول للكاميرا"); } return; }

      // 3. Load face-api models if available
      if (faceapi && faceapi.nets) {
        try {
          setMsg("جارِ تحميل نماذج التعرف...");
          setStatus("loading_models");
          var MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";
          await Promise.all([
            faceapi.nets.tinyFaceDetector.load(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.load(MODEL_URL),
            faceapi.nets.faceRecognitionNet.load(MODEL_URL),
          ]);
          if (!cancelled) { setStatus("ready"); setMsg("وجّه وجهك للكاميرا ثم اضغط التقاط"); }
        } catch(e) {
          if (!cancelled) { setStatus("ready"); setMsg("التقط صورتك (بدون تعرف تلقائي)"); }
        }
      } else {
        if (!cancelled) { setStatus("ready"); setMsg("التقط صورتك"); }
      }
    })();
    return function() { cancelled = true; if (s) s.getTracks().forEach(function(t){ t.stop(); }); };
  }, []);

  async function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    setStatus("detecting");
    setMsg("جارِ التحليل...");

    var ctx = canvasRef.current.getContext("2d");
    canvasRef.current.width = 320;
    canvasRef.current.height = 320;
    ctx.drawImage(videoRef.current, 0, 0, 320, 320);
    var photo = canvasRef.current.toDataURL("image/jpeg", 0.6);

    // Try face detection with face-api
    var descriptor = null;
    if (faceapi && faceapi.nets && faceapi.nets.tinyFaceDetector.isLoaded) {
      try {
        var detection = await faceapi.detectSingleFace(canvasRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (detection) {
          descriptor = Array.from(detection.descriptor);
        }
      } catch(e) { /* fallback to photo only */ }
    }

    if (stream) stream.getTracks().forEach(function(t){ t.stop(); });

    // No face detected at all
    if (!descriptor && faceapi && faceapi.nets && faceapi.nets.tinyFaceDetector.isLoaded) {
      setStatus("error");
      setMsg("لم يتم اكتشاف وجه — حاول مرة أخرى");
      return;
    }

    // Registration mode (no stored face)
    if (storedDesc === false && descriptor) {
      setStatus("registering");
      setMsg("جارِ تسجيل الوجه...");
      try {
        await api("face", { method: "POST", body: { empId: empId, descriptor: descriptor } });
      } catch(e) { /* continue anyway */ }
      setStatus("captured");
      setMsg("✓ تم تسجيل الوجه بنجاح!");
      setTimeout(function(){ onVerified(photo); }, 800);
      return;
    }

    // Verification mode (has stored face)
    if (storedDesc && descriptor) {
      var sum = 0;
      for (var i = 0; i < 128; i++) {
        sum += Math.pow(descriptor[i] - storedDesc[i], 2);
      }
      var distance = Math.sqrt(sum);
      var matchPct = Math.max(0, Math.round((1 - distance / 1.2) * 100));

      if (matchPct >= 55) {
        setStatus("matched");
        setMsg("✓ تطابق " + matchPct + "% — تم التحقق");
        setTimeout(function(){ onVerified(photo); }, 800);
      } else {
        setStatus("mismatch");
        setMsg("✗ تطابق " + matchPct + "% فقط — غير مطابق");
      }
      return;
    }

    // Fallback: no face-api or no descriptor - just proceed with photo
    setStatus("captured");
    setMsg("✓ تم التقاط الصورة");
    setTimeout(function(){ onVerified(photo); }, 600);
  }

  function handleClose() {
    if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
    onCancel();
  }

  var borderColor = status === "matched" || status === "captured" ? C.green : status === "mismatch" ? C.red : C.blue;
  var isFirst = storedDesc === false;

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 340 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 4, color: C.text }}>
          {isFirst ? "📸 تسجيل الوجه" : "📸 التحقق بالوجه"}
        </div>
        {isFirst && <div style={{ fontSize: 10, color: C.orange, textAlign: "center", marginBottom: 8, fontWeight: 600 }}>أول مرة — سيتم حفظ وجهك للتحقق لاحقاً</div>}

        <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden", margin: "0 auto 12px", border: "4px solid " + borderColor, position: "relative", background: "#000", transition: "border-color .3s" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {(status === "matched" || status === "captured") && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(45,159,111,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 48, color: "#fff" }}>✓</span>
            </div>
          )}
          {status === "mismatch" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(231,76,60,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 48, color: "#fff" }}>✗</span>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: status === "matched" || status === "captured" ? C.green : status === "mismatch" ? C.red : status === "error" ? C.red : C.sub, marginBottom: 12 }} className={status === "init" || status === "loading_models" || status === "detecting" || status === "registering" ? "basma-pulse" : ""}>
          {msg}
        </div>

        {status === "error" && !msg.includes("كاميرا") && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
            <button onClick={function(){ setStatus("ready"); setMsg("وجّه وجهك ثم اضغط التقاط"); }} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إعادة المحاولة</button>
          </div>
        )}
        {status === "error" && msg.includes("كاميرا") && (
          <div style={{ textAlign: "center" }}>
            <button onClick={function(){ if (stream) stream.getTracks().forEach(function(t){ t.stop(); }); onSkip(); }} style={{ padding: "10px 24px", borderRadius: 12, background: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              متابعة بدون صورة
            </button>
          </div>
        )}
        {status === "ready" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
            <button onClick={capture} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,"+C.green+","+C.greenDark+")", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📸 التقاط</button>
          </div>
        )}
        {status === "mismatch" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
            <button onClick={function(){ if (stream) stream.getTracks().forEach(function(t){ t.stop(); }); onSkip(); }} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>متابعة بدون تحقق</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeModal({ user, onClose, onPoints }) {
  var [q] = useState(function(){ return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]; });
  var [selected, setSelected] = useState(null);
  var [answered, setAnswered] = useState(false);

  function answer(idx) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.correct) {
      setTimeout(function(){ onPoints(25); onClose(); }, 1200);
    } else {
      setTimeout(onClose, 2000);
    }
  }

  var isCorrect = selected === q.correct;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 360 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", color: C.green, marginBottom: 4 }}>⚡ سؤال التحدي</div>
        <div style={{ fontSize: 11, color: C.sub, textAlign: "center", marginBottom: 16 }}>اجب صحيحاً واكسب 25 نقطة</div>
        <div style={{ fontSize: 15, fontWeight: 700, textAlign: "center", marginBottom: 16, lineHeight: 1.6, color: C.text }}>{q.q}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.opts.map(function(opt, i) {
            var bg = "#fff", border = "2px solid #eee", color = C.text;
            if (answered) {
              if (i === q.correct) { bg = "rgba(45,159,111,.1)"; border = "2px solid " + C.green; color = C.green; }
              else if (i === selected && !isCorrect) { bg = "rgba(231,76,60,.1)"; border = "2px solid " + C.red; color = C.red; }
            }
            return (
              <button key={i} onClick={function(){ answer(i); }} style={{ padding: "12px 16px", borderRadius: 14, background: bg, border: border, color: color, fontSize: 14, fontWeight: 600, cursor: answered ? "default" : "pointer", textAlign: "center", fontFamily: "'Tajawal',sans-serif", transition: "all .2s" }}>
                {answered && i === q.correct ? "✓ " : ""}{answered && i === selected && !isCorrect ? "✗ " : ""}{opt}
              </button>
            );
          })}
        </div>
        {answered && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 14, fontWeight: 800, color: isCorrect ? C.green : C.red }}>
            {isCorrect ? "🎉 إجابة صحيحة! +25 نقطة" : "❌ إجابة خاطئة — حظاً أوفر غداً"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ DAY SUMMARY MODAL ═══════════ */

function DaySummaryModal({ todayAtt, branch, user, onClose }) {
  var checkinRec = todayAtt.find(function(r){ return r.type === "checkin"; });
  var checkoutRec = todayAtt.find(function(r){ return r.type === "checkout"; });
  var breakStartRec = todayAtt.find(function(r){ return r.type === "break_start"; });
  var breakEndRec = todayAtt.find(function(r){ return r.type === "break_end"; });

  var totalMs = 0;
  if (checkinRec && checkoutRec) {
    totalMs = new Date(checkoutRec.ts) - new Date(checkinRec.ts);
    if (breakStartRec && breakEndRec) totalMs -= (new Date(breakEndRec.ts) - new Date(breakStartRec.ts));
  }
  var totalMin = Math.max(0, Math.floor(totalMs / 60000));
  var hrs = Math.floor(totalMin / 60);
  var mins = totalMin % 60;
  var expectedMin = branch ? (timeToMin(branch.end) - timeToMin(branch.start) - 30) : 480;
  var overtime = Math.max(0, totalMin - expectedMin);
  var otHrs = Math.floor(overtime / 60);
  var otMin = overtime % 60;

  var isLate = branch && checkinRec && (new Date(checkinRec.ts).getHours() * 60 + new Date(checkinRec.ts).getMinutes()) > timeToMin(branch.start) + 5;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 360 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: C.green }}>اكتمل الدوام!</div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{formatArabicDate(new Date())}</div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: C.green + "12", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: C.green }}>{hrs + ":" + String(mins).padStart(2, "0")}</div>
            <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>ساعات العمل</div>
          </div>
          {overtime > 0 && (
            <div style={{ flex: 1, background: C.blue + "12", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: C.blue }}>{otHrs + ":" + String(otMin).padStart(2, "0")}</div>
              <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>إضافي</div>
            </div>
          )}
          <div style={{ flex: 1, background: (isLate ? C.orange : C.green) + "12", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: isLate ? C.orange : C.green }}>{isLate ? "متأخر" : "منضبط"}</div>
            <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>الحضور</div>
          </div>
        </div>

        <div style={{ background: C.bg, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          {[
            ["حضور", checkinRec ? formatTimeStr(checkinRec.ts) : "—", "☀️"],
            ["استراحة", breakStartRec ? formatTimeStr(breakStartRec.ts) : "—", "☕"],
            ["عودة", breakEndRec ? formatTimeStr(breakEndRec.ts) : "—", "🔄"],
            ["انصراف", checkoutRec ? formatTimeStr(checkoutRec.ts) : "—", "🌙"],
          ].map(function(row, i) {
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 3 ? "1px solid rgba(0,0,0,.05)" : "none" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{row[2] + " " + row[0]}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{row[1]}</span>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: C.sub, marginBottom: 12 }}>{"⭐ النقاط: " + (user.points || 0) + " نقطة"}</div>

        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg," + C.green + "," + C.greenDark + ")", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          إلى اللقاء 👋
        </button>
      </div>
    </div>
  );
}

/* ═══════════ PRE-ABSENCE + MANUAL ATT ═══════════ */

function PreAbsenceModal({ allEmps, user, onClose, onSubmit }) {
  var [empId, setEmpId] = useState("");
  var [reason, setReason] = useState("");
  var [asLeave, setAsLeave] = useState(false);
  var managed = (allEmps || []).filter(function(e) { return e.managers && e.managers.indexOf(user.id) >= 0; });

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = tomorrow.toISOString().split("T")[0];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380, background: C.card }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 4, color: C.text }}>📋 إفادة مسبقة بالغياب</div>
        <div style={{ fontSize: 10, color: C.sub, textAlign: "center", marginBottom: 14 }}>{"الموظف لن يحضر غداً: " + tomorrowStr}</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>اختر الموظف</div>
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif", background: C.card, color: C.text }}>
            <option value="">— اختر —</option>
            {managed.map(function(e) { return React.createElement("option", { key: e.id, value: e.id }, e.name + " (" + e.id + ")"); })}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>السبب</div>
          <textarea value={reason} onChange={function(e){ setReason(e.target.value); }} placeholder="سبب الغياب..." rows={2} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none", background: C.card, color: C.text }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 0" }}>
          <div onClick={function(){ setAsLeave(!asLeave); }} style={{ width: 20, height: 20, borderRadius: 6, border: "2px solid " + (asLeave ? C.green : "#ddd"), background: asLeave ? C.green + "15" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {asLeave && <span style={{ color: C.green, fontSize: 12, fontWeight: 900 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>احتساب من الإجازة السنوية</span>
        </div>

        <div style={{ fontSize: 9, color: C.orange, marginBottom: 12, padding: 8, borderRadius: 8, background: C.orange + "08" }}>
          ⚖️ حسب لائحة العمل: طلب الإجازة يجب أن يكون قبل الغياب وليس بعده
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={function(){ if(empId) onSubmit({ empId: empId, date: tomorrowStr, reason: reason, asLeave: asLeave }); }} disabled={!empId} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: empId ? "linear-gradient(135deg,"+C.orange+","+C.orangeDark+")" : "#eee", color: empId ? "#fff" : "#aaa", fontSize: 14, fontWeight: 700, cursor: empId ? "pointer" : "default" }}>
            تأكيد الإفادة
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualAttModal({ allEmps, user, onClose, onSubmit }) {
  var [empId, setEmpId] = useState("");
  var [type, setType] = useState("checkin");
  var [date, setDate] = useState(todayStr());
  var types = [
    { id: "checkin", label: "حضور", icon: "☀️" },
    { id: "checkout", label: "انصراف", icon: "🌙" },
    { id: "break_start", label: "بداية استراحة", icon: "☕" },
    { id: "break_end", label: "عودة", icon: "🔄" },
  ];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380, background: C.card }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 14, color: C.text }}>✏️ تحضير يدوي</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>الموظف</div>
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif", background: C.card, color: C.text }}>
            <option value="">— اختر —</option>
            {(allEmps || []).map(function(e) { return React.createElement("option", { key: e.id, value: e.id }, e.name + " (" + e.id + ")"); })}
          </select>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {types.map(function(t) {
            var active = type === t.id;
            return (
              <button key={t.id} onClick={function(){ setType(t.id); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: active ? C.blue + "15" : "#f5f5f5", border: active ? "2px solid " + C.blue : "2px solid transparent", fontSize: 9, fontWeight: 700, color: active ? C.blue : C.sub, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 14 }}>{t.icon}</div>{t.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>التاريخ</div>
          <input type="date" value={date} onChange={function(e){ setDate(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
        </div>

        <div style={{ fontSize: 9, color: C.blue, marginBottom: 12, padding: 8, borderRadius: 8, background: C.blue + "08" }}>
          🛡️ التحضير اليدوي متاح لمدير النظام فقط — يُسجّل في النظام "تم التحضير يدوياً"
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={function(){ if(empId) onSubmit({ empId: empId, type: type, date: date }); }} disabled={!empId} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: empId ? "linear-gradient(135deg,"+C.blue+","+C.blueBright+")" : "#eee", color: empId ? "#fff" : "#aaa", fontSize: 14, fontWeight: 700, cursor: empId ? "pointer" : "default" }}>
            تسجيل ✓
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ PERMISSION REQUEST (طلب إذن) ═══════════ */
function PermissionModal({ user, branch, onClose, onSubmit }) {
  var [type, setType] = useState("early_leave");
  var [time, setTime] = useState("");
  var [reason, setReason] = useState("");

  var types = [
    { id: "early_leave", label: "انصراف مبكر", icon: "🚶" },
    { id: "late_arrival", label: "حضور متأخر", icon: "⏰" },
    { id: "personal", label: "إذن شخصي", icon: "🙋" },
    { id: "medical", label: "مراجعة طبية", icon: "🏥" },
  ];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380, background: C.card }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 14, color: C.text }}>🙋 طلب إذن</div>

        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {types.map(function(t) {
            var active = type === t.id;
            return (
              <button key={t.id} onClick={function(){ setType(t.id); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: active ? C.blue + "15" : "#f5f5f5", border: active ? "2px solid " + C.blue : "2px solid transparent", fontSize: 9, fontWeight: 700, color: active ? C.blue : C.sub, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 14 }}>{t.icon}</div>{t.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>
            {type === "early_leave" ? "وقت الانصراف المطلوب" : type === "late_arrival" ? "وقت الحضور المتوقع" : "مدة الإذن (بالدقائق)"}
          </div>
          <input type="time" value={time} onChange={function(e){ setTime(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>السبب</div>
          <textarea value={reason} onChange={function(e){ setReason(e.target.value); }} placeholder="سبب الإذن..." rows={2} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none", background: C.card, color: C.text }} />
        </div>

        <div style={{ fontSize: 9, color: C.sub, marginBottom: 12, padding: 8, borderRadius: 8, background: C.blue + "08" }}>
          📋 سيُرسل الطلب للمدير المباشر للموافقة — يُحسم من رصيد الإجازات إن تجاوز ساعتين
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={function(){ if(time && reason) onSubmit({ type: type, time: time, reason: reason }); }} disabled={!time || !reason} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: time && reason ? "linear-gradient(135deg,"+C.blue+","+C.blueBright+")" : "#eee", color: time && reason ? "#fff" : "#aaa", fontSize: 14, fontWeight: 700, cursor: time && reason ? "pointer" : "default" }}>
            إرسال الطلب
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ LEAVE + TICKET MODALS ═══════════ */

function LeaveModal({ user, onClose, onSubmit }) {
  var [type, setType] = useState("annual");
  var [from, setFrom] = useState(todayStr());
  var [to, setTo] = useState(todayStr());
  var [reason, setReason] = useState("");
  var [submitting, setSubmitting] = useState(false);

  var leaveTypes = [
    { id: "annual", label: "سنوية", icon: "🏖️" },
    { id: "sick", label: "مرضية", icon: "🏥" },
    { id: "emergency", label: "طارئة", icon: "⚡" },
    { id: "personal", label: "شخصية", icon: "👤" },
  ];

  async function submit() {
    if (!from || !to) return;
    setSubmitting(true);
    await onSubmit({ type: type, from: from, to: to, reason: reason });
    setSubmitting(false);
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380, background: C.card }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 16, color: C.text }}>📝 طلب إجازة</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {leaveTypes.map(function(lt) {
            var active = type === lt.id;
            return (
              <button key={lt.id} onClick={function(){ setType(lt.id); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 12, background: active ? C.blue + "15" : "#f5f5f5", border: active ? "2px solid " + C.blue : "2px solid transparent", fontSize: 10, fontWeight: 700, color: active ? C.blue : C.sub, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 16 }}>{lt.icon}</div>
                {lt.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>من</div>
            <input type="date" value={from} onChange={function(e){ setFrom(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>إلى</div>
            <input type="date" value={to} onChange={function(e){ setTo(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>السبب (اختياري)</div>
          <textarea value={reason} onChange={function(e){ setReason(e.target.value); }} placeholder="اكتب سبب الإجازة..." rows={2} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none", background: C.card, color: C.text }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={submit} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: submitting ? .6 : 1 }}>
            {submitting ? "جارِ الإرسال..." : "إرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketModal({ user, onClose, onSubmit }) {
  var [subject, setSubject] = useState("");
  var [message, setMessage] = useState("");
  var [priority, setPriority] = useState("normal");
  var [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!subject || !message) return;
    setSubmitting(true);
    await onSubmit({ subject: subject, message: message, priority: priority });
    setSubmitting(false);
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380, background: C.card }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 16, color: C.text }}>🎫 تذكرة دعم</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[{id:"low",label:"منخفض",c:C.green},{id:"normal",label:"عادي",c:C.blue},{id:"high",label:"عاجل",c:C.red}].map(function(p) {
            var active = priority === p.id;
            return (
              <button key={p.id} onClick={function(){ setPriority(p.id); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: active ? p.c + "15" : "#f5f5f5", border: active ? "2px solid " + p.c : "2px solid transparent", fontSize: 11, fontWeight: 700, color: active ? p.c : C.sub, cursor: "pointer" }}>
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 10 }}>
          <input value={subject} onChange={function(e){ setSubject(e.target.value); }} placeholder="الموضوع" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 14, fontFamily: "'Tajawal',sans-serif" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <textarea value={message} onChange={function(e){ setMessage(e.target.value); }} placeholder="اكتب رسالتك هنا..." rows={3} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + C.bg, fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none", background: C.card, color: C.text }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid " + C.bg, background: C.card, color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={submit} disabled={submitting || !subject || !message} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,"+C.orange+",#FF8021)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (submitting || !subject || !message) ? .6 : 1 }}>
            {submitting ? "جارِ الإرسال..." : "إرسال"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ SMALL COMPONENTS ═══════════ */

function WorkHoursCard({ todayAtt, now, branch, dayState }) {
  var checkinRec = todayAtt.find(function(r){ return r.type === "checkin"; });
  var checkoutRec = todayAtt.find(function(r){ return r.type === "checkout"; });
  var breakStartRec = todayAtt.find(function(r){ return r.type === "break_start"; });
  var breakEndRec = todayAtt.find(function(r){ return r.type === "break_end"; });

  if (!checkinRec) return null;

  var checkinTime = new Date(checkinRec.ts);
  var endTime = checkoutRec ? new Date(checkoutRec.ts) : now;
  var totalMs = endTime - checkinTime;

  // Subtract break time
  if (breakStartRec && breakEndRec) {
    totalMs -= (new Date(breakEndRec.ts) - new Date(breakStartRec.ts));
  } else if (breakStartRec && !breakEndRec && !checkoutRec) {
    totalMs -= (now - new Date(breakStartRec.ts));
  }

  var totalMin = Math.max(0, Math.floor(totalMs / 60000));
  var hrs = Math.floor(totalMin / 60);
  var mins = totalMin % 60;

  var expectedMin = branch ? (timeToMin(branch.end) - timeToMin(branch.start) - 30) : 480;
  var progressPct = Math.min(100, Math.round((totalMin / expectedMin) * 100));

  return (
    <div style={S.card} className="basma-fadein-d2">
      <div style={S.cardTitle}><span>ساعات العمل</span><span style={{ fontSize: 11, color: dayState === "after" ? C.green : C.blue, fontWeight: 700 }}>{checkoutRec ? "✓ مكتمل" : "⏱ جاري"}</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg,"+C.blue+"18,"+C.blueBright+"10)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: C.blue }}>{hrs}</div>
          <div style={{ fontSize: 8, color: C.sub, fontWeight: 600, marginTop: -2 }}>{":" + String(mins).padStart(2,"0") + " ساعة"}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.sub }}>{"حضور: " + formatTimeStr(checkinRec.ts)}</span>
            <span style={{ fontSize: 11, color: C.sub }}>{checkoutRec ? "انصراف: " + formatTimeStr(checkoutRec.ts) : "—"}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,"+C.blue+","+C.blueBright+")", width: progressPct + "%", transition: "width 1s ease" }} />
          </div>
          <div style={{ fontSize: 9, color: C.sub, marginTop: 4, textAlign: "left", direction: "ltr" }}>{progressPct + "% من الدوام"}</div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ num, label, cls }) {
  var colors = { ok: C.green, warn: C.orange, bad: C.red, info: C.blue };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: colors[cls] || C.text }}>{num}</div>
      <div style={{ fontSize: 9, color: C.sub, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Checkpoint({ icon, label, time, done }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 14, margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: done ? "#e6f4ed" : "#f5f5f5", border: done ? "2.5px solid " + C.green : "2px solid #ddd", transition: "all .3s" }}>
        {done ? <span style={{ color: C.green, fontWeight: 900, fontSize: 15 }}>✓</span> : icon}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: done ? C.green : C.sub }}>{label}</div>
      <div style={{ fontSize: 8, color: C.sub }}>{time}</div>
    </div>
  );
}

function ReportStat({ num, unit, label, bg }) {
  return (
    <div style={{ flex: 1, borderRadius: 14, padding: "12px 8px", textAlign: "center", color: "#fff", background: bg }}>
      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Cairo',sans-serif" }}>{num}</div>
      <div style={{ fontSize: 10, fontWeight: 600, opacity: .85 }}>{unit}</div>
      <div style={{ fontSize: 9, fontWeight: 600, opacity: .7, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MonthStat({ num, label, color }) {
  return (
    <div style={{ flex: 1, background: C.card, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: color }}>{num}</div>
      <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ToggleRow({ label, storeKey, border }) {
  var [on, setOn] = useState(function(){ return localStorage.getItem("basma_" + storeKey) === "1"; });
  function toggle() {
    var next = !on;
    setOn(next);
    localStorage.setItem("basma_" + storeKey, next ? "1" : "0");
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: SPACING.sm + "px 0", borderBottom: border ? "1px solid " + COLORS.cardRowBorder : "none" }}>
      <span style={{ ...TYPOGRAPHY.bodySm, fontWeight: 600, color: COLORS.textPrimary }}>{label}</span>
      <div onClick={toggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? COLORS.goldLight : COLORS.metallic, border: "1px solid " + (on ? COLORS.goldLight : COLORS.metallicBorder), position: "relative", cursor: "pointer", transition: "background .3s" }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2, transition: "all .3s", left: on ? 2 : undefined, right: on ? undefined : 2, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </div>
    </div>
  );
}

function MembershipCard({ points }) {
  var badge = memberBadge(points);
  var tc = badge.color;
  var availableCoupons = COUPONS.filter(function(c){ return c.minTier <= badge.tier; }).length;

  return (
    <div style={{ marginBottom: SPACING.md }}>
      {/* Main badge card — UNIFIED metallic */}
      <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.xl, padding: SPACING.lg, boxShadow: SHADOWS.button, marginBottom: SPACING.sm }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md }}>
          <div style={{ width: 52, height: 52, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: SHADOWS.button }}>{badge.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...TYPOGRAPHY.h2, color: COLORS.goldLight }}>{badge.label}</div>
            <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{points + " نقطة"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ ...TYPOGRAPHY.h2, color: COLORS.goldLight }}>{availableCoupons}</div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>كوبون متاح</div>
          </div>
        </div>

        {badge.next && (
          <div style={{ marginBottom: SPACING.md }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: SPACING.xs }}>
              <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{"التقدم نحو " + badge.nextLabel}</span>
              <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: COLORS.goldLight }}>{badge.progress + "%"}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,.3)", overflow: "hidden", border: "1px solid " + COLORS.metallicBorder }}>
              <div style={{ height: "100%", borderRadius: 3, background: COLORS.goldGradient, width: badge.progress + "%", transition: "width .5s" }} />
            </div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 3 }}>{"باقي " + badge.remaining + " نقطة للترقية"}</div>
          </div>
        )}

        {/* Criteria weights */}
        <div style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: COLORS.goldLight, marginBottom: SPACING.xs }}>مصادر النقاط</div>
        <div style={{ display: "flex", gap: 3, marginBottom: SPACING.sm }}>
          {[
            { label: "حضور", pct: CRITERIA_WEIGHTS.attendance },
            { label: "تحدي", pct: CRITERIA_WEIGHTS.challenge },
            { label: "ملف", pct: CRITERIA_WEIGHTS.profile },
            { label: "تطبيقات", pct: CRITERIA_WEIGHTS.apps },
            { label: "AI", pct: CRITERIA_WEIGHTS.ai },
          ].map(function(cr, idx) {
            return (
              <div key={idx} style={{ flex: cr.pct, height: 22, borderRadius: 4, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: COLORS.goldLight, whiteSpace: "nowrap" }}>{cr.label + " " + cr.pct + "%"}</span>
              </div>
            );
          })}
        </div>

        {/* All levels */}
        <div style={{ display: "flex", gap: SPACING.xs }}>
          {MEMBERSHIP.map(function(lvl) {
            var isActive = badge.tier === lvl.id;
            return (
              <div key={lvl.id} style={{ flex: 1, padding: "6px 4px", borderRadius: RADIUS.md, background: COLORS.metallic, border: "1px solid " + (isActive ? COLORS.goldLight : COLORS.metallicBorder), textAlign: "center", boxShadow: isActive ? SHADOWS.button : "none", opacity: isActive ? 1 : 0.6 }}>
                <div style={{ fontSize: 16 }}>{lvl.icon}</div>
                <div style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: isActive ? COLORS.goldLight : COLORS.textMuted }}>{lvl.name.replace("عضوية ","")}</div>
                <div style={{ fontSize: 7, color: COLORS.textMuted }}>{lvl.min + " نقطة"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Membership note */}
      <div style={{ padding: "8px 12px", borderRadius: RADIUS.md, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, boxShadow: SHADOWS.button }}>
        <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.6, textAlign: "center" }}>{MEMBERSHIP_NOTE}</div>
      </div>
    </div>
  );
}

function KadwarBtn({ icon, label, count }) {
  return (
    <button onClick={function(){ window.open("https://hma.engineer", "_blank"); }} style={{ flex: 1, height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid rgba(232,213,163,.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: SPACING.xs, cursor: "pointer", position: "relative", boxShadow: SHADOWS.button }}>
      <span style={{ color: COLORS.goldLight, display: "flex", position: "relative" }}>
        {icon}
        {count > 0 && (
          <span style={{ position: "absolute", top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: COLORS.danger, color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{count}</span>
        )}
      </span>
      <span style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.goldLight }}>{label}</span>
    </button>
  );
}

function FaceResetRow({ empId }) {
  var [resetting, setResetting] = useState(false);
  var [done, setDone] = useState(false);

  async function reset() {
    if (!confirm("هل تريد إعادة تعيين بصمة الوجه؟ سيُطلب منك تسجيل وجهك مرة أخرى عند البصمة القادمة.")) return;
    setResetting(true);
    try {
      await api("face", { method: "DELETE", params: { empId: empId } });
      setDone(true);
    } catch(e) { /**/ }
    setResetting(false);
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: SPACING.sm + "px 0", borderBottom: "1px solid " + COLORS.cardRowBorder }}>
      <span style={{ ...TYPOGRAPHY.bodySm, fontWeight: 600, color: COLORS.textPrimary }}>بصمة الوجه</span>
      <button onClick={reset} disabled={resetting || done} style={{ padding: "6px 14px", borderRadius: RADIUS.sm, border: "1px solid " + (done ? COLORS.goldLight : COLORS.textDanger), background: COLORS.metallic, color: done ? COLORS.goldLight : COLORS.textDanger, ...TYPOGRAPHY.caption, fontWeight: 700, cursor: resetting || done ? "default" : "pointer", fontFamily: TYPOGRAPHY.fontTajawal }}>
        {done ? "✓ تم الحذف" : resetting ? "جارِ..." : "إعادة تعيين"}
      </button>
    </div>
  );
}

/* ═══════════ NOTIFICATION PANEL ═══════════ */
function NotificationPanel({ notifications, onClose, onMarkRead, onGoToLegal }) {
  var typeIcons = { violation: "⚖️", investigation: "🔍", appeal_result: "📢", complaint_update: "📣" };
  var typeLabels = { violation: "مخالفة", investigation: "تحقيق", appeal_result: "نتيجة تظلم", complaint_update: "تحديث شكوى" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: "linear-gradient(180deg, " + COLORS.bg1 + ", " + COLORS.bg2 + ")", borderRadius: "0 0 " + RADIUS.xl + "px " + RADIUS.xl + "px", maxHeight: "70vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
        <div style={{ padding: SPACING.lg, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid " + COLORS.metallicBorder }}>
          <div style={{ ...TYPOGRAPHY.h2, color: COLORS.textPrimary }}>🔔 الإشعارات</div>
          <div style={{ display: "flex", gap: SPACING.sm }}>
            <button onClick={onMarkRead} style={{ padding: "6px 12px", borderRadius: RADIUS.sm, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textMuted, ...TYPOGRAPHY.tiny, fontWeight: 700, cursor: "pointer" }}>قراءة الكل</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 22, cursor: "pointer" }}>×</button>
          </div>
        </div>

        <div style={{ padding: SPACING.md }}>
          {notifications.length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>لا توجد إشعارات</div>}
          {notifications.slice(0, 30).map(function(n) {
            return (
              <div key={n.id} onClick={function(){ if (n.type === "violation" || n.type === "investigation") onGoToLegal(); }} style={{ display: "flex", gap: SPACING.sm, padding: SPACING.md, borderBottom: "1px solid " + COLORS.metallicBorder, cursor: "pointer", background: n.read ? "transparent" : COLORS.goldDark + "15", borderRadius: RADIUS.sm, marginBottom: 4 }}>
                <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>{typeIcons[n.type] || "📌"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: n.read ? COLORS.textMuted : COLORS.textPrimary }}>{n.title}</div>
                    {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.textDanger }} />}
                  </div>
                  <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.6 }}>{n.body}</div>
                  <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.goldLight, marginTop: 4, fontSize: 9 }}>{n.createdAt ? new Date(n.createdAt).toLocaleString("ar-SA") : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ page, setPage, legalAlerts }) {
  var items = [
    { id: "home", icon: Icons.home, label: "الرئيسية" },
    { id: "benefits", icon: Icons.medal, label: "الامتيازات" },
    { id: "report", icon: Icons.chart, label: "تقريري" },
    { id: "profile", icon: Icons.user, label: "حسابي", badge: legalAlerts || 0 },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", background: "rgba(" + (C === DARK ? "7,20,40" : "255,255,255") + ",.85)", backdropFilter: "blur(10px)", borderTop: "1px solid " + COLORS.metallicBorder, display: "flex", justifyContent: "space-around", padding: "10px 0 16px", zIndex: 50 }}>
      {items.map(function(n) {
        var active = page === n.id;
        var IconComp = n.icon;
        return (
          <button key={n.id} onClick={function(){ setPage(n.id); }} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", position: "relative", padding: "4px 12px" }}>
            {active && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 24, height: 3, borderRadius: 2, background: COLORS.gold }} />}
            <div style={{ position: "relative" }}>
              <IconComp size={22} color={active ? COLORS.gold : COLORS.textMuted} />
              {n.badge > 0 && <div style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: COLORS.textDanger || "#E2192C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff", padding: "0 3px" }}>{n.badge}</div>}
            </div>
            <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: active ? COLORS.gold : COLORS.textMuted }}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════ STYLES ═══════════ */

/* ═══════════ CUSTODY (العهد) ═══════════ */
/* ═══════════ EMPLOYEE RECORD TAB — السجل الوظيفي الكامل ═══════════ */
function EmployeeRecordTab({ user }) {
  var [subTab, setSubTab] = useState("contracts");
  var [contracts, setContracts] = useState([]);
  var [leaves, setLeaves] = useState([]);
  var [violations, setViolations] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showAdd, setShowAdd] = useState(false);
  var [addType, setAddType] = useState("contract");

  useEffect(function() { loadAll(); }, []);
  async function loadAll() {
    setLoading(true);
    try {
      var [c, l, v] = await Promise.all([
        api("emp_records", { params: { empId: user.id, type: "contract" } }),
        api("leaves", { params: { empId: user.id } }),
        api("violations_v2", { params: { empId: user.id } }),
      ]);
      setContracts(c || []);
      setLeaves(l || []);
      setViolations(v || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  var tabs = [
    { id: "contracts", l: "العقود", count: contracts.length },
    { id: "leaves", l: "الإجازات", count: leaves.length },
    { id: "violations", l: "المخالفات", count: violations.length },
    { id: "promotions", l: "الترقيات" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 2, marginBottom: SPACING.md, overflowX: "auto" }}>
        {tabs.map(function(t) {
          var a = subTab === t.id;
          return <button key={t.id} onClick={function(){ setSubTab(t.id); }} style={{ flex: 1, padding: "7px 8px", borderRadius: RADIUS.sm, background: a ? COLORS.goldGradient : COLORS.metallic, border: "1px solid " + (a ? COLORS.goldLight : COLORS.metallicBorder), color: a ? COLORS.textOnGold : COLORS.textMuted, ...TYPOGRAPHY.tiny, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.l}{t.count > 0 ? " (" + t.count + ")" : ""}
          </button>;
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>جارِ التحميل...</div>}

      {/* العقود */}
      {!loading && subTab === "contracts" && (
        <div>
          <button onClick={function(){ setAddType("contract"); setShowAdd(true); }} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px dashed " + COLORS.goldLight, color: COLORS.goldLight, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: SPACING.md }}>+ إضافة عقد سابق</button>
          {contracts.length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>لا توجد عقود مسجّلة</div>}
          {contracts.map(function(c) {
            return (
              <div key={c.id} style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textPrimary }}>{c.title || "عقد عمل"}</div>
                  <span style={{ ...TYPOGRAPHY.tiny, color: c.status === "active" ? "#10b981" : COLORS.textMuted, fontWeight: 700 }}>{c.status === "active" ? "ساري" : "منتهي"}</span>
                </div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>
                  {c.startDate || "—"} → {c.endDate || "مفتوح"} | {c.type || "غير محدد المدة"}
                </div>
                {c.notes && <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 4, fontStyle: "italic" }}>{c.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* الإجازات */}
      {!loading && subTab === "leaves" && (
        <div>
          {leaves.length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>لا توجد إجازات</div>}
          {leaves.map(function(l) {
            var typeLabels = { annual: "سنوية", sick: "مرضية", emergency: "طارئة", personal: "شخصية", unpaid: "بدون راتب" };
            var statusColors = { pending: COLORS.textMuted, approved: "#10b981", rejected: COLORS.textDanger };
            var statusLabels = { pending: "قيد المراجعة", approved: "معتمدة", rejected: "مرفوضة" };
            return (
              <div key={l.id} style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>{typeLabels[l.type] || l.type || "إجازة"}</div>
                  <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: statusColors[l.status] || COLORS.textMuted, background: (statusColors[l.status] || COLORS.textMuted) + "20", padding: "2px 8px", borderRadius: RADIUS.sm }}>{statusLabels[l.status] || l.status}</span>
                </div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{(l.from || "—") + " → " + (l.to || "—")}{l.days ? " (" + l.days + " يوم)" : ""}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* المخالفات */}
      {!loading && subTab === "violations" && (
        <div>
          {violations.length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>سجل نظيف 👌</div>}
          {violations.map(function(v) {
            var st = VIOLATION_STATUS[v.status] || { label: v.status, color: COLORS.textMuted };
            return (
              <div key={v.id} style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: COLORS.goldDark, padding: "2px 6px", borderRadius: 4 }}>{v.violationId}</span>
                  <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: st.color, background: st.color + "20", padding: "2px 8px", borderRadius: RADIUS.sm }}>{st.label}</span>
                </div>
                <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary, lineHeight: 1.5, marginTop: 4 }}>{v.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>
                  <span>المرة {v.occurrence} — {v.penaltyLabel}</span>
                  <span>{v.createdAt ? new Date(v.createdAt).toLocaleDateString("ar-SA") : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* الترقيات */}
      {!loading && subTab === "promotions" && (
        <div>
          <button onClick={function(){ setAddType("promotion"); setShowAdd(true); }} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px dashed " + COLORS.goldLight, color: COLORS.goldLight, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: SPACING.md }}>+ إضافة ترقية / تغيير مسمى</button>
          <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>سجل الترقيات يُحدّث من لوحة الإدارة</div>
        </div>
      )}

      {showAdd && <AddRecordModal type={addType} user={user} onClose={function(){ setShowAdd(false); }} onSave={function(){ setShowAdd(false); loadAll(); }} />}
    </div>
  );
}

function AddRecordModal({ type, user, onClose, onSave }) {
  var [form, setForm] = useState({ title: "", type: "محدد المدة", startDate: "", endDate: "", notes: "", status: "active" });
  var [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api("emp_records", {
        method: "POST",
        body: { empId: user.id, empName: user.name, recordType: type, ...form },
      });
      onSave();
    } catch(e) { alert("فشل: " + e.message); }
    setSaving(false);
  }

  var inputStyle = { width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 12, marginBottom: SPACING.sm, fontFamily: TYPOGRAPHY.fontTajawal };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: SPACING.md }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: "linear-gradient(180deg, " + COLORS.bg1 + ", " + COLORS.bg2 + ")", borderRadius: RADIUS.xl, padding: SPACING.lg, maxWidth: 450, width: "100%", border: "1px solid " + COLORS.metallicBorder }}>
        <div style={{ ...TYPOGRAPHY.h2, color: COLORS.goldLight, marginBottom: SPACING.md }}>{type === "contract" ? "إضافة عقد" : "إضافة ترقية"}</div>
        <input value={form.title} onChange={function(e){ setForm({...form, title: e.target.value}); }} placeholder={type === "contract" ? "عنوان العقد (مثل: عقد عمل 2023)" : "المسمى الجديد"} style={inputStyle} />
        {type === "contract" && <select value={form.type} onChange={function(e){ setForm({...form, type: e.target.value}); }} style={inputStyle}><option value="محدد المدة">محدد المدة</option><option value="غير محدد">غير محدد المدة</option><option value="تجربة">فترة تجربة</option></select>}
        <div style={{ display: "flex", gap: SPACING.xs }}>
          <input type="date" value={form.startDate} onChange={function(e){ setForm({...form, startDate: e.target.value}); }} style={{...inputStyle, flex: 1}} placeholder="تاريخ البداية" />
          <input type="date" value={form.endDate} onChange={function(e){ setForm({...form, endDate: e.target.value}); }} style={{...inputStyle, flex: 1}} placeholder="تاريخ النهاية" />
        </div>
        <textarea value={form.notes} onChange={function(e){ setForm({...form, notes: e.target.value}); }} rows={3} placeholder="ملاحظات..." style={{...inputStyle, resize: "vertical"}} />
        <div style={{ display: "flex", gap: SPACING.sm }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={submit} disabled={saving} style={{ flex: 2, height: 44, borderRadius: RADIUS.lg, background: COLORS.goldGradient, border: "1px solid " + COLORS.goldLight, color: COLORS.textOnGold, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{saving ? "..." : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Export violations record for printing ── */
function exportViolationsRecord(user, violations) {
  var rows = violations.map(function(v, i) {
    var st = v.status === "ACTIVE" ? "سارية" : v.status === "APPEALED" ? "متظلم عليها" : v.status === "CANCELLED" ? "ملغاة" : v.status;
    return "<tr><td>" + (i+1) + "</td><td>" + (v.violationId || "") + "</td><td>" + (v.description || "").replace(/</g,"&lt;") + "</td><td>" + (v.occurrence || "") + "</td><td>" + (v.penaltyLabel || "") + "</td><td>" + st + "</td><td>" + (v.createdAt ? new Date(v.createdAt).toLocaleDateString("ar-SA") : "") + "</td></tr>";
  }).join("");
  var html = "<!DOCTYPE html><html dir='rtl' lang='ar'><head><meta charset='utf-8'><title>سجل المخالفات — " + user.name + "</title><style>body{font-family:'Segoe UI',Tahoma,sans-serif;margin:30px;color:#1a1a1a}h1{font-size:18px;text-align:center;color:#2B5EA7}h2{font-size:14px;text-align:center;color:#666;margin-bottom:20px}.info{display:flex;justify-content:space-between;margin-bottom:16px;font-size:12px;border:1px solid #ddd;padding:12px;border-radius:8px;background:#f9f9f9}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#2B5EA7;color:#fff;padding:8px 6px;font-size:11px;text-align:right}td{padding:8px 6px;border-bottom:1px solid #eee;font-size:11px}.footer{margin-top:24px;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px}@media print{body{margin:10px}}</style></head><body>" +
    "<h1>📜 سجل المخالفات الرسمية</h1>" +
    "<h2>مكتب هاني محمد عسيري للاستشارات الهندسية</h2>" +
    "<div class='info'><div><strong>الموظف:</strong> " + user.name + "</div><div><strong>الرقم:</strong> " + user.id + "</div><div><strong>المسمى:</strong> " + (user.role || "—") + "</div><div><strong>التاريخ:</strong> " + new Date().toLocaleDateString("ar-SA") + "</div></div>" +
    "<table><thead><tr><th>#</th><th>البند</th><th>الوصف</th><th>المرة</th><th>الجزاء</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<div class='footer'>وفق لائحة تنظيم العمل المعتمدة رقم 978004 — وزارة الموارد البشرية والتنمية الاجتماعية<br/>تم التصدير: " + new Date().toLocaleString("ar-SA") + "</div>" +
    "<script>setTimeout(function(){window.print()},500)<\/script></body></html>";
  var w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════ LEGAL TAB ═══════════ */
function LegalTab({ user }) {
  var [subTab, setSubTab] = useState("summary");
  var [complaints, setComplaints] = useState([]);
  var [investigations, setInvestigations] = useState([]);
  var [violations, setViolations] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showComplaintModal, setShowComplaintModal] = useState(false);
  var [activeInvestigation, setActiveInvestigation] = useState(null);
  var [activeViolation, setActiveViolation] = useState(null);

  useEffect(function() { loadAll(); }, []);
  async function loadAll() {
    setLoading(true);
    try {
      var [myC, againstMe, invs, vios] = await Promise.all([
        api("complaints", { params: { filedBy: user.id } }),
        api("complaints", { params: { against: user.id } }),
        api("investigations", { params: { empId: user.id } }),
        api("violations_v2", { params: { empId: user.id } }),
      ]);
      var allC = [...(myC || []), ...(againstMe || [])];
      var uniq = {};
      allC.forEach(function(c){ uniq[c.id] = c; });
      setComplaints(Object.values(uniq));
      setInvestigations(invs || []);
      setViolations(vios || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  // Check for pending investigation that needs response
  var pendingInv = investigations.find(function(i){ return i.status === "WAITING_RESPONSE"; });
  var activeViolations = violations.filter(function(v){ return v.status === "ACTIVE"; });
  var myOpenComplaints = complaints.filter(function(c){ return c.filedBy === user.id && ["PENDING_HR","UNDER_INVESTIGATION"].includes(c.status); });

  return (
    <div>
      {/* Urgent alert for pending investigation */}
      {pendingInv && (
        <div onClick={function(){ setActiveInvestigation(pendingInv); }} style={{ background: "linear-gradient(135deg, " + COLORS.textDanger + "25, " + COLORS.textDanger + "15)", border: "2px solid " + COLORS.textDanger, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, cursor: "pointer", boxShadow: SHADOWS.button }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: COLORS.textDanger, marginBottom: 4 }}>⚠️ استمارة تحقيق بانتظارك</div>
          <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary, marginBottom: 6 }}>{pendingInv.title}</div>
          <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>
            المهلة: {new Date(pendingInv.deadline).toLocaleString("ar-SA")} — اضغط للرد
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: SPACING.xs, marginBottom: SPACING.md, overflowX: "auto" }}>
        {[
          { id: "summary", l: "ملخصي" },
          { id: "violations", l: "مخالفاتي (" + activeViolations.length + ")" },
          { id: "investigations", l: "التحقيقات (" + investigations.length + ")" },
          { id: "mine", l: "شكاواي (" + myOpenComplaints.length + ")" },
          { id: "laiha", l: "اللائحة" },
        ].map(function(s) {
          var a = subTab === s.id;
          return <button key={s.id} onClick={function(){ setSubTab(s.id); }} style={{ padding: "7px 12px", borderRadius: RADIUS.sm, background: a ? COLORS.goldGradient : COLORS.metallic, border: "1px solid " + (a ? COLORS.goldLight : COLORS.metallicBorder), color: a ? COLORS.textOnGold : COLORS.textMuted, ...TYPOGRAPHY.tiny, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", fontFamily: TYPOGRAPHY.fontTajawal }}>{s.l}</button>;
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>جارِ التحميل...</div>}

      {/* SUMMARY */}
      {!loading && subTab === "summary" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: SPACING.sm, marginBottom: SPACING.md }}>
            <Card padding={SPACING.md}>
              <div style={{ ...TYPOGRAPHY.h2, color: activeViolations.length > 0 ? COLORS.textDanger : COLORS.goldLight }}>{activeViolations.length}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>مخالفات سارية</div>
            </Card>
            <Card padding={SPACING.md}>
              <div style={{ ...TYPOGRAPHY.h2, color: pendingInv ? COLORS.textDanger : COLORS.goldLight }}>{investigations.filter(function(i){ return i.status === "WAITING_RESPONSE"; }).length}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>تحقيقات مفتوحة</div>
            </Card>
          </div>

          <button onClick={function(){ setShowComplaintModal(true); }} style={{ width: "100%", height: 52, borderRadius: RADIUS.xl, background: COLORS.goldGradient, border: "1px solid " + COLORS.goldLight, color: COLORS.textOnGold, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: SHADOWS.gold, marginBottom: SPACING.sm }}>
            ✏️ رفع شكوى رسمية
          </button>

          {violations.length > 0 && (
            <button onClick={function(){ exportViolationsRecord(user, violations); }} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.goldLight, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, marginBottom: SPACING.md }}>
              🖨️ طباعة سجل المخالفات
            </button>
          )}

          <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, padding: SPACING.md }}>
            <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.goldLight, marginBottom: 4 }}>📜 المرجع القانوني</div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.7 }}>
              اللائحة التنفيذية لنظام العمل السعودي — لائحة تنظيم العمل المعتمدة رقم {LAIHA_INFO.approvalNumber} بتاريخ {LAIHA_INFO.approvalDate}
            </div>
          </div>
        </div>
      )}

      {/* VIOLATIONS */}
      {!loading && subTab === "violations" && (
        <div>
          {violations.length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>لا توجد مخالفات — سجلك نظيف 👌</div>}
          {violations.map(function(v) {
            var st = VIOLATION_STATUS[v.status] || { label: v.status, color: COLORS.textMuted };
            return (
              <div key={v.id} onClick={function(){ setActiveViolation(v); }} style={{ background: COLORS.metallic, border: "1px solid " + (v.status === "ACTIVE" ? COLORS.textDanger + "60" : COLORS.metallicBorder), borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, cursor: "pointer", boxShadow: SHADOWS.button }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: COLORS.goldDark, padding: "2px 6px", borderRadius: 4 }}>{v.violationId}</span>
                      <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>المرة {v.occurrence}</span>
                    </div>
                    <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1.5 }}>{v.description}</div>
                  </div>
                  <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 800, color: st.color, background: st.color + "20", padding: "3px 8px", borderRadius: RADIUS.sm }}>{st.label}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{new Date(v.createdAt).toLocaleDateString("ar-SA")}</span>
                  <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textDanger }}>{v.penaltyLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INVESTIGATIONS */}
      {!loading && subTab === "investigations" && (
        <div>
          {investigations.length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>لا توجد تحقيقات</div>}
          {investigations.map(function(inv) {
            var statusLabel = inv.status === "WAITING_RESPONSE" ? "بانتظار ردك" : inv.status === "RESPONSE_RECEIVED" ? "تم الرد — بانتظار القرار" : inv.status === "CONVERTED" ? "تحولت لمخالفة" : inv.status === "CLOSED" ? "أُغلقت — برئ" : inv.status;
            var statusColor = inv.status === "WAITING_RESPONSE" ? COLORS.textDanger : inv.status === "RESPONSE_RECEIVED" ? COLORS.goldLight : inv.status === "CLOSED" ? "#10b981" : COLORS.textMuted;
            return (
              <div key={inv.id} onClick={function(){ setActiveInvestigation(inv); }} style={{ background: COLORS.metallic, border: "1px solid " + (inv.status === "WAITING_RESPONSE" ? COLORS.textDanger : COLORS.metallicBorder), borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, cursor: "pointer", boxShadow: SHADOWS.button }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textPrimary }}>{inv.title}</div>
                    <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 3 }}>{inv.questions.length} سؤال</div>
                  </div>
                  <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 800, color: statusColor, background: statusColor + "20", padding: "3px 8px", borderRadius: RADIUS.sm }}>{statusLabel}</span>
                </div>
                {inv.status === "WAITING_RESPONSE" && (
                  <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textDanger, marginTop: 6 }}>⏱ المهلة: {new Date(inv.deadline).toLocaleString("ar-SA")}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MY COMPLAINTS */}
      {!loading && subTab === "mine" && (
        <div>
          <button onClick={function(){ setShowComplaintModal(true); }} style={{ width: "100%", height: 48, borderRadius: RADIUS.lg, background: COLORS.goldGradient, border: "1px solid " + COLORS.goldLight, color: COLORS.textOnGold, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: SHADOWS.gold, marginBottom: SPACING.md }}>
            + رفع شكوى جديدة
          </button>
          {complaints.filter(function(c){ return c.filedBy === user.id; }).length === 0 && <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted }}>لم ترفع أي شكوى</div>}
          {complaints.filter(function(c){ return c.filedBy === user.id; }).map(function(c) {
            var st = COMPLAINT_STATUS[c.status] || { label: c.status, color: COLORS.textMuted };
            return (
              <div key={c.id} style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, boxShadow: SHADOWS.button }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textPrimary }}>{c.title}</div>
                  <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 800, color: st.color, background: st.color + "20", padding: "3px 8px", borderRadius: RADIUS.sm }}>{st.label}</span>
                </div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 4 }}>ضد: {c.againstName}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* LAIHA */}
      {!loading && subTab === "laiha" && <LaihaViewer />}

      {/* Modals */}
      {showComplaintModal && <FileComplaintModal user={user} onClose={function(){ setShowComplaintModal(false); }} onSubmit={function(){ setShowComplaintModal(false); loadAll(); }} />}
      {activeInvestigation && <RespondInvestigationModal investigation={activeInvestigation} onClose={function(){ setActiveInvestigation(null); }} onSubmit={function(){ setActiveInvestigation(null); loadAll(); }} />}
      {activeViolation && <ViolationDetailModal violation={activeViolation} user={user} onClose={function(){ setActiveViolation(null); }} onAppeal={function(){ setActiveViolation(null); loadAll(); }} />}
    </div>
  );
}

/* ── LAIHA VIEWER (لقراءة اللائحة) ── */
function LaihaViewer() {
  var [chapter, setChapter] = useState("مواعيد العمل");
  var items = ALL_VIOLATIONS_DEFAULT.filter(function(i){ return i.chapter === chapter; });

  return (
    <div>
      <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.goldLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md }}>
        <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.goldLight }}>📜 لائحة تنظيم العمل</div>
        <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.7 }}>
          رقم الاعتماد: <strong style={{ color: COLORS.textPrimary }}>{LAIHA_INFO.approvalNumber}</strong><br />
          المصدر: {LAIHA_INFO.source}
        </div>
      </div>

      <div style={{ display: "flex", gap: SPACING.xs, marginBottom: SPACING.md, overflowX: "auto" }}>
        {["مواعيد العمل", "تنظيم العمل", "سلوك العامل"].map(function(ch) {
          var a = chapter === ch;
          return <button key={ch} onClick={function(){ setChapter(ch); }} style={{ padding: "7px 12px", borderRadius: RADIUS.sm, background: a ? COLORS.goldGradient : COLORS.metallic, border: "1px solid " + (a ? COLORS.goldLight : COLORS.metallicBorder), color: a ? COLORS.textOnGold : COLORS.textMuted, ...TYPOGRAPHY.tiny, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{ch}</button>;
        })}
      </div>

      {items.map(function(item) {
        return (
          <div key={item.id} style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: COLORS.goldDark, padding: "2px 6px", borderRadius: 4 }}>{item.id}</span>
              <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>البند {item.number}</span>
            </div>
            <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary, lineHeight: 1.6, marginBottom: 8 }}>{item.description}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
              {["first","second","third","fourth"].map(function(occ, idx) {
                var code = item.penalties[occ];
                var label = code ? (PENALTY_TYPES[code] || {}).label : "—";
                return (
                  <div key={occ} style={{ background: "rgba(0,0,0,.2)", borderRadius: 4, padding: 4, textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: COLORS.textMuted }}>{["أول","ثاني","ثالث","رابع"][idx]}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: code ? COLORS.goldLight : COLORS.textMuted }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── FILE COMPLAINT MODAL (رفع شكوى) ── */
function FileComplaintModal({ user, onClose, onSubmit }) {
  var [step, setStep] = useState(1);
  var [allEmps, setAllEmps] = useState([]);
  var [againstId, setAgainstId] = useState("");
  var [violationId, setViolationId] = useState("");
  var [title, setTitle] = useState("");
  var [details, setDetails] = useState("");
  var [evidence, setEvidence] = useState([]);
  var [saving, setSaving] = useState(false);
  var fileRef = useRef(null);

  useEffect(function() {
    api("employees").then(function(e){ setAllEmps((e || []).filter(function(x){ return x.id !== user.id; })); }).catch(function(){});
  }, []);

  function addPhoto(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(function(file) {
      if (file.size > 2 * 1024 * 1024) { alert("حجم الملف كبير — الحد 2 ميجابايت"); return; }
      var reader = new FileReader();
      reader.onload = function(ev) {
        setEvidence(function(prev){ return [...prev, { name: file.name, type: file.type, data: ev.target.result }]; });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  async function submit() {
    if (!againstId || !violationId || !details) { alert("املأ جميع الحقول"); return; }
    setSaving(true);
    var target = allEmps.find(function(e){ return e.id === againstId; });
    var viol = ALL_VIOLATIONS_DEFAULT.find(function(v){ return v.id === violationId; });
    try {
      await api("complaints", {
        method: "POST",
        body: {
          filedBy: user.id,
          filedByName: user.name,
          against: againstId,
          againstName: target ? target.name : againstId,
          violationId: violationId,
          chapter: viol ? viol.chapter : null,
          title: title || (viol ? viol.description.slice(0, 80) : "شكوى"),
          details: details,
          evidence: evidence.map(function(e){ return { name: e.name, type: e.type }; }),
        },
      });
      alert("✓ تم رفع الشكوى بنجاح — ستصل لمدير الموارد البشرية");
      onSubmit();
    } catch(e) { alert("فشل: " + e.message); }
    setSaving(false);
  }

  var filteredViols = ALL_VIOLATIONS_DEFAULT;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: SPACING.md }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: "linear-gradient(180deg, " + COLORS.bg1 + ", " + COLORS.bg2 + ")", borderRadius: RADIUS.xl, padding: SPACING.lg, maxWidth: 500, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid " + COLORS.metallicBorder, boxShadow: SHADOWS.button }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <div style={{ ...TYPOGRAPHY.h2, color: COLORS.goldLight }}>رفع شكوى رسمية</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.textMuted }}>×</button>
        </div>

        <div style={{ background: "rgba(0,0,0,.3)", padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.md, border: "1px solid " + COLORS.metallicBorder }}>
          <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.7 }}>
            ⚠️ الشكوى الكيدية (غير الصادقة) تعرّضك لجزاء وفق البند <strong style={{ color: COLORS.textDanger }}>BH-14</strong> من اللائحة
          </div>
        </div>

        <div style={{ marginBottom: SPACING.md }}>
          <label style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>المشكو ضده</label>
          <select value={againstId} onChange={function(e){ setAgainstId(e.target.value); }} style={{ width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 13, marginTop: 6, fontFamily: TYPOGRAPHY.fontTajawal }}>
            <option value="" style={{ background: "#0d2445" }}>-- اختر --</option>
            {allEmps.map(function(e){ return <option key={e.id} value={e.id} style={{ background: "#0d2445", color: "#fff" }}>{e.name} ({e.id})</option>; })}
          </select>
        </div>

        <div style={{ marginBottom: SPACING.md }}>
          <label style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>نوع المخالفة (من اللائحة)</label>
          <select value={violationId} onChange={function(e){ setViolationId(e.target.value); }} style={{ width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 12, marginTop: 6, fontFamily: TYPOGRAPHY.fontTajawal }}>
            <option value="" style={{ background: "#0d2445" }}>-- اختر البند --</option>
            {["مواعيد العمل", "تنظيم العمل", "سلوك العامل"].map(function(ch) {
              var chapterItems = filteredViols.filter(function(v){ return v.chapter === ch; });
              return (
                <optgroup key={ch} label={ch} style={{ background: "#0d2445", color: "#fff" }}>
                  {chapterItems.map(function(v){ return <option key={v.id} value={v.id} style={{ background: "#0d2445", color: "#fff" }}>{v.id}: {v.description.slice(0, 60)}...</option>; })}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div style={{ marginBottom: SPACING.md }}>
          <label style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>عنوان الشكوى (اختياري)</label>
          <input value={title} onChange={function(e){ setTitle(e.target.value); }} placeholder="عنوان مختصر" style={{ width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 13, marginTop: 6, fontFamily: TYPOGRAPHY.fontTajawal }} />
        </div>

        <div style={{ marginBottom: SPACING.lg }}>
          <label style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>التفاصيل (الواقعة والأدلة)</label>
          <textarea value={details} onChange={function(e){ setDetails(e.target.value); }} rows={6} placeholder="اذكر الوقت والمكان وتفاصيل الواقعة بدقة..." style={{ width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 12, marginTop: 6, fontFamily: TYPOGRAPHY.fontTajawal, resize: "vertical" }} />
        </div>

        {/* Evidence photos */}
        <div style={{ marginBottom: SPACING.lg }}>
          <label style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>مرفقات (صور/أدلة) — اختياري</label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhoto} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: SPACING.sm, marginTop: 8, flexWrap: "wrap" }}>
            {evidence.map(function(ev, i) {
              return (
                <div key={i} style={{ position: "relative", width: 64, height: 64, borderRadius: RADIUS.md, overflow: "hidden", border: "1px solid " + COLORS.metallicBorder }}>
                  <img src={ev.data} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={function(){ setEvidence(function(p){ return p.filter(function(_, j){ return j !== i; }); }); }} style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: 9, background: COLORS.textDanger, border: "none", color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              );
            })}
            <button onClick={function(){ fileRef.current && fileRef.current.click(); }} style={{ width: 64, height: 64, borderRadius: RADIUS.md, background: "rgba(0,0,0,.2)", border: "1px dashed " + COLORS.metallicBorder, color: COLORS.textMuted, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
          <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 4 }}>الحد: 2 ميجابايت لكل صورة</div>
        </div>

        <div style={{ display: "flex", gap: SPACING.sm }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo }}>إلغاء</button>
          <button onClick={submit} disabled={saving || !againstId || !violationId || !details} style={{ flex: 2, height: 44, borderRadius: RADIUS.lg, background: (saving || !againstId || !violationId || !details) ? COLORS.metallic : COLORS.goldGradient, border: "1px solid " + COLORS.goldLight, color: (saving || !againstId || !violationId || !details) ? COLORS.textMuted : COLORS.textOnGold, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: SHADOWS.gold }}>{saving ? "جارِ الإرسال..." : "✉️ رفع الشكوى"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── RESPOND INVESTIGATION MODAL ── */
function RespondInvestigationModal({ investigation, onClose, onSubmit }) {
  var [response, setResponse] = useState(investigation.empResponse || "");
  var [saving, setSaving] = useState(false);
  var viol = ALL_VIOLATIONS_DEFAULT.find(function(v){ return v.id === investigation.violationId; });

  var readOnly = investigation.status !== "WAITING_RESPONSE";

  async function submit() {
    if (!response.trim()) { alert("الرد مطلوب"); return; }
    setSaving(true);
    try {
      await api("investigations", {
        method: "PUT",
        body: {
          id: investigation.id,
          status: "RESPONSE_RECEIVED",
          empResponse: response,
          empResponseAt: new Date().toISOString(),
        },
      });
      alert("✓ تم إرسال ردك — بانتظار قرار مدير الموارد البشرية");
      onSubmit();
    } catch(e) { alert("فشل: " + e.message); }
    setSaving(false);
  }

  var now = new Date();
  var deadline = new Date(investigation.deadline);
  var hoursLeft = Math.floor((deadline - now) / 3600000);
  var overdue = hoursLeft < 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: SPACING.md }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: "linear-gradient(180deg, " + COLORS.bg1 + ", " + COLORS.bg2 + ")", borderRadius: RADIUS.xl, padding: SPACING.lg, maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto", border: "2px solid " + COLORS.textDanger, boxShadow: SHADOWS.button }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <div style={{ ...TYPOGRAPHY.h2, color: COLORS.textDanger }}>🔍 استمارة تحقيق</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.textMuted }}>×</button>
        </div>

        {!readOnly && (
          <div style={{ background: overdue ? COLORS.textDanger + "25" : "rgba(234, 179, 8, 0.2)", border: "1px solid " + (overdue ? COLORS.textDanger : "#eab308"), padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.md }}>
            <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: overdue ? COLORS.textDanger : "#eab308" }}>
              {overdue ? "⚠️ تجاوزت المهلة" : "⏱ " + hoursLeft + " ساعة متبقية"}
            </div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 2 }}>المهلة: {deadline.toLocaleString("ar-SA")}</div>
          </div>
        )}

        <div style={{ background: "rgba(0,0,0,.3)", padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, border: "1px solid " + COLORS.metallicBorder }}>
          <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textPrimary, marginBottom: 6 }}>{investigation.title}</div>
          {viol && (
            <div style={{ background: COLORS.goldDark + "30", padding: 8, borderRadius: 6, marginTop: 8, marginBottom: 8 }}>
              <div style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: COLORS.goldLight, marginBottom: 2 }}>📜 البند القانوني: {viol.id}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.6 }}>{viol.description}</div>
            </div>
          )}
          <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{investigation.description}</div>
        </div>

        <div style={{ marginBottom: SPACING.md }}>
          <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.goldLight, marginBottom: SPACING.sm }}>❓ الأسئلة</div>
          {investigation.questions.map(function(q, i) {
            return (
              <div key={i} style={{ background: "rgba(0,0,0,.25)", padding: SPACING.sm, borderRadius: RADIUS.sm, marginBottom: 6, border: "1px solid " + COLORS.metallicBorder }}>
                <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary }}><strong>{i+1}.</strong> {q}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: SPACING.lg }}>
          <label style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textPrimary }}>ردك المفصل</label>
          <textarea value={response} onChange={function(e){ setResponse(e.target.value); }} rows={8} disabled={readOnly} placeholder="اشرح موقفك بتفصيل شامل على جميع الأسئلة — هذا الرد سيُوثق في ملفك..." style={{ width: "100%", padding: SPACING.md, borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 12, marginTop: 6, fontFamily: TYPOGRAPHY.fontTajawal, resize: "vertical", lineHeight: 1.7 }} />
        </div>

        {investigation.hrDecisionNotes && (
          <div style={{ background: investigation.hrDecision === "close_innocent" ? "#10b98115" : COLORS.textDanger + "15", border: "1px solid " + (investigation.hrDecision === "close_innocent" ? "#10b981" : COLORS.textDanger), padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md }}>
            <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: investigation.hrDecision === "close_innocent" ? "#10b981" : COLORS.textDanger, marginBottom: 4 }}>
              {investigation.hrDecision === "close_innocent" ? "✓ قرار HR: الإغلاق (برئ)" : "⚖️ قرار HR: تحويل لمخالفة"}
            </div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.7 }}>{investigation.hrDecisionNotes}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: SPACING.sm }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo }}>إغلاق</button>
          {!readOnly && <button onClick={submit} disabled={saving || !response.trim()} style={{ flex: 2, height: 44, borderRadius: RADIUS.lg, background: (saving || !response.trim()) ? COLORS.metallic : COLORS.goldGradient, border: "1px solid " + COLORS.goldLight, color: (saving || !response.trim()) ? COLORS.textMuted : COLORS.textOnGold, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: SHADOWS.gold }}>{saving ? "جارِ..." : "✉️ إرسال الرد"}</button>}
        </div>
      </div>
    </div>
  );
}

/* ── VIOLATION DETAIL + APPEAL ── */
function ViolationDetailModal({ violation, user, onClose, onAppeal }) {
  var [showAppeal, setShowAppeal] = useState(false);
  var [reason, setReason] = useState("");
  var [saving, setSaving] = useState(false);
  var viol = ALL_VIOLATIONS_DEFAULT.find(function(v){ return v.id === violation.violationId; });

  async function submitAppeal() {
    if (!reason.trim()) { alert("أسباب التظلم مطلوبة"); return; }
    setSaving(true);
    try {
      await api("appeals", {
        method: "POST",
        body: {
          violationId: violation.id,
          empId: user.id,
          empName: user.name,
          reason: reason,
        },
      });
      alert("✓ تم رفع التظلم — سيتم الرد خلال 5 أيام عمل");
      onAppeal();
    } catch(e) { alert("فشل: " + e.message); }
    setSaving(false);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: SPACING.md }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: "linear-gradient(180deg, " + COLORS.bg1 + ", " + COLORS.bg2 + ")", borderRadius: RADIUS.xl, padding: SPACING.lg, maxWidth: 500, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid " + COLORS.metallicBorder, boxShadow: SHADOWS.button }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <div style={{ ...TYPOGRAPHY.h2, color: COLORS.textDanger }}>⚖️ تفاصيل المخالفة</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.textMuted }}>×</button>
        </div>

        <div style={{ background: "rgba(0,0,0,.3)", padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, border: "1px solid " + COLORS.metallicBorder }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: COLORS.goldDark, padding: "3px 8px", borderRadius: 4 }}>{violation.violationId}</span>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>المرة {violation.occurrence}</span>
          </div>
          <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1.7, marginBottom: 8 }}>{violation.description}</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 10, background: COLORS.textDanger + "25", borderRadius: RADIUS.sm }}>
            <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>الجزاء:</span>
            <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textDanger }}>{violation.penaltyLabel}</span>
          </div>
        </div>

        <div style={{ background: COLORS.goldDark + "20", padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.md, border: "1px solid " + COLORS.goldLight }}>
          <div style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: COLORS.goldLight, marginBottom: 4 }}>📜 المرجع القانوني</div>
          <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.7 }}>{violation.legalRef}</div>
        </div>

        {violation.notes && (
          <div style={{ background: "rgba(0,0,0,.2)", padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.md }}>
            <div style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: COLORS.goldLight, marginBottom: 4 }}>ملاحظات</div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.7 }}>{violation.notes}</div>
          </div>
        )}

        {violation.status === "ACTIVE" && !showAppeal && (
          <button onClick={function(){ setShowAppeal(true); }} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.textDanger, color: COLORS.textDanger, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, marginBottom: SPACING.sm }}>📢 تقديم تظلم</button>
        )}

        {showAppeal && (
          <div style={{ background: "rgba(0,0,0,.3)", padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, border: "1px solid " + COLORS.textDanger }}>
            <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textDanger, marginBottom: 8 }}>📢 تظلم من المخالفة (المادة 54)</div>
            <textarea value={reason} onChange={function(e){ setReason(e.target.value); }} rows={6} placeholder="اشرح أسباب التظلم..." style={{ width: "100%", padding: SPACING.sm, borderRadius: RADIUS.sm, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 12, fontFamily: TYPOGRAPHY.fontTajawal, resize: "vertical", marginBottom: SPACING.sm }} />
            <div style={{ display: "flex", gap: SPACING.sm }}>
              <button onClick={function(){ setShowAppeal(false); }} style={{ flex: 1, height: 40, borderRadius: RADIUS.md, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
              <button onClick={submitAppeal} disabled={saving} style={{ flex: 2, height: 40, borderRadius: RADIUS.md, background: COLORS.textDanger, border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{saving ? "..." : "رفع التظلم"}</button>
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo }}>إغلاق</button>
      </div>
    </div>
  );
}

/* ═══════════ CUSTODY ═══════════ */
function CustodyTab({ user }) {
  var [items, setItems] = useState([]);
  useEffect(function() {
    api("custody", { params: { empId: user.id } }).then(function(d) { setItems(d || []); }).catch(function(){});
  }, []);

  var statusMap = { active: { label: "مستلمة", color: COLORS.goldLight }, returned: { label: "مرتجعة", color: COLORS.textMuted }, lost: { label: "مفقودة", color: COLORS.textDanger } };

  return (
    <div>
      <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>{"العهد (" + items.length + ")"}</div>
      {items.length === 0 && <div style={{ textAlign: "center", color: COLORS.textMuted, ...TYPOGRAPHY.bodySm, padding: SPACING.xl }}>لا توجد عهد مسجلة</div>}
      {items.map(function(item, i) {
        var s = statusMap[item.status] || statusMap.active;
        return (
          <div key={item.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm + "px 0", borderBottom: i < items.length - 1 ? "1px solid " + COLORS.cardRowBorder : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{item.name || "عهدة"}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{(item.serial ? "SN: " + item.serial + " · " : "") + (item.createdAt ? item.createdAt.split("T")[0] : "")}</div>
              {item.type === "cash" && <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.goldLight }}>{"عهدة نقدية: " + (item.amount || 0) + " ريال"}</div>}
            </div>
            <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: s.color, padding: "3px 10px", borderRadius: RADIUS.sm, background: s.color + "20" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ DELEGATION (الانتداب) ═══════════ */
function DelegationCard({ user }) {
  var [delegations, setDelegations] = useState([]);
  useEffect(function() {
    api("delegations").then(function(d) { setDelegations((d || []).filter(function(dl){ return dl.empId === user.id || dl.requestedBy === user.id; })); }).catch(function(){});
  }, []);

  if (delegations.length === 0) return null;

  var statusMap = { pending: { label: "بانتظار الاعتماد", color: COLORS.textMuted }, approved: { label: "معتمد", color: COLORS.goldLight }, rejected: { label: "مرفوض", color: COLORS.textDanger } };

  return (
    <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.xl, padding: SPACING.lg, boxShadow: SHADOWS.button, marginBottom: SPACING.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
        <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>الانتدابات</span>
        <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{delegations.length}</span>
      </div>
      {delegations.map(function(dl, i) {
        var s = statusMap[dl.status] || statusMap.pending;
        return (
          <div key={dl.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm + "px 0", borderBottom: i < delegations.length - 1 ? "1px solid " + COLORS.cardRowBorder : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{dl.reason || "انتداب"}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{(dl.from || "") + " → " + (dl.to || "")}</div>
            </div>
            <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: s.color, padding: "3px 8px", borderRadius: RADIUS.sm, background: s.color + "20" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ VIOLATIONS PANEL (سجل المخالفات والإنذارات) ═══════════ */
/* ═══════════ WEEKLY CHART — رسم بياني أسبوعي للحضور ═══════════ */
function WeeklyChart({ allAtt, empId, branch }) {
  var dayNames = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

  // Last 14 days (excluding Fridays)
  var bars = [];
  for (var i = 13; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 5) continue; // skip Friday
    var ds = d.toISOString().split("T")[0];
    var dayAtt = allAtt.filter(function(a){ return a.empId === empId && a.date === ds; });
    var checkin = dayAtt.find(function(a){ return a.type === "checkin"; });
    var status = "absent";
    var lateMin = 0;
    if (checkin) {
      status = "present";
      if (branch && branch.start) {
        var parts = branch.start.split(":");
        var startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        var cMin = new Date(checkin.ts).getHours() * 60 + new Date(checkin.ts).getMinutes();
        lateMin = Math.max(0, cMin - startMin);
        if (lateMin > 5) status = "late";
      }
    }
    bars.push({ date: ds, day: dayNames[d.getDay()], dayNum: d.getDate(), status: status, lateMin: lateMin });
  }

  if (bars.length === 0) return null;

  var presentCount = bars.filter(function(b){ return b.status === "present"; }).length;
  var lateCount = bars.filter(function(b){ return b.status === "late"; }).length;
  var absentCount = bars.filter(function(b){ return b.status === "absent"; }).length;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
        <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>آخر أسبوعين</span>
        <div style={{ display: "flex", gap: SPACING.sm }}>
          {[
            { c: "#10b981", l: "حاضر " + presentCount },
            { c: "#eab308", l: "متأخر " + lateCount },
            { c: COLORS.textDanger, l: "غائب " + absentCount },
          ].map(function(x, i){ return <span key={i} style={{ ...TYPOGRAPHY.tiny, color: x.c, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: x.c, display: "inline-block" }} />{x.l}</span>; })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
        {bars.map(function(b, i) {
          var color = b.status === "present" ? "#10b981" : b.status === "late" ? "#eab308" : COLORS.textDanger + "60";
          var h = b.status === "absent" ? 8 : b.status === "late" ? 30 + Math.min(b.lateMin, 40) : 72;
          var isToday = b.date === new Date().toISOString().split("T")[0];
          return (
            <div key={i} style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "100%", maxWidth: 20, height: h, borderRadius: 4, background: color, transition: "height .3s", border: isToday ? "2px solid " + COLORS.goldLight : "none" }} />
              <div style={{ ...TYPOGRAPHY.tiny, color: isToday ? COLORS.goldLight : COLORS.textMuted, marginTop: 4, fontWeight: isToday ? 800 : 400, fontSize: 8 }}>{b.day}</div>
              <div style={{ fontSize: 7, color: COLORS.textMuted }}>{b.dayNum}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InvestigationBanner({ user }) {
  var [pending, setPending] = useState(null);

  useEffect(function() {
    api("investigations", { params: { empId: user.id, status: "WAITING_RESPONSE" } }).then(function(list) {
      if (list && list.length > 0) setPending(list[0]);
    }).catch(function(){});
  }, []);

  if (!pending) return null;

  var now = new Date();
  var deadline = new Date(pending.deadline);
  var hoursLeft = Math.floor((deadline - now) / 3600000);
  var overdue = hoursLeft < 0;

  function goToLegal() {
    // Navigate to profile → legal tab
    window.dispatchEvent(new CustomEvent("basma:goto-legal"));
  }

  return (
    <div onClick={goToLegal} style={{ background: "linear-gradient(135deg, " + COLORS.textDanger + "30, " + COLORS.textDanger + "15)", border: "2px solid " + COLORS.textDanger, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, cursor: "pointer", boxShadow: SHADOWS.button, animation: overdue ? "pulse 2s infinite" : "none" }}>
      <style>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 ${COLORS.textDanger}40; } 50% { box-shadow: 0 0 0 8px ${COLORS.textDanger}00; } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textDanger, flex: 1 }}>استمارة تحقيق بانتظار ردك</div>
      </div>
      <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textPrimary, marginBottom: 4 }}>{pending.title}</div>
      <div style={{ ...TYPOGRAPHY.tiny, color: overdue ? COLORS.textDanger : COLORS.textMuted, fontWeight: 700, marginTop: 6 }}>
        {overdue ? "⚠️ تجاوزت المهلة القانونية" : "⏱ " + hoursLeft + " ساعة متبقية للرد"}
      </div>
      <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 4 }}>اضغط للذهاب للاستمارة →</div>
    </div>
  );
}

function ViolationsCard({ user }) {
  var [violations, setViolations] = useState([]);
  var [expanded, setExpanded] = useState(false);

  useEffect(function() {
    api("violations_v2", { params: { empId: user.id, status: "ACTIVE" } }).then(function(v) { setViolations(v || []); }).catch(function(){});
  }, []);

  var total = violations.length;
  if (total === 0) return null;

  return (
    <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.textDanger + "60", borderRadius: RADIUS.xl, padding: SPACING.lg, boxShadow: SHADOWS.button, marginBottom: SPACING.md }}>
      <div onClick={function(){ setExpanded(!expanded); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>{"⚖️ مخالفات سارية (" + total + ")"}</span>
        <span style={{ color: COLORS.textDanger }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: SPACING.md }}>
          {violations.map(function(v, i) {
            return (
              <div key={v.id || i} style={{ padding: SPACING.sm + "px 0", borderBottom: i < violations.length - 1 ? "1px solid " + COLORS.cardRowBorder : "none" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: COLORS.goldDark, padding: "2px 6px", borderRadius: 4 }}>{v.violationId}</span>
                  <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>المرة {v.occurrence}</span>
                </div>
                <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1.5 }}>{v.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{v.createdAt ? new Date(v.createdAt).toLocaleDateString("ar-SA") : ""}</span>
                  <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textDanger }}>{v.penaltyLabel}</span>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: SPACING.sm, padding: SPACING.sm, background: "rgba(0,0,0,.15)", borderRadius: RADIUS.sm, ...TYPOGRAPHY.tiny, color: COLORS.textMuted, textAlign: "center" }}>
            اذهب إلى: حسابي → الشؤون القانونية لعرض التفاصيل والتظلم
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ MEMBERSHIP FREEZE (تجميد العضوية) ═══════════ */
function MembershipFreezeNotice({ user }) {
  if (!user.membershipFrozen) return null;
  return (
    <div style={{ background: C.red + "12", border: "1.5px solid " + C.red + "30", borderRadius: 14, padding: 14, marginBottom: 12, textAlign: "center" }}>
      <div style={{ fontSize: 16, marginBottom: 4 }}>❄️</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.red }}>العضوية مجمّدة</div>
      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{user.frozenReason || "بقرار إداري"}</div>
      <div style={{ fontSize: 9, color: C.sub, marginTop: 4 }}>النقاط لا تُحتسب أثناء التجميد — تواصل مع الموارد البشرية</div>
    </div>
  );
}

/* ═══════════ BRANCH HOLIDAYS (الإجازات الرسمية لكل فرع) ═══════════ */
function BranchHolidayBanner({ branch }) {
  if (!branch) return null;
  var holidays_sa = [
    { name: "اليوم الوطني", date: "09-23" },
    { name: "يوم التأسيس", date: "02-22" },
    { name: "عيد الفطر", date: "03-30" },
    { name: "عيد الأضحى", date: "06-07" },
  ];
  var holidays_tr = [
    { name: "يوم الجمهورية", date: "10-29" },
    { name: "عيد الطفولة", date: "04-23" },
    { name: "يوم النصر", date: "08-30" },
  ];
  var holidays = (branch.tz && branch.tz.includes("Istanbul")) ? holidays_tr : holidays_sa;
  var today = todayStr();
  var todayMD = today.slice(5);
  var holiday = holidays.find(function(h){ return h.date === todayMD; });

  if (!holiday) return null;
  return (
    <div style={{ background: "linear-gradient(135deg, #FF6B9D, #C850C0)", borderRadius: 16, padding: 14, marginBottom: 12, textAlign: "center", color: "#fff" }} className="basma-fadein">
      <div style={{ fontSize: 24, marginBottom: 4 }}>🎉</div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{"إجازة رسمية — " + holiday.name}</div>
      <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>{branch.name + " — يوم عطلة رسمية"}</div>
    </div>
  );
}

/* ═══════════ EXPORT BUTTONS (تصدير مسير الرواتب + التأمين) ═══════════ */
function ExportButtons({ user, allAtt, branch, allEmps }) {
  if (!user.isManager) return null;

  function exportPayroll() {
    var rows = ["رقم الموظف,الاسم,الراتب الأساسي,نسبة الانضباط,المستحق,IBAN"];
    (allEmps || []).forEach(function(emp) {
      var monthAtt = allAtt.filter(function(r){ return r.empId === emp.id && r.type === "checkin"; });
      var days = new Set(monthAtt.map(function(r){ return r.date; })).size;
      var workDays = Math.max(1, new Date().getDate());
      var pct = Math.round((days / workDays) * 100);
      var salary = emp.salary || 0;
      var due = Math.round(salary * pct / 100);
      rows.push([emp.id, emp.name, salary, pct + "%", due, emp.iban || "—"].join(","));
    });
    var csv = "\uFEFF" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "payroll-" + todayStr().slice(0,7) + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function exportInsurance() {
    var rows = ["رقم الموظف,الاسم,المرافق,القرابة,الميلاد,الهوية,تأمين خارجي"];
    rows.push("— سيتم تحميل البيانات من API —");
    var csv = "\uFEFF" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "insurance-data-" + todayStr() + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      <button onClick={exportPayroll} style={{ flex: 1, padding: "10px 6px", borderRadius: 12, background: C.card, border: "1px solid " + C.bg, fontSize: 10, fontWeight: 700, color: C.text, cursor: "pointer", textAlign: "center" }}>
        💰 مسير الرواتب
      </button>
      <button onClick={exportInsurance} style={{ flex: 1, padding: "10px 6px", borderRadius: 12, background: C.card, border: "1px solid " + C.bg, fontSize: 10, fontWeight: 700, color: C.text, cursor: "pointer", textAlign: "center" }}>
        🏥 بيانات التأمين
      </button>
    </div>
  );
}


/* ═══════════ DEPENDENTS (المرافقين) ═══════════ */
function DependentsTab({ user }) {
  var [deps, setDeps] = useState([]);
  var [adding, setAdding] = useState(false);
  var [form, setForm] = useState({ name: "", relation: "ابن", dob: "", idNumber: "", externalInsurance: false, insurerName: "" });

  useEffect(function() {
    api("dependents", { params: { empId: user.id } }).then(function(d) { setDeps(d || []); }).catch(function(){});
  }, []);

  function save() {
    api("dependents", { method: "POST", body: { empId: user.id, ...form } }).then(function() {
      setDeps(function(prev) { return prev.concat([{ id: "D" + Date.now(), ...form, status: "pending" }]); });
      setAdding(false);
      setForm({ name: "", relation: "ابن", dob: "", idNumber: "", externalInsurance: false, insurerName: "" });
    });
  }

  var relations = ["زوج/زوجة", "ابن", "ابنة", "أب", "أم"];
  var inputStyle = { width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 13, marginBottom: SPACING.sm, fontFamily: TYPOGRAPHY.fontTajawal, outline: "none" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
        <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>{"المرافقين (" + deps.length + ")"}</div>
        <button onClick={function(){ setAdding(!adding); }} style={{ padding: "6px 14px", borderRadius: RADIUS.sm, background: COLORS.metallic, border: "1px solid " + COLORS.goldLight, color: COLORS.goldLight, ...TYPOGRAPHY.caption, fontWeight: 700, cursor: "pointer" }}>{adding ? "إلغاء" : "+ إضافة"}</button>
      </div>

      {adding && (
        <div style={{ padding: SPACING.md, borderRadius: RADIUS.lg, background: "rgba(0,0,0,.15)", border: "1px solid " + COLORS.metallicBorder, marginBottom: SPACING.md }}>
          <input value={form.name} onChange={function(e){ setForm({...form, name: e.target.value}); }} placeholder="الاسم الكامل" style={inputStyle} />
          <div style={{ display: "flex", gap: SPACING.xs, marginBottom: SPACING.sm }}>
            <select value={form.relation} onChange={function(e){ setForm({...form, relation: e.target.value}); }} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
              {relations.map(function(r){ return React.createElement("option", { key: r, value: r, style: { background: "#0d2445", color: COLORS.textPrimary } }, r); })}
            </select>
            <input type="date" value={form.dob} onChange={function(e){ setForm({...form, dob: e.target.value}); }} style={{ ...inputStyle, flex: 1, marginBottom: 0, colorScheme: "dark" }} />
          </div>
          <input value={form.idNumber} onChange={function(e){ setForm({...form, idNumber: e.target.value}); }} placeholder="رقم الهوية/الإقامة" style={inputStyle} />
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <input type="checkbox" checked={form.externalInsurance} onChange={function(e){ setForm({...form, externalInsurance: e.target.checked}); }} style={{ accentColor: COLORS.goldLight }} />
            <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>مؤمّن عليه مع جهة أخرى</span>
          </div>
          {form.externalInsurance && <input value={form.insurerName} onChange={function(e){ setForm({...form, insurerName: e.target.value}); }} placeholder="اسم شركة التأمين" style={inputStyle} />}
          <button onClick={save} disabled={!form.name} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: form.name ? COLORS.goldGradient : COLORS.metallic, border: "1px solid " + (form.name ? COLORS.goldLight : COLORS.metallicBorder), color: form.name ? COLORS.textOnGold : COLORS.textMuted, fontSize: 13, fontWeight: 800, cursor: form.name ? "pointer" : "not-allowed", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: form.name ? SHADOWS.gold : "none" }}>حفظ المرافق</button>
        </div>
      )}

      {deps.length === 0 && !adding && <div style={{ textAlign: "center", color: COLORS.textMuted, ...TYPOGRAPHY.bodySm, padding: SPACING.xl }}>لا يوجد مرافقين</div>}
      {deps.map(function(d, i) {
        var statusColors = { pending: COLORS.textMuted, approved: COLORS.goldLight, rejected: COLORS.textDanger };
        var statusLabels = { pending: "بانتظار الاعتماد", approved: "معتمد", rejected: "مرفوض" };
        return (
          <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm + "px 0", borderBottom: i < deps.length - 1 ? "1px solid " + COLORS.cardRowBorder : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{d.name}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{d.relation + (d.externalInsurance ? " · تأمين خارجي" : "")}</div>
            </div>
            <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: statusColors[d.status] || COLORS.textMuted, padding: "3px 8px", borderRadius: RADIUS.sm, background: (statusColors[d.status] || COLORS.textMuted) + "20" }}>{statusLabels[d.status] || "بانتظار"}</span>
          </div>
        );
      })}
      <HealthDisclosureCollapsible user={user} />
    </div>
  );
}

/* ── Collapsible wrapper for HealthDisclosure inside Dependents ── */
function HealthDisclosureCollapsible({ user }) {
  var [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: SPACING.lg, borderTop: "1px solid " + COLORS.metallicBorder, paddingTop: SPACING.md }}>
      <button onClick={function(){ setOpen(!open); }} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", padding: SPACING.sm + "px 0", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
          <div style={{ width: 32, height: 32, borderRadius: RADIUS.md, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.goldLight }}><Icons.alert size={16} /></div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>الإفصاح الصحي</div>
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 2 }}>أسئلة التأمين — يُعتمد من HR</div>
          </div>
        </div>
        <div style={{ color: COLORS.goldLight, fontSize: 14, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .3s" }}>▼</div>
      </button>
      {open && (
        <div style={{ marginTop: SPACING.sm }}>
          <HealthDisclosureTab user={user} />
        </div>
      )}
    </div>
  );
}

/* ═══════════ HEALTH DISCLOSURE (الإفصاح الصحي) ═══════════ */
function HealthDisclosureTab({ user }) {
  var defaultQuestions = [
    "هل يعاني من أمراض مزمنة؟ (سكر، ضغط، قلب، ربو)",
    "هل يتناول أدوية حالياً؟",
    "هل أجرى عمليات جراحية سابقة؟",
    "هل لديه إعاقة؟",
    "ملاحظات صحية إضافية"
  ];
  var [answers, setAnswers] = useState({});
  var [saved, setSaved] = useState(false);

  function updateAnswer(idx, val) {
    setAnswers(function(prev) { var n = {...prev}; n[idx] = val; return n; });
  }

  function save() {
    api("health_disclosure", { method: "POST", body: { empId: user.id, answers: answers, date: todayStr() } }).then(function() { setSaved(true); }).catch(function(){});
  }

  return (
    <div>
      <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>الإفصاح الصحي</div>
      <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginBottom: SPACING.md }}>أسئلة الإفصاح لأغراض التأمين — يُعتمد من الموارد البشرية</div>
      {defaultQuestions.map(function(q, i) {
        return (
          <div key={i} style={{ marginBottom: SPACING.md }}>
            <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>{(i + 1) + ". " + q}</div>
            <textarea value={answers[i] || ""} onChange={function(e){ updateAnswer(i, e.target.value); }} placeholder="الإجابة..." rows={2} style={{ width: "100%", padding: SPACING.sm + "px " + SPACING.md + "px", borderRadius: RADIUS.md, border: "1px solid " + COLORS.metallicBorder, background: "rgba(0,0,0,.25)", color: COLORS.textPrimary, fontSize: 12, resize: "none", fontFamily: TYPOGRAPHY.fontTajawal, outline: "none" }} />
          </div>
        );
      })}
      <button onClick={save} style={{ width: "100%", height: 44, borderRadius: RADIUS.lg, background: saved ? COLORS.metallic : COLORS.goldGradient, border: "1px solid " + (saved ? COLORS.goldLight : COLORS.goldLight), color: saved ? COLORS.goldLight : COLORS.textOnGold, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, boxShadow: saved ? SHADOWS.button : SHADOWS.gold }}>
        {saved ? "✓ تم الحفظ" : "حفظ الإفصاح"}
      </button>
      {saved && <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xs }}>{"تاريخ الإفصاح: " + todayStr() + " — بانتظار اعتماد HR"}</div>}
    </div>
  );
}

/* ═══════════ ATTACHMENTS (المرفقات) ═══════════ */
function AttachmentsTab({ user }) {
  var [docTypes, setDocTypes] = useState([]);
  var [docs, setDocs] = useState([]);

  useEffect(function() {
    api("attachments", { params: { empId: user.id } }).then(function(d) { setDocs(d || []); }).catch(function(){});
    // Load doc types from admin settings, fallback to default
    api("attachment_types").then(function(types){
      if (types && types.length) setDocTypes(types);
      else setDocTypes(["بطاقة هوية", "جواز سفر", "رخصة قيادة", "عقد عمل", "IBAN بنكي", "أخرى"]);
    }).catch(function(){
      setDocTypes(["بطاقة هوية", "جواز سفر", "رخصة قيادة", "عقد عمل", "IBAN بنكي", "أخرى"]);
    });
  }, []);

  function upload(type) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var newDoc = { id: "ATT" + Date.now(), empId: user.id, type: type, fileName: file.name, size: file.size, date: todayStr(), status: "pending" };
        setDocs(function(prev) { return prev.concat([newDoc]); });
        api("attachments", { method: "POST", body: { ...newDoc, data: ev.target.result } }).catch(function(){});
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function removeDoc(docId) {
    if (!confirm("هل تريد حذف هذا المرفق؟")) return;
    setDocs(function(prev){ return prev.filter(function(d){ return d.id !== docId; }); });
    api("attachments", { method: "DELETE", params: { id: docId } }).catch(function(){});
  }

  return (
    <div>
      <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>المرفقات</div>
      <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginBottom: SPACING.md }}>ارفع مستنداتك — الشهادات تُضاف من كوادر للقراءة فقط</div>

      {/* Equal-width grid 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: SPACING.sm, marginBottom: SPACING.md }}>
        {docTypes.map(function(dt) {
          var exists = docs.find(function(d){ return d.type === dt; });
          return (
            <button key={dt} onClick={function(){ if(!exists) upload(dt); }} style={{ height: 40, padding: "0 " + SPACING.sm + "px", borderRadius: RADIUS.md, background: COLORS.metallic, border: "1px solid " + (exists ? COLORS.goldLight : COLORS.metallicBorder), ...TYPOGRAPHY.caption, fontWeight: 700, color: exists ? COLORS.goldLight : COLORS.textMuted, cursor: exists ? "default" : "pointer", fontFamily: TYPOGRAPHY.fontTajawal, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {(exists ? "✓ " : "+ ") + dt}
            </button>
          );
        })}
      </div>

      {docs.map(function(d, i) {
        var statusColors = { pending: COLORS.textMuted, approved: COLORS.goldLight, rejected: COLORS.textDanger };
        return (
          <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm + "px 0", borderBottom: i < docs.length - 1 ? "1px solid " + COLORS.cardRowBorder : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.textPrimary }}>{d.type}</div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{d.date}</div>
            </div>
            <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: statusColors[d.status] || COLORS.textMuted, padding: "3px 8px", borderRadius: RADIUS.sm, background: (statusColors[d.status] || COLORS.textMuted) + "20" }}>{d.status === "approved" ? "معتمد" : d.status === "rejected" ? "مرفوض" : "بانتظار"}</span>
            <button onClick={function(){ removeDoc(d.id); }} style={{ background: "transparent", border: "1px solid " + COLORS.textDanger, color: COLORS.textDanger, width: 28, height: 28, borderRadius: RADIUS.sm, cursor: "pointer", fontSize: 14, fontWeight: 800, padding: 0 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ OVERTIME (الأوفرتايم) ═══════════ */
function OvertimeCard({ todayAtt, branch, now, user }) {
  var checkoutRec = todayAtt.find(function(r){ return r.type === "checkout"; });
  if (!branch || !checkoutRec) return null;

  var endMin = timeToMin(branch.end);
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var checkoutMin = new Date(checkoutRec.ts).getHours() * 60 + new Date(checkoutRec.ts).getMinutes();

  // If checkout was after end of work, calculate overtime
  var otMin = Math.max(0, checkoutMin - endMin);
  if (otMin === 0 && nowMin > endMin && !checkoutRec) {
    // Still working overtime
    otMin = nowMin - endMin;
  }
  if (otMin <= 0) return null;

  var otHrs = Math.floor(otMin / 60);
  var otMins = otMin % 60;

  return (
    <div style={{...buildS().card, background: "linear-gradient(135deg," + C.blue + "08," + C.blueBright + "05)", border: "1px solid " + C.blue + "20"}} className="basma-fadein-d2">
      <div style={buildS().cardTitle}><span>⏰ الأوفرتايم</span><span style={{ fontSize: 10, color: C.blue, fontWeight: 700 }}>{otHrs + ":" + String(otMins).padStart(2,"0") + " ساعة"}</span></div>
      <div style={{ fontSize: 11, color: C.sub }}>{"تسجيل الانصراف بعد نهاية الدوام بـ " + otMin + " دقيقة"}</div>
      <div style={{ fontSize: 9, color: C.sub, marginTop: 4 }}>{"نوع الدوام: " + (user.type === "field" ? "ميداني — بدون قيد موقع" : "مكتبي — يلزم التواجد في النطاق")}</div>
    </div>
  );
}

/* ═══════════ FIELD PROJECTS (المشاريع الميدانية) ═══════════ */
function FieldProjectsCard({ user, gps }) {
  var [projects, setProjects] = useState([]);

  useEffect(function() {
    if (user.type !== "field" && user.type !== "mixed") return;
    api("projects").then(function(ps) { setProjects(ps || []); }).catch(function(){});
  }, []);

  if (user.type !== "field" && user.type !== "mixed") return null;
  if (projects.length === 0) return null;

  return (
    <div style={buildS().card} className="basma-fadein-d3">
      <div style={buildS().cardTitle}><span>🏗️ مشاريعي الميدانية</span><span style={{ fontSize: 10, color: C.sub }}>{projects.length + " مشروع"}</span></div>
      {projects.map(function(p, i) {
        var dist = gps && p.lat && p.lng ? Math.round(haversine(gps.lat, gps.lng, p.lat, p.lng)) : null;
        var inRange = dist !== null && dist <= (p.radius || 200);
        return (
          <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < projects.length - 1 ? "1px solid " + C.bg : "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: inRange ? C.green + "18" : C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{inRange ? "📍" : "🏗️"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.name || "مشروع"}</div>
              {dist !== null && <div style={{ fontSize: 9, color: inRange ? C.green : C.sub }}>{inRange ? "✓ في النطاق (" + dist + " م)" : dist + " م بعيد"}</div>}
            </div>
            {inRange && (
              <button onClick={function(){ api("checkin", { method: "POST", body: { empId: user.id, type: "project_confirm", projectId: p.id, lat: gps.lat, lng: gps.lng } }); }} style={{ padding: "4px 10px", borderRadius: 8, background: C.green, color: "#fff", fontSize: 9, fontWeight: 700, border: "none", cursor: "pointer" }}>
                تأكيد تواجد
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ POINTS LOG (سجل النقاط) ═══════════ */
function PointsLogCard({ user, allAtt }) {
  var [expanded, setExpanded] = useState(false);
  // Calculate points breakdown
  var checkins = allAtt.filter(function(r){ return r.type === "checkin"; });
  var log = [
    { label: "بصمات الحضور", pts: checkins.length * POINTS.checkin_ontime, icon: "☀️", detail: checkins.length + " × " + POINTS.checkin_ontime },
    { label: "تحديات الصباح", pts: 0, icon: "⚡", detail: "يُحسب من السجل" },
    { label: "استخدام التطبيق", pts: Math.min(60, new Set(allAtt.map(function(r){ return r.date; })).size * POINTS.app_daily_use), icon: "📱", detail: "يومي" },
  ];
  var total = log.reduce(function(s, l){ return s + l.pts; }, 0);

  return (
    <div style={{ background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.xl, padding: SPACING.lg, boxShadow: SHADOWS.button, marginBottom: SPACING.md }}>
      <div onClick={function(){ setExpanded(!expanded); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <span style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary }}>{"سجل النقاط — " + (user.points || 0)}</span>
        <span style={{ color: COLORS.goldLight }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: SPACING.md }}>
          {log.map(function(l, i) {
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm + "px 0", borderBottom: i < log.length - 1 ? "1px solid " + COLORS.cardRowBorder : "none" }}>
                <div style={{ flex: 1, ...TYPOGRAPHY.caption, fontWeight: 600, color: COLORS.textPrimary }}>{l.label}</div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>{l.detail}</div>
                <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 800, color: COLORS.goldLight }}>{"+" + l.pts}</div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: SPACING.sm, borderTop: "1px solid " + COLORS.metallicBorder, marginTop: SPACING.xs }}>
            <span style={{ ...TYPOGRAPHY.bodySm, fontWeight: 800, color: COLORS.textPrimary }}>المجموع المحسوب</span>
            <span style={{ ...TYPOGRAPHY.h3, fontWeight: 900, color: COLORS.goldLight }}>{total}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ OCCASIONS (المناسبات) ═══════════ */
function OccasionBanner({ user }) {
  var today = new Date();
  var mm = String(today.getMonth()+1).padStart(2,"0");
  var dd = String(today.getDate()).padStart(2,"0");

  // Check birthday
  if (user.dob) {
    var dobParts = user.dob.split("-");
    if (dobParts[1] === mm && dobParts[2] === dd) {
      return (
        <div style={{ background: "linear-gradient(135deg, #FF6B9D, #C850C0)", borderRadius: 16, padding: 14, marginBottom: 12, textAlign: "center", color: "#fff" }} className="basma-fadein">
          <div style={{ fontSize: 28, marginBottom: 4 }}>🎂</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{"كل عام وأنت بخير يا " + (user.name || "").split(" ")[0] + "!"}</div>
          <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>عيد ميلاد سعيد من فريق HMA</div>
        </div>
      );
    }
  }

  // Check join anniversary
  if (user.joinDate) {
    var joinParts = user.joinDate.split("-");
    if (joinParts[1] === mm && joinParts[2] === dd && joinParts[0] !== String(today.getFullYear())) {
      var years = today.getFullYear() - parseInt(joinParts[0]);
      return (
        <div style={{ background: "linear-gradient(135deg, " + C.blue + ", " + C.blueBright + ")", borderRadius: 16, padding: 14, marginBottom: 12, textAlign: "center", color: "#fff" }} className="basma-fadein">
          <div style={{ fontSize: 28, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{"ذكرى التحاقك بالمكتب — " + years + " سنة!"}</div>
          <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>شكراً لولائك والتزامك</div>
        </div>
      );
    }
  }

  return null;
}

/* ═══════════ HELP GUIDE SECTION — دليل الاستخدام ═══════════ */
function HelpGuideSection() {
  var [open, setOpen] = useState(false);
  var [activeQ, setActiveQ] = useState(null);
  var [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);

  useEffect(function() {
    var handler = function(e) {
      e.preventDefault();
      setPwaInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return function() { window.removeEventListener("beforeinstallprompt", handler); };
  }, []);

  var questions = [
    { q: "كيف أسجل حضوري وانصرافي؟", a: "من الصفحة الرئيسية، اضغط على زر 'تسجيل الحضور' وتأكد أنك داخل نطاق الفرع. النظام سيسجل وقتك وموقعك تلقائياً." },
    { q: "لماذا يطلب الموقع الجغرافي؟", a: "يتحقق النظام من وجودك في نطاق الفرع المسموح عند تسجيل الحضور. هذا شرط أساسي لصحة التسجيل." },
    { q: "كيف أسجّل بصمة الوجه لأول مرة؟", a: "عند أول تسجيل حضور، سيطلب منك النظام التقاط صورة وجه. قف في إضاءة جيدة وابتعد قليلاً عن الكاميرا." },
    { q: "ماذا لو تأخرت عن الدوام؟", a: "سجّل حضورك فور وصولك. سيتم تسجيل التأخير تلقائياً وفق لائحة العمل. تكرار التأخير يؤدي لمخالفة." },
    { q: "كيف أقدم طلب إجازة؟", a: "من القائمة الجانبية، اختر 'إجازة' ثم حدد النوع والتواريخ. سيصل الطلب لمديرك المباشر للاعتماد." },
    { q: "كيف أرى مخالفاتي؟", a: "من تبويب 'السجل الوظيفي' تجد قائمة المخالفات. يمكنك التظلم على أي مخالفة خلال 5 أيام من صدورها." },
    { q: "ماذا لو ظهرت مخالفة لا أوافق عليها؟", a: "اذهب لتفاصيل المخالفة واضغط 'تقديم تظلم'، اكتب أسبابك وأرفق ما يدعمها. المدة: 5 أيام من تاريخ المخالفة." },
    { q: "كيف أحصل على نقاط أكثر؟", a: "الحضور اليومي، الإجابة على التحدي الصباحي، عدم التأخر، وإكمال البصمات الأربع كاملة تعطيك نقاط." },
    { q: "نسيت كلمة المرور — ماذا أفعل؟", a: "كلمات المرور تُدار من نظام كوادر (hma.engineer). راجع مديرك أو إدارة الموارد البشرية لإعادة تعيينها." },
    { q: "هل يمكنني استخدام التطبيق خارج الدوام؟", a: "نعم، لكن زر تسجيل الحضور متاح فقط خلال ساعات الدوام الرسمية." },
  ];

  async function installApp() {
    if (pwaInstallPrompt) {
      pwaInstallPrompt.prompt();
      await pwaInstallPrompt.userChoice;
      setPwaInstallPrompt(null);
      return;
    }
    var ua = navigator.userAgent.toLowerCase();
    var isIOS = /iphone|ipad|ipod/.test(ua);
    var isAndroid = /android/.test(ua);
    if (isIOS) {
      alert("📱 لتثبيت التطبيق على iPhone:\n\n1. اضغط على زر المشاركة ⬆️ أسفل المتصفح\n2. اختر 'إضافة إلى الشاشة الرئيسية'\n3. اضغط 'إضافة'");
    } else if (isAndroid) {
      alert("📱 لتثبيت التطبيق على Android:\n\n1. اضغط على القائمة (⋮) أعلى المتصفح\n2. اختر 'إضافة إلى الشاشة الرئيسية' أو 'تثبيت التطبيق'\n3. اضغط 'تثبيت'");
    } else {
      alert("📱 التطبيق يعمل بشكل أفضل على الجوال.\n\nعلى Chrome في الكمبيوتر: اضغط على أيقونة التثبيت في شريط العنوان.");
    }
  }

  function fixMobileView() {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    var ua = navigator.userAgent.toLowerCase();
    var isIOS = /iphone|ipad|ipod/.test(ua);
    var isAndroid = /android/.test(ua);
    if (isIOS) {
      alert("🔄 تم تصحيح العرض ✓\n\nإذا ما زال العرض كمبيوتر، اتبع:\n\n1. اضغط على 'ﺃﺃ' أعلى يسار Safari\n2. اختر 'عرض موقع الجوال'\nأو\n'Request Mobile Website'");
    } else if (isAndroid) {
      alert("🔄 تم تصحيح العرض ✓\n\nإذا ما زال العرض كمبيوتر، اتبع:\n\n1. اضغط على (⋮) أعلى يمين Chrome\n2. ألغِ ✓ بجانب 'موقع سطح المكتب'\nأو\n'Desktop site'");
    } else {
      alert("🔄 تم تصحيح العرض ✓\n\nأنت على كمبيوتر حالياً. التطبيق مصمم للجوال ويعمل بشكل أفضل هناك.");
    }
    setTimeout(function(){ window.location.reload(); }, 1500);
  }

  return (
    <>
      {/* Trigger button — same style as support ticket button (secondary variant) */}
      <Button variant="secondary" size="md" icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.goldLight} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      } onClick={function(){ setOpen(true); }}>
        دليل الاستخدام
      </Button>

      {/* Modal */}
      {open && (
        <div onClick={function(){ setOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: TYPOGRAPHY.fontTajawal }}>
          <div onClick={function(e){ e.stopPropagation(); }} style={{ background: COLORS.bg1, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, maxHeight: "85vh", display: "flex", flexDirection: "column", border: "1px solid " + COLORS.metallicBorder, borderBottom: "none" }}>
            {/* Header */}
            <div style={{ padding: SPACING.lg, borderBottom: "1px solid " + COLORS.metallicBorder, display: "flex", alignItems: "center", gap: SPACING.sm }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.goldDark + "30", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.goldLight} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo }}>دليل الاستخدام</div>
                <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 2 }}>أسئلة شائعة + أدوات مساعدة</div>
              </div>
              <button onClick={function(){ setOpen(false); }} style={{ width: 32, height: 32, borderRadius: 10, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, color: COLORS.textPrimary, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: SPACING.lg }}>
              {/* FAQ */}
              {questions.map(function(item, i) {
                var isActive = activeQ === i;
                return (
                  <div key={i} style={{ marginBottom: SPACING.sm, background: isActive ? COLORS.goldDark + "20" : COLORS.metallic, borderRadius: RADIUS.md, overflow: "hidden", border: "1px solid " + (isActive ? COLORS.goldLight + "50" : COLORS.metallicBorder) }}>
                    <button onClick={function(){ setActiveQ(isActive ? null : i); }} style={{ width: "100%", padding: "12px 14px", background: "none", border: "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: TYPOGRAPHY.fontTajawal, textAlign: "right" }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: isActive ? COLORS.goldLight : COLORS.textMuted, flexShrink: 0 }} />
                      <div style={{ flex: 1, ...TYPOGRAPHY.caption, fontWeight: isActive ? 800 : 600, color: COLORS.textPrimary, lineHeight: 1.5 }}>{item.q}</div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: isActive ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </button>
                    {isActive && (
                      <div style={{ padding: "4px 28px 14px", ...TYPOGRAPHY.tiny, color: COLORS.textMuted, lineHeight: 1.9 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: SPACING.sm, marginTop: SPACING.lg }}>
                <button onClick={installApp} style={{ flex: 1, padding: "14px 10px", borderRadius: RADIUS.lg, background: COLORS.goldGradient, color: COLORS.textOnGold, border: "1px solid " + COLORS.goldLight, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: SHADOWS.gold }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.textOnGold} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  تثبيت التطبيق
                </button>
                <button onClick={fixMobileView} style={{ flex: 1, padding: "14px 10px", borderRadius: RADIUS.lg, background: COLORS.metallic, color: COLORS.goldLight, border: "1px solid " + COLORS.metallicBorder, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: SHADOWS.button }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.goldLight} strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                  تصحيح العرض
                </button>
              </div>
              <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.sm, lineHeight: 1.7 }}>
                <strong style={{ color: COLORS.goldLight }}>تثبيت:</strong> أضف التطبيق للشاشة الرئيسية
                <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
                <strong style={{ color: COLORS.goldLight }}>تصحيح:</strong> إذا ظهر بحجم كبير على الجوال
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════ FAKE INCOMING CALL SCREEN ═══════════ */
function FakeCallScreen({ type, label, user, onAnswer, onDecline }) {
  var [ringing, setRinging] = useState(true);
  var [seconds, setSeconds] = useState(0);
  var audioRef = useRef(null);

  useEffect(function() {
    // Play ring tone (loop)
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc, gain;
      var playRing = function() {
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(function(){ osc.frequency.value = 660; }, 200);
        setTimeout(function(){
          try { osc.stop(); } catch(e){}
        }, 400);
      };
      var interval = setInterval(function() {
        if (ringing) playRing();
      }, 1500);
      audioRef.current = { stop: function(){ clearInterval(interval); try { osc && osc.stop(); } catch(e){} } };
    } catch(e) {}

    // Vibrate loop
    var vibrate = setInterval(function(){
      if (navigator.vibrate) navigator.vibrate([600, 300, 600, 300, 600]);
    }, 2500);
    if (navigator.vibrate) navigator.vibrate([600, 300, 600, 300, 600]);

    // Timer
    var timer = setInterval(function(){ setSeconds(function(s){ return s + 1; }); }, 1000);

    // Auto-dismiss after 30 seconds
    var autoEnd = setTimeout(function(){
      setRinging(false);
      onDecline();
    }, 30000);

    return function() {
      clearInterval(vibrate);
      clearInterval(timer);
      clearTimeout(autoEnd);
      if (audioRef.current) audioRef.current.stop();
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, []);

  function handleAnswer() {
    setRinging(false);
    if (audioRef.current) audioRef.current.stop();
    if (navigator.vibrate) navigator.vibrate(0);
    onAnswer();
  }
  function handleDecline() {
    setRinging(false);
    if (audioRef.current) audioRef.current.stop();
    if (navigator.vibrate) navigator.vibrate(0);
    onDecline();
  }

  var timeStr = Math.floor(seconds / 60).toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
  var bgMain = "linear-gradient(180deg, #0f1e3c, #1a3a6e 40%, #2b5ea7)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: bgMain, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "60px 24px 50px", color: "#fff", direction: "rtl", fontFamily: TYPOGRAPHY.fontTajawal }}>
      {/* Top — caller info */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>
          📱 مكالمة واردة • {timeStr}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, fontFamily: TYPOGRAPHY.fontCairo }}>بصمة HMA</div>
        <div style={{ fontSize: 14, color: "#FCD34D", fontWeight: 700 }}>
          {type === "checkin" ? "⏰ تذكير بتسجيل الحضور" : type === "break_end" ? "🔄 العودة من الاستراحة" : label}
        </div>
      </div>

      {/* Center — pulsing avatar */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", inset: -20, borderRadius: "50%", background: "rgba(252,211,77,0.15)", animation: "basmaPulse 2s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "rgba(252,211,77,0.08)", animation: "basmaPulse 2s ease-out 0.3s infinite" }} />
        <div style={{ position: "relative", width: 160, height: 160, borderRadius: "50%", background: "linear-gradient(135deg, #FCD34D, #F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid rgba(255,255,255,0.2)", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#1a3a6e" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
        </div>
      </div>

      {/* Bottom — instruction + buttons */}
      <div style={{ width: "100%" }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 30, lineHeight: 1.8 }}>
          اضغط <span style={{ color: "#10b981", fontWeight: 800 }}>رد</span> لتسجيل {label}<br/>
          أو <span style={{ color: "#ef4444", fontWeight: 800 }}>رفض</span> لتأجيل
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px" }}>
          {/* Decline button */}
          <button onClick={handleDecline} style={{ width: 72, height: 72, borderRadius: "50%", background: "#ef4444", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 20px rgba(239,68,68,0.4)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ transform: "rotate(135deg)" }}>
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </button>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", writingMode: "horizontal-tb" }}>↓ اسحب للرد</div>
          {/* Answer button */}
          <button onClick={handleAnswer} style={{ width: 72, height: 72, borderRadius: "50%", background: "#10b981", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 20px rgba(16,185,129,0.5)", animation: "basmaAnswerPulse 1.5s ease-in-out infinite" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 20px", fontSize: 11, fontWeight: 700 }}>
          <div style={{ width: 72, textAlign: "center", color: "#ef4444" }}>رفض</div>
          <div style={{ flex: 1 }}></div>
          <div style={{ width: 72, textAlign: "center", color: "#10b981" }}>رد</div>
        </div>
      </div>

      <style>{`
        @keyframes basmaPulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes basmaAnswerPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>
    </div>
  );
}

/* ═══════════ AUTO CHECKIN BANNER ═══════════ */
function AutoCheckinBanner({ label, onConfirm, onDismiss }) {
  return (
    <div style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 9998, animation: "basmaSlide .3s ease-out" }}>
      <div style={{ background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(16,185,129,0.4)", direction: "rtl", fontFamily: TYPOGRAPHY.fontTajawal }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div style={{ flex: 1, color: "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: TYPOGRAPHY.fontCairo }}>✓ أنت داخل نطاق العمل</div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>تأكيد {label} ببصمة الوجه</div>
        </div>
        <button onClick={onConfirm} style={{ padding: "8px 14px", borderRadius: 10, background: "#fff", color: "#059669", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: TYPOGRAPHY.fontCairo }}>تأكيد</button>
        <button onClick={onDismiss} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      <style>{`@keyframes basmaSlide { from { transform: translateY(-120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

function buildS() { return {
  phone: { width: "100%", maxWidth: 430, minHeight: "100vh", margin: "0 auto", background: C.bg, position: "relative", display: "flex", flexDirection: "column" },

  header: { background: "linear-gradient(180deg,"+C.hdr1+" 0%,"+C.hdr2+" 50%,"+C.hdr3+" 100%)", padding: "20px 20px 60px", position: "relative", overflow: "visible" },
  headerCurve: { position: "absolute", bottom: -30, left: "-10%", width: "120%", height: 80, background: C.bg, borderRadius: "50% 50% 0 0" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  welcome: { color: "#fff", fontSize: 20, fontWeight: 800, fontFamily: "'Cairo',sans-serif" },
  date: { color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 500, marginTop: 2 },

  clockWrap: { display: "flex", justifyContent: "center", marginTop: 16, position: "relative", zIndex: 1 },
  clockInner: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  clockTime: { fontSize: 38, fontWeight: 900, color: "#fff", fontFamily: "'Cairo',sans-serif", letterSpacing: 1 },
  clockAmpm: { fontSize: 14, color: "rgba(255,255,255,.8)", fontWeight: 600, marginTop: -4 },
  clockBtn: { marginTop: 8, padding: "6px 20px", borderRadius: 20, background: "rgba(255,255,255,.2)", color: "#fff", fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,.3)", cursor: "pointer", fontFamily: "'Tajawal',sans-serif" },

  content: { padding: "0 16px", marginTop: -20, position: "relative", zIndex: 2 },

  statsRow: { display: "flex", gap: 10, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10, color: "#fff" },
  statIcon: { width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  statNum: { fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif" },
  statLabel: { fontSize: 9, fontWeight: 600, opacity: .85 },

  gpsRow: { display: "flex", alignItems: "center", gap: 6, padding: "4px 4px 10px" },
  challengeCard: { background: "linear-gradient(135deg,"+C.green+","+C.greenDark+")", borderRadius: 16, padding: 14, marginBottom: 12, textAlign: "center", color: "#fff", cursor: "pointer" },

  card: { background: C.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.15)", border: "1px solid " + (C.cardBorder || C.bg) },
  cardTitle: { fontSize: 15, fontWeight: 800, fontFamily: "'Cairo',sans-serif", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text },

  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" },
  cpRow: { display: "flex", gap: 8, marginTop: 12 },

  detailHeader: { background: "linear-gradient(180deg,"+C.hdr1+","+C.hdr2+")", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 },
  detailTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif" },

  nav: { position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", background: C.card, borderTop: "1px solid " + (C.bg === "#111827" ? "#1e293b" : "#eee"), display: "flex", justifyContent: "space-around", padding: "8px 0 16px", zIndex: 100 },
  navItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", padding: "4px 12px", cursor: "pointer", fontFamily: "'Tajawal',sans-serif" },
  navBar: { position: "absolute", top: -1, width: 24, height: 3, borderRadius: 2, background: C.blue },

  loginInput: { width: "100%", padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'Tajawal',sans-serif", outline: "none", textAlign: "center", direction: "ltr" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 },
  modal: { background: C.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 380 },
}; }
var S = buildS();
