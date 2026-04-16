import React, { useState, useEffect, useRef, useCallback } from "react";
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, Button, Card, Section, Icons } from "./theme";

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
  URL: "basma-hma.vercel.app",
  KADWAR_URL: "https://hma.engineer",
};
const VER = APP_CONFIG.VER;

/* ── Colors ── */
const LIGHT = {
  hdr1: "#0f2847", hdr2: "#1a3a6e", hdr3: "#2b5ea7",
  green: "#10b981", greenDark: "#059669",
  orange: "#d4a017", orangeDark: "#b8860b",
  red: "#E2192C", redDark: "#c0392b",
  blue: "#2b5ea7", blueBright: "#3a7bd5",
  bg: "#f0f2f7", card: "#fff", text: "#1a1a1a", sub: "#888",
  gold: "#c9a84c", goldLight: "#e8d5a3", goldDark: "#8b6914",
  cardBorder: "rgba(0,0,0,.08)",
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
var C = LIGHT;
function CB() { return C.cardBorder || C.bg; }

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
  { q: "كم عدد أركان الإسلام؟", opts: ["ثلاثة","خمسة","سبعة"], correct: 1, type: "سؤال" },
  { q: "كم ركعة صلاة التراويح؟", opts: ["8 أو 20","12","6"], correct: 0, type: "معلومة" },
  { q: "ما هي نسبة الماء إلى الأسمنت المثالية؟", opts: ["0.30","0.45","0.60"], correct: 1, type: "هندسي" },
  { q: "ما أول شي يُراجع عند استلام موقع جديد؟", opts: ["المخططات","الميزانية","المعدات"], correct: 0, type: "هندسي" },
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
const VIOLATION_ESCALATION = [
  { level: 1, type: "تنبيه إلكتروني", action: "تنبيه شفهي", response: "إلكتروني", icon: "💬" },
  { level: 2, type: "إنذار إلكتروني أول", action: "إنذار كتابي", response: "إلكتروني", icon: "⚠️" },
  { level: 3, type: "إنذار كتابي", action: "إنذار كتابي + خصم يوم", response: "كتابي + إفادة موقعة", icon: "📋" },
  { level: 4, type: "إنذار نهائي", action: "إنذار نهائي + خصم 3 أيام", response: "إفادة ورقية موقعة مصورة", icon: "🔴" },
  { level: 5, type: "إنهاء خدمات", action: "إنهاء العلاقة التعاقدية", response: "—", icon: "❌" },
];

const VIOLATION_TYPES = {
  late: { label: "تأخر في الحضور", category: "انضباط" },
  absent: { label: "غياب بدون إذن", category: "انضباط" },
  early_leave: { label: "انصراف مبكر", category: "انضباط" },
  geofence: { label: "تسجيل من خارج النطاق", category: "انضباط" },
  no_face: { label: "عدم التحقق بالوجه", category: "أمان" },
  missed_break: { label: "عدم تسجيل الاستراحة", category: "انضباط" },
};


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
  const [branch, setBranch] = useState(null);
  const [darkMode, setDarkMode] = useState(function(){ return localStorage.getItem("basma_dark") === "1"; });
  const [todayAtt, setTodayAtt] = useState([]);
  const [allAtt, setAllAtt] = useState([]);
  const [now, setNow] = useState(new Date());
  const [gps, setGps] = useState(null);
  const [gpsDist, setGpsDist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
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
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [callBanner, setCallBanner] = useState(null); // { type, msg }
  const [initDone, setInitDone] = useState(false);

  // Apply dark mode
  useEffect(function() {
    C = darkMode ? DARK : LIGHT;
    S = buildS();
    document.body.style.background = C.bg;
    localStorage.setItem("basma_dark", darkMode ? "1" : "0");
  }, [darkMode]);

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

  // ═══ Call Notification Engine (4 أوقات) ═══
  useEffect(function() {
    if (!user || !branch) return;
    var breakOffset = getBreakOffset(); // random 2-7 min per session
    var callShown = {};

    function checkCalls() {
      var mins = now.getHours() * 60 + now.getMinutes();
      var startMin = timeToMin(branch.start);
      var endMin = timeToMin(branch.end);
      var breakSMin = branch.breakS ? timeToMin(branch.breakS) : startMin + 240;
      var breakEMin = branch.breakE ? timeToMin(branch.breakE) : breakSMin + 30;
      var hasCheckin = todayAtt.some(function(r){ return r.type === "checkin"; });
      var hasBreakS = todayAtt.some(function(r){ return r.type === "break_start"; });
      var hasBreakE = todayAtt.some(function(r){ return r.type === "break_end"; });
      var onLeave = user.onLeave;

      if (onLeave) return; // لا اتصال لو في إجازة

      // اتصال 1: بداية الدوام بالضبط
      if (mins === startMin && !hasCheckin && !callShown.call1) {
        callShown.call1 = true;
        setCallBanner({ type: "checkin", msg: MASCOT.checkin });
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
      }
      // اتصال 2: بعد 10 دقائق لو ما حضر (فقط لو في النطاق)
      if (mins === startMin + CALL_RETRY_DELAY && !hasCheckin && !callShown.call2) {
        var inR = gpsDist !== null && gpsDist <= (branch.radius || 150);
        if (inR) {
          callShown.call2 = true;
          setCallBanner({ type: "retry", msg: "⏰ لم تسجّل حضورك بعد!" });
          if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        }
      }
      // اتصال 3: قبل الاستراحة بـ breakOffset دقائق
      if (mins === breakSMin - breakOffset && !hasBreakS && hasCheckin && !callShown.call3) {
        callShown.call3 = true;
        setCallBanner({ type: "break", msg: "☕ وقت الاستراحة قريب — سجّل!" });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      // اتصال 4: بعد انتهاء الاستراحة بـ breakOffset دقائق
      if (mins === breakEMin + breakOffset && !hasBreakE && hasBreakS && !callShown.call4) {
        callShown.call4 = true;
        setCallBanner({ type: "breakEnd", msg: "🔄 انتهت الاستراحة — سجّل عودتك!" });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      // خارج النطاق عند الحضور — دائرة حمراء
      if (mins >= startMin && mins <= startMin + 15 && !hasCheckin) {
        var outside = gpsDist !== null && gpsDist > (branch.radius || 150);
        if (outside && !callShown.outRange) {
          callShown.outRange = true;
          // لا اتصال — فقط تنبيه بصري (الدائرة حمراء + رسالة)
        }
      }
    }

    var interval = setInterval(checkCalls, 30000); // check every 30 sec
    checkCalls(); // check immediately
    return function() { clearInterval(interval); };
  }, [user, branch, now, todayAtt, gpsDist]);

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
    } catch { /**/ }
  }

  async function handleLogin(empId, code) {
    setLoading(true);
    try {
      const r = await api("login", { method: "POST", body: { empId, code } });
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

  return (
    <div style={S.phone}>
      {!online && <div style={{ background: C.red, color: "#fff", textAlign: "center", padding: "6px 0", fontSize: 11, fontWeight: 700 }}>⚠️ لا يوجد اتصال بالإنترنت</div>}

      <div key={page} style={{ flex: 1, display: "flex", flexDirection: "column", animation: "pageIn .3s ease" }}>
        {page === "home" && <HomePage user={user} branch={branch} now={now} todayAtt={todayAtt} allAtt={allAtt} gps={gps} gpsDist={gpsDist} streak={streak} loading={loading} refreshing={refreshing} dayState={getDayState()} checkpoints={getCheckpoints()} isOffDay={isOffDay()} pendingCount={myLeaves.filter(function(l){ return l.status === "pending"; }).length + myTickets.filter(function(t){ return t.status === "pending"; }).length} teamToday={teamToday} pwaPrompt={pwaPrompt} onPwaInstall={async function(){ if(pwaPrompt){pwaPrompt.prompt();await pwaPrompt.userChoice;setPwaPrompt(null);} }} onCheckin={requestCheckin} onChallenge={function(pts) { var u = { ...user, points: (user.points||0)+pts }; setUser(u); localStorage.setItem("basma_user", JSON.stringify(u)); showToast("🎉 +" + pts + " نقطة!"); }} onLeave={() => setLeaveModal(true)} onRefresh={refresh} onPreAbsence={function(){ setPreAbsModal(true); }} onManualAtt={function(){ setManualAttModal(true); }} onPermission={function(){ setPermModal(true); }} kadwarNotifs={kadwarNotifs} />}
        {page === "report" && <ReportPage user={user} allAtt={allAtt} todayAtt={todayAtt} branch={branch} isOffDay={isOffDay()} myLeaves={myLeaves} allEmps={allEmps} />}
        {page === "benefits" && <BenefitsPage user={user} />}
        {page === "profile" && <ProfilePage user={user} branch={branch} onLogout={logout} onTicket={() => setTicketModal(true)} myTickets={myTickets} darkMode={darkMode} toggleDark={toggleDark} />}
      </div>

      <BottomNav page={page} setPage={setPage} />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {callBanner && <CallBanner type={callBanner.type} msg={callBanner.msg} onDismiss={function(){ setCallBanner(null); }} />}
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

/* ═══════════ LOGIN ═══════════ */
function LoginScreen({ onLogin, loading }) {
  const [empId, setEmpId] = useState(function(){ return localStorage.getItem("basma_last_empid") || ""; });
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!empId || !code) { setErr("أدخل رقم الموظف والرمز"); return; }
    localStorage.setItem("basma_last_empid", empId.toUpperCase());
    const e = await onLogin(empId.toUpperCase(), code);
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
        <input value={empId} onChange={e => setEmpId(e.target.value)} placeholder="رقم الموظف (مثال: E001)" style={S.loginInput} />
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="رمز الدخول" type="password" style={{ ...S.loginInput, marginTop: 10 }} onKeyDown={e => e.key === "Enter" && submit()} />
        {err && <div style={{ color: "#FF6B6B", fontSize: 12, fontWeight: 700, marginTop: 10, textAlign: "center" }}>{err}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 16, background: loading ? "rgba(255,255,255,.2)" : "#fff", color: loading ? "rgba(255,255,255,.5)" : C.hdr1, fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", border: "none", cursor: "pointer" }}>
          {loading ? "جارِ الدخول..." : "تسجيل دخول"}
        </button>
      </div>
      <div className="basma-fadein-d3" style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 24 }}>{"v"+VER+" · basma-hma.vercel.app"}</div>
    </div>
  );
}

/* ═══════════ HOME ═══════════ */
function HomePage({ user, branch, now, todayAtt, allAtt, gps, gpsDist, streak, loading, refreshing, dayState, checkpoints, isOffDay, pendingCount, teamToday, pwaPrompt, onPwaInstall, onCheckin, onChallenge, onLeave, onRefresh, onPreAbsence, onManualAtt, onPermission, kadwarNotifs }) {
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
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "'Cairo',sans-serif" }}>{"أهلاً، " + (user.name || "").split(" ")[0] + " 👋"}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>{formatArabicDate(now)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>{badge.icon + " " + badge.label}</span>
          <span style={{ fontSize: 10, color: C.gold, fontWeight: 800 }}>{"⭐" + (user.points || 0)}</span>
          {pendingCount > 0 && <div style={{ position: "relative" }}><span style={{ fontSize: 14 }}>🔔</span><div style={{ position: "absolute", top: -4, right: -6, width: 14, height: 14, borderRadius: 7, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff" }}>{pendingCount}</div></div>}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}><MembershipFreezeNotice user={user} /><BranchHolidayBanner branch={branch} /><OccasionBanner user={user} /></div>

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
                <linearGradient id="lxRim" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f5e6b8"/><stop offset="20%" stopColor="#e8d5a3"/><stop offset="50%" stopColor="#c9a84c"/><stop offset="80%" stopColor="#8b6914"/><stop offset="100%" stopColor="#a08430"/></linearGradient>
                <linearGradient id="lxRim2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b6914"/><stop offset="50%" stopColor="#c9a84c"/><stop offset="100%" stopColor="#e8d5a3"/></linearGradient>
                <filter id="lxSh"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,.5)"/></filter>
              </defs>
              {/* Outer bezel — thick gold */}
              <circle cx={SIZE/2} cy={SIZE/2} r={R+8} fill="none" stroke="url(#lxRim)" strokeWidth={7} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R+4} fill="none" stroke="#8b6914" strokeWidth={1} opacity={0.6} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R+1.5} fill="none" stroke="url(#lxRim2)" strokeWidth={0.8} />
              {/* Face */}
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="url(#lxFace)" />
              <circle cx={SIZE/2} cy={SIZE/2} r={R-14} fill="none" stroke="rgba(201,168,76,.08)" strokeWidth={0.5} />
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
              {[0,1,2,3,4,5,6,7,8,9,10,11].map(function(i) { var a=(i*30-90)*Math.PI/180; var major=i%3===0; return React.createElement("line",{key:i,x1:SIZE/2+(R-4)*Math.cos(a),y1:SIZE/2+(R-4)*Math.sin(a),x2:SIZE/2+(R-4-(major?16:8))*Math.cos(a),y2:SIZE/2+(R-4-(major?16:8))*Math.sin(a),stroke:"#c9a84c",strokeWidth:major?2.5:1.2,strokeLinecap:"round"}); })}
              {/* Minute ticks */}
              {Array.from({length:60},function(_,i){if(i%5===0)return null;var a=(i*6-90)*Math.PI/180;return React.createElement("line",{key:i,x1:SIZE/2+(R-4)*Math.cos(a),y1:SIZE/2+(R-4)*Math.sin(a),x2:SIZE/2+(R-8)*Math.cos(a),y2:SIZE/2+(R-8)*Math.sin(a),stroke:"rgba(201,168,76,.25)",strokeWidth:0.5});})}
              {/* Roman numerals */}
              {["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"].map(function(num,i) { var a=(i*30-90)*Math.PI/180; var major=i%3===0; return React.createElement("text",{key:i,x:SIZE/2+(R-(major?30:26))*Math.cos(a),y:SIZE/2+(R-(major?30:26))*Math.sin(a),textAnchor:"middle",dominantBaseline:"central",fill:"#e8d5a3",fontSize:major?16:10,fontWeight:major?"900":"600",fontFamily:"'Times New Roman',Georgia,serif",opacity:major?1:0.5},num); })}
              {/* Brand */}
              <text x={SIZE/2} y={SIZE/2-44} textAnchor="middle" fill="#c9a84c" fontSize={8} fontWeight="700" fontFamily="'Times New Roman',serif" letterSpacing="3" opacity={0.6}>HMA ENGINEERING</text>
              <text x={SIZE/2} y={SIZE/2-33} textAnchor="middle" fill="rgba(201,168,76,.4)" fontSize={6} fontFamily="'Times New Roman',serif" letterSpacing="2">ATTENDANCE SYSTEM</text>
              {/* Hour hand */}
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+60*Math.cos(hA*Math.PI/180)} y2={SIZE/2+60*Math.sin(hA*Math.PI/180)} stroke="#e8d5a3" strokeWidth={5.5} strokeLinecap="round" filter="url(#lxSh)" />
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+14*Math.cos((hA+180)*Math.PI/180)} y2={SIZE/2+14*Math.sin((hA+180)*Math.PI/180)} stroke="#e8d5a3" strokeWidth={3.5} strokeLinecap="round" />
              {/* Minute hand */}
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+85*Math.cos(mA*Math.PI/180)} y2={SIZE/2+85*Math.sin(mA*Math.PI/180)} stroke="#e8d5a3" strokeWidth={3} strokeLinecap="round" filter="url(#lxSh)" />
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+18*Math.cos((mA+180)*Math.PI/180)} y2={SIZE/2+18*Math.sin((mA+180)*Math.PI/180)} stroke="#e8d5a3" strokeWidth={2.5} strokeLinecap="round" />
              {/* Second hand — red */}
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+92*Math.cos(sA*Math.PI/180)} y2={SIZE/2+92*Math.sin(sA*Math.PI/180)} stroke="#E2192C" strokeWidth={1} />
              <line x1={SIZE/2} y1={SIZE/2} x2={SIZE/2+22*Math.cos((sA+180)*Math.PI/180)} y2={SIZE/2+22*Math.sin((sA+180)*Math.PI/180)} stroke="#E2192C" strokeWidth={1.5} />
              {/* Center jewel */}
              <circle cx={SIZE/2} cy={SIZE/2} r={7} fill="#c9a84c" stroke="#e8d5a3" strokeWidth={2} />
              <circle cx={SIZE/2} cy={SIZE/2} r={3.5} fill="#e8d5a3" />
              {/* Date window */}
              <rect x={SIZE/2+34} y={SIZE/2-9} width={30} height={18} rx={3} fill="#080c14" stroke="rgba(201,168,76,.4)" strokeWidth={0.8} />
              <text x={SIZE/2+49} y={SIZE/2+1} textAnchor="middle" dominantBaseline="central" fill="#e8d5a3" fontSize={11} fontWeight="800" fontFamily="system-ui">{now.getDate()}</text>
            </svg>
          </div>
          {/* Digital time — below clock, not absolute */}
          <div style={{ textAlign: "center", marginTop: SPACING.md }}>
            {outsideNoCheckin && <div style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.textDanger }}>لم تقم بتسجيل الحضور</div>}
            {outsideNoCheckin && gpsDist && <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 2 }}>{"خارج منطقة العمل (" + gpsDist + " م)"}</div>}
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.goldLight, fontFamily: TYPOGRAPHY.fontSerif, letterSpacing: 3, marginTop: 4, textShadow: "0 0 10px rgba(201,168,76,.3)" }}>{time}<span style={{ fontSize: 12, opacity: .4 }}>:{sec}</span> <span style={{ fontSize: 11, opacity: .4 }}>{ampm}</span></div>
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
          <div style={{ width: 7, height: 7, borderRadius: RADIUS.pill, background: gps ? (inRange ? COLORS.success : COLORS.textDanger) : COLORS.warning }} />
          <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{gps ? (inRange ? "في النطاق" : "خارج النطاق") + (branch ? " — " + branch.name : "") : "تحديد الموقع..."}</span>
          {streak > 0 && <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.warning }}>{"🔥 " + streak}</span>}
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
        <div style={{ ...TYPOGRAPHY.h1, color: COLORS.white, fontFamily: TYPOGRAPHY.fontCairo }}>تقريري</div>
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
              { num: todayCheckin ? 1 : 0, label: "حاضر", color: COLORS.success },
              { num: todayLate ? 1 : 0, label: "متأخر", color: COLORS.warning },
              { num: todayAbsent ? 1 : 0, label: "غائب", color: COLORS.danger },
              { num: 0, label: "إجازة", color: COLORS.info },
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
          <div style={{ display: "inline-block", background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, padding: SPACING.sm + "px " + SPACING.lg + "px", borderRadius: RADIUS.md, ...TYPOGRAPHY.caption, fontWeight: 700, color: COLORS.goldLight }}>
            {"1 " + monthName + " — " + lastDay + " " + monthName}
          </div>
        </div>

        {/* Month stats — 3 cards */}
        <div style={{ display: "flex", gap: SPACING.sm }}>
          {[
            { num: presentDays, label: "حاضر", color: COLORS.success },
            { num: lateDays, label: "متأخر", color: COLORS.warning },
            { num: absentDays, label: "غائب", color: COLORS.danger },
          ].map(function(s, i){
            return <div key={i} style={{ flex: 1, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.lg, padding: SPACING.md, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.1)" }}>
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
              { num: attendPct + "%", label: "نسبة الحضور", color: COLORS.success },
              { num: overtimeHrs, label: "ساعات إضافية", color: COLORS.info },
              { num: leaveDays, label: "أيام إجازة", color: COLORS.warning },
            ].map(function(s, i){
              return <div key={i} style={{ textAlign: "center", padding: SPACING.sm, background: "rgba(255,255,255,.03)", borderRadius: RADIUS.md }}>
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
              var bg = cd.isToday ? COLORS.gold : cd.hasAtt ? (cd.isLate ? COLORS.warning+"20" : COLORS.success+"20") : "transparent";
              var color = cd.isToday ? COLORS.textOnGold : cd.hasAtt ? (cd.isLate ? COLORS.warning : COLORS.success) : COLORS.textMuted;
              var border = cd.isToday ? "none" : cd.hasAtt ? "1px solid " + (cd.isLate ? COLORS.warning+"40" : COLORS.success+"40") : "1px solid " + COLORS.cardBorder;
              return (
                <div key={cd.day} style={{ width: "100%", aspectRatio: "1", borderRadius: RADIUS.sm, background: bg, border: border, display: "flex", alignItems: "center", justifyContent: "center", ...TYPOGRAPHY.caption, fontWeight: 700, color: color }}>
                  {cd.day}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: SPACING.md, justifyContent: "center", marginTop: SPACING.md }}>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.success }}>● حاضر</span>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.warning }}>● متأخر</span>
            <span style={{ ...TYPOGRAPHY.tiny, color: COLORS.gold }}>● اليوم</span>
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
                    <div style={{ width: 36, height: 36, borderRadius: RADIUS.pill, background: info.color + "20", display: "flex", alignItems: "center", justifyContent: "center", color: info.color }}>
                      <Icons.check size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{user.name}</div>
                      <div style={{ ...TYPOGRAPHY.caption, color: info.color, marginTop: 1 }}>{info.label + " · " + r.date}</div>
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
              var statusMap = { pending: { label: "قيد المراجعة", color: COLORS.warning }, approved: { label: "مقبولة", color: COLORS.success }, rejected: { label: "مرفوضة", color: COLORS.danger } };
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
  var [tab, setTab] = useState("info");
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
    { id: "health", icon: <Icons.alert size={18} />, label: "الإفصاح" },
    { id: "docs", icon: <Icons.clipboard size={18} />, label: "المرفقات" },
    { id: "custody", icon: <Icons.building size={18} />, label: "العهد" },
  ];

  return (
    <div style={{ flex: 1, paddingBottom: 80, background: "linear-gradient(180deg, "+COLORS.bg1+" 0%, "+COLORS.bg2+" 50%, "+COLORS.bg3+" 100%)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: SPACING.lg, textAlign: "center" }}>
        <div style={{ ...TYPOGRAPHY.h1, color: COLORS.white, fontFamily: TYPOGRAPHY.fontCairo }}>حسابي</div>
      </div>

      <div style={{ padding: "0 " + SPACING.lg + "px", display: "flex", flexDirection: "column", gap: SPACING.md }}>
        {/* Avatar */}
        <div style={{ textAlign: "center", padding: SPACING.lg + "px 0" }} className="basma-fadein">
          <div style={{ width: 80, height: 80, borderRadius: RADIUS.pill, background: COLORS.metallic, margin: "0 auto " + SPACING.md + "px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + COLORS.goldLight, boxShadow: "0 4px 15px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.15)" }}>
            <Icons.user size={36} color={COLORS.goldLight} />
          </div>
          <div style={{ ...TYPOGRAPHY.h1, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.fontCairo }}>{user.name}</div>
          <div style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 }}>{user.role + " — " + user.id}</div>
        </div>

        {/* Profile Tabs */}
        <div style={{ display: "flex", gap: SPACING.xs, background: COLORS.metallic, border: "1px solid " + COLORS.metallicBorder, borderRadius: RADIUS.lg, padding: SPACING.xs, boxShadow: "0 2px 8px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.1)" }}>
          {tabs.map(function(t) {
            var active = tab === t.id;
            return (
              <button key={t.id} onClick={function(){ setTab(t.id); }} style={{ flex: 1, padding: SPACING.sm + "px " + SPACING.xs + "px", borderRadius: RADIUS.md, background: active ? "rgba(201,168,76,.15)" : "transparent", border: active ? "1px solid " + COLORS.goldLight + "40" : "1px solid transparent", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: active ? COLORS.goldLight : COLORS.textMuted }}>
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
                <div onClick={toggleDark} style={{ width: 44, height: 24, borderRadius: 12, background: darkMode ? COLORS.gold : COLORS.cardBorder, position: "relative", cursor: "pointer", transition: "background .3s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: COLORS.white, position: "absolute", top: 3, transition: "all .3s", left: darkMode ? 3 : undefined, right: darkMode ? undefined : 3, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                </div>
              </div>
              <ToggleRow label="تذكير بالحضور" storeKey="remind_in" border={true} />
              <ToggleRow label="تذكير بالانصراف" storeKey="remind_out" border={true} />
              <FaceResetRow empId={user.id} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: SPACING.sm + "px 0", borderTop: "1px solid " + COLORS.cardBorder }}>
                <span style={{ ...TYPOGRAPHY.bodySm, fontWeight: 600, color: COLORS.textPrimary }}>إصدار التطبيق</span>
                <span style={{ ...TYPOGRAPHY.caption, fontWeight: 800, color: COLORS.gold }}>{"v" + VER}</span>
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
                  <span style={{ ...TYPOGRAPHY.body, fontWeight: 700, color: user.sceStatus === "active" ? COLORS.success : COLORS.danger }}>{user.sceStatus === "active" ? "ساري" : "منتهي"}</span>
                  <span style={{ ...TYPOGRAPHY.caption, color: COLORS.textMuted }}>{"انتهاء: " + user.sceExpiry}</span>
                </div>
              </Card>
            )}

            {myTickets && myTickets.length > 0 && (
              <Card>
                <div style={{ ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.md }}>تذاكري</div>
                {myTickets.slice(0, 5).map(function(t, i) {
                  var statusMap = { pending: { label: "قيد المراجعة", color: COLORS.warning }, open: { label: "مفتوحة", color: COLORS.info }, resolved: { label: "تم الحل", color: COLORS.success }, closed: { label: "مغلقة", color: COLORS.textMuted } };
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

            <Button variant="secondary" size="md" icon={<Icons.alert size={20} />} onClick={onTicket}>
              تذكرة دعم جديدة
            </Button>
          </>
        )}

        {tab === "deps" && <Card><DependentsTab user={user} /></Card>}
        {tab === "health" && <Card><HealthDisclosureTab user={user} /></Card>}
        {tab === "docs" && <Card><AttachmentsTab user={user} /></Card>}
        {tab === "custody" && <Card><CustodyTab user={user} /></Card>}

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
            <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: SPACING.sm }}>{"v" + VER + " · basma-hma.vercel.app"}</div>
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
        <div style={{ ...TYPOGRAPHY.h1, color: COLORS.white, fontFamily: TYPOGRAPHY.fontCairo }}>امتيازات العضوية</div>
      </div>

      <div style={{ padding: "0 " + SPACING.lg + "px", display: "flex", flexDirection: "column", gap: SPACING.md }}>

        {/* Current level */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
            <div style={{ width: 56, height: 56, borderRadius: RADIUS.pill, background: COLORS.metallic, border: "2px solid " + COLORS.goldLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{badge.icon}</div>
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
              <button key={cat} onClick={function(){ setFilter(cat); }} style={{ padding: SPACING.sm + "px " + SPACING.lg + "px", borderRadius: RADIUS.md, background: active ? "rgba(201,168,76,.15)" : COLORS.metallic, color: active ? COLORS.goldLight : COLORS.textMuted, ...TYPOGRAPHY.caption, fontWeight: 700, border: "1px solid " + (active ? COLORS.goldLight + "40" : COLORS.metallicBorder), cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: TYPOGRAPHY.fontTajawal }}>
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
              <div key={coupon.id} style={{ display: "flex", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl, background: COLORS.metallic, border: available ? "1px solid " + COLORS.goldLight + "30" : "1px solid " + COLORS.metallicBorder, minHeight: 72, opacity: available ? 1 : 0.5, boxShadow: SHADOWS.card }}>
                <div style={{ width: 44, height: 44, borderRadius: RADIUS.md, background: available ? COLORS.goldLight + "20" : "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{coupon.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.textPrimary }}>{coupon.brand}</div>
                  <div style={{ ...TYPOGRAPHY.caption, color: available ? COLORS.success : COLORS.textMuted, fontWeight: 600 }}>{coupon.discount}</div>
                  {!available && <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.warning }}>{"يتطلب " + tierName}</div>}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: canAfford && available ? COLORS.goldLight : COLORS.textMuted, fontFamily: TYPOGRAPHY.fontCairo }}>{coupon.pts}</div>
                  <div style={{ ...TYPOGRAPHY.tiny, color: COLORS.textMuted }}>نقطة</div>
                  {available && canAfford && (
                    <button style={{ marginTop: 4, padding: "4px 12px", borderRadius: RADIUS.sm, background: COLORS.goldGradient, color: COLORS.textOnGold, ...TYPOGRAPHY.tiny, fontWeight: 800, border: "none", cursor: "pointer" }}>استبدال</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isRamadan && (
          <Card>
            <div style={{ textAlign: "center", ...TYPOGRAPHY.bodySm, fontWeight: 700, color: COLORS.warning }}>
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: border ? "1px solid " + C.bg : "none" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div onClick={toggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? C.green : "#ddd", position: "relative", cursor: "pointer", transition: "background .3s" }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: C.card, position: "absolute", top: 3, transition: "all .3s", left: on ? 3 : undefined, right: on ? undefined : 3, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );
}

function MembershipCard({ points }) {
  var badge = memberBadge(points);
  var tc = badge.color;
  var availableCoupons = COUPONS.filter(function(c){ return c.minTier <= badge.tier; }).length;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Main badge card */}
      <div style={{ ...S.card, background: badge.bg, border: "1.5px solid " + tc + "30", marginBottom: 8 }} className="basma-fadein-d1">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 18, background: tc + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{badge.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color: tc }}>{badge.label}</div>
            <div style={{ fontSize: 11, color: C.sub }}>{"⭐ " + points + " نقطة"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: tc }}>{availableCoupons}</div>
            <div style={{ fontSize: 8, color: C.sub }}>كوبون متاح</div>
          </div>
        </div>

        {badge.next && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: C.sub }}>{"التقدم نحو " + badge.nextLabel}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: tc }}>{badge.progress + "%"}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: tc, width: badge.progress + "%", transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 9, color: C.sub, marginTop: 3 }}>{"باقي " + badge.remaining + " نقطة للترقية"}</div>
          </div>
        )}

        {/* Criteria weights */}
        <div style={{ fontSize: 10, fontWeight: 700, color: tc, marginBottom: 6 }}>مصادر النقاط</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {[
            { label: "حضور", pct: CRITERIA_WEIGHTS.attendance, color: C.green },
            { label: "تحدي", pct: CRITERIA_WEIGHTS.challenge, color: C.orange },
            { label: "ملف", pct: CRITERIA_WEIGHTS.profile, color: C.blue },
            { label: "تطبيقات", pct: CRITERIA_WEIGHTS.apps, color: "#8B5CF6" },
            { label: "AI", pct: CRITERIA_WEIGHTS.ai, color: C.sub },
          ].map(function(cr, idx) {
            return (
              <div key={idx} style={{ flex: cr.pct, height: 20, borderRadius: 4, background: cr.color + "25", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: cr.color }}>{cr.label + " " + cr.pct + "%"}</span>
              </div>
            );
          })}
        </div>

        {/* All levels */}
        <div style={{ display: "flex", gap: 6 }}>
          {MEMBERSHIP.map(function(lvl) {
            var isActive = badge.tier === lvl.id;
            return (
              <div key={lvl.id} style={{ flex: 1, padding: "6px 4px", borderRadius: 10, background: isActive ? lvl.color + "18" : "rgba(0,0,0,.03)", border: isActive ? "2px solid " + lvl.color : "1px solid rgba(0,0,0,.05)", textAlign: "center" }}>
                <div style={{ fontSize: 16 }}>{lvl.icon}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: isActive ? lvl.color : C.sub }}>{lvl.name.replace("عضوية ","")}</div>
                <div style={{ fontSize: 7, color: C.sub }}>{lvl.min + " نقطة"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Membership note */}
      <div style={{ padding: "8px 12px", borderRadius: 10, background: C.bg, border: "1px solid " + C.bg }}>
        <div style={{ fontSize: 9, color: C.sub, lineHeight: 1.6, textAlign: "center" }}>{"⚖️ " + MEMBERSHIP_NOTE}</div>
      </div>
    </div>
  );
}

function WeeklyChart({ allAtt, branch }) {
  // Get last 7 days
  var days = [];
  var maxHrs = 0;
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var ds = d.toISOString().split("T")[0];
    var dayName = AR_DAYS[d.getDay()].slice(0, 3);
    var dayRecs = allAtt.filter(function(r){ return r.date === ds; });
    var cin = dayRecs.find(function(r){ return r.type === "checkin"; });
    var cout = dayRecs.find(function(r){ return r.type === "checkout"; });
    var hrs = 0;
    if (cin && cout) {
      var ms = new Date(cout.ts) - new Date(cin.ts);
      var bS = dayRecs.find(function(r){ return r.type === "break_start"; });
      var bE = dayRecs.find(function(r){ return r.type === "break_end"; });
      if (bS && bE) ms -= (new Date(bE.ts) - new Date(bS.ts));
      hrs = Math.max(0, ms / 3600000);
    } else if (cin && i === 0) {
      hrs = Math.max(0, (new Date() - new Date(cin.ts)) / 3600000);
    }
    if (hrs > maxHrs) maxHrs = hrs;
    var isLate = branch && cin && (new Date(cin.ts).getHours() * 60 + new Date(cin.ts).getMinutes()) > timeToMin(branch.start) + 5;
    days.push({ dayName: dayName, hrs: hrs, isLate: isLate, isToday: i === 0 });
  }
  var expected = branch ? (timeToMin(branch.end) - timeToMin(branch.start) - 30) / 60 : 8;
  var barMax = Math.max(maxHrs, expected) * 1.1;

  return (
    <div style={S.card} className="basma-fadein-d2">
      <div style={S.cardTitle}><span>ساعات الأسبوع</span><span style={{ fontSize: 11, color: C.sub }}>آخر 7 أيام</span></div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, padding: "0 4px" }}>
        {days.map(function(day, idx) {
          var pct = barMax > 0 ? Math.round((day.hrs / barMax) * 100) : 0;
          var col = day.hrs === 0 ? "#e0e0e0" : day.isLate ? C.orange : day.hrs >= expected ? C.green : C.blue;
          return (
            <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: day.hrs > 0 ? C.text : "#ccc" }}>{day.hrs > 0 ? day.hrs.toFixed(1) : ""}</div>
              <div style={{ width: "100%", borderRadius: 6, background: col, height: Math.max(4, pct) + "%", minHeight: 4, transition: "height .5s ease", opacity: day.isToday ? 1 : 0.7 }} />
              <div style={{ fontSize: 8, fontWeight: 700, color: day.isToday ? C.blue : C.sub }}>{day.dayName}</div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 1, background: C.bg, marginTop: 4, position: "relative" }}>
        <div style={{ position: "absolute", top: -8, left: 0, fontSize: 8, color: C.green }}>{expected + "h"}</div>
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>📸 بصمة الوجه</span>
      <button onClick={reset} disabled={resetting || done} style={{ padding: "5px 14px", borderRadius: 10, border: done ? "1px solid " + C.green : "1px solid " + C.red + "50", background: done ? C.green + "10" : C.red + "08", color: done ? C.green : C.red, fontSize: 11, fontWeight: 700, cursor: resetting || done ? "default" : "pointer" }}>
        {done ? "✓ تم الحذف" : resetting ? "جارِ..." : "إعادة تعيين"}
      </button>
    </div>
  );
}

function BottomNav({ page, setPage }) {
  var items = [
    { id: "home", icon: Icons.home, label: "الرئيسية" },
    { id: "benefits", icon: Icons.medal, label: "الامتيازات" },
    { id: "report", icon: Icons.chart, label: "تقريري" },
    { id: "profile", icon: Icons.user, label: "حسابي" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", background: "rgba(7,20,40,.85)", backdropFilter: "blur(10px)", borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", justifyContent: "space-around", padding: "10px 0 16px", zIndex: 50 }}>
      {items.map(function(n) {
        var active = page === n.id;
        var IconComp = n.icon;
        return (
          <button key={n.id} onClick={function(){ setPage(n.id); }} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", position: "relative", padding: "4px 12px" }}>
            {active && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 24, height: 3, borderRadius: 2, background: COLORS.gold }} />}
            <IconComp size={22} color={active ? COLORS.gold : COLORS.textMuted} />
            <span style={{ ...TYPOGRAPHY.tiny, fontWeight: 700, color: active ? COLORS.gold : COLORS.textMuted }}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════ STYLES ═══════════ */

/* ═══════════ CUSTODY (العهد) ═══════════ */
function CustodyTab({ user }) {
  var [items, setItems] = useState([]);
  useEffect(function() {
    api("custody", { params: { empId: user.id } }).then(function(d) { setItems(d || []); }).catch(function(){});
  }, []);

  var statusMap = { active: { label: "مستلمة", color: C.blue, icon: "📦" }, returned: { label: "مرتجعة", color: C.green, icon: "✓" }, lost: { label: "مفقودة", color: C.red, icon: "⚠️" } };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 12 }}>{"📦 العهد (" + items.length + ")"}</div>
      {items.length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 12, padding: 20 }}>لا توجد عهد مسجلة</div>}
      {items.map(function(item, i) {
        var s = statusMap[item.status] || statusMap.active;
        return (
          <div key={item.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid " + C.bg : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{item.name || "عهدة"}</div>
              <div style={{ fontSize: 9, color: C.sub }}>{(item.serial ? "SN: " + item.serial + " · " : "") + (item.createdAt ? item.createdAt.split("T")[0] : "")}</div>
              {item.type === "cash" && <div style={{ fontSize: 9, color: C.orange }}>{"💰 عهدة نقدية: " + (item.amount || 0) + " ريال"}</div>}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: s.color, padding: "2px 8px", borderRadius: 6, background: s.color + "12" }}>{s.label}</span>
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

  var statusMap = { pending: { label: "بانتظار الاعتماد", color: C.orange }, approved: { label: "معتمد", color: C.green }, rejected: { label: "مرفوض", color: C.red } };

  return (
    <div style={buildS().card} className="basma-fadein-d3">
      <div style={buildS().cardTitle}><span>🚀 الانتدابات</span><span style={{ fontSize: 10, color: C.sub }}>{delegations.length}</span></div>
      {delegations.map(function(dl, i) {
        var s = statusMap[dl.status] || statusMap.pending;
        return (
          <div key={dl.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < delegations.length - 1 ? "1px solid " + C.bg : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{dl.reason || "انتداب"}</div>
              <div style={{ fontSize: 9, color: C.sub }}>{(dl.from || "") + " → " + (dl.to || "")}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: s.color, padding: "2px 8px", borderRadius: 6, background: s.color + "12" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ VIOLATIONS PANEL (سجل المخالفات والإنذارات) ═══════════ */
function ViolationsCard({ user }) {
  var [violations, setViolations] = useState([]);
  var [warnings, setWarnings] = useState([]);
  var [expanded, setExpanded] = useState(false);

  useEffect(function() {
    api("violations", { params: { empId: user.id } }).then(function(v) { setViolations(v || []); }).catch(function(){});
    api("warnings", { params: { empId: user.id } }).then(function(w) { setWarnings(w || []); }).catch(function(){});
  }, []);

  var total = violations.length + warnings.length;
  if (total === 0) return null;

  return (
    <div style={buildS().card}>
      <div onClick={function(){ setExpanded(!expanded); }} style={{ ...buildS().cardTitle, cursor: "pointer" }}>
        <span>{"⚖️ المخالفات والإنذارات (" + total + ")"}</span>
        <span style={{ fontSize: 12, color: C.red }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div>
          {warnings.map(function(w, i) {
            var lvl = VIOLATION_ESCALATION.find(function(v){ return v.level === (w.level || 1); }) || VIOLATION_ESCALATION[0];
            return (
              <div key={w.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.bg }}>
                <span style={{ fontSize: 16 }}>{lvl.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{lvl.type}</div>
                  <div style={{ fontSize: 9, color: C.sub }}>{w.details || w.type || ""}</div>
                  <div style={{ fontSize: 8, color: C.sub }}>{w.ts ? w.ts.split("T")[0] : ""}</div>
                </div>
                <div style={{ fontSize: 9, color: C.orange, fontWeight: 700 }}>{"الرد: " + lvl.response}</div>
              </div>
            );
          })}
          {violations.map(function(v, i) {
            var vt = VIOLATION_TYPES[v.type] || { label: v.type || "مخالفة", category: "—" };
            return (
              <div key={v.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < violations.length - 1 ? "1px solid " + C.bg : "none" }}>
                <span style={{ fontSize: 14 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{vt.label}</div>
                  <div style={{ fontSize: 9, color: C.sub }}>{v.details || ""}</div>
                </div>
                <span style={{ fontSize: 9, color: v.status === "open" ? C.red : C.green }}>{v.status === "open" ? "مفتوحة" : "مغلقة"}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 9, color: C.sub, textAlign: "center", marginTop: 8, padding: 8, background: C.bg, borderRadius: 8 }}>
            ⚖️ يحق لك الاعتراض على أي إنذار خلال 48 ساعة — افتح تذكرة دعم من نوع "رد على إفادة"
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
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{"👨‍👩‍👧 المرافقين (" + deps.length + ")"}</div>
        <button onClick={function(){ setAdding(!adding); }} style={{ padding: "5px 12px", borderRadius: 8, background: C.blue, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>{adding ? "إلغاء" : "+ إضافة"}</button>
      </div>

      {adding && (
        <div style={{ padding: 14, borderRadius: 14, background: C.bg, marginBottom: 12 }}>
          <input value={form.name} onChange={function(e){ setForm({...form, name: e.target.value}); }} placeholder="الاسم الكامل" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + C.bg, fontSize: 13, marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <select value={form.relation} onChange={function(e){ setForm({...form, relation: e.target.value}); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + C.bg, fontSize: 12 }}>
              {relations.map(function(r){ return React.createElement("option", { key: r, value: r }, r); })}
            </select>
            <input type="date" value={form.dob} onChange={function(e){ setForm({...form, dob: e.target.value}); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + C.bg, fontSize: 12 }} />
          </div>
          <input value={form.idNumber} onChange={function(e){ setForm({...form, idNumber: e.target.value}); }} placeholder="رقم الهوية/الإقامة" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + C.bg, fontSize: 13, marginBottom: 6 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={form.externalInsurance} onChange={function(e){ setForm({...form, externalInsurance: e.target.checked}); }} />
            <span style={{ fontSize: 11, color: C.sub }}>مؤمّن عليه مع جهة أخرى</span>
          </div>
          {form.externalInsurance && <input value={form.insurerName} onChange={function(e){ setForm({...form, insurerName: e.target.value}); }} placeholder="اسم شركة التأمين" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + C.bg, fontSize: 13, marginBottom: 6 }} />}
          <button onClick={save} disabled={!form.name} style={{ width: "100%", padding: 10, borderRadius: 10, background: form.name ? C.green : "#ddd", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>حفظ المرافق</button>
        </div>
      )}

      {deps.length === 0 && !adding && <div style={{ textAlign: "center", color: C.sub, fontSize: 12, padding: 20 }}>لا يوجد مرافقين</div>}
      {deps.map(function(d, i) {
        var statusColors = { pending: C.orange, approved: C.green, rejected: C.red };
        var statusLabels = { pending: "بانتظار الاعتماد", approved: "معتمد", rejected: "مرفوض" };
        return (
          <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < deps.length - 1 ? "1px solid " + C.bg : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.blue + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.name}</div>
              <div style={{ fontSize: 10, color: C.sub }}>{d.relation + (d.externalInsurance ? " · 🛡️ تأمين خارجي" : "")}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: statusColors[d.status] || C.orange, padding: "2px 8px", borderRadius: 6, background: (statusColors[d.status] || C.orange) + "12" }}>{statusLabels[d.status] || "بانتظار"}</span>
          </div>
        );
      })}
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
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>🏥 الإفصاح الصحي</div>
      <div style={{ fontSize: 10, color: C.sub, marginBottom: 14 }}>أسئلة الإفصاح لأغراض التأمين — يُعتمد من الموارد البشرية</div>
      {defaultQuestions.map(function(q, i) {
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 }}>{(i + 1) + ". " + q}</div>
            <textarea value={answers[i] || ""} onChange={function(e){ updateAnswer(i, e.target.value); }} placeholder="الإجابة..." rows={2} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid " + C.bg, fontSize: 12, resize: "none" }} />
          </div>
        );
      })}
      <button onClick={save} style={{ width: "100%", padding: 10, borderRadius: 10, background: saved ? C.green : C.blue, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
        {saved ? "✓ تم الحفظ" : "حفظ الإفصاح"}
      </button>
      {saved && <div style={{ fontSize: 9, color: C.sub, textAlign: "center", marginTop: 6 }}>{"تاريخ الإفصاح: " + todayStr() + " — بانتظار اعتماد HR"}</div>}
    </div>
  );
}

/* ═══════════ ATTACHMENTS (المرفقات) ═══════════ */
function AttachmentsTab({ user }) {
  var docTypes = ["بطاقة هوية", "جواز سفر", "إقامة", "رخصة قيادة", "شهادة صحية", "عقد عمل", "IBAN بنكي", "أخرى"];
  var [docs, setDocs] = useState([]);

  useEffect(function() {
    api("attachments", { params: { empId: user.id } }).then(function(d) { setDocs(d || []); }).catch(function(){});
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

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>📎 المرفقات</div>
      <div style={{ fontSize: 10, color: C.sub, marginBottom: 14 }}>ارفع مستنداتك — الشهادات تُضاف من كوادر للقراءة فقط</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {docTypes.map(function(dt) {
          var exists = docs.some(function(d){ return d.type === dt; });
          return (
            <button key={dt} onClick={function(){ if(!exists) upload(dt); }} style={{ padding: "6px 12px", borderRadius: 8, background: exists ? C.green + "15" : C.bg, border: exists ? "1px solid " + C.green + "30" : "1px solid #ddd", fontSize: 10, fontWeight: 600, color: exists ? C.green : C.sub, cursor: exists ? "default" : "pointer" }}>
              {exists ? "✓ " : "📤 "}{dt}
            </button>
          );
        })}
      </div>

      {docs.map(function(d, i) {
        var statusColors = { pending: C.orange, approved: C.green, rejected: C.red };
        return (
          <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < docs.length - 1 ? "1px solid " + C.bg : "none" }}>
            <span style={{ fontSize: 14 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{d.type}</div>
              <div style={{ fontSize: 9, color: C.sub }}>{d.date}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: statusColors[d.status] || C.orange, padding: "2px 8px", borderRadius: 6, background: (statusColors[d.status] || C.orange) + "12" }}>{d.status === "approved" ? "معتمد" : d.status === "rejected" ? "مرفوض" : "بانتظار"}</span>
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
    <div style={buildS().card}>
      <div onClick={function(){ setExpanded(!expanded); }} style={{ ...buildS().cardTitle, cursor: "pointer" }}>
        <span>{"📊 سجل النقاط — ⭐" + (user.points || 0)}</span>
        <span style={{ fontSize: 12, color: C.blue }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div>
          {log.map(function(l, i) {
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < log.length - 1 ? "1px solid " + C.bg : "none" }}>
                <span style={{ fontSize: 14 }}>{l.icon}</span>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{l.label}</div>
                <div style={{ fontSize: 10, color: C.sub }}>{l.detail}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>{"+" + l.pts}</div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "2px solid " + C.bg, marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>المجموع المحسوب</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: C.green }}>{"⭐" + total}</span>
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
