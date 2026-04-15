import React, { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   بصمة HMA v4.51 — Mobile App
   Built from scratch — Approved Design
   + Face Verify + Challenge + Toasts
   ═══════════════════════════════════════════ */

const VER = "4.80";

/* ── Colors ── */
const LIGHT = {
  hdr1: "#1a3a6e", hdr2: "#2b5ea7", hdr3: "#3a7bd5",
  green: "#2d9f6f", greenDark: "#27ae60",
  orange: "#e67e22", orangeDark: "#d35400",
  red: "#e74c3c", redDark: "#c0392b",
  blue: "#2b5ea7", blueBright: "#3a7bd5",
  bg: "#f0f2f7", card: "#fff", text: "#1a1a1a", sub: "#888",
  gold: "#ffd700",
};
const DARK = {
  hdr1: "#0d1b33", hdr2: "#162d52", hdr3: "#1e3f6e",
  green: "#2d9f6f", greenDark: "#27ae60",
  orange: "#e67e22", orangeDark: "#d35400",
  red: "#e74c3c", redDark: "#c0392b",
  blue: "#3a7bd5", blueBright: "#5a9ae6",
  bg: "#111827", card: "#1e293b", text: "#e2e8f0", sub: "#94a3b8",
  gold: "#ffd700",
};
var C = LIGHT;

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
  const [page, setPage] = useState("home");
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
        {page === "home" && <HomePage user={user} branch={branch} now={now} todayAtt={todayAtt} allAtt={allAtt} gps={gps} gpsDist={gpsDist} streak={streak} loading={loading} refreshing={refreshing} dayState={getDayState()} checkpoints={getCheckpoints()} isOffDay={isOffDay()} pendingCount={myLeaves.filter(function(l){ return l.status === "pending"; }).length + myTickets.filter(function(t){ return t.status === "pending"; }).length} teamToday={teamToday} pwaPrompt={pwaPrompt} onPwaInstall={async function(){ if(pwaPrompt){pwaPrompt.prompt();await pwaPrompt.userChoice;setPwaPrompt(null);} }} onCheckin={requestCheckin} onChallenge={function(pts) { var u = { ...user, points: (user.points||0)+pts }; setUser(u); localStorage.setItem("basma_user", JSON.stringify(u)); showToast("🎉 +" + pts + " نقطة!"); }} onLeave={() => setLeaveModal(true)} onRefresh={refresh} onPreAbsence={function(){ setPreAbsModal(true); }} onManualAtt={function(){ setManualAttModal(true); }} kadwarNotifs={kadwarNotifs} />}
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
function HomePage({ user, branch, now, todayAtt, allAtt, gps, gpsDist, streak, loading, refreshing, dayState, checkpoints, isOffDay, pendingCount, teamToday, pwaPrompt, onPwaInstall, onCheckin, onChallenge, onLeave, onRefresh, onPreAbsence, onManualAtt, kadwarNotifs }) {
  const { time, sec, ampm } = formatTime(now);
  const badge = memberBadge(user.points || 0);
  const inRange = branch && gpsDist !== null && gpsDist <= (branch.radius || 150);

  // Challenge state — inside the circle
  var [challengeQ] = useState(function() { return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]; });
  var [challengeAnswer, setChallengeAnswer] = useState(null); // null = not answered, true = correct, false = wrong
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

  const SIZE = 200, STROKE = 10, R = (SIZE - STROKE) / 2, CIRC = 2 * Math.PI * R;
  let pct = dayState === "before" ? 5 : dayState === "after" ? 100 : 50;
  if (branch && dayState === "during") {
    const mins = now.getHours() * 60 + now.getMinutes();
    pct = Math.min(100, Math.round(((mins - timeToMin(branch.start)) / (timeToMin(branch.end) - timeToMin(branch.start))) * 100));
  }
  const ringOff = CIRC - (pct / 100) * CIRC;
  var outsideNoCheckin = !checkpoints.checkin && gpsDist !== null && branch && gpsDist > (branch.radius || 150);
  const ringCol = outsideNoCheckin ? C.red : dayState === "during" ? "#5ec47a" : dayState === "after" ? C.gold : "#80b4f0";

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
    <div style={{ flex: 1, paddingBottom: 80 }}>
      <div style={S.header}>
        <div style={S.headerCurve} />
        <div style={S.headerTop}>
          <div>
            <div style={S.welcome}>{"أهلاً، " + (user.name || "").split(" ")[0] + " 👋"}</div>
            <div style={S.date}>{formatArabicDate(now)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{badge.icon + " " + badge.label}</span>
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 800 }}>{"⭐" + (user.points || 0)}</span>
            {pendingCount > 0 && (
              <div style={{ position: "relative", marginRight: 2 }}>
                <span style={{ fontSize: 16 }}>🔔</span>
                <div style={{ position: "absolute", top: -4, right: -6, width: 16, height: 16, borderRadius: 8, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>{pendingCount}</div>
              </div>
            )}
          </div>
        </div>
        <div style={S.clockWrap}>
          <div style={{ position: "relative", width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={STROKE} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={ringCol} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOff} style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={S.clockInner}>
              {showChallenge ? (
                /* ── Challenge inside circle ── */
                <div style={{ textAlign: "center", padding: "0 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,.5)", marginBottom: 2 }}>{"⚡ " + challengeQ.type}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.5 }}>{challengeQ.q}</div>
                </div>
              ) : challengeAnswer !== null && dayState === "before" ? (
                /* ── Challenge result ── */
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28 }}>{challengeAnswer ? "🎉" : "😅"}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{challengeAnswer ? MASCOT.correct : MASCOT.wrong}</div>
                  {challengeAnswer && <div style={{ fontSize: 10, color: C.gold, marginTop: 2 }}>{"+" + POINTS.challenge_correct + " نقطة"}</div>}
                </div>
              ) : (
                /* ── Normal clock ── */
                <div style={{ textAlign: "center" }}>
                  <div style={S.clockTime}>{time}<span style={{ fontSize: 18, opacity: .6 }}>{":" + sec}</span></div>
                  <div style={S.clockAmpm}>{ampm}</div>
                  {outsideNoCheckin && dayState !== "after" && (
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#FF6B6B", marginTop: -2, marginBottom: 2 }}>لم تقم بتسجيل الحضور</div>
                  )}
                  {outsideNoCheckin && gpsDist && (
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,.4)" }}>{"خارج منطقة العمل (" + gpsDist + " م)"}</div>
                  )}
                  {dayState === "during" && branch && !outsideNoCheckin && (function() {
                    var remaining = timeToMin(branch.end) - (now.getHours() * 60 + now.getMinutes());
                    if (remaining > 0) {
                      var rh = Math.floor(remaining / 60);
                      var rm = remaining % 60;
                      return React.createElement("div", { style: { fontSize: 9, color: "rgba(255,255,255,.5)", marginTop: -2, marginBottom: 2 } }, "متبقي " + rh + ":" + String(rm).padStart(2,"0"));
                    }
                    return null;
                  })()}
                  {btnAction ? (
                    <button onClick={function(){ if(!loading) onCheckin(btnAction, btnLabel); }} disabled={loading} style={S.clockBtn}>
                      {loading ? React.createElement("span", { className: "basma-pulse" }, "⏳") : btnText}
                    </button>
                  ) : (
                    <div style={{ ...S.clockBtn, opacity: .6, cursor: "default" }}>{btnText}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={S.content}>
        <MembershipFreezeNotice user={user} />
        <BranchHolidayBanner branch={branch} />
        <OccasionBanner user={user} />

        <div style={S.statsRow} className="basma-fadein">
          <div style={{ ...S.statCard, background: "linear-gradient(135deg,"+C.green+","+C.greenDark+")" }}>
            <div style={S.statIcon}>✓</div>
            <div><div style={S.statNum}>{attendPct + "%"}</div><div style={S.statLabel}>نسبة الحضور</div></div>
          </div>
          <div style={{ ...S.statCard, background: "linear-gradient(135deg,"+C.orange+","+C.orangeDark+")" }}>
            <div style={S.statIcon}>⏰</div>
            <div><div style={S.statNum}>{lateDays}</div><div style={S.statLabel}>أيام تأخر</div></div>
          </div>
        </div>

        <div style={S.gpsRow}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: gps ? (inRange ? C.green : C.red) : C.orange, transition: "background .3s" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: gps ? (inRange ? C.green : C.red) : C.orange }}>
            {gps ? (inRange ? "📍 في نطاق العمل" : "📍 خارج النطاق") + (branch ? " — " + branch.name + " (" + (gpsDist || "...") + " م)" : "") : "📍 جارِ تحديد الموقع..."}
          </span>
          {streak > 0 && <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 800, color: C.orange }}>{"🔥 " + streak + " يوم"}</span>}
        </div>

        {isOffDay && (
          <div style={{ background: "linear-gradient(135deg,"+C.blue+"18,"+C.blueBright+"10)", borderRadius: 14, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, border: "1px solid "+C.blue+"25" }}>
            <span style={{ fontSize: 16 }}>🏖️</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>يوم إجازة — استمتع بوقتك!</span>
          </div>
        )}

        {/* ── Challenge Answer Options (3 خيارات) ── */}
        {showChallenge && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }} className="basma-fadein-d1">
            {challengeQ.opts.map(function(opt, idx) {
              return (
                <button key={idx} onClick={function(){ answerChallenge(idx); }} style={{ padding: "12px 16px", borderRadius: 14, background: "#fff", border: "2px solid rgba(0,0,0,.06)", fontSize: 13, fontWeight: 700, color: C.text, cursor: "pointer", textAlign: "center", fontFamily: "'Tajawal',sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
                  {opt}
                </button>
              );
            })}
            <div style={{ textAlign: "center", fontSize: 9, color: C.sub }}>{"⚡ تحدي الصباح — " + POINTS.challenge_correct + " نقطة"}</div>
          </div>
        )}

        {/* ── Mascot message ── */}
        {dayState === "before" && !showChallenge && challengeAnswer === null && challengeDoneToday && (
          <div style={{ textAlign: "center", padding: "8px 0 12px", fontSize: 12, color: C.green, fontWeight: 700 }}>{"✓ أجبت على تحدي اليوم — " + MASCOT.idle}</div>
        )}

        <div style={S.card} className="basma-fadein-d1">
          <div style={S.cardTitle}>نقاط البصمة</div>
          <div style={S.cpRow}>
            <Checkpoint icon="☀️" label="حضور" time={cpTime("checkin")} done={checkpoints.checkin} />
            <Checkpoint icon="☕" label="استراحة" time={cpTime("break_start")} done={checkpoints.breakStart} />
            <Checkpoint icon="🔄" label="عودة" time={cpTime("break_end")} done={checkpoints.breakEnd} />
            <Checkpoint icon="🌙" label="انصراف" time={cpTime("checkout")} done={checkpoints.checkout} />
          </div>
        </div>

        {checkpoints.checkin && (
          <WorkHoursCard todayAtt={todayAtt} now={now} branch={branch} dayState={dayState} />
        )}

        {/* ── Overtime ── */}
        <OvertimeCard todayAtt={todayAtt} branch={branch} now={now} user={user} />

        {/* ── Field Projects ── */}
        <FieldProjectsCard user={user} gps={gps} />

        {/* ── Points Log ── */}
        <PointsLogCard user={user} allAtt={allAtt} />

        {/* ── Violations + Delegation ── */}
        <ViolationsCard user={user} />
        <DelegationCard user={user} />

        {/* ── Quick Actions ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }} className="basma-fadein-d2">
          <button onClick={onLeave} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, background: "#fff", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>📝</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>طلب إجازة</span>
          </button>
          <button onClick={onRefresh} disabled={refreshing} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, background: "#fff", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 16 }}>{refreshing ? "⏳" : "🔄"}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{refreshing ? "جارِ التحديث..." : "تحديث البيانات"}</span>
          </button>
        </div>

        {/* ── Team Today (managers only) ── */}
        {teamToday && teamToday.length > 0 && (user.isManager || user.isAssistant) && (
          <div style={S.card} className="basma-fadein-d3">
            <div style={S.cardTitle}>
              <span>فريق العمل</span>
              <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>{teamToday.filter(function(t){ return t.present; }).length + "/" + teamToday.length + " حاضر"}</span>
            </div>
            {teamToday.map(function(member, i) {
              return (
                <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < teamToday.length - 1 ? "1px solid " + C.bg : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: member.present ? C.green + "18" : C.red + "10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    {member.present ? "✓" : "—"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: member.present ? C.text : "#bbb" }}>{member.name}</div>
                    <div style={{ fontSize: 9, color: C.sub }}>{member.role}</div>
                  </div>
                  {!member.present && user.isManager && (
                    <button onClick={function(){ onPreAbsence(member); }} style={{ padding: "3px 8px", borderRadius: 6, background: C.orange + "15", border: "1px solid " + C.orange + "30", fontSize: 8, fontWeight: 700, color: C.orange, cursor: "pointer" }}>
                      إفادة غد
                    </button>
                  )}
                  <span style={{ fontSize: 9, fontWeight: 700, color: member.present ? C.green : C.red, padding: "2px 8px", borderRadius: 6, background: member.present ? C.green + "12" : C.red + "08" }}>
                    {member.present ? "حاضر" : "غائب"}
                  </span>
                </div>
              );
            })}

            {/* Manager actions */}
            <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid " + C.bg }}>
              <button onClick={onPreAbsence} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, background: C.orange + "12", border: "1px solid " + C.orange + "25", fontSize: 10, fontWeight: 700, color: C.orange, cursor: "pointer", textAlign: "center" }}>
                📋 إفادة مسبقة (غد)
              </button>
              {user.isManager && (
                <button onClick={onManualAtt} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, background: C.blue + "12", border: "1px solid " + C.blue + "25", fontSize: 10, fontWeight: 700, color: C.blue, cursor: "pointer", textAlign: "center" }}>
                  ✏️ تحضير يدوي
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── إشعارات منصة كوادر ── */}
        <div style={S.card} className="basma-fadein-d3">
          <div style={S.cardTitle}><span>إشعارات منصة كوادر</span><span style={{ fontSize: 10, color: C.blue }}>hma.engineer</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <KadwarBtn icon="💬" label="تواصل" count={kadwarNotifs.tasks} />
            <KadwarBtn icon="📝" label="اختبار" count={kadwarNotifs.exams} />
            <KadwarBtn icon="👤" label="حسابي" count={kadwarNotifs.alerts} />
          </div>
        </div>

        {/* ── PWA Install Banner ── */}
        {pwaPrompt && (
          <div style={{ background: "linear-gradient(135deg,"+C.hdr2+","+C.hdr3+")", borderRadius: 16, padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, color: "#fff" }} className="basma-fadein-d3">
            <span style={{ fontSize: 24 }}>📲</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>ثبّت التطبيق</div>
              <div style={{ fontSize: 10, opacity: .7 }}>أضف بصمة HMA لشاشتك الرئيسية</div>
            </div>
            <button onClick={onPwaInstall} style={{ padding: "8px 16px", borderRadius: 10, background: C.gold, color: C.hdr1, fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer" }}>تثبيت</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ REPORT ═══════════ */
function ReportPage({ user, allAtt, todayAtt, branch, isOffDay, myLeaves, allEmps }) {
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
    <div style={{ flex: 1, paddingBottom: 80 }}>
      <div style={S.detailHeader}>
        <div style={{ width: 60 }} />
        <div style={S.detailTitle}>تقريري</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "16px 16px 0" }}>

        {/* ── Export Buttons (managers only) ── */}
        <ExportButtons user={user} allAtt={allAtt} branch={branch} allEmps={allEmps} />

        {/* ── ملخص اليوم ── */}
        <div style={S.card} className="basma-fadein">
          <div style={S.cardTitle}><span>ملخص اليوم</span><span style={{ fontSize: 11, color: C.sub }}>{todayStr()}</span></div>
          <div style={S.summaryGrid}>
            <SummaryItem num={todayCheckin ? 1 : 0} label="حاضر" cls="ok" />
            <SummaryItem num={todayLate ? 1 : 0} label="متأخر" cls="warn" />
            <SummaryItem num={todayAbsent ? 1 : 0} label="غائب" cls="bad" />
            <SummaryItem num={0} label="إجازة" cls="info" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }} className="basma-fadein-d1">
          <div style={{ background: "#fff", padding: "8px 18px", borderRadius: 12, fontSize: 12, fontWeight: 700, color: C.blue, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            {"1 " + monthName + " — " + lastDay + " " + monthName + " ▾"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }} className="basma-fadein-d1">
          <ReportStat num={presentDays} unit="يوم" label="حاضر" bg={"linear-gradient(135deg,"+C.green+","+C.greenDark+")"} />
          <ReportStat num={lateDays} unit="يوم" label="متأخر" bg={"linear-gradient(135deg,"+C.orange+","+C.orangeDark+")"} />
          <ReportStat num={absentDays} unit="يوم" label="غائب" bg={"linear-gradient(135deg,"+C.red+","+C.redDark+")"} />
        </div>

        <div style={S.card} className="basma-fadein-d2">
          <div style={S.cardTitle}>إحصائيات الشهر</div>
          <div style={{ display: "flex", gap: 1, background: C.bg, borderRadius: 16, overflow: "hidden" }}>
            <MonthStat num={attendPct + "%"} label="نسبة الحضور" color={C.green} />
            <MonthStat num={overtimeHrs} label="ساعات إضافية" color={C.blue} />
            <MonthStat num={leaveDays} label="أيام إجازة" color={C.orange} />
          </div>
        </div>

        {/* ── التقويم الشهري ── */}
        <div style={S.card} className="basma-fadein-d2">
          <div style={S.cardTitle}><span>التقويم</span><span style={{ fontSize: 11, color: C.sub }}>{monthName + " " + yr}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
            {["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"].map(function(d){ return <div key={d} style={{ fontSize: 8, color: C.sub, fontWeight: 700, padding: 4 }}>{d}</div>; })}
            {calDays.map(function(cd, idx) {
              if (!cd) return <div key={"e"+idx} />;
              var bg = cd.isToday ? C.blue : cd.hasAtt ? (cd.isLate ? C.orange+"20" : C.green+"20") : "transparent";
              var color = cd.isToday ? "#fff" : cd.hasAtt ? (cd.isLate ? C.orange : C.green) : "#ccc";
              var border = cd.isToday ? "none" : cd.hasAtt ? "1px solid " + (cd.isLate ? C.orange+"40" : C.green+"40") : "1px solid #eee";
              return (
                <div key={cd.day} style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: bg, border: border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: color }}>
                  {cd.day}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10 }}>
            <span style={{ fontSize: 9, color: C.green }}>● حاضر</span>
            <span style={{ fontSize: 9, color: C.orange }}>● متأخر</span>
            <span style={{ fontSize: 9, color: C.blue }}>● اليوم</span>
          </div>
        </div>

        {/* ── مخطط الأسبوع ── */}
        <WeeklyChart allAtt={monthAtt} branch={branch} />

        <div style={S.card} className="basma-fadein-d3">
          <div style={S.cardTitle}>آخر البصمات</div>
          {recent.length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 20 }}>لا توجد بصمات بعد</div>}
          {recent.map((r, i) => {
            const info = typeMap[r.type] || { label: r.type, color: C.sub, icon: "📌" };
            return (
              <div key={r.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < recent.length - 1 ? "1px solid " + C.bg : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: info.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{info.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 10, color: info.color, marginTop: 1 }}>{info.label + " · " + r.date}</div>
                </div>
                <div style={{ marginRight: "auto", fontSize: 12, fontWeight: 700, color: "#555" }}>{formatTimeStr(r.ts)}</div>
              </div>
            );
          })}
        </div>

        {myLeaves && myLeaves.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>إجازاتي</div>
            {myLeaves.slice(0, 5).map(function(l, i) {
              var statusMap = { pending: { label: "قيد المراجعة", color: C.orange, icon: "⏳" }, approved: { label: "مقبولة", color: C.green, icon: "✓" }, rejected: { label: "مرفوضة", color: C.red, icon: "✗" } };
              var s = statusMap[l.status] || statusMap.pending;
              var typeLabels = { annual: "سنوية", sick: "مرضية", emergency: "طارئة", personal: "شخصية" };
              return (
                <div key={l.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < myLeaves.length - 1 ? "1px solid " + C.bg : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: s.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{typeLabels[l.type] || l.type}</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{l.from + " → " + l.to}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: s.color, padding: "3px 8px", borderRadius: 8, background: s.color + "12" }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={exportCSV} style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: 12 }}>
          📊 تصدير التقرير
        </button>
      </div>
    </div>
  );
}

/* ═══════════ PROFILE ═══════════ */
function ProfilePage({ user, branch, onLogout, onTicket, myTickets, darkMode, toggleDark }) {
  var [tab, setTab] = useState("info");
  const typeMap = { office: "🏢 مكتبي", field: "🏗️ ميداني", mixed: "🔀 مختلط", remote: "🏠 عن بعد" };
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
    { id: "info", icon: "👤", label: "بياناتي" },
    { id: "deps", icon: "👨‍👩‍👧", label: "المرافقين" },
    { id: "health", icon: "🏥", label: "الإفصاح" },
    { id: "docs", icon: "📎", label: "المرفقات" },
    { id: "custody", icon: "📦", label: "العهد" },
  ];

  return (
    <div style={{ flex: 1, paddingBottom: 80 }}>
      <div style={S.detailHeader}>
        <div style={{ width: 60 }} />
        <div style={S.detailTitle}>حسابي</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }} className="basma-fadein">
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, border: "3px solid #fff", boxShadow: "0 4px 15px rgba(43,94,167,.3)" }}>👤</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Cairo',sans-serif" }}>{user.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{user.role + " — " + user.id}</div>
        </div>

        {/* ── Profile Tabs ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: C.bg, borderRadius: 14, padding: 4 }}>
          {tabs.map(function(t) {
            var active = tab === t.id;
            return (
              <button key={t.id} onClick={function(){ setTab(t.id); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: active ? C.card : "transparent", border: "none", fontSize: 10, fontWeight: 700, color: active ? C.blue : C.sub, cursor: "pointer", textAlign: "center", boxShadow: active ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
                <div style={{ fontSize: 14 }}>{t.icon}</div>{t.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: بياناتي ── */}
        {tab === "info" && (
          <div>
            <div style={S.card} className="basma-fadein-d1">
              {rows.map(function(row, i) {
            return (
              <div key={row[0]} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: i < rows.length - 1 ? "1px solid " + C.bg : "none" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{row[1]}</span>
                <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{row[0]}</span>
              </div>
            );
          })}
        </div>

        {/* ── Membership Card ── */}
        <MembershipCard points={user.points || 0} />

        <div style={S.card} className="basma-fadein-d2">
          <div style={S.cardTitle}>الإعدادات</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid " + C.bg }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>🌙 الوضع الليلي</span>
            <div onClick={toggleDark} style={{ width: 44, height: 24, borderRadius: 12, background: darkMode ? C.blue : "#ddd", position: "relative", cursor: "pointer", transition: "background .3s" }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, transition: "all .3s", left: darkMode ? 3 : undefined, right: darkMode ? undefined : 3, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </div>
          </div>
          <ToggleRow label="📞 تذكير بالحضور" storeKey="remind_in" border={true} />
          <ToggleRow label="📞 تذكير بالانصراف" storeKey="remind_out" border={true} />
          <FaceResetRow empId={user.id} />
        </div>

        {user.sceNumber && (
          <div style={S.card} className="basma-fadein-d3">
            <div style={S.cardTitle}>الهيئة السعودية للمهندسين</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{user.sceNumber}</span>
              <span style={{ fontSize: 11, color: C.sub }}>رقم العضوية</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid " + C.bg }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: user.sceStatus === "active" ? C.green : C.red }}>{user.sceStatus === "active" ? "✓ ساري" : "✗ منتهي"}</span>
              <span style={{ fontSize: 11, color: C.sub }}>{"انتهاء: " + user.sceExpiry}</span>
            </div>
          </div>
        )}

        {myTickets && myTickets.length > 0 && (
          <div style={S.card} className="basma-fadein-d3">
            <div style={S.cardTitle}>تذاكري</div>
            {myTickets.slice(0, 5).map(function(t, i) {
              var statusMap = { pending: { label: "قيد المراجعة", color: C.orange }, open: { label: "مفتوحة", color: C.blue }, resolved: { label: "تم الحل", color: C.green }, closed: { label: "مغلقة", color: C.sub } };
              var st = statusMap[t.status] || statusMap.pending;
              var prioMap = { low: "🟢", normal: "🔵", high: "🔴" };
              return (
                <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < Math.min(myTickets.length, 5) - 1 ? "1px solid " + C.bg : "none" }}>
                  <span style={{ fontSize: 14 }}>{prioMap[t.priority] || "🔵"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{t.subject}</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{t.ts ? t.ts.split("T")[0] : ""}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: st.color, padding: "3px 8px", borderRadius: 8, background: st.color + "12" }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={onTicket} style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg,"+C.orange+",#FF8021)", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: 8 }}>
          🎫 تذكرة دعم جديدة
        </button>

          </div>
        )}

        {/* ── Tab: المرافقين ── */}
        {tab === "deps" && <div style={S.card}><DependentsTab user={user} /></div>}

        {/* ── Tab: الإفصاح الصحي ── */}
        {tab === "health" && <div style={S.card}><HealthDisclosureTab user={user} /></div>}

        {/* ── Tab: المرفقات ── */}
        {tab === "docs" && <div style={S.card}><AttachmentsTab user={user} /></div>}

        {/* ── Tab: العهد ── */}
        {tab === "custody" && <div style={S.card}><CustodyTab user={user} /></div>}

        {/* ── Action Buttons (always visible) ── */}
        {(user.isManager || user.isAssistant) && (
          <button onClick={function(){ window.location.hash = "admin"; }} style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg,"+C.hdr1+","+C.hdr2+")", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: 8 }}>
            🛡️ لوحة الإدارة
          </button>
        )}

        <button onClick={onLogout} style={{ width: "100%", padding: 14, borderRadius: 16, border: "2px solid " + C.red, background: "transparent", color: C.red, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          🚪 تسجيل خروج
        </button>
        <div style={{ textAlign: "center", marginTop: 16, marginBottom: 12, padding: 12, background: "#fff", borderRadius: 16 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🕐</div>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Cairo',sans-serif" }}>بصمة HMA</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>نظام الحضور والانصراف الذكي</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>هاني محمد عسيري للاستشارات الهندسية</div>
          <div style={{ fontSize: 9, color: "#ccc", marginTop: 6 }}>{"v" + VER + " · basma-hma.vercel.app"}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ BENEFITS PAGE (امتيازات العضوية) ═══════════ */
function BenefitsPage({ user }) {
  var badge = memberBadge(user.points || 0);
  var [filter, setFilter] = useState("all");
  var isRamadan = false; // TODO: detect Ramadan from Hijri date
  var allCoupons = isRamadan ? COUPONS.concat(RAMADAN_COUPONS) : COUPONS;
  var cats = ["all"].concat(Array.from(new Set(allCoupons.map(function(c){ return c.cat; }))));
  var filtered = filter === "all" ? allCoupons : allCoupons.filter(function(c){ return c.cat === filter; });

  return (
    <div style={{ flex: 1, paddingBottom: 80 }}>
      <div style={S.detailHeader}>
        <div style={{ width: 60 }} />
        <div style={S.detailTitle}>🎖 امتيازات العضوية</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "16px 16px 0" }}>

        {/* Current level summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "12px 14px", background: badge.bg, borderRadius: 16, border: "1.5px solid " + badge.color + "30" }} className="basma-fadein">
          <span style={{ fontSize: 28 }}>{badge.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: badge.color }}>{badge.label}</div>
            <div style={{ fontSize: 10, color: C.sub }}>{"⭐ " + (user.points || 0) + " نقطة"}</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub }}>
            {filtered.filter(function(c){ return c.minTier <= badge.tier; }).length + " متاح من " + filtered.length}
          </div>
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }} className="basma-fadein-d1">
          {cats.map(function(cat) {
            var active = filter === cat;
            var catLabels = { all: "الكل", "مطاعم": "🍔 مطاعم", "خدمات": "🔧 خدمات", "رياضة": "💪 رياضة", "تسوق": "🛍 تسوق", "سفر": "✈️ سفر", "رمضان": "🌙 رمضان" };
            return (
              <button key={cat} onClick={function(){ setFilter(cat); }} style={{ padding: "6px 14px", borderRadius: 10, background: active ? C.blue : C.card, color: active ? "#fff" : C.sub, fontSize: 10, fontWeight: 700, border: active ? "none" : "1px solid rgba(0,0,0,.06)", cursor: "pointer", whiteSpace: "nowrap" }}>
                {catLabels[cat] || cat}
              </button>
            );
          })}
        </div>

        {/* Coupons grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="basma-fadein-d2">
          {filtered.map(function(coupon) {
            var available = coupon.minTier <= badge.tier;
            var canAfford = (user.points || 0) >= coupon.pts;
            var tierName = MEMBERSHIP[coupon.minTier] ? MEMBERSHIP[coupon.minTier].name.replace("عضوية ","") : "فعّال";
            return (
              <div key={coupon.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, background: C.card, border: available ? "1.5px solid " + C.green + "30" : "1px solid rgba(0,0,0,.06)", opacity: available ? 1 : 0.5, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: available ? C.green + "12" : "rgba(0,0,0,.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{coupon.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{coupon.brand}</div>
                  <div style={{ fontSize: 11, color: available ? C.green : C.sub, fontWeight: 600 }}>{coupon.discount}</div>
                  {!available && <div style={{ fontSize: 8, color: C.orange }}>{"يتطلب " + tierName}</div>}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: canAfford && available ? C.green : C.sub }}>{coupon.pts}</div>
                  <div style={{ fontSize: 8, color: C.sub }}>نقطة</div>
                  {available && canAfford && (
                    <button style={{ marginTop: 4, padding: "3px 10px", borderRadius: 8, background: C.green, color: "#fff", fontSize: 9, fontWeight: 700, border: "none", cursor: "pointer" }}>استبدال</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isRamadan && (
          <div style={{ textAlign: "center", marginTop: 12, padding: 10, borderRadius: 12, background: "#FFF3C4", fontSize: 11, fontWeight: 700, color: "#D4A017" }}>
            🌙 عروض رمضان الخاصة متاحة!
          </div>
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
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 6 }}>{"تأكيد " + label}</div>
        <div style={{ fontSize: 12, color: C.sub, textAlign: "center", marginBottom: 20 }}>{"هل تريد " + label + " الآن؟"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>إلغاء</button>
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
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 4 }}>
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
            <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
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
            <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
            <button onClick={capture} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,"+C.green+","+C.greenDark+")", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📸 التقاط</button>
          </div>
        )}
        {status === "mismatch" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
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
        <div style={{ fontSize: 15, fontWeight: 700, textAlign: "center", marginBottom: 16, lineHeight: 1.6 }}>{q.q}</div>
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
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 4 }}>📋 إفادة مسبقة بالغياب</div>
        <div style={{ fontSize: 10, color: C.sub, textAlign: "center", marginBottom: 14 }}>{"الموظف لن يحضر غداً: " + tomorrowStr}</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>اختر الموظف</div>
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif", background: "#fff" }}>
            <option value="">— اختر —</option>
            {managed.map(function(e) { return React.createElement("option", { key: e.id, value: e.id }, e.name + " (" + e.id + ")"); })}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>السبب</div>
          <textarea value={reason} onChange={function(e){ setReason(e.target.value); }} placeholder="سبب الغياب..." rows={2} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none" }} />
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
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
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
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 14 }}>✏️ تحضير يدوي</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>الموظف</div>
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif", background: "#fff" }}>
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
          <input type="date" value={date} onChange={function(e){ setDate(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
        </div>

        <div style={{ fontSize: 9, color: C.blue, marginBottom: 12, padding: 8, borderRadius: 8, background: C.blue + "08" }}>
          🛡️ التحضير اليدوي متاح لمدير النظام فقط — يُسجّل في النظام "تم التحضير يدوياً"
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={function(){ if(empId) onSubmit({ empId: empId, type: type, date: date }); }} disabled={!empId} style={{ flex: 1, padding: 12, borderRadius: 14, border: "none", background: empId ? "linear-gradient(135deg,"+C.blue+","+C.blueBright+")" : "#eee", color: empId ? "#fff" : "#aaa", fontSize: 14, fontWeight: 700, cursor: empId ? "pointer" : "default" }}>
            تسجيل ✓
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
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 16 }}>📝 طلب إجازة</div>

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
            <input type="date" value={from} onChange={function(e){ setFrom(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>إلى</div>
            <input type="date" value={to} onChange={function(e){ setTo(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 600, marginBottom: 4 }}>السبب (اختياري)</div>
          <textarea value={reason} onChange={function(e){ setReason(e.target.value); }} placeholder="اكتب سبب الإجازة..." rows={2} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
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
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 380 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 16 }}>🎫 تذكرة دعم</div>

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
          <input value={subject} onChange={function(e){ setSubject(e.target.value); }} placeholder="الموضوع" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #eee", fontSize: 14, fontFamily: "'Tajawal',sans-serif" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <textarea value={message} onChange={function(e){ setMessage(e.target.value); }} placeholder="اكتب رسالتك هنا..." rows={3} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #eee", fontSize: 13, fontFamily: "'Tajawal',sans-serif", resize: "none" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid #eee", background: "#fff", color: C.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
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
          <div style={{ height: 6, borderRadius: 3, background: "#eee", overflow: "hidden" }}>
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
      <div style={{ fontSize: 8, color: "#aaa" }}>{time}</div>
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
    <div style={{ flex: 1, background: "#fff", padding: "14px 8px", textAlign: "center" }}>
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
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, transition: "all .3s", left: on ? 3 : undefined, right: on ? undefined : 3, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
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
            <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
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
      <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,.03)", border: "1px solid rgba(0,0,0,.05)" }}>
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
      <div style={{ height: 1, background: "#eee", marginTop: 4, position: "relative" }}>
        <div style={{ position: "absolute", top: -8, left: 0, fontSize: 8, color: C.green }}>{expected + "h"}</div>
      </div>
    </div>
  );
}

function KadwarBtn({ icon, label, count }) {
  return (
    <button onClick={function(){ window.open("https://hma.engineer", "_blank"); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, background: C.card, border: "1px solid " + C.bg, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", position: "relative" }}>
      <span style={{ fontSize: 14, position: "relative" }}>
        {icon}
        {count > 0 && (
          <span style={{ position: "absolute", top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8, background: C.red, color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{count}</span>
        )}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{label}</span>
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
    { id: "home", icon: "🏠", label: "الرئيسية" },
    { id: "benefits", icon: "🎖", label: "الامتيازات" },
    { id: "report", icon: "📊", label: "تقريري" },
    { id: "profile", icon: "👤", label: "حسابي" },
  ];
  return (
    <div style={S.nav}>
      {items.map(function(n) {
        var active = page === n.id;
        return (
          <button key={n.id} onClick={function(){ setPage(n.id); }} style={{ ...S.navItem, position: "relative" }}>
            {active && <div style={S.navBar} />}
            <span style={{ fontSize: 20, opacity: active ? 1 : .35, transition: "opacity .2s" }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: active ? C.blue : "#aaa", transition: "color .2s" }}>{n.label}</span>
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
              <div style={{ fontSize: 12, fontWeight: 700 }}>{item.name || "عهدة"}</div>
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
              <div style={{ fontSize: 12, fontWeight: 700 }}>{dl.reason || "انتداب"}</div>
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
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{lvl.type}</div>
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
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{vt.label}</div>
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
          <input value={form.name} onChange={function(e){ setForm({...form, name: e.target.value}); }} placeholder="الاسم الكامل" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <select value={form.relation} onChange={function(e){ setForm({...form, relation: e.target.value}); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 12 }}>
              {relations.map(function(r){ return React.createElement("option", { key: r, value: r }, r); })}
            </select>
            <input type="date" value={form.dob} onChange={function(e){ setForm({...form, dob: e.target.value}); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 12 }} />
          </div>
          <input value={form.idNumber} onChange={function(e){ setForm({...form, idNumber: e.target.value}); }} placeholder="رقم الهوية/الإقامة" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 6 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={form.externalInsurance} onChange={function(e){ setForm({...form, externalInsurance: e.target.checked}); }} />
            <span style={{ fontSize: 11, color: C.sub }}>مؤمّن عليه مع جهة أخرى</span>
          </div>
          {form.externalInsurance && <input value={form.insurerName} onChange={function(e){ setForm({...form, insurerName: e.target.value}); }} placeholder="اسم شركة التأمين" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginBottom: 6 }} />}
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
              <div style={{ fontSize: 12, fontWeight: 700 }}>{d.name}</div>
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
            <textarea value={answers[i] || ""} onChange={function(e){ updateAnswer(i, e.target.value); }} placeholder="الإجابة..." rows={2} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 12, resize: "none" }} />
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
              <div style={{ fontSize: 11, fontWeight: 700 }}>{d.type}</div>
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

  header: { background: "linear-gradient(180deg,"+C.hdr1+" 0%,"+C.hdr2+" 50%,"+C.hdr3+" 100%)", padding: "20px 20px 60px", position: "relative", overflow: "hidden" },
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

  card: { background: C.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.06)" },
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
