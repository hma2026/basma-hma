import { useState, useEffect, useRef } from "react";
import { ALL_VIOLATIONS_DEFAULT, PENALTY_TYPES, LAIHA_INFO, COMPLAINT_STATUS, VIOLATION_STATUS, PROCEDURE_RULES } from "./laiha";

const APP = "بصمة HMA";
const CO = "هاني محمد عسيري للإستشارات الهندسية";
const B = { blue: "#2B5EA7", yellow: "#FDD800", red: "#E2192C", black: "#1A1A1A", blueDk: "#1E4478", blueLt: "#EDF3FB", gold: "#D4A017" };

// Theme palettes
const LT = { bg: "#F2F2F7", card: "#fff", tx: "#000000", tx2: "#6E6E73", txM: "#8E8E93", sep: "#E5E5EA", ac: "#0A84FF", ok: "#30D158", okLt: "rgba(48,209,88,0.1)", warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.1)", bad: "#FF3B30", badLt: "rgba(255,59,48,0.08)", cardBrd: "rgba(0,0,0,0.05)", cardSh: "0 1px 3px rgba(0,0,0,0.08)", nav: "#F2F2F7", navBrd: "rgba(0,0,0,0.1)", inp: "#FFFFFF", inpBrd: "#E5E5EA" };
const DK = { bg: "#000000", card: "#1C1C1E", tx: "#FFFFFF", tx2: "#98989D", txM: "#636366", sep: "#2C2C2E", ac: "#0A84FF", ok: "#30D158", okLt: "rgba(48,209,88,0.15)", warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.15)", bad: "#FF453A", badLt: "rgba(255,69,58,0.12)", cardBrd: "rgba(255,255,255,0.1)", cardSh: "none", nav: "#1C1C1E", navBrd: "rgba(255,255,255,0.1)", inp: "#2C2C2E", inpBrd: "rgba(255,255,255,0.1)" };
const Fn = "'IBM Plex Sans Arabic',-apple-system,'Segoe UI',sans-serif";

// ═══════ DATA ═══════
const BRANCHES = [
  { id: "jed", name: "جدة", count: 12, present: 10, pct: 88, radius: 150, lat: 21.5433, lng: 39.1728, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh" },
  { id: "riy", name: "الرياض", count: 8, present: 7, pct: 85, radius: 150, lat: 24.7136, lng: 46.6753, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh" },
  { id: "ist", name: "اسطنبول", count: 5, present: 4, pct: 82, radius: 200, lat: 41.0082, lng: 28.9784, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Europe/Istanbul" },
  { id: "gaz", name: "غازي عنتاب", count: 3, present: 3, pct: 95, radius: 120, lat: 37.0662, lng: 37.3833, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Europe/Istanbul" },
];
const EMPS = [
  { id: "E001", name: "أحمد محمد عسيري", role: "مهندس معماري", branch: "جدة", pct: 92, streak: 15, pts: 980, level: "🥇", status: "حاضر", checks: [1, 1, 1, 0], gps: true, violations: 0, warnings: 0, deductions: 0, salary: 15000 },
  { id: "E002", name: "خالد العتيبي", role: "مهندس مدني", branch: "الرياض", pct: 87, streak: 10, pts: 720, level: "🥇", status: "حاضر", checks: [1, 1, 0, 0], gps: true, violations: 2, warnings: 1, deductions: 200, salary: 13000 },
  { id: "E003", name: "سارة الحربي", role: "مهندسة تصميم", branch: "جدة", pct: 98, streak: 22, pts: 1450, level: "💎", status: "حاضر", checks: [1, 1, 1, 1], gps: true, violations: 0, warnings: 0, deductions: 0, salary: 13000 },
  { id: "E004", name: "فهد الدوسري", role: "مهندس إنشائي", branch: "جدة", pct: 65, streak: 0, pts: 210, level: "—", status: "غائب", checks: [0, 0, 0, 0], gps: false, violations: 5, warnings: 3, deductions: 1220, salary: 12000 },
  { id: "E005", name: "نورة القحطاني", role: "مهندسة كهربائية", branch: "الرياض", pct: 78, streak: 5, pts: 450, level: "🔵", status: "متأخر", checks: [1, 0, 0, 0], gps: true, violations: 2, warnings: 1, deductions: 200, salary: 11000 },
  { id: "E006", name: "عمر السبيعي", role: "مهندس ميكانيكي", branch: "اسطنبول", pct: 91, streak: 12, pts: 890, level: "🥇", status: "حاضر", checks: [1, 1, 1, 0], gps: true, violations: 0, warnings: 0, deductions: 0, salary: 10000 },
  { id: "E007", name: "ريم العنزي", role: "مهندسة معمارية", branch: "غازي عنتاب", pct: 95, streak: 18, pts: 1100, level: "💎", status: "حاضر", checks: [1, 1, 1, 0], gps: true, violations: 0, warnings: 0, deductions: 0, salary: 10000 },
  { id: "E008", name: "ماجد الحربي", role: "مهندس مساحة", branch: "جدة", pct: 45, streak: 0, pts: 90, level: "—", status: "غائب", checks: [0, 0, 0, 0], gps: false, violations: 3, warnings: 2, deductions: 800, salary: 9000 },
];
const LEAVE_INIT = [
  { id: 1, emp: "خالد العتيبي", type: "سنوية", from: "10/4", to: "14/4", days: 5, reason: "إجازة عائلية", status: "معلّق" },
  { id: 2, emp: "نورة القحطاني", type: "مرضية", from: "7/4", to: "8/4", days: 2, reason: "مراجعة طبية", status: "معلّق" },
  { id: 3, emp: "أحمد محمد", type: "سنوية", from: "20/4", to: "25/4", days: 6, reason: "سفر", status: "معلّق" },
];
const ALERTS = [
  { type: "danger", text: "فهد الدوسري — غائب بدون إذن (اليوم الثالث)", time: "08:35" },
  { type: "danger", text: "ماجد الحربي — لم يسجل حضوره", time: "08:32" },
  { type: "warn", text: "نورة القحطاني — تأخرت 25 دقيقة", time: "08:25" },
  { type: "ok", text: "سارة الحربي — أكملت 22 يوم متتالي ✓", time: "16:02" },
];
const WEEKLY = [{ d: "الأحد", p: 92 }, { d: "الإثنين", p: 88 }, { d: "الثلاثاء", p: 95 }, { d: "الأربعاء", p: 85 }, { d: "الخميس", p: 78 }];
const EVENTS = [
  { id: 1, name: "اليوم الوطني", emoji: "🇸🇦", date: "09-23", active: true, upgrade: true },
  { id: 2, name: "يوم التأسيس", emoji: "🏰", date: "02-22", active: true, upgrade: true },
  { id: 3, name: "رمضان", emoji: "🌙", date: "فترة", active: true, upgrade: false },
  { id: 4, name: "يوم العلم", emoji: "🏳️", date: "03-11", active: true, upgrade: false },
  { id: 5, name: "عيد الأم", emoji: "💐", date: "03-21", active: true, upgrade: false },
  { id: 6, name: "كأس العالم", emoji: "⚽", date: "فترة", active: true, upgrade: true },
];

function Logo({ s = 36 }) { const h = s/2, g = s*.02, r = s*.06, f = s*.28; return (<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={0} y={0} width={h-g} height={h-g} rx={r} fill={B.blue}/><rect x={h+g} y={0} width={h-g} height={h-g} rx={r} fill={B.yellow}/><rect x={0} y={h+g} width={h-g} height={h-g} rx={r} fill={B.red}/><rect x={h+g} y={h+g} width={h-g} height={h-g} rx={r} fill={B.black}/><text x={h*.5} y={h*.68} textAnchor="middle" fill="#fff" fontSize={f} fontWeight="900" fontFamily="Arial">H</text><text x={h*1.5+g} y={h*.68} textAnchor="middle" fill={B.black} fontSize={f} fontWeight="900" fontFamily="Arial">M</text><text x={h*.5} y={h*1.68+g} textAnchor="middle" fill="#fff" fontSize={f} fontWeight="900" fontFamily="Arial">A</text><text x={h*1.5+g} y={h*1.52+g} textAnchor="middle" fill="#fff" fontSize={f*.45} fontWeight="800" fontFamily="Arial">ENG</text></svg>); }
function Stripe() { return <div style={{ display: "flex", height: 4 }}><div style={{ flex: 1, background: B.blue }}/><div style={{ flex: 1, background: B.yellow }}/><div style={{ flex: 1, background: B.red }}/></div>; }
function Toggle({ on, onClick, t }) { var p = t || LT; return <button onClick={onClick} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: on ? p.ok : "#D1D5DB", position: "relative", transition: "all .3s" }}><div style={{ width: 16, height: 16, borderRadius: "50%", background: p.card, position: "absolute", top: 3, transition: "all .3s", ...(on ? { left: 21 } : { left: 3 }), boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} /></button>; }

// ═══════ MAP PICKER ═══════
function MapPicker({ lat, lng, radius, name, onSave, onClose, t }) {
  var mapRef = useRef(null);
  var mapInst = useRef(null);
  var markerRef = useRef(null);
  var circleRef = useRef(null);
  var _lat = useState(lat || 21.5433), curLat = _lat[0], setCurLat = _lat[1];
  var _lng = useState(lng || 39.1728), curLng = _lng[0], setCurLng = _lng[1];
  var _rad = useState(radius || 150), curRad = _rad[0], setCurRad = _rad[1];

  useEffect(function() {
    if (!mapRef.current || typeof L === "undefined") return;
    var map = L.map(mapRef.current, { zoomControl: true }).setView([curLat, curLng], curRad > 500 ? 14 : curRad > 200 ? 16 : 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    var marker = L.marker([curLat, curLng], { draggable: true }).addTo(map);
    var circle = L.circle([curLat, curLng], { radius: curRad, color: B.blue, fillColor: B.blue, fillOpacity: 0.15, weight: 2 }).addTo(map);
    marker.on("dragend", function() {
      var pos = marker.getLatLng();
      setCurLat(pos.lat);
      setCurLng(pos.lng);
      circle.setLatLng(pos);
    });
    map.on("click", function(e) {
      setCurLat(e.latlng.lat);
      setCurLng(e.latlng.lng);
      marker.setLatLng(e.latlng);
      circle.setLatLng(e.latlng);
    });
    mapInst.current = map;
    markerRef.current = marker;
    circleRef.current = circle;
    setTimeout(function() { map.invalidateSize(); }, 200);
    return function() { map.remove(); };
  }, []);

  useEffect(function() {
    if (circleRef.current) circleRef.current.setRadius(curRad);
  }, [curRad]);

  var radLabels = curRad < 100 ? curRad + " م" : (curRad / 1000).toFixed(curRad >= 1000 ? 1 : 2) + " كم";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, direction: "rtl" }}>
      <div style={{ background: t.card, borderRadius: 20, width: "90%", maxWidth: 700, maxHeight: "90vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.tx }}>📍 تحديد موقع — {name}</div>
            <div style={{ fontSize: 11, color: t.txM, marginTop: 2 }}>اضغط على الخريطة أو اسحب العلامة لتحديد الموقع</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: t.txM, cursor: "pointer" }}>✕</button>
        </div>

        {/* Map */}
        <div ref={mapRef} style={{ width: "100%", height: 380 }} />

        {/* Controls */}
        <div style={{ padding: "16px 20px" }}>
          {/* Coordinates display */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, background: t.bg, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: t.txM }}>خط العرض</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, fontFamily: "monospace" }}>{curLat.toFixed(6)}</div>
            </div>
            <div style={{ flex: 1, background: t.bg, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: t.txM }}>خط الطول</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, fontFamily: "monospace" }}>{curLng.toFixed(6)}</div>
            </div>
            <div style={{ flex: 1, background: t.bg, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: t.txM }}>النطاق</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.blue }}>{radLabels}</div>
            </div>
          </div>

          {/* Radius slider */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.tx, marginBottom: 6 }}>نطاق التغطية: {radLabels}</div>
            <input type="range" min="10" max="2000" step="10" value={curRad} onChange={function(e) { setCurRad(parseInt(e.target.value)); }} style={{ width: "100%", accentColor: B.blue }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.txM }}><span>10 م</span><span>500 م</span><span>1 كم</span><span>2 كم</span></div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={function() { onSave(curLat, curLng, curRad); }} style={{ flex: 1, padding: "12px", borderRadius: 12, background: B.blue, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>💾 حفظ الموقع</button>
            <button onClick={onClose} style={{ padding: "12px 20px", borderRadius: 12, background: t.bg, color: t.txM, fontSize: 14, fontWeight: 600, border: "1px solid " + t.sep, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════ LOGIN ═══════
function Login({ onLogin }) {
  var dk = localStorage.getItem("basma_theme") === "dark";
  var t = dk ? DK : LT;
  const [email, setEmail] = useState(function(){ return localStorage.getItem("basma_admin_email") || ""; });
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupPass2, setSetupPass2] = useState("");

  // Check if admin is configured
  useEffect(function() {
    fetch("/api/data?action=admin-config").then(r => r.json()).then(function(d) {
      if (d && !d.exists) setSetupMode(true);
      setSetupChecked(true);
    }).catch(function(){ setSetupChecked(true); });
  }, []);

  async function doLogin() {
    setErr("");
    if (!email || !password) { setErr("أدخل البريد وكلمة المرور"); return; }
    setBusy(true);
    try {
      var r = await fetch("/api/data?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password: password }),
      });
      var d = await r.json();
      if (d.ok && d.employee && (d.employee.isGeneralManager || d.employee.isAdmin)) {
        localStorage.setItem("basma_admin_email", email.toLowerCase().trim());
        onLogin("manager");
      } else if (d.ok) {
        setErr("هذا الحساب ليس مدير عام");
      } else {
        setErr(d.error || "خطأ في الدخول");
      }
    } catch(e) { setErr("خطأ في الاتصال"); }
    setBusy(false);
  }

  async function doSetup() {
    setErr("");
    if (!setupEmail || !setupPass || !setupName) { setErr("جميع الحقول مطلوبة"); return; }
    if (setupPass !== setupPass2) { setErr("كلمتا المرور غير متطابقتين"); return; }
    if (setupPass.length < 6) { setErr("كلمة المرور 6 أحرف على الأقل"); return; }
    setBusy(true);
    try {
      var r = await fetch("/api/data?action=admin-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: setupEmail.toLowerCase().trim(), password: setupPass, name: setupName }),
      });
      var d = await r.json();
      if (d.ok) {
        alert("✓ تم إنشاء حساب المدير العام بنجاح");
        setSetupMode(false);
        setEmail(setupEmail.toLowerCase().trim());
      } else {
        setErr(d.error || "فشل إنشاء الحساب");
      }
    } catch(e) { setErr("خطأ في الاتصال"); }
    setBusy(false);
  }

  var inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 14, fontFamily: Fn, outline: "none", background: t.inp, color: t.tx, marginBottom: 10 };

  if (!setupChecked) {
    return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: Fn, color: t.txM, fontSize: 14 }}>جارِ التحميل...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: Fn, direction: "rtl" }}>
      <div style={{ background: t.card, borderRadius: 24, padding: "36px 28px", width: 400, textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,.08)" }}>
        <Logo s={56} />
        <div style={{ fontSize: 20, fontWeight: 800, color: B.blue, marginTop: 10 }}>{APP}</div>
        <div style={{ fontSize: 12, color: t.txM, marginTop: 4 }}>لوحة إدارة الموارد البشرية</div>
        <Stripe />

        {setupMode ? (
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <div style={{ background: B.blue + "12", border: "1px solid " + B.blue + "40", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
              🔐 <strong>إعداد أول استخدام</strong><br/>
              أنشئ حساب المدير العام — يُستخدم للدخول للوحة الإدارة. يمكن تعديله لاحقاً.
            </div>
            <input value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="الاسم الكامل" style={inputStyle} />
            <input value={setupEmail} onChange={e => setSetupEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={inputStyle} />
            <input value={setupPass} onChange={e => setSetupPass(e.target.value)} placeholder="كلمة المرور (6+ أحرف)" type="password" style={inputStyle} />
            <input value={setupPass2} onChange={e => setSetupPass2(e.target.value)} placeholder="تأكيد كلمة المرور" type="password" style={inputStyle} />
            {err && <div style={{ color: "#FF3B30", fontSize: 12, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{err}</div>}
            <button onClick={doSetup} disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 12, background: busy ? t.sep : B.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
              {busy ? "جارِ الحفظ..." : "إنشاء الحساب"}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" style={inputStyle} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" style={inputStyle} onKeyDown={e => e.key === "Enter" && doLogin()} />
            {err && <div style={{ color: "#FF3B30", fontSize: 12, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{err}</div>}
            <button onClick={doLogin} disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 12, background: busy ? t.sep : B.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
              {busy ? "جارِ الدخول..." : "دخول المدير العام"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════ MAIN DASHBOARD ═══════
const API = '/api/data';
const api = async (action, method = 'GET', body = null, params = '') => {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${API}?action=${action}${params}`, opts);
    return await r.json();
  } catch { return null; }
};

export default function AdminApp() {
  const [dk, setDk] = useState(() => localStorage.getItem("basma_theme") === "dark");
  const t = dk ? DK : LT;
  const toggleTheme = () => { setDk(v => { const n = !v; localStorage.setItem("basma_theme", n ? "dark" : "light"); return n; }); };
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState("manager");
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState(LEAVE_INIT);
  const [search, setSearch] = useState("");
  const [brFilter, setBrFilter] = useState("all");
  const [hrQuestions, setHrQuestions] = useState([]);
  const [newQ, setNewQ] = useState({ type: "ذكر", q: "", correct: "", wrong1: "", wrong2: "" });
  const [selEmp, setSelEmp] = useState(null);
  const [events, setEvents] = useState(EVENTS);
  const eventsLoaded = useRef(false);

  // Auto-save events to DB (only after initial load)
  useEffect(function() {
    if (!eventsLoaded.current) return;
    try {
      fetch("/api/data?action=events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(events) }).catch(function(){});
    } catch(e) {}
  }, [events]);
  const [branches, setBranches] = useState(BRANCHES);
  const [emps, setEmps] = useState(EMPS);
  const [mapTarget, setMapTarget] = useState(null);
  const [settingsTab, setSettingsTab] = useState("general");
  const [badgeCounts, setBadgeCounts] = useState({ complaints: 0, investigations: 0, appeals: 0, violations: 0 });

  // Load badge counts
  useEffect(function() {
    async function loadBadges() {
      try {
        var [c, inv, app, vio] = await Promise.all([
          fetch("/api/data?action=complaints").then(r => r.json()),
          fetch("/api/data?action=investigations").then(r => r.json()),
          fetch("/api/data?action=appeals").then(r => r.json()),
          fetch("/api/data?action=violations_v2").then(r => r.json()),
        ]);
        setBadgeCounts({
          complaints: (c || []).filter(x => x.status === "PENDING_HR").length,
          investigations: (inv || []).filter(x => x.status === "RESPONSE_RECEIVED").length,
          appeals: (app || []).filter(x => x.status === "PENDING").length,
          violations: (vio || []).filter(x => x.status === "ACTIVE").length,
        });
      } catch(e) {}
    }
    loadBadges();
    var interval = setInterval(loadBadges, 30000);
    return function() { clearInterval(interval); };
  }, []);
  const [emailLists, setEmailLists] = useState([
    { id: 1, name: "الموارد البشرية", email: "hr@hma.engineer", color: B.blue },
    { id: 2, name: "الشؤون القانونية", email: "legal@hma.engineer", color: t.bad },
    { id: 3, name: "الإدارة العليا", email: "management@hma.engineer", color: B.gold },
  ]);
  const [docRouting, setDocRouting] = useState([
    { label: "إنذار رسمي", icon: "📋", enabled: true, targets: [1] },
    { label: "شكوى وتظلم", icon: "📝", enabled: true, targets: [1, 2] },
    { label: "رد على إفادة", icon: "💬", enabled: true, targets: [1, 2] },
    { label: "اعتماد/رفض إجازة", icon: "🏖", enabled: true, targets: [1] },
    { label: "إفصاح صحي", icon: "🏥", enabled: true, targets: [1] },
    { label: "تذكرة دعم عامة", icon: "🎫", enabled: false, targets: [1] },
    { label: "تقرير شهري", icon: "📄", enabled: false, targets: [] },
  ]);
  const [empOverrides, setEmpOverrides] = useState([
    { id: 1, name: "فهد الدوسري", empId: "E004", targets: [1, 2, 3] },
  ]);
  const [observed, setObserved] = useState([
    { id: 1, name: "ماجد الحربي", empId: "E008", role: "مهندس مساحة", reason: "مخالفات متكررة + شكاوى سابقة", addedBy: "مدير الموارد البشرية", date: "2026-03-20", duration: "حتى إشعار آخر" },
  ]);

  // ═══ LOAD ALL DATA FROM API ═══
  useEffect(() => {
    (async () => {
      try {
        var [brData, empData, evData, lvData, stData] = await Promise.all([
          api('branches'), api('employees'), api('events'), api('leaves'), api('settings')
        ]);
        if (Array.isArray(brData) && brData.length > 0) setBranches(brData);
        if (Array.isArray(empData) && empData.length > 0) {
          // Try to enrich with today's attendance
          try {
            var today = new Date().toISOString().split('T')[0];
            var todayAtt = await api('attendance', 'GET', null, '&date=' + today);
            var attArr = Array.isArray(todayAtt) ? todayAtt : [];
            var enriched = empData.map(function(emp) {
              var checkin = attArr.find(function(a){ return a.empId === emp.id && a.type === 'checkin'; });
              var status = checkin ? 'حاضر' : 'غائب';
              if (checkin) {
                var br = (Array.isArray(brData) ? brData : BRANCHES).find(function(b){ return b.id === emp.branch || b.name === emp.branch; });
                if (br && br.start) {
                  try {
                    var parts = br.start.split(':');
                    var startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    var cMin = new Date(checkin.ts).getHours() * 60 + new Date(checkin.ts).getMinutes();
                    if (cMin > startMin + 5) status = 'متأخر';
                  } catch(e2) {}
                }
              }
              if (emp.onLeave) status = 'إجازة';
              if (emp.terminated) status = 'منتهي';
              return Object.assign({}, emp, { status: status, pct: emp.pct || 0, points: emp.points || 0 });
            });
            setEmps(enriched);
          } catch(e) {
            // Fallback: use employees without enrichment
            setEmps(empData);
          }
        }
        if (Array.isArray(evData) && evData.length > 0) setEvents(evData);
        eventsLoaded.current = true;
        if (Array.isArray(lvData)) setLeaves(lvData);
        if (stData && typeof stData === 'object' && !stData.error) {
          if (stData.emailLists) setEmailLists(stData.emailLists);
          if (stData.docRouting) setDocRouting(stData.docRouting);
          if (stData.empOverrides) setEmpOverrides(stData.empOverrides);
          if (stData.observed) setObserved(stData.observed);
          if (Array.isArray(stData.questions)) setHrQuestions(stData.questions);
        }
      } catch(e) { console.error("Load error:", e); }
      setLoading(false);
    })();
  }, []);

  // ═══ SAVE HELPERS (with await + confirmation) ═══
  var saveBranches = async function(newBranches) { setBranches(newBranches); var r = await api('branches', 'PUT', newBranches); if (!r || r.error) console.error("Branch save failed:", r); };
  var saveSettings = async function(updates) {
    // Load current settings from server first to avoid stale data
    var serverSettings = await api('settings') || {};
    var merged = Object.assign({}, serverSettings, updates);
    var r = await api('settings', 'PUT', merged);
    if (!r || r.error) { console.error("Settings save failed:", r); return; }
    if (updates.emailLists) setEmailLists(updates.emailLists);
    if (updates.docRouting) setDocRouting(updates.docRouting);
    if (updates.empOverrides) setEmpOverrides(updates.empOverrides);
    if (updates.observed) setObserved(updates.observed);
    if (updates.questions !== undefined) setHrQuestions(updates.questions);
  };
  var saveEvent = async function(ev) { await api('events', 'POST', ev); var evs = await api('events'); if (Array.isArray(evs)) setEvents(evs); };
  var deleteEvent = async function(id) { await api('events', 'DELETE', null, '&id=' + id); var evs = await api('events'); if (Array.isArray(evs)) setEvents(evs); };
  var approveLeave = async function(id) { await api('leaves', 'PUT', { id, status: 'approved' }); var lvs = await api('leaves'); if (Array.isArray(lvs)) setLeaves(lvs); };
  var rejectLeave = async function(id) { await api('leaves', 'PUT', { id, status: 'rejected' }); var lvs = await api('leaves'); if (Array.isArray(lvs)) setLeaves(lvs); };

  if (!loggedIn) return <Login onLogin={r => { setRole(r); setLoggedIn(true); }} />;
  if (loading) return <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: Fn, direction: "rtl" }}><div style={{ textAlign: "center" }}><div style={{ width: 32, height: 32, border: "3px solid " + t.sep, borderTopColor: B.blue, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto" }} /><div style={{ fontSize: 13, color: t.txM, marginTop: 12 }}>جارِ تحميل البيانات...</div></div><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;

  var formatReport = function(r, label) {
    var html = "<div style='padding:14px'>" +
      "<div style='font-size:14px;font-weight:700;margin-bottom:8px'>📊 التقرير ال" + label + " — " + r.from + " إلى " + r.to + "</div>" +
      "<div style='display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:12px'>" +
      "<div style='text-align:center;padding:8px;border-radius:8px;background:#0A84FF15'><div style='font-size:18px;font-weight:800;color:#0A84FF'>" + r.totalEmployees + "</div><div style='font-size:8px;color:#8E8E93'>موظف</div></div>" +
      "<div style='text-align:center;padding:8px;border-radius:8px;background:#30D15815'><div style='font-size:18px;font-weight:800;color:#30D158'>" + r.totalAttendance + "</div><div style='font-size:8px;color:#8E8E93'>بصمة</div></div>" +
      "<div style='text-align:center;padding:8px;border-radius:8px;background:#FF9F0A15'><div style='font-size:18px;font-weight:800;color:#FF9F0A'>" + r.totalViolations + "</div><div style='font-size:8px;color:#8E8E93'>مخالفة</div></div>" +
      "<div style='text-align:center;padding:8px;border-radius:8px;background:#FF3B3015'><div style='font-size:18px;font-weight:800;color:#FF3B30'>" + r.pendingWarnings + "</div><div style='font-size:8px;color:#8E8E93'>إنذار معلّق</div></div></div>";
    if (r.employees && r.employees.length > 0) {
      html += "<table style='width:100%;border-collapse:collapse;font-size:10px'><tr style='background:#F8F9FA'><th style='padding:6px;text-align:right'>الموظف</th><th>حضور</th><th>تأخر</th><th>غياب</th><th>مخالفات</th><th>إنذارات</th></tr>";
      r.employees.forEach(function(e) {
        var rc = e.violationCount > 0 ? "#FFF5F5" : "#FFFFFF";
        html += "<tr style='background:" + rc + ";border-bottom:1px solid #F0F0F0'><td style='padding:5px;font-weight:600'>" + e.name + "</td><td style='text-align:center;color:#30D158;font-weight:700'>" + e.daysPresent + "</td><td style='text-align:center;color:#FF9F0A'>" + e.lateCount + "</td><td style='text-align:center;color:#FF3B30'>" + e.absentCount + "</td><td style='text-align:center'>" + e.violationCount + "</td><td style='text-align:center'>" + e.warningCount + "</td></tr>";
      });
      html += "</table>";
    }
    html += "<div style='margin-top:8px;font-size:9px;color:#8E8E93'>تم الإنشاء: " + new Date(r.generatedAt).toLocaleString("ar-SA") + "</div></div>";
    return html;
  };

  const approve = id => role === "manager" && setLeaves(l => l.map(x => x.id === id ? { ...x, status: "معتمد" } : x));
  // Normalize employee data (API data may lack mock properties)
  var normalizeEmp = function(e) {
    return Object.assign({ status: "—", pct: 0, streak: 0, pts: 0, level: "🔹", violations: 0, warnings: 0, deductions: 0, salary: 0, checks: [0,0,0,0], gps: false, branch: "—" }, e);
  };
  var safeEmps = emps.map(normalizeEmp);

  const reject = id => role === "manager" && setLeaves(l => l.map(x => x.id === id ? { ...x, status: "مرفوض" } : x));
  const pending = leaves.filter(l => l.status === "معلّق" || l.status === "pending").length;
  const present = safeEmps.filter(e => e.status === "حاضر").length;
  const absent = safeEmps.filter(e => e.status === "غائب").length;
  const late = safeEmps.filter(e => e.status === "متأخر").length;

  const filteredEmps = safeEmps.filter(e => {
    if (brFilter !== "all" && e.branch !== brFilter) return false;
    if (search && !e.name.includes(search) && !e.id.includes(search.toUpperCase())) return false;
    return true;
  });

  const sideItems = [
    { id: "dashboard", icon: "📊", label: "الرئيسية" },
    { id: "employees", icon: "👥", label: "الموظفين" },
    { id: "leaves", icon: "📋", label: "الإجازات", badge: pending },
    { id: "admin_requests", icon: "📝", label: "الطلبات" },
    { id: "complaints", icon: "📣", label: "الشكاوى (HR)", badge: badgeCounts.complaints },
    { id: "investigations", icon: "🔍", label: "التحقيقات (HR)", badge: badgeCounts.investigations },
    { id: "violations_v2", icon: "⚖️", label: "المخالفات الرسمية", badge: badgeCounts.violations },
    { id: "appeals", icon: "📢", label: "التظلمات", badge: badgeCounts.appeals },
    { id: "laiha", icon: "📜", label: "لائحة العمل" },
    { id: "custody_admin", icon: "📦", label: "العهد" },
    { id: "tracking", icon: "🛰️", label: "تتبّع الحركة" },
    { id: "termination", icon: "🚪", label: "إنهاء خدمات" },
    { id: "geofence", icon: "📍", label: "النطاق الجغرافي" },
    { id: "reports", icon: "📄", label: "التقارير" },
    { id: "events", icon: "🎉", label: "المناسبات" },
    { id: "questions", icon: "❓", label: "أسئلة الصباح" },
    { id: "settings", icon: "⚙️", label: "الإعدادات" },
  ];

  return (<div style={{ direction: "rtl", fontFamily: Fn, display: "flex", minHeight: "100vh", background: t.bg }}>
    <style>{`button:active{transform:scale(.97)!important} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}`}</style>

    {/* Sidebar */}
    <div style={{ width: 220, background: t.card, borderLeft: "1px solid " + t.sep, display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginBottom: 6 }}><Logo s={30} /><div><div style={{ fontSize: 14, fontWeight: 800, color: B.blue }}>{APP}</div><div style={{ fontSize: 8, color: t.txM }}>لوحة الإدارة</div></div></div>
      <Stripe />
      <div style={{ flex: 1, padding: "10px 8px" }}>
        {sideItems.map(item => { const a = tab === item.id; return (<button key={item.id} onClick={() => { setTab(item.id); setSelEmp(null); }} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", marginBottom: 2, background: a ? B.blueLt : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, filter: a ? "none" : "grayscale(.5) opacity(.6)" }}>{item.icon}</span>
          <span style={{ fontSize: 12, fontWeight: a ? 700 : 500, color: a ? B.blue : t.tx2, flex: 1, textAlign: "right" }}>{item.label}</span>
          {item.badge > 0 && <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.bad, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</div>}
        </button>); })}
      </div>
      <div style={{ padding: "8px 16px", borderTop: "1px solid " + t.sep }}>
        <button onClick={toggleTheme} style={{ width: "100%", padding: "8px", borderRadius: 8, background: dk ? "#2C2C2E" : "#E5E5EA", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>{dk ? "☀️" : "🌙"}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.tx2 }}>{dk ? "الوضع النهاري" : "الوضع الليلي"}</span>
        </button>
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid " + t.sep }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: B.blueLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div><div><div style={{ fontSize: 11, fontWeight: 700 }}>{role === "manager" ? "مدير HR" : "مساعد"}</div><div style={{ fontSize: 9, color: t.txM }}>{role === "manager" ? "صلاحيات كاملة" : "عرض وتدقيق"}</div></div></div>
        <button onClick={() => { setLoggedIn(false); }} style={{ width: "100%", marginTop: 8, padding: "6px", borderRadius: 6, background: t.badLt, border: "none", color: t.bad, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>خروج</button>
      </div>
    </div>

    {/* Main */}
    <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: t.tx }}>{sideItems.find(s => s.id === tab)?.icon} {sideItems.find(s => s.id === tab)?.label}</div><div style={{ fontSize: 11, color: t.txM }}>الأحد، 6 أبريل 2026</div></div>
        {role === "assistant" && <div style={{ padding: "5px 12px", borderRadius: 8, background: t.warnLt, fontSize: 11, fontWeight: 700, color: t.warn }}>⚠️ وضع المساعد</div>}
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {tab === "dashboard" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {[{ l: "حاضر", v: present, i: "✅", c: t.ok, s: `من ${safeEmps.length}` }, { l: "غائب", v: absent, i: "🚫", c: t.bad }, { l: "متأخر", v: late, i: "⏰", c: t.warn }, { l: "طلبات معلّقة", v: pending, i: "📋", c: B.blue }].map((s, i) => <div key={i} style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 11, color: t.txM }}>{s.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.c, marginTop: 4 }}>{s.v}</div>{s.s && <div style={{ fontSize: 10, color: t.txM }}>{s.s}</div>}</div><div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.c}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.i}</div></div></div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>⚡ يحتاج إجراء</div>{ALERTS.map((a, i) => <div key={i} style={{ padding: "8px 10px", borderRadius: 10, marginBottom: 6, background: a.type === "danger" ? t.badLt : a.type === "warn" ? t.warnLt : t.okLt, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>{a.type === "danger" ? "🚨" : a.type === "warn" ? "⚠️" : "🏆"}</span><span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{a.text}</span><span style={{ fontSize: 9, color: t.txM }}>{a.time}</span></div>)}</div>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 أداء الفروع</div>{BRANCHES.map((b, i) => { const pc = b.pct >= 90 ? t.ok : b.pct >= 75 ? t.warn : t.bad; return <div key={i} style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{b.name}</span><span style={{ fontWeight: 800, color: pc }}>{b.pct}%</span></div><div style={{ height: 6, borderRadius: 3, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", width: `${b.pct}%`, borderRadius: 3, background: pc }} /></div></div>; })}<div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📈 الأسبوع</div><div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>{WEEKLY.map((d, i) => { const pc = d.p >= 90 ? t.ok : d.p >= 80 ? B.blue : t.warn; return <div key={i} style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 9, fontWeight: 700, color: pc }}>{d.p}%</div><div style={{ height: d.p * .7, borderRadius: 4, background: pc, minHeight: 6 }} /><div style={{ fontSize: 8, color: t.txM, marginTop: 3 }}>{d.d}</div></div>; })}</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, color: t.ok, marginBottom: 10 }}>🏆 الأكثر انضباطاً</div>{[...safeEmps].sort((a, b) => b.pct - a.pct).slice(0, 3).map((e, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 2 ? "1px solid " + t.sep : "none" }}><span style={{ fontSize: 16 }}>{["🥇", "🥈", "🥉"][i]}</span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div></div><span style={{ fontSize: 13, fontWeight: 800, color: t.ok }}>{e.pct}%</span></div>)}</div>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, color: t.bad, marginBottom: 10 }}>⚠️ يحتاج متابعة</div>{[...safeEmps].sort((a, b) => a.pct - b.pct).slice(0, 3).map((e, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 2 ? "1px solid " + t.sep : "none" }}><div style={{ width: 24, height: 24, borderRadius: "50%", background: t.badLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: t.bad }}>{i + 1}</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div></div><span style={{ fontSize: 13, fontWeight: 800, color: t.bad }}>{e.pct}%</span></div>)}</div>
        </div>
        {/* HR Legal Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 }}>
          {[
            { l: "شكاوى معلقة", v: badgeCounts.complaints, i: "📣", c: B.gold },
            { l: "تحقيقات (بالرد)", v: badgeCounts.investigations, i: "🔍", c: B.blue },
            { l: "مخالفات سارية", v: badgeCounts.violations, i: "⚖️", c: t.bad },
            { l: "تظلمات معلقة", v: badgeCounts.appeals, i: "📢", c: "#F97316" },
          ].map(function(s, i) { return <div key={i} onClick={function(){ setTab(["complaints","investigations","violations_v2","appeals"][i]); }} style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 11, color: t.txM }}>{s.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.c, marginTop: 4 }}>{s.v}</div></div><div style={{ width: 40, height: 40, borderRadius: 10, background: s.c + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.i}</div></div></div>; })}
        </div>
      </>}

      {/* ═══ EMPLOYEES ═══ */}
      {tab === "employees" && !selEmp && <>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 13, outline: "none", background: t.card }} />
          <select value={brFilter} onChange={e => setBrFilter(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: t.card, fontWeight: 600, cursor: "pointer" }}><option value="all">كل الفروع</option>{BRANCHES.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
        </div>
        <div style={{ background: t.card, borderRadius: 14, border: "1px solid " + t.sep, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: "#F8FAFC" }}>{["الموظف", "الفرع", "الحالة", "الالتزام", "السلسلة", "المستوى", "المخالفات", "البصمات"].map((h, i) => <th key={i} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: t.txM, textAlign: "right", borderBottom: "1px solid " + t.sep }}>{h}</th>)}</tr></thead>
          <tbody>{filteredEmps.map(e => { const sc = e.status === "حاضر" ? t.ok : e.status === "متأخر" ? t.warn : t.bad; const pc = e.pct >= 85 ? t.ok : e.pct >= 70 ? t.warn : t.bad; return (<tr key={e.id} onClick={() => setSelEmp(e)} style={{ cursor: "pointer" }} onMouseEnter={ev => ev.currentTarget.style.background = "#F8FAFC"} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
            <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: `${sc}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div><div><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 9, color: t.txM }}>{e.role} · {e.id}</div></div></div></td>
            <td style={td}><span style={{ fontSize: 11 }}>{e.branch}</span></td>
            <td style={td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${sc}15`, color: sc }}>{e.status}</span></td>
            <td style={td}><span style={{ fontSize: 13, fontWeight: 800, color: pc }}>{e.pct}%</span></td>
            <td style={td}><span style={{ fontSize: 11 }}>🔥 {e.streak}</span></td>
            <td style={td}><span style={{ fontSize: 14 }}>{e.level}</span></td>
            <td style={td}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: e.violations > 0 ? t.badLt : t.okLt, color: e.violations > 0 ? t.bad : t.ok }}>{e.violations}</span></td>
            <td style={td}><div style={{ display: "flex", gap: 2 }}>{e.checks.map((c, i) => <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: c ? t.okLt : t.badLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>{c ? "✓" : "✕"}</div>)}</div></td>
          </tr>); })}</tbody></table>
        </div>
      </>}
      {tab === "employees" && selEmp && <>
        <button onClick={() => setSelEmp(null)} style={{ background: "none", border: "none", fontSize: 13, color: B.blue, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>→ رجوع للقائمة</button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <div style={{ background: t.card, borderRadius: 14, padding: "20px", border: "1px solid " + t.sep, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${((selEmp.status||"—") === "حاضر" ? t.ok : (selEmp.status||"—") === "متأخر" ? t.warn : t.bad)}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 10px", border: `3px solid ${(selEmp.status||"—") === "حاضر" ? t.ok : (selEmp.status||"—") === "متأخر" ? t.warn : t.bad}` }}>👤</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{selEmp.name}</div><div style={{ fontSize: 11, color: t.txM }}>{selEmp.role} — {selEmp.id}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 14 }}>{[{ l: "التزام", v: `${((selEmp.pct)||0)}%`, c: ((selEmp.pct)||0) >= 85 ? t.ok : t.warn }, { l: "السلسلة", v: `🔥${(selEmp.streak||0)}`, c: "#FF6B35" }, { l: "النقاط", v: (selEmp.pts||0), c: B.gold }].map((x, i) => <div key={i} style={{ background: t.bg, borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 14, fontWeight: 800, color: x.c }}>{x.v}</div><div style={{ fontSize: 8, color: t.txM, marginTop: 2 }}>{x.l}</div></div>)}</div>
            <div style={{ marginTop: 10, fontSize: 11, color: selEmp.gps ? t.ok : t.bad, fontWeight: 600 }}>{selEmp.gps ? "📍 في النطاق" : "📍 خارج النطاق"}</div>
          </div>
          <div><div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>بصمات اليوم</div><div style={{ display: "flex", gap: 10 }}>{["☀️ حضور", "☕ استراحة", "🔄 عودة", "🌙 انصراف"].map((l, i) => <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: ((selEmp.checks||[0,0,0,0])[i]) ? t.okLt : t.badLt }}><div style={{ fontSize: 18 }}>{((selEmp.checks||[0,0,0,0])[i]) ? "✅" : "❌"}</div><div style={{ fontSize: 9, color: t.tx2, marginTop: 3 }}>{l}</div></div>)}</div></div>
            <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>إجراءات</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={actBtn}>📊 تقرير</button><button style={{ ...actBtn, background: t.warnLt, color: t.warn }}>⚠️ إنذار</button>{role === "manager" && <button style={{ ...actBtn, background: t.badLt, color: t.bad }}>🗑 حذف</button>}<button style={{ ...actBtn, background: t.okLt, color: t.ok }}>📤 تصدير لكوادر</button></div><div style={{ marginTop: 10, padding: "10px", borderRadius: 8, background: B.blueLt, fontSize: 11, fontWeight: 600, color: B.blue }}>النسبة المُصدّرة لكوادر: <strong>{((selEmp.pct)||0)}%</strong></div></div></div>
        </div>
      </>}

      {/* ═══ LEAVES ═══ */}
      {tab === "leaves" && <>
        {leaves.map(l => { const sc = l.status === "معلّق" ? t.warn : l.status === "معتمد" ? t.ok : t.bad; return <div key={l.id} style={{ background: t.card, borderRadius: 14, padding: "16px 18px", border: "1px solid " + t.sep, marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${sc}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{l.status === "معلّق" ? "⏳" : l.status === "معتمد" ? "✅" : "❌"}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{l.emp}</div><div style={{ fontSize: 11, color: t.tx2, marginTop: 2 }}>{l.type} · {l.days} أيام · {l.from} → {l.to}</div>{l.reason && <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>{l.reason}</div>}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${sc}15`, color: sc }}>{l.status}</span>
            {l.status === "معلّق" && role === "manager" && <div style={{ display: "flex", gap: 4 }}><button onClick={() => approve(l.id)} style={{ padding: "5px 10px", borderRadius: 6, background: t.ok, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>اعتماد</button><button onClick={() => reject(l.id)} style={{ padding: "5px 10px", borderRadius: 6, background: t.bad, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>رفض</button></div>}
            {l.status === "معلّق" && role === "assistant" && <span style={{ fontSize: 9, color: t.txM }}>بانتظار المدير</span>}
          </div>
        </div>; })}
      </>}

      {/* ═══ ADMIN REQUESTS ═══ */}
      {tab === "admin_requests" && <>
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>📝 طلبات الموظفين</div><div style={{ fontSize: 11, color: t.txM, marginTop: 2 }}>شهادات خبرة، خطابات تعريف، سلف، تعويضات</div></div>
            <button onClick={async function() {
              var reqs = await api("requests") || [];
              if (!Array.isArray(reqs)) reqs = [];
              var el = document.getElementById("admin-requests-list");
              if (reqs.length === 0) { el.innerHTML = "<div style='text-align:center;padding:20px;color:#8E8E93'>لا توجد طلبات</div>"; return; }
              var types = { experience_letter: "📄 شهادة خبرة", intro_letter: "📋 خطاب تعريف", salary_cert: "💰 شهادة راتب", advance: "💵 سلفة", compensation: "⏰ تعويض", overtime: "🕐 أوفرتايم", device_change: "📱 تغيير جهاز", other: "📝 أخرى" };
              var html = reqs.sort(function(a,b) { return (b.ts||"").localeCompare(a.ts||""); }).map(function(r) {
                var sc = r.status === "approved" ? "#30D158" : r.status === "rejected" ? "#FF3B30" : "#FF9F0A";
                var sl = r.status === "approved" ? "مُوافق" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة";
                return "<div style='padding:12px;border-radius:10px;background:#F8F9FA;margin-bottom:8px;border:1px solid #E5E5EA' id='req-" + r.id + "'>" +
                  "<div style='display:flex;justify-content:space-between;align-items:center'>" +
                  "<div><div style='font-size:13px;font-weight:700'>" + (r.empName || r.empId) + "</div>" +
                  "<div style='font-size:11px;color:#6E6E73'>" + (types[r.type] || r.type) + "</div></div>" +
                  "<span style='padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;background:" + sc + "15;color:" + sc + "'>" + sl + "</span></div>" +
                  "<div style='font-size:11px;color:#3C3C43;margin-top:6px'>" + (r.note || "") + "</div>" +
                  "<div style='font-size:9px;color:#8E8E93;margin-top:4px'>" + (r.ts ? new Date(r.ts).toLocaleString("ar-SA") : "") + "</div>" +
                  (r.status === "pending" ? "<div style='display:flex;gap:6px;margin-top:8px'>" +
                    "<button onclick='approveReq(\"" + r.id + "\")' style='flex:1;padding:7px;border-radius:8px;background:#30D158;color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer'>✅ موافقة</button>" +
                    "<button onclick='rejectReq(\"" + r.id + "\")' style='flex:1;padding:7px;border-radius:8px;background:#FF3B30;color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer'>❌ رفض</button></div>" : "") +
                  "</div>";
              }).join("");
              el.innerHTML = html;
              // Add global functions for approve/reject
              window.approveReq = async function(id) {
                var reply = prompt("رد الإدارة (اختياري):");
                await fetch("/api/data?action=requests", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id: id, status: "approved", adminReply: reply || "تمت الموافقة" }) });
                document.getElementById("req-" + id).style.opacity = "0.5";
                alert("✅ تمت الموافقة");
              };
              window.rejectReq = async function(id) {
                var reply = prompt("سبب الرفض:");
                if (!reply) return;
                await fetch("/api/data?action=requests", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id: id, status: "rejected", adminReply: reply }) });
                document.getElementById("req-" + id).style.opacity = "0.5";
                alert("تم الرفض");
              };
            }} style={{ padding: "8px 16px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>🔄 تحديث</button>
          </div>
          <div id="admin-requests-list"><div style={{ textAlign: "center", padding: 12, color: t.txM, fontSize: 11 }}>اضغط "تحديث" لعرض الطلبات</div></div>
        </div>
      </>}

      {/* ═══ VIOLATIONS ═══ */}
      {/* ═══ TERMINATION ═══ */}
      {tab === "termination" && <>
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🚪 إنهاء خدمات موظف</div>
          <div style={{ fontSize: 11, color: t.txM, marginBottom: 12 }}>يتم تعطيل حساب الموظف فوراً مع بدء إجراءات التسليم والتصفية</div>
          <select id="term-emp" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, marginBottom: 8, background: t.inp, color: t.tx }}>{safeEmps.map(function(e) { return <option key={e.id} value={e.id}>{e.name} ({e.id})</option>; })}</select>
          <select id="term-reason" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, marginBottom: 8, background: t.inp, color: t.tx }}>
            <option value="resignation">استقالة</option><option value="termination">فصل</option><option value="contract_end">انتهاء عقد</option><option value="retirement">تقاعد</option>
          </select>
          <textarea id="term-notes" placeholder="ملاحظات إضافية..." rows="2" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, marginBottom: 8, background: t.inp, color: t.tx, resize: "none", fontFamily: Fn }} />
          <div style={{ background: t.warnLt, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 10, color: "#92400E" }}>⚠️ هذا الإجراء يعطّل حساب الموظف فوراً ويبدأ:<br/>1. تسليم العهد<br/>2. تصفية المستحقات<br/>3. إرسال إشعارات للموظف وHR والمحاسبة</div>
          <button onClick={async function() {
            var empId = document.getElementById("term-emp").value;
            var reason = document.getElementById("term-reason").value;
            var notes = document.getElementById("term-notes").value;
            if (!confirm("⚠️ هل أنت متأكد من إنهاء خدمات هذا الموظف؟")) return;
            var empName = emps.find(function(e) { return e.id === empId; })?.name || empId;
            await api("termination", "POST", { empId: empId, empName: empName, reason: reason, notes: notes, initiatedBy: role === "manager" ? "مدير النظام" : "مساعد" });
            alert("✅ تم تعطيل حساب الموظف وبدأت إجراءات إنهاء الخدمات");
          }} style={{ width: "100%", padding: "12px", borderRadius: 10, background: t.bad, color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>🚪 تنفيذ إنهاء الخدمات</button>
        </div>

        {/* Auto-check violations */}
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>⚡ فحص المخالفات التلقائي</div>
          <div style={{ fontSize: 11, color: t.txM, marginBottom: 12 }}>يفحص حضور اليوم ويكتشف التأخرات والغياب + يصعّد الإنذارات المتأخرة</div>
          <button onClick={async function() {
            var r = await api("auto_check");
            if (r && r.ok) {
              var el = document.getElementById("auto-check-result");
              el.innerHTML = "<div style='padding:10px'><div style='font-size:12px;font-weight:700;color:#30D158'>✅ تم الفحص</div><div style='margin-top:6px;font-size:11px;color:#6E6E73'>مخالفات جديدة: <strong>" + r.newViolations + "</strong></div><div style='font-size:11px;color:#6E6E73'>إنذارات مُصعّدة: <strong>" + r.escalated + "</strong></div></div>";
            }
          }} style={{ width: "100%", padding: "12px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>🔍 فحص الآن</button>
          <div id="auto-check-result" style={{ marginTop: 8 }}></div>
        </div>
      </>}

      {/* ═══ GEOFENCE ═══ */}
      {tab === "geofence" && <>
        {/* Add Branch */}
        <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📍 إدارة مواقع العمل</div>
            <span style={{ fontSize: 11, color: t.txM }}>{branches.length} موقع</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input id="new-branch-name" placeholder="اسم الموقع الجديد" style={{ flex: 2, padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: t.inp, color: t.tx, fontFamily: Fn }} />
            <input id="new-branch-radius" type="number" placeholder="النطاق (م)" defaultValue="150" style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: t.inp, color: t.tx }} />
            <button onClick={async function() {
              var name = document.getElementById("new-branch-name").value;
              var radius = parseInt(document.getElementById("new-branch-radius").value) || 150;
              if (!name) return alert("اكتب اسم الموقع");
              var id = name.replace(/\s/g, "_").toLowerCase().substring(0, 10) + "_" + Date.now().toString(36);
              var nb = branches.concat([{ id: id, name: name, start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh", radius: radius, lat: 0, lng: 0 }]);
              await saveBranches(nb);
              document.getElementById("new-branch-name").value = "";
              alert("✅ تم إضافة الموقع — حدد إحداثياته من الخريطة");
            }} style={{ padding: "10px 16px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>+ إضافة</button>
          </div>
        </div>

        {/* Branch cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>{branches.map(function(b) {
          var brEmps = safeEmps.filter(function(e) { return e.branch === b.id || e.branch === b.name; });
          return <div key={b.id} style={{ background: t.card, borderRadius: 14, padding: "14px", border: "1px solid " + t.sep }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</div>
              {role === "manager" && <button onClick={async function() {
                if (!confirm("حذف موقع " + b.name + "؟")) return;
                var nb = branches.filter(function(x) { return x.id !== b.id; });
                await saveBranches(nb);
              }} style={{ background: "none", border: "none", color: t.bad, fontSize: 14, cursor: "pointer" }}>🗑</button>}
            </div>
            <div style={{ fontSize: 10, color: B.blue, marginTop: 6 }}>📍 {b.radius < 1000 ? b.radius + " م" : (b.radius / 1000).toFixed(1) + " كم"}</div>
            {b.lat && b.lat !== 0 ? <div style={{ fontSize: 9, color: t.txM, marginTop: 2, fontFamily: "monospace" }}>{b.lat.toFixed(4)}, {b.lng.toFixed(4)}</div> : <div style={{ fontSize: 9, color: t.warn, marginTop: 2 }}>⚠️ لم يُحدد الموقع</div>}
            <button onClick={function() { setMapTarget({ type: "branch", id: b.id }); }} style={{ width: "100%", marginTop: 8, padding: "7px", borderRadius: 8, background: B.blue + "12", color: B.blue, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>🗺️ تحديد الموقع</button>
            {/* Assigned employees */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid " + t.sep }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.tx2, marginBottom: 4 }}>👥 الموظفين ({brEmps.length})</div>
              {brEmps.length === 0 && <div style={{ fontSize: 9, color: t.txM }}>لا يوجد موظفين</div>}
              {brEmps.map(function(e) { return <div key={e.id} style={{ fontSize: 10, color: t.tx2, padding: "2px 0" }}>• {e.name} ({e.id})</div>; })}
              {role === "manager" && <button onClick={async function() {
                var empId = prompt("أدخل الرقم الوظيفي للموظف (مثل E004):");
                if (!empId) return;
                empId = empId.toUpperCase();
                var allEmps = await api("employees") || [];
                var emp2 = allEmps.find(function(e) { return e.id === empId; });
                if (!emp2) return alert("الموظف غير موجود");
                emp2.branch = b.id;
                await api("employees", "PUT", { id: empId, branch: b.id });
                alert("✅ تم نقل " + emp2.name + " إلى " + b.name);
                location.reload();
              }} style={{ width: "100%", marginTop: 6, padding: "5px", borderRadius: 6, background: t.okLt, color: t.ok, fontSize: 9, fontWeight: 700, border: "none", cursor: "pointer" }}>+ نقل موظف هنا</button>}
            </div>
          </div>; })}</div>

        {/* Map Picker Modal */}
        {mapTarget && mapTarget.type === "branch" && (function() { var br = branches.find(function(x) { return x.id === mapTarget.id; }); if (!br) return null; return <MapPicker lat={br.lat} lng={br.lng} radius={br.radius} name={br.name} t={t} onClose={function() { setMapTarget(null); }} onSave={function(lat, lng, rad) { var nb = branches.map(function(x) { return x.id === br.id ? Object.assign({}, x, { lat: lat, lng: lng, radius: rad }) : x; }); saveBranches(nb); setMapTarget(null); }} />; })()}
      </>}

      {/* ═══ TRACKING (Admin only — secret) ═══ */}
      {tab === "tracking" && <TrackingPanel t={t} B={B} emps={safeEmps} branches={branches} />}

      {/* ═══ CUSTODY ADMIN ═══ */}
      {tab === "custody_admin" && <>
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📦 إدارة العهد</div>
            <button onClick={async function() {
              var items = await api("custody") || [];
              if (!Array.isArray(items)) items = [];
              var el = document.getElementById("custody-admin-list");
              if (items.length === 0) { el.innerHTML = "<div style='text-align:center;padding:20px;color:#8E8E93'>لا توجد عهد مسجّلة</div>"; return; }
              var html = items.map(function(item) {
                var statusColor = item.status === "active" ? "#30D158" : item.status === "returned" ? "#8E8E93" : "#FF9F0A";
                var statusText = item.status === "active" ? "مُستلمة" : item.status === "returned" ? "مُعادة" : "صيانة";
                return "<div style='padding:10px;border-radius:8px;background:#F8F9FA;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center'>" +
                  "<div><div style='font-size:12px;font-weight:700'>" + item.name + "</div>" +
                  "<div style='font-size:10px;color:#6E6E73'>" + (item.empName || "—") + " · " + (item.category || "") + (item.serialNumber ? " · S/N: " + item.serialNumber : "") + "</div>" +
                  (item.value ? "<div style='font-size:9px;color:#2B5EA7'>💰 " + item.value + " ريال</div>" : "") +
                  "</div><span style='padding:3px 8px;border-radius:6px;font-size:9px;font-weight:700;background:" + statusColor + "15;color:" + statusColor + "'>" + statusText + "</span></div>";
              }).join("");
              el.innerHTML = html;
            }} style={{ padding: "8px 16px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>🔄 تحديث</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[{ l: "إلكترونيات", i: "💻" }, { l: "مركبات", i: "🚗" }, { l: "معدات", i: "🔧" }, { l: "أثاث", i: "🪑" }, { l: "نقدية", i: "💰" }, { l: "أخرى", i: "📦" }].map(function(c, i) { return <div key={i} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 10, background: t.bg, border: "1px solid " + t.sep }}><div style={{ fontSize: 18 }}>{c.i}</div><div style={{ fontSize: 9, color: t.txM, marginTop: 4 }}>{c.l}</div></div>; })}
          </div>
          <div id="custody-admin-list" style={{ minHeight: 40 }}><div style={{ textAlign: "center", padding: 12, color: t.txM, fontSize: 11 }}>اضغط "تحديث" لعرض العهد</div></div>
        </div>
      </>}

      {/* ═══ REPORTS ═══ */}
      {tab === "reports" && <>
        {/* Report generation */}
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 إنشاء تقرير</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={async function() {
              var r = await api("report", "GET", null, "&period=weekly");
              if (r) document.getElementById("report-data").innerHTML = formatReport(r, "أسبوعي");
            }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>📊 تقرير أسبوعي</button>
            <button onClick={async function() {
              var r = await api("report", "GET", null, "&period=monthly");
              if (r) document.getElementById("report-data").innerHTML = formatReport(r, "شهري");
            }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: B.blueDk, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>📋 تقرير شهري</button>
          </div>
          <div id="report-data" style={{ minHeight: 20 }}></div>
        </div>

        {/* Export buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>{[
          { t: "تصدير الحضور CSV", d: "بيانات الحضور", i: "📊", c: B.blue, action: function() { window.open("/api/data?action=export&type=attendance"); } },
          { t: "مسير الرواتب CSV", d: "جاهز للبنك", i: "🏦", c: B.blueDk, action: function() { window.open("/api/data?action=export&type=payroll"); } },
          { t: "تصدير لكوادر", d: "نسب الالتزام", i: "📤", c: t.ok, action: async function() { var r = await api("kadwar-sync"); alert("✅ تم إرسال البيانات لكوادر"); } },
        ].map((r, i) => <div key={i} style={{ background: t.card, borderRadius: 14, padding: "20px", border: "1px solid " + t.sep, cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: r.c + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>{r.i}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{r.t}</div><div style={{ fontSize: 11, color: t.txM, marginTop: 4 }}>{r.d}</div>
          <button onClick={r.action} style={{ marginTop: 10, padding: "7px 14px", borderRadius: 8, background: r.c, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>تحميل</button>
        </div>)}</div>
      </>}

      {/* ═══ EVENTS (المناسبات الإدارية) ═══ */}
      {tab === "events" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 700 }}>إدارة المناسبات</span><button onClick={() => setEvents(es => [...es, { id: Date.now(), name: "مناسبة جديدة", emoji: "🎉", date: "", active: false, upgrade: false, upgradeDuration: 24, bgColor: "#1a3a6e", gifUrl: "", gifPosition: "overlay" }])} style={{ padding: "8px 16px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>+ مناسبة جديدة</button></div>
        {events.map((ev, ei) => <div key={ev.id} style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: ev.bgColor || "#0B0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{ev.emoji}</div>
            <div style={{ flex: 1 }}>
              <input value={ev.name} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, name: e.target.value} : x))} style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 14, fontWeight: 700, fontFamily: Fn, background: t.inp, color: t.tx }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input value={ev.emoji} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, emoji: e.target.value} : x))} placeholder="إيموجي" style={{ width: 50, padding: "4px 6px", borderRadius: 6, border: "1px solid " + t.sep, fontSize: 12, textAlign: "center", background: t.inp, color: t.tx }} />
                <input value={ev.date} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, date: e.target.value} : x))} placeholder="MM-DD أو فترة" style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid " + t.sep, fontSize: 12, background: t.inp, color: t.tx }} />
                <input value={ev.bgColor || ""} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, bgColor: e.target.value} : x))} placeholder="لون الخلفية" style={{ width: 80, padding: "4px 6px", borderRadius: 6, border: "1px solid " + t.sep, fontSize: 10, background: t.inp, color: t.tx }} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <Toggle on={ev.active} onClick={() => setEvents(es => es.map((x,i) => i===ei ? {...x, active: !x.active} : x))} />
              <span style={{ fontSize: 8, color: t.txM }}>{ev.active ? "مفعّل" : "معطّل"}</span>
            </div>
          </div>
          {/* GIF + Upgrade options */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>🎬 رابط GIF (اختياري)</div>
              <input value={ev.gifUrl || ""} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, gifUrl: e.target.value} : x))} placeholder="https://..." style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid " + t.sep, fontSize: 11, background: t.inp, color: t.tx }} />
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {["خلفية كاملة", "إيموجي طافية", "فوق الشريط"].map((pos, pi) => <button key={pi} onClick={() => setEvents(es => es.map((x,i) => i===ei ? {...x, gifPosition: ["bg","float","top"][pi]} : x))} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, border: (ev.gifPosition || "bg") === ["bg","float","top"][pi] ? "2px solid " + B.blue : "1px solid " + t.sep, background: (ev.gifPosition || "bg") === ["bg","float","top"][pi] ? B.blueLt : t.card, color: (ev.gifPosition || "bg") === ["bg","float","top"][pi] ? B.blue : t.tx2, cursor: "pointer" }}>{pos}</button>)}
              </div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <input type="checkbox" checked={ev.upgrade || false} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, upgrade: e.target.checked} : x))} />
                <span style={{ fontSize: 10, fontWeight: 700, color: t.tx2 }}>💎 ترقية نخبة مؤقتة</span>
              </div>
              {ev.upgrade && <select value={ev.upgradeDuration || 24} onChange={e => setEvents(es => es.map((x,i) => i===ei ? {...x, upgradeDuration: +e.target.value} : x))} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + t.sep, fontSize: 11, background: t.inp, color: t.tx }}>
                <option value={12}>12 ساعة</option><option value={24}>24 ساعة</option><option value={48}>48 ساعة</option><option value={72}>72 ساعة</option>
              </select>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => setEvents(es => es.filter((x,i) => i !== ei))} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid " + t.sep, background: "transparent", color: B.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🗑️ حذف</button>
          </div>
        </div>)}
        {/* Auto occasions */}
        <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎂 المناسبات التلقائية</div>
          {[{ l: "عيد ميلاد الموظف", v: "ترقية نخبة يومين + 🎂 + كوبون خاص", on: true }, { l: "عيد ميلاد الأبناء", v: "ترقية يوم + 🎈", on: true }, { l: "ذكرى الالتحاق", v: "ترقية يوم + 🎉 + شارة خاصة", on: true }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? "1px solid " + t.sep : "none" }}><div><div style={{ fontSize: 12, fontWeight: 600 }}>{x.l}</div><div style={{ fontSize: 10, color: t.txM }}>{x.v}</div></div><Toggle on={x.on} onClick={() => {}} /></div>)}
        </div>
      </>}

      {/* ═══ QUESTIONS (إدارة أسئلة الصباح) ═══ */}
      {tab === "questions" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 700 }}>إدارة أسئلة تحدي الصباح</span><span style={{ fontSize: 11, color: t.txM }}>{"إجمالي: " + hrQuestions.length + " سؤال"}</span></div>
        <div style={{ fontSize: 10, color: t.txM, marginBottom: 14, padding: 10, borderRadius: 8, background: B.blueLt }}>الإجابة الأولى دائماً هي الصحيحة — يتم خلط الخيارات تلقائياً عند العرض للموظف. كل يوم سؤال مختلف — لا يتكرر خلال أسبوع.</div>

        {/* Add new question */}
        <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>➕ إضافة سؤال جديد</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <select value={newQ.type} onChange={e => setNewQ({...newQ, type: e.target.value})} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, background: t.inp, color: t.tx }}>
              <option value="ذكر">ذكر</option><option value="هندسي">هندسي</option><option value="لغز">لغز</option><option value="سؤال">سؤال عام</option><option value="معلومة">معلومة</option>
            </select>
            <input value={newQ.q} onChange={e => setNewQ({...newQ, q: e.target.value})} placeholder="نص السؤال" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, fontFamily: Fn, background: t.inp, color: t.tx }} />
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={newQ.correct} onChange={e => setNewQ({...newQ, correct: e.target.value})} placeholder="✓ الإجابة الصحيحة" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "2px solid " + B.blue + "40", fontSize: 12, fontFamily: Fn, background: B.blueLt, color: t.tx }} />
            <input value={newQ.wrong1} onChange={e => setNewQ({...newQ, wrong1: e.target.value})} placeholder="خيار خاطئ 1" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, fontFamily: Fn, background: t.inp, color: t.tx }} />
            <input value={newQ.wrong2} onChange={e => setNewQ({...newQ, wrong2: e.target.value})} placeholder="خيار خاطئ 2" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, fontFamily: Fn, background: t.inp, color: t.tx }} />
          </div>
          <button onClick={() => { if (newQ.q && newQ.correct && newQ.wrong1 && newQ.wrong2) { setHrQuestions(qs => [...qs, { id: Date.now(), ...newQ }]); setNewQ({ type: "ذكر", q: "", correct: "", wrong1: "", wrong2: "" }); } }} disabled={!newQ.q || !newQ.correct} style={{ padding: "8px 20px", borderRadius: 10, background: newQ.q && newQ.correct ? B.blue : "#ddd", color: newQ.q && newQ.correct ? "#fff" : "#aaa", fontSize: 12, fontWeight: 700, border: "none", cursor: newQ.q && newQ.correct ? "pointer" : "default" }}>إضافة السؤال</button>
        </div>

        {/* Questions list by type */}
        {["ذكر","هندسي","لغز","سؤال","معلومة"].map(type => {
          var qs = hrQuestions.filter(q => q.type === type);
          if (qs.length === 0) return null;
          var typeColors = { "ذكر": "#10B981", "هندسي": B.blue, "لغز": "#F59E0B", "سؤال": "#8B5CF6", "معلومة": "#EC4899" };
          return <div key={type} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><div style={{ width: 8, height: 8, borderRadius: 4, background: typeColors[type] || B.blue }} /><span style={{ fontSize: 12, fontWeight: 800, color: typeColors[type] || t.tx }}>{type + " (" + qs.length + ")"}</span></div>
            {qs.map((q, qi) => <div key={q.id} style={{ background: t.card, borderRadius: 10, padding: "10px 14px", border: "1px solid " + t.sep, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{q.q}</div>
                <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>{"✓ " + q.correct + " · ✗ " + q.wrong1 + " · ✗ " + q.wrong2}</div>
              </div>
              <button onClick={() => setHrQuestions(qs => qs.filter(x => x.id !== q.id))} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid " + t.sep, background: "transparent", color: B.red, fontSize: 10, cursor: "pointer" }}>🗑️</button>
            </div>)}
          </div>;
        })}
        {hrQuestions.length === 0 && <div style={{ textAlign: "center", color: t.txM, fontSize: 12, padding: 30 }}>لا توجد أسئلة مخصصة — سيستخدم النظام الأسئلة الافتراضية</div>}
      </>}

      {/* ═══ LAIHA — إدارة لائحة العمل (المدير العام) ═══ */}
      {tab === "laiha" && <LaihaPanel t={t} B={B} />}

      {/* ═══ COMPLAINTS — HR Panel ═══ */}
      {tab === "complaints" && <ComplaintsPanel t={t} B={B} emps={emps} />}

      {/* ═══ INVESTIGATIONS — HR Panel ═══ */}
      {tab === "investigations" && <InvestigationsPanel t={t} B={B} emps={emps} />}

      {/* ═══ VIOLATIONS V2 — المخالفات الرسمية ═══ */}
      {tab === "violations_v2" && <ViolationsV2Panel t={t} B={B} emps={emps} />}

      {/* ═══ APPEALS — التظلمات ═══ */}
      {tab === "appeals" && <AppealsPanel t={t} B={B} emps={emps} />}

      {/* ═══ SETTINGS ═══ */}
      {tab === "settings" && <>
        {/* Sub-tabs for settings */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>{[{ id: "general", l: "⚙️ عام" }, { id: "email", l: "📧 توجيه الإيميل" }, { id: "observation", l: "👁 تحت الملاحظة" }, { id: "attachments", l: "📎 أنواع المرفقات" }, { id: "faces", l: "📸 بصمات الوجه" }, { id: "cleanup", l: "🧹 تنظيف البيانات" }].map(st => <button key={st.id} onClick={() => setSettingsTab(st.id)} style={{ padding: "8px 18px", borderRadius: 10, border: settingsTab === st.id ? "none" : "1px solid " + t.sep, background: settingsTab === st.id ? B.blue : t.card, color: settingsTab === st.id ? "#fff" : t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{st.l}</button>)}</div>

        {settingsTab === "attachments" && <AttachmentTypesManager t={t} B={B} />}
        {settingsTab === "faces" && <FacesManager t={t} B={B} emps={emps} />}
        {settingsTab === "cleanup" && <DataCleanupManager t={t} B={B} />}

        {/* GENERAL */}
        {settingsTab === "general" && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Branch Schedules */}
          <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>🕐 أوقات الدوام لكل فرع</div><div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>كل فرع له إعدادات مستقلة — الفروع تتزامن مع كوادر</div></div>
              {role === "manager" && <button style={{ padding: "7px 14px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ فرع جديد</button>}
            </div>
            {branches.map((br, bi) => (
              <div key={br.id} style={{ padding: "14px", borderRadius: 12, background: bi % 2 === 0 ? "#F8FAFC" : "#fff", border: "1px solid " + t.sep, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: B.blueLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏢</div>
                    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{br.name}</div><div style={{ fontSize: 9, color: t.txM }}>{br.tz} · {br.count} موظف</div></div>
                  </div>
                  <div style={{ padding: "3px 8px", borderRadius: 6, background: t.okLt, fontSize: 9, fontWeight: 700, color: t.ok }}>✓ متزامن مع كوادر</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "بداية الدوام", k: "start", v: br.start },
                    { l: "نهاية الدوام", k: "end", v: br.end },
                    { l: "بداية الاستراحة", k: "breakStart", v: br.breakStart },
                    { l: "نهاية الاستراحة", k: "breakEnd", v: br.breakEnd },
                    { l: "يوم الإجازة", k: "offDay", v: br.offDay },
                  ].map((f, fi) => (
                    <div key={fi}>
                      <div style={{ fontSize: 9, color: t.txM, marginBottom: 3 }}>{f.l}</div>
                      {f.k === "offDay" ? (
                        <select value={f.v} onChange={e => { var nb = branches.map(function(xx) { return xx.id === br.id ? Object.assign({}, xx, { [f.k]: e.target.value }) : xx; }); saveBranches(nb); }} style={{ ...sinp, width: "100%" }} disabled={role !== "manager"}>
                          {["الجمعة", "السبت", "الأحد", "الجمعة+السبت", "السبت+الأحد"].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input value={f.v} onChange={e => { var nb = branches.map(function(xx) { return xx.id === br.id ? Object.assign({}, xx, { [f.k]: e.target.value }) : xx; }); saveBranches(nb); }} style={{ ...sinp, width: "100%" }} disabled={role !== "manager"} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ background: B.blueLt, borderRadius: 10, padding: "10px 14px", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>🔗</span>
              <div style={{ fontSize: 10, color: B.blue, lineHeight: 1.6 }}><strong>المزامنة مع كوادر:</strong> الفروع تتزامن تلقائياً بين النظامين. إضافة فرع هنا ← يظهر في كوادر والعكس. <strong>أوقات الدوام تُعدّل فقط من بصمة HMA.</strong></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🎁 النقاط</div>{[{ l: "بصمة بوقتها", v: "10" }, { l: "تحدي الصباح", v: "25" }, { l: "بونص مبكر", v: "10" }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 2 ? "1px solid " + t.sep : "none" }}><span style={{ fontSize: 12, color: t.tx2 }}>{x.l}</span><input defaultValue={x.v} style={{ ...sinp, width: 50 }} disabled={role !== "manager"} /></div>)}</div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🔗 كوادر</div><div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px", borderRadius: 8, background: t.okLt }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: t.ok }} /><span style={{ fontSize: 11, fontWeight: 600, color: t.ok }}>متصل — مزامنة يومية 04:00</span></div>{role === "manager" && <button style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", width: "100%" }}>مزامنة الآن</button>}</div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🏅 العضوية</div>{[{ l: "عضوية فعّال 🔵", v: "0 نقطة" }, { l: "عضوية تميّز 🥇", v: "500 نقطة" }, { l: "عضوية نخبة 💎", v: "1200 نقطة" }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 2 ? "1px solid " + t.sep : "none" }}><span style={{ fontSize: 12, color: t.tx2 }}>{x.l}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{x.v}</span></div>)}{role === "manager" && <button style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, background: t.warnLt, color: t.warn, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", width: "100%" }}>⏸ تجميد عضوية موظف</button>}</div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⏱ البريك العشوائي</div><div style={{ fontSize: 11, color: t.txM, marginBottom: 10 }}>البصمة تجي عشوائياً قبل/بعد الاستراحة</div>{[{ l: "أقل مدة عشوائية", v: "2 دقيقة" }, { l: "أكثر مدة عشوائية", v: "7 دقائق" }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 1 ? "1px solid " + t.sep : "none" }}><span style={{ fontSize: 12, color: t.tx2 }}>{x.l}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{x.v}</span></div>)}<div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: t.warnLt, fontSize: 10, color: "#92400E" }}>⚠️ أثناء الاستراحة ممنوع أي تواصل — وقت الموظف</div></div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📎 إعدادات الطلبات</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + t.sep }}>
                <div><div style={{ fontSize: 12, fontWeight: 600 }}>السماح بالمرفقات</div><div style={{ fontSize: 9, color: t.txM }}>الموظف يقدر يرفق ملف مع الطلب</div></div>
                <button onClick={async function() { var s = await api("settings") || {}; var nv = !(s.allowAttachments !== false); await saveSettings({ allowAttachments: nv }); alert(nv ? "✅ المرفقات مفعّلة" : "❌ المرفقات معطّلة"); }} style={{ padding: "6px 14px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>تبديل</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <div><div style={{ fontSize: 12, fontWeight: 600 }}>الحد الأقصى للتعويضات/شهر</div><div style={{ fontSize: 9, color: t.txM }}>عدد مرات طلب التعويض شهرياً</div></div>
                <select onChange={async function(e) { await saveSettings({ maxCompensationsPerMonth: parseInt(e.target.value) }); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 11, background: t.inp, color: t.tx }}><option value="2">2</option><option value="3" selected>3</option><option value="5">5</option><option value="10">10</option></select>
              </div>
            </div>
          </div>
        </div>}

        {/* EMAIL ROUTING */}
        {settingsTab === "email" && <>
          {/* Distribution Lists */}
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: "1px solid " + t.sep, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: t.tx }}>📬 قوائم التوزيع البريدية</div><div style={{ fontSize: 11, color: t.txM, marginTop: 2 }}>حدد الجهات التي تستلم نسخ من المراسلات</div></div>
              {role === "manager" && <button onClick={() => setEmailLists(l => [...l, { id: Date.now(), name: "", email: "", color: B.blue }])} style={{ padding: "8px 16px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ إضافة قائمة</button>}
            </div>
            {emailLists.map((el, i) => (
              <div key={el.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10, background: i % 2 === 0 ? "#F8FAFC" : "#fff", marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: el.color, flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", gap: 8 }}>
                  <input value={el.name} onChange={e => setEmailLists(ls => ls.map(x => x.id === el.id ? { ...x, name: e.target.value } : x))} style={{ ...sinp, flex: 1 }} placeholder="اسم الجهة" disabled={role !== "manager"} />
                  <input value={el.email} onChange={e => setEmailLists(ls => ls.map(x => x.id === el.id ? { ...x, email: e.target.value } : x))} style={{ ...sinp, flex: 2, direction: "ltr", textAlign: "left" }} placeholder="email@hma.engineer" disabled={role !== "manager"} />
                </div>
                {role === "manager" && <button onClick={() => setEmailLists(ls => ls.filter(x => x.id !== el.id))} style={{ width: 28, height: 28, borderRadius: 6, background: t.badLt, border: "none", color: t.bad, fontSize: 12, cursor: "pointer" }}>✕</button>}
              </div>
            ))}
          </div>

          {/* Document → Email Routing (Layer 1) */}
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: "1px solid " + t.sep, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.tx, marginBottom: 4 }}>📄 توجيه المستندات → البريد (الإعداد العام)</div>
            <div style={{ fontSize: 11, color: t.txM, marginBottom: 14 }}>حدد أي جهة تستلم نسخة من كل نوع مستند</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {docRouting.map((dr, di) => (
                <div key={di} style={{ padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: "1px solid " + t.sep }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{dr.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{dr.label}</span>
                    </div>
                    <Toggle on={dr.enabled} onClick={() => role === "manager" && setDocRouting(drs => drs.map((x, i) => i === di ? { ...x, enabled: !x.enabled } : x))} />
                  </div>
                  {dr.enabled && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {emailLists.map(el => {
                      const selected = dr.targets.includes(el.id);
                      return <button key={el.id} onClick={() => role === "manager" && setDocRouting(drs => drs.map((x, i) => i === di ? { ...x, targets: selected ? x.targets.filter(t => t !== el.id) : [...x.targets, el.id] } : x))} style={{
                        padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: role === "manager" ? "pointer" : "default",
                        background: selected ? `${el.color}15` : "#fff", border: `1.5px solid ${selected ? el.color : t.sep}`, color: selected ? el.color : t.txM,
                      }}>{selected ? "✓ " : ""}{el.name}</button>;
                    })}
                  </div>}
                </div>
              ))}
            </div>
          </div>

          {/* Per-Employee Override (Layer 2) */}
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: "1px solid " + t.sep }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.tx, marginBottom: 4 }}>👤 تخصيص موظف معيّن</div>
            <div style={{ fontSize: 11, color: t.txM, marginBottom: 14 }}>تجاوز الإعداد العام لموظف محدد — مراسلاته تروح لجهات مختلفة</div>
            {empOverrides.map((ov, oi) => (
              <div key={oi} style={{ padding: "12px 14px", borderRadius: 12, background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.warnLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{ov.name}</div><div style={{ fontSize: 10, color: t.txM }}>{ov.id}</div></div>
                  </div>
                  {role === "manager" && <button onClick={() => setEmpOverrides(os => os.filter((_, i) => i !== oi))} style={{ padding: "4px 10px", borderRadius: 6, background: t.badLt, border: "none", color: t.bad, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>إزالة التخصيص</button>}
                </div>
                <div style={{ fontSize: 11, color: t.tx2, marginBottom: 6 }}>كل مراسلاته تروح لـ:</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{ov.targets.map(t => { const el = emailLists.find(e => e.id === t); return el ? <span key={t} style={{ padding: "3px 10px", borderRadius: 6, background: `${el.color}15`, color: el.color, fontSize: 10, fontWeight: 700 }}>{el.name}</span> : null; })}</div>
              </div>
            ))}
            {role === "manager" && <button style={{ width: "100%", padding: "10px", borderRadius: 10, background: "#F8FAFC", border: "2px dashed " + t.sep, color: t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>+ إضافة تخصيص لموظف</button>}
          </div>
        </>}

        {/* UNDER OBSERVATION (Layer 3) */}
        {settingsTab === "observation" && <>
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: "1px solid " + t.sep, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>👁</span>
              <div><div style={{ fontSize: 16, fontWeight: 700, color: t.tx }}>الموظفين تحت الملاحظة</div><div style={{ fontSize: 11, color: t.txM }}>كل مراسلاتهم تروح نسخة إضافية تلقائياً للشؤون القانونية</div></div>
            </div>
          </div>

          <div style={{ background: t.badLt, borderRadius: 12, padding: "12px 16px", marginBottom: 14, border: "1px solid #FECACA" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.bad, marginBottom: 4 }}>⚠️ تنبيه مهم</div>
            <div style={{ fontSize: 11, color: "#7F1D1D", lineHeight: 1.8 }}>هذه الخاصية سرية — الموظف لا يعلم أنه تحت الملاحظة. كل تفاعل منه (شكوى، رد، تذكرة، طلب إجازة) تروح نسخة إضافية تلقائياً للجهة المحددة. يجب توثيق السبب والمسؤول.</div>
          </div>

          {/* Observation target */}
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📧 الجهة المستلمة لنسخ الملاحظة</div>
            <div style={{ display: "flex", gap: 6 }}>{emailLists.map(el => (
              <div key={el.id} style={{ padding: "6px 14px", borderRadius: 8, background: el.name.includes("قانونية") ? `${el.color}15` : "#F8FAFC", border: `1.5px solid ${el.name.includes("قانونية") ? el.color : t.sep}`, fontSize: 11, fontWeight: 700, color: el.name.includes("قانونية") ? el.color : t.txM }}>{el.name.includes("قانونية") ? "✓ " : ""}{el.name}</div>
            ))}</div>
          </div>

          {/* Employees under observation */}
          {observed.map(ob => (
            <div key={ob.id} style={{ background: t.card, borderRadius: 14, padding: "16px 18px", border: `2px solid #FECACA`, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: t.badLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "2px solid " + t.bad }}>👁</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.tx }}>{ob.name}</div>
                    <div style={{ fontSize: 11, color: t.txM }}>{ob.empId} — {ob.role}</div>
                  </div>
                </div>
                <div style={{ padding: "3px 10px", borderRadius: 8, background: t.badLt, fontSize: 10, fontWeight: 700, color: t.bad }}>تحت الملاحظة</div>
              </div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ l: "السبب", v: ob.reason }, { l: "قرار من", v: ob.addedBy }, { l: "التاريخ", v: ob.date }, { l: "المدة", v: ob.duration }].map((x, i) => (
                  <div key={i} style={{ padding: "6px 10px", borderRadius: 8, background: "#FEF2F2" }}>
                    <div style={{ fontSize: 9, color: t.txM }}>{x.l}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginTop: 2 }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#FFFBEB", fontSize: 10, color: "#92400E" }}>
                📧 نسخة من كل مراسلاته تروح تلقائياً لـ: <strong>الشؤون القانونية</strong>
              </div>
              {role === "manager" && <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button style={{ flex: 1, padding: "8px", borderRadius: 8, background: t.ok, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>✓ رفع الملاحظة</button>
                <button style={{ padding: "8px 14px", borderRadius: 8, background: "#F1F5F9", color: t.tx2, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>✏️ تعديل</button>
              </div>}
            </div>
          ))}

          {role === "manager" && <button style={{ width: "100%", padding: "12px", borderRadius: 12, background: t.badLt, border: "2px dashed " + t.bad, color: t.bad, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>👁 وضع موظف تحت الملاحظة</button>}
        </>}
      </>}
    </div>
  </div>);
}

const td = { padding: "10px 12px", borderBottom: "1px solid #E5E5EA", fontSize: 12 };
const actBtn = { padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: B.blue, color: "#fff" };
const sinp = { width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid #E5E5EA", fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", fontFamily: "'IBM Plex Sans Arabic',-apple-system,sans-serif" };

/* ═══════════════════════════════════════════════════════
   LAIHA PANEL — المدير العام يدير لائحة العمل
   ═══════════════════════════════════════════════════════ */
function LaihaPanel({ t, B }) {
  var [settings, setSettings] = useState({});
  var [loading, setLoading] = useState(true);
  var [filterChapter, setFilterChapter] = useState("all");
  var [globalAutoApply, setGlobalAutoApply] = useState(() => {
    return localStorage.getItem("laiha_global_auto") !== "off";
  });
  var [editingItem, setEditingItem] = useState(null);

  useEffect(function() {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      var r = await fetch("/api/data?action=laiha_settings");
      var s = await r.json();
      setSettings(s || {});
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function updateSetting(item, changes) {
    var merged = { ...(settings[item.id] || {}), ...changes, id: item.id };
    setSettings(function(prev){ var n = {...prev}; n[item.id] = merged; return n; });
    try {
      await fetch("/api/data?action=laiha_settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
    } catch(e) { console.error(e); }
  }

  async function resetSetting(id) {
    if (!confirm("إعادة هذا البند للإعداد الافتراضي من اللائحة؟")) return;
    setSettings(function(prev){ var n = {...prev}; delete n[id]; return n; });
    try {
      await fetch("/api/data?action=laiha_settings&id=" + id, { method: "DELETE" });
    } catch(e) { console.error(e); }
  }

  function getEffective(item) {
    var custom = settings[item.id];
    if (!custom) return { enabled: item.enabled, autoApply: item.autoApply, description: item.description, penalties: item.penalties };
    return {
      enabled: custom.enabled !== undefined ? custom.enabled : item.enabled,
      autoApply: custom.autoApply !== undefined ? custom.autoApply : item.autoApply,
      description: custom.customDescription || item.description,
      penalties: custom.customPenalties || item.penalties,
      isCustom: true,
    };
  }

  var chapters = [
    { id: "all", label: "الكل (" + ALL_VIOLATIONS_DEFAULT.length + ")" },
    { id: "مواعيد العمل", label: "الفصل الأول: مواعيد العمل (16)" },
    { id: "تنظيم العمل", label: "الفصل الثاني: تنظيم العمل (18)" },
    { id: "سلوك العامل", label: "الفصل الثالث: سلوك العامل (16)" },
  ];

  var items = ALL_VIOLATIONS_DEFAULT.filter(function(i){ return filterChapter === "all" || i.chapter === filterChapter; });

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.tx2 }}>جارِ التحميل...</div>;

  return (
    <div>
      {/* Header — Source info */}
      <div style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: B.blue, marginBottom: 4 }}>📜 لائحة تنظيم العمل</div>
        <div style={{ fontSize: 11, color: t.tx2, marginBottom: 8 }}>المصدر: {LAIHA_INFO.source}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: t.tx2, flexWrap: "wrap" }}>
          <span>رقم الاعتماد: <strong style={{ color: B.blue }}>{LAIHA_INFO.approvalNumber}</strong></span>
          <span>تاريخ: {LAIHA_INFO.approvalDate}</span>
          <span>المنشأة: {LAIHA_INFO.company}</span>
        </div>
      </div>

      {/* Global toggle */}
      <div style={{ background: t.card, border: "2px solid " + B.yellow, borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>🎛️ التطبيق العام</div>
          <div style={{ fontSize: 11, color: t.tx2, marginTop: 4 }}>{globalAutoApply ? "الإعدادات الفردية تعمل" : "كل الإنذارات تمر على HR بغض النظر عن الإعدادات الفردية"}</div>
        </div>
        <Toggle on={globalAutoApply} onClick={function(){ var n = !globalAutoApply; setGlobalAutoApply(n); localStorage.setItem("laiha_global_auto", n ? "on" : "off"); }} t={t} />
      </div>

      {/* Chapter filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {chapters.map(function(ch) {
          var a = filterChapter === ch.id;
          return <button key={ch.id} onClick={function(){ setFilterChapter(ch.id); }} style={{ padding: "8px 14px", borderRadius: 10, border: a ? "none" : "1px solid " + t.sep, background: a ? B.blue : t.card, color: a ? "#fff" : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{ch.label}</button>;
        })}
      </div>

      {/* Items grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        {items.map(function(item) {
          var eff = getEffective(item);
          return (
            <div key={item.id} style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 10, padding: 14, opacity: eff.enabled ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: B.blue, padding: "2px 8px", borderRadius: 4 }}>{item.id}</span>
                    <span style={{ fontSize: 10, color: t.tx2 }}>{item.chapter} — البند {item.number}</span>
                    {eff.isCustom && <span style={{ fontSize: 9, color: "#fff", background: B.gold, padding: "2px 6px", borderRadius: 4 }}>معدّل</span>}
                    {item.autoDetectable && <span style={{ fontSize: 9, color: "#fff", background: "#10b981", padding: "2px 6px", borderRadius: 4 }}>قابل للاكتشاف آلياً</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, lineHeight: 1.6 }}>{eff.description}</div>
                  {item.notes && <div style={{ fontSize: 10, color: t.tx2, marginTop: 4, fontStyle: "italic" }}>ملاحظة: {item.notes}</div>}
                </div>
                <Toggle on={eff.enabled} onClick={function(){ updateSetting(item, { enabled: !eff.enabled, autoApply: eff.autoApply }); }} t={t} />
              </div>

              {/* Penalties grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
                {["first","second","third","fourth"].map(function(occ, idx) {
                  var code = eff.penalties[occ];
                  var label = code ? (PENALTY_TYPES[code] || {}).label : "—";
                  return (
                    <div key={occ} style={{ background: t.bg, border: "1px solid " + t.sep, borderRadius: 6, padding: 6, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: t.tx2, marginBottom: 2 }}>{["أول","ثاني","ثالث","رابع"][idx] + " مرة"}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: code ? t.tx : t.txM }}>{label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Auto/HR toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid " + t.sep }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: t.tx2 }}>التطبيق:</span>
                  <button onClick={function(){ updateSetting(item, { autoApply: !eff.autoApply, enabled: eff.enabled }); }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid " + (eff.autoApply ? "#10b981" : B.gold), background: (eff.autoApply ? "#10b981" : B.gold) + "15", color: eff.autoApply ? "#10b981" : B.gold, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                    {eff.autoApply ? "🤖 تلقائي" : "👤 يمر على HR"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={function(){ setEditingItem(item); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid " + B.blue, background: "transparent", color: B.blue, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✏️ تعديل النص</button>
                  {eff.isCustom && <button onClick={function(){ resetSetting(item.id); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid " + B.red, background: "transparent", color: B.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🔄 استرجاع الأصل</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editingItem && <EditLaihaItemModal item={editingItem} current={settings[editingItem.id]} onSave={function(changes){ updateSetting(editingItem, changes); setEditingItem(null); }} onClose={function(){ setEditingItem(null); }} t={t} B={B} />}
    </div>
  );
}

function EditLaihaItemModal({ item, current, onSave, onClose, t, B }) {
  var [desc, setDesc] = useState((current && current.customDescription) || item.description);
  var [penalties, setPenalties] = useState((current && current.customPenalties) || item.penalties);

  function save() {
    onSave({
      customDescription: desc !== item.description ? desc : null,
      customPenalties: JSON.stringify(penalties) !== JSON.stringify(item.penalties) ? penalties : null,
      enabled: current ? current.enabled : item.enabled,
      autoApply: current ? current.autoApply : item.autoApply,
    });
  }

  var penaltyOptions = Object.keys(PENALTY_TYPES).map(function(k){ return { value: k, label: PENALTY_TYPES[k].label }; });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 12, padding: 20, maxWidth: 620, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: B.blue, marginBottom: 6 }}>تعديل البند {item.id}</div>
        <div style={{ fontSize: 10, color: t.tx2, marginBottom: 14 }}>{item.chapter}</div>

        <label style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>وصف المخالفة</label>
        <textarea value={desc} onChange={function(e){ setDesc(e.target.value); }} rows={4} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, marginTop: 6, marginBottom: 14, fontFamily: "inherit", resize: "vertical", background: t.inp, color: t.tx }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>الجزاءات</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
          {["first","second","third","fourth"].map(function(occ, idx) {
            return (
              <div key={occ}>
                <div style={{ fontSize: 10, color: t.tx2, marginBottom: 4 }}>{["أول","ثاني","ثالث","رابع"][idx] + " مرة"}</div>
                <select value={penalties[occ] || ""} onChange={function(e){ var v = e.target.value || null; setPenalties(function(p){ var n = {...p}; n[occ] = v; return n; }); }} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid " + t.sep, fontSize: 11, background: t.inp, color: t.tx }}>
                  <option value="">لا جزاء</option>
                  {penaltyOptions.map(function(p){ return <option key={p.value} value={p.value}>{p.label}</option>; })}
                </select>
              </div>
            );
          })}
        </div>

        <div style={{ background: B.yellow + "20", border: "1px solid " + B.yellow, borderRadius: 8, padding: 10, fontSize: 10, color: t.tx, marginBottom: 14 }}>
          ⚠️ تعديل النص أو الجزاء هو صلاحية خاصة بالمدير العام. يتم التعديل فقط عند تحديث اللائحة رسمياً من الوزارة.
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid " + t.sep, background: t.card, color: t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={save} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>حفظ التعديل</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPLAINTS PANEL — HR يستقبل الشكاوى ويقرر
   ═══════════════════════════════════════════════════════ */
function ComplaintsPanel({ t, B, emps }) {
  var [complaints, setComplaints] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState("PENDING_HR");
  var [selected, setSelected] = useState(null);

  useEffect(function() { load(); }, []);
  async function load() {
    try { var r = await fetch("/api/data?action=complaints"); setComplaints(await r.json()); } catch(e) {}
    setLoading(false);
  }

  var filtered = complaints.filter(function(c){ return filter === "all" || c.status === filter; });
  var pendingCount = complaints.filter(function(c){ return c.status === "PENDING_HR"; }).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.tx }}>📣 الشكاوى الرسمية</div>
          <div style={{ fontSize: 11, color: t.tx2, marginTop: 4 }}>يديرها مدير الموارد البشرية</div>
        </div>
        <div style={{ background: B.red + "20", border: "1px solid " + B.red, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 800, color: B.red }}>
          {pendingCount} بانتظار المراجعة
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ id: "PENDING_HR", l: "بانتظار المراجعة" }, { id: "UNDER_INVESTIGATION", l: "قيد التحقيق" }, { id: "CONVERTED", l: "تحولت لمخالفة" }, { id: "REJECTED", l: "مرفوضة" }, { id: "CLOSED", l: "مغلقة" }, { id: "all", l: "الكل" }].map(function(f) {
          var a = filter === f.id;
          return <button key={f.id} onClick={function(){ setFilter(f.id); }} style={{ padding: "8px 14px", borderRadius: 10, border: a ? "none" : "1px solid " + t.sep, background: a ? B.blue : t.card, color: a ? "#fff" : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>;
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 30, color: t.tx2 }}>جارِ التحميل...</div>}
      {!loading && filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: t.tx2, background: t.card, borderRadius: 12 }}>لا توجد شكاوى في هذه الحالة</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(function(c) {
          var st = COMPLAINT_STATUS[c.status] || { label: c.status, color: t.tx2 };
          return (
            <div key={c.id} onClick={function(){ setSelected(c); }} style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 10, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{c.title || "شكوى رسمية"}</div>
                  <div style={{ fontSize: 10, color: t.tx2, marginTop: 3 }}>من: {c.filedByName} ← ضد: {c.againstName}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.color + "20", padding: "3px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 11, color: t.tx2, marginBottom: 6 }}>{(c.details || "").slice(0, 150)}{c.details && c.details.length > 150 ? "..." : ""}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.tx2 }}>
                <span>البند: {c.violationId || "غير محدد"}</span>
                <span>{new Date(c.createdAt).toLocaleString("ar-SA")}</span>
              </div>
            </div>
          );
        })}
      </div>

      {selected && <ComplaintDetailModal complaint={selected} emps={emps} onClose={function(){ setSelected(null); }} onUpdate={function(){ load(); setSelected(null); }} t={t} B={B} />}
    </div>
  );
}

function ComplaintDetailModal({ complaint, emps, onClose, onUpdate, t, B }) {
  var [action, setAction] = useState(null); // reject | investigate | convert
  var [notes, setNotes] = useState("");
  var [investQuestions, setInvestQuestions] = useState(["ما ردك على هذه الشكوى؟", "هل هناك ظروف خاصة؟"]);
  var [loading, setLoading] = useState(false);

  var viol = ALL_VIOLATIONS_DEFAULT.find(function(v){ return v.id === complaint.violationId; });

  async function submit() {
    setLoading(true);
    try {
      if (action === "reject") {
        await fetch("/api/data?action=complaints", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: complaint.id, status: "REJECTED", hrDecision: "reject", hrNotes: notes, decidedAt: new Date().toISOString() }),
        });
      } else if (action === "investigate") {
        var deadline = new Date();
        deadline.setHours(deadline.getHours() + 24);
        await fetch("/api/data?action=investigations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            complaintId: complaint.id,
            empId: complaint.against,
            empName: complaint.againstName,
            violationId: complaint.violationId,
            chapter: complaint.chapter,
            title: complaint.title,
            description: complaint.details,
            questions: investQuestions.filter(function(q){ return q.trim(); }),
            deadline: deadline.toISOString(),
            createdBy: "HR",
          }),
        });
      } else if (action === "convert") {
        // Create violation directly
        var penaltyKey = "first";
        var penaltyCode = viol ? viol.penalties[penaltyKey] : null;
        var penaltyLabel = penaltyCode ? PENALTY_TYPES[penaltyCode].label : "—";
        await fetch("/api/data?action=violations_v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empId: complaint.against,
            empName: complaint.againstName,
            violationId: complaint.violationId,
            chapter: complaint.chapter,
            description: viol ? viol.description : complaint.title,
            penaltyCode: penaltyCode,
            penaltyLabel: penaltyLabel,
            penalties: viol ? viol.penalties : {},
            complaintId: complaint.id,
            source: "from_complaint",
            notes: notes,
            createdBy: "HR",
            approvedBy: "HR",
          }),
        });
        await fetch("/api/data?action=complaints", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: complaint.id, status: "CONVERTED", hrDecision: "convert", hrNotes: notes, decidedAt: new Date().toISOString() }),
        });
      }
      onUpdate();
    } catch(e) {
      alert("فشلت العملية: " + e.message);
    }
    setLoading(false);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 12, padding: 20, maxWidth: 680, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: B.blue }}>📋 تفاصيل الشكوى</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: t.tx2 }}>×</button>
        </div>

        {/* Complaint info */}
        <div style={{ background: t.bg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10, fontSize: 11 }}>
            <div><span style={{ color: t.tx2 }}>من:</span> <strong style={{ color: t.tx }}>{complaint.filedByName}</strong></div>
            <div><span style={{ color: t.tx2 }}>ضد:</span> <strong style={{ color: t.tx }}>{complaint.againstName}</strong></div>
            <div><span style={{ color: t.tx2 }}>التاريخ:</span> <strong style={{ color: t.tx }}>{new Date(complaint.createdAt).toLocaleString("ar-SA")}</strong></div>
            <div><span style={{ color: t.tx2 }}>الفصل:</span> <strong style={{ color: t.tx }}>{complaint.chapter || "—"}</strong></div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 4 }}>{complaint.title}</div>
          {viol && <div style={{ fontSize: 10, background: B.blue + "15", padding: 8, borderRadius: 6, color: t.tx, marginBottom: 6 }}>
            <strong>البند القانوني ({viol.id}):</strong> {viol.description}
          </div>}
          <div style={{ fontSize: 11, color: t.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{complaint.details}</div>
        </div>

        {/* Action selector */}
        {complaint.status === "PENDING_HR" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 10 }}>📌 القرار</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { id: "reject", l: "رفض الشكوى", c: "#64748b", ico: "✗" },
                { id: "investigate", l: "فتح تحقيق", c: B.blue, ico: "🔍" },
                { id: "convert", l: "تحويل لمخالفة", c: B.red, ico: "⚖️" },
              ].map(function(a) {
                var sel = action === a.id;
                return <button key={a.id} onClick={function(){ setAction(a.id); }} style={{ padding: 12, borderRadius: 10, border: "2px solid " + a.c, background: sel ? a.c : "transparent", color: sel ? "#fff" : a.c, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{a.ico} {a.l}</button>;
              })}
            </div>

            {action && (
              <div style={{ marginBottom: 14 }}>
                {action === "investigate" && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, marginBottom: 6 }}>أسئلة التحقيق (يرد عليها الموظف خلال 24 ساعة):</div>
                    {investQuestions.map(function(q, i) {
                      return (
                        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                          <input value={q} onChange={function(e){ var nq = [...investQuestions]; nq[i] = e.target.value; setInvestQuestions(nq); }} placeholder={"سؤال " + (i+1)} style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid " + t.sep, fontSize: 11, background: t.inp, color: t.tx }} />
                          <button onClick={function(){ setInvestQuestions(investQuestions.filter(function(_,j){ return j !== i; })); }} style={{ padding: "0 12px", background: B.red + "20", border: "1px solid " + B.red, color: B.red, borderRadius: 6, cursor: "pointer" }}>×</button>
                        </div>
                      );
                    })}
                    <button onClick={function(){ setInvestQuestions([...investQuestions, ""]); }} style={{ padding: "6px 12px", background: "transparent", border: "1px dashed " + B.blue, color: B.blue, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ إضافة سؤال</button>
                  </div>
                )}

                <label style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>ملاحظات HR</label>
                <textarea value={notes} onChange={function(e){ setNotes(e.target.value); }} rows={3} placeholder="المبررات والملاحظات..." style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 11, marginTop: 6, fontFamily: "inherit", resize: "vertical", background: t.inp, color: t.tx }} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid " + t.sep, background: t.card, color: t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إغلاق</button>
          {complaint.status === "PENDING_HR" && action && <button onClick={submit} disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: action === "reject" ? "#64748b" : action === "convert" ? B.red : B.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{loading ? "جارِ..." : "تنفيذ القرار"}</button>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   INVESTIGATIONS PANEL — HR يتابع التحقيقات
   ═══════════════════════════════════════════════════════ */
function InvestigationsPanel({ t, B, emps }) {
  var [investigations, setInvestigations] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState("RESPONSE_RECEIVED");
  var [selected, setSelected] = useState(null);

  useEffect(function() { load(); }, []);
  async function load() {
    try { var r = await fetch("/api/data?action=investigations"); setInvestigations(await r.json()); } catch(e) {}
    setLoading(false);
  }

  var filtered = investigations.filter(function(i){ return filter === "all" || i.status === filter; });
  var waiting = investigations.filter(function(i){ return i.status === "RESPONSE_RECEIVED"; }).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.tx }}>🔍 التحقيقات</div>
          <div style={{ fontSize: 11, color: t.tx2, marginTop: 4 }}>استمارات التحقيق المرسلة للموظفين وردودهم</div>
        </div>
        <div style={{ background: B.blue + "20", border: "1px solid " + B.blue, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 800, color: B.blue }}>
          {waiting} بانتظار القرار النهائي
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ id: "WAITING_RESPONSE", l: "بانتظار رد الموظف" }, { id: "RESPONSE_RECEIVED", l: "تم الرد" }, { id: "CONVERTED", l: "تحولت لمخالفة" }, { id: "CLOSED", l: "أُغلقت (برئ)" }, { id: "all", l: "الكل" }].map(function(f) {
          var a = filter === f.id;
          return <button key={f.id} onClick={function(){ setFilter(f.id); }} style={{ padding: "8px 14px", borderRadius: 10, border: a ? "none" : "1px solid " + t.sep, background: a ? B.blue : t.card, color: a ? "#fff" : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>;
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 30, color: t.tx2 }}>جارِ التحميل...</div>}
      {!loading && filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: t.tx2, background: t.card, borderRadius: 12 }}>لا توجد تحقيقات</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(function(inv) {
          var now = new Date();
          var deadline = new Date(inv.deadline);
          var hoursLeft = Math.floor((deadline - now) / 3600000);
          var overdue = hoursLeft < 0 && inv.status === "WAITING_RESPONSE";
          return (
            <div key={inv.id} onClick={function(){ setSelected(inv); }} style={{ background: t.card, border: "1px solid " + (overdue ? B.red : t.sep), borderRadius: 10, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{inv.title || "تحقيق"}</div>
                  <div style={{ fontSize: 10, color: t.tx2, marginTop: 3 }}>الموظف: {inv.empName} | البند: {inv.violationId}</div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: overdue ? B.red : t.tx2 }}>
                    {inv.status === "WAITING_RESPONSE" ? (overdue ? "⚠️ تجاوز المهلة" : "⏱ " + hoursLeft + " ساعة متبقية") : (inv.status === "RESPONSE_RECEIVED" ? "📬 تم الرد" : inv.status)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: t.tx2 }}>{inv.questions.length} سؤال</div>
            </div>
          );
        })}
      </div>

      {selected && <InvestigationDetailModal investigation={selected} onClose={function(){ setSelected(null); }} onUpdate={function(){ load(); setSelected(null); }} t={t} B={B} />}
    </div>
  );
}

function InvestigationDetailModal({ investigation, onClose, onUpdate, t, B }) {
  var [decision, setDecision] = useState(null); // convert_to_violation | close_innocent
  var [notes, setNotes] = useState("");
  var [loading, setLoading] = useState(false);
  var viol = ALL_VIOLATIONS_DEFAULT.find(function(v){ return v.id === investigation.violationId; });

  async function submit() {
    if (!decision) return;
    setLoading(true);
    try {
      if (decision === "convert_to_violation" && viol) {
        var penaltyCode = viol.penalties.first;
        var penaltyLabel = PENALTY_TYPES[penaltyCode] ? PENALTY_TYPES[penaltyCode].label : "—";
        await fetch("/api/data?action=violations_v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empId: investigation.empId,
            empName: investigation.empName,
            violationId: investigation.violationId,
            chapter: investigation.chapter,
            description: viol.description,
            penaltyCode: penaltyCode,
            penaltyLabel: penaltyLabel,
            penalties: viol.penalties,
            complaintId: investigation.complaintId,
            investigationId: investigation.id,
            source: "from_investigation",
            notes: notes,
            createdBy: "HR",
            approvedBy: "HR",
          }),
        });
      }
      await fetch("/api/data?action=investigations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: investigation.id, status: decision === "convert_to_violation" ? "CONVERTED" : "CLOSED", hrDecision: decision, hrDecisionNotes: notes, hrDecidedAt: new Date().toISOString(), hrDecidedBy: "HR" }),
      });
      if (investigation.complaintId) {
        await fetch("/api/data?action=complaints", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: investigation.complaintId, status: decision === "convert_to_violation" ? "CONVERTED" : "CLOSED" }),
        });
      }
      onUpdate();
    } catch(e) { alert("فشل: " + e.message); }
    setLoading(false);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 12, padding: 20, maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: B.blue }}>🔍 تفاصيل التحقيق</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: t.tx2 }}>×</button>
        </div>

        <div style={{ background: t.bg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 6 }}>الموظف: {investigation.empName}</div>
          {viol && <div style={{ fontSize: 10, background: B.blue + "15", padding: 8, borderRadius: 6, color: t.tx, marginBottom: 10 }}>
            <strong>{viol.id}:</strong> {viol.description}
          </div>}
          <div style={{ fontSize: 11, color: t.tx }}>{investigation.description}</div>
        </div>

        {/* Questions */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 8 }}>❓ الأسئلة الموجهة</div>
          {investigation.questions.map(function(q, i) {
            return <div key={i} style={{ background: t.bg, padding: 10, borderRadius: 6, marginBottom: 6, fontSize: 11, color: t.tx }}>{i+1}. {q}</div>;
          })}
        </div>

        {/* Employee response */}
        {investigation.empResponse && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 8 }}>📬 رد الموظف</div>
            <div style={{ background: "#10b98115", border: "1px solid #10b981", padding: 12, borderRadius: 8, fontSize: 11, color: t.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{investigation.empResponse}</div>
            <div style={{ fontSize: 10, color: t.tx2, marginTop: 4 }}>تم الرد في: {new Date(investigation.empResponseAt).toLocaleString("ar-SA")}</div>
          </div>
        )}

        {!investigation.empResponse && investigation.status === "WAITING_RESPONSE" && (
          <div style={{ background: B.yellow + "20", border: "1px solid " + B.yellow, padding: 10, borderRadius: 8, fontSize: 11, color: t.tx, marginBottom: 14 }}>
            ⏱ بانتظار رد الموظف — المهلة: {new Date(investigation.deadline).toLocaleString("ar-SA")}
          </div>
        )}

        {/* Decision */}
        {investigation.status === "RESPONSE_RECEIVED" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 10 }}>⚖️ القرار النهائي</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <button onClick={function(){ setDecision("close_innocent"); }} style={{ padding: 12, borderRadius: 10, border: "2px solid #10b981", background: decision === "close_innocent" ? "#10b981" : "transparent", color: decision === "close_innocent" ? "#fff" : "#10b981", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>✓ إغلاق (الموظف بريء)</button>
              <button onClick={function(){ setDecision("convert_to_violation"); }} style={{ padding: 12, borderRadius: 10, border: "2px solid " + B.red, background: decision === "convert_to_violation" ? B.red : "transparent", color: decision === "convert_to_violation" ? "#fff" : B.red, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>⚖️ إصدار مخالفة</button>
            </div>
            {decision && (
              <textarea value={notes} onChange={function(e){ setNotes(e.target.value); }} rows={3} placeholder="ملاحظات القرار (مطلوب للتوثيق)" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 11, fontFamily: "inherit", resize: "vertical", marginBottom: 12, background: t.inp, color: t.tx }} />
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid " + t.sep, background: t.card, color: t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إغلاق</button>
          {decision && <button onClick={submit} disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: decision === "convert_to_violation" ? B.red : "#10b981", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{loading ? "جارِ..." : "تأكيد القرار"}</button>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   VIOLATIONS V2 PANEL — المخالفات الرسمية بالسجل القانوني
   ═══════════════════════════════════════════════════════ */
function ViolationsV2Panel({ t, B, emps }) {
  var [vios, setVios] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState("ACTIVE");
  var [showDirect, setShowDirect] = useState(false);

  useEffect(function() { load(); }, []);
  async function load() {
    try { var r = await fetch("/api/data?action=violations_v2"); setVios(await r.json()); } catch(e) {}
    setLoading(false);
  }

  var filtered = vios.filter(function(v){ return filter === "all" || v.status === filter; });
  var active = vios.filter(function(v){ return v.status === "ACTIVE"; }).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.tx }}>⚖️ سجل المخالفات الرسمية</div>
          <div style={{ fontSize: 11, color: t.tx2, marginTop: 4 }}>وفق اللائحة المعتمدة رقم {LAIHA_INFO.approvalNumber}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={function(){ setShowDirect(true); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: B.red, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ تسجيل مخالفة</button>
          <button onClick={function(){
            var rows = vios.map(function(v, i) {
              var st = v.status === "ACTIVE" ? "سارية" : v.status === "APPEALED" ? "متظلم" : v.status === "CANCELLED" ? "ملغاة" : v.status;
              return "<tr><td>"+(i+1)+"</td><td>"+(v.empName||"")+"</td><td>"+(v.violationId||"")+"</td><td>"+(v.description||"").replace(/</g,"&lt;").slice(0,60)+"</td><td>"+(v.occurrence||"")+"</td><td>"+(v.penaltyLabel||"")+"</td><td>"+st+"</td><td>"+(v.createdAt?new Date(v.createdAt).toLocaleDateString("ar-SA"):"")+"</td></tr>";
            }).join("");
            var html="<!DOCTYPE html><html dir=rtl><head><meta charset=utf-8><title>سجل المخالفات</title><style>body{font-family:Segoe UI,sans-serif;margin:30px}h1{font-size:18px;text-align:center;color:#2B5EA7}table{width:100%;border-collapse:collapse}th{background:#2B5EA7;color:#fff;padding:8px;font-size:10px;text-align:right}td{padding:6px;border-bottom:1px solid #eee;font-size:10px}.f{margin-top:20px;text-align:center;font-size:9px;color:#999}@media print{body{margin:10px}}</style></head><body><h1>سجل المخالفات الرسمية — HMA Engineering</h1><p style=text-align:center;font-size:11px>تاريخ التصدير: "+new Date().toLocaleString("ar-SA")+"</p><table><thead><tr><th>#</th><th>الموظف</th><th>البند</th><th>الوصف</th><th>المرة</th><th>الجزاء</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>"+rows+"</tbody></table><div class=f>لائحة تنظيم العمل رقم 978004</div><script>setTimeout(function(){window.print()},500)<\/script></body></html>";
            var w=window.open("","_blank"); if(w){w.document.write(html);w.document.close();}
          }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + t.sep, background: t.card, color: t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🖨️ طباعة</button>
          <div style={{ background: B.red + "20", border: "1px solid " + B.red, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 800, color: B.red }}>
            {active} سارية
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ id: "ACTIVE", l: "سارية" }, { id: "APPEALED", l: "متظلم عليها" }, { id: "CANCELLED", l: "ملغاة" }, { id: "all", l: "الكل" }].map(function(f) {
          var a = filter === f.id;
          return <button key={f.id} onClick={function(){ setFilter(f.id); }} style={{ padding: "8px 14px", borderRadius: 10, border: a ? "none" : "1px solid " + t.sep, background: a ? B.blue : t.card, color: a ? "#fff" : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>;
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 30, color: t.tx2 }}>جارِ التحميل...</div>}
      {!loading && filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: t.tx2, background: t.card, borderRadius: 12 }}>لا توجد مخالفات</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(function(v) {
          var st = VIOLATION_STATUS[v.status] || { label: v.status, color: t.tx2 };
          return (
            <div key={v.id} style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: B.blue, padding: "2px 6px", borderRadius: 4 }}>{v.violationId}</span>
                    <span style={{ fontSize: 10, color: t.tx2 }}>المرة {v.occurrence}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.color + "20", padding: "2px 8px", borderRadius: 4 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{v.empName}</div>
                  <div style={{ fontSize: 11, color: t.tx2, marginTop: 4, lineHeight: 1.6 }}>{v.description}</div>
                </div>
                <div style={{ textAlign: "left", minWidth: 100 }}>
                  <div style={{ fontSize: 10, color: t.tx2 }}>الجزاء</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: B.red }}>{v.penaltyLabel || "—"}</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: t.tx2, background: t.bg, padding: 8, borderRadius: 6, marginTop: 8 }}>
                📜 <strong>المرجع القانوني:</strong> {v.legalRef}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.tx2, marginTop: 6 }}>
                <span>المصدر: {v.source === "manual" ? "يدوي" : v.source === "auto" ? "تلقائي" : v.source === "from_investigation" ? "من تحقيق" : v.source === "from_complaint" ? "من شكوى" : v.source}</span>
                <span>{new Date(v.createdAt).toLocaleString("ar-SA")}</span>
              </div>
            </div>
          );
        })}
      </div>
      {showDirect && <DirectViolationModal t={t} B={B} emps={emps} onClose={function(){ setShowDirect(false); }} onCreated={function(){ setShowDirect(false); load(); }} />}
    </div>
  );
}

/* ═══ DIRECT VIOLATION MODAL — تسجيل مخالفة مباشرة بدون شكوى ═══ */
function DirectViolationModal({ t, B, emps, onClose, onCreated }) {
  var [empId, setEmpId] = useState("");
  var [violationId, setViolationId] = useState("");
  var [notes, setNotes] = useState("");
  var [saving, setSaving] = useState(false);

  var viol = ALL_VIOLATIONS_DEFAULT.find(function(v){ return v.id === violationId; });

  async function submit() {
    if (!empId || !violationId) { alert("اختر الموظف والمخالفة"); return; }
    setSaving(true);
    var emp = emps.find(function(e){ return e.id === empId; });
    var penaltyCode = viol ? viol.penalties.first : null;
    var penaltyLabel = penaltyCode && PENALTY_TYPES[penaltyCode] ? PENALTY_TYPES[penaltyCode].label : "—";
    try {
      await fetch("/api/data?action=violations_v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: empId,
          empName: emp ? emp.name : empId,
          violationId: violationId,
          chapter: viol ? viol.chapter : "",
          description: viol ? viol.description : "",
          penaltyCode: penaltyCode,
          penaltyLabel: penaltyLabel,
          penalties: viol ? viol.penalties : {},
          source: "manual",
          notes: notes,
          createdBy: "HR",
          approvedBy: "HR",
        }),
      });
      alert("✓ تم تسجيل المخالفة");
      onCreated();
    } catch(e) { alert("فشل: " + e.message); }
    setSaving(false);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 12, padding: 20, maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: B.red, marginBottom: 14 }}>⚖️ تسجيل مخالفة مباشرة</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>الموظف</label>
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, marginTop: 6, background: t.inp, color: t.tx }}>
            <option value="">-- اختر الموظف --</option>
            {emps.map(function(e){ return <option key={e.id} value={e.id}>{e.name} ({e.id})</option>; })}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>البند من اللائحة</label>
          <select value={violationId} onChange={function(e){ setViolationId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, marginTop: 6, background: t.inp, color: t.tx }}>
            <option value="">-- اختر البند --</option>
            {["مواعيد العمل", "تنظيم العمل", "سلوك العامل"].map(function(ch) {
              return <optgroup key={ch} label={ch}>{ALL_VIOLATIONS_DEFAULT.filter(function(v){ return v.chapter === ch; }).map(function(v){ return <option key={v.id} value={v.id}>{v.id}: {v.description.slice(0, 70)}...</option>; })}</optgroup>;
            })}
          </select>
        </div>

        {viol && (
          <div style={{ background: t.bg, padding: 12, borderRadius: 8, marginBottom: 12, border: "1px solid " + t.sep }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: B.blue, marginBottom: 6 }}>📜 {viol.id} — {viol.chapter}</div>
            <div style={{ fontSize: 11, color: t.tx, lineHeight: 1.6, marginBottom: 8 }}>{viol.description}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
              {["first","second","third","fourth"].map(function(occ, idx) {
                var code = viol.penalties[occ];
                var label = code ? (PENALTY_TYPES[code] || {}).label : "—";
                return <div key={occ} style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 4, padding: 4, textAlign: "center" }}><div style={{ fontSize: 8, color: t.tx2 }}>{["أول","ثاني","ثالث","رابع"][idx]}</div><div style={{ fontSize: 9, fontWeight: 700, color: code ? t.tx : t.txM }}>{label}</div></div>;
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>ملاحظات (اختياري)</label>
          <textarea value={notes} onChange={function(e){ setNotes(e.target.value); }} rows={3} placeholder="تفاصيل إضافية..." style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 11, marginTop: 6, fontFamily: "inherit", background: t.inp, color: t.tx }} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid " + t.sep, background: t.card, color: t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          <button onClick={submit} disabled={saving || !empId || !violationId} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: (!empId || !violationId) ? "#ccc" : B.red, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "جارِ..." : "تسجيل المخالفة"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ APPEALS PANEL — لوحة التظلمات ═══ */
function AppealsPanel({ t, B, emps }) {
  var [appeals, setAppeals] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState("PENDING");

  useEffect(function() { load(); }, []);
  async function load() {
    try { var r = await fetch("/api/data?action=appeals"); setAppeals(await r.json()); } catch(e) {}
    setLoading(false);
  }

  var filtered = appeals.filter(function(a){ return filter === "all" || a.status === filter; });
  var pending = appeals.filter(function(a){ return a.status === "PENDING"; }).length;

  async function decide(appeal, decision) {
    var notes = prompt(decision === "accepted" ? "ملاحظات القبول (سيتم إلغاء المخالفة):" : "سبب الرفض:");
    if (notes === null) return;
    try {
      await fetch("/api/data?action=appeals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appeal.id, status: decision === "accepted" ? "ACCEPTED" : "REJECTED", decision: decision, decisionNotes: notes, decidedAt: new Date().toISOString(), decidedBy: "HR" }),
      });
      if (decision === "accepted") {
        await fetch("/api/data?action=violations_v2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: appeal.violationId, status: "CANCELLED" }),
        });
      } else {
        await fetch("/api/data?action=violations_v2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: appeal.violationId, status: "ACTIVE" }),
        });
      }
      load();
    } catch(e) { alert("فشل: " + e.message); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.tx }}>📢 التظلمات</div>
          <div style={{ fontSize: 11, color: t.tx2, marginTop: 4 }}>المادة (54) — يحق للعامل التظلم خلال 3 أيام عمل — يُرد عليه خلال 5 أيام</div>
        </div>
        <div style={{ background: B.gold + "20", border: "1px solid " + B.gold, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 800, color: B.gold }}>
          {pending} بانتظار القرار
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[{ id: "PENDING", l: "بانتظار القرار" }, { id: "ACCEPTED", l: "مقبول (أُلغيت المخالفة)" }, { id: "REJECTED", l: "مرفوض" }, { id: "all", l: "الكل" }].map(function(f) {
          var a = filter === f.id;
          return <button key={f.id} onClick={function(){ setFilter(f.id); }} style={{ padding: "8px 14px", borderRadius: 10, border: a ? "none" : "1px solid " + t.sep, background: a ? B.blue : t.card, color: a ? "#fff" : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>;
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 30, color: t.tx2 }}>جارِ التحميل...</div>}
      {!loading && filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: t.tx2, background: t.card, borderRadius: 12 }}>لا توجد تظلمات</div>}

      {filtered.map(function(a) {
        var isOverdue = a.status === "PENDING" && new Date() > new Date(a.deadline);
        return (
          <div key={a.id} style={{ background: t.card, border: "1px solid " + (isOverdue ? B.red : t.sep), borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{a.empName}</div>
                <div style={{ fontSize: 10, color: t.tx2, marginTop: 3 }}>المخالفة: {a.violationId} — تاريخ التظلم: {new Date(a.createdAt).toLocaleDateString("ar-SA")}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: a.status === "PENDING" ? B.gold : a.status === "ACCEPTED" ? "#10b981" : "#64748b", background: (a.status === "PENDING" ? B.gold : a.status === "ACCEPTED" ? "#10b981" : "#64748b") + "20", padding: "3px 10px", borderRadius: 6 }}>
                {a.status === "PENDING" ? "بانتظار القرار" : a.status === "ACCEPTED" ? "مقبول" : "مرفوض"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: t.tx, background: t.bg, padding: 10, borderRadius: 6, lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-wrap" }}>{a.reason}</div>
            {isOverdue && <div style={{ fontSize: 10, color: B.red, fontWeight: 700, marginBottom: 8 }}>⚠️ تجاوز مهلة الرد (5 أيام عمل) — يجب الرد فوراً</div>}
            {a.status === "PENDING" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={function(){ decide(a, "rejected"); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #64748b", background: "transparent", color: "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>رفض التظلم</button>
                <button onClick={function(){ decide(a, "accepted"); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>قبول (إلغاء المخالفة)</button>
              </div>
            )}
            {a.decisionNotes && (
              <div style={{ marginTop: 8, padding: 8, background: t.bg, borderRadius: 6, fontSize: 10, color: t.tx2 }}>
                <strong>ملاحظات القرار:</strong> {a.decisionNotes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══ TRACKING PANEL — خريطة تتبع الحركة + خريطة حرارية ═══ */
function TrackingPanel({ t, B, emps, branches }) {
  var [empId, setEmpId] = useState("all");
  var [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  var [mode, setMode] = useState("markers"); // markers | trail | heatmap
  var [logs, setLogs] = useState([]);
  var [loading, setLoading] = useState(false);
  var [stats, setStats] = useState(null);
  var mapRef = useRef(null);
  var mapInstance = useRef(null);
  var layerGroup = useRef(null);
  var heatLayer = useRef(null);

  // Init map
  useEffect(function() {
    if (!mapRef.current || !window.L) return;
    if (mapInstance.current) return;
    var center = branches.length > 0 ? [branches[0].lat || 21.54, branches[0].lng || 39.17] : [21.54, 39.17];
    var map = window.L.map(mapRef.current, { zoomControl: true }).setView(center, 12);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerGroup.current = window.L.layerGroup().addTo(map);
    mapInstance.current = map;
    // Add branch circles
    branches.forEach(function(br) {
      if (br.lat && br.lng) {
        window.L.circle([br.lat, br.lng], { radius: br.radius || 150, color: B.blue, fillColor: B.blue, fillOpacity: 0.08, weight: 1.5, dashArray: "5,5" }).addTo(map).bindPopup("<b>" + br.name + "</b><br/>نطاق " + (br.radius || 150) + "م");
      }
    });
    setTimeout(function(){ map.invalidateSize(); }, 200);
  }, []);

  // Load GPS data
  async function loadData() {
    setLoading(true);
    setStats(null);
    try {
      var params = "&date=" + date;
      if (empId !== "all") params += "&empId=" + empId;
      var r = await api("gps_log", "GET", null, params);
      var data = Array.isArray(r) ? r : [];
      setLogs(data);
      // Compute stats
      if (data.length > 0) {
        var moving = 0, stationary = 0;
        for (var i = 1; i < data.length; i++) {
          var d = Math.sqrt(Math.pow(data[i].lat - data[i-1].lat, 2) + Math.pow(data[i].lng - data[i-1].lng, 2)) * 111000;
          if (d < 20) stationary++; else moving++;
        }
        var total = moving + stationary || 1;
        var empIds = new Set(data.map(function(l){ return l.empId; }));
        setStats({ total: data.length, employees: empIds.size, movePct: Math.round(moving / total * 100), statPct: Math.round(stationary / total * 100), first: data[0].ts, last: data[data.length - 1].ts });
      }
      renderMap(data);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  function renderMap(data) {
    if (!mapInstance.current || !layerGroup.current) return;
    layerGroup.current.clearLayers();
    if (heatLayer.current) { mapInstance.current.removeLayer(heatLayer.current); heatLayer.current = null; }
    if (data.length === 0) return;

    var empColors = {};
    var palette = ["#2B5EA7", "#E2192C", "#10b981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];
    var colorIdx = 0;

    if (mode === "heatmap") {
      // Heatmap
      var heatData = data.map(function(l){ return [l.lat, l.lng, 0.6]; });
      if (window.L.heatLayer) {
        heatLayer.current = window.L.heatLayer(heatData, { radius: 25, blur: 15, maxZoom: 17, gradient: { 0.2: "#2B5EA7", 0.4: "#10b981", 0.6: "#F59E0B", 0.8: "#F97316", 1.0: "#E2192C" } }).addTo(mapInstance.current);
      }
    } else if (mode === "trail") {
      // Trail per employee
      var grouped = {};
      data.forEach(function(l) {
        if (!grouped[l.empId]) grouped[l.empId] = [];
        grouped[l.empId].push(l);
      });
      Object.keys(grouped).forEach(function(eid) {
        var pts = grouped[eid].sort(function(a, b) { return new Date(a.ts) - new Date(b.ts); });
        if (!empColors[eid]) { empColors[eid] = palette[colorIdx % palette.length]; colorIdx++; }
        var color = empColors[eid];
        var latlngs = pts.map(function(p) { return [p.lat, p.lng]; });
        window.L.polyline(latlngs, { color: color, weight: 3, opacity: 0.8 }).addTo(layerGroup.current);
        // Start/end markers
        var emp = emps.find(function(e) { return e.id === eid; });
        var name = emp ? emp.name : eid;
        if (pts.length > 0) {
          window.L.circleMarker([pts[0].lat, pts[0].lng], { radius: 8, color: "#fff", fillColor: "#10b981", fillOpacity: 1, weight: 2 }).addTo(layerGroup.current).bindPopup("<b>" + name + "</b><br/>🟢 بداية: " + new Date(pts[0].ts).toLocaleTimeString("ar-SA"));
          window.L.circleMarker([pts[pts.length-1].lat, pts[pts.length-1].lng], { radius: 8, color: "#fff", fillColor: "#E2192C", fillOpacity: 1, weight: 2 }).addTo(layerGroup.current).bindPopup("<b>" + name + "</b><br/>🔴 نهاية: " + new Date(pts[pts.length-1].ts).toLocaleTimeString("ar-SA"));
        }
      });
    } else {
      // Markers
      data.forEach(function(l) {
        if (!empColors[l.empId]) { empColors[l.empId] = palette[colorIdx % palette.length]; colorIdx++; }
        var emp = emps.find(function(e) { return e.id === l.empId; });
        var name = emp ? emp.name : l.empId;
        window.L.circleMarker([l.lat, l.lng], { radius: 5, color: empColors[l.empId], fillColor: empColors[l.empId], fillOpacity: 0.7, weight: 1 }).addTo(layerGroup.current).bindPopup("<b>" + name + "</b><br/>" + new Date(l.ts).toLocaleTimeString("ar-SA") + "<br/>دقة: " + Math.round(l.accuracy || 0) + "م");
      });
    }
    // Fit bounds
    var allPts = data.map(function(l) { return [l.lat, l.lng]; });
    if (allPts.length > 0) mapInstance.current.fitBounds(allPts, { padding: [30, 30] });
  }

  // Re-render when mode changes
  useEffect(function() { if (logs.length > 0) renderMap(logs); }, [mode]);

  var btnStyle = function(active) { return { padding: "8px 14px", borderRadius: 8, border: active ? "none" : "1px solid " + t.sep, background: active ? B.blue : t.card, color: active ? "#fff" : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer" }; };

  return (
    <div>
      <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: t.tx }}>🛰️ تتبع حركة الموظفين</div>
            <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>سري — خلال ساعات الدوام فقط</div>
          </div>
        </div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ flex: 2, padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: t.inp, color: t.tx, minWidth: 120 }}>
            <option value="all">جميع الموظفين</option>
            {emps.map(function(e) { return <option key={e.id} value={e.id}>{e.name}</option>; })}
          </select>
          <input type="date" value={date} onChange={function(e){ setDate(e.target.value); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: t.inp, color: t.tx, minWidth: 120 }} />
          <button onClick={loadData} disabled={loading} style={{ padding: "10px 20px", borderRadius: 10, background: loading ? t.sep : B.blue, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>{loading ? "⏳" : "🔍 عرض"}</button>
        </div>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={function(){ setMode("markers"); }} style={btnStyle(mode === "markers")}>📍 نقاط</button>
          <button onClick={function(){ setMode("trail"); }} style={btnStyle(mode === "trail")}>🛤️ مسار الحركة</button>
          <button onClick={function(){ setMode("heatmap"); }} style={btnStyle(mode === "heatmap")}>🔥 خريطة حرارية</button>
        </div>
      </div>

      {/* Map */}
      <div style={{ borderRadius: 14, overflow: "hidden", border: "2px solid " + t.sep, marginBottom: 12 }}>
        <div ref={mapRef} style={{ height: 420, width: "100%", background: "#e8e8e8" }} />
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { l: "نقاط GPS", v: stats.total, c: B.blue },
            { l: "موظفين", v: stats.employees, c: B.gold },
            { l: "متحرّك", v: stats.movePct + "%", c: "#10b981" },
            { l: "ثابت", v: stats.statPct + "%", c: "#FF9F0A" },
          ].map(function(s, i) {
            return <div key={i} style={{ background: t.card, borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid " + t.sep }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: t.txM, marginTop: 2 }}>{s.l}</div>
            </div>;
          })}
        </div>
      )}
      {stats && (
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, marginBottom: 12, fontSize: 10, color: t.txM }}>
          أول نقطة: {new Date(stats.first).toLocaleTimeString("ar-SA")} — آخر نقطة: {new Date(stats.last).toLocaleTimeString("ar-SA")}
        </div>
      )}
      {!stats && !loading && (
        <div style={{ textAlign: "center", padding: 30, color: t.txM, background: t.card, borderRadius: 12, border: "1px solid " + t.sep }}>اختر الموظف والتاريخ ثم اضغط "عرض"</div>
      )}
      <div style={{ background: t.warnLt, borderRadius: 10, padding: "10px 14px", fontSize: 10, color: "#92400E" }}>⚠️ سري — الموظفين لا يعلمون بوجود تتبّع الحركة. يتم التتبّع خلال ساعات الدوام فقط.</div>
    </div>
  );
}

/* ═══ ATTACHMENT TYPES MANAGER ═══ */
function AttachmentTypesManager({ t, B }) {
  var [types, setTypes] = useState([]);
  var [loading, setLoading] = useState(true);
  var [newType, setNewType] = useState("");

  useEffect(function() { load(); }, []);
  async function load() {
    try {
      var r = await fetch("/api/data?action=attachment_types");
      setTypes(await r.json() || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function save(updated) {
    try {
      await fetch("/api/data?action=attachment_types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types: updated }),
      });
      setTypes(updated);
    } catch(e) { alert("فشل: " + e.message); }
  }

  function addType() {
    if (!newType.trim()) return;
    if (types.includes(newType.trim())) { alert("النوع موجود مسبقاً"); return; }
    save([...types, newType.trim()]);
    setNewType("");
  }

  function removeType(tp) {
    if (!confirm("حذف \"" + tp + "\"؟ الموظفون الذين لديهم مرفقات من هذا النوع سيبقون لكن لن يستطيعوا إضافة جديد.")) return;
    save(types.filter(function(x){ return x !== tp; }));
  }

  function moveType(idx, dir) {
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= types.length) return;
    var arr = [...types];
    var tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp;
    save(arr);
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.tx2 }}>جارِ التحميل...</div>;

  return (
    <div>
      <div style={{ background: t.card, borderRadius: 12, padding: 16, marginBottom: 14, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 4 }}>📎 أنواع المرفقات</div>
        <div style={{ fontSize: 11, color: t.tx2 }}>هذه القائمة تظهر للموظفين في قسم "المرفقات" — يمكن لكل موظف رفع مرفق واحد من كل نوع</div>
      </div>

      {/* Add new */}
      <div style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 12, padding: 14, marginBottom: 14, display: "flex", gap: 8 }}>
        <input value={newType} onChange={function(e){ setNewType(e.target.value); }} onKeyDown={function(e){ if (e.key === "Enter") addType(); }} placeholder="اسم النوع الجديد (مثل: شهادة ميلاد)" style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, fontFamily: "inherit", background: t.inp, color: t.tx }} />
        <button onClick={addType} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ إضافة</button>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {types.map(function(tp, i) {
          return (
            <div key={tp} style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: B.blue, minWidth: 24 }}>#{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, color: t.tx, fontWeight: 600 }}>{tp}</span>
              <button onClick={function(){ moveType(i, -1); }} disabled={i === 0} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid " + t.sep, background: t.card, color: t.tx2, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={function(){ moveType(i, 1); }} disabled={i === types.length - 1} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid " + t.sep, background: t.card, color: t.tx2, cursor: i === types.length - 1 ? "default" : "pointer", opacity: i === types.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={function(){ removeType(tp); }} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid " + B.red, background: "transparent", color: B.red, cursor: "pointer", fontSize: 14, fontWeight: 800 }}>×</button>
            </div>
          );
        })}
      </div>
      {types.length === 0 && <div style={{ textAlign: "center", padding: 30, color: t.tx2 }}>لا توجد أنواع — أضف النوع الأول أعلاه</div>}
    </div>
  );
}

/* ═══ FACES MANAGER — Admin can reset any employee's face ═══ */
function FacesManager({ t, B, emps }) {
  var [enrolled, setEnrolled] = useState([]);
  var [loading, setLoading] = useState(true);
  var [search, setSearch] = useState("");

  useEffect(function() { load(); }, []);
  async function load() {
    try {
      var r = await fetch("/api/data?action=face&listAll=1");
      var d = await r.json();
      setEnrolled(d.enrolled || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function resetFace(empId, empName) {
    if (!confirm("إعادة تعيين بصمة الوجه للموظف \"" + empName + "\"؟\nسيُطلب منه تسجيل وجهه مرة أخرى عند البصمة القادمة.")) return;
    try {
      await fetch("/api/data?action=face&empId=" + empId, { method: "DELETE" });
      setEnrolled(function(prev){ return prev.filter(function(id){ return id !== empId; }); });
      alert("✓ تم إعادة تعيين بصمة " + empName);
    } catch(e) { alert("فشل: " + e.message); }
  }

  async function resetAll() {
    if (!confirm("⚠️ إعادة تعيين بصمات كل الموظفين؟\nسيحتاج الجميع تسجيل وجوههم من جديد.\n\nهذه العملية لا يمكن التراجع عنها.")) return;
    if (!confirm("هل أنت متأكد 100%؟")) return;
    try {
      await fetch("/api/data?action=face&empId=ALL", { method: "DELETE" });
      setEnrolled([]);
      alert("✓ تم مسح جميع بصمات الوجه");
    } catch(e) { alert("فشل: " + e.message); }
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.tx2 }}>جارِ التحميل...</div>;

  var filtered = emps.filter(function(e) {
    if (!search) return true;
    return (e.name || "").includes(search) || (e.id || "").includes(search);
  });

  return (
    <div>
      <div style={{ background: t.card, borderRadius: 12, padding: 16, marginBottom: 14, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 4 }}>📸 إدارة بصمات الوجه</div>
        <div style={{ fontSize: 11, color: t.tx2, marginBottom: 8 }}>إعادة تعيين بصمة وجه موظف يجبره على تسجيل وجهه مرة أخرى عند البصمة القادمة</div>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: t.tx2 }}>
          <span>الموظفون المسجلون: <strong style={{ color: B.blue }}>{enrolled.length}</strong></span>
          <span>•</span>
          <span>الإجمالي: <strong style={{ color: t.tx }}>{emps.length}</strong></span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 البحث بالاسم أو الرقم" style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid " + t.sep, fontSize: 12, fontFamily: "inherit", background: t.inp, color: t.tx }} />
        {enrolled.length > 0 && <button onClick={resetAll} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid " + B.red, background: "transparent", color: B.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑 مسح الكل</button>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(function(emp) {
          var isEnrolled = enrolled.includes(emp.id);
          return (
            <div key={emp.id} style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: (isEnrolled ? "#10b981" : "#64748b") + "20", color: isEnrolled ? "#10b981" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{isEnrolled ? "✓" : "—"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{emp.name}</div>
                <div style={{ fontSize: 10, color: t.tx2 }}>{emp.id} — {emp.role || "—"}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: isEnrolled ? "#10b981" : t.tx2, padding: "3px 8px", borderRadius: 6, background: (isEnrolled ? "#10b981" : "#64748b") + "15" }}>
                {isEnrolled ? "مسجّل" : "غير مسجّل"}
              </span>
              {isEnrolled && <button onClick={function(){ resetFace(emp.id, emp.name); }} style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid " + B.red, background: "transparent", color: B.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🔄 إعادة تعيين</button>}
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 30, color: t.tx2 }}>لا توجد نتائج</div>}
    </div>
  );
}

/* ═══ DATA CLEANUP MANAGER — تنظيف بيانات الفترة التجريبية ═══ */
function DataCleanupManager({ t, B }) {
  var [sizes, setSizes] = useState(null);
  var [loading, setLoading] = useState(true);
  var [action, setAction] = useState("keep_recent");
  var [days, setDays] = useState(5);
  var [targets, setTargets] = useState({
    attendance: true,
    violations_v2: true,
    complaints: true,
    investigations: true,
    appeals: true,
    notifications: true,
    leaves: false,
    permissions: false,
    gps_log: true,
    tickets: false,
  });
  var [running, setRunning] = useState(false);
  var [results, setResults] = useState(null);

  useEffect(function() { loadSizes(); }, []);

  async function loadSizes() {
    setLoading(true);
    try {
      var r = await fetch("/api/data?action=cleanup");
      var d = await r.json();
      setSizes(d.tables || {});
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function execute() {
    var selectedTargets = Object.keys(targets).filter(function(k){ return targets[k]; });
    if (selectedTargets.length === 0) { alert("اختر جدول واحد على الأقل"); return; }

    var msgs = {
      keep_recent: "الإبقاء على آخر " + days + " يوم وحذف ما قبلها",
      delete_recent: "حذف آخر " + days + " يوم فقط",
      delete_older: "حذف ما قبل " + days + " يوم",
      delete_all: "مسح كل البيانات بالكامل",
    };
    if (!confirm("⚠️ " + msgs[action] + "\n\nالجداول: " + selectedTargets.join("، ") + "\n\nهذا الإجراء لا يمكن التراجع عنه. متأكد؟")) return;
    if (action === "delete_all" && !confirm("🚨 تأكيد نهائي: مسح كل البيانات بالكامل؟")) return;

    setRunning(true);
    setResults(null);
    var allResults = {};
    try {
      for (var tbl of selectedTargets) {
        var r = await fetch("/api/data?action=cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: action, target: tbl, days: days }),
        });
        var d = await r.json();
        if (d.results) Object.assign(allResults, d.results);
      }
      setResults(allResults);
      loadSizes();
    } catch(e) { alert("فشل: " + e.message); }
    setRunning(false);
  }

  var tableLabels = {
    attendance: "📍 سجل الحضور",
    violations_v2: "⚖️ المخالفات الرسمية",
    complaints: "📣 الشكاوى",
    investigations: "🔍 التحقيقات",
    appeals: "📢 التظلمات",
    notifications: "🔔 الإشعارات",
    leaves: "📋 الإجازات",
    permissions: "🤚 الأذونات",
    gps_log: "🛰️ سجل GPS",
    tickets: "🎫 تذاكر الدعم",
  };

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.tx2 }}>جارِ التحميل...</div>;

  return (
    <div>
      <div style={{ background: t.card, borderRadius: 12, padding: 16, marginBottom: 14, border: "2px solid " + B.red }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: B.red, marginBottom: 4 }}>🧹 تنظيف بيانات الفترة التجريبية</div>
        <div style={{ fontSize: 11, color: t.tx2 }}>هذه الأداة تحذف بيانات تجريبية بشكل انتقائي — استخدمها بحذر</div>
      </div>

      {/* Data sizes */}
      <div style={{ background: t.card, borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 10 }}>📊 حجم البيانات الحالية</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {Object.keys(tableLabels).map(function(key) {
            var s = sizes[key] || { count: 0 };
            return (
              <div key={key} style={{ background: t.bg, borderRadius: 8, padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.count > 0 ? B.blue : t.txM }}>{s.count}</div>
                <div style={{ fontSize: 9, color: t.tx2 }}>{tableLabels[key]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action selector */}
      <div style={{ background: t.card, borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 10 }}>🎯 نوع التنظيف</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { id: "keep_recent", l: "الإبقاء على آخر X يوم", d: "حذف كل شي ما عدا الأيام الأخيرة", c: "#10b981" },
            { id: "delete_recent", l: "حذف آخر X يوم", d: "حذف الأيام الأخيرة فقط", c: B.gold },
            { id: "delete_older", l: "حذف ما قبل X يوم", d: "الإبقاء على الأخيرة وحذف القديم", c: B.blue },
            { id: "delete_all", l: "مسح الكل", d: "حذف كامل بدون استثناء", c: B.red },
          ].map(function(a) {
            var sel = action === a.id;
            return (
              <button key={a.id} onClick={function(){ setAction(a.id); }} style={{ padding: 12, borderRadius: 10, border: "2px solid " + (sel ? a.c : t.sep), background: sel ? a.c + "15" : t.card, cursor: "pointer", textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: sel ? a.c : t.tx }}>{a.l}</div>
                <div style={{ fontSize: 9, color: t.tx2, marginTop: 3 }}>{a.d}</div>
              </button>
            );
          })}
        </div>

        {action !== "delete_all" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>عدد الأيام:</span>
            {[3, 5, 7, 10, 14, 30].map(function(d) {
              return <button key={d} onClick={function(){ setDays(d); }} style={{ padding: "6px 14px", borderRadius: 8, border: days === d ? "2px solid " + B.blue : "1px solid " + t.sep, background: days === d ? B.blue + "15" : t.card, color: days === d ? B.blue : t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{d}</button>;
            })}
          </div>
        )}
      </div>

      {/* Table selector */}
      <div style={{ background: t.card, borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 10 }}>📋 الجداول المراد تنظيفها</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {Object.keys(tableLabels).map(function(key) {
            var checked = targets[key];
            var s = sizes[key] || { count: 0 };
            return (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, background: checked ? B.blue + "10" : "transparent", cursor: "pointer", border: "1px solid " + (checked ? B.blue : "transparent") }}>
                <input type="checkbox" checked={checked || false} onChange={function(){ setTargets(function(p){ var n = Object.assign({}, p); n[key] = !n[key]; return n; }); }} style={{ accentColor: B.blue }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.tx }}>{tableLabels[key]}</div>
                  <div style={{ fontSize: 9, color: t.tx2 }}>{s.count} سجل</div>
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={function(){ var all = {}; Object.keys(tableLabels).forEach(function(k){ all[k] = true; }); setTargets(all); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid " + B.blue, background: "transparent", color: B.blue, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>تحديد الكل</button>
          <button onClick={function(){ var none = {}; Object.keys(tableLabels).forEach(function(k){ none[k] = false; }); setTargets(none); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid " + t.sep, background: "transparent", color: t.tx2, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>إلغاء الكل</button>
        </div>
      </div>

      {/* Execute */}
      <button onClick={execute} disabled={running} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: running ? t.sep : B.red, color: "#fff", fontSize: 14, fontWeight: 800, cursor: running ? "default" : "pointer" }}>
        {running ? "⏳ جارِ التنظيف..." : "🗑️ تنفيذ التنظيف"}
      </button>

      {/* Results */}
      {results && (
        <div style={{ background: t.card, borderRadius: 12, padding: 14, marginTop: 14, border: "2px solid #10b981" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981", marginBottom: 10 }}>✓ نتائج التنظيف</div>
          {Object.keys(results).map(function(key) {
            var r = results[key];
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + t.sep, fontSize: 11 }}>
                <span style={{ color: t.tx }}>{tableLabels[key] || key}</span>
                <span style={{ color: r.deleted > 0 ? B.red : t.tx2, fontWeight: 700 }}>
                  {r.deleted > 0 ? "حُذف " + r.deleted + " سجل (بقي " + r.after + ")" : r.before === 0 ? "فارغ" : "لم يتأثر (" + r.after + ")"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
