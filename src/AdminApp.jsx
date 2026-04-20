import { useState, useEffect, useRef } from "react";
import { ALL_VIOLATIONS_DEFAULT, PENALTY_TYPES, LAIHA_INFO, COMPLAINT_STATUS, VIOLATION_STATUS, PROCEDURE_RULES } from "./laiha";
import { generateAttendanceReport, generateEmployeeReport, generateMonthlySummary, generateViolationsReport, generateEmployeesListReport, generateBenefitsReport, generateAnnouncementsReport } from "./pdfReports";
import { exportFormalWarning, exportInvestigationRecord, exportAffidavit, exportEmploymentLetter, exportSalaryLetter, exportLeaveLetter } from "./formalPdfs";

const APP = "بصمة HMA";
const VER = "6.62";
const CO = "هاني محمد عسيري للإستشارات الهندسية";
const B = { blue: "#2B5EA7", yellow: "#FDD800", red: "#E2192C", black: "#1A1A1A", blueDk: "#1E4478", blueLt: "#EDF3FB", gold: "#D4A017" };

// Theme palettes
const LT = { bg: "#F2F2F7", card: "#fff", tx: "#000000", tx2: "#6E6E73", txM: "#8E8E93", sep: "#E5E5EA", ac: "#0A84FF", ok: "#30D158", okLt: "rgba(48,209,88,0.1)", warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.1)", bad: "#FF3B30", badLt: "rgba(255,59,48,0.08)", cardBrd: "rgba(0,0,0,0.05)", cardSh: "0 1px 3px rgba(0,0,0,0.08)", nav: "#F2F2F7", navBrd: "rgba(0,0,0,0.1)", inp: "#FFFFFF", inpBrd: "#E5E5EA" };
const DK = { bg: "#000000", card: "#1C1C1E", tx: "#FFFFFF", tx2: "#98989D", txM: "#636366", sep: "#2C2C2E", ac: "#0A84FF", ok: "#30D158", okLt: "rgba(48,209,88,0.15)", warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.15)", bad: "#FF453A", badLt: "rgba(255,69,58,0.12)", cardBrd: "rgba(255,255,255,0.1)", cardSh: "none", nav: "#1C1C1E", navBrd: "rgba(255,255,255,0.1)", inp: "#2C2C2E", inpBrd: "rgba(255,255,255,0.1)" };
const Fn = "'IBM Plex Sans Arabic',-apple-system,'Segoe UI',sans-serif";

// ═══════ DATA ═══════
const BRANCHES = [
  { id: "jed", name: "جدة", count: 0, present: 0, pct: 0, radius: 150, lat: 21.5433, lng: 39.1728, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh" },
  { id: "riy", name: "الرياض", count: 0, present: 0, pct: 0, radius: 150, lat: 24.7136, lng: 46.6753, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh" },
  { id: "ist", name: "اسطنبول", count: 0, present: 0, pct: 0, radius: 200, lat: 41.0082, lng: 28.9784, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Europe/Istanbul" },
  { id: "gaz", name: "غازي عنتاب", count: 0, present: 0, pct: 0, radius: 120, lat: 37.0662, lng: 37.3833, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Europe/Istanbul" },
];
const EMPS = [];
const LEAVE_INIT = [];
const ALERTS = [];
const WEEKLY = [
  { d: "الأحد", p: 0 }, { d: "الإثنين", p: 0 }, { d: "الثلاثاء", p: 0 }, { d: "الأربعاء", p: 0 }, { d: "الخميس", p: 0 }
];
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
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: Fn, direction: "rtl" }}>
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
            <label style={{ fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 }}>الاسم الكامل</label>
            <input value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="مثال: هاني محمد عسيري" style={{...inputStyle, "::placeholder": { color: "#aaa" }}} />
            <label style={{ fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 }}>البريد الإلكتروني</label>
            <input value={setupEmail} onChange={e => setSetupEmail(e.target.value)} placeholder="admin@hma.sa" type="email" style={inputStyle} />
            <label style={{ fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 }}>كلمة المرور (6 أحرف على الأقل)</label>
            <input value={setupPass} onChange={e => setSetupPass(e.target.value)} placeholder="••••••••" type="password" style={inputStyle} />
            <label style={{ fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 }}>تأكيد كلمة المرور</label>
            <input value={setupPass2} onChange={e => setSetupPass2(e.target.value)} placeholder="••••••••" type="password" style={inputStyle} />
            {err && <div style={{ color: "#FF3B30", fontSize: 12, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{err}</div>}
            <button onClick={doSetup} disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 12, background: busy ? t.sep : B.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", marginTop: 8 }}>
              {busy ? "جارِ الحفظ..." : "إنشاء الحساب"}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <label style={{ fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 }}>البريد الإلكتروني</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@hma.sa" type="email" style={inputStyle} />
            <label style={{ fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 }}>كلمة المرور</label>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={inputStyle} onKeyDown={e => e.key === "Enter" && doLogin()} />
            {err && <div style={{ color: "#FF3B30", fontSize: 12, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{err}</div>}
            <button onClick={doLogin} disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 12, background: busy ? t.sep : B.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", marginTop: 8 }}>
              {busy ? "جارِ الدخول..." : "دخول المدير العام"}
            </button>

            {/* Switch to Employee Login */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid " + t.sep, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: t.txM, marginBottom: 10 }}>هل أنت موظف؟</div>
              <button onClick={function() {
                localStorage.setItem("basma_explicit_employee", "1");
                localStorage.setItem("basma_last_mode", "app");
                window.location.hash = "";
                window.location.href = window.location.pathname;
              }} style={{ width: "100%", padding: "11px 14px", borderRadius: 12, background: "none", border: "1.5px solid " + B.blue, color: B.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }} onMouseEnter={function(e){ e.currentTarget.style.background = B.blue; e.currentTarget.style.color = "#fff"; }} onMouseLeave={function(e){ e.currentTarget.style.background = "none"; e.currentTarget.style.color = B.blue; }}>
                <span style={{ fontSize: 18 }}>📱</span>
                <span>دخول تطبيق الموظفين</span>
                <span style={{ fontSize: 14 }}>←</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ color: t.txM, fontSize: 11, marginTop: 20, fontWeight: 600 }}>{"v" + VER + " · b.hma.engineer/#admin"}</div>
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
  const [loggedIn, setLoggedIn] = useState(function() {
    // Auto-login if admin email was saved (from previous session) — survives F5
    return !!localStorage.getItem("basma_admin_email");
  });
  const [role, setRole] = useState("manager");
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState(LEAVE_INIT);
  const [search, setSearch] = useState("");
  const [brFilter, setBrFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
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
  const [newAnnouncementsCount, setNewAnnouncementsCount] = useState(0);
  useEffect(function(){
    // Count announcements created today
    fetch("/api/data?action=announcements").then(r => r.json()).then(function(list){
      if (!Array.isArray(list)) return;
      var today = new Date().toDateString();
      setNewAnnouncementsCount(list.filter(function(a){ return new Date(a.ts).toDateString() === today; }).length);
    }).catch(function(){});
  }, []);

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
        // Auto-sync from kadwar if last sync was more than 1 hour ago
        try {
          var lastSync = localStorage.getItem("basma_last_sync");
          var shouldSync = !lastSync || (new Date() - new Date(lastSync)) > 60 * 60 * 1000;
          if (shouldSync) {
            var sr = await fetch("/api/data?action=sync-kadwar");
            var sd = await sr.json();
            if (sd && sd.ok) localStorage.setItem("basma_last_sync", new Date().toISOString());
          }
        } catch(e) { /* silent — continue with existing data */ }

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
    if (search) {
      var s = search.toLowerCase();
      var nameMatch = (e.name || "").toLowerCase().includes(s);
      var idMatch = String(e.id || "").includes(search);
      var idNumMatch = String(e.idNumber || "").includes(search);
      var emailMatch = (e.email || "").toLowerCase().includes(s);
      var phoneMatch = String(e.phone || "").includes(search);
      if (!nameMatch && !idMatch && !idNumMatch && !emailMatch && !phoneMatch) return false;
    }
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (accountFilter === "active" && !e.hasAccount) return false;
    if (accountFilter === "inactive" && e.hasAccount) return false;
    return true;
  });

  const sideGroups = [
    {
      id: "main",
      label: "الرئيسية",
      items: [
        { id: "dashboard", icon: "📊", label: "لوحة التحكم" },
      ],
    },
    {
      id: "hr",
      label: "الموارد البشرية",
      items: [
        { id: "employees", icon: "👥", label: "الموظفين" },
        { id: "org_hierarchy", icon: "🏢", label: "الهيكل التنظيمي" },
        { id: "leaves", icon: "📋", label: "الإجازات", badge: pending },
        { id: "leave_balances", icon: "💰", label: "أرصدة الإجازات" },
        { id: "letters", icon: "📄", label: "الإفادات" },
        { id: "branches", icon: "🏢", label: "الفروع" },
        { id: "att_insights", icon: "📈", label: "ذكاء الحضور" },
        { id: "system_settings", icon: "⚙️", label: "إعدادات النظام" },
        { id: "admin_requests", icon: "📝", label: "الطلبات" },
        { id: "complaints", icon: "📣", label: "الشكاوى", badge: badgeCounts.complaints },
        { id: "investigations", icon: "🔍", label: "التحقيقات", badge: badgeCounts.investigations },
        { id: "violations_v2", icon: "⚖️", label: "المخالفات الرسمية", badge: badgeCounts.violations },
        { id: "appeals", icon: "📢", label: "التظلمات", badge: badgeCounts.appeals },
        { id: "laiha", icon: "📜", label: "لائحة العمل" },
        { id: "termination", icon: "🚪", label: "إنهاء الخدمات" },
      ],
    },
    {
      id: "ops",
      label: "العمليات والمتابعة",
      items: [
        { id: "tawasul", icon: "🤝", label: "نظام تواصل" },
        { id: "custody_admin", icon: "📦", label: "العهد" },
        { id: "asset_management", icon: "🔧", label: "إدارة الأصول" },
        { id: "tracking", icon: "🛰️", label: "تتبّع الحركة" },
        { id: "geofence", icon: "📍", label: "النطاق الجغرافي" },
        { id: "reports", icon: "📄", label: "التقارير" },
      ],
    },
    {
      id: "comm",
      label: "التواصل والمناسبات",
      items: [
        { id: "announcements", icon: "📢", label: "التعاميم" },
        { id: "banners", icon: "🎨", label: "إدارة البنر" },
        { id: "events", icon: "🎉", label: "المناسبات" },
        { id: "questions", icon: "❓", label: "أسئلة الصباح" },
      ],
    },
    {
      id: "config",
      label: "إعدادات النظام",
      items: [
        { id: "settings", icon: "⚙️", label: "الإعدادات العامة" },
        { id: "work_types", icon: "⏰", label: "أنواع الدوام" },
        { id: "benefits", icon: "🏅", label: "الامتيازات" },
        { id: "storage", icon: "💾", label: "التخزين" },
        { id: "system_check", icon: "🔍", label: "فحص النظام" },
        { id: "test_panel", icon: "🧪", label: "اختبار النظام" },
        { id: "admin_profile", icon: "🔐", label: "حساب المدير" },
      ],
    },
  ];

  // Flatten for internal compatibility
  const sideItems = sideGroups.reduce(function(acc, g){ return acc.concat(g.items); }, []);

  return (<div style={{ direction: "rtl", fontFamily: Fn, display: "flex", minHeight: "100vh", background: t.bg }}>
    <style>{`button:active{transform:scale(.97)!important} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}`}</style>

    {/* Sidebar */}
    <div style={{ width: 220, background: t.card, borderLeft: "1px solid " + t.sep, display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginBottom: 6 }}><Logo s={30} /><div><div style={{ fontSize: 14, fontWeight: 800, color: B.blue }}>{APP}</div><div style={{ fontSize: 8, color: t.txM }}>لوحة الإدارة</div></div></div>
      <Stripe />
      <SyncStatus t={t} B={B} />

      {/* Switch to employee fingerprint view */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid " + t.sep, marginBottom: 6 }}>
        <button onClick={function(){
          localStorage.setItem("basma_explicit_employee", "1");
          localStorage.setItem("basma_last_mode", "app");
          window.location.hash = "";
          window.location.reload();
        }} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "linear-gradient(135deg, " + B.blue + ", " + B.blueDk + ")", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 8px " + B.blue + "40", fontFamily: "inherit" }}
          onMouseEnter={function(e){ e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px " + B.blue + "60"; }}
          onMouseLeave={function(e){ e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px " + B.blue + "40"; }}>
          <span style={{ fontSize: 16 }}>📱</span>
          <span>التبديل لشاشة البصمة</span>
        </button>
      </div>

      <div style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
        {sideGroups.map(function(group, gIdx){
          return (
            <div key={group.id} style={{ marginBottom: 10 }}>
              {group.id !== "main" && (
                <div style={{ fontSize: 9, fontWeight: 800, color: t.txM, padding: "6px 10px 4px", letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.7 }}>
                  {group.label}
                </div>
              )}
              {group.items.map(function(item){
                var a = tab === item.id;
                return (
                  <button key={item.id} onClick={function(){ setTab(item.id); setSelEmp(null); }} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", marginBottom: 2, background: a ? B.blueLt : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                    <span style={{ fontSize: 15, filter: a ? "none" : "grayscale(.5) opacity(.6)" }}>{item.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: a ? 700 : 500, color: a ? B.blue : t.tx2, flex: 1, textAlign: "right" }}>{item.label}</span>
                    {item.badge > 0 && <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.bad, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</div>}
                  </button>
                );
              })}
              {gIdx < sideGroups.length - 1 && <div style={{ height: 1, background: t.sep, margin: "6px 10px", opacity: 0.5 }} />}
            </div>
          );
        })}
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
      {/* Top header: last sync + admin settings quick access */}
      <AdminTopBar t={t} B={B} onOpenSettings={function(){ setTab("settings"); setSettingsTab("admin-account"); }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: t.tx }}>{sideItems.find(s => s.id === tab)?.icon} {sideItems.find(s => s.id === tab)?.label}</div><div style={{ fontSize: 11, color: t.txM }}>الأحد، 6 أبريل 2026</div></div>
        {role === "assistant" && <div style={{ padding: "5px 12px", borderRadius: 8, background: t.warnLt, fontSize: 11, fontWeight: 700, color: t.warn }}>⚠️ وضع المساعد</div>}
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {tab === "dashboard" && <>
        {/* Smart welcome header */}
        {(function(){
          var hr = new Date().getHours();
          var greet = hr < 12 ? "☀️ صباح الخير" : hr < 18 ? "🌤️ نهارك سعيد" : "🌙 مساء الخير";
          var dateStr = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          return (
            <div style={{ background: "linear-gradient(135deg, " + B.blue + "15, " + B.gold + "10)", borderRadius: 14, padding: "16px 20px", marginBottom: 14, border: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.tx, marginBottom: 2 }}>{greet} 👋</div>
                <div style={{ fontSize: 11, color: t.txM }}>{dateStr}</div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                <div style={{ padding: "8px 12px", borderRadius: 8, background: t.card }}>
                  <span style={{ color: t.txM }}>الموظفون: </span>
                  <strong style={{ color: B.blue }}>{safeEmps.length}</strong>
                </div>
                <div style={{ padding: "8px 12px", borderRadius: 8, background: t.card }}>
                  <span style={{ color: t.txM }}>الحضور اليوم: </span>
                  <strong style={{ color: t.ok }}>{present}/{safeEmps.length}</strong>
                  <span style={{ color: t.txM, marginRight: 4 }}>({safeEmps.length > 0 ? Math.round((present / safeEmps.length) * 100) : 0}%)</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { id: "announcements", label: "تعميم جديد", icon: "📢", color: "#8b5cf6" },
            { id: "benefits", label: "كوبون جديد", icon: "🏅", color: B.gold },
            { id: "employees", label: "الموظفين", icon: "👥", color: B.blue },
            { id: "test_panel", label: "اختبار", icon: "🧪", color: "#ef4444" },
            { id: "storage", label: "التخزين", icon: "💾", color: "#10b981" },
            { id: "reports", label: "تقارير", icon: "📊", color: "#f59e0b" },
          ].map(function(qa) {
            return <button key={qa.id} onClick={function(){ setTab(qa.id); }} style={{ padding: "14px 10px", borderRadius: 12, background: t.card, border: "1px solid " + t.sep, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: qa.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{qa.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.tx }}>{qa.label}</div>
            </button>;
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {[{ l: "حاضر", v: present, i: "✅", c: t.ok, s: `من ${safeEmps.length}` }, { l: "غائب", v: absent, i: "🚫", c: t.bad }, { l: "متأخر", v: late, i: "⏰", c: t.warn }, { l: "طلبات معلّقة", v: pending, i: "📋", c: B.blue }].map((s, i) => <div key={i} style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 11, color: t.txM }}>{s.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.c, marginTop: 4 }}>{s.v}</div>{s.s && <div style={{ fontSize: 10, color: t.txM }}>{s.s}</div>}</div><div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.c}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.i}</div></div></div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>⚡ يحتاج إجراء</div>{ALERTS.length === 0 ? <div style={{ textAlign: "center", padding: 20, color: t.txM, fontSize: 11 }}>✓ لا توجد تنبيهات حالية</div> : ALERTS.map((a, i) => <div key={i} style={{ padding: "8px 10px", borderRadius: 10, marginBottom: 6, background: a.type === "danger" ? t.badLt : a.type === "warn" ? t.warnLt : t.okLt, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>{a.type === "danger" ? "🚨" : a.type === "warn" ? "⚠️" : "🏆"}</span><span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{a.text}</span><span style={{ fontSize: 9, color: t.txM }}>{a.time}</span></div>)}</div>
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
        {/* Kadwar source banner */}
        <div style={{ background: B.blue + "12", border: "1px solid " + B.blue + "40", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: t.tx, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 800, color: B.blue }}>🔗 المصدر: كوادر</span> — الموظفون يُدارون في <a href="https://hma.engineer" target="_blank" style={{ color: B.blue, fontWeight: 700 }}>hma.engineer</a>. لإضافة/حذف/تعديل، استخدم كوادر.
          </div>
          <KadwarSyncButton t={t} B={B} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث باسم أو رقم هوية..." style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 13, outline: "none", background: t.card, color: t.tx }} />
          <select value={brFilter} onChange={e => setBrFilter(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer" }}><option value="all" style={{background:"#fff",color:"#000"}}>كل الفروع</option>{BRANCHES.map(b => <option key={b.id} value={b.name} style={{background:"#fff",color:"#000"}}>{b.name}</option>)}</select>
          <select value={statusFilter || "all"} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer" }}>
            <option value="all" style={{background:"#fff",color:"#000"}}>كل الحالات</option>
            <option value="حاضر" style={{background:"#fff",color:"#000"}}>✅ حاضر</option>
            <option value="متأخر" style={{background:"#fff",color:"#000"}}>⏰ متأخر</option>
            <option value="غائب" style={{background:"#fff",color:"#000"}}>❌ غائب</option>
          </select>
          <select value={accountFilter || "all"} onChange={e => setAccountFilter(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer" }}>
            <option value="all" style={{background:"#fff",color:"#000"}}>كل الحسابات</option>
            <option value="active" style={{background:"#fff",color:"#000"}}>✓ نشط</option>
            <option value="inactive" style={{background:"#fff",color:"#000"}}>⚠ بدون حساب</option>
          </select>
          <button onClick={function(){ setSearch(""); setBrFilter("all"); setStatusFilter("all"); setAccountFilter("all"); }} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, fontSize: 12, background: t.card, color: t.tx, fontWeight: 600, cursor: "pointer" }}>🔄</button>
        </div>
        <div style={{ fontSize: 11, color: t.txM, marginBottom: 10 }}>
          عدد النتائج: <strong style={{ color: B.blue }}>{filteredEmps.length}</strong> من <strong>{safeEmps.length}</strong>
        </div>
        <div style={{ background: t.card, borderRadius: 14, border: "1px solid " + t.sep, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: t.bg }}>{["الموظف", "الفرع", "الحالة", "الالتزام", "السلسلة", "المستوى", "المخالفات", "البصمات"].map((h, i) => <th key={i} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: t.txM, textAlign: "right", borderBottom: "1px solid " + t.sep }}>{h}</th>)}</tr></thead>
          <tbody>{filteredEmps.map(e => { const sc = e.status === "حاضر" ? t.ok : e.status === "متأخر" ? t.warn : t.bad; const pc = e.pct >= 85 ? t.ok : e.pct >= 70 ? t.warn : t.bad; return (<tr key={e.id} onClick={() => setSelEmp(e)} style={{ cursor: "pointer" }} onMouseEnter={ev => ev.currentTarget.style.background = t.bg} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
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
            <div style={{ fontSize: 16, fontWeight: 800 }}>{selEmp.name}</div>
            <div style={{ fontSize: 11, color: t.txM }}>{selEmp.role}</div>
            <div style={{ fontSize: 9, color: t.txM, marginTop: 2 }}>🆔 {selEmp.idNumber || selEmp.id}</div>
            {/* Account status from kadwar */}
            <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
              {selEmp.isAdmin && <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, background: B.red + "20", color: B.red, borderRadius: 5 }}>مدير عام</span>}
              {selEmp.isManager && !selEmp.isAdmin && <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, background: B.blue + "20", color: B.blue, borderRadius: 5 }}>مدير</span>}
              {selEmp.hasAccount && <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, background: "#10b98120", color: "#10b981", borderRadius: 5 }}>✓ حساب نشط</span>}
              {!selEmp.hasAccount && <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, background: t.warnLt, color: t.warn, borderRadius: 5 }}>⚠ بدون حساب</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 14 }}>{[{ l: "التزام", v: `${((selEmp.pct)||0)}%`, c: ((selEmp.pct)||0) >= 85 ? t.ok : t.warn }, { l: "السلسلة", v: `🔥${(selEmp.streak||0)}`, c: "#FF6B35" }, { l: "النقاط", v: (selEmp.points||0), c: B.gold }].map((x, i) => <div key={i} style={{ background: t.bg, borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 14, fontWeight: 800, color: x.c }}>{x.v}</div><div style={{ fontSize: 8, color: t.txM, marginTop: 2 }}>{x.l}</div></div>)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <HierarchyCard emp={selEmp} emps={safeEmps} t={t} B={B} />
            {/* Contact info */}
            <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📇 بيانات التواصل</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                <div><span style={{ color: t.txM }}>الإيميل:</span> <span style={{ fontWeight: 600 }}>{selEmp.email || "—"}</span></div>
                <div><span style={{ color: t.txM }}>الجوال:</span> <span style={{ fontWeight: 600 }}>{selEmp.phone || "—"}</span></div>
                <div><span style={{ color: t.txM }}>القسم:</span> <span style={{ fontWeight: 600 }}>{selEmp.department || "—"}</span></div>
                <div><span style={{ color: t.txM }}>الفرع:</span> <span style={{ fontWeight: 600 }}>{selEmp.branchName || selEmp.branch || "—"}</span></div>
              </div>
            </div>
            {/* Today checks */}
            <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>بصمات اليوم</div>
              <div style={{ display: "flex", gap: 10 }}>{["☀️ حضور", "☕ استراحة", "🔄 عودة", "🌙 انصراف"].map((l, i) => <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: ((selEmp.checks||[0,0,0,0])[i]) ? t.okLt : t.badLt }}><div style={{ fontSize: 18 }}>{((selEmp.checks||[0,0,0,0])[i]) ? "✅" : "❌"}</div><div style={{ fontSize: 9, color: t.tx2, marginTop: 3 }}>{l}</div></div>)}</div>
            </div>
            {/* Actions */}
            <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.sep }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>إجراءات</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button style={actBtn}>📊 تقرير</button>
                <button style={{ ...actBtn, background: t.warnLt, color: t.warn }}>⚠️ إنذار</button>
                <button style={{ ...actBtn, background: t.okLt, color: t.ok }}>📤 تصدير لكوادر</button>
              </div>
              <div style={{ marginTop: 10, padding: "8px", borderRadius: 8, background: B.blue + "10", border: "1px dashed " + B.blue + "40", fontSize: 10, color: B.blue, textAlign: "center" }}>
                🔗 لتعديل الاسم/المسمى/الفرع/كلمة المرور — استخدم <a href="https://hma.engineer" target="_blank" style={{ color: B.blue, fontWeight: 800 }}>كوادر</a>
              </div>
              <div style={{ marginTop: 8, padding: "10px", borderRadius: 8, background: B.blueLt, fontSize: 11, fontWeight: 600, color: B.blue }}>النسبة المُصدّرة لكوادر: <strong>{((selEmp.pct)||0)}%</strong></div>
            </div>
          </div>
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
              el.innerHTML = "<div style='padding:10px'><div style='font-size:12px;font-weight:700;color:#30D158'>✅ تم الفحص</div><div style='margin-top:6px;font-size:11px;color:#6E6E73'>مخالفات جديدة: <strong>" + r.newViolations + "</strong></div><div style='font-size:11px;color:#6E6E73'>إنذارات تلقائية جديدة: <strong>" + (r.autoWarnings || 0) + "</strong></div><div style='font-size:11px;color:#6E6E73'>إنذارات مُصعّدة: <strong>" + r.escalated + "</strong></div></div>";
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
      {tab === "custody_admin" && <CustodyPanel t={t} B={B} emps={safeEmps} />}
      {tab === "asset_management" && <AssetManagementPanel t={t} B={B} emps={safeEmps} />}

      {/* ═══ REPORTS ═══ */}
      {tab === "reports" && <>
        {/* PDF Reports Section */}
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: B.blue, marginBottom: 12 }}>📄 تقارير PDF جاهزة للطباعة</div>
          <div style={{ fontSize: 11, color: t.txM, marginBottom: 16, lineHeight: 1.7 }}>
            تقارير منسقة باللغة العربية مع شعار المكتب. يمكن طباعتها أو حفظها PDF.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            <button onClick={async function() {
              try {
                var attR = await fetch("/api/data?action=attendance"); var att = await attR.json();
                generateAttendanceReport({ period: "الفترة الكاملة", attendance: Array.isArray(att) ? att : [], employees: safeEmps, branches: branches });
              } catch(e) { alert("خطأ: " + e.message); }
            }} style={{ padding: 14, borderRadius: 10, background: B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🕐</div>
              <div>تقرير الحضور والانصراف</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>كل سجلات الحضور مع التفاصيل</div>
            </button>

            <button onClick={async function() {
              try {
                var now = new Date();
                var attR = await fetch("/api/data?action=attendance"); var att = await attR.json();
                var vioR = await fetch("/api/data?action=violations"); var vio = await vioR.json();
                generateMonthlySummary({ month: now.getMonth() + 1, year: now.getFullYear(), attendance: Array.isArray(att) ? att : [], employees: safeEmps, violations: Array.isArray(vio) ? vio : [], leaves: leaves });
              } catch(e) { alert("خطأ: " + e.message); }
            }} style={{ padding: 14, borderRadius: 10, background: "#10b981", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>📊</div>
              <div>التقرير الشهري الشامل</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>ترتيب + إحصائيات + مقارنات</div>
            </button>

            <button onClick={function() {
              generateEmployeesListReport({ employees: safeEmps, branches: branches });
            }} style={{ padding: 14, borderRadius: 10, background: "#8b5cf6", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>👥</div>
              <div>قائمة الموظفين</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>مصنفة حسب الفرع</div>
            </button>

            <button onClick={async function() {
              try {
                var vioR = await fetch("/api/data?action=violations"); var vio = await vioR.json();
                generateViolationsReport({ violations: Array.isArray(vio) ? vio : [], employees: safeEmps });
              } catch(e) { alert("خطأ: " + e.message); }
            }} style={{ padding: 14, borderRadius: 10, background: "#ef4444", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>⚠️</div>
              <div>تقرير المخالفات</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>تحليل حسب النوع والفترة</div>
            </button>

            <button onClick={async function() {
              try {
                var r1 = await fetch("/api/data?action=benefits");
                var d1 = await r1.json();
                var r2 = await fetch("/api/data?action=redemptions");
                var d2 = await r2.json();
                generateBenefitsReport({ coupons: (d1 && d1.coupons) || [], redemptions: Array.isArray(d2) ? d2 : [], employees: safeEmps });
              } catch(e) { alert("خطأ: " + e.message); }
            }} style={{ padding: 14, borderRadius: 10, background: B.gold, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🏅</div>
              <div>تقرير الامتيازات</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>الكوبونات + سجل الصرف</div>
            </button>

            <button onClick={async function() {
              try {
                var r = await fetch("/api/data?action=announcements");
                var d = await r.json();
                generateAnnouncementsReport({ announcements: Array.isArray(d) ? d : [], employees: safeEmps });
              } catch(e) { alert("خطأ: " + e.message); }
            }} style={{ padding: 14, borderRadius: 10, background: "#06b6d4", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>📢</div>
              <div>تقرير التعاميم</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>معدلات القراءة والنشر</div>
            </button>

            <button onClick={async function() {
              if (safeEmps.length === 0) { alert("لا يوجد موظفين"); return; }
              var empId = prompt("أدخل رقم هوية الموظف (أو اسمه):");
              if (!empId) return;
              var emp = safeEmps.find(function(e){
                return e.id === empId || e.idNumber === empId || e.email === empId ||
                       (e.name && e.name.indexOf(empId) >= 0);
              });
              if (!emp) { alert("الموظف غير موجود"); return; }
              try {
                var attR = await fetch("/api/data?action=attendance&empId=" + emp.id); var att = await attR.json();
                var vioR = await fetch("/api/data?action=violations&empId=" + emp.id); var vio = await vioR.json();
                generateEmployeeReport({ employee: emp, attendance: Array.isArray(att) ? att : [], violations: Array.isArray(vio) ? vio : [], leaves: leaves, tickets: [], branches: branches });
              } catch(e) { alert("خطأ: " + e.message); }
            }} style={{ padding: 14, borderRadius: 10, background: "#0891b2", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "right" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>👤</div>
              <div>ملف موظف فردي</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 3 }}>كل البيانات + السجلات</div>
            </button>
          </div>
        </div>

        {/* Quick JSON report (existing) */}
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 تقرير JSON سريع</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={async function() {
              var r = await api("report", "GET", null, "&period=weekly");
              if (r) document.getElementById("report-data").innerHTML = formatReport(r, "أسبوعي");
            }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>📊 أسبوعي</button>
            <button onClick={async function() {
              var r = await api("report", "GET", null, "&period=monthly");
              if (r) document.getElementById("report-data").innerHTML = formatReport(r, "شهري");
            }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: B.blueDk, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>📋 شهري</button>
          </div>
          <div id="report-data" style={{ minHeight: 20 }}></div>
        </div>

        {/* CSV Export buttons */}
        <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 تصدير CSV (لبرامج أخرى)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>{[
          { t: "تصدير الحضور", d: "بيانات كاملة", i: "📊", c: B.blue, action: function() { window.open("/api/data?action=export&type=attendance"); } },
          { t: "مسير الرواتب", d: "جاهز للبنك", i: "🏦", c: B.blueDk, action: function() { window.open("/api/data?action=export&type=payroll"); } },
          { t: "قائمة الموظفين", d: "كل البيانات", i: "👥", c: "#10b981", action: function() { window.open("/api/data?action=export&type=employees_list"); } },
        ].map((r, i) => <div key={i} style={{ background: t.bg, borderRadius: 10, padding: "14px", border: "1px solid " + t.sep, cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: r.c + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 8 }}>{r.i}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{r.t}</div><div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>{r.d}</div>
          <button onClick={r.action} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, background: r.c, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>تحميل CSV</button>
        </div>)}</div>
        </div>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 700 }}>بنك أسئلة تحدي الصباح</span><span style={{ fontSize: 11, color: t.txM }}>{"إجمالي: " + hrQuestions.length + " سؤال"}</span></div>

        {/* New info banner — explains that nothing shows until admin approves */}
        <div style={{ fontSize: 11, color: t.tx, marginBottom: 14, padding: 12, borderRadius: 10, background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.2)", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, marginBottom: 4, color: B.blue }}>ℹ️ كيف يعمل بنك الأسئلة</div>
          التحدي الصباحي يظهر للموظفين <b>فقط</b> من الأسئلة التي تحفظها أنت هنا. لا أسئلة افتراضية — إذا البنك فارغ، لا يظهر تحدي.<br/>
          الإجابة الأولى (الخضراء) دائماً هي الصحيحة — الخيارات تُخلط تلقائياً عند العرض للموظف.
        </div>

        {/* Import default bank — visible when bank is empty or few questions */}
        {hrQuestions.length < 10 && (
          <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 12, padding: 14, border: "1px solid rgba(16,185,129,0.3)", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981", marginBottom: 6 }}>📦 استيراد بنك الأسئلة الافتراضي (30 سؤال)</div>
            <div style={{ fontSize: 11, color: t.tx2, marginBottom: 10, lineHeight: 1.6 }}>
              يمكنك استيراد مجموعة أسئلة جاهزة (ذكر / هندسي / نظام عمل / سلامة / ألغاز / عام) ثم <b>تختار منها ما يناسبك وتحذف الباقي</b>.
              {hrQuestions.length > 0 && " الأسئلة الموجودة لديك الآن ستبقى — سيُضاف الجديد فقط."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async function() {
                if (!confirm("استيراد 30 سؤالاً افتراضياً إلى البنك؟\n\nالأسئلة الموجودة لديك " + (hrQuestions.length > 0 ? "ستبقى" : "(لا شيء حالياً)") + " — فقط يُضاف الجديد.\n\nبعد الاستيراد، يمكنك حذف ما لا يناسبك.")) return;
                try {
                  var r = await fetch("/api/data?action=seed_questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "append" }) });
                  var d = await r.json();
                  if (d.ok) {
                    alert("✅ تم الاستيراد — أُضيف " + d.added + " سؤال جديد (الإجمالي: " + d.total + ")\n\nأعد تحميل الصفحة لرؤية الأسئلة.");
                    window.location.reload();
                  } else {
                    alert("فشل: " + (d.error || "خطأ"));
                  }
                } catch(e) { alert("فشل: " + e.message); }
              }} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "#10b981", color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>📥 استيراد إلى البنك</button>
              <button onClick={async function() {
                if (!confirm("⚠️ استبدال كامل — سيتم حذف أي أسئلة موجودة واستبدالها بالـ 30 الافتراضية.\n\nهل أنت متأكد؟")) return;
                try {
                  var r = await fetch("/api/data?action=seed_questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "replace" }) });
                  var d = await r.json();
                  if (d.ok) {
                    alert("✅ تم الاستبدال — البنك الآن يحوي " + d.total + " سؤال");
                    window.location.reload();
                  } else {
                    alert("فشل: " + (d.error || "خطأ"));
                  }
                } catch(e) { alert("فشل: " + e.message); }
              }} style={{ padding: "10px 14px", borderRadius: 10, background: "transparent", color: t.tx, border: "1px solid " + t.sep, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>استبدال كامل</button>
            </div>
          </div>
        )}

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

        {/* Save / Reset buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 18, padding: 14, background: t.card, borderRadius: 12, border: "1px solid " + t.sep }}>
          <button onClick={async function() {
            try {
              await saveSettings({ questions: hrQuestions });
              alert("✅ تم حفظ الأسئلة (" + hrQuestions.length + " سؤال) — ستظهر للموظفين في التحدي الصباحي");
            } catch(e) { alert("فشل الحفظ: " + (e.message || "خطأ")); }
          }} style={{ flex: 2, padding: "12px 16px", borderRadius: 10, background: B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>💾 حفظ الأسئلة</button>
          <button onClick={function() {
            if (confirm("مسح كل الأسئلة المحفوظة؟ سيعود النظام لاستخدام الأسئلة الافتراضية المضمّنة في الكود.")) {
              setHrQuestions([]);
              saveSettings({ questions: [] });
            }
          }} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, background: "transparent", color: t.tx, border: "1px solid " + t.sep, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 مسح الكل</button>
        </div>
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
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>{[{ id: "general", l: "⚙️ عام" }, { id: "admin-account", l: "👤 حساب المدير" }, { id: "email", l: "📧 توجيه الإيميل" }, { id: "observation", l: "👁 تحت الملاحظة" }, { id: "attachments", l: "📎 أنواع المرفقات" }, { id: "faces", l: "📸 بصمات الوجه" }, { id: "cleanup", l: "🧹 تنظيف البيانات" }].map(st => <button key={st.id} onClick={() => setSettingsTab(st.id)} style={{ padding: "8px 18px", borderRadius: 10, border: settingsTab === st.id ? "none" : "1px solid " + t.sep, background: settingsTab === st.id ? B.blue : t.card, color: settingsTab === st.id ? "#fff" : t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{st.l}</button>)}</div>

        {settingsTab === "admin-account" && <AdminAccountPanel t={t} B={B} />}

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

      {/* ═══ ADMIN PROFILE — تعديل حساب المدير العام ═══ */}
      {tab === "work_types" && <WorkTypesPanel t={t} B={B} emps={safeEmps} />}
      {tab === "leave_balances" && <LeaveBalancesPanel t={t} B={B} emps={safeEmps} />}
      {tab === "letters" && <LettersPanel t={t} B={B} emps={safeEmps} />}
      {tab === "branches" && <BranchesPanel t={t} B={B} />}
      {tab === "att_insights" && <AttendanceInsightsPanel t={t} B={B} emps={safeEmps} />}
      {tab === "system_settings" && <SystemSettingsPanel t={t} B={B} />}
      {tab === "benefits" && <BenefitsPanel t={t} B={B} />}
      {tab === "announcements" && <AnnouncementsPanel t={t} B={B} emps={safeEmps} branches={branches} />}
      {tab === "banners" && <BannersPanel t={t} B={B} />}
      {tab === "tawasul" && <TawasulAdminPanel t={t} B={B} />}
      {tab === "test_panel" && <TestPanel t={t} B={B} emps={safeEmps} />}
      {tab === "org_hierarchy" && <OrgHierarchyPanel t={t} B={B} />}
      {tab === "system_check" && <SystemCheckPanel t={t} B={B} />}
      {tab === "storage" && <StoragePanel t={t} B={B} />}

      {tab === "admin_profile" && <AdminProfile t={t} B={B} onLogout={function(){ localStorage.removeItem("basma_admin_email"); localStorage.removeItem("basma_last_mode"); setLoggedIn(false); }} />}
    </div>
  </div>);
}

/* ═══ ADMIN TOP BAR — شريط علوي: آخر مزامنة + اختصارات ═══ */
function AdminTopBar({ t, B, onOpenSettings }) {
  var [lastSync, setLastSync] = useState(function(){ return localStorage.getItem("basma_last_sync") || ""; });
  var fmt = "";
  if (lastSync) {
    var d = new Date(lastSync);
    var diff = Math.floor((new Date() - d) / 60000);
    if (diff < 1) fmt = "الآن";
    else if (diff < 60) fmt = "قبل " + diff + " دقيقة";
    else if (diff < 1440) fmt = "قبل " + Math.floor(diff / 60) + " ساعة";
    else fmt = d.toLocaleDateString("ar-SA") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: t.card, borderRadius: 10, marginBottom: 12, border: "1px solid " + t.sep, fontSize: 11, flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "#10b981", animation: "pulse 2s infinite" }} />
          <span style={{ color: t.tx2, fontWeight: 600 }}>متصل بكوادر</span>
        </div>
        {fmt && <span style={{ color: t.txM }}>آخر مزامنة: <strong style={{ color: t.tx }}>{fmt}</strong></span>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={async function(){
          try {
            var r = await fetch("/api/data?action=sync-kadwar");
            var d = await r.json();
            if (d.ok) { localStorage.setItem("basma_last_sync", new Date().toISOString()); setLastSync(new Date().toISOString()); window.location.reload(); }
            else alert("فشل: " + (d.error || "غير معروف"));
          } catch(e) { alert("فشل الاتصال"); }
        }} style={{ padding: "5px 10px", borderRadius: 6, background: "transparent", border: "1px solid " + t.sep, color: t.tx2, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🔄 مزامنة</button>
        <button onClick={onOpenSettings} style={{ padding: "5px 10px", borderRadius: 6, background: "transparent", border: "1px solid " + t.sep, color: t.tx2, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🔐 حسابي</button>
      </div>
    </div>
  );
}

/* ═══ ADMIN PROFILE — حساب المدير العام ═══ */
/* ═══ WORK TYPES PANEL — أنواع الدوام + إعدادات الموظفين (redesigned) ═══ */
var WORK_TYPE_META = {
  full_time: { icon: "💼", color: "#2B5EA7", light: "rgba(43,94,167,0.1)" },
  full_time_flex: { icon: "🔄", color: "#7C3AED", light: "rgba(124,58,237,0.1)" },
  flex_contract: { icon: "📄", color: "#EA580C", light: "rgba(234,88,12,0.1)" },
  trainee: { icon: "🎓", color: "#059669", light: "rgba(5,150,105,0.1)" },
};
function getTypeMeta(key) {
  return WORK_TYPE_META[key] || { icon: "⏰", color: "#6E6E73", light: "rgba(110,110,115,0.1)" };
}

function WorkTypesPanel({ t, B, emps }) {
  var [workTypes, setWorkTypes] = useState(null);
  var [overrides, setOverrides] = useState({});
  var [loading, setLoading] = useState(true);
  var [editingKey, setEditingKey] = useState(null);
  var [pickerEmp, setPickerEmp] = useState(null);
  var [search, setSearch] = useState("");

  var defaults = {
    full_time:      { label: "موظف دوام كامل",      workHours: 8, flexible: false, requireCheckin: true,  allowRemote: false, breakMinutes: 30, breakWindow: { start: "12:30", end: "13:00", mandatory: true }, lateAfterMin: 15, callOnLate: true  },
    full_time_flex: { label: "موظف دوام كامل مرن",  workHours: 8, flexible: true,  requireCheckin: true,  allowRemote: true,  breakMinutes: 30, breakWindow: null,                                          lateAfterMin: 30, callOnLate: true  },
    flex_contract:  { label: "عقد مرن",             workHours: 9, flexible: true,  requireCheckin: false, allowRemote: true,  breakMinutes: 30, breakWindow: null,                                          lateAfterMin: 60, callOnLate: false },
    trainee:        { label: "متدرب",               workHours: 6, flexible: false, requireCheckin: true,  allowRemote: false, breakMinutes: 30, breakWindow: { start: "12:30", end: "13:00", mandatory: true }, lateAfterMin: 15, callOnLate: true  },
  };

  useEffect(function() {
    fetch("/api/data?action=work_types").then(r => r.json()).then(function(d) {
      // v6.42 — Fix: empty {} is truthy in JS, so `d.types || defaults` returned {} when server had no types.
      // Now check if types has at least one key. If not, use defaults AND auto-save them.
      var hasTypes = d && d.types && Object.keys(d.types).length > 0;
      var finalTypes = hasTypes ? d.types : defaults;
      setWorkTypes(finalTypes);
      setOverrides((d && d.overrides) || {});
      setLoading(false);
      // Auto-seed defaults to server if server was empty
      if (!hasTypes) {
        fetch("/api/data?action=work_types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ types: defaults, overrides: (d && d.overrides) || {} }),
        }).catch(function(){});
      }
    }).catch(function(){ setWorkTypes(defaults); setLoading(false); });
  }, []);

  async function saveTypes(newTypes, newOverrides) {
    var final = newTypes || workTypes;
    var finalOv = newOverrides || overrides;
    await fetch("/api/data?action=work_types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ types: final, overrides: finalOv }),
    });
    setWorkTypes(final);
    setOverrides(finalOv);
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;
  if (!workTypes) return null;

  // Count employees per type
  var typeCounts = {};
  Object.keys(workTypes).forEach(function(k){ typeCounts[k] = 0; });
  emps.forEach(function(e) {
    var wtKey = overrides[e.id] || "full_time";
    if (typeCounts[wtKey] !== undefined) typeCounts[wtKey]++;
  });

  var filteredEmps = search.trim()
    ? emps.filter(function(e){ return (e.name || "").toLowerCase().includes(search.toLowerCase()); })
    : emps;

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Gradient Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, fontFamily: "inherit" }}>⏰ أنواع الدوام</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>{Object.keys(workTypes).length} أنواع معرّفة · {emps.length} موظف مربوط بالنظام</div>
      </div>

      {/* Types Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
        {Object.keys(workTypes).map(function(key) {
          var wt = workTypes[key];
          var m = getTypeMeta(key);
          return (
            <div key={key} style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, borderTop: "4px solid " + m.color, boxShadow: t.bg === "#000000" ? "none" : "0 1px 3px rgba(0,0,0,0.06)", transition: "transform 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 26, width: 48, height: 48, borderRadius: 12, background: m.light, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wt.label}</div>
                  <div style={{ fontSize: 10, color: m.color, fontWeight: 700, marginTop: 2 }}>👥 {typeCounts[key]} موظف</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 10, marginBottom: 12 }}>
                <div style={{ padding: "6px 10px", borderRadius: 8, background: t.bg, color: t.tx2, fontWeight: 600 }}>⏱ {wt.workHours} ساعات</div>
                <div style={{ padding: "6px 10px", borderRadius: 8, background: t.bg, color: t.tx2, fontWeight: 600 }}>{wt.flexible ? "🌐 مرن" : "📍 ثابت"}</div>
                <div style={{ padding: "6px 10px", borderRadius: 8, background: t.bg, color: t.tx2, fontWeight: 600 }}>⚠️ +{wt.lateAfterMin}د</div>
                <div style={{ padding: "6px 10px", borderRadius: 8, background: t.bg, color: t.tx2, fontWeight: 600 }}>☕ {wt.breakMinutes}د</div>
              </div>
              <button onClick={function(){ setEditingKey(key); }} style={{ width: "100%", padding: "10px", borderRadius: 10, background: m.color, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ✎ تعديل الإعدادات
              </button>
            </div>
          );
        })}
      </div>

      {/* Employees Section */}
      <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>👥 تعيين نوع الدوام للموظفين</div>
          <div style={{ fontSize: 10, color: t.txM, padding: "3px 10px", borderRadius: 10, background: t.bg, fontWeight: 700 }}>{emps.length}</div>
        </div>

        {emps.length > 10 && (
          <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 بحث عن موظف..." style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, fontFamily: "inherit", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
        )}

        {emps.length === 0 && <div style={{ color: t.txM, fontSize: 12, padding: 30, textAlign: "center" }}>لا يوجد موظفون — زامن مع كوادر أولاً</div>}

        {filteredEmps.map(function(e) {
          var ov = overrides[e.id] || "full_time";
          var wt = workTypes[ov];
          var m = getTypeMeta(ov);
          var label = wt ? wt.label : "دوام كامل";
          var initial = (e.name || "؟").trim().charAt(0);
          return (
            <div key={e.id} onClick={function(){ setPickerEmp(e); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: t.bg, marginBottom: 6, border: "1px solid " + t.sep, cursor: "pointer", WebkitTapHighlightColor: "rgba(43,94,167,0.1)", userSelect: "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: m.light, color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{initial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name || "موظف بدون اسم"}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 10, background: m.light, color: m.color, fontSize: 10, fontWeight: 700 }}>
                  <span>{m.icon}</span><span>{label}</span>
                </div>
              </div>
              <div style={{ fontSize: 20, color: t.txM, fontWeight: 800 }}>‹</div>
            </div>
          );
        })}

        {filteredEmps.length === 0 && emps.length > 0 && (
          <div style={{ color: t.txM, fontSize: 12, padding: 20, textAlign: "center" }}>لا يوجد نتائج للبحث</div>
        )}
      </div>

      {/* Edit Modal */}
      {editingKey && <WorkTypeEditModal t={t} B={B} typeKey={editingKey} workType={workTypes[editingKey]} onClose={function(){ setEditingKey(null); }} onSave={async function(updated){
        var newTypes = Object.assign({}, workTypes, {});
        newTypes[editingKey] = updated;
        await saveTypes(newTypes);
        setEditingKey(null);
      }} />}

      {/* Picker Modal */}
      {pickerEmp && <WorkTypePickerModal t={t} B={B} emp={pickerEmp} workTypes={workTypes} currentKey={overrides[pickerEmp.id] || "full_time"} onClose={function(){ setPickerEmp(null); }} onSelect={async function(newKey){
        var n = Object.assign({}, overrides);
        n[pickerEmp.id] = newKey;
        await saveTypes(null, n);
        setPickerEmp(null);
      }} />}
    </div>
  );
}

/* ═══ WORK TYPE EDIT MODAL — controlled inputs fix save bug ═══ */
function WorkTypeEditModal({ t, B, typeKey, workType, onClose, onSave }) {
  var m = getTypeMeta(typeKey);
  var [label, setLabel] = useState(workType.label);
  var [workHours, setWorkHours] = useState(workType.workHours);
  var [breakMinutes, setBreakMinutes] = useState(workType.breakMinutes);
  var [lateAfterMin, setLateAfterMin] = useState(workType.lateAfterMin);
  var [flexible, setFlexible] = useState(workType.flexible);
  var [requireCheckin, setRequireCheckin] = useState(workType.requireCheckin);
  var [allowRemote, setAllowRemote] = useState(workType.allowRemote);
  var [callOnLate, setCallOnLate] = useState(workType.callOnLate);
  // v6.35 — Break window (mandatory break time slot)
  var [breakEnabled, setBreakEnabled] = useState(!!(workType.breakWindow && workType.breakWindow.mandatory));
  var [breakStart, setBreakStart] = useState((workType.breakWindow && workType.breakWindow.start) || "12:30");
  var [breakEnd, setBreakEnd] = useState((workType.breakWindow && workType.breakWindow.end) || "13:00");
  var [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      label: label.trim() || workType.label,
      workHours: parseFloat(workHours) || 8,
      breakMinutes: parseInt(breakMinutes) || 0,
      lateAfterMin: parseInt(lateAfterMin) || 15,
      flexible: flexible,
      requireCheckin: requireCheckin,
      allowRemote: allowRemote,
      callOnLate: callOnLate,
      breakWindow: breakEnabled ? { start: breakStart, end: breakEnd, mandatory: true } : null,
    });
    setSaving(false);
  }

  var inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  function Toggle(props) {
    return (
      <div onClick={function(){ props.setter(!props.value); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 8, fontSize: 12, fontWeight: 600, transition: "all 0.15s", background: props.value ? m.light : t.bg, border: "1px solid " + (props.value ? m.color : t.sep), color: props.value ? m.color : t.tx }}>
        <span>{props.icon} {props.label}</span>
        <div style={{ width: 36, height: 20, borderRadius: 10, background: props.value ? m.color : (t.bg === "#000000" ? "#3A3A3C" : "#D1D1D6"), position: "relative", transition: "all 0.15s", flexShrink: 0 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, right: props.value ? 2 : 18, transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 500, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26, width: 46, height: 46, borderRadius: 12, background: m.light, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>تعديل نوع الدوام</div>
            <div style={{ fontSize: 11, color: t.txM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: t.txM, cursor: "pointer", padding: 4, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>الاسم</div>
            <input type="text" value={label} onChange={function(e){ setLabel(e.target.value); }} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>⏱ ساعات</div>
              <input type="number" value={workHours} onChange={function(e){ setWorkHours(e.target.value); }} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>☕ استراحة</div>
              <input type="number" value={breakMinutes} onChange={function(e){ setBreakMinutes(e.target.value); }} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>⚠️ تأخير</div>
              <input type="number" value={lateAfterMin} onChange={function(e){ setLateAfterMin(e.target.value); }} style={inputStyle} />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 8 }}>⚙️ الخيارات</div>
          <Toggle icon="🌐" label="دوام مرن" value={flexible} setter={setFlexible} />
          <Toggle icon="👆" label="يتطلب بصمة حضور" value={requireCheckin} setter={setRequireCheckin} />
          <Toggle icon="🏠" label="يسمح بالعمل عن بُعد" value={allowRemote} setter={setAllowRemote} />
          <Toggle icon="📞" label="اتصال تذكير عند التأخر" value={callOnLate} setter={setCallOnLate} />

          {/* v6.35 — Mandatory break window */}
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px dashed " + t.sep, background: breakEnabled ? m.light : "transparent" }}>
            <Toggle icon="☕" label="نافذة بريك إلزامية" value={breakEnabled} setter={setBreakEnabled} />
            {breakEnabled && (
              <>
                <div style={{ fontSize: 10, color: t.txM, marginTop: 4, marginBottom: 10, lineHeight: 1.6 }}>
                  البريك يُسمح به فقط بين الوقتين التاليين. أي بريك خارجهما سيُسجَّل كمخالفة تلقائياً.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>⏰ من</div>
                    <input type="time" value={breakStart} onChange={function(e){ setBreakStart(e.target.value); }} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 }}>⏰ إلى</div>
                    <input type="time" value={breakEnd} onChange={function(e){ setBreakEnd(e.target.value); }} style={inputStyle} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, background: saving ? t.sep : m.color, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
            {saving ? "جارِ الحفظ..." : "✓ حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ WORK TYPE PICKER MODAL — replaces native select (fix dropdown display) ═══ */
function WorkTypePickerModal({ t, B, emp, workTypes, currentKey, onClose, onSelect }) {
  var [selected, setSelected] = useState(currentKey);
  var [saving, setSaving] = useState(false);
  var [err, setErr] = useState(null);

  // v6.34 — Lock body scroll while modal open (iOS fix)
  useEffect(function(){
    var prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return function(){ document.body.style.overflow = prev; };
  }, []);

  async function handleSave() {
    if (selected === currentKey) { onClose(); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSelect(selected);
    } catch (e) {
      setErr("فشل الحفظ — جرّب مرة أخرى");
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, WebkitOverflowScrolling: "touch" }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>اختر نوع الدوام</div>
          <div style={{ fontSize: 11, color: t.txM, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name || "موظف"}</div>
        </div>

        <div style={{ padding: 16 }}>
          {Object.keys(workTypes).map(function(key) {
            var wt = workTypes[key];
            var m = getTypeMeta(key);
            var isSelected = selected === key;
            return (
              <div key={key} onClick={function(){ setSelected(key); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, marginBottom: 8, cursor: "pointer", background: isSelected ? m.light : t.bg, border: "2px solid " + (isSelected ? m.color : "transparent"), WebkitTapHighlightColor: "transparent", userSelect: "none" }}>
                <div style={{ fontSize: 26, width: 46, height: 46, borderRadius: 12, background: isSelected ? "#fff" : m.light, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? m.color : t.tx, marginBottom: 3 }}>{wt.label}</div>
                  <div style={{ fontSize: 10, color: t.tx2 }}>{wt.workHours} ساعة · {wt.flexible ? "مرن" : "ثابت"} · تأخير {wt.lateAfterMin}د</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 11, border: "2px solid " + (isSelected ? m.color : t.sep), background: isSelected ? m.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                  {isSelected ? "✓" : ""}
                </div>
              </div>
            );
          })}
          {err && <div style={{ padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 11, fontWeight: 700, marginTop: 4 }}>{err}</div>}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, background: saving ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
            {saving ? "جارِ الحفظ..." : "✓ حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ LEAVE BALANCES PANEL — لوحة إدارة رصيد الإجازات (v6.46) ═══ */
var LEAVE_TYPES_META = {
  annual:    { label: "سنوية",  icon: "🏖️", color: "#0891B2", light: "rgba(8,145,178,0.1)",  default: 21 },
  sick:      { label: "مرضية",  icon: "🏥", color: "#DC2626", light: "rgba(220,38,38,0.1)",  default: 30 },
  emergency: { label: "طارئة",  icon: "⚡",  color: "#D97706", light: "rgba(217,119,6,0.1)", default: 5  },
  personal:  { label: "شخصية",  icon: "👤", color: "#7C3AED", light: "rgba(124,58,237,0.1)", default: 0  },
};

function LeaveBalancesPanel({ t, B, emps }) {
  var [balances, setBalances] = useState({}); // { empId: { annual, sick, emergency, personal, year } }
  var [leaves, setLeaves] = useState([]);
  var [loading, setLoading] = useState(true);
  var [search, setSearch] = useState("");
  var [editEmp, setEditEmp] = useState(null); // currently editing employee
  var [showHistory, setShowHistory] = useState(null); // empId whose history we're viewing
  var [bulkBusy, setBulkBusy] = useState(false);

  var curYear = new Date().getFullYear();

  async function loadAll() {
    setLoading(true);
    try {
      // Fetch balances for each employee in parallel
      var results = await Promise.all(emps.map(function(e){
        return fetch("/api/data?action=leave-balance&empId=" + encodeURIComponent(e.id))
          .then(function(r){ return r.json(); })
          .then(function(d){ return { empId: e.id, bal: (d && !d.error) ? d : null }; })
          .catch(function(){ return { empId: e.id, bal: null }; });
      }));
      var bMap = {};
      results.forEach(function(r){ if (r.bal) bMap[r.empId] = r.bal; });
      setBalances(bMap);

      // Fetch all leaves to show history
      var lRes = await fetch("/api/data?action=leaves");
      var lData = await lRes.json();
      setLeaves(Array.isArray(lData) ? lData : []);
    } catch(e) {}
    setLoading(false);
  }

  useEffect(function(){ if (emps && emps.length) loadAll(); }, [emps]);

  async function saveBalance(empId, newBal) {
    try {
      var r = await fetch("/api/data?action=leave-balance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ empId: empId }, newBal)),
      });
      var d = await r.json();
      if (d && d.ok) {
        setBalances(function(prev){
          var n = Object.assign({}, prev);
          n[empId] = d.balance;
          return n;
        });
      }
    } catch(e) {}
  }

  async function resetAllToDefault() {
    if (!window.confirm("إعادة تعيين جميع الموظفين إلى الأرصدة الافتراضية (21 سنوية، 30 مرضية، 5 طارئة، 0 شخصية) لسنة " + curYear + "؟")) return;
    setBulkBusy(true);
    try {
      await Promise.all(emps.map(function(e){
        return fetch("/api/data?action=leave-balance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empId: e.id, annual: 21, sick: 30, emergency: 5, personal: 0 }),
        }).catch(function(){});
      }));
      await loadAll();
      alert("✅ تم إعادة تعيين أرصدة " + emps.length + " موظف");
    } catch(e) { alert("خطأ في إعادة التعيين"); }
    setBulkBusy(false);
  }

  var filteredEmps = search.trim()
    ? emps.filter(function(e){ return (e.name || "").toLowerCase().includes(search.toLowerCase()); })
    : emps;

  // Summary stats
  var totalBalance = { annual: 0, sick: 0, emergency: 0, personal: 0 };
  Object.values(balances).forEach(function(b){
    totalBalance.annual += b.annual || 0;
    totalBalance.sick += b.sick || 0;
    totalBalance.emergency += b.emergency || 0;
    totalBalance.personal += b.personal || 0;
  });

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Gradient Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>💰 أرصدة الإجازات ({curYear})</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>{emps.length} موظف · تعديل يدوي للرصيد + عرض السجل</div>
      </div>

      {/* Stats + bulk actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        {["annual","sick","emergency","personal"].map(function(k){
          var m = LEAVE_TYPES_META[k];
          return (
            <div key={k} style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, borderTop: "3px solid " + m.color }}>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>{m.icon} {m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{totalBalance[k]}</div>
              <div style={{ fontSize: 9, color: t.txM }}>إجمالي المتبقي</div>
            </div>
          );
        })}
        <div style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, borderTop: "3px solid #10B981", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <button onClick={resetAllToDefault} disabled={bulkBusy} style={{ padding: "8px 10px", borderRadius: 8, background: "#10B981", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: bulkBusy ? "default" : "pointer", fontFamily: "inherit" }}>
            {bulkBusy ? "⏳..." : "🔄 إعادة تعيين الكل"}
          </button>
          <div style={{ fontSize: 9, color: t.txM, marginTop: 4, textAlign: "center" }}>لبداية السنة الجديدة</div>
        </div>
      </div>

      {/* Search */}
      {emps.length > 10 && (
        <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 بحث عن موظف..." style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, fontFamily: "inherit", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
      )}

      {/* Employee list */}
      <div style={{ background: t.card, borderRadius: 14, padding: 14, border: "1px solid " + t.sep }}>
        {filteredEmps.length === 0 ? (
          <div style={{ color: t.txM, fontSize: 12, padding: 30, textAlign: "center" }}>لا يوجد نتائج</div>
        ) : (
          filteredEmps.map(function(e){
            var bal = balances[e.id] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear };
            var initial = (e.name || "؟").trim().charAt(0);
            var empLeaves = leaves.filter(function(l){ return l.empId === e.id && l.status === "approved"; });
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: t.bg, marginBottom: 6, border: "1px solid " + t.sep, WebkitTapHighlightColor: "transparent" }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: B.blue + "22", color: B.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name || "موظف بدون اسم"}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["annual","sick","emergency","personal"].map(function(k){
                      var m = LEAVE_TYPES_META[k];
                      return (
                        <div key={k} style={{ padding: "3px 8px", borderRadius: 8, background: m.light, color: m.color, fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <span>{m.icon}</span><span>{bal[k] || 0}</span>
                        </div>
                      );
                    })}
                    {empLeaves.length > 0 && (
                      <button onClick={function(){ setShowHistory(e.id); }} style={{ padding: "3px 8px", borderRadius: 8, background: "rgba(110,110,115,0.1)", color: t.txM, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        📜 {empLeaves.length} معتمدة
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={function(){ setEditEmp(e); }} style={{ padding: "7px 12px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  ✎ تعديل
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      {editEmp && (
        <LeaveBalanceEditModal
          t={t}
          B={B}
          emp={editEmp}
          balance={balances[editEmp.id] || { annual: 21, sick: 30, emergency: 5, personal: 0, year: curYear }}
          onClose={function(){ setEditEmp(null); }}
          onSave={async function(newBal){
            await saveBalance(editEmp.id, newBal);
            setEditEmp(null);
          }}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <LeaveHistoryModal
          t={t}
          B={B}
          emp={emps.find(function(x){ return x.id === showHistory; })}
          leaves={leaves.filter(function(l){ return l.empId === showHistory; })}
          onClose={function(){ setShowHistory(null); }}
        />
      )}
    </div>
  );
}

function LeaveBalanceEditModal({ t, B, emp, balance, onClose, onSave }) {
  var [annual, setAnnual] = useState(balance.annual || 0);
  var [sick, setSick] = useState(balance.sick || 0);
  var [emergency, setEmergency] = useState(balance.emergency || 0);
  var [personal, setPersonal] = useState(balance.personal || 0);
  var [saving, setSaving] = useState(false);

  useEffect(function(){
    var prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return function(){ document.body.style.overflow = prev; };
  }, []);

  async function handleSave() {
    setSaving(true);
    await onSave({
      annual: parseInt(annual, 10) || 0,
      sick: parseInt(sick, 10) || 0,
      emergency: parseInt(emergency, 10) || 0,
      personal: parseInt(personal, 10) || 0,
    });
    setSaving(false);
  }

  function resetDefaults() {
    setAnnual(21); setSick(30); setEmergency(5); setPersonal(0);
  }

  var inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", fontWeight: 800, textAlign: "center" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 440, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>💰 تعديل رصيد الإجازات</div>
          <div style={{ fontSize: 11, color: t.txM, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name || "موظف"} · سنة {balance.year || new Date().getFullYear()}</div>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[
              { key: "annual", setter: setAnnual, val: annual },
              { key: "sick", setter: setSick, val: sick },
              { key: "emergency", setter: setEmergency, val: emergency },
              { key: "personal", setter: setPersonal, val: personal },
            ].map(function(f){
              var m = LEAVE_TYPES_META[f.key];
              return (
                <div key={f.key} style={{ padding: 12, borderRadius: 10, background: m.light, border: "1px solid " + m.color + "44" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: m.color, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{m.icon}</span><span>{m.label}</span>
                  </div>
                  <input type="number" min="0" value={f.val} onChange={function(e){ f.setter(e.target.value); }} style={inputStyle} />
                  <div style={{ fontSize: 9, color: t.txM, marginTop: 4, textAlign: "center" }}>أيام متبقية</div>
                </div>
              );
            })}
          </div>

          <button onClick={resetDefaults} style={{ width: "100%", padding: 10, borderRadius: 8, background: "transparent", color: t.tx, border: "1px dashed " + t.sep, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ↺ استعادة الافتراضيات (21 / 30 / 5 / 0)
          </button>

          <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.3)", fontSize: 11, color: "#D97706", fontWeight: 600, lineHeight: 1.6 }}>
            ⚠️ تنبيه: تعديل الرصيد لا يُلغي إجازات معتمدة سابقاً. يؤثر فقط على المتبقي.
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, background: saving ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
            {saving ? "جارِ الحفظ..." : "✓ حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaveHistoryModal({ t, B, emp, leaves, onClose }) {
  useEffect(function(){
    var prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return function(){ document.body.style.overflow = prev; };
  }, []);

  var statusMeta = {
    pending: { label: "قيد المراجعة", color: "#D97706", bg: "rgba(217,119,6,0.1)" },
    approved: { label: "معتمدة", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
    rejected: { label: "مرفوضة", color: "#DC2626", bg: "rgba(220,38,38,0.1)" },
  };

  // Sort by date desc
  var sorted = (leaves || []).slice().sort(function(a,b){ return (b.ts || "").localeCompare(a.ts || ""); });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 540, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>📜 سجل الإجازات</div>
            <div style={{ fontSize: 11, color: t.txM, marginTop: 3 }}>{emp && emp.name} · {sorted.length} طلب</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: t.txM, cursor: "pointer", padding: 4 }}>×</button>
        </div>

        <div style={{ padding: 14 }}>
          {sorted.length === 0 ? (
            <div style={{ color: t.txM, fontSize: 12, padding: 30, textAlign: "center" }}>لا توجد إجازات</div>
          ) : (
            sorted.map(function(l){
              var s = statusMeta[l.status] || { label: l.status, color: t.txM, bg: t.bg };
              var m = LEAVE_TYPES_META[l.type] || { label: l.type, icon: "📋", color: t.txM };
              return (
                <div key={l.id} style={{ padding: 12, borderRadius: 10, background: t.bg, marginBottom: 8, border: "1px solid " + t.sep }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 8, background: m.color + "22", color: m.color, fontSize: 11, fontWeight: 700 }}>
                      <span>{m.icon}</span><span>{m.label}</span>
                    </div>
                    <div style={{ padding: "3px 8px", borderRadius: 8, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700 }}>{s.label}</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.tx, marginBottom: 4 }}>
                    <strong>{l.days || 1}</strong> يوم · من {l.from} إلى {l.to}
                  </div>
                  {l.reason && <div style={{ fontSize: 10, color: t.txM, fontStyle: "italic" }}>"{l.reason}"</div>}
                  <div style={{ fontSize: 9, color: t.txM, marginTop: 4 }}>
                    📅 قُدِّم: {l.ts ? new Date(l.ts).toLocaleDateString("ar-SA") : "—"}
                    {l.decidedAt && " · قُرِّر: " + new Date(l.decidedAt).toLocaleDateString("ar-SA")}
                  </div>
                  {l.rejectReason && <div style={{ fontSize: 10, color: "#DC2626", marginTop: 4 }}>❌ سبب الرفض: {l.rejectReason}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ SYSTEM SETTINGS — إعدادات النظام العامة (v6.55) ═══ */
function SystemSettingsPanel({ t, B }) {
  var [settings, setSettings] = useState(null);
  var [draft, setDraft] = useState(null);
  var [loading, setLoading] = useState(true);
  var [saving, setSaving] = useState(false);
  var [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    try {
      var r = await fetch("/api/data?action=settings");
      var d = await r.json();
      var defaults = {
        // Attendance grace
        lateGraceMinutes: 15,
        autoCheckoutHours: 11,
        // Late penalties thresholds
        lateWarningThreshold: 3,
        absentWarningThreshold: 2,
        breakViolationThreshold: 3,
        // Break rules
        breakWindowStart: "12:30",
        breakWindowEnd: "13:00",
        breakGraceMinutes: 5,
        // Leave rules
        defaultAnnualLeave: 21,
        defaultSickLeave: 30,
        defaultEmergencyLeave: 5,
        defaultPersonalLeave: 0,
        annualLeaveCarryOver: false,
        maxCarryOverDays: 0,
        // Work types defaults
        fullTimeHours: 8,
        flexContractHours: 9,
        // Notifications
        dailyReminderTime: "08:00",
        dailyReminderEnabled: true,
        // Face recognition
        faceMatchThreshold: 55,
        // Legal
        companyName: "مكتب هاني محمد عسيري للاستشارات الهندسية",
        lawReference: "978004",
      };
      var merged = Object.assign(defaults, d || {});
      setSettings(merged);
      setDraft(Object.assign({}, merged));
    } catch(e) {}
    setLoading(false);
  }

  useEffect(function(){ load(); }, []);

  async function save() {
    setSaving(true);
    try {
      var r = await fetch("/api/data?action=settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      var d = await r.json();
      if (d && d.ok) {
        setSettings(Object.assign({}, draft));
        setSaved(true);
        setTimeout(function(){ setSaved(false); }, 3000);
      } else {
        alert("فشل الحفظ");
      }
    } catch(e) { alert("خطأ: " + (e.message || "")); }
    setSaving(false);
  }

  function reset() {
    if (window.confirm("إعادة الإعدادات إلى القيم الحالية المحفوظة؟")) {
      setDraft(Object.assign({}, settings));
    }
  }

  function upd(k, v) { setDraft(Object.assign({}, draft, (function(){ var x = {}; x[k] = v; return x; })())); }

  if (loading || !draft) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  var hasChanges = JSON.stringify(settings) !== JSON.stringify(draft);

  var inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  var lblStyle = { fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 };
  var hintStyle = { fontSize: 9, color: t.txM, marginTop: 4, fontStyle: "italic" };

  function Section(props) {
    return (
      <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: B.blue, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid " + t.sep, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{props.icon}</span><span>{props.title}</span>
        </div>
        {props.children}
      </div>
    );
  }

  function Field(props) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={lblStyle}>{props.label}</div>
        {props.children}
        {props.hint && <div style={hintStyle}>{props.hint}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>⚙️ إعدادات النظام</div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>قواعد الحضور والجزاءات والإشعارات — تطبّق فوراً</div>
        </div>
        {saved && <div style={{ padding: "8px 14px", borderRadius: 10, background: "#10B981", color: "#fff", fontSize: 12, fontWeight: 800 }}>✓ تم الحفظ</div>}
      </div>

      {/* Section 1: Attendance */}
      <Section icon="⏰" title="قواعد الحضور">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="فترة السماح للتأخير (دقائق)" hint="بعدها يُعدّ الموظف متأخراً">
            <input type="number" min="0" max="60" value={draft.lateGraceMinutes} onChange={function(e){ upd("lateGraceMinutes", parseInt(e.target.value, 10) || 0); }} style={inputStyle} />
          </Field>
          <Field label="الانصراف التلقائي بعد (ساعات)" hint="لو لم يسجل انصراف، يُسجّل تلقائياً">
            <input type="number" min="6" max="24" value={draft.autoCheckoutHours} onChange={function(e){ upd("autoCheckoutHours", parseInt(e.target.value, 10) || 11); }} style={inputStyle} />
          </Field>
        </div>
      </Section>

      {/* Section 2: Break */}
      <Section icon="☕" title="قواعد الاستراحة">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="بداية النافذة" hint="الوقت الإلزامي">
            <input type="time" value={draft.breakWindowStart} onChange={function(e){ upd("breakWindowStart", e.target.value); }} style={inputStyle} />
          </Field>
          <Field label="نهاية النافذة">
            <input type="time" value={draft.breakWindowEnd} onChange={function(e){ upd("breakWindowEnd", e.target.value); }} style={inputStyle} />
          </Field>
          <Field label="دقائق السماح ±" hint="قبل وبعد النافذة">
            <input type="number" min="0" max="30" value={draft.breakGraceMinutes} onChange={function(e){ upd("breakGraceMinutes", parseInt(e.target.value, 10) || 5); }} style={inputStyle} />
          </Field>
        </div>
      </Section>

      {/* Section 3: Auto-Warning thresholds */}
      <Section icon="⚠️" title="عتبات الإنذارات التلقائية">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="إنذار بعد عدد تأخيرات" hint="خلال 30 يوماً">
            <input type="number" min="1" max="10" value={draft.lateWarningThreshold} onChange={function(e){ upd("lateWarningThreshold", parseInt(e.target.value, 10) || 3); }} style={inputStyle} />
          </Field>
          <Field label="إنذار بعد عدد أيام غياب" hint="خلال 30 يوماً">
            <input type="number" min="1" max="10" value={draft.absentWarningThreshold} onChange={function(e){ upd("absentWarningThreshold", parseInt(e.target.value, 10) || 2); }} style={inputStyle} />
          </Field>
          <Field label="إنذار بعد مخالفات استراحة" hint="خلال 30 يوماً">
            <input type="number" min="1" max="10" value={draft.breakViolationThreshold} onChange={function(e){ upd("breakViolationThreshold", parseInt(e.target.value, 10) || 3); }} style={inputStyle} />
          </Field>
        </div>
      </Section>

      {/* Section 4: Leaves defaults */}
      <Section icon="🏖️" title="أرصدة الإجازات الافتراضية (أيام/سنة)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <Field label="سنوية 🏖️">
            <input type="number" min="0" max="60" value={draft.defaultAnnualLeave} onChange={function(e){ upd("defaultAnnualLeave", parseInt(e.target.value, 10) || 21); }} style={inputStyle} />
          </Field>
          <Field label="مرضية 🏥">
            <input type="number" min="0" max="365" value={draft.defaultSickLeave} onChange={function(e){ upd("defaultSickLeave", parseInt(e.target.value, 10) || 30); }} style={inputStyle} />
          </Field>
          <Field label="طارئة ⚡">
            <input type="number" min="0" max="30" value={draft.defaultEmergencyLeave} onChange={function(e){ upd("defaultEmergencyLeave", parseInt(e.target.value, 10) || 5); }} style={inputStyle} />
          </Field>
          <Field label="شخصية 👤">
            <input type="number" min="0" max="30" value={draft.defaultPersonalLeave} onChange={function(e){ upd("defaultPersonalLeave", parseInt(e.target.value, 10) || 0); }} style={inputStyle} />
          </Field>
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: t.tx }}>
            <input type="checkbox" checked={!!draft.annualLeaveCarryOver} onChange={function(e){ upd("annualLeaveCarryOver", e.target.checked); }} />
            <span>السماح بترحيل الإجازة السنوية للسنة التالية</span>
          </label>
          {draft.annualLeaveCarryOver && (
            <div style={{ marginTop: 8, marginRight: 24 }}>
              <div style={lblStyle}>الحد الأقصى للأيام المُرحَّلة</div>
              <input type="number" min="0" max="30" value={draft.maxCarryOverDays} onChange={function(e){ upd("maxCarryOverDays", parseInt(e.target.value, 10) || 0); }} style={Object.assign({}, inputStyle, { maxWidth: 120 })} />
            </div>
          )}
        </div>
      </Section>

      {/* Section 5: Work types */}
      <Section icon="💼" title="ساعات العمل الافتراضية">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="دوام كامل (ساعات/يوم)">
            <input type="number" min="4" max="12" step="0.5" value={draft.fullTimeHours} onChange={function(e){ upd("fullTimeHours", parseFloat(e.target.value) || 8); }} style={inputStyle} />
          </Field>
          <Field label="عقد مرن (ساعات/يوم)">
            <input type="number" min="4" max="14" step="0.5" value={draft.flexContractHours} onChange={function(e){ upd("flexContractHours", parseFloat(e.target.value) || 9); }} style={inputStyle} />
          </Field>
        </div>
      </Section>

      {/* Section 6: Notifications */}
      <Section icon="🔔" title="الإشعارات والتذكيرات">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="وقت تذكير الحضور اليومي" hint="قبل موعد الدوام">
            <input type="time" value={draft.dailyReminderTime} onChange={function(e){ upd("dailyReminderTime", e.target.value); }} style={inputStyle} />
          </Field>
          <Field label="تفعيل التذكير اليومي">
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, cursor: "pointer", fontSize: 12 }}>
              <input type="checkbox" checked={!!draft.dailyReminderEnabled} onChange={function(e){ upd("dailyReminderEnabled", e.target.checked); }} />
              <span style={{ color: t.tx }}>{draft.dailyReminderEnabled ? "مفعَّل" : "معطَّل"}</span>
            </label>
          </Field>
        </div>
      </Section>

      {/* Section 7: Face recognition */}
      <Section icon="👤" title="التعرف على الوجه">
        <Field label={"عتبة المطابقة: " + draft.faceMatchThreshold + "%"} hint="النسبة المطلوبة لاعتبار الوجه مطابقاً — زيادتها تعني صرامة أكبر">
          <input type="range" min="30" max="95" step="5" value={draft.faceMatchThreshold} onChange={function(e){ upd("faceMatchThreshold", parseInt(e.target.value, 10)); }} style={{ width: "100%", accentColor: B.blue }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.txM, marginTop: 4 }}>
            <span>30% (متساهل)</span>
            <span>65% (متوازن)</span>
            <span>95% (صارم)</span>
          </div>
        </Field>
      </Section>

      {/* Section 8: Legal */}
      <Section icon="📜" title="بيانات قانونية">
        <Field label="اسم المكتب (يظهر في PDFs)">
          <input type="text" value={draft.companyName} onChange={function(e){ upd("companyName", e.target.value); }} style={inputStyle} />
        </Field>
        <Field label="رقم اعتماد لائحة العمل">
          <input type="text" value={draft.lawReference} onChange={function(e){ upd("lawReference", e.target.value); }} style={inputStyle} />
        </Field>
      </Section>

      {/* Action bar */}
      <div style={{ position: "sticky", bottom: 0, padding: 14, background: t.card, borderRadius: 14, border: "1px solid " + (hasChanges ? B.gold : t.sep), display: "flex", gap: 10, alignItems: "center", boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
        <div style={{ flex: 1, fontSize: 11, color: hasChanges ? B.gold : t.txM, fontWeight: 700 }}>
          {hasChanges ? "⚠️ تغييرات غير محفوظة" : "✓ جميع التغييرات محفوظة"}
        </div>
        <button onClick={reset} disabled={!hasChanges || saving} style={{ padding: "10px 16px", borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 12, fontWeight: 700, cursor: hasChanges ? "pointer" : "default", opacity: hasChanges ? 1 : 0.5, fontFamily: "inherit" }}>↺ إعادة</button>
        <button onClick={save} disabled={!hasChanges || saving} style={{ padding: "10px 24px", borderRadius: 10, background: hasChanges ? B.blue : t.sep, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: hasChanges && !saving ? "pointer" : "default", fontFamily: "inherit" }}>
          {saving ? "جارِ الحفظ..." : "💾 حفظ الإعدادات"}
        </button>
      </div>
    </div>
  );
}

/* ═══ ATTENDANCE INSIGHTS — ذكاء الحضور وتصدير الرواتب (v6.54) ═══ */
function AttendanceInsightsPanel({ t, B, emps }) {
  var [attendance, setAttendance] = useState([]);
  var [leaves, setLeaves] = useState([]);
  var [violations, setViolations] = useState([]);
  var [loading, setLoading] = useState(true);
  var [locks, setLocks] = useState([]); // v6.58
  var [month, setMonth] = useState(function(){
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  });
  var [livePulse, setLivePulse] = useState({ present: [], late: [], onBreak: [], notIn: [], onLeave: [] });

  async function loadAll() {
    setLoading(true);
    try {
      var [att, lv, viosV2, lks] = await Promise.all([
        fetch("/api/data?action=attendance").then(function(r){ return r.json(); }).catch(function(){ return []; }),
        fetch("/api/data?action=leaves").then(function(r){ return r.json(); }).catch(function(){ return []; }),
        fetch("/api/data?action=violations_v2").then(function(r){ return r.json(); }).catch(function(){ return []; }),
        fetch("/api/data?action=attendance-locks").then(function(r){ return r.json(); }).catch(function(){ return []; }),
      ]);
      setAttendance(Array.isArray(att) ? att : []);
      setLeaves(Array.isArray(lv) ? lv : []);
      setViolations(Array.isArray(viosV2) ? viosV2 : []);
      setLocks(Array.isArray(lks) ? lks : []);
    } catch(e) {}
    setLoading(false);
  }

  var currentLock = locks.find(function(l){ return l.month === month; });

  async function toggleLock() {
    if (currentLock) {
      if (!window.confirm("فك قفل شهر " + month + "؟ سيتاح التعديل على سجل الحضور مرة أخرى.")) return;
      try {
        var r = await fetch("/api/data?action=attendance-locks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: month }),
        });
        if (r.ok) { alert("✓ تم فك القفل"); loadAll(); }
      } catch(e) {}
    } else {
      var note = window.prompt("ملاحظة (اختياري) — مثال: معالجة الرواتب شهر " + month + ":", "معالجة الرواتب");
      if (note === null) return;
      try {
        var r = await fetch("/api/data?action=attendance-locks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: month, note: note }),
        });
        var d = await r.json();
        if (d.ok) { alert("🔒 تم قفل شهر " + month); loadAll(); }
        else alert("خطأ: " + (d.error || ""));
      } catch(e) {}
    }
  }

  useEffect(function(){ loadAll(); }, []);

  // Compute live pulse every 30 sec
  useEffect(function(){
    function updatePulse() {
      var todayStr = new Date().toISOString().split("T")[0];
      var todayAtt = attendance.filter(function(a){
        return (a.date === todayStr) || (a.ts && a.ts.startsWith(todayStr));
      });
      var todayLeaves = leaves.filter(function(l){
        if (l.status !== "approved") return false;
        return (l.from && l.from <= todayStr && l.to && l.to >= todayStr);
      });

      var present = [], late = [], onBreak = [], notIn = [], onLeave = [];
      emps.forEach(function(e){
        var myLeave = todayLeaves.find(function(l){ return l.empId === e.id; });
        if (myLeave) { onLeave.push({ emp: e, leave: myLeave }); return; }
        var myAtt = todayAtt.filter(function(a){ return a.empId === e.id; });
        var checkin = myAtt.find(function(a){ return a.type === "checkin"; });
        var checkout = myAtt.find(function(a){ return a.type === "checkout"; });
        var breakStart = myAtt.find(function(a){ return a.type === "break_start"; });
        var breakEnd = myAtt.find(function(a){ return a.type === "break_end"; });
        if (!checkin) { notIn.push(e); return; }
        if (checkout) return; // already left
        if (breakStart && !breakEnd) { onBreak.push(e); return; }
        // Check if late (after 8:30 by default)
        var checkinTime = new Date(checkin.ts);
        if (checkinTime.getHours() >= 9 || (checkinTime.getHours() === 8 && checkinTime.getMinutes() > 45)) {
          late.push(e);
        } else {
          present.push(e);
        }
      });
      setLivePulse({ present: present, late: late, onBreak: onBreak, notIn: notIn, onLeave: onLeave });
    }
    updatePulse();
    var interval = setInterval(updatePulse, 30000);
    return function(){ clearInterval(interval); };
  }, [attendance, leaves, emps]);

  // Compute monthly stats per employee
  function computeMonthlyStats(empId) {
    var monthPrefix = month; // "2026-04"
    var monthAtt = attendance.filter(function(a){
      var dt = a.date || (a.ts && a.ts.split("T")[0]) || "";
      return a.empId === empId && dt.startsWith(monthPrefix);
    });
    var monthLeaves = leaves.filter(function(l){
      return l.empId === empId && l.status === "approved" && (l.from || "").startsWith(monthPrefix);
    });
    var monthVios = violations.filter(function(v){
      return v.empId === empId && (v.createdAt || "").startsWith(monthPrefix);
    });

    // Group by date
    var byDate = {};
    monthAtt.forEach(function(a){
      var dt = a.date || (a.ts && a.ts.split("T")[0]);
      if (!dt) return;
      if (!byDate[dt]) byDate[dt] = { checkin: null, checkout: null, breakS: null, breakE: null };
      if (a.type === "checkin") byDate[dt].checkin = a;
      if (a.type === "checkout") byDate[dt].checkout = a;
      if (a.type === "break_start") byDate[dt].breakS = a;
      if (a.type === "break_end") byDate[dt].breakE = a;
    });

    var workDays = 0, lateDays = 0, absentDays = 0;
    var totalMinutes = 0, lateMinutes = 0;
    Object.keys(byDate).forEach(function(dt){
      var day = byDate[dt];
      if (!day.checkin) { absentDays++; return; }
      workDays++;
      var cin = new Date(day.checkin.ts);
      // Late if after 8:45
      if (cin.getHours() >= 9 || (cin.getHours() === 8 && cin.getMinutes() > 45)) {
        lateDays++;
        var lateMin = (cin.getHours() * 60 + cin.getMinutes()) - (8 * 60 + 30);
        if (lateMin > 0) lateMinutes += lateMin;
      }
      if (day.checkout) {
        var cout = new Date(day.checkout.ts);
        var workMin = (cout - cin) / 60000;
        // Subtract break
        if (day.breakS && day.breakE) {
          var brMin = (new Date(day.breakE.ts) - new Date(day.breakS.ts)) / 60000;
          if (brMin > 0) workMin -= brMin;
        }
        if (workMin > 0) totalMinutes += workMin;
      }
    });

    var leaveDays = monthLeaves.reduce(function(sum, l){ return sum + (l.days || 1); }, 0);

    return {
      workDays: workDays,
      lateDays: lateDays,
      absentDays: absentDays,
      leaveDays: leaveDays,
      workHours: (totalMinutes / 60).toFixed(1),
      lateMinutes: lateMinutes,
      violations: monthVios.length,
      penalty: monthVios.filter(function(v){ return v.penaltyCode && v.penaltyCode.indexOf("DEDUCT") >= 0; }).length,
    };
  }

  function exportPayrollCSV() {
    var header = ["الرقم", "الاسم", "الفرع", "المسمى", "أيام العمل", "أيام التأخير", "أيام الغياب", "أيام الإجازة", "مجموع ساعات العمل", "دقائق التأخير", "عدد المخالفات", "جزاءات خصم"];
    var rows = [header.join(",")];
    emps.forEach(function(e){
      var s = computeMonthlyStats(e.id);
      rows.push([
        '"' + (e.id || '') + '"',
        '"' + (e.name || '').replace(/"/g, '""') + '"',
        '"' + (e.branch || '') + '"',
        '"' + (e.role || '') + '"',
        s.workDays,
        s.lateDays,
        s.absentDays,
        s.leaveDays,
        s.workHours,
        s.lateMinutes,
        s.violations,
        s.penalty,
      ].join(","));
    });
    var csv = "\uFEFF" + rows.join("\n"); // BOM for Arabic Excel support
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "كشف_راتب_" + month + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ تحليل البيانات...</div>;

  var pulseCards = [
    { key: "present", label: "حضور منتظم", icon: "✅", color: "#10B981", list: livePulse.present },
    { key: "late", label: "متأخرون", icon: "⏰", color: "#F59E0B", list: livePulse.late },
    { key: "onBreak", label: "استراحة", icon: "☕", color: "#0EA5E9", list: livePulse.onBreak },
    { key: "onLeave", label: "إجازة", icon: "🏖️", color: "#7C3AED", list: livePulse.onLeave },
    { key: "notIn", label: "لم يحضر بعد", icon: "❌", color: "#DC2626", list: livePulse.notIn },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📈 ذكاء الحضور</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>نبض حي · تحليل شهري · تصدير كشف الرواتب</div>
      </div>

      {/* Live Pulse */}
      <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>🔴 نبض الآن (Live)</div>
          <div style={{ fontSize: 10, color: t.txM, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }}></span>
            يتحدث كل 30 ثانية
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {pulseCards.map(function(card){
            return (
              <div key={card.key} style={{ padding: 14, borderRadius: 12, background: card.color + "10", border: "1px solid " + card.color + "30" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>{card.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: card.color }}>{card.list.length}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: card.color, marginBottom: 6 }}>{card.label}</div>
                {card.list.length > 0 && (
                  <div style={{ fontSize: 9, color: t.tx2, lineHeight: 1.6, maxHeight: 70, overflow: "hidden" }}>
                    {card.list.slice(0, 3).map(function(item){
                      var n = item.emp ? item.emp.name : item.name;
                      return n;
                    }).filter(Boolean).join("، ")}
                    {card.list.length > 3 && " + " + (card.list.length - 3) + " آخرين"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly analysis + payroll export */}
      <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>📊 تحليل شهري وكشف الرواتب</div>
            {currentLock && (
              <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                🔒 مقفل بواسطة {currentLock.lockedBy} في {new Date(currentLock.lockedAt).toLocaleDateString("ar-SA")}
                {currentLock.note && " · " + currentLock.note}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="month" value={month} onChange={function(e){ setMonth(e.target.value); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <button onClick={toggleLock} style={{ padding: "8px 14px", borderRadius: 8, background: currentLock ? "#DC2626" : "#F59E0B", color: "#fff", border: "none", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {currentLock ? "🔓 فك القفل" : "🔒 قفل الشهر"}
            </button>
            <button onClick={exportPayrollCSV} style={{ padding: "8px 16px", borderRadius: 8, background: "#10B981", color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              📥 تصدير CSV
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: B.blue + "15" }}>
                <th style={{ padding: 10, textAlign: "right", fontWeight: 800, color: B.blue }}>الموظف</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>أيام العمل</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>التأخير</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>الغياب</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>الإجازة</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>ساعات العمل</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>دقائق التأخير</th>
                <th style={{ padding: 10, textAlign: "center", fontWeight: 800, color: B.blue }}>المخالفات</th>
              </tr>
            </thead>
            <tbody>
              {emps.map(function(e, i){
                var s = computeMonthlyStats(e.id);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid " + t.sep, background: i % 2 === 0 ? t.bg : "transparent" }}>
                    <td style={{ padding: 10, fontWeight: 700, color: t.tx }}>{e.name}</td>
                    <td style={{ padding: 10, textAlign: "center", color: "#10B981", fontWeight: 800 }}>{s.workDays}</td>
                    <td style={{ padding: 10, textAlign: "center", color: s.lateDays > 0 ? "#F59E0B" : t.txM, fontWeight: s.lateDays > 0 ? 800 : 400 }}>{s.lateDays}</td>
                    <td style={{ padding: 10, textAlign: "center", color: s.absentDays > 0 ? "#DC2626" : t.txM, fontWeight: s.absentDays > 0 ? 800 : 400 }}>{s.absentDays}</td>
                    <td style={{ padding: 10, textAlign: "center", color: "#7C3AED", fontWeight: s.leaveDays > 0 ? 800 : 400 }}>{s.leaveDays}</td>
                    <td style={{ padding: 10, textAlign: "center", color: t.tx, fontWeight: 700 }}>{s.workHours}</td>
                    <td style={{ padding: 10, textAlign: "center", color: s.lateMinutes > 0 ? "#F59E0B" : t.txM }}>{s.lateMinutes}</td>
                    <td style={{ padding: 10, textAlign: "center", color: s.violations > 0 ? "#DC2626" : t.txM, fontWeight: s.violations > 0 ? 800 : 400 }}>{s.violations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights / patterns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
        {/* Top 3 most punctual */}
        <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981", marginBottom: 10 }}>🏆 الأكثر انضباطاً</div>
          {(function(){
            var ranked = emps.map(function(e){ return { e: e, s: computeMonthlyStats(e.id) }; })
              .filter(function(x){ return x.s.workDays > 0; })
              .sort(function(a,b){ return a.s.lateDays - b.s.lateDays || a.s.lateMinutes - b.s.lateMinutes; })
              .slice(0, 3);
            return ranked.map(function(x, i){
              return (
                <div key={x.e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 2 ? "1px solid " + t.sep : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{["🥇","🥈","🥉"][i]}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{x.e.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#10B981", fontWeight: 800 }}>{x.s.lateDays} تأخير</span>
                </div>
              );
            });
          })()}
        </div>
        {/* Needs attention */}
        <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#DC2626", marginBottom: 10 }}>⚠️ يحتاج متابعة</div>
          {(function(){
            var ranked = emps.map(function(e){ return { e: e, s: computeMonthlyStats(e.id) }; })
              .filter(function(x){ return x.s.lateDays > 0 || x.s.absentDays > 0 || x.s.violations > 0; })
              .sort(function(a,b){ return (b.s.lateDays + b.s.absentDays * 2 + b.s.violations * 3) - (a.s.lateDays + a.s.absentDays * 2 + a.s.violations * 3); })
              .slice(0, 3);
            if (ranked.length === 0) return <div style={{ fontSize: 11, color: t.txM, padding: 10 }}>✓ لا مشاكل هذا الشهر</div>;
            return ranked.map(function(x, i){
              return (
                <div key={x.e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < ranked.length - 1 ? "1px solid " + t.sep : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{x.e.name}</span>
                  <div style={{ fontSize: 10, color: t.txM }}>
                    {x.s.lateDays > 0 && <span style={{ color: "#F59E0B", fontWeight: 800 }}>⏰{x.s.lateDays} </span>}
                    {x.s.absentDays > 0 && <span style={{ color: "#DC2626", fontWeight: 800 }}>❌{x.s.absentDays} </span>}
                    {x.s.violations > 0 && <span style={{ color: "#DC2626", fontWeight: 800 }}>⚖️{x.s.violations}</span>}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {/* Overall stats */}
        <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: B.blue, marginBottom: 10 }}>📊 إحصائيات الشهر</div>
          {(function(){
            var totals = { workDays: 0, lateDays: 0, absentDays: 0, leaveDays: 0, workHours: 0, lateMinutes: 0 };
            emps.forEach(function(e){
              var s = computeMonthlyStats(e.id);
              totals.workDays += s.workDays;
              totals.lateDays += s.lateDays;
              totals.absentDays += s.absentDays;
              totals.leaveDays += s.leaveDays;
              totals.workHours += parseFloat(s.workHours || 0);
              totals.lateMinutes += s.lateMinutes;
            });
            var punctualityRate = totals.workDays > 0 ? Math.round(((totals.workDays - totals.lateDays) / totals.workDays) * 100) : 0;
            return (
              <div style={{ fontSize: 11, color: t.tx, lineHeight: 2 }}>
                <div>📅 <strong>{totals.workDays}</strong> إجمالي أيام حضور</div>
                <div>⏰ <strong>{totals.lateDays}</strong> يوم تأخير (<strong>{totals.lateMinutes}</strong> دقيقة)</div>
                <div>❌ <strong>{totals.absentDays}</strong> يوم غياب</div>
                <div>🏖️ <strong>{totals.leaveDays}</strong> يوم إجازة</div>
                <div>⏱ <strong>{totals.workHours.toFixed(0)}</strong> إجمالي ساعات العمل</div>
                <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: punctualityRate >= 90 ? "rgba(16,185,129,0.15)" : punctualityRate >= 75 ? "rgba(245,158,11,0.15)" : "rgba(220,38,38,0.15)", color: punctualityRate >= 90 ? "#10B981" : punctualityRate >= 75 ? "#F59E0B" : "#DC2626", fontWeight: 800, textAlign: "center" }}>
                  نسبة الانضباط: {punctualityRate}%
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

/* ═══ BRANCHES PANEL — إدارة الفروع (v6.53) ═══ */
function BranchesPanel({ t, B }) {
  var [branches, setBranches] = useState([]);
  var [loading, setLoading] = useState(true);
  var [editing, setEditing] = useState(null); // index being edited
  var [draft, setDraft] = useState(null);
  var [adding, setAdding] = useState(false);
  var [saving, setSaving] = useState(false);
  var [locating, setLocating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      var r = await fetch("/api/data?action=branches");
      var d = await r.json();
      setBranches(Array.isArray(d) ? d : []);
    } catch(e) {}
    setLoading(false);
  }

  useEffect(function(){ load(); }, []);

  async function saveAll(newList) {
    setSaving(true);
    try {
      var r = await fetch("/api/data?action=branches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newList),
      });
      var d = await r.json();
      if (d && d.ok) {
        setBranches(newList);
        return true;
      }
    } catch(e) {}
    setSaving(false);
    return false;
  }

  function openEdit(b, idx) {
    setEditing(idx);
    setDraft(Object.assign({}, b));
    setAdding(false);
  }

  function openAdd() {
    var id = "br" + Date.now();
    setDraft({ id: id, name: "", start: "08:30", end: "17:00", breakS: "12:30", breakE: "13:00", offDay: "friday", tz: "Asia/Riyadh", radius: 150, lat: 21.5433, lng: 39.1728 });
    setAdding(true);
    setEditing(branches.length);
  }

  function close() { setEditing(null); setDraft(null); setAdding(false); }

  async function save() {
    if (!draft.name || !draft.id) { alert("الاسم ومعرف الفرع مطلوبان"); return; }
    var list;
    if (adding) list = branches.concat([draft]);
    else { list = branches.slice(); list[editing] = draft; }
    if (await saveAll(list)) close();
    else alert("فشل الحفظ");
  }

  async function remove(idx) {
    if (!window.confirm("حذف الفرع " + branches[idx].name + "؟")) return;
    var list = branches.filter(function(_, i){ return i !== idx; });
    await saveAll(list);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { alert("المتصفح لا يدعم GPS"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(function(pos){
      setDraft(Object.assign({}, draft, { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }));
      setLocating(false);
    }, function(err){
      alert("تعذّر جلب الموقع: " + (err.message || ""));
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  var dayOptions = [
    { v: "friday", l: "الجمعة" },
    { v: "saturday", l: "السبت" },
    { v: "sunday", l: "الأحد" },
  ];
  var tzOptions = [
    { v: "Asia/Riyadh", l: "الرياض (UTC+3)" },
    { v: "Europe/Istanbul", l: "اسطنبول (UTC+3)" },
    { v: "Asia/Dubai", l: "دبي (UTC+4)" },
    { v: "Africa/Cairo", l: "القاهرة (UTC+2)" },
  ];

  var inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🏢 إدارة الفروع</div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>{branches.length} فرع · إعدادات GPS وساعات العمل</div>
        </div>
        <button onClick={openAdd} style={{ padding: "10px 16px", borderRadius: 10, background: B.gold, color: "#000", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ فرع جديد</button>
      </div>

      {/* Branches list */}
      <div style={{ display: "grid", gap: 12 }}>
        {branches.map(function(b, idx){
          return (
            <div key={b.id + idx} style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.tx, marginBottom: 4 }}>{b.name}</div>
                  <div style={{ fontSize: 10, color: t.txM, fontFamily: "monospace" }}>{b.id} · {b.tz}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={function(){ openEdit(b, idx); }} style={{ padding: "6px 12px", borderRadius: 6, background: B.blue + "15", color: B.blue, border: "1px solid " + B.blue + "40", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✎ تعديل</button>
                  <button onClick={function(){ remove(idx); }} style={{ padding: "6px 12px", borderRadius: 6, background: "#FEE", color: "#DC2626", border: "1px solid #DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 حذف</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                  <div style={{ fontSize: 9, color: t.txM, fontWeight: 700 }}>⏰ ساعات العمل</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginTop: 4 }}>{b.start} → {b.end}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                  <div style={{ fontSize: 9, color: t.txM, fontWeight: 700 }}>☕ الاستراحة</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginTop: 4 }}>{b.breakS} → {b.breakE}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                  <div style={{ fontSize: 9, color: t.txM, fontWeight: 700 }}>📅 يوم العطلة</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginTop: 4 }}>{dayOptions.find(function(d){ return d.v === b.offDay; }) ? dayOptions.find(function(d){ return d.v === b.offDay; }).l : b.offDay}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                  <div style={{ fontSize: 9, color: t.txM, fontWeight: 700 }}>📍 نطاق GPS</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginTop: 4 }}>{b.radius} متر</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep, gridColumn: "span 2" }}>
                  <div style={{ fontSize: 9, color: t.txM, fontWeight: 700 }}>🗺️ الإحداثيات</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: t.tx, marginTop: 4, fontFamily: "monospace" }}>{b.lat}, {b.lng}</div>
                  <a href={"https://maps.google.com/?q=" + b.lat + "," + b.lng} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: B.blue, textDecoration: "none", fontWeight: 700 }}>📍 افتح في Google Maps</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {draft && (
        <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 540, width: "100%", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.tx }}>{adding ? "🏢 فرع جديد" : "🏢 تعديل فرع"}</div>
              <button onClick={close} style={{ background: "none", border: "none", fontSize: 22, color: t.txM, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>الاسم</div>
                  <input type="text" value={draft.name} onChange={function(e){ setDraft(Object.assign({}, draft, { name: e.target.value })); }} placeholder="مثال: المكتب الرئيسي - جدة" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>المعرف (ID)</div>
                  <input type="text" value={draft.id} onChange={function(e){ setDraft(Object.assign({}, draft, { id: e.target.value })); }} disabled={!adding} style={Object.assign({}, inputStyle, { fontFamily: "monospace", opacity: adding ? 1 : 0.6 })} />
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: B.blue, marginTop: 14, marginBottom: 8 }}>⏰ ساعات العمل والاستراحة</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>بداية الدوام</div>
                  <input type="time" value={draft.start} onChange={function(e){ setDraft(Object.assign({}, draft, { start: e.target.value })); }} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>نهاية الدوام</div>
                  <input type="time" value={draft.end} onChange={function(e){ setDraft(Object.assign({}, draft, { end: e.target.value })); }} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>بداية الاستراحة</div>
                  <input type="time" value={draft.breakS} onChange={function(e){ setDraft(Object.assign({}, draft, { breakS: e.target.value })); }} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>نهاية الاستراحة</div>
                  <input type="time" value={draft.breakE} onChange={function(e){ setDraft(Object.assign({}, draft, { breakE: e.target.value })); }} style={inputStyle} />
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: B.blue, marginTop: 14, marginBottom: 8 }}>📅 التقويم</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>يوم العطلة</div>
                  <select value={draft.offDay} onChange={function(e){ setDraft(Object.assign({}, draft, { offDay: e.target.value })); }} style={Object.assign({}, inputStyle, { background: "#fff", color: "#000" })}>
                    {dayOptions.map(function(d){ return <option key={d.v} value={d.v}>{d.l}</option>; })}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>المنطقة الزمنية</div>
                  <select value={draft.tz} onChange={function(e){ setDraft(Object.assign({}, draft, { tz: e.target.value })); }} style={Object.assign({}, inputStyle, { background: "#fff", color: "#000" })}>
                    {tzOptions.map(function(z){ return <option key={z.v} value={z.v}>{z.l}</option>; })}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: B.blue, marginTop: 14, marginBottom: 8 }}>📍 الموقع الجغرافي (GPS)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>خط العرض (lat)</div>
                  <input type="number" step="0.000001" value={draft.lat} onChange={function(e){ setDraft(Object.assign({}, draft, { lat: parseFloat(e.target.value) || 0 })); }} style={Object.assign({}, inputStyle, { fontFamily: "monospace" })} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>خط الطول (lng)</div>
                  <input type="number" step="0.000001" value={draft.lng} onChange={function(e){ setDraft(Object.assign({}, draft, { lng: parseFloat(e.target.value) || 0 })); }} style={Object.assign({}, inputStyle, { fontFamily: "monospace" })} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>النطاق (متر)</div>
                  <input type="number" min="30" max="1000" step="10" value={draft.radius} onChange={function(e){ setDraft(Object.assign({}, draft, { radius: parseInt(e.target.value, 10) || 100 })); }} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={useMyLocation} disabled={locating} style={{ flex: 1, padding: 10, borderRadius: 8, background: B.gold + "20", color: B.gold, border: "1px solid " + B.gold, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {locating ? "⏳ جارِ التحديد..." : "📍 استخدم موقعي الحالي"}
                </button>
                <a href={"https://maps.google.com/?q=" + draft.lat + "," + draft.lng} target="_blank" rel="noreferrer" style={{ flex: 1, padding: 10, borderRadius: 8, background: B.blue + "20", color: B.blue, border: "1px solid " + B.blue, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", textAlign: "center", textDecoration: "none" }}>
                  🗺️ معاينة على Google Maps
                </a>
              </div>

              <div style={{ padding: 10, borderRadius: 8, background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.3)", fontSize: 10, color: "#D97706", fontWeight: 600, lineHeight: 1.7 }}>
                💡 نصيحة: افتح التطبيق في موقع الفرع واضغط "استخدم موقعي الحالي" — سيُسجَّل الإحداثيات بدقة تلقائياً.
              </div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
              <button onClick={close} style={{ flex: 1, padding: 12, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, background: saving ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
                {saving ? "جارِ الحفظ..." : "✓ حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ASSET MANAGEMENT — إدارة الأصول المتقدمة (v6.60)
   تتبع الصيانة الدورية + الضمان + تكاليف التشغيل + حالة الأصل
   ═══════════════════════════════════════════════════════════════ */
var ASSET_STATUS_META = {
  operational:    { label: "يعمل",          icon: "✅", color: "#10B981" },
  in_maintenance: { label: "تحت الصيانة",   icon: "🔧", color: "#F59E0B" },
  broken:         { label: "معطل",          icon: "❌", color: "#DC2626" },
  lost:           { label: "مفقود",         icon: "❓", color: "#6B7280" },
  retired:        { label: "متقاعد",        icon: "📦", color: "#64748B" },
};

var MAINT_TYPE_META = {
  routine:    { label: "صيانة دورية",  icon: "🔄", color: "#0891B2" },
  repair:     { label: "إصلاح",        icon: "🔧", color: "#F59E0B" },
  inspection: { label: "فحص",          icon: "🔍", color: "#7C3AED" },
  upgrade:    { label: "ترقية",        icon: "⬆️", color: "#10B981" },
};

function AssetManagementPanel({ t, B, emps }) {
  var [assets, setAssets] = useState([]);
  var [maintLogs, setMaintLogs] = useState([]);
  var [warranty, setWarranty] = useState({ expiringSoon: [], expired: [], active: [], noWarranty: [] });
  var [maintDue, setMaintDue] = useState({ overdue: [], upcoming: [] });
  var [loading, setLoading] = useState(true);
  var [view, setView] = useState("overview"); // overview | assets | maintenance | warranty | costs
  var [selectedAsset, setSelectedAsset] = useState(null);
  var [filterStatus, setFilterStatus] = useState("all");
  var [search, setSearch] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      var [ass, warr, md] = await Promise.all([
        fetch("/api/data?action=custody").then(function(r){ return r.json(); }).catch(function(){ return []; }),
        fetch("/api/data?action=custody-warranty").then(function(r){ return r.json(); }).catch(function(){ return { expiringSoon: [], expired: [], active: [], noWarranty: [] }; }),
        fetch("/api/data?action=custody-maintenance-due").then(function(r){ return r.json(); }).catch(function(){ return { overdue: [], upcoming: [] }; }),
      ]);
      var assetsList = (Array.isArray(ass) ? ass : []).filter(function(c){ return c.type === 'asset'; });
      setAssets(assetsList);
      setWarranty(warr || { expiringSoon: [], expired: [], active: [], noWarranty: [] });
      setMaintDue(md || { overdue: [], upcoming: [] });
    } catch(e) {}
    setLoading(false);
  }

  useEffect(function(){ loadAll(); }, []);

  async function loadMaintForAsset(assetId) {
    try {
      var r = await fetch("/api/data?action=custody_maintenance&custodyId=" + encodeURIComponent(assetId));
      var d = await r.json();
      setMaintLogs(Array.isArray(d) ? d : []);
    } catch(e) { setMaintLogs([]); }
  }

  async function updateStatus(assetId, newStatus, reason) {
    try {
      await fetch("/api/data?action=custody-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custodyId: assetId, status: newStatus, reason: reason || "" }),
      });
      await loadAll();
      if (selectedAsset && selectedAsset.id === assetId) {
        var updated = assets.find(function(a){ return a.id === assetId; });
        if (updated) setSelectedAsset(updated);
      }
    } catch(e) { alert("فشل التحديث"); }
  }

  // Filter
  var filteredAssets = assets.filter(function(a){
    if (filterStatus !== "all" && (a.operationalStatus || "operational") !== filterStatus) return false;
    if (search.trim()) {
      var s = search.toLowerCase();
      return (a.name || "").toLowerCase().includes(s) || (a.serialNumber || "").toLowerCase().includes(s) || (a.empName || "").toLowerCase().includes(s);
    }
    return true;
  });

  // Stats
  var stats = {
    total: assets.length,
    operational: assets.filter(function(a){ return !a.operationalStatus || a.operationalStatus === "operational"; }).length,
    broken: assets.filter(function(a){ return a.operationalStatus === "broken"; }).length,
    inMaint: assets.filter(function(a){ return a.operationalStatus === "in_maintenance"; }).length,
    lost: assets.filter(function(a){ return a.operationalStatus === "lost"; }).length,
    retired: assets.filter(function(a){ return a.operationalStatus === "retired"; }).length,
  };

  var totalValue = assets.reduce(function(sum, a){ return sum + (parseFloat(a.purchaseCost) || 0); }, 0);

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🔧 إدارة الأصول المتقدمة</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>صيانة دورية · ضمان · تكاليف تشغيل · حالة الأصل</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "overview", icon: "📊", label: "نظرة عامة" },
          { id: "assets", icon: "📦", label: "الأصول", count: assets.length },
          { id: "maintenance", icon: "🔧", label: "الصيانة", count: maintDue.overdue.length + maintDue.upcoming.length },
          { id: "warranty", icon: "🛡️", label: "الضمان", count: warranty.expiringSoon.length + warranty.expired.length },
        ].map(function(v){
          var active = view === v.id;
          return (
            <button key={v.id} onClick={function(){ setView(v.id); }} style={{ padding: "9px 14px", borderRadius: 10, background: active ? B.blue : t.card, color: active ? "#fff" : t.tx, border: "1px solid " + (active ? B.blue : t.sep), fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span>{v.icon}</span><span>{v.label}</span>
              {v.count !== undefined && v.count > 0 && (
                <span style={{ padding: "1px 7px", borderRadius: 8, background: active ? "rgba(255,255,255,0.25)" : B.red, color: "#fff", fontSize: 10, fontWeight: 800 }}>{v.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {view === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div style={{ padding: 14, borderRadius: 12, background: t.card, border: "1px solid " + t.sep, borderTop: "3px solid " + B.blue }}>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>📦 إجمالي الأصول</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: B.blue, marginTop: 4 }}>{stats.total}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: t.card, border: "1px solid " + t.sep, borderTop: "3px solid #10B981" }}>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>✅ يعمل</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981", marginTop: 4 }}>{stats.operational}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: t.card, border: "1px solid " + t.sep, borderTop: "3px solid #F59E0B" }}>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>🔧 تحت الصيانة</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B", marginTop: 4 }}>{stats.inMaint}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: t.card, border: "1px solid " + t.sep, borderTop: "3px solid #DC2626" }}>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>❌ معطل</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#DC2626", marginTop: 4 }}>{stats.broken}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: t.card, border: "1px solid " + t.sep, borderTop: "3px solid " + B.gold }}>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>💰 القيمة الإجمالية</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: B.gold, marginTop: 4 }}>{totalValue.toLocaleString("ar-SA")} <span style={{ fontSize: 10, fontWeight: 600 }}>ر.س</span></div>
            </div>
          </div>

          {/* Alerts section */}
          {(maintDue.overdue.length > 0 || warranty.expired.length > 0) && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#DC2626", marginBottom: 10 }}>🚨 تنبيهات عاجلة</div>
              {maintDue.overdue.length > 0 && (
                <div style={{ fontSize: 11, color: t.tx, marginBottom: 6 }}>
                  🔧 <strong>{maintDue.overdue.length}</strong> أصل متأخر الصيانة · {maintDue.overdue.slice(0, 3).map(function(m){ return m.itemName; }).join("، ")}
                </div>
              )}
              {warranty.expired.length > 0 && (
                <div style={{ fontSize: 11, color: t.tx }}>
                  🛡️ <strong>{warranty.expired.length}</strong> أصل انتهى ضمانه
                </div>
              )}
            </div>
          )}

          {(maintDue.upcoming.length > 0 || warranty.expiringSoon.length > 0) && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B", marginBottom: 10 }}>⚠️ تنبيهات قريبة (خلال 7-30 يوم)</div>
              {maintDue.upcoming.length > 0 && (
                <div style={{ fontSize: 11, color: t.tx, marginBottom: 6 }}>
                  🔧 <strong>{maintDue.upcoming.length}</strong> صيانة قادمة قريباً
                </div>
              )}
              {warranty.expiringSoon.length > 0 && (
                <div style={{ fontSize: 11, color: t.tx }}>
                  🛡️ <strong>{warranty.expiringSoon.length}</strong> ضمان ينتهي قريباً
                </div>
              )}
            </div>
          )}

          {/* Breakdown by category */}
          <div style={{ padding: 16, borderRadius: 12, background: t.card, border: "1px solid " + t.sep }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.tx, marginBottom: 12 }}>📊 توزيع الأصول حسب الحالة</div>
            {Object.keys(ASSET_STATUS_META).map(function(key){
              var meta = ASSET_STATUS_META[key];
              var count = assets.filter(function(a){
                return (a.operationalStatus || "operational") === key;
              }).length;
              var pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: t.tx, fontWeight: 700 }}>{meta.icon} {meta.label}</span>
                    <span style={{ color: meta.color, fontWeight: 800 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: t.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: meta.color, transition: "width 0.5s" }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Assets list */}
      {view === "assets" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="text" placeholder="🔍 بحث بالاسم/السيريال/الموظف..." value={search} onChange={function(e){ setSearch(e.target.value); }} style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <select value={filterStatus} onChange={function(e){ setFilterStatus(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: "#fff", color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <option value="all">كل الحالات</option>
              {Object.keys(ASSET_STATUS_META).map(function(k){ return <option key={k} value={k}>{ASSET_STATUS_META[k].label}</option>; })}
            </select>
          </div>

          {filteredAssets.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: t.txM, fontSize: 12, background: t.card, borderRadius: 12, border: "1px solid " + t.sep }}>لا يوجد أصول مطابقة</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {filteredAssets.map(function(a){
                var status = ASSET_STATUS_META[a.operationalStatus || "operational"];
                return (
                  <div key={a.id} onClick={function(){ setSelectedAsset(a); loadMaintForAsset(a.id); }} style={{ padding: 12, borderRadius: 12, background: t.card, border: "1px solid " + t.sep, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: status.color + "20", color: status.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{status.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: t.txM, marginTop: 2, fontFamily: "monospace" }}>{a.serialNumber || "—"}</div>
                      <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>
                        👤 {a.empName || "غير مُسند"}
                        {a.purchaseCost ? " · 💰 " + parseFloat(a.purchaseCost).toLocaleString("ar-SA") + " ر.س" : ""}
                      </div>
                    </div>
                    <div style={{ padding: "5px 10px", borderRadius: 8, background: status.color + "20", color: status.color, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                      {status.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Maintenance view */}
      {view === "maintenance" && (
        <>
          {maintDue.overdue.length > 0 && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#DC2626", marginBottom: 10 }}>🚨 صيانات متأخرة ({maintDue.overdue.length})</div>
              {maintDue.overdue.map(function(m){
                return (
                  <div key={m.id} style={{ padding: 10, borderRadius: 8, background: t.card, marginBottom: 6, border: "1px solid " + t.sep }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{m.itemName}</div>
                    <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>
                      الموعد: <strong style={{ color: "#DC2626" }}>{new Date(m.nextDueDate).toLocaleDateString("ar-SA")}</strong>
                      {m.empName && " · 👤 " + m.empName}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {maintDue.upcoming.length > 0 && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B", marginBottom: 10 }}>⚠️ صيانات قادمة ({maintDue.upcoming.length})</div>
              {maintDue.upcoming.map(function(m){
                return (
                  <div key={m.id} style={{ padding: 10, borderRadius: 8, background: t.card, marginBottom: 6, border: "1px solid " + t.sep }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{m.itemName}</div>
                    <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>
                      الموعد: <strong style={{ color: "#F59E0B" }}>{new Date(m.nextDueDate).toLocaleDateString("ar-SA")}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {maintDue.overdue.length === 0 && maintDue.upcoming.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: t.txM, fontSize: 12, background: t.card, borderRadius: 12, border: "1px solid " + t.sep }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div>جميع الصيانات محدَّثة — لا توجد صيانات متأخرة أو قادمة قريباً</div>
            </div>
          )}
        </>
      )}

      {/* Warranty view */}
      {view === "warranty" && (
        <>
          {warranty.expired.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#DC2626", marginBottom: 8 }}>🔴 انتهى ضمانها ({warranty.expired.length})</div>
              {warranty.expired.map(function(a){
                return (
                  <div key={a.id} style={{ padding: 10, borderRadius: 8, background: "rgba(220,38,38,0.08)", marginBottom: 6, border: "1px solid rgba(220,38,38,0.3)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>انتهى: {new Date(a.warrantyEnd).toLocaleDateString("ar-SA")} · {a.warrantyProvider || "—"}</div>
                  </div>
                );
              })}
            </div>
          )}

          {warranty.expiringSoon.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B", marginBottom: 8 }}>🟡 ينتهي قريباً خلال 30 يوم ({warranty.expiringSoon.length})</div>
              {warranty.expiringSoon.map(function(a){
                return (
                  <div key={a.id} style={{ padding: 10, borderRadius: 8, background: "rgba(245,158,11,0.08)", marginBottom: 6, border: "1px solid rgba(245,158,11,0.3)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>ينتهي: {new Date(a.warrantyEnd).toLocaleDateString("ar-SA")} · {a.warrantyProvider || "—"}</div>
                  </div>
                );
              })}
            </div>
          )}

          {warranty.active.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981", marginBottom: 8 }}>🟢 ضمان نشط ({warranty.active.length})</div>
              <div style={{ fontSize: 10, color: t.txM }}>
                {warranty.active.map(function(a){ return a.name; }).slice(0, 5).join("، ")}
                {warranty.active.length > 5 && " +" + (warranty.active.length - 5) + " آخرين"}
              </div>
            </div>
          )}

          {warranty.noWarranty.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: t.bg, border: "1px dashed " + t.sep, fontSize: 11, color: t.txM }}>
              ℹ️ <strong>{warranty.noWarranty.length}</strong> أصل بدون بيانات ضمان — يمكنك إضافتها من تفاصيل كل أصل
            </div>
          )}
        </>
      )}

      {/* Asset detail modal */}
      {selectedAsset && (
        <AssetDetailModal t={t} B={B} asset={selectedAsset} maintLogs={maintLogs} onClose={function(){ setSelectedAsset(null); setMaintLogs([]); }} onUpdated={function(){ loadAll(); if (selectedAsset) loadMaintForAsset(selectedAsset.id); }} onStatusChange={updateStatus} />
      )}
    </div>
  );
}

function AssetDetailModal({ t, B, asset, maintLogs, onClose, onUpdated, onStatusChange }) {
  var [activeTab, setActiveTab] = useState("info");
  var [showAddMaint, setShowAddMaint] = useState(false);
  var [showEditWarranty, setShowEditWarranty] = useState(false);
  var [tco, setTco] = useState(null);

  useEffect(function(){
    if (activeTab === "costs") {
      fetch("/api/data?action=custody-tco&custodyId=" + encodeURIComponent(asset.id))
        .then(function(r){ return r.json(); })
        .then(function(d){ if (!d.error) setTco(d); })
        .catch(function(){});
    }
  }, [activeTab, asset.id]);

  var status = ASSET_STATUS_META[asset.operationalStatus || "operational"];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 700, width: "100%", maxHeight: "94vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: status.color + "20", color: status.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{status.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>{asset.name}</div>
              <div style={{ fontSize: 10, color: t.txM, marginTop: 2, fontFamily: "monospace" }}>{asset.serialNumber || "—"}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: t.txM, cursor: "pointer" }}>×</button>
        </div>

        {/* Status change buttons */}
        <div style={{ padding: 14, borderBottom: "1px solid " + t.sep, background: t.bg }}>
          <div style={{ fontSize: 10, color: t.txM, marginBottom: 6, fontWeight: 700 }}>تغيير الحالة:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.keys(ASSET_STATUS_META).map(function(k){
              var m = ASSET_STATUS_META[k];
              var active = (asset.operationalStatus || "operational") === k;
              return (
                <button key={k} onClick={function(){
                  if (active) return;
                  var reason = window.prompt("سبب تغيير الحالة إلى " + m.label + " (اختياري):");
                  if (reason !== null) onStatusChange(asset.id, k, reason);
                }} disabled={active} style={{ padding: "6px 10px", borderRadius: 6, background: active ? m.color : t.card, color: active ? "#fff" : t.tx, border: "1px solid " + m.color, fontSize: 10, fontWeight: 700, cursor: active ? "default" : "pointer", fontFamily: "inherit", opacity: active ? 1 : 0.75 }}>
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "10px 14px", borderBottom: "1px solid " + t.sep }}>
          {[
            { id: "info", label: "معلومات" },
            { id: "maintenance", label: "الصيانة", count: maintLogs.length },
            { id: "warranty", label: "الضمان" },
            { id: "costs", label: "التكاليف" },
            { id: "history", label: "السجل" },
          ].map(function(ti){
            var active = activeTab === ti.id;
            return (
              <button key={ti.id} onClick={function(){ setActiveTab(ti.id); }} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, background: active ? B.blue + "20" : "transparent", color: active ? B.blue : t.txM, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {ti.label} {ti.count !== undefined && ti.count > 0 && <span style={{ fontSize: 9, opacity: 0.7 }}>({ti.count})</span>}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16 }}>
          {activeTab === "info" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                {[
                  ["العلامة التجارية", asset.brand],
                  ["الموديل", asset.model],
                  ["الفئة", asset.category],
                  ["الحالة عند الاستلام", asset.condition],
                  ["الموظف المسؤول", asset.empName],
                  ["تاريخ الشراء", asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString("ar-SA") : null],
                  ["سعر الشراء", asset.purchaseCost ? parseFloat(asset.purchaseCost).toLocaleString("ar-SA") + " ر.س" : null],
                ].filter(function(x){ return x[1]; }).map(function(row, i){
                  return (
                    <div key={i} style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                      <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>{row[0]}</div>
                      <div style={{ fontSize: 12, color: t.tx, fontWeight: 700, marginTop: 3 }}>{row[1]}</div>
                    </div>
                  );
                })}
              </div>
              {asset.statusNote && (
                <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 11, color: "#D97706" }}>
                  📝 {asset.statusNote}
                </div>
              )}
            </>
          )}

          {activeTab === "maintenance" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{maintLogs.length} سجل صيانة</div>
                <button onClick={function(){ setShowAddMaint(true); }} style={{ padding: "7px 12px", borderRadius: 8, background: B.blue, color: "#fff", border: "none", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ إضافة صيانة</button>
              </div>
              {maintLogs.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: t.txM, fontSize: 11 }}>لا يوجد سجلات صيانة بعد</div>
              ) : (
                maintLogs.slice().sort(function(a,b){ return (b.date || "").localeCompare(a.date || ""); }).map(function(m){
                  var mt = MAINT_TYPE_META[m.type] || MAINT_TYPE_META.routine;
                  return (
                    <div key={m.id} style={{ padding: 12, borderRadius: 10, background: t.bg, marginBottom: 8, border: "1px solid " + t.sep, borderRight: "3px solid " + mt.color }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 6, background: mt.color + "20", color: mt.color, fontSize: 10, fontWeight: 800 }}>
                          {mt.icon} {mt.label}
                        </div>
                        <div style={{ fontSize: 10, color: t.txM }}>{new Date(m.date).toLocaleDateString("ar-SA")}</div>
                      </div>
                      <div style={{ fontSize: 12, color: t.tx, marginBottom: 4, fontWeight: 600 }}>{m.description}</div>
                      <div style={{ fontSize: 10, color: t.txM, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {m.cost > 0 && <span>💰 {parseFloat(m.cost).toLocaleString("ar-SA")} ر.س</span>}
                        {m.vendor && <span>🏢 {m.vendor}</span>}
                        {m.nextDueDate && <span style={{ color: "#F59E0B", fontWeight: 700 }}>📅 التالي: {new Date(m.nextDueDate).toLocaleDateString("ar-SA")}</span>}
                      </div>
                      {m.notes && <div style={{ marginTop: 6, fontSize: 10, color: t.txM, fontStyle: "italic" }}>"{m.notes}"</div>}
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === "warranty" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>🛡️ بيانات الضمان</div>
                <button onClick={function(){ setShowEditWarranty(true); }} style={{ padding: "7px 12px", borderRadius: 8, background: B.blue, color: "#fff", border: "none", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {asset.warrantyEnd ? "✎ تعديل" : "+ إضافة ضمان"}
                </button>
              </div>
              {asset.warrantyEnd ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                    <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>بداية الضمان</div>
                    <div style={{ fontSize: 12, color: t.tx, fontWeight: 700, marginTop: 3 }}>{asset.warrantyStart ? new Date(asset.warrantyStart).toLocaleDateString("ar-SA") : "—"}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep }}>
                    <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>نهاية الضمان</div>
                    <div style={{ fontSize: 12, color: t.tx, fontWeight: 700, marginTop: 3 }}>{new Date(asset.warrantyEnd).toLocaleDateString("ar-SA")}</div>
                  </div>
                  {asset.warrantyProvider && (
                    <div style={{ padding: 10, borderRadius: 8, background: t.bg, border: "1px solid " + t.sep, gridColumn: "span 2" }}>
                      <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>مزوّد الضمان</div>
                      <div style={{ fontSize: 12, color: t.tx, fontWeight: 700, marginTop: 3 }}>{asset.warrantyProvider}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: t.txM, fontSize: 11 }}>لا توجد بيانات ضمان — أضف الضمان لتتبع تاريخ انتهائه</div>
              )}
            </>
          )}

          {activeTab === "costs" && tco && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 12, borderRadius: 10, background: B.blue + "15", border: "1px solid " + B.blue + "40", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>💰 سعر الشراء</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: B.blue, marginTop: 4 }}>{tco.purchaseCost.toLocaleString("ar-SA")}</div>
                  <div style={{ fontSize: 9, color: t.txM }}>ر.س</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>🔧 إجمالي الصيانة</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#F59E0B", marginTop: 4 }}>{tco.maintenanceCost.toLocaleString("ar-SA")}</div>
                  <div style={{ fontSize: 9, color: t.txM }}>{tco.maintenanceCount} عملية</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>💸 التكلفة الإجمالية</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#DC2626", marginTop: 4 }}>{tco.totalCost.toLocaleString("ar-SA")}</div>
                  <div style={{ fontSize: 9, color: t.txM }}>ر.س</div>
                </div>
                {tco.ageYears > 0 && (
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: t.txM, fontWeight: 700 }}>🗓 عمر الأصل</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#7C3AED", marginTop: 4 }}>{tco.ageYears}</div>
                    <div style={{ fontSize: 9, color: t.txM }}>سنة</div>
                  </div>
                )}
              </div>

              {Object.keys(tco.byType || {}).length > 0 && (
                <div style={{ padding: 12, borderRadius: 10, background: t.bg, border: "1px solid " + t.sep }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 8 }}>📊 التكلفة حسب النوع</div>
                  {Object.keys(tco.byType).map(function(type){
                    var mt = MAINT_TYPE_META[type] || MAINT_TYPE_META.routine;
                    var cost = tco.byType[type];
                    var pct = tco.maintenanceCost > 0 ? Math.round((cost / tco.maintenanceCost) * 100) : 0;
                    return (
                      <div key={type} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: t.tx, fontWeight: 700 }}>{mt.icon} {mt.label}</span>
                          <span style={{ color: mt.color, fontWeight: 800 }}>{cost.toLocaleString("ar-SA")} ر.س ({pct}%)</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: t.card, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", background: mt.color }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 10 }}>📜 تاريخ تغيّرات الحالة</div>
              {!asset.statusHistory || asset.statusHistory.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: t.txM, fontSize: 11 }}>لا يوجد تاريخ حالات</div>
              ) : (
                asset.statusHistory.slice().reverse().map(function(h, i){
                  var from = ASSET_STATUS_META[h.previousStatus] || ASSET_STATUS_META.operational;
                  var to = ASSET_STATUS_META[h.status] || ASSET_STATUS_META.operational;
                  return (
                    <div key={i} style={{ padding: 10, borderRadius: 8, background: t.bg, marginBottom: 6, border: "1px solid " + t.sep }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.tx, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ color: from.color }}>{from.icon} {from.label}</span>
                        <span>→</span>
                        <span style={{ color: to.color }}>{to.icon} {to.label}</span>
                      </div>
                      <div style={{ fontSize: 9, color: t.txM }}>
                        {new Date(h.changedAt).toLocaleString("ar-SA")} · بواسطة {h.changedBy || "—"}
                      </div>
                      {h.reason && <div style={{ fontSize: 10, color: t.txM, marginTop: 4, fontStyle: "italic" }}>"{h.reason}"</div>}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {showAddMaint && <AddMaintenanceModal t={t} B={B} assetId={asset.id} onClose={function(){ setShowAddMaint(false); }} onSaved={function(){ setShowAddMaint(false); onUpdated(); }} />}
        {showEditWarranty && <EditWarrantyModal t={t} B={B} asset={asset} onClose={function(){ setShowEditWarranty(false); }} onSaved={function(){ setShowEditWarranty(false); onUpdated(); }} />}
      </div>
    </div>
  );
}

function AddMaintenanceModal({ t, B, assetId, onClose, onSaved }) {
  var [type, setType] = useState("routine");
  var [description, setDescription] = useState("");
  var [cost, setCost] = useState("");
  var [vendor, setVendor] = useState("");
  var [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  var [nextDueDate, setNextDueDate] = useState("");
  var [notes, setNotes] = useState("");
  var [saving, setSaving] = useState(false);

  async function save() {
    if (!description) { alert("وصف الصيانة مطلوب"); return; }
    setSaving(true);
    try {
      await fetch("/api/data?action=custody_maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custodyId: assetId, type: type, description: description,
          cost: cost, vendor: vendor, date: date, nextDueDate: nextDueDate || null,
          notes: notes, doneBy: "admin",
        }),
      });
      onSaved();
    } catch(e) { alert("خطأ"); }
    setSaving(false);
  }

  var inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 16, maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>🔧 إضافة صيانة</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: t.txM, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>نوع الصيانة</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.keys(MAINT_TYPE_META).map(function(k){
                var m = MAINT_TYPE_META[k];
                var active = type === k;
                return (
                  <button key={k} onClick={function(){ setType(k); }} style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 8, background: active ? m.color : t.bg, color: active ? "#fff" : t.tx, border: "1px solid " + (active ? m.color : t.sep), fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>الوصف *</div>
            <textarea value={description} onChange={function(e){ setDescription(e.target.value); }} placeholder="مثال: تغيير زيت، استبدال بطارية، فحص دوري..." style={Object.assign({}, inputStyle, { minHeight: 60, resize: "vertical" })} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>التكلفة (ر.س)</div>
              <input type="number" value={cost} onChange={function(e){ setCost(e.target.value); }} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>مزوّد الخدمة</div>
              <input type="text" value={vendor} onChange={function(e){ setVendor(e.target.value); }} placeholder="اسم المحل/الفني" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>تاريخ الصيانة</div>
              <input type="date" value={date} onChange={function(e){ setDate(e.target.value); }} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>تاريخ الصيانة القادمة</div>
              <input type="date" value={nextDueDate} onChange={function(e){ setNextDueDate(e.target.value); }} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>ملاحظات</div>
            <textarea value={notes} onChange={function(e){ setNotes(e.target.value); }} style={Object.assign({}, inputStyle, { minHeight: 50, resize: "vertical" })} />
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 10, background: B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "جارِ الحفظ..." : "✓ حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditWarrantyModal({ t, B, asset, onClose, onSaved }) {
  var [warrantyStart, setWarrantyStart] = useState(asset.warrantyStart || "");
  var [warrantyEnd, setWarrantyEnd] = useState(asset.warrantyEnd || "");
  var [warrantyProvider, setWarrantyProvider] = useState(asset.warrantyProvider || "");
  var [warrantyNote, setWarrantyNote] = useState(asset.warrantyNote || "");
  var [saving, setSaving] = useState(false);

  async function save() {
    if (!warrantyEnd) { alert("تاريخ انتهاء الضمان مطلوب"); return; }
    setSaving(true);
    try {
      await fetch("/api/data?action=custody-warranty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custodyId: asset.id, warrantyStart: warrantyStart, warrantyEnd: warrantyEnd, warrantyProvider: warrantyProvider, warrantyNote: warrantyNote }),
      });
      onSaved();
    } catch(e) { alert("خطأ"); }
    setSaving(false);
  }

  var inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 16, maxWidth: 460, width: "100%" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.tx }}>🛡️ تعديل الضمان</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: t.txM, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>بداية الضمان</div>
              <input type="date" value={warrantyStart} onChange={function(e){ setWarrantyStart(e.target.value); }} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>نهاية الضمان *</div>
              <input type="date" value={warrantyEnd} onChange={function(e){ setWarrantyEnd(e.target.value); }} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>مزوّد الضمان</div>
            <input type="text" value={warrantyProvider} onChange={function(e){ setWarrantyProvider(e.target.value); }} placeholder="مثال: HP Saudi Arabia" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: t.txM, fontWeight: 700, marginBottom: 4 }}>ملاحظات</div>
            <textarea value={warrantyNote} onChange={function(e){ setWarrantyNote(e.target.value); }} placeholder="رقم البوليصة، شروط خاصة..." style={Object.assign({}, inputStyle, { minHeight: 50, resize: "vertical" })} />
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 10, background: B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "جارِ الحفظ..." : "✓ حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ LETTERS PANEL — إصدار الإفادات الرسمية (v6.52) ═══ */
function LettersPanel({ t, B, emps }) {
  var [selectedEmp, setSelectedEmp] = useState(null);
  var [letterType, setLetterType] = useState(""); // employment | salary | leave
  var [search, setSearch] = useState("");
  var [toEntity, setToEntity] = useState("لمن يهمه الأمر");
  var [signedBy, setSignedBy] = useState("");
  // Salary-specific
  var [salary, setSalary] = useState("");
  var [allowances, setAllowances] = useState("");
  // Leave-specific
  var [approvedLeaves, setApprovedLeaves] = useState([]);
  var [selectedLeave, setSelectedLeave] = useState(null);

  useEffect(function(){
    if (letterType === "leave" && selectedEmp) {
      fetch("/api/data?action=leaves").then(function(r){ return r.json(); })
        .then(function(d){
          var list = (Array.isArray(d) ? d : []).filter(function(l){
            return l.empId === selectedEmp.id && l.status === "approved";
          }).sort(function(a,b){ return (b.ts || "").localeCompare(a.ts || ""); });
          setApprovedLeaves(list);
          setSelectedLeave(list[0] || null);
        }).catch(function(){ setApprovedLeaves([]); });
    }
  }, [letterType, selectedEmp]);

  function generate() {
    if (!selectedEmp || !letterType) {
      alert("اختر موظف ونوع الإفادة");
      return;
    }
    var opts = { toEntity: toEntity, signedBy: signedBy };
    if (letterType === "employment") {
      exportEmploymentLetter(selectedEmp, opts);
    } else if (letterType === "salary") {
      var total = (parseFloat(salary) || 0) + (parseFloat(allowances) || 0);
      exportSalaryLetter(selectedEmp, Object.assign({}, opts, {
        salary: salary || "—",
        allowances: allowances || "—",
        total: total > 0 ? total.toLocaleString("ar-SA") : "—",
      }));
    } else if (letterType === "leave") {
      if (!selectedLeave) { alert("لا توجد إجازة معتمدة للموظف"); return; }
      exportLeaveLetter(selectedEmp, selectedLeave, opts);
    }
  }

  var filteredEmps = search.trim()
    ? emps.filter(function(e){ return (e.name || "").toLowerCase().includes(search.toLowerCase()); })
    : emps;

  var letterTypesMeta = {
    employment: { label: "إفادة تعريف بالعمل", icon: "📄", color: "#0891B2", desc: "تعريف بالموظف ومسماه الوظيفي" },
    salary: { label: "شهادة راتب", icon: "💵", color: "#D97706", desc: "إفادة بالراتب للبنوك والجهات الرسمية" },
    leave: { label: "إفادة إجازة", icon: "✈️", color: "#7C3AED", desc: "إثبات حصول الموظف على إجازة معتمدة" },
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "20px 22px", marginBottom: 16, color: "#fff", boxShadow: "0 4px 20px rgba(43,94,167,0.25)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📄 إصدار إفادات رسمية</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>توليد إفادات بصيغة PDF مع شعار المكتب وختم رسمي</div>
      </div>

      {/* Step 1: Select letter type */}
      <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: B.blue, marginBottom: 10 }}>1️⃣ نوع الإفادة</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {Object.keys(letterTypesMeta).map(function(k){
            var m = letterTypesMeta[k];
            var active = letterType === k;
            return (
              <button key={k} onClick={function(){ setLetterType(k); }} style={{ padding: 14, borderRadius: 12, background: active ? m.color + "15" : t.bg, border: "2px solid " + (active ? m.color : t.sep), color: t.tx, cursor: "pointer", textAlign: "right", fontFamily: "inherit" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: active ? m.color : t.tx, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: t.tx2 }}>{m.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Select employee */}
      {letterType && (
        <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: B.blue, marginBottom: 10 }}>2️⃣ الموظف المستفيد</div>
          {!selectedEmp ? (
            <>
              {emps.length > 10 && (
                <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 بحث..." style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }} />
              )}
              <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 4 }}>
                {filteredEmps.map(function(e){
                  return (
                    <button key={e.id} onClick={function(){ setSelectedEmp(e); }} style={{ padding: "9px 12px", borderRadius: 8, background: t.bg, border: "1px solid " + t.sep, color: t.tx, textAlign: "right", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between" }}>
                      <span>{e.name}</span>
                      <span style={{ color: t.tx2, fontSize: 10 }}>{e.role || "—"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ padding: 12, borderRadius: 10, background: B.blue + "15", border: "1px solid " + B.blue, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>{selectedEmp.name}</div>
                <div style={{ fontSize: 11, color: t.tx2 }}>{selectedEmp.role} · {selectedEmp.id}</div>
              </div>
              <button onClick={function(){ setSelectedEmp(null); setSelectedLeave(null); }} style={{ padding: "6px 12px", borderRadius: 6, background: t.card, border: "1px solid " + t.sep, color: t.tx2, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>↻ تغيير</button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Additional fields based on letter type */}
      {letterType && selectedEmp && (
        <div style={{ background: t.card, borderRadius: 14, padding: 16, border: "1px solid " + t.sep, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: B.blue, marginBottom: 10 }}>3️⃣ تفاصيل الإفادة</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>الجهة المرسل إليها</div>
            <input type="text" value={toEntity} onChange={function(e){ setToEntity(e.target.value); }} placeholder="مثال: البنك الأهلي، الهيئة السعودية للمهندسين" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>توقيع (اختياري)</div>
            <input type="text" value={signedBy} onChange={function(e){ setSignedBy(e.target.value); }} placeholder="مثال: م. هاني محمد عسيري — مدير عام" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>

          {letterType === "salary" && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>الراتب الأساسي (ر.س)</div>
                <input type="number" value={salary} onChange={function(e){ setSalary(e.target.value); }} placeholder="8000" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>البدلات (ر.س)</div>
                <input type="number" value={allowances} onChange={function(e){ setAllowances(e.target.value); }} placeholder="2000" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
            </>
          )}

          {letterType === "leave" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 4 }}>اختر الإجازة</div>
              {approvedLeaves.length === 0 ? (
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#DC2626", fontSize: 11, fontWeight: 600 }}>⚠️ لا توجد إجازات معتمدة لهذا الموظف</div>
              ) : (
                <div style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                  {approvedLeaves.map(function(l){
                    var active = selectedLeave && selectedLeave.id === l.id;
                    var types = { annual: "سنوية", sick: "مرضية", emergency: "طارئة", personal: "شخصية" };
                    return (
                      <button key={l.id} onClick={function(){ setSelectedLeave(l); }} style={{ padding: "8px 12px", borderRadius: 6, background: active ? B.blue + "20" : t.bg, border: "1px solid " + (active ? B.blue : t.sep), color: t.tx, fontSize: 11, textAlign: "right", cursor: "pointer", fontFamily: "inherit" }}>
                        <strong>{types[l.type] || l.type}</strong> · {l.days || 1} يوم · من {l.from} إلى {l.to}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button onClick={generate} disabled={letterType === "leave" && !selectedLeave} style={{ width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 10, background: B.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            📄 توليد الإفادة وطباعتها PDF
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══ BANNERS PANEL — إدارة بنر الصفحة الرئيسية ═══ */
var BANNER_PRIORITY = {
  urgent:    { label: "عاجل", icon: "🔴", color: "#EF4444" },
  important: { label: "هام",  icon: "⚠️", color: "#F59E0B" },
  normal:    { label: "عادي", icon: "📢", color: "#D4A017" },
};
function BannersPanel({ t, B }) {
  var [banners, setBanners] = useState(null);
  var [loading, setLoading] = useState(true);
  var [editing, setEditing] = useState(null); // null | "new" | {bannerObj}
  var [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      var r = await fetch("/api/data?action=banners&admin=1");
      var d = await r.json();
      setBanners(d.banners || []);
    } catch (e) {
      setErr("تعذر التحميل");
      setBanners([]);
    }
    setLoading(false);
  }

  useEffect(function(){ load(); }, []);

  async function toggleActive(banner) {
    try {
      await fetch("/api/data?action=banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: banner.id, active: !banner.active }),
      });
      await load();
    } catch (e) { alert("فشل التحديث"); }
  }

  async function deleteBanner(banner) {
    if (!confirm("حذف هذا البنر؟\n\n" + (banner.title || ""))) return;
    try {
      await fetch("/api/data?action=banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: banner.id }),
      });
      await load();
    } catch (e) { alert("فشل الحذف"); }
  }

  async function move(banner, direction) {
    if (!banners) return;
    var idx = banners.findIndex(function(b){ return b.id === banner.id; });
    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= banners.length) return;
    var reordered = banners.slice();
    var tmp = reordered[idx]; reordered[idx] = reordered[newIdx]; reordered[newIdx] = tmp;
    try {
      await fetch("/api/data?action=banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reordered.map(function(b){ return b.id; }) }),
      });
      await load();
    } catch (e) { alert("فشل إعادة الترتيب"); }
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  var activeCount = (banners || []).filter(function(b){ return b.active; }).length;

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, " + B.blue + " 0%, " + B.blueDk + " 100%)", borderRadius: 16, padding: "18px 22px", marginBottom: 16, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🎨 إدارة البنر</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{(banners || []).length} بنر · {activeCount} نشط</div>
        </div>
        <button onClick={function(){ setEditing("new"); }} style={{ background: "#fff", color: B.blue, border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ إضافة بنر</button>
      </div>

      {/* Info */}
      <div style={{ background: B.blue + "10", border: "1px solid " + B.blue + "30", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.6 }}>
        💡 البنرات تظهر في الصفحة الرئيسية للتطبيق وتتبدّل تلقائياً. يمكن إضافة نص، صورة، رابط، وجدولة فترة العرض.
      </div>

      {err && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10, padding: 10, background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>{err}</div>}

      {/* Banners list */}
      {(!banners || banners.length === 0) ? (
        <div style={{ background: t.card, borderRadius: 14, padding: 40, textAlign: "center", border: "1px dashed " + t.sep }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.tx, marginBottom: 4 }}>لا توجد بنرات بعد</div>
          <div style={{ fontSize: 11, color: t.txM, marginBottom: 16 }}>ابدأ بإضافة بنر جديد ليظهر في الصفحة الرئيسية</div>
          <button onClick={function(){ setEditing("new"); }} style={{ background: B.blue, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ إضافة أول بنر</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {banners.map(function(b, idx) {
            var p = BANNER_PRIORITY[b.priority] || BANNER_PRIORITY.normal;
            return (
              <div key={b.id} style={{ background: t.card, borderRadius: 14, padding: 14, border: "1px solid " + t.sep, borderRight: "4px solid " + (b.active ? p.color : t.sep), opacity: b.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                  {/* Image preview */}
                  {b.imageUrl && (
                    <img src={b.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: t.bg }} onError={function(e){ e.target.style.display = "none"; }} />
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, background: p.color + "22", color: p.color, fontSize: 10, fontWeight: 800 }}>{p.icon} {p.label}</span>
                      {!b.active && <span style={{ padding: "2px 8px", borderRadius: 6, background: t.sep, color: t.txM, fontSize: 10, fontWeight: 700 }}>⏸ متوقف</span>}
                      {b.linkUrl && <span style={{ padding: "2px 8px", borderRadius: 6, background: B.blue + "22", color: B.blue, fontSize: 10, fontWeight: 700 }}>🔗 رابط</span>}
                      {b.imageUrl && <span style={{ padding: "2px 8px", borderRadius: 6, background: "#10B98122", color: "#10B981", fontSize: 10, fontWeight: 700 }}>🖼 صورة</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 3, wordBreak: "break-word" }}>{b.title || "(بدون عنوان)"}</div>
                    {b.content && <div style={{ fontSize: 11, color: t.txM, marginBottom: 4, lineHeight: 1.5, maxHeight: 32, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{b.content}</div>}
                    {(b.startDate || b.endDate) && (
                      <div style={{ fontSize: 10, color: t.txM, marginTop: 4 }}>
                        📅 {b.startDate ? new Date(b.startDate).toLocaleDateString("ar-SA") : "—"} → {b.endDate ? new Date(b.endDate).toLocaleDateString("ar-SA") : "—"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={function(){ toggleActive(b); }} style={{ padding: "6px 12px", borderRadius: 8, background: b.active ? "#10B98122" : t.bg, border: "1px solid " + (b.active ? "#10B981" : t.sep), color: b.active ? "#10B981" : t.tx, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {b.active ? "✓ نشط" : "⏸ متوقف"}
                  </button>
                  <button onClick={function(){ setEditing(b); }} style={{ padding: "6px 12px", borderRadius: 8, background: B.blue, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✎ تعديل</button>
                  <button onClick={function(){ move(b, -1); }} disabled={idx === 0} style={{ padding: "6px 10px", borderRadius: 8, background: t.bg, border: "1px solid " + t.sep, color: t.tx, fontSize: 11, fontWeight: 700, cursor: idx === 0 ? "default" : "pointer", fontFamily: "inherit", opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                  <button onClick={function(){ move(b, 1); }} disabled={idx === banners.length - 1} style={{ padding: "6px 10px", borderRadius: 8, background: t.bg, border: "1px solid " + t.sep, color: t.tx, fontSize: 11, fontWeight: 700, cursor: idx === banners.length - 1 ? "default" : "pointer", fontFamily: "inherit", opacity: idx === banners.length - 1 ? 0.4 : 1 }}>↓</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={function(){ deleteBanner(b); }} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑 حذف</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && <BannerEditModal t={t} B={B} banner={editing === "new" ? null : editing} onClose={function(){ setEditing(null); }} onSaved={function(){ setEditing(null); load(); }} />}
    </div>
  );
}

/* ═══ BANNER EDIT MODAL ═══ */
function BannerEditModal({ t, B, banner, onClose, onSaved }) {
  var isNew = !banner;
  var [title, setTitle] = useState(banner ? banner.title || "" : "");
  var [content, setContent] = useState(banner ? banner.content || "" : "");
  var [imageUrl, setImageUrl] = useState(banner ? banner.imageUrl || "" : "");
  var [linkUrl, setLinkUrl] = useState(banner ? banner.linkUrl || "" : "");
  var [priority, setPriority] = useState(banner ? banner.priority || "normal" : "normal");
  var [active, setActive] = useState(banner ? banner.active !== false : true);
  var [startDate, setStartDate] = useState(banner && banner.startDate ? banner.startDate.slice(0, 10) : "");
  var [endDate, setEndDate] = useState(banner && banner.endDate ? banner.endDate.slice(0, 10) : "");
  var [saving, setSaving] = useState(false);
  var [err, setErr] = useState("");

  async function save() {
    if (!title.trim()) { setErr("العنوان مطلوب"); return; }
    setSaving(true);
    setErr("");
    try {
      var payload = {
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl.trim(),
        linkUrl: linkUrl.trim(),
        priority: priority,
        active: active,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : null,
      };
      if (banner && banner.id) payload.id = banner.id;

      var r = await fetch("/api/data?action=banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error || "فشل الحفظ"); setSaving(false); return; }
      onSaved();
    } catch (e) {
      setErr("خطأ اتصال");
      setSaving(false);
    }
  }

  var inputStyle = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  var labelStyle = { fontSize: 11, fontWeight: 700, color: t.tx2, marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, fontFamily: Fn }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 18, maxWidth: 560, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", direction: "rtl" }}>
        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.tx }}>🎨 {isNew ? "إضافة بنر جديد" : "تعديل البنر"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: t.txM, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {/* Priority */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>الأولوية</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {Object.keys(BANNER_PRIORITY).map(function(key){
                var p = BANNER_PRIORITY[key];
                var active = priority === key;
                return (
                  <button key={key} onClick={function(){ setPriority(key); }} style={{ padding: "10px 8px", borderRadius: 10, background: active ? p.color : t.bg, color: active ? "#fff" : t.tx, border: "2px solid " + (active ? p.color : t.sep), fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    {p.icon} {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>📝 العنوان <span style={{ color: "#EF4444" }}>*</span></div>
            <input type="text" value={title} onChange={function(e){ setTitle(e.target.value); }} placeholder="عنوان البنر" style={inputStyle} />
          </div>

          {/* Content */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>📄 النص (اختياري)</div>
            <textarea value={content} onChange={function(e){ setContent(e.target.value); }} placeholder="نص البنر التفصيلي..." rows={3} style={Object.assign({}, inputStyle, { resize: "vertical", minHeight: 70 })} />
          </div>

          {/* Image URL */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>🖼 رابط الصورة (اختياري)</div>
            <input type="url" value={imageUrl} onChange={function(e){ setImageUrl(e.target.value); }} placeholder="https://..." style={inputStyle} />
            {imageUrl && (
              <div style={{ marginTop: 8, padding: 8, background: t.bg, borderRadius: 8, border: "1px solid " + t.sep }}>
                <img src={imageUrl} alt="معاينة" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 6, display: "block" }} onError={function(e){ e.target.style.display = "none"; }} />
              </div>
            )}
          </div>

          {/* Link URL */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>🔗 الرابط عند النقر (اختياري)</div>
            <input type="url" value={linkUrl} onChange={function(e){ setLinkUrl(e.target.value); }} placeholder="https://..." style={inputStyle} />
            <div style={{ fontSize: 10, color: t.txM, marginTop: 4 }}>عند نقر الموظف على البنر، يُفتح هذا الرابط في نافذة جديدة</div>
          </div>

          {/* Dates */}
          <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>📅 تاريخ البدء (اختياري)</div>
              <input type="date" value={startDate} onChange={function(e){ setStartDate(e.target.value); }} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>📅 تاريخ الانتهاء (اختياري)</div>
              <input type="date" value={endDate} onChange={function(e){ setEndDate(e.target.value); }} style={inputStyle} />
            </div>
          </div>

          {/* Active toggle */}
          <div onClick={function(){ setActive(!active); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, cursor: "pointer", background: active ? "rgba(16,185,129,0.1)" : t.bg, border: "1px solid " + (active ? "#10B981" : t.sep), fontSize: 12, fontWeight: 700, color: active ? "#10B981" : t.tx }}>
            <span>{active ? "✓ البنر نشط (يظهر للموظفين)" : "⏸ البنر متوقف"}</span>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: active ? "#10B981" : t.sep, position: "relative", transition: "all 0.15s", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, right: active ? 2 : 18, transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
          </div>

          {err && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 10, padding: 10, background: "rgba(239,68,68,0.1)", borderRadius: 8, fontWeight: 600 }}>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + t.sep, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, background: saving ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
            {saving ? "جارِ الحفظ..." : (isNew ? "✓ إضافة" : "✓ حفظ التعديلات")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ TEST PANEL — صفحة اختبار ═══ */

function TawasulAdminPanel({ t, B }) {
  var [subtab, setSubtab] = useState("tasks"); // tasks | categories | projects
  var [data, setData] = useState(null);
  var [loading, setLoading] = useState(true);
  var [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      var r = await fetch("/api/data?action=tawasul-list");
      var d = await r.json();
      if (d.error) { setErr(d.error); }
      setData({ requests: d.requests || [], categories: d.categories || [], projects: d.projects || [] });
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }
  useEffect(function(){ load(); }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: t.txM }}>⏳ جارِ التحميل...</div>;
  if (err) return <div style={{ padding: 20, color: "#ef4444", textAlign: "center" }}>⚠️ {err}</div>;
  if (!data) return null;

  var reqs = data.requests;
  var stats = {
    total: reqs.length,
    open: reqs.filter(function(r){ return ["closed","cancelled","evaluated","rejected"].indexOf(r.status) < 0; }).length,
    escalated: reqs.filter(function(r){ return r.escalation; }).length,
    late: reqs.filter(function(r){
      if (!r.deadline) return false;
      if (["closed","cancelled","evaluated"].indexOf(r.status) >= 0) return false;
      return new Date(r.deadline).getTime() < Date.now();
    }).length,
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: B.blue, marginBottom: 20 }}>🤝 نظام تواصل — إدارة</div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: B.blue }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: t.txM, marginTop: 4 }}>إجمالي المهام</div>
        </div>
        <div style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#f59e0b" }}>{stats.open}</div>
          <div style={{ fontSize: 11, color: t.txM, marginTop: 4 }}>مفتوحة</div>
        </div>
        <div style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#ef4444" }}>{stats.escalated}</div>
          <div style={{ fontSize: 11, color: t.txM, marginTop: 4 }}>مصعّدة</div>
        </div>
        <div style={{ background: t.card, border: "1px solid " + t.sep, borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#dc2626" }}>{stats.late}</div>
          <div style={{ fontSize: 11, color: t.txM, marginTop: 4 }}>متأخرة</div>
        </div>
      </div>

      {/* Subtabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid " + t.sep }}>
        {[
          { id: "tasks", icon: "📋", label: "كل المهام" },
          { id: "categories", icon: "🏷️", label: "الفئات" },
          { id: "projects", icon: "🏗️", label: "المشاريع" },
          { id: "permissions", icon: "🔐", label: "الصلاحيات" },
        ].map(function(s){
          var active = subtab === s.id;
          return <button key={s.id} onClick={function(){ setSubtab(s.id); }} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: active ? "2px solid " + B.blue : "2px solid transparent", color: active ? B.blue : t.txM, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{s.icon} {s.label}</button>;
        })}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ padding: "6px 14px", background: t.card, color: t.tx, border: "1px solid " + t.sep, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 4 }}>⟳ تحديث</button>
      </div>

      {subtab === "tasks" && <TawasulAdminTasksList reqs={reqs} t={t} B={B} onChange={load} />}
      {subtab === "categories" && <TawasulAdminCategories categories={data.categories} t={t} B={B} onChange={load} />}
      {subtab === "projects" && <TawasulAdminProjects projects={data.projects} t={t} B={B} onChange={load} />}
      {subtab === "permissions" && <TawasulAdminPermissions t={t} B={B} />}
    </div>
  );
}

function TawasulAdminTasksList({ reqs, t, B, onChange }) {
  var [filter, setFilter] = useState("all"); // all | open | closed | escalated
  var [search, setSearch] = useState("");
  var [selectedTask, setSelectedTask] = useState(null);
  var filtered = reqs.filter(function(r){
    if (filter === "open") { if (["closed","cancelled","evaluated","rejected"].indexOf(r.status) >= 0) return false; }
    else if (filter === "closed") { if (["closed","cancelled","evaluated"].indexOf(r.status) < 0) return false; }
    else if (filter === "escalated") { if (!r.escalation) return false; }
    if (search.trim()) {
      var q = search.trim().toLowerCase();
      var text = ((r.title||"") + " " + (r.description||"") + " " + (r.serial||"") + " " + (r.requesterName||"") + " " + ((r.assignees||[]).map(function(a){return a.name;}).join(" "))).toLowerCase();
      if (text.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(function(a,b){ return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); });

  var statusMeta = {
    draft: { label: "مسودة", color: "#94a3b8" },
    sent: { label: "مُرسَلة", color: "#3b82f6" },
    received: { label: "مستلمة", color: "#22c55e" },
    accepted: { label: "مقبولة", color: "#22c55e" },
    inprogress: { label: "قيد التنفيذ", color: "#7c3aed" },
    delivered: { label: "تم التسليم", color: "#b8960c" },
    evaluated: { label: "مُقيَّمة", color: "#10b981" },
    closed: { label: "مغلقة", color: "#10b981" },
    rejected: { label: "مرفوضة", color: "#ef4444" },
    incomplete: { label: "بحاجة استكمال", color: "#f59e0b" },
    cancelled: { label: "ملغاة", color: "#64748b" },
  };

  async function deleteTask(id, title) {
    if (!confirm("⚠️ حذف المهمة نهائياً؟\n\n" + (title || "") + "\n\nلا يمكن التراجع عن هذا الإجراء.")) return;
    try {
      await fetch("/api/data?action=tawasul-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id }) });
      if (selectedTask && selectedTask.id === id) setSelectedTask(null);
      onChange();
    } catch(e) { alert("فشل: " + e.message); }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { id: "all", label: "الكل (" + reqs.length + ")" },
          { id: "open", label: "مفتوحة" },
          { id: "closed", label: "منجزة" },
          { id: "escalated", label: "🔴 مصعّدة" },
        ].map(function(f){
          var active = filter === f.id;
          return <button key={f.id} onClick={function(){ setFilter(f.id); }} style={{ padding: "6px 14px", borderRadius: 8, background: active ? B.blue : t.card, color: active ? "#fff" : t.tx, border: "1px solid " + (active ? B.blue : t.sep), fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{f.label}</button>;
        })}
        <div style={{ flex: 1 }} />
        <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 بحث..." style={{ padding: "6px 12px", borderRadius: 8, background: t.card, color: t.tx, border: "1px solid " + t.sep, fontSize: 12, fontFamily: "inherit", outline: "none", minWidth: 180 }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: t.txM, background: t.card, borderRadius: 12 }}>لا توجد مهام</div>
      ) : (
        <div style={{ background: t.card, borderRadius: 12, overflow: "hidden", border: "1px solid " + t.sep }}>
          {filtered.map(function(r, idx){
            var m = statusMeta[r.status] || { label: r.status, color: "#64748b" };
            return (
              <div key={r.id} style={{ padding: 14, borderBottom: idx < filtered.length - 1 ? "1px solid " + t.sep : "none", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.15s" }} onClick={function(){ setSelectedTask(r); }} onMouseEnter={function(ev){ ev.currentTarget.style.background = t.bg; }} onMouseLeave={function(ev){ ev.currentTarget.style.background = "transparent"; }}>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: t.txM, minWidth: 60 }}>{r.serial || "—"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 3 }}>{r.title || "(بدون عنوان)"}</div>
                  <div style={{ fontSize: 11, color: t.txM }}>
                    من: {r.requesterName || "—"} ← إلى: {(r.assignees || []).map(function(a){ return a.name; }).join("، ") || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {r.escalation && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: r.escalation === "red" ? "#fee" : "#fef3c7", color: r.escalation === "red" ? "#ef4444" : "#b45309" }}>{r.escalation === "red" ? "🔴" : "🟡"}</span>}
                  {r.urgency === "urgent" && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "#fee", color: "#ef4444" }}>🔴 عاجل</span>}
                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: m.color + "22", color: m.color }}>{m.label}</span>
                  <button onClick={function(ev){ ev.stopPropagation(); deleteTask(r.id, r.title); }} title="حذف" style={{ padding: "4px 8px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTask && (
        <TawasulAdminTaskDetail
          task={selectedTask}
          t={t}
          B={B}
          statusMeta={statusMeta}
          onDelete={function(){ deleteTask(selectedTask.id, selectedTask.title); }}
          onClose={function(){ setSelectedTask(null); }}
        />
      )}
    </div>
  );
}

/* ═══ Task Detail Modal (Admin side) — different description background + prominent delete ═══ */
function TawasulAdminTaskDetail({ task, t, B, statusMeta, onDelete, onClose }) {
  var r = task;
  var m = statusMeta[r.status] || { label: r.status, color: "#64748b" };
  var rejectedCount = r.rejectedCount || 0;
  var returnCount = r.returnCount || 0;
  var resendCount = r.resendCount || 0;
  var log = r.log || [];
  var evals = r.evaluations || [];

  function fmtDate(iso) { if (!iso) return "—"; try { return new Date(iso).toLocaleString("ar-SA"); } catch(e) { return iso; } }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "inherit" }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.bg, borderRadius: 16, maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto", direction: "rtl", color: t.tx, border: "1px solid " + t.sep }}>

        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid " + t.sep, display: "flex", alignItems: "flex-start", gap: 12, position: "sticky", top: 0, background: t.bg, zIndex: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              {r.serial && <span style={{ fontSize: 13, fontWeight: 900, fontFamily: "monospace", color: B.gold }}>#{r.serial}</span>}
              <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: m.color + "22", color: m.color }}>{m.label}</span>
              {r.escalation && <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: r.escalation === "red" ? "#fee" : "#fef3c7", color: r.escalation === "red" ? "#ef4444" : "#b45309" }}>{r.escalation === "red" ? "🔴 تصعيد أحمر" : "🟡 تصعيد أصفر"}</span>}
              {r.urgency === "urgent" && <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "#fee", color: "#ef4444" }}>🔴 عاجل</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.tx }}>{r.title || "(بدون عنوان)"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={onDelete} style={{ padding: "10px 16px", borderRadius: 10, background: B.red, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(239,68,68,0.4)" }}>
              <span>🗑</span><span>حذف المهمة</span>
            </button>
            <button onClick={onClose} style={{ padding: "8px 10px", borderRadius: 8, background: t.card, color: t.tx, border: "1px solid " + t.sep, fontSize: 16, cursor: "pointer", fontFamily: "inherit" }}>×</button>
          </div>
        </div>

        <div style={{ padding: "18px 20px" }}>

          {/* Meta grid */}
          <div style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {[
                { label: "من", value: r.requesterName || "—", icon: "👤" },
                { label: "إلى", value: (r.assignees || []).map(function(a){ return a.name; }).join("، ") || "—", icon: "📬" },
                { label: "التصنيف", value: r.category || "—", icon: "🏷" },
                { label: "القسم", value: r.department || "—", icon: "🏢" },
                { label: "المشروع", value: r.projectName || "—", icon: "🏗" },
                { label: "تاريخ الإنشاء", value: fmtDate(r.createdAt), icon: "📅" },
                r.deadline ? { label: "الموعد النهائي", value: fmtDate(r.deadline), icon: "⏰" } : null,
                r.deliveredAt ? { label: "تاريخ التسليم", value: fmtDate(r.deliveredAt), icon: "📦" } : null,
                r.linkedFromSerial ? { label: "محوّلة من", value: "#" + r.linkedFromSerial, icon: "↪️" } : null,
                rejectedCount > 0 ? { label: "عدد الرفضات", value: String(rejectedCount), icon: "❌" } : null,
                returnCount > 0 ? { label: "عدد الإرجاعات", value: String(returnCount), icon: "📋" } : null,
                resendCount > 0 ? { label: "عدد إعادات الإرسال", value: String(resendCount), icon: "🔄" } : null,
              ].filter(Boolean).map(function(row, idx){
                return (
                  <div key={idx} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 6, padding: 6, borderRadius: 6, background: t.bg }}>
                    <span style={{ color: t.tx2, fontWeight: 600 }}><span style={{ marginLeft: 4 }}>{row.icon}</span>{row.label}</span>
                    <span style={{ color: t.tx, fontWeight: 700, textAlign: "left", wordBreak: "break-word" }}>{row.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description — distinguished by gold side bar + prominent header (plain background) */}
          {r.description && (
            <div style={{ position: "relative", background: t.card, borderRadius: 12, padding: "16px 16px 16px 22px", border: "1px solid " + t.sep, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 6, background: "linear-gradient(180deg, " + B.gold + ", " + B.gold + "aa)" }} />
              <div style={{ fontSize: 14, fontWeight: 900, color: B.gold, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📝</span>
                <span>وصف المهمة</span>
              </div>
              <div style={{ fontSize: 14, color: t.tx, lineHeight: 1.95, whiteSpace: "pre-wrap", fontWeight: 500 }}>{r.description}</div>
            </div>
          )}

          {/* Delivery methods */}
          {r.deliveryMethods && r.deliveryMethods.length > 0 && (
            <div style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.tx2, marginBottom: 8 }}>📦 طرق التسليم</div>
              {r.deliveryMethods.map(function(dm, idx){
                return (
                  <div key={idx} style={{ padding: "8px 10px", borderRadius: 8, background: t.bg, marginBottom: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: t.tx, marginBottom: 2 }}>{dm.label || dm.type}</div>
                    {dm.value && <div style={{ fontSize: 11, color: t.tx2, wordBreak: "break-all" }}>{dm.value}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Rejection/Return reason */}
          {(r.rejectionReason || r.returnReason) && (
            <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 12, padding: 14, border: "1px solid rgba(239,68,68,0.3)", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", marginBottom: 6 }}>{r.rejectionReason ? "❌ سبب الرفض" : "📋 سبب الإرجاع"}</div>
              <div style={{ fontSize: 12, color: t.tx, lineHeight: 1.6 }}>{r.rejectionReason || r.returnReason}</div>
            </div>
          )}

          {/* Evaluations */}
          {evals.length > 0 && (
            <div style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: t.tx2, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>⭐ التقييمات ({evals.length})</span>
                {r.finalScore !== undefined && r.finalScore !== null && <span style={{ color: B.gold, fontWeight: 900 }}>{r.finalScore}/100</span>}
              </div>
              {evals.map(function(ev, idx){
                return (
                  <div key={idx} style={{ padding: "8px 10px", borderRadius: 8, background: t.bg, marginBottom: 6, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: t.tx }}>{ev.byName || ev.by}</span>
                    <span style={{ color: B.gold, fontWeight: 800 }}>{ev.avgScore || "-"}/100</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Log */}
          <div style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.tx2, marginBottom: 10 }}>📜 السجل ({log.length})</div>
            {log.length === 0 ? (
              <div style={{ fontSize: 11, color: t.tx2, textAlign: "center", padding: 10 }}>لا يوجد سجل</div>
            ) : log.map(function(entry, idx){
              return (
                <div key={idx} style={{ padding: "8px 0", borderBottom: idx < log.length - 1 ? "1px solid " + t.sep : "none", display: "flex", gap: 8, fontSize: 11 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: B.gold, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.tx, fontWeight: 600, lineHeight: 1.5, wordBreak: "break-word" }}>{entry.text || entry.action || "تحديث"}</div>
                    <div style={{ fontSize: 10, color: t.tx2, marginTop: 2 }}>{entry.by || "—"} • {fmtDate(entry.at)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom action bar */}
          <div style={{ display: "flex", gap: 10, paddingTop: 6 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, background: t.card, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إغلاق</button>
            <button onClick={onDelete} style={{ flex: 1, padding: 12, borderRadius: 10, background: B.red, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>🗑 حذف نهائي</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TawasulAdminCategories({ categories, t, B, onChange }) {
  var [editing, setEditing] = useState(null); // null | newIdx | number
  var [working, setWorking] = useState(categories || []);
  useEffect(function(){ setWorking(categories || []); }, [categories]);

  async function save(newList) {
    try {
      var r = await fetch("/api/data?action=tawasul-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: newList }) });
      var d = await r.json();
      if (d.error) throw new Error(d.error);
      setWorking(newList);
      onChange();
    } catch(e) { alert("فشل: " + e.message); }
  }

  function addNew() {
    var newItem = { id: "cat_" + Date.now(), label: "فئة جديدة", icon: "📎", fixed: false };
    save(working.concat([newItem]));
  }
  function updateItem(idx, patch) {
    var nl = working.slice();
    nl[idx] = Object.assign({}, nl[idx], patch);
    save(nl);
  }
  function deleteItem(idx) {
    if (working[idx].fixed) { alert("لا يمكن حذف فئة ثابتة"); return; }
    if (!confirm("حذف هذه الفئة؟")) return;
    save(working.filter(function(_, i){ return i !== idx; }));
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <button onClick={addNew} style={{ padding: "8px 16px", background: B.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ إضافة فئة</button>
      </div>
      <div style={{ background: t.card, borderRadius: 12, overflow: "hidden", border: "1px solid " + t.sep }}>
        {working.map(function(cat, idx){
          return (
            <div key={cat.id || idx} style={{ padding: 14, borderBottom: idx < working.length - 1 ? "1px solid " + t.sep : "none", display: "flex", alignItems: "center", gap: 10 }}>
              <input value={cat.icon || ""} onChange={function(e){ updateItem(idx, { icon: e.target.value }); }} maxLength={2} style={{ width: 40, padding: 6, borderRadius: 6, border: "1px solid " + t.sep, background: t.bg, color: t.tx, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
              <input value={cat.label || ""} onChange={function(e){ updateItem(idx, { label: e.target.value }); }} style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid " + t.sep, background: t.bg, color: t.tx, fontSize: 13, fontFamily: "inherit" }} />
              <span style={{ fontSize: 10, color: t.txM, fontFamily: "monospace" }}>{cat.id}</span>
              {cat.fixed && <span style={{ padding: "3px 8px", borderRadius: 6, background: B.yellow + "22", color: B.yellow, fontSize: 10, fontWeight: 700 }}>🔒 ثابتة</span>}
              <button onClick={function(){ deleteItem(idx); }} disabled={cat.fixed} style={{ padding: "6px 10px", background: cat.fixed ? "#ccc" : "rgba(239,68,68,0.1)", color: cat.fixed ? "#666" : "#ef4444", border: "1px solid " + (cat.fixed ? "#ccc" : "rgba(239,68,68,0.3)"), borderRadius: 6, fontSize: 11, cursor: cat.fixed ? "not-allowed" : "pointer", fontFamily: "inherit" }}>🗑</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TawasulAdminProjects({ projects, t, B, onChange }) {
  var [working, setWorking] = useState(projects || []);
  useEffect(function(){ setWorking(projects || []); }, [projects]);

  async function save(newList) {
    try {
      var r = await fetch("/api/data?action=tawasul-projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects: newList }) });
      var d = await r.json();
      if (d.error) throw new Error(d.error);
      setWorking(newList);
      onChange();
    } catch(e) { alert("فشل: " + e.message); }
  }

  function addNew() {
    var newItem = { id: "prj_" + Date.now(), name: "مشروع جديد", client: "", branch: "", status: "active" };
    save(working.concat([newItem]));
  }
  function updateItem(idx, patch) {
    var nl = working.slice();
    nl[idx] = Object.assign({}, nl[idx], patch);
    save(nl);
  }
  function deleteItem(idx) {
    if (!confirm("حذف هذا المشروع؟")) return;
    save(working.filter(function(_, i){ return i !== idx; }));
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <button onClick={addNew} style={{ padding: "8px 16px", background: B.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ إضافة مشروع</button>
      </div>
      {working.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: t.txM, background: t.card, borderRadius: 12 }}>لا توجد مشاريع</div>
      ) : (
        <div style={{ background: t.card, borderRadius: 12, overflow: "hidden", border: "1px solid " + t.sep }}>
          {working.map(function(p, idx){
            return (
              <div key={p.id || idx} style={{ padding: 14, borderBottom: idx < working.length - 1 ? "1px solid " + t.sep : "none", display: "flex", alignItems: "center", gap: 10 }}>
                <input value={p.name || ""} onChange={function(e){ updateItem(idx, { name: e.target.value }); }} placeholder="اسم المشروع" style={{ flex: 2, padding: 8, borderRadius: 6, border: "1px solid " + t.sep, background: t.bg, color: t.tx, fontSize: 13, fontFamily: "inherit" }} />
                <input value={p.client || ""} onChange={function(e){ updateItem(idx, { client: e.target.value }); }} placeholder="العميل" style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid " + t.sep, background: t.bg, color: t.tx, fontSize: 13, fontFamily: "inherit" }} />
                <input value={p.branch || ""} onChange={function(e){ updateItem(idx, { branch: e.target.value }); }} placeholder="الفرع" style={{ width: 110, padding: 8, borderRadius: 6, border: "1px solid " + t.sep, background: t.bg, color: t.tx, fontSize: 13, fontFamily: "inherit" }} />
                <button onClick={function(){ deleteItem(idx); }} style={{ padding: "6px 10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TawasulAdminPermissions({ t, B }) {
  var [perms, setPerms] = useState([]);
  var [loading, setLoading] = useState(true);
  var [err, setErr] = useState("");
  var [search, setSearch] = useState("");
  var [editing, setEditing] = useState(null); // employee object
  var [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setErr("");
    try {
      var r = await fetch("/api/data?action=tawasul-permissions");
      var d = await r.json();
      if (d.error) setErr(d.error);
      else setPerms(d.permissions || []);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }
  useEffect(function(){ load(); }, []);

  async function saveEmployee(empId, inbox, allowedSenders) {
    setSaving(true);
    try {
      var r = await fetch("/api/data?action=tawasul-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: empId, tawasulInbox: inbox, tawasulAllowedSenders: allowedSenders || [] }),
      });
      var d = await r.json();
      if (d.error) throw new Error(d.error);
      await load();
      setEditing(null);
    } catch(e) { alert("فشل: " + e.message); }
    setSaving(false);
  }

  var filtered = perms.filter(function(p){
    if (!search.trim()) return true;
    var q = search.toLowerCase();
    return (p.name || "").toLowerCase().indexOf(q) >= 0 || (p.username || "").toLowerCase().indexOf(q) >= 0 || (p.department || "").toLowerCase().indexOf(q) >= 0;
  });

  function inboxMeta(mode) {
    if (mode === "none") return { label: "🚫 لا أحد يرسل", color: "#ef4444" };
    if (mode === "restricted") return { label: "🔒 محدود", color: "#f59e0b" };
    return { label: "🟢 الكل", color: "#22c55e" };
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: t.txM }}>⏳ جارِ التحميل...</div>;
  if (err) return <div style={{ padding: 20, color: "#ef4444" }}>⚠️ {err}</div>;

  return (
    <div>
      <div style={{ padding: 14, background: B.blue + "10", borderRadius: 10, border: "1px solid " + B.blue + "40", marginBottom: 16, fontSize: 12, color: t.tx, lineHeight: 1.7 }}>
        💡 <strong>صلاحيات استلام المهام:</strong> تحدد هنا من يحق لهم إرسال مهام لكل موظف. يمكن: <strong>الكل</strong> (افتراضي) / <strong>محدود</strong> (قائمة معينة فقط) / <strong>لا أحد</strong>.
      </div>

      <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 بحث بالاسم أو القسم..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: t.card, color: t.tx, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

      <div style={{ background: t.card, borderRadius: 12, overflow: "hidden", border: "1px solid " + t.sep }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: t.txM }}>لا توجد نتائج</div>
        ) : filtered.map(function(p, idx){
          var m = inboxMeta(p.tawasulInbox);
          var allowedCount = (p.tawasulAllowedSenders || []).length;
          return (
            <div key={p.id || p.username} style={{ padding: 14, borderBottom: idx < filtered.length - 1 ? "1px solid " + t.sep : "none", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: B.blueLt, color: B.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                {(p.name || p.username || "?").charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>{p.name || p.username}</div>
                <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>
                  {p.department || "—"}
                  {p.tawasulInbox === "restricted" && <span style={{ marginRight: 6, color: "#f59e0b" }}>• {allowedCount} مسموح لهم</span>}
                </div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: m.color + "22", color: m.color }}>{m.label}</span>
              <button onClick={function(){ setEditing(p); }} style={{ padding: "6px 12px", background: B.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⚙️ تعديل</button>
            </div>
          );
        })}
      </div>

      {editing && <TawasulPermissionEditor employee={editing} allEmps={perms} t={t} B={B} saving={saving} onSave={saveEmployee} onClose={function(){ setEditing(null); }} />}
    </div>
  );
}

function TawasulPermissionEditor({ employee, allEmps, t, B, saving, onSave, onClose }) {
  var [inbox, setInbox] = useState(employee.tawasulInbox || "anyone");
  var [allowedSenders, setAllowedSenders] = useState(employee.tawasulAllowedSenders || []);
  var [search, setSearch] = useState("");

  function toggleSender(empId) {
    var strId = String(empId);
    if (allowedSenders.map(String).indexOf(strId) >= 0) {
      setAllowedSenders(allowedSenders.filter(function(x){ return String(x) !== strId; }));
    } else {
      setAllowedSenders(allowedSenders.concat([empId]));
    }
  }

  var others = allEmps.filter(function(p){
    if (String(p.id) === String(employee.id)) return false; // skip self
    if (!search.trim()) return true;
    var q = search.toLowerCase();
    return (p.name || "").toLowerCase().indexOf(q) >= 0 || (p.username || "").toLowerCase().indexOf(q) >= 0;
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, fontFamily: Fn }}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 14, maxWidth: 540, width: "100%", maxHeight: "92vh", overflowY: "auto", direction: "rtl", color: t.tx }}>
        <div style={{ padding: 16, borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: B.blue }}>🔐 صلاحيات استلام المهام</div>
            <div style={{ fontSize: 12, color: t.txM, marginTop: 2 }}>{employee.name || employee.username}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: t.txM, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.txM, marginBottom: 8 }}>من يستطيع إرسال مهام لهذا الموظف؟</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {[
              { id: "anyone", icon: "🟢", title: "الكل", desc: "أي موظف يستطيع الإرسال (الافتراضي)", color: "#22c55e" },
              { id: "restricted", icon: "🔒", title: "محدود", desc: "فقط الموظفون المُحددون في القائمة أدناه", color: "#f59e0b" },
              { id: "none", icon: "🚫", title: "لا أحد", desc: "لا أحد يستطيع إرسال مهام لهذا الحساب", color: "#ef4444" },
            ].map(function(opt){
              var active = inbox === opt.id;
              return (
                <button key={opt.id} onClick={function(){ setInbox(opt.id); }} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: active ? opt.color + "15" : t.bg,
                  color: active ? opt.color : t.tx,
                  border: "2px solid " + (active ? opt.color : t.sep),
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "right",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: active ? opt.color : t.txM, fontWeight: 500, marginTop: 3 }}>{opt.desc}</div>
                  </div>
                  {active && <span style={{ fontSize: 20 }}>✓</span>}
                </button>
              );
            })}
          </div>

          {inbox === "restricted" && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.txM, marginBottom: 6 }}>اختر الموظفين المسموح لهم ({allowedSenders.length} محدد):</div>
              <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 بحث..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.bg, color: t.tx, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
              <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid " + t.sep, borderRadius: 8 }}>
                {others.map(function(emp){
                  var isChecked = allowedSenders.map(String).indexOf(String(emp.id)) >= 0;
                  return (
                    <label key={emp.id || emp.username} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: isChecked ? B.blue + "10" : "transparent", borderBottom: "1px solid " + t.sep + "66" }}>
                      <input type="checkbox" checked={isChecked} onChange={function(){ toggleSender(emp.id); }} style={{ width: 16, height: 16, accentColor: B.blue }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{emp.name || emp.username}</div>
                        <div style={{ fontSize: 10, color: t.txM }}>{emp.department || "—"}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid " + t.sep, display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, background: t.bg, color: t.tx, border: "1px solid " + t.sep, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={function(){ onSave(employee.id || employee.username, inbox, allowedSenders); }} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 8, background: saving ? "#ccc" : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
            {saving ? "جارِ الحفظ..." : "💾 حفظ الصلاحيات"}
          </button>
        </div>
      </div>
    </div>
  );
}


function TestPanel({ t, B, emps }) {
  var [selected, setSelected] = useState(emps[0] ? emps[0].id : "");
  var [log, setLog] = useState([]);
  var [busy, setBusy] = useState(false);
  var [vapidKeys, setVapidKeys] = useState(null);
  var [pushStatus, setPushStatus] = useState(null);

  useEffect(function() {
    // Check if VAPID is configured on server
    fetch("/api/data?action=vapid-public-key").then(r => r.json()).then(function(d){
      setPushStatus(d.publicKey ? "configured" : "missing");
    }).catch(function(){ setPushStatus("error"); });
  }, []);

  function addLog(msg, type, details) {
    setLog(function(prev){ return [{ msg: msg, type: type || "info", details: details, ts: new Date().toLocaleTimeString("ar-SA") }, ...prev].slice(0, 30); });
  }

  async function runTest(action) {
    if (!selected) { alert("اختر موظف أولاً"); return; }
    setBusy(true);
    try {
      if (action === "notif" || action === "call") {
        var isCall = action === "call";
        var r = await fetch("/api/data?action=test-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empId: selected,
            type: isCall ? "fake_call" : "test",
            callType: isCall ? "checkin" : undefined,
            title: isCall ? "اتصال تجريبي" : "اختبار إشعار",
            message: isCall ? "المدير يطلب منك تأكيد الحضور" : "هذا إشعار تجريبي من المدير",
          }),
        });
        var d = await r.json();
        var icon = isCall ? "📞" : "📢";
        var label = isCall ? "اتصال وهمي" : "إشعار";
        if (d.ok) {
          if (d.push && d.push.sent) {
            addLog(icon + " " + label + ": ✓ تم الإرسال عبر Push (فوري)", "ok");
          } else {
            var reason = (d.push && d.push.reason) || "غير معروف";
            addLog(icon + " " + label + ": ⚠️ حُفظ في DB فقط (بدون push)", "warn", "السبب: " + reason + ". " + (d.hint || ""));
          }
        } else {
          addLog(icon + " " + label + ": ❌ فشل — " + (d.error || "خطأ"), "error");
        }
      }
      else if (action === "checkin") {
        var r3 = await fetch("/api/data?action=checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empId: selected, type: "checkin", lat: 21.5433, lng: 39.1728, test: true }),
        });
        var d3 = await r3.json();
        addLog("🟢 تسجيل حضور: " + (d3.ok ? "✓ نجح" : "❌ فشل"), d3.ok ? "ok" : "error");
      }
      else if (action === "checkout") {
        var r4 = await fetch("/api/data?action=checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empId: selected, type: "checkout", lat: 21.5433, lng: 39.1728, test: true }),
        });
        var d4 = await r4.json();
        addLog("🔴 تسجيل انصراف: " + (d4.ok ? "✓ نجح" : "❌ فشل"), d4.ok ? "ok" : "error");
      }
      else if (action === "face") {
        addLog("📸 بصمة الوجه: يجب اختبارها من التطبيق مباشرة بتسجيل دخول كهذا الموظف", "info");
      }
      else if (action === "gps") {
        var r5 = await fetch("/api/data?action=gps_log&empId=" + selected + "&date=" + new Date().toISOString().split("T")[0]);
        var d5 = await r5.json();
        addLog("🛰️ بيانات GPS: " + (Array.isArray(d5) ? (d5.length + " نقطة") : "لا يوجد"), "info");
      }
    } catch(e) {
      addLog("❌ خطأ: " + e.message, "error");
    }
    setBusy(false);
  }

  async function generateVapid() {
    try {
      var r = await fetch("/api/data?action=vapid-generate");
      var d = await r.json();
      if (d.ok) setVapidKeys(d);
    } catch(e) { alert("خطأ: " + e.message); }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ background: B.red + "15", border: "1px solid " + B.red + "40", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        🧪 <strong>صفحة اختبار النظام</strong><br/>
        اختبر كل الإمكانيات (إشعار، اتصال، حضور، انصراف). التغييرات فعلية — استخدم بحذر.
      </div>

      {/* Push Status */}
      <div style={{ background: pushStatus === "configured" ? "#10b98115" : pushStatus === "missing" ? "#f59e0b15" : "#ef444415", border: "1px solid " + (pushStatus === "configured" ? "#10b981" : pushStatus === "missing" ? "#f59e0b" : "#ef4444") + "40", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        {pushStatus === "configured" && <span>✅ <strong>Web Push مفعّل</strong> — الإشعارات ستصل فوراً لأجهزة الموظفين</span>}
        {pushStatus === "missing" && (
          <>
            <div>⚠️ <strong>Web Push غير مفعّل</strong> — الإشعارات تعتمد على Polling كل 15 ثانية</div>
            <button onClick={generateVapid} style={{ marginTop: 8, padding: "8px 14px", borderRadius: 8, background: B.blue, color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              🔑 إنشاء مفاتيح VAPID (مرة واحدة)
            </button>
          </>
        )}
        {pushStatus === "error" && <span>❌ فشل التحقق من إعدادات Push</span>}
      </div>

      {/* VAPID keys display */}
      {vapidKeys && (
        <div style={{ background: "#fbbf2420", border: "2px solid #f59e0b", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#b45309", marginBottom: 10 }}>🔑 مفاتيح VAPID تم إنشاؤها — اتبع التعليمات:</div>
          <ol style={{ fontSize: 11, color: t.tx, lineHeight: 1.8, paddingRight: 18, marginBottom: 12 }}>
            {vapidKeys.instructions.map(function(line, i){ return <li key={i}>{line}</li>; })}
          </ol>
          <div style={{ padding: 10, borderRadius: 8, background: t.bg, fontFamily: "monospace", fontSize: 10, direction: "ltr", wordBreak: "break-all", marginBottom: 6 }}>
            <div style={{ color: "#10b981", fontWeight: 700 }}>VAPID_PUBLIC_KEY:</div>
            <div>{vapidKeys.publicKey}</div>
          </div>
          <div style={{ padding: 10, borderRadius: 8, background: t.bg, fontFamily: "monospace", fontSize: 10, direction: "ltr", wordBreak: "break-all" }}>
            <div style={{ color: "#ef4444", fontWeight: 700 }}>VAPID_PRIVATE_KEY:</div>
            <div>{vapidKeys.privateKey}</div>
          </div>
          <button onClick={function(){ setVapidKeys(null); }} style={{ marginTop: 10, padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid " + t.sep, color: t.txM, fontSize: 10, cursor: "pointer" }}>إخفاء</button>
        </div>
      )}

      <div style={{ background: t.card, borderRadius: 12, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 8 }}>اختر موظف:</div>
        <select value={selected} onChange={function(e){ setSelected(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 13, marginBottom: 14 }}>
          {emps.length === 0 && <option>لا يوجد موظفون</option>}
          {emps.map(function(e){ return <option key={e.id} value={e.id}>{e.name} ({e.idNumber || e.id})</option>; })}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { id: "notif", label: "📢 إشعار", color: B.blue },
            { id: "call", label: "📞 اتصال وهمي", color: B.gold },
            { id: "face", label: "📸 بصمة وجه", color: "#8b5cf6" },
            { id: "checkin", label: "🟢 تسجيل حضور", color: "#10b981" },
            { id: "checkout", label: "🔴 تسجيل انصراف", color: B.red },
            { id: "gps", label: "🛰️ بيانات GPS", color: "#06b6d4" },
          ].map(function(btn) {
            return <button key={btn.id} onClick={function(){ runTest(btn.id); }} disabled={busy || !selected} style={{ padding: "12px 10px", borderRadius: 10, background: busy ? t.sep : btn.color, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>
              {btn.label}
            </button>;
          })}
        </div>
      </div>

      <div style={{ background: t.card, borderRadius: 12, padding: 16, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span>📋 سجل الاختبارات</span>
          {log.length > 0 && <button onClick={function(){ setLog([]); }} style={{ padding: "4px 10px", borderRadius: 6, background: "none", border: "1px solid " + t.sep, color: t.txM, fontSize: 10, cursor: "pointer" }}>مسح</button>}
        </div>
        {log.length === 0 && <div style={{ color: t.txM, fontSize: 11, padding: 14, textAlign: "center", fontStyle: "italic" }}>لم تبدأ اختبارات بعد</div>}
        {log.map(function(item, i) {
          var color = item.type === "ok" ? "#10b981" : item.type === "error" ? B.red : item.type === "warn" ? "#f59e0b" : B.blue;
          return <div key={i} style={{ padding: "8px 10px", borderRadius: 6, marginBottom: 4, background: color + "10", borderRight: "3px solid " + color, fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: t.tx }}>{item.msg}</div>
            {item.details && <div style={{ fontSize: 10, color: t.txM, marginTop: 3, lineHeight: 1.6 }}>{item.details}</div>}
            <div style={{ fontSize: 9, color: t.txM, marginTop: 2 }}>{item.ts}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

/* ═══ CUSTODY PANEL — نظام العهد الكامل (3 أنواع) ═══ */
function CustodyPanel({ t, B, emps }) {
  var [items, setItems] = useState([]);
  var [invoices, setInvoices] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterType, setFilterType] = useState("all");
  var [filterStatus, setFilterStatus] = useState("all");
  var [showNew, setShowNew] = useState(false);
  var [editing, setEditing] = useState(null);
  var [viewingInvoices, setViewingInvoices] = useState(null);
  var [approvingInvoice, setApprovingInvoice] = useState(null);

  useEffect(function(){ load(); }, []);

  async function load() {
    setLoading(true);
    try {
      var r1 = await fetch("/api/data?action=custody");
      var d1 = await r1.json();
      setItems(Array.isArray(d1) ? d1 : []);
      var r2 = await fetch("/api/data?action=custody-invoices");
      var d2 = await r2.json();
      setInvoices(Array.isArray(d2) ? d2 : []);
    } catch(e) {}
    setLoading(false);
  }

  async function saveItem(data) {
    var method = data.id ? "PUT" : "POST";
    var r = await fetch("/api/data?action=custody", {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    var d = await r.json();
    if (d.error) { alert("خطأ: " + d.error); return; }
    load();
    setShowNew(false);
    setEditing(null);
  }

  async function deleteItem(id) {
    if (!confirm("هل تريد حذف هذه العهدة؟")) return;
    await fetch("/api/data?action=custody&id=" + id, { method: "DELETE" });
    load();
  }

  async function returnItem(item) {
    var condition = prompt("حالة العهدة عند الإعادة:\n1. جيدة\n2. تالفة\n3. مفقودة\n\nاكتب: good / damaged / lost");
    if (!condition) return;
    var notes = prompt("ملاحظات:") || "";
    await fetch("/api/data?action=custody-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custodyId: item.id, condition: condition, notes: notes, returnedBy: "admin" }),
    });
    load();
  }

  async function approveInvoice(inv, approved, rejectionReason) {
    await fetch("/api/data?action=custody-invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: inv.id, status: approved ? "approved" : "rejected", rejectionReason: rejectionReason || "", reviewedBy: "admin" }),
    });
    load();
    setApprovingInvoice(null);
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  var filtered = items.filter(function(i) {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  // Stats
  var totalAssets = items.filter(function(i){ return i.type === "asset"; }).length;
  var activeAssets = items.filter(function(i){ return i.type === "asset" && i.status === "active"; }).length;
  var totalCash = items.filter(function(i){ return i.type === "cash"; }).reduce(function(s, c){ return s + (c.amount || 0); }, 0);
  var cashBalance = items.filter(function(i){ return i.type === "cash" && i.status === "active"; }).reduce(function(s, c){ return s + (c.balance || 0); }, 0);
  var pendingInvoices = invoices.filter(function(inv){ return inv.status === "pending"; }).length;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ background: B.blue + "12", border: "1px solid " + B.blue + "40", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        📦 <strong>إدارة العهد</strong> — 3 أنواع من العهد:<br/>
        <span style={{ fontSize: 10 }}>🟢 <strong>استهلاكية</strong> (قرطاسية، مواد) • 🟡 <strong>دائمة</strong> (أجهزة بسيريال) • 🔵 <strong>نقدية</strong> (مع رفع فواتير)</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: B.blue }}>{items.length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>إجمالي العهد</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{activeAssets}</div>
          <div style={{ fontSize: 10, color: t.txM }}>أصول نشطة</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: B.gold }}>{Math.round(totalCash)} ر.س</div>
          <div style={{ fontSize: 10, color: t.txM }}>إجمالي النقدية</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#8b5cf6" }}>{Math.round(cashBalance)} ر.س</div>
          <div style={{ fontSize: 10, color: t.txM }}>رصيد متبقي</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + (pendingInvoices > 0 ? "#f59e0b" : t.sep), textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: pendingInvoices > 0 ? "#f59e0b" : t.txM }}>{pendingInvoices}</div>
          <div style={{ fontSize: 10, color: t.txM }}>فواتير معلّقة</div>
        </div>
      </div>

      {/* Actions bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={function(){ setShowNew(true); setEditing(null); }} style={{ padding: "10px 18px", borderRadius: 10, background: B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          ➕ عهدة جديدة
        </button>
        <select value={filterType} onChange={function(e){ setFilterType(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", color: "#000", border: "1px solid " + t.sep, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <option value="all">كل الأنواع</option>
          <option value="consumable">🟢 استهلاكية</option>
          <option value="asset">🟡 دائمة</option>
          <option value="cash">🔵 نقدية</option>
        </select>
        <select value={filterStatus} onChange={function(e){ setFilterStatus(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", color: "#000", border: "1px solid " + t.sep, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <option value="all">كل الحالات</option>
          <option value="active">نشطة</option>
          <option value="issued">مصروفة</option>
          <option value="returned">معادة</option>
          <option value="damaged">تالفة</option>
          <option value="closed">مغلقة</option>
        </select>
        <button onClick={load} style={{ padding: "10px 14px", borderRadius: 10, background: "none", border: "1px solid " + t.sep, color: t.tx, fontSize: 11, cursor: "pointer" }}>🔄 تحديث</button>
      </div>

      {/* New/Edit form */}
      {(showNew || editing) && <CustodyForm t={t} B={B} emps={emps} initial={editing} onSave={saveItem} onCancel={function(){ setShowNew(false); setEditing(null); }} />}

      {/* List */}
      {filtered.length === 0 && !showNew && !editing && (
        <div style={{ textAlign: "center", padding: 40, color: t.txM, fontSize: 13 }}>
          لا توجد عهد. اضغط "➕ عهدة جديدة" للبدء.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map(function(item){
          var typeLabels = { consumable: "🟢 استهلاكية", asset: "🟡 دائمة", cash: "🔵 نقدية" };
          var statusColors = { active: "#10b981", issued: "#3b82f6", returned: "#64748b", damaged: "#ef4444", lost: "#dc2626", closed: "#94a3b8" };
          var statusLabels = { active: "نشطة", issued: "مصروفة", returned: "معادة", damaged: "تالفة", lost: "مفقودة", closed: "مغلقة" };
          var itemInvoices = invoices.filter(function(inv){ return inv.custodyId === item.id; });
          var emp = emps.find(function(e){ return e.id === item.empId; });

          return (
            <div key={item.id} style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep, borderRight: "4px solid " + (statusColors[item.status] || t.sep) }}>
              <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>{item.name}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: t.bg, color: t.tx, fontWeight: 700 }}>{typeLabels[item.type]}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: (statusColors[item.status] || t.sep) + "20", color: statusColors[item.status] || t.tx, fontWeight: 700 }}>{statusLabels[item.status] || item.status}</span>
                    {item.acknowledged && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#10b98120", color: "#10b981", fontWeight: 700 }}>✓ موقّع</span>}
                    {!item.acknowledged && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#f59e0b20", color: "#f59e0b", fontWeight: 700 }}>⏳ بانتظار التوقيع</span>}
                  </div>

                  <div style={{ fontSize: 11, color: t.tx2, marginBottom: 4 }}>
                    👤 {emp ? emp.name : item.empName || "غير محدد"}
                    {item.category && " • 📁 " + item.category}
                  </div>

                  {item.type === "asset" && (
                    <div style={{ fontSize: 10, color: t.txM, marginTop: 4 }}>
                      {item.brand && "🏢 " + item.brand}
                      {item.model && " • الموديل: " + item.model}
                      {item.serialNumber && " • S/N: " + item.serialNumber}
                      {item.value > 0 && " • القيمة: " + item.value + " ر.س"}
                    </div>
                  )}
                  {item.type === "consumable" && (
                    <div style={{ fontSize: 10, color: t.txM, marginTop: 4 }}>
                      📦 الكمية: {item.quantity} {item.unit}
                      {item.value > 0 && " • القيمة: " + (item.value * item.quantity) + " ر.س"}
                    </div>
                  )}
                  {item.type === "cash" && (
                    <div style={{ marginTop: 6, padding: 8, background: t.bg, borderRadius: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 11 }}>
                        <div><span style={{ color: t.txM }}>المبلغ:</span> <strong style={{ color: B.blue }}>{item.amount} ر.س</strong></div>
                        <div><span style={{ color: t.txM }}>مصروف:</span> <strong style={{ color: "#ef4444" }}>{item.spent || 0} ر.س</strong></div>
                        <div><span style={{ color: t.txM }}>متبقي:</span> <strong style={{ color: "#10b981" }}>{item.balance || item.amount} ر.س</strong></div>
                      </div>
                      {item.purpose && <div style={{ fontSize: 10, color: t.txM, marginTop: 4 }}>🎯 الغرض: {item.purpose}</div>}
                      {itemInvoices.length > 0 && (
                        <div style={{ fontSize: 10, color: t.tx, marginTop: 4 }}>
                          📄 الفواتير: {itemInvoices.length} ({itemInvoices.filter(function(i){ return i.status === "pending"; }).length} معلّقة)
                        </div>
                      )}
                    </div>
                  )}

                  {item.notes && <div style={{ fontSize: 10, color: t.txM, marginTop: 6, fontStyle: "italic" }}>💬 {item.notes}</div>}

                  <div style={{ fontSize: 9, color: t.txM, marginTop: 6 }}>
                    📅 صُرفت في: {new Date(item.issuedAt).toLocaleDateString("ar-SA")}
                    {item.returnedAt && " • ↩️ أعيدت في: " + new Date(item.returnedAt).toLocaleDateString("ar-SA")}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 100 }}>
                  {item.type === "cash" && (
                    <button onClick={function(){ setViewingInvoices(item); }} style={{ padding: "6px 10px", borderRadius: 6, background: B.gold, color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>📄 الفواتير</button>
                  )}
                  {item.type === "asset" && item.status === "active" && (
                    <button onClick={function(){ returnItem(item); }} style={{ padding: "6px 10px", borderRadius: 6, background: "#f59e0b", color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>↩️ إعادة</button>
                  )}
                  <button onClick={function(){ setEditing(item); setShowNew(false); }} style={{ padding: "6px 10px", borderRadius: 6, background: B.blue, color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✏️ تعديل</button>
                  <button onClick={function(){ deleteItem(item.id); }} style={{ padding: "6px 10px", borderRadius: 6, background: "#ef4444", color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🗑️ حذف</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoices Modal */}
      {viewingInvoices && (
        <CustodyInvoicesModal t={t} B={B} custody={viewingInvoices} invoices={invoices.filter(function(i){ return i.custodyId === viewingInvoices.id; })} onClose={function(){ setViewingInvoices(null); load(); }} onApprove={approveInvoice} />
      )}
    </div>
  );
}

/* ═══ CUSTODY FORM ═══ */
function CustodyForm({ t, B, emps, initial, onSave, onCancel }) {
  var [type, setType] = useState(initial ? initial.type : "asset");
  var [name, setName] = useState(initial ? initial.name : "");
  var [category, setCategory] = useState(initial ? initial.category : "");
  var [empId, setEmpId] = useState(initial ? initial.empId : (emps[0] ? emps[0].id : ""));
  var [serialNumber, setSerialNumber] = useState(initial ? initial.serialNumber : "");
  var [brand, setBrand] = useState(initial ? initial.brand : "");
  var [model, setModel] = useState(initial ? initial.model : "");
  var [condition, setCondition] = useState(initial ? initial.condition : "new");
  var [quantity, setQuantity] = useState(initial ? initial.quantity : 1);
  var [unit, setUnit] = useState(initial ? initial.unit : "قطعة");
  var [amount, setAmount] = useState(initial ? initial.amount : "");
  var [purpose, setPurpose] = useState(initial ? initial.purpose : "");
  var [value, setValue] = useState(initial ? initial.value : "");
  var [notes, setNotes] = useState(initial ? initial.notes : "");
  var [photoUrl, setPhotoUrl] = useState(initial ? initial.photoUrl : "");
  var [uploading, setUploading] = useState(false);

  var categories = {
    asset: ["💻 إلكترونيات", "🚗 مركبات", "🔧 معدات", "🪑 أثاث", "📱 أجهزة اتصال", "🎥 تصوير", "أخرى"],
    consumable: ["📝 قرطاسية", "🧹 مستهلكات نظافة", "🔩 قطع غيار", "🍽️ استهلاك مكتبي", "أخرى"],
    cash: ["💵 سلفة", "🎫 مصاريف سفر", "🛒 مشتريات", "📦 تشغيل", "🎉 ضيافة", "أخرى"],
  };

  function save() {
    if (!name.trim()) { alert("يجب إدخال اسم العهدة"); return; }
    if (!empId) { alert("يجب اختيار الموظف"); return; }
    if (type === "asset" && !serialNumber.trim()) { alert("يجب إدخال رقم السيريال"); return; }
    if (type === "cash" && (!amount || parseFloat(amount) <= 0)) { alert("يجب إدخال مبلغ صحيح"); return; }

    var emp = emps.find(function(e){ return e.id === empId; });
    var data = {
      id: initial ? initial.id : undefined,
      type: type,
      name: name.trim(),
      category: category,
      empId: empId,
      empName: emp ? emp.name : "",
      serialNumber: serialNumber,
      brand: brand,
      model: model,
      condition: condition,
      photoUrl: photoUrl,
      quantity: parseInt(quantity) || 1,
      unit: unit,
      amount: parseFloat(amount) || 0,
      purpose: purpose,
      value: parseFloat(value) || 0,
      notes: notes,
    };
    onSave(data);
  }

  async function handlePhotoUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("حجم الصورة كبير جداً (الحد الأقصى 5MB)"); return; }
    setUploading(true);
    try {
      var reader = new FileReader();
      reader.onload = function() {
        setPhotoUrl(reader.result);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch(err) {
      alert("خطأ في رفع الصورة");
      setUploading(false);
    }
  }

  return (
    <div style={{ background: t.bg === "#000000" ? "#1C1C1E" : "#F2F2F7", borderRadius: 12, padding: 16, marginBottom: 14, border: "2px solid " + B.blue }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: B.blue, marginBottom: 12 }}>{initial ? "✏️ تعديل عهدة" : "➕ عهدة جديدة"}</div>

      {/* Type Selection */}
      {!initial && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { id: "consumable", label: "استهلاكية", icon: "🟢", desc: "مواد تُصرف ولا تُرجع" },
            { id: "asset", label: "دائمة", icon: "🟡", desc: "أجهزة بسيريال" },
            { id: "cash", label: "نقدية", icon: "🔵", desc: "مبلغ للصرف مع فواتير" },
          ].map(function(tp) {
            var selected = type === tp.id;
            return <button key={tp.id} type="button" onClick={function(){ setType(tp.id); setCategory(""); }} style={{ padding: 14, borderRadius: 10, background: selected ? B.blue : "#fff", color: selected ? "#fff" : "#000", border: "2px solid " + (selected ? B.blue : "#ddd"), fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{tp.icon}</div>
              <div>{tp.label}</div>
              <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>{tp.desc}</div>
            </button>;
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 11, color: t.tx }}>
          اسم العهدة:
          <input value={name} onChange={function(e){ setName(e.target.value); }} placeholder={type === "cash" ? "مثال: سلفة مشتريات مكتبية" : "مثال: لابتوب ديل"} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          الموظف:
          <select value={empId} onChange={function(e){ setEmpId(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
            <option value="">-- اختر --</option>
            {emps.map(function(e){ return <option key={e.id} value={e.id}>{e.name}</option>; })}
          </select>
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          الفئة:
          <select value={category} onChange={function(e){ setCategory(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
            <option value="">-- اختر --</option>
            {(categories[type] || []).map(function(c){ return <option key={c} value={c}>{c}</option>; })}
          </select>
        </label>

        {/* Asset fields */}
        {type === "asset" && (
          <>
            <label style={{ fontSize: 11, color: t.tx }}>
              رقم السيريال <span style={{ color: "#ef4444" }}>*</span>:
              <input value={serialNumber} onChange={function(e){ setSerialNumber(e.target.value); }} placeholder="SN-1234567" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4, fontFamily: "monospace" }} />
            </label>
            <label style={{ fontSize: 11, color: t.tx }}>
              العلامة التجارية:
              <input value={brand} onChange={function(e){ setBrand(e.target.value); }} placeholder="Dell / HP / Samsung..." style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: t.tx }}>
              الموديل:
              <input value={model} onChange={function(e){ setModel(e.target.value); }} placeholder="Latitude 5520" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: t.tx }}>
              الحالة:
              <select value={condition} onChange={function(e){ setCondition(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
                <option value="new">جديدة</option>
                <option value="used">مستعملة (حالة جيدة)</option>
                <option value="refurbished">مجدّدة</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: t.tx }}>
              القيمة (ر.س):
              <input type="number" value={value} onChange={function(e){ setValue(e.target.value); }} placeholder="3500" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: t.tx, gridColumn: "1 / -1" }}>
              صورة العهدة <span style={{ color: "#ef4444" }}>(مطلوبة)</span>:
              <div style={{ marginTop: 4 }}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ fontSize: 11 }} />
                {uploading && <span style={{ marginRight: 8, fontSize: 11, color: B.blue }}>⏳ جارِ الرفع...</span>}
                {photoUrl && <img src={photoUrl} style={{ marginTop: 6, maxHeight: 150, borderRadius: 8, border: "1px solid " + t.sep }} alt="صورة العهدة" />}
              </div>
            </label>
          </>
        )}

        {/* Consumable fields */}
        {type === "consumable" && (
          <>
            <label style={{ fontSize: 11, color: t.tx }}>
              الكمية:
              <input type="number" value={quantity} onChange={function(e){ setQuantity(e.target.value); }} min={1} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: t.tx }}>
              الوحدة:
              <select value={unit} onChange={function(e){ setUnit(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
                <option value="قطعة">قطعة</option>
                <option value="علبة">علبة</option>
                <option value="كرتون">كرتون</option>
                <option value="لتر">لتر</option>
                <option value="كيلو">كيلو</option>
                <option value="متر">متر</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: t.tx, gridColumn: "1 / -1" }}>
              القيمة للوحدة الواحدة (اختياري):
              <input type="number" value={value} onChange={function(e){ setValue(e.target.value); }} placeholder="10" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
          </>
        )}

        {/* Cash fields */}
        {type === "cash" && (
          <>
            <label style={{ fontSize: 11, color: t.tx }}>
              المبلغ (ر.س) <span style={{ color: "#ef4444" }}>*</span>:
              <input type="number" value={amount} onChange={function(e){ setAmount(e.target.value); }} placeholder="5000" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 11, color: t.tx }}>
              الغرض من الصرف:
              <input value={purpose} onChange={function(e){ setPurpose(e.target.value); }} placeholder="شراء مستلزمات مكتبية" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
            </label>
            <div style={{ gridColumn: "1 / -1", padding: 10, background: B.blue + "10", borderRadius: 8, border: "1px solid " + B.blue + "40", fontSize: 11, color: t.tx, lineHeight: 1.6 }}>
              💡 <strong>ملاحظة:</strong> الموظف سيقوم برفع فواتير الصرف عبر تطبيقه. كل فاتورة ستحتاج لموافقتك قبل خصمها من الرصيد.
            </div>
          </>
        )}

        <label style={{ fontSize: 11, color: t.tx, gridColumn: "1 / -1" }}>
          ملاحظات:
          <textarea value={notes} onChange={function(e){ setNotes(e.target.value); }} rows={2} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4, fontFamily: "inherit", resize: "vertical" }} />
        </label>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button onClick={save} style={{ flex: 1, padding: 10, borderRadius: 8, background: B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>💾 حفظ</button>
        <button onClick={onCancel} style={{ padding: "10px 24px", borderRadius: 8, background: "none", border: "1px solid " + t.sep, color: t.tx, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
      </div>
    </div>
  );
}

/* ═══ CUSTODY INVOICES MODAL — فواتير العهدة النقدية ═══ */
function CustodyInvoicesModal({ t, B, custody, invoices, onClose, onApprove }) {
  var [viewing, setViewing] = useState(null);
  var [rejectReason, setRejectReason] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={function(e){ e.stopPropagation(); }} style={{ background: t.card, borderRadius: 14, padding: 20, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.tx }}>📄 فواتير العهدة</div>
            <div style={{ fontSize: 11, color: t.tx2 }}>{custody.name} • {custody.empName}</div>
          </div>
          <button onClick={onClose} style={{ padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid " + t.sep, color: t.tx, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 12, background: t.bg, borderRadius: 10, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 11 }}>
            <div><span style={{ color: t.txM }}>المبلغ الأصلي:</span> <strong style={{ color: B.blue }}>{custody.amount} ر.س</strong></div>
            <div><span style={{ color: t.txM }}>مصروف:</span> <strong style={{ color: "#ef4444" }}>{custody.spent || 0} ر.س</strong></div>
            <div><span style={{ color: t.txM }}>متبقي:</span> <strong style={{ color: "#10b981" }}>{custody.balance || custody.amount} ر.س</strong></div>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: t.txM, fontSize: 12 }}>لم يرفع الموظف أي فواتير بعد</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {invoices.map(function(inv){
              var statusColors = { pending: "#f59e0b", approved: "#10b981", rejected: "#ef4444" };
              var statusLabels = { pending: "⏳ معلّقة", approved: "✓ معتمدة", rejected: "✗ مرفوضة" };
              return (
                <div key={inv.id} style={{ padding: 12, borderRadius: 10, border: "1px solid " + t.sep, background: t.bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginBottom: 4 }}>{inv.description}</div>
                      <div style={{ fontSize: 11, color: t.tx2 }}>
                        {inv.vendor && "🏪 " + inv.vendor + " • "}
                        📅 {new Date(inv.invoiceDate).toLocaleDateString("ar-SA")}
                        {inv.invoiceNumber && " • فاتورة #" + inv.invoiceNumber}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: B.blue }}>💰 {inv.amount} ر.س</div>
                      {inv.rejectionReason && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>سبب الرفض: {inv.rejectionReason}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "end" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: statusColors[inv.status] + "20", color: statusColors[inv.status] }}>{statusLabels[inv.status]}</span>
                      {inv.photoUrl && <button onClick={function(){ setViewing(inv.photoUrl); }} style={{ padding: "4px 10px", borderRadius: 6, background: B.blue, color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🖼️ عرض</button>}
                      {inv.status === "pending" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={function(){ onApprove(inv, true); }} style={{ padding: "4px 10px", borderRadius: 6, background: "#10b981", color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✓ اعتماد</button>
                          <button onClick={function(){
                            var reason = prompt("سبب الرفض:");
                            if (reason) onApprove(inv, false, reason);
                          }} style={{ padding: "4px 10px", borderRadius: 6, background: "#ef4444", color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✗ رفض</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewing && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={function(){ setViewing(null); }}>
            <img src={viewing} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }} alt="صورة الفاتورة" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ BENEFITS PANEL — إدارة الامتيازات ═══ */
function BenefitsPanel({ t, B }) {
  var [coupons, setCoupons] = useState([]);
  var [loading, setLoading] = useState(true);
  var [editing, setEditing] = useState(null);
  var [showNew, setShowNew] = useState(false);
  var [redemptions, setRedemptions] = useState([]);
  var [filter, setFilter] = useState("all");

  useEffect(function(){
    fetch("/api/data?action=benefits").then(r => r.json()).then(function(d) {
      setCoupons((d && d.coupons) || []);
      setLoading(false);
    });
    fetch("/api/data?action=redemptions").then(r => r.json()).then(function(d) {
      setRedemptions(Array.isArray(d) ? d : []);
    });
  }, []);

  async function saveAll(list) {
    await fetch("/api/data?action=benefits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coupons: list }) });
    setCoupons(list);
  }

  async function addCoupon(c) {
    c.id = c.id || ("C" + Date.now());
    var list = [...coupons, c];
    await saveAll(list);
    setShowNew(false);
  }

  async function updateCoupon(id, updates) {
    var list = coupons.map(function(c){ return c.id === id ? { ...c, ...updates } : c; });
    await saveAll(list);
    setEditing(null);
  }

  async function deleteCoupon(id) {
    if (!confirm("هل تريد حذف هذا الكوبون؟")) return;
    var list = coupons.filter(function(c){ return c.id !== id; });
    await saveAll(list);
  }

  async function toggleActive(id) {
    var list = coupons.map(function(c){ return c.id === id ? { ...c, active: !c.active } : c; });
    await saveAll(list);
  }

  function getRedempCount(couponId) {
    return redemptions.filter(function(r){ return r.couponId === couponId; }).length;
  }

  var cats = ["all", "مطاعم", "خدمات", "رياضة", "تسوق", "سفر", "ترفيه", "صحة", "تعليم", "أخرى"];
  var filtered = filter === "all" ? coupons : coupons.filter(function(c){ return c.cat === filter; });

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ background: B.gold + "12", border: "1px solid " + B.gold + "40", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        🏅 <strong>امتيازات العضوية</strong><br/>
        أنشئ كوبونات خصم ومكافآت يمكن للموظفين استبدالها بنقاطهم.
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: B.blue }}>{coupons.length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>إجمالي الكوبونات</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{coupons.filter(function(c){ return c.active !== false; }).length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>المفعّلة</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: B.gold }}>{redemptions.length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>مرات الصرف</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#8b5cf6" }}>{redemptions.reduce(function(s, r){ return s + (r.pts || 0); }, 0)}</div>
          <div style={{ fontSize: 10, color: t.txM }}>نقاط مصروفة</div>
        </div>
      </div>

      {/* Actions bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={function(){ setShowNew(true); }} style={{ padding: "10px 18px", borderRadius: 10, background: B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          ➕ كوبون جديد
        </button>
        <select value={filter} onChange={function(e){ setFilter(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", color: "#000", border: "1px solid " + t.sep, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {cats.map(function(c){ return <option key={c} value={c} style={{ background: "#fff", color: "#000" }}>{c === "all" ? "كل الفئات" : c}</option>; })}
        </select>
      </div>

      {/* New coupon form */}
      {showNew && <CouponForm t={t} B={B} onSave={addCoupon} onCancel={function(){ setShowNew(false); }} />}

      {/* Coupons list */}
      {filtered.length === 0 && !showNew && (
        <div style={{ textAlign: "center", padding: 40, color: t.txM, fontSize: 13 }}>
          لا توجد كوبونات. اضغط "➕ كوبون جديد" لإضافة أول كوبون.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {filtered.map(function(c){
          var isEditing = editing === c.id;
          var redempCount = getRedempCount(c.id);
          return (
            <div key={c.id} style={{ background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + (c.active === false ? "#ef4444" : t.sep), opacity: c.active === false ? 0.6 : 1 }}>
              {isEditing ? (
                <CouponForm t={t} B={B} initial={c} onSave={function(data){ updateCoupon(c.id, data); }} onCancel={function(){ setEditing(null); }} />
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 32 }}>{c.icon || "🎁"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: t.tx }}>{c.brand}</div>
                      <div style={{ fontSize: 11, color: t.tx2 }}>{c.discount}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, background: B.gold + "20", color: B.gold, fontSize: 10, fontWeight: 700 }}>⭐ {c.pts} نقطة</span>
                    <span style={{ padding: "3px 10px", borderRadius: 6, background: B.blue + "20", color: B.blue, fontSize: 10, fontWeight: 700 }}>{c.cat}</span>
                    {c.minTier > 0 && <span style={{ padding: "3px 10px", borderRadius: 6, background: "#8b5cf620", color: "#8b5cf6", fontSize: 10, fontWeight: 700 }}>{c.minTier === 1 ? "🥇 تميّز+" : "💎 نخبة"}</span>}
                    {c.active === false && <span style={{ padding: "3px 10px", borderRadius: 6, background: "#ef444420", color: "#ef4444", fontSize: 10, fontWeight: 700 }}>معطّل</span>}
                    {redempCount > 0 && <span style={{ padding: "3px 10px", borderRadius: 6, background: "#10b98120", color: "#10b981", fontSize: 10, fontWeight: 700 }}>✓ استُخدم {redempCount}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={function(){ setEditing(c.id); }} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: B.blue, color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ تعديل</button>
                    <button onClick={function(){ toggleActive(c.id); }} style={{ padding: "6px 10px", borderRadius: 6, background: c.active === false ? "#10b981" : "#f59e0b", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{c.active === false ? "▶️" : "⏸️"}</button>
                    <button onClick={function(){ deleteCoupon(c.id); }} style={{ padding: "6px 10px", borderRadius: 6, background: "#ef4444", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent redemptions */}
      {redemptions.length > 0 && (
        <div style={{ marginTop: 20, background: t.card, borderRadius: 12, padding: 14, border: "1px solid " + t.sep }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: B.blue, marginBottom: 10 }}>📊 آخر عمليات الصرف</div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {redemptions.slice(0, 20).map(function(r){
              return <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + t.sep, fontSize: 11 }}>
                <span style={{ color: t.tx }}>{r.couponName || "كوبون"}</span>
                <span style={{ color: B.gold, fontWeight: 700 }}>−{r.pts} نقطة</span>
                <span style={{ color: t.txM, fontSize: 10 }}>{new Date(r.ts).toLocaleDateString("ar-SA")}</span>
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ COUPON FORM — نموذج إضافة/تعديل كوبون ═══ */
function CouponForm({ t, B, initial, onSave, onCancel }) {
  var [brand, setBrand] = useState(initial ? initial.brand : "");
  var [discount, setDiscount] = useState(initial ? initial.discount : "");
  var [icon, setIcon] = useState(initial ? initial.icon : "🎁");
  var [pts, setPts] = useState(initial ? initial.pts : 50);
  var [cat, setCat] = useState(initial ? initial.cat : "مطاعم");
  var [minTier, setMinTier] = useState(initial ? initial.minTier : 0);
  var [active, setActive] = useState(initial ? initial.active !== false : true);
  var [expiry, setExpiry] = useState(initial && initial.expiry ? initial.expiry : "");
  var [limit, setLimit] = useState(initial && initial.limit ? initial.limit : "");

  var icons = ["🎁", "🍔", "☕", "🍕", "🚗", "🛒", "💪", "📱", "🏨", "✈️", "💻", "🎮", "📚", "🎬", "🏥", "💊", "🎨", "🌙", "🌴", "🎁", "💰", "🏆"];

  function save() {
    if (!brand.trim() || !discount.trim()) { alert("يجب إدخال اسم الشركة والوصف"); return; }
    onSave({
      brand: brand.trim(),
      discount: discount.trim(),
      icon: icon,
      pts: parseInt(pts) || 0,
      cat: cat,
      minTier: parseInt(minTier) || 0,
      active: active,
      expiry: expiry || null,
      limit: limit ? parseInt(limit) : null,
    });
  }

  return (
    <div style={{ background: t.bg === "#000000" ? "#1C1C1E" : "#F2F2F7", borderRadius: 12, padding: 16, marginBottom: 10, border: "2px solid " + B.blue }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: B.blue, marginBottom: 10 }}>{initial ? "✏️ تعديل كوبون" : "➕ كوبون جديد"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontSize: 11, color: t.tx }}>
          اسم الشركة/المحل:
          <input value={brand} onChange={function(e){ setBrand(e.target.value); }} placeholder="مثال: مطعم البيك" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          وصف العرض:
          <input value={discount} onChange={function(e){ setDiscount(e.target.value); }} placeholder="مثال: خصم 15%" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: t.tx, gridColumn: "1/-1" }}>
          الأيقونة:
          <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 80, overflowY: "auto" }}>
            {icons.map(function(ic){
              return <button key={ic} type="button" onClick={function(){ setIcon(ic); }} style={{ fontSize: 22, padding: 6, borderRadius: 6, background: icon === ic ? B.blue + "30" : "transparent", border: icon === ic ? "2px solid " + B.blue : "1px solid " + t.sep, cursor: "pointer", minWidth: 40 }}>{ic}</button>;
            })}
          </div>
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          النقاط المطلوبة:
          <input type="number" value={pts} onChange={function(e){ setPts(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          الفئة:
          <select value={cat} onChange={function(e){ setCat(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
            {["مطاعم","خدمات","رياضة","تسوق","سفر","ترفيه","صحة","تعليم","أخرى"].map(function(c){ return <option key={c} value={c} style={{ background: "#fff", color: "#000" }}>{c}</option>; })}
          </select>
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          أقل مستوى عضوية:
          <select value={minTier} onChange={function(e){ setMinTier(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
            <option value={0} style={{ background: "#fff", color: "#000" }}>🔵 فعّال (للجميع)</option>
            <option value={1} style={{ background: "#fff", color: "#000" }}>🥇 تميّز (500+ نقطة)</option>
            <option value={2} style={{ background: "#fff", color: "#000" }}>💎 نخبة (1200+ نقطة)</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          تاريخ الانتهاء (اختياري):
          <input type="date" value={expiry} onChange={function(e){ setExpiry(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          عدد محدود (اختياري):
          <input type="number" value={limit} onChange={function(e){ setLimit(e.target.value); }} placeholder="فارغ = غير محدود" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: t.tx, gridColumn: "1/-1" }}>
          <input type="checkbox" checked={active} onChange={function(e){ setActive(e.target.checked); }} /> مفعّل ومتاح للموظفين
        </label>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={save} style={{ flex: 1, padding: 10, borderRadius: 8, background: B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>💾 حفظ</button>
        <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 8, background: "none", border: "1px solid " + t.sep, color: t.tx, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
      </div>
    </div>
  );
}

/* ═══ ANNOUNCEMENTS PANEL — التعاميم ═══ */
function AnnouncementsPanel({ t, B, emps, branches }) {
  var [list, setList] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showNew, setShowNew] = useState(false);
  var [editing, setEditing] = useState(null);

  useEffect(function(){
    load();
  }, []);

  async function load() {
    setLoading(true);
    var r = await fetch("/api/data?action=announcements");
    var d = await r.json();
    setList(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function save(data) {
    await fetch("/api/data?action=announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    load();
    setShowNew(false);
    setEditing(null);
  }

  async function deleteAnn(id) {
    if (!confirm("هل تريد حذف هذا التعميم؟")) return;
    await fetch("/api/data?action=announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delete: id }) });
    load();
  }

  async function togglePublish(a) {
    await save({ ...a, published: !a.published });
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  var published = list.filter(function(a){ return a.published; });
  var drafts = list.filter(function(a){ return !a.published; });
  var totalReads = list.reduce(function(s, a){ return s + ((a.readBy || []).length); }, 0);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ background: "#8b5cf615", border: "1px solid #8b5cf640", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        📢 <strong>التعاميم</strong><br/>
        أنشئ تعاميم للموظفين. يمكن استهداف الكل أو فرع معيّن أو موظفين محددين.
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#8b5cf6" }}>{list.length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>إجمالي</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{published.length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>منشورة</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b" }}>{drafts.length}</div>
          <div style={{ fontSize: 10, color: t.txM }}>مسودات</div>
        </div>
        <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: B.blue }}>{totalReads}</div>
          <div style={{ fontSize: 10, color: t.txM }}>مرات القراءة</div>
        </div>
      </div>

      <button onClick={function(){ setShowNew(true); }} style={{ marginBottom: 14, padding: "10px 18px", borderRadius: 10, background: "#8b5cf6", color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
        ➕ تعميم جديد
      </button>

      {showNew && <AnnouncementForm t={t} B={B} emps={emps} branches={branches} onSave={save} onCancel={function(){ setShowNew(false); }} />}

      {list.length === 0 && !showNew && (
        <div style={{ textAlign: "center", padding: 40, color: t.txM, fontSize: 13 }}>
          لا توجد تعاميم. اضغط "➕ تعميم جديد" لإنشاء أول تعميم.
        </div>
      )}

      {list.map(function(a){
        var isEditing = editing === a.id;
        if (isEditing) {
          return <AnnouncementForm key={a.id} t={t} B={B} emps={emps} branches={branches} initial={a} onSave={save} onCancel={function(){ setEditing(null); }} />;
        }
        var readCount = (a.readBy || []).length;
        var targetLabel = a.target === "all" ? "جميع الموظفين" : a.target === "branch" ? "فرع محدد" : "موظفين محددين";
        var priorityColors = { normal: B.blue, important: "#f59e0b", urgent: "#ef4444" };
        var pColor = priorityColors[a.priority] || B.blue;

        return (
          <div key={a.id} style={{ background: t.card, borderRadius: 12, padding: 16, marginBottom: 10, border: "1px solid " + t.sep, borderRight: "4px solid " + pColor }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>{a.icon || "📢"} {a.title}</span>
                  {a.priority === "urgent" && <span style={{ padding: "2px 8px", borderRadius: 4, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800 }}>عاجل</span>}
                  {a.priority === "important" && <span style={{ padding: "2px 8px", borderRadius: 4, background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 800 }}>مهم</span>}
                  {!a.published && <span style={{ padding: "2px 8px", borderRadius: 4, background: t.sep, color: t.tx, fontSize: 9, fontWeight: 800 }}>مسودة</span>}
                </div>
                <div style={{ fontSize: 12, color: t.tx2, lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-wrap" }}>{a.body}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 10, color: t.txM, flexWrap: "wrap" }}>
                  <span>🎯 {targetLabel}</span>
                  <span>📅 {new Date(a.ts).toLocaleString("ar-SA")}</span>
                  {readCount > 0 && <span>👁 قرأها {readCount} موظف</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={function(){ togglePublish(a); }} style={{ padding: "6px 10px", borderRadius: 6, background: a.published ? "#f59e0b" : "#10b981", color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{a.published ? "⏸️ سحب" : "📤 نشر"}</button>
                <button onClick={function(){ setEditing(a.id); }} style={{ padding: "6px 10px", borderRadius: 6, background: B.blue, color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✏️ تعديل</button>
                <button onClick={function(){ deleteAnn(a.id); }} style={{ padding: "6px 10px", borderRadius: 6, background: "#ef4444", color: "#fff", border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🗑️ حذف</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ ANNOUNCEMENT FORM ═══ */
function AnnouncementForm({ t, B, emps, branches, initial, onSave, onCancel }) {
  var [title, setTitle] = useState(initial ? initial.title : "");
  var [body, setBody] = useState(initial ? initial.body : "");
  var [icon, setIcon] = useState(initial ? initial.icon : "📢");
  var [priority, setPriority] = useState(initial ? initial.priority : "normal");
  var [target, setTarget] = useState(initial ? initial.target : "all");
  var [targetIds, setTargetIds] = useState(initial && initial.targetIds ? initial.targetIds : []);
  var [published, setPublished] = useState(initial ? initial.published : true);
  var [sendPush, setSendPush] = useState(initial ? false : true);

  var icons = ["📢", "📣", "🔔", "⚠️", "✅", "🎉", "📝", "🕐", "💼", "🏢", "🎁", "🏆", "📊", "🔧"];

  async function handleSave() {
    if (!title.trim()) { alert("يجب إدخال عنوان التعميم"); return; }
    if (!body.trim()) { alert("يجب إدخال نص التعميم"); return; }
    var data = {
      ...(initial || {}),
      title: title.trim(),
      body: body.trim(),
      icon: icon,
      priority: priority,
      target: target,
      targetIds: targetIds,
      published: published,
    };
    await onSave(data);

    // Send push notifications if published and sendPush is on
    if (published && sendPush && !initial) {
      var targets = [];
      if (target === "all") targets = emps.map(function(e){ return e.id; });
      else if (target === "employees") targets = targetIds;
      else if (target === "branch") targets = emps.filter(function(e){ return targetIds.indexOf(e.branch) >= 0; }).map(function(e){ return e.id; });

      for (var i = 0; i < Math.min(targets.length, 50); i++) {
        fetch("/api/data?action=test-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empId: targets[i],
            type: "announcement",
            title: (priority === "urgent" ? "🚨 " : priority === "important" ? "⚠️ " : "📢 ") + title.trim(),
            message: body.trim().slice(0, 100),
          }),
        }).catch(function(){});
      }
    }
  }

  return (
    <div style={{ background: t.bg === "#000000" ? "#1C1C1E" : "#F2F2F7", borderRadius: 12, padding: 16, marginBottom: 10, border: "2px solid #8b5cf6" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#8b5cf6", marginBottom: 10 }}>{initial ? "✏️ تعديل تعميم" : "➕ تعميم جديد"}</div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ fontSize: 11, color: t.tx }}>
          العنوان:
          <input value={title} onChange={function(e){ setTitle(e.target.value); }} placeholder="عنوان التعميم" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 11, color: t.tx }}>
          نص التعميم:
          <textarea value={body} onChange={function(e){ setBody(e.target.value); }} placeholder="محتوى التعميم..." rows={6} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4, fontFamily: "inherit", resize: "vertical" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 11, color: t.tx }}>
            الأولوية:
            <select value={priority} onChange={function(e){ setPriority(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
              <option value="normal" style={{ background: "#fff", color: "#000" }}>🔵 عادي</option>
              <option value="important" style={{ background: "#fff", color: "#000" }}>⚠️ مهم</option>
              <option value="urgent" style={{ background: "#fff", color: "#000" }}>🚨 عاجل</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: t.tx }}>
            الأيقونة:
            <select value={icon} onChange={function(e){ setIcon(e.target.value); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
              {icons.map(function(ic){ return <option key={ic} value={ic} style={{ background: "#fff", color: "#000" }}>{ic}</option>; })}
            </select>
          </label>
        </div>
        <label style={{ fontSize: 11, color: t.tx }}>
          الاستهداف:
          <select value={target} onChange={function(e){ setTarget(e.target.value); setTargetIds([]); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + t.sep, background: "#fff", color: "#000", marginTop: 4 }}>
            <option value="all" style={{ background: "#fff", color: "#000" }}>👥 جميع الموظفين</option>
            <option value="branch" style={{ background: "#fff", color: "#000" }}>🏢 فرع محدد</option>
            <option value="employees" style={{ background: "#fff", color: "#000" }}>👤 موظفين محددين</option>
          </select>
        </label>
        {target === "branch" && branches && branches.length > 0 && (
          <div style={{ fontSize: 11, color: t.tx }}>
            اختر الفرع(الفروع):
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {branches.map(function(br){
                var selected = targetIds.indexOf(br.id) >= 0;
                return <button key={br.id} type="button" onClick={function(){
                  setTargetIds(selected ? targetIds.filter(function(x){ return x !== br.id; }) : [...targetIds, br.id]);
                }} style={{ padding: "6px 12px", borderRadius: 6, background: selected ? B.blue : "none", color: selected ? "#fff" : t.tx, border: "1px solid " + (selected ? B.blue : t.sep), fontSize: 11, cursor: "pointer" }}>{br.name}</button>;
              })}
            </div>
          </div>
        )}
        {target === "employees" && emps && emps.length > 0 && (
          <div style={{ fontSize: 11, color: t.tx }}>
            اختر الموظف(الموظفين):
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 150, overflowY: "auto", padding: 6, border: "1px solid " + t.sep, borderRadius: 8 }}>
              {emps.map(function(e){
                var selected = targetIds.indexOf(e.id) >= 0;
                return <button key={e.id} type="button" onClick={function(){
                  setTargetIds(selected ? targetIds.filter(function(x){ return x !== e.id; }) : [...targetIds, e.id]);
                }} style={{ padding: "4px 10px", borderRadius: 6, background: selected ? B.blue : "none", color: selected ? "#fff" : t.tx, border: "1px solid " + (selected ? B.blue : t.sep), fontSize: 10, cursor: "pointer" }}>{e.name}</button>;
              })}
            </div>
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: t.tx }}>
          <input type="checkbox" checked={published} onChange={function(e){ setPublished(e.target.checked); }} /> نشر مباشرة (غير مفعّل = حفظ كمسودة)
        </label>
        {!initial && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: t.tx }}>
            <input type="checkbox" checked={sendPush} onChange={function(e){ setSendPush(e.target.checked); }} /> إرسال إشعار Push للموظفين
          </label>
        )}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={handleSave} style={{ flex: 1, padding: 10, borderRadius: 8, background: "#8b5cf6", color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>💾 {published ? "نشر" : "حفظ كمسودة"}</button>
        <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 8, background: "none", border: "1px solid " + t.sep, color: t.tx, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
      </div>
    </div>
  );
}

/* ═══ STORAGE PANEL — مراقبة وإدارة التخزين ═══ */
/* ═══ ORG HIERARCHY PANEL — الهيكل التنظيمي (مَن يدير مَن) ═══ */
function OrgHierarchyPanel({ t, B }) {
  var [employees, setEmployees] = useState([]);
  var [hierarchy, setHierarchy] = useState({});
  var [loading, setLoading] = useState(true);
  var [saving, setSaving] = useState(false);
  var [pending, setPending] = useState({}); // { empId: managerId } — unsaved changes
  var [search, setSearch] = useState("");
  var [err, setErr] = useState(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      var r = await fetch("/api/data?action=org_hierarchy");
      var d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || "خطأ"); }
      else {
        setEmployees(d.employees || []);
        setHierarchy(d.hierarchy || {});
      }
    } catch(e) { setErr(e.message || "خطأ"); }
    setLoading(false);
  }

  useEffect(function(){ load(); }, []);

  function getCurrentManager(empId) {
    var key = String(empId);
    if (pending.hasOwnProperty(key)) return pending[key];
    return hierarchy[key] || "";
  }

  function setManagerFor(empId, managerId) {
    setPending(function(p){
      var n = Object.assign({}, p);
      n[String(empId)] = managerId || null;
      return n;
    });
  }

  async function saveAll() {
    if (Object.keys(pending).length === 0) { alert("لا تغييرات للحفظ"); return; }
    setSaving(true);
    try {
      var r = await fetch("/api/data?action=org_hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: pending }),
      });
      var d = await r.json();
      if (!r.ok || !d.ok) {
        alert("فشل الحفظ: " + (d.error || "خطأ"));
      } else {
        alert("✅ تم حفظ " + d.updated + " تغيير");
        setPending({});
        await load();
      }
    } catch(e) { alert("فشل: " + (e.message || "خطأ")); }
    setSaving(false);
  }

  function discardChanges() {
    if (Object.keys(pending).length === 0) return;
    if (confirm("تجاهل " + Object.keys(pending).length + " تغيير غير محفوظ؟")) setPending({});
  }

  // Filter
  var filtered = employees.filter(function(e){
    if (!search.trim()) return true;
    var q = search.trim().toLowerCase();
    return ((e.name||"") + " " + (e.username||"") + " " + (e.department||"")).toLowerCase().indexOf(q) >= 0;
  });

  // Build a set of potential managers (any employee that someone reports to, OR isManager/isAdmin)
  var potentialManagers = employees.filter(function(e){
    if (e.isAdmin || e.isManager) return true;
    // also include anyone who is a manager via hierarchy
    var eid = String(e.id || e.username);
    return Object.values(hierarchy).indexOf(eid) >= 0 || Object.values(pending).indexOf(eid) >= 0;
  });

  // Detect cycles (simple check)
  function getCycle(startEmpId) {
    var seen = new Set();
    var cur = String(startEmpId);
    while (cur) {
      if (seen.has(cur)) return true;
      seen.add(cur);
      var next = pending[cur] !== undefined ? pending[cur] : hierarchy[cur];
      if (!next) break;
      cur = String(next);
    }
    return false;
  }

  var pendingCount = Object.keys(pending).length;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: t.tx2 }}>جارِ تحميل الموظفين...</div>;

  return (
    <div>
      {/* Info banner */}
      <div style={{ background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.2)", borderRadius: 12, padding: 14, marginBottom: 14, lineHeight: 1.7 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: B.blue, marginBottom: 6 }}>🏢 الهيكل التنظيمي</div>
        <div style={{ fontSize: 11, color: t.tx }}>
          حدّد المدير المباشر لكل موظف. كل مدير يرى مهام موظفيه المباشرين في "وارد/مُرسَل/مُنجَز إدارتي".<br/>
          المدير الأعلى (مدير المدير) يرى كل شيء أسفل منه بالتدرّج.
        </div>
      </div>

      {err && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: 12, marginBottom: 14, color: "#ef4444", fontSize: 12 }}>❌ {err}</div>}

      {/* Search + Save bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" value={search} onChange={function(e){ setSearch(e.target.value); }} placeholder="🔍 ابحث باسم أو قسم..." style={{ flex: "1 1 200px", padding: "10px 14px", borderRadius: 10, border: "1px solid " + t.sep, background: t.card, color: t.tx, fontSize: 12, fontFamily: "inherit", outline: "none", minWidth: 200 }} />
        {pendingCount > 0 && (
          <>
            <span style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 11, fontWeight: 800 }}>⚠️ {pendingCount} تغيير غير محفوظ</span>
            <button onClick={discardChanges} disabled={saving} style={{ padding: "9px 14px", borderRadius: 10, background: "transparent", color: t.tx, border: "1px solid " + t.sep, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            <button onClick={saveAll} disabled={saving} style={{ padding: "9px 16px", borderRadius: 10, background: saving ? t.sep : "#10b981", color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
              {saving ? "⏳ ..." : "💾 حفظ كل التغييرات"}
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        <StatMini label="إجمالي الموظفين" value={employees.length} color={B.blue} t={t} />
        <StatMini label="لديهم مدير مباشر" value={employees.filter(function(e){ return hierarchy[String(e.id||e.username)]; }).length} color="#10b981" t={t} />
        <StatMini label="بدون مدير محدد" value={employees.filter(function(e){ return !hierarchy[String(e.id||e.username)] && !e.isAdmin; }).length} color="#f59e0b" t={t} />
        <StatMini label="مدراء في الهرم" value={potentialManagers.length} color="#7c3aed" t={t} />
      </div>

      {/* Employees list */}
      <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.sep, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: t.tx2, fontSize: 12 }}>لا نتائج</div>
        ) : filtered.map(function(emp, idx){
          var eid = String(emp.id || emp.username || "");
          var curMgr = getCurrentManager(eid);
          var hasChange = pending.hasOwnProperty(eid);
          var isCycle = curMgr && getCycle(eid);
          var mgrEmp = employees.find(function(e){ return String(e.id||e.username) === String(curMgr); });

          return (
            <div key={eid} style={{ padding: 12, borderBottom: idx < filtered.length - 1 ? "1px solid " + t.sep : "none", display: "flex", alignItems: "center", gap: 12, background: hasChange ? "rgba(245,158,11,0.06)" : "transparent" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: emp.isAdmin ? B.red+"22" : emp.isManager ? B.blue+"22" : t.bg, color: emp.isAdmin ? B.red : emp.isManager ? B.blue : t.tx, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                {(emp.name||emp.username||"?").charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>{emp.name || emp.username}</span>
                  {emp.isAdmin && <span style={{ padding: "1px 8px", fontSize: 9, fontWeight: 800, background: B.red+"20", color: B.red, borderRadius: 4 }}>مدير عام</span>}
                  {emp.isManager && !emp.isAdmin && <span style={{ padding: "1px 8px", fontSize: 9, fontWeight: 800, background: B.blue+"20", color: B.blue, borderRadius: 4 }}>مدير</span>}
                  {hasChange && <span style={{ padding: "1px 8px", fontSize: 9, fontWeight: 800, background: "rgba(245,158,11,0.2)", color: "#f59e0b", borderRadius: 4 }}>معدّل</span>}
                  {isCycle && <span style={{ padding: "1px 8px", fontSize: 9, fontWeight: 800, background: "rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 4 }}>⚠️ حلقة</span>}
                </div>
                <div style={{ fontSize: 10, color: t.tx2, marginTop: 2 }}>
                  {emp.department || "—"} · {emp.role || "—"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 220 }}>
                <div style={{ fontSize: 9, color: t.txM, fontWeight: 700 }}>المدير المباشر:</div>
                <select
                  value={curMgr || ""}
                  onChange={function(e){ setManagerFor(eid, e.target.value); }}
                  disabled={emp.isAdmin}
                  style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid " + (hasChange ? "#f59e0b" : t.sep), background: t.inp, color: t.tx, fontSize: 11, fontFamily: "inherit", outline: "none", cursor: emp.isAdmin ? "not-allowed" : "pointer" }}
                >
                  <option value="">— لا يوجد (أعلى الهرم) —</option>
                  {employees.filter(function(m){
                    var mid = String(m.id||m.username);
                    return mid !== eid; // can't be own manager
                  }).map(function(m){
                    var mid = String(m.id||m.username);
                    return <option key={mid} value={mid}>{m.name || m.username}{m.department ? " ("+m.department+")" : ""}</option>;
                  })}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Help */}
      <div style={{ marginTop: 14, padding: 12, background: t.card, borderRadius: 10, border: "1px solid " + t.sep, fontSize: 11, color: t.tx2, lineHeight: 1.7 }}>
        💡 <b>نصائح:</b><br/>
        • المدير العام (admin) لا يحتاج مديراً — هو أعلى الهرم.<br/>
        • إذا لم تحدد مديراً للموظف، مهامه لا تظهر لأحد في "وارد إدارتي".<br/>
        • تجنّب الحلقات (فلان يدير فلان الذي يدير فلان الأول) — النظام يحذّرك.<br/>
        • اضغط "💾 حفظ" بعد الانتهاء من كل التغييرات.
      </div>
    </div>
  );
}

function StatMini({ label, value, color, t }) {
  return (
    <div style={{ background: t.card, borderRadius: 10, padding: 12, border: "1px solid " + t.sep, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: color, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 10, color: t.tx2, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ═══ SYSTEM CHECK PANEL — فحص شامل لكل النظام ═══ */
function SystemCheckPanel({ t, B }) {
  var [report, setReport] = useState(null);
  var [running, setRunning] = useState(false);
  var [err, setErr] = useState(null);
  var [testResults, setTestResults] = useState({});
  var [testingItem, setTestingItem] = useState(null);
  var [expandedSection, setExpandedSection] = useState(null);

  async function runCheck() {
    setRunning(true);
    setErr(null);
    setTestResults({});
    try {
      var r = await fetch("/api/data?action=system_check");
      var data = await r.json();
      if (!r.ok || data.error) {
        setErr(data.error || ("خطأ " + r.status));
      } else {
        setReport(data);
        // Auto-expand sections with failures
        if (data.failed_checks && data.failed_checks.length > 0) {
          var firstFailSection = data.failed_checks[0].split(".")[0];
          setExpandedSection(firstFailSection);
        } else {
          setExpandedSection("storage");
        }
      }
    } catch(e) {
      setErr("فشل الاتصال: " + (e.message || "خطأ"));
    }
    setRunning(false);
  }

  useEffect(function(){ runCheck(); }, []);

  // ═══ Feature tests (frontend-triggered) ═══
  var featureTests = [
    { id: "auth_check", label: "حالة تسجيل الدخول", run: async function(){
      var ok = !!localStorage.getItem("basma_admin_email");
      return { ok: ok, msg: ok ? "مسجّل الدخول: " + localStorage.getItem("basma_admin_email") : "غير مسجّل" };
    }},
    { id: "api_ping", label: "الاتصال بـ API", run: async function(){
      var t0 = Date.now();
      var r = await fetch("/api/data?action=settings");
      return { ok: r.ok, msg: r.status + " — " + (Date.now()-t0) + "ms" };
    }},
    { id: "tawasul_list", label: "تحميل قائمة التواصل", run: async function(){
      var r = await fetch("/api/data?action=tawasul-list");
      var d = await r.json();
      return { ok: !d.error, msg: (d.requests||[]).length + " مهمة · " + (d.categories||[]).length + " تصنيف · " + (d.projects||[]).length + " مشروع" };
    }},
    { id: "tawasul_categories_endpoint", label: "endpoint التصنيفات", run: async function(){
      var r = await fetch("/api/data?action=tawasul-categories");
      var d = await r.json();
      return { ok: r.ok && !d.error, msg: r.ok ? (Array.isArray(d.categories) ? d.categories.length + " تصنيف" : "OK") : "status " + r.status };
    }},
    { id: "tawasul_projects_endpoint", label: "endpoint المشاريع", run: async function(){
      var r = await fetch("/api/data?action=tawasul-projects");
      var d = await r.json();
      return { ok: r.ok && !d.error, msg: r.ok ? (Array.isArray(d.projects) ? d.projects.length + " مشروع" : "OK") : "status " + r.status };
    }},
    { id: "tawasul_permissions_endpoint", label: "endpoint الصلاحيات", run: async function(){
      var r = await fetch("/api/data?action=tawasul-permissions");
      var d = await r.json();
      return { ok: r.ok && !d.error, msg: r.ok ? (Array.isArray(d.permissions) ? d.permissions.length + " موظف" : "OK") : "status " + r.status };
    }},
    { id: "tawasul_roundtrip", label: "دورة حياة مهمة كاملة (إنشاء ← تحديث ← حذف)", run: async function(){
      // Create a test task
      var testId = "twsl_test_" + Date.now();
      var testReq = {
        id: testId,
        title: "🧪 [اختبار نظام] مهمة اختبارية — احذفها",
        description: "هذه مهمة أُنشئت بواسطة أداة الفحص للتحقق من سلامة نظام التواصل. تُحذف تلقائياً.",
        status: "draft",
        urgency: "normal",
        category: "admin",
        department: "اختبار",
        requesterId: "system_test",
        requesterName: "🧪 أداة الفحص",
        assignees: [],
        log: [],
      };
      // 1. Create
      var c = await fetch("/api/data?action=tawasul-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: testReq }) });
      var cd = await c.json();
      if (!cd.ok) return { ok: false, msg: "فشل الإنشاء: " + (cd.error || "خطأ") };
      var createdId = cd.request && cd.request.id;
      if (!createdId) return { ok: false, msg: "الإنشاء تم لكن لم يُرجع ID" };
      // 2. Update
      var updated = Object.assign({}, cd.request, { title: "🧪 [محدّث] اختبار", status: "sent" });
      var u = await fetch("/api/data?action=tawasul-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: updated }) });
      var ud = await u.json();
      if (!ud.ok) return { ok: false, msg: "فشل التحديث: " + (ud.error || "خطأ") };
      // 3. Verify it's in the list
      var l = await fetch("/api/data?action=tawasul-list");
      var ld = await l.json();
      var found = (ld.requests || []).find(function(x){ return x.id === createdId; });
      if (!found) return { ok: false, msg: "المهمة لم تظهر في قائمة التواصل بعد الحفظ" };
      // 4. Delete
      var del = await fetch("/api/data?action=tawasul-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: createdId }) });
      var dd = await del.json();
      if (!dd.ok) return { ok: false, msg: "فشل الحذف: " + (dd.error || "خطأ") };
      return { ok: true, msg: "✓ إنشاء + تحديث + قراءة + حذف = كل الدورة تعمل" };
    }},
    { id: "notifications_push", label: "إشعارات المتصفح (Notification API)", run: async function(){
      if (typeof Notification === "undefined") return { ok: false, msg: "غير مدعوم" };
      return { ok: Notification.permission === "granted", msg: Notification.permission };
    }},
    { id: "service_worker", label: "Service Worker (PWA)", run: async function(){
      if (!("serviceWorker" in navigator)) return { ok: false, msg: "غير مدعوم" };
      var regs = await navigator.serviceWorker.getRegistrations();
      return { ok: regs.length > 0, msg: regs.length + " مسجّل" };
    }},
    { id: "local_storage", label: "Local Storage", run: async function(){
      try {
        localStorage.setItem("__test", "1");
        var ok = localStorage.getItem("__test") === "1";
        localStorage.removeItem("__test");
        return { ok: ok, msg: ok ? "يعمل" : "لا يعمل" };
      } catch(e) { return { ok: false, msg: e.message }; }
    }},
    { id: "geolocation", label: "تحديد الموقع (GPS)", run: async function(){
      if (!navigator.geolocation) return { ok: false, msg: "غير مدعوم" };
      return new Promise(function(resolve){
        navigator.geolocation.getCurrentPosition(
          function(p){ resolve({ ok: true, msg: "OK — دقة " + Math.round(p.coords.accuracy) + "م" }); },
          function(e){ resolve({ ok: false, msg: "خطأ " + e.code + ": " + e.message }); },
          { timeout: 5000, enableHighAccuracy: false }
        );
      });
    }},
    { id: "camera", label: "الكاميرا (بصمة الوجه)", run: async function(){
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, msg: "غير مدعوم" };
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(function(track){ track.stop(); });
        return { ok: true, msg: "الوصول متاح" };
      } catch(e) { return { ok: false, msg: e.name + ": " + e.message }; }
    }},
    { id: "online_status", label: "حالة الاتصال", run: async function(){
      return { ok: navigator.onLine, msg: navigator.onLine ? "متصل" : "غير متصل" };
    }},
    { id: "clock_sync", label: "توقيت الجهاز", run: async function(){
      var t0 = Date.now();
      var r = await fetch("/api/data?action=settings");
      await r.json();
      var serverRequestMs = Date.now() - t0;
      return { ok: true, msg: "توقيت محلي: " + new Date().toLocaleString("ar-SA") + " (زمن الخادم ~" + serverRequestMs + "ms)" };
    }},
  ];

  async function runFeatureTest(ft) {
    setTestingItem(ft.id);
    try {
      var res = await ft.run();
      setTestResults(function(p){ var n = Object.assign({}, p); n[ft.id] = res; return n; });
    } catch(e) {
      setTestResults(function(p){ var n = Object.assign({}, p); n[ft.id] = { ok: false, msg: "خطأ: " + (e.message || "غير معروف") }; return n; });
    }
    setTestingItem(null);
  }

  async function runAllFeatureTests() {
    for (var i = 0; i < featureTests.length; i++) {
      await runFeatureTest(featureTests[i]);
    }
  }

  // ═══ UI helpers ═══
  function statusColor(ok) {
    if (ok === true) return "#10b981";
    if (ok === false) return "#ef4444";
    return "#94a3b8";
  }
  function statusIcon(ok) {
    if (ok === true) return "✅";
    if (ok === false) return "❌";
    return "⚠️";
  }

  var sectionIcons = {
    storage: "💾",
    data: "📊",
    config: "⚙️",
    integrations: "🔗",
    tawasul: "🤝",
  };
  var sectionLabels = {
    storage: "طبقة التخزين",
    data: "سلامة البيانات",
    config: "الإعدادات",
    integrations: "التكاملات الخارجية",
    tawasul: "نظام التواصل",
  };

  function renderSection(sectionKey) {
    var section = report.sections[sectionKey];
    if (!section) return null;
    var items = Object.keys(section);
    var okCount = items.filter(function(k){ return section[k].ok !== false; }).length;
    var isExpanded = expandedSection === sectionKey;
    return (
      <div key={sectionKey} style={{ marginBottom: 10, background: t.card, borderRadius: 12, border: "1px solid " + t.sep, overflow: "hidden" }}>
        <button onClick={function(){ setExpandedSection(isExpanded ? null : sectionKey); }} style={{ width: "100%", padding: "14px 16px", background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontSize: 22 }}>{sectionIcons[sectionKey] || "📦"}</span>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>{sectionLabels[sectionKey] || sectionKey}</div>
            <div style={{ fontSize: 11, color: t.tx2, marginTop: 2 }}>{okCount}/{items.length} فحص نجح</div>
          </div>
          <div style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: okCount === items.length ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)", color: okCount === items.length ? "#10b981" : "#ef4444", fontWeight: 800 }}>
            {okCount === items.length ? "سليم" : (items.length - okCount) + " أعطال"}
          </div>
          <span style={{ fontSize: 14, color: t.tx2, transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform .2s" }}>◂</span>
        </button>
        {isExpanded && (
          <div style={{ padding: "4px 16px 14px", borderTop: "1px solid " + t.sep }}>
            {items.map(function(key){
              var item = section[key];
              var valueText = item.value !== undefined ? (typeof item.value === "object" ? JSON.stringify(item.value) : String(item.value)) : "";
              return (
                <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid " + t.sep, fontSize: 12 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{statusIcon(item.ok)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.tx, fontWeight: 600, marginBottom: 2, wordBreak: "break-word" }}>{item.label || key}</div>
                    <div style={{ fontSize: 10, color: item.ok === false ? "#ef4444" : t.tx2, wordBreak: "break-all" }}>
                      {item.error ? "❌ " + item.error : valueText}
                    </div>
                    {item.ms !== undefined && <div style={{ fontSize: 9, color: t.txM, marginTop: 1 }}>⏱ {item.ms}ms</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  var overallColor = !report ? t.tx2 : report.overall === "ok" ? "#10b981" : report.overall === "warning" ? "#f59e0b" : "#ef4444";
  var overallLabel = !report ? "…" : report.overall === "ok" ? "النظام يعمل بسلام" : report.overall === "warning" ? "تحذير: بعض الأعطال" : "خطأ: أعطال متعددة";
  var overallIcon = !report ? "⏳" : report.overall === "ok" ? "🟢" : report.overall === "warning" ? "🟡" : "🔴";

  return (
    <div>
      {/* Summary card */}
      <div style={{ background: t.card, borderRadius: 16, padding: 20, border: "2px solid " + overallColor + "60", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 42 }}>{overallIcon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: overallColor, marginBottom: 3 }}>{overallLabel}</div>
            <div style={{ fontSize: 12, color: t.tx2 }}>
              {report ? report.total_checks + " فحص — " + (report.failed_checks || []).length + " عطل" : "جارِ الفحص..."}
              {report && report.ts && <span style={{ marginRight: 8, color: t.txM }}>• {new Date(report.ts).toLocaleTimeString("ar-SA")}</span>}
            </div>
          </div>
          <button onClick={runCheck} disabled={running} style={{ padding: "10px 18px", borderRadius: 10, background: running ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: running ? "default" : "pointer", fontFamily: "inherit" }}>
            {running ? "⏳ فحص..." : "🔄 إعادة فحص"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 12, color: "#ef4444" }}>
          ❌ {err}
        </div>
      )}

      {/* Server-side sections */}
      {report && Object.keys(report.sections).map(function(sec){ return renderSection(sec); })}

      {/* Client-side feature tests */}
      <div style={{ background: t.card, borderRadius: 12, border: "1px solid " + t.sep, overflow: "hidden", marginTop: 16 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid " + t.sep, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🧪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.tx }}>اختبارات الواجهة (هذا المتصفح)</div>
            <div style={{ fontSize: 11, color: t.tx2, marginTop: 2 }}>{featureTests.length} اختبار — تشغّل محلياً على جهازك</div>
          </div>
          <button onClick={runAllFeatureTests} disabled={!!testingItem} style={{ padding: "8px 14px", borderRadius: 8, background: testingItem ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: testingItem ? "default" : "pointer", fontFamily: "inherit" }}>
            {testingItem ? "جارِ..." : "▶️ تشغيل الكل"}
          </button>
        </div>
        <div style={{ padding: "4px 16px 14px" }}>
          {featureTests.map(function(ft){
            var res = testResults[ft.id];
            var isTesting = testingItem === ft.id;
            return (
              <div key={ft.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid " + t.sep, fontSize: 12 }}>
                <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center" }}>
                  {isTesting ? "⏳" : res ? statusIcon(res.ok) : "◻️"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.tx, fontWeight: 600 }}>{ft.label}</div>
                  {res && <div style={{ fontSize: 10, color: res.ok === false ? "#ef4444" : t.tx2, marginTop: 2, wordBreak: "break-word" }}>{res.msg}</div>}
                </div>
                <button onClick={function(){ runFeatureTest(ft); }} disabled={isTesting} style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid " + t.sep, color: t.tx2, fontSize: 10, fontWeight: 700, cursor: isTesting ? "default" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  {isTesting ? "..." : "اختبار"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw JSON (for debugging) */}
      {report && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ padding: 10, background: t.card, borderRadius: 8, border: "1px solid " + t.sep, cursor: "pointer", fontSize: 11, color: t.tx2, fontWeight: 600 }}>عرض التقرير الكامل (JSON)</summary>
          <pre style={{ background: t.card, borderRadius: 8, padding: 12, marginTop: 6, fontSize: 10, color: t.tx2, overflow: "auto", maxHeight: 400, border: "1px solid " + t.sep, direction: "ltr", textAlign: "left", fontFamily: "monospace" }}>{JSON.stringify(report, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */

function StoragePanel({ t, B }) {
  var [status, setStatus] = useState(null);
  var [loading, setLoading] = useState(true);
  var [migrating, setMigrating] = useState(false);
  var [migrateResult, setMigrateResult] = useState(null);
  var [blobList, setBlobList] = useState(null);
  var [loadingBlob, setLoadingBlob] = useState(false);
  var [deletingBlob, setDeletingBlob] = useState(false);

  useEffect(function() { refresh(); }, []);

  async function refresh() {
    setLoading(true);
    try {
      var r = await fetch("/api/data?action=storage-status");
      var d = await r.json();
      setStatus(d);
    } catch(e) {
      setStatus({ error: e.message });
    }
    setLoading(false);
  }

  async function loadBlobList() {
    setLoadingBlob(true);
    try {
      var r = await fetch("/api/data?action=blob-list");
      var d = await r.json();
      setBlobList(d);
    } catch(e) {
      setBlobList({ ok: false, error: e.message });
    }
    setLoadingBlob(false);
  }

  async function doMigrate() {
    if (!confirm("هل تريد نقل البيانات من Vercel Blob إلى Redis؟\n\nهذه العملية آمنة — البيانات تُنسخ ولا تُحذف.")) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      var r = await fetch("/api/data?action=migrate-to-redis");
      var d = await r.json();
      setMigrateResult(d);
      refresh();
    } catch(e) {
      setMigrateResult({ ok: false, error: e.message });
    }
    setMigrating(false);
  }

  async function deleteBlobBasma() {
    if (!confirm("⚠️ تحذير: سيتم حذف كل بيانات بصمة من Vercel Blob نهائياً!\n\nقبل الحذف:\n✓ تأكد أن Redis يعمل\n✓ تأكد أن النقل تم بنجاح\n\nهل أنت متأكد؟")) return;
    if (!confirm("⚠️ تأكيد ثاني: هذه العملية لا يمكن التراجع عنها!\n\nهل أنت متأكد تماماً؟")) return;
    setDeletingBlob(true);
    try {
      var r = await fetch("/api/data?action=blob-delete-basma-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_BLOB_BASMA" }),
      });
      var d = await r.json();
      if (d.ok) {
        alert("✅ تم حذف " + d.deleted + " ملف من Vercel Blob");
        loadBlobList();
      } else {
        alert("❌ فشل: " + (d.error || "خطأ غير معروف"));
      }
    } catch(e) {
      alert("❌ خطأ: " + e.message);
    }
    setDeletingBlob(false);
  }

  async function deleteBlobAll() {
    if (!confirm("🔥 تحذير شديد: سيتم حذف كل محتوى Vercel Blob!\n\nيشمل:\n• ملفات بصمة الحالية (محفوظة في Redis)\n• ملفات كوادر القديمة\n• أي ملفات أخرى في Blob\n\nهل أنت متأكد؟")) return;
    if (!confirm("⚠️ تأكيد ثاني: هذا يحذف كل شي ولا يمكن التراجع!\n\nالنسخة الحية من بياناتك في Redis — لكن لا يوجد backup في Blob بعد هذا.\n\nمتأكد تماماً؟")) return;
    setDeletingBlob(true);
    try {
      var r = await fetch("/api/data?action=blob-delete-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_ALL_BLOB" }),
      });
      var d = await r.json();
      if (d.ok) {
        alert("✅ تم حذف " + d.deleted + " ملف من Vercel Blob بنجاح");
        loadBlobList();
      } else {
        alert("❌ فشل: " + (d.error || "خطأ غير معروف"));
      }
    } catch(e) {
      alert("❌ خطأ: " + e.message);
    }
    setDeletingBlob(false);
  }

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ تحميل حالة التخزين...</div>;

  var redisOk = status && status.redis && status.redis.enabled && status.redis.test === "ok";
  var r2Ok = status && status.r2 && status.r2.enabled && (status.r2.test || "").startsWith("ok");

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ background: B.blue + "12", border: "1px solid " + B.blue + "40", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        💾 <strong>إدارة التخزين</strong><br/>
        مراقبة حالة قواعد البيانات (Redis + R2) ونقل البيانات من Vercel Blob.
      </div>

      {/* Primary Storage Status */}
      <div style={{ background: t.card, borderRadius: 12, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: B.blue, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>📊 حالة التخزين الحالية</span>
          <button onClick={refresh} style={{ padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid " + t.sep, color: t.tx, fontSize: 11, cursor: "pointer" }}>🔄 تحديث</button>
        </div>

        <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: t.bg, fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: t.tx, marginBottom: 6 }}>التخزين النشط:</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: redisOk ? "#10b981" : "#f59e0b" }}>
            {status && status.primary === "upstash-redis" ? "⚡ Upstash Redis" : "📦 Vercel Blob (الافتراضي)"}
          </div>
          <div style={{ fontSize: 10, color: t.txM, marginTop: 3 }}>System: {status.system}</div>
        </div>

        {/* Redis status */}
        <div style={{ padding: 12, borderRadius: 8, background: redisOk ? "#10b98110" : "#f59e0b10", border: "1px solid " + (redisOk ? "#10b981" : "#f59e0b") + "40", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>⚡ Upstash Redis</div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: redisOk ? "#10b981" : "#f59e0b", color: "#fff" }}>
              {redisOk ? "✓ يعمل" : status.redis && status.redis.enabled ? "⚠ خطأ" : "❌ غير مفعّل"}
            </span>
          </div>
          {status.redis && status.redis.url && <div style={{ fontSize: 10, color: t.txM, fontFamily: "monospace", direction: "ltr" }}>{status.redis.url}</div>}
          {status.redis && status.redis.test && status.redis.test !== "ok" && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>{status.redis.test}</div>}
        </div>

        {/* R2 status */}
        <div style={{ padding: 12, borderRadius: 8, background: r2Ok ? "#10b98110" : "#f59e0b10", border: "1px solid " + (r2Ok ? "#10b981" : "#f59e0b") + "40", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>☁️ Cloudflare R2</div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: r2Ok ? "#10b981" : "#f59e0b", color: "#fff" }}>
              {r2Ok ? "✓ يعمل" : status.r2 && status.r2.enabled ? "⚠ خطأ" : "❌ غير مفعّل"}
            </span>
          </div>
          {status.r2 && status.r2.bucket && <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>Bucket: {status.r2.bucket}</div>}
          {status.r2 && status.r2.publicUrl && <div style={{ fontSize: 10, color: t.txM, fontFamily: "monospace", direction: "ltr" }}>{status.r2.publicUrl}</div>}
          {status.r2 && status.r2.test && !status.r2.test.startsWith("ok") && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>{status.r2.test}</div>}
        </div>

        {/* Blob fallback */}
        <div style={{ padding: 10, borderRadius: 8, background: t.bg, fontSize: 11, color: t.txM }}>
          📦 <strong>Vercel Blob:</strong> نشط كـ backup تلقائي
        </div>
      </div>

      {/* Migration */}
      {redisOk && (
        <div style={{ background: t.card, borderRadius: 12, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: B.blue, marginBottom: 8 }}>🔄 نقل البيانات إلى Redis</div>
          <div style={{ fontSize: 11, color: t.txM, marginBottom: 12, lineHeight: 1.7 }}>
            هذه العملية تنسخ كل البيانات من Vercel Blob إلى Upstash Redis.<br/>
            <strong>آمنة:</strong> البيانات في Blob تبقى كما هي. يمكن تكرار العملية في أي وقت.
          </div>
          <button onClick={doMigrate} disabled={migrating} style={{ padding: "10px 18px", borderRadius: 10, background: migrating ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: migrating ? "default" : "pointer" }}>
            {migrating ? "⏳ جارِ النقل..." : "🚀 نقل البيانات الآن"}
          </button>

          {migrateResult && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: migrateResult.ok ? "#10b98110" : "#ef444410", border: "1px solid " + (migrateResult.ok ? "#10b981" : "#ef4444") + "40" }}>
              {migrateResult.ok ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>✅ تم النقل بنجاح</div>
                  <div style={{ fontSize: 10, color: t.txM, marginBottom: 8 }}>تم نقل {migrateResult.total || 0} جدول</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 10 }}>
                    {Object.keys(migrateResult.migrated || {}).map(function(k) {
                      var v = migrateResult.migrated[k];
                      return <div key={k} style={{ padding: "4px 8px", borderRadius: 4, background: t.bg }}>
                        <span style={{ color: t.tx, fontWeight: 700 }}>{k}:</span> <span style={{ color: v === "empty" ? t.txM : "#10b981" }}>{v === "empty" ? "فارغ" : v}</span>
                      </div>;
                    })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 800, color: "#ef4444" }}>❌ {migrateResult.error || "فشل النقل"}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Blob Management */}
      {redisOk && (
        <div style={{ background: t.card, borderRadius: 12, padding: 16, border: "1px solid " + t.sep, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: B.blue, marginBottom: 8 }}>📦 إدارة Vercel Blob (الـ Backup)</div>
          <div style={{ fontSize: 11, color: t.txM, marginBottom: 12, lineHeight: 1.7 }}>
            عرض محتويات Vercel Blob وحذفها بعد التأكد من نجاح النقل.<br/>
            <strong style={{ color: "#f59e0b" }}>⚠️ تحذير:</strong> لا تحذف إلا بعد التأكد من استقرار Redis لمدة أسبوعين.
          </div>
          <button onClick={loadBlobList} disabled={loadingBlob} style={{ padding: "10px 18px", borderRadius: 10, background: loadingBlob ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 12, fontWeight: 800, cursor: loadingBlob ? "default" : "pointer", marginLeft: 8 }}>
            {loadingBlob ? "⏳..." : "📋 عرض محتوى Blob"}
          </button>

          {blobList && blobList.ok && (
            <div style={{ marginTop: 14 }}>
              {/* Summary */}
              <div style={{ background: t.bg, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: t.tx, marginBottom: 8 }}>📊 ملخص</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 10 }}>
                  <div><span style={{ color: t.txM }}>إجمالي الملفات:</span> <strong style={{ color: t.tx }}>{blobList.totalFiles}</strong></div>
                  <div><span style={{ color: t.txM }}>الحجم:</span> <strong style={{ color: t.tx }}>{blobList.totalSizeMB} MB</strong></div>
                  <div><span style={{ color: t.txM }}>بيانات بصمة:</span> <strong style={{ color: "#10b981" }}>{blobList.summary.basmaDataFiles}</strong></div>
                  <div><span style={{ color: t.txM }}>مرفقات:</span> <strong style={{ color: "#f59e0b" }}>{blobList.summary.basmaAttachments}</strong></div>
                </div>
              </div>

              {/* Basma Data Files (safe to delete) */}
              {blobList.basmaData.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: "pointer", padding: 10, background: "#10b98110", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#10b981" }}>
                    📄 ملفات بيانات بصمة ({blobList.basmaData.length}) — آمنة للحذف ✓
                  </summary>
                  <div style={{ maxHeight: 200, overflowY: "auto", padding: 8 }}>
                    {blobList.basmaData.map(function(f, i) {
                      return <div key={i} style={{ fontSize: 10, padding: "4px 8px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "monospace", color: t.tx }}>{f.name}</span>
                        <span style={{ color: t.txM }}>{f.sizeKB} KB</span>
                      </div>;
                    })}
                  </div>
                </details>
              )}

              {/* Attachments (keep!) */}
              {blobList.basmaFiles.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: "pointer", padding: 10, background: "#f59e0b10", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
                    📎 مرفقات بصمة ({blobList.basmaFiles.length}) — لا تُحذف ⚠️
                  </summary>
                  <div style={{ maxHeight: 200, overflowY: "auto", padding: 8 }}>
                    {blobList.basmaFiles.slice(0, 50).map(function(f, i) {
                      return <div key={i} style={{ fontSize: 10, padding: "4px 8px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "monospace", color: t.tx }}>{f.name}</span>
                        <span style={{ color: t.txM }}>{f.sizeKB} KB</span>
                      </div>;
                    })}
                    {blobList.basmaFiles.length > 50 && <div style={{ textAlign: "center", fontSize: 10, color: t.txM, padding: 6 }}>... و {blobList.basmaFiles.length - 50} ملف آخر</div>}
                  </div>
                </details>
              )}

              {/* Other basma */}
              {blobList.basmaOther.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: "pointer", padding: 10, background: t.bg, borderRadius: 8, fontSize: 12, fontWeight: 700, color: t.tx }}>
                    📁 ملفات بصمة أخرى ({blobList.basmaOther.length})
                  </summary>
                  <div style={{ maxHeight: 200, overflowY: "auto", padding: 8 }}>
                    {blobList.basmaOther.map(function(f, i) {
                      return <div key={i} style={{ fontSize: 10, padding: "4px 8px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "monospace", color: t.tx }}>{f.name}</span>
                        <span style={{ color: t.txM }}>{f.sizeKB} KB</span>
                      </div>;
                    })}
                  </div>
                </details>
              )}

              {/* Other (not basma) */}
              {blobList.other.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: "pointer", padding: 10, background: t.bg, borderRadius: 8, fontSize: 12, fontWeight: 700, color: t.tx }}>
                    🗂️ ملفات أخرى (ليست بصمة) — {blobList.other.length}
                  </summary>
                  <div style={{ maxHeight: 200, overflowY: "auto", padding: 8 }}>
                    {blobList.other.map(function(f, i) {
                      return <div key={i} style={{ fontSize: 10, padding: "4px 8px", borderBottom: "1px solid " + t.sep, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "monospace", color: t.tx }}>{f.name}</span>
                        <span style={{ color: t.txM }}>{f.sizeKB} KB</span>
                      </div>;
                    })}
                  </div>
                </details>
              )}

              {/* Delete button */}
              {blobList.basmaData.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: "#ef444410", border: "1px solid #ef444440", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", marginBottom: 8 }}>⚠️ منطقة الخطر</div>
                  <div style={{ fontSize: 10, color: t.txM, marginBottom: 10, lineHeight: 1.6 }}>
                    <div style={{ marginBottom: 6 }}><strong>الخيار 1:</strong> حذف ملفات بيانات بصمة فقط ({blobList.basmaData.length})</div>
                    <div><strong>الخيار 2:</strong> حذف كل شي ({blobList.totalFiles} ملف — {blobList.totalSizeMB} MB)</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={deleteBlobBasma} disabled={deletingBlob} style={{ padding: "8px 14px", borderRadius: 8, background: deletingBlob ? t.sep : "#f59e0b", color: "#fff", border: "none", fontSize: 11, fontWeight: 800, cursor: deletingBlob ? "default" : "pointer" }}>
                      {deletingBlob ? "⏳..." : "🗑️ حذف بيانات بصمة فقط"}
                    </button>
                    <button onClick={deleteBlobAll} disabled={deletingBlob} style={{ padding: "8px 14px", borderRadius: 8, background: deletingBlob ? t.sep : "#dc2626", color: "#fff", border: "none", fontSize: 11, fontWeight: 800, cursor: deletingBlob ? "default" : "pointer" }}>
                      {deletingBlob ? "⏳..." : "🔥 حذف كل شي ({blobList.totalFiles} ملف)".replace("{blobList.totalFiles}", blobList.totalFiles)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {blobList && !blobList.ok && (
            <div style={{ marginTop: 10, padding: 10, background: "#ef444410", borderRadius: 8, fontSize: 11, color: "#ef4444" }}>
              خطأ: {blobList.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminProfile({ t, B, onLogout }) {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [form, setForm] = useState({ name: "", email: "", currentPassword: "", newPassword: "", newPassword2: "" });
  var [msg, setMsg] = useState("");
  var [busy, setBusy] = useState(false);

  useEffect(function() {
    fetch("/api/data?action=admin-config").then(r => r.json()).then(function(d) {
      if (d && d.exists) {
        setProfile(d);
        setForm(function(prev) { return Object.assign({}, prev, { name: d.name || "", email: d.email || "" }); });
      }
      setLoading(false);
    }).catch(function(){ setLoading(false); });
  }, []);

  async function save() {
    setMsg("");
    if (!form.currentPassword) { setMsg("⚠️ كلمة المرور الحالية مطلوبة للتأكيد"); return; }
    if (form.newPassword && form.newPassword !== form.newPassword2) { setMsg("⚠️ كلمتا المرور الجديدتان غير متطابقتين"); return; }
    if (form.newPassword && form.newPassword.length < 6) { setMsg("⚠️ كلمة المرور 6 أحرف على الأقل"); return; }
    setBusy(true);
    try {
      var body = {
        email: form.email.toLowerCase().trim(),
        name: form.name,
        currentPassword: form.currentPassword,
        password: form.newPassword || form.currentPassword,
      };
      var r = await fetch("/api/data?action=admin-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      var d = await r.json();
      if (d.ok) {
        setMsg("✓ تم الحفظ بنجاح");
        setForm(function(p){ return Object.assign({}, p, { currentPassword: "", newPassword: "", newPassword2: "" }); });
        if (form.newPassword) setTimeout(function(){ onLogout(); }, 1500);
      } else {
        setMsg("✗ " + (d.error || "فشل الحفظ"));
      }
    } catch(e) { setMsg("✗ " + e.message); }
    setBusy(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: t.tx2 }}>جارِ التحميل...</div>;

  var inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, fontSize: 13, fontFamily: Fn, outline: "none", background: t.inp, color: t.tx, marginBottom: 12 };
  var lbl = { fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: B.blue + "12", border: "1px solid " + B.blue + "40", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 11, color: t.tx, lineHeight: 1.7 }}>
        🔐 <strong>حساب المدير العام</strong> — هذا الحساب مستقل عن كوادر ويُستخدم للوصول للوحة الإدارة. غيّر كلمة المرور بشكل دوري.
      </div>

      <div style={{ background: t.card, borderRadius: 12, padding: 18, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.tx, marginBottom: 14 }}>📝 تعديل البيانات</div>

        <label style={lbl}>الاسم الكامل</label>
        <input value={form.name} onChange={e => setForm(Object.assign({}, form, { name: e.target.value }))} style={inp} />

        <label style={lbl}>البريد الإلكتروني</label>
        <input type="email" value={form.email} onChange={e => setForm(Object.assign({}, form, { email: e.target.value }))} style={inp} />

        <div style={{ height: 1, background: t.sep, margin: "8px 0 16px" }} />

        <label style={lbl}>كلمة المرور الحالية (مطلوبة لأي تعديل) *</label>
        <input type="password" value={form.currentPassword} onChange={e => setForm(Object.assign({}, form, { currentPassword: e.target.value }))} placeholder="••••••••" style={inp} />

        <div style={{ fontSize: 11, color: t.txM, marginBottom: 10 }}>⚙️ اتركهما فارغين لعدم تغيير كلمة المرور:</div>

        <label style={lbl}>كلمة المرور الجديدة (اختياري)</label>
        <input type="password" value={form.newPassword} onChange={e => setForm(Object.assign({}, form, { newPassword: e.target.value }))} placeholder="6 أحرف على الأقل" style={inp} />

        <label style={lbl}>تأكيد كلمة المرور الجديدة</label>
        <input type="password" value={form.newPassword2} onChange={e => setForm(Object.assign({}, form, { newPassword2: e.target.value }))} style={inp} />

        {msg && <div style={{ color: msg.startsWith("✓") ? "#10b981" : "#FF3B30", fontSize: 12, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>{msg}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, padding: "11px", borderRadius: 10, background: busy ? t.sep : B.blue, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: busy ? "default" : "pointer" }}>{busy ? "جارِ الحفظ..." : "💾 حفظ التغييرات"}</button>
          <button onClick={onLogout} style={{ padding: "11px 18px", borderRadius: 10, background: t.badLt, color: t.bad, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>🚪 خروج</button>
        </div>
      </div>
    </div>
  );
}

const td = { padding: "10px 12px", borderBottom: "1px solid #E5E5EA", fontSize: 12 };
const actBtn = { padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: B.blue, color: "#fff" };
const sinp = { width: 70, padding: "5px 8px", borderRadius: 6, border: "1px solid #E5E5EA", fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", fontFamily: "'IBM Plex Sans Arabic',-apple-system,sans-serif" };

/* ═══════════════════════════════════════════════════════
   LAIHA PANEL — المدير العام يدير لائحة العمل
   ═══════════════════════════════════════════════════════ */
/* ═══ SYNC STATUS — آخر مزامنة مع كوادر ═══ */
function SyncStatus({ t, B }) {
  var [lastSync, setLastSync] = useState(function(){ return localStorage.getItem("basma_last_sync") || ""; });
  var [syncing, setSyncing] = useState(false);

  useEffect(function() {
    var i = setInterval(function() {
      setLastSync(localStorage.getItem("basma_last_sync") || "");
    }, 30000);
    return function() { clearInterval(i); };
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      var r = await fetch("/api/data?action=sync-kadwar");
      var d = await r.json();
      if (d.ok) {
        var now = new Date().toISOString();
        localStorage.setItem("basma_last_sync", now);
        setLastSync(now);
        setTimeout(function(){ window.location.reload(); }, 800);
      }
    } catch(e) {}
    setSyncing(false);
  }

  var text = "لم تتم مزامنة";
  var ago = "";
  if (lastSync) {
    var d = new Date(lastSync);
    var now = new Date();
    var diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) ago = "الآن";
    else if (diffMin < 60) ago = "منذ " + diffMin + " د";
    else if (diffMin < 1440) ago = "منذ " + Math.floor(diffMin/60) + " س";
    else ago = "منذ " + Math.floor(diffMin/1440) + " ي";
    text = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }

  return (
    <div style={{ padding: "8px 12px", margin: "8px 12px", borderRadius: 8, background: B.blue + "10", border: "1px solid " + B.blue + "30" }}>
      <div style={{ fontSize: 9, color: t.txM, marginBottom: 2 }}>🔗 مزامنة كوادر</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.blue }}>{text}</div>
          {ago && <div style={{ fontSize: 8, color: t.txM }}>{ago}</div>}
        </div>
        <button onClick={sync} disabled={syncing} title="مزامنة الآن" style={{ padding: "4px 8px", borderRadius: 6, background: syncing ? t.sep : B.blue, color: "#fff", fontSize: 10, border: "none", cursor: syncing ? "default" : "pointer" }}>{syncing ? "⏳" : "🔄"}</button>
      </div>
    </div>
  );
}

/* ═══ ADMIN ACCOUNT PANEL — إعدادات المدير العام ═══ */
function AdminAccountPanel({ t, B }) {
  var [config, setConfig] = useState(null);
  var [loading, setLoading] = useState(true);
  var [form, setForm] = useState({ name: "", email: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  var [msg, setMsg] = useState("");
  var [busy, setBusy] = useState(false);

  useEffect(function() {
    fetch("/api/data?action=admin-config").then(r => r.json()).then(function(d) {
      if (d && d.exists) {
        setConfig(d);
        setForm(function(f){ return {...f, name: d.name || "", email: d.email || ""}; });
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    setMsg("");
    if (!form.email || !form.name) { setMsg("⚠️ الاسم والبريد مطلوبان"); return; }
    if (!form.currentPassword) { setMsg("⚠️ أدخل كلمة المرور الحالية للتأكيد"); return; }
    if (form.newPassword && form.newPassword !== form.confirmPassword) { setMsg("⚠️ كلمتا المرور غير متطابقتين"); return; }
    if (form.newPassword && form.newPassword.length < 6) { setMsg("⚠️ كلمة المرور الجديدة 6 أحرف على الأقل"); return; }

    setBusy(true);
    try {
      var body = {
        email: form.email.toLowerCase().trim(),
        name: form.name.trim(),
        currentPassword: form.currentPassword,
        password: form.newPassword || form.currentPassword,
      };
      var r = await fetch("/api/data?action=admin-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      var d = await r.json();
      if (d.ok) {
        setMsg("✅ تم الحفظ بنجاح");
        setForm(function(f){ return {...f, currentPassword: "", newPassword: "", confirmPassword: ""}; });
        if (form.newPassword) {
          setTimeout(function(){ alert("تم تغيير كلمة المرور — سيتم تسجيل خروجك"); localStorage.removeItem("basma_admin_email"); localStorage.removeItem("basma_last_mode"); window.location.reload(); }, 1000);
        }
      } else {
        setMsg("❌ " + (d.error || "فشل الحفظ"));
      }
    } catch(e) { setMsg("❌ " + e.message); }
    setBusy(false);
  }

  var inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + t.sep, background: t.inp, color: t.tx, fontSize: 13, marginBottom: 10 };
  var labelStyle = { fontSize: 11, color: t.tx2, marginBottom: 4, display: "block", fontWeight: 600 };

  if (loading) return <div style={{ padding: 30, textAlign: "center", color: t.txM }}>جارِ التحميل...</div>;

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ background: B.blue + "12", border: "1px solid " + B.blue + "40", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 12, color: t.tx, lineHeight: 1.7 }}>
        👤 <strong>حساب المدير العام</strong><br/>
        تعديل بيانات حساب الدخول للوحة الإدارة. كلمة المرور الحالية مطلوبة لأي تغيير.
      </div>

      <div style={{ background: t.card, borderRadius: 12, padding: 18, border: "1px solid " + t.sep }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: B.blue }}>البيانات الشخصية</div>
        <label style={labelStyle}>الاسم الكامل</label>
        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} />
        <label style={labelStyle}>البريد الإلكتروني</label>
        <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" style={inputStyle} />

        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 12, color: B.blue }}>كلمة المرور</div>
        <label style={labelStyle}>كلمة المرور الحالية <span style={{color: B.red}}>*</span></label>
        <input value={form.currentPassword} onChange={e => setForm({...form, currentPassword: e.target.value})} type="password" placeholder="مطلوبة للتأكيد" style={inputStyle} />
        <label style={labelStyle}>كلمة المرور الجديدة (اختياري)</label>
        <input value={form.newPassword} onChange={e => setForm({...form, newPassword: e.target.value})} type="password" placeholder="اتركها فارغة إذا لا تريد تغييرها" style={inputStyle} />
        {form.newPassword && (
          <>
            <label style={labelStyle}>تأكيد كلمة المرور الجديدة</label>
            <input value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} type="password" style={inputStyle} />
          </>
        )}

        {msg && <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, padding: 8, borderRadius: 6, background: msg.startsWith("✅") ? "#10b98120" : "#ef444420", color: msg.startsWith("✅") ? "#10b981" : B.red }}>{msg}</div>}

        <button onClick={save} disabled={busy} style={{ width: "100%", padding: 12, borderRadius: 10, background: busy ? t.sep : B.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
          {busy ? "جارِ الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}

/* ═══ HIERARCHY CARD — كارت الهيكل التنظيمي ═══ */
function HierarchyCard({ emp, emps, t, B }) {
  if (!emp) return null;
  var manager = emps.find(function(e){ return e.kadwarId === emp.managerKadwarId || e.idNumber === emp.managerKadwarId; });
  var supervisor = emps.find(function(e){ return e.kadwarId === emp.supervisorKadwarId || e.idNumber === emp.supervisorKadwarId; });
  var subs = emps.filter(function(e){
    return e.managerKadwarId && (e.managerKadwarId === emp.kadwarId || e.managerKadwarId === emp.idNumber);
  });

  return (
    <div style={{ background: t.card, borderRadius: 12, padding: 16, border: "1px solid " + t.sep, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: B.blue, marginBottom: 12 }}>🏢 الهيكل التنظيمي</div>

      {manager && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: t.txM, marginBottom: 3 }}>المدير المباشر</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: B.blueLt, borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: B.blue + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{manager.name}</div>
              <div style={{ fontSize: 9, color: t.txM }}>{manager.role}</div>
            </div>
          </div>
        </div>
      )}

      {supervisor && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: t.txM, marginBottom: 3 }}>المشرف</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: "#10b98118", borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#10b98130", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎯</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{supervisor.name}</div>
              <div style={{ fontSize: 9, color: t.txM }}>{supervisor.role}</div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 9, color: t.txM, marginBottom: 3 }}>المرؤوسون ({subs.length})</div>
        {subs.length === 0 && <div style={{ fontSize: 10, color: t.txM, fontStyle: "italic", padding: 6 }}>لا يوجد مرؤوسون</div>}
        {subs.map(function(s) {
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, background: t.bg, borderRadius: 6, marginBottom: 3 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.sep, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>👷</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.tx }}>{s.name}</div>
                <div style={{ fontSize: 9, color: t.txM }}>{s.role}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!manager && !supervisor && subs.length === 0 && (
        <div style={{ fontSize: 11, color: t.txM, textAlign: "center", padding: 12, fontStyle: "italic" }}>
          لم يتم ربط الهيكل التنظيمي لهذا الموظف في كوادر
        </div>
      )}
    </div>
  );
}

/* ═══ KADWAR SYNC BUTTON — زر مزامنة يدوية ═══ */
/* ═══ ADMIN ACCOUNT PANEL — إدارة حساب المدير العام ═══ */

function KadwarSyncButton({ t, B }) {
  var [syncing, setSyncing] = useState(false);
  var [lastSync, setLastSync] = useState(function(){ return localStorage.getItem("basma_last_sync") || ""; });
  var [msg, setMsg] = useState("");

  async function doSync() {
    setSyncing(true);
    setMsg("");
    try {
      var r = await fetch("/api/data?action=sync-kadwar");
      var d = await r.json();
      if (d.ok) {
        var now = new Date().toISOString();
        localStorage.setItem("basma_last_sync", now);
        setLastSync(now);
        setMsg("✓ " + d.count + " موظف (+" + d.added + " جديد، " + d.updated + " محدث)");
        setTimeout(function(){ window.location.reload(); }, 1500);
      } else {
        setMsg("✗ " + (d.error || "فشل المزامنة"));
      }
    } catch(e) {
      setMsg("✗ " + e.message);
    }
    setSyncing(false);
  }

  var lastSyncText = "";
  if (lastSync) {
    var d = new Date(lastSync);
    var h = String(d.getHours()).padStart(2, "0");
    var m = String(d.getMinutes()).padStart(2, "0");
    lastSyncText = h + ":" + m;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {lastSyncText && <span style={{ fontSize: 10, color: t.txM }}>آخر مزامنة: {lastSyncText}</span>}
      {msg && <span style={{ fontSize: 10, color: msg.startsWith("✓") ? "#10b981" : B.red, fontWeight: 700 }}>{msg}</span>}
      <button onClick={doSync} disabled={syncing} style={{ padding: "6px 14px", borderRadius: 8, background: syncing ? t.sep : B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: syncing ? "default" : "pointer" }}>
        {syncing ? "⏳ جارِ..." : "🔄 مزامنة الآن"}
      </button>
    </div>
  );
}

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
              {/* v6.51 — Investigation Record PDF */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + t.sep, display: "flex", justifyContent: "flex-end" }} onClick={function(e){ e.stopPropagation(); }}>
                <button onClick={function(){
                  var emp = (inv.empId ? { id: inv.empId, name: inv.empName, role: inv.empRole, department: inv.empDepartment } : { name: inv.empName });
                  exportInvestigationRecord(inv, emp);
                }} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid " + B.gold, background: B.gold + "15", color: B.gold, fontSize: 9, fontWeight: 800, cursor: "pointer" }}>
                  📄 محضر تحقيق PDF
                </button>
              </div>
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
            var html="<!DOCTYPE html><html dir=rtl><head><meta charset=utf-8><title>سجل المخالفات</title><style>body{font-family:Segoe UI,sans-serif;margin:30px}h1{font-size:18px;text-align:center;color:#2B5EA7}table{width:100%;border-collapse:collapse}th{background:#2B5EA7;color:#fff;padding:8px;font-size:10px;text-align:right}td{padding:6px;border-bottom:1px solid #eee;font-size:10px}.f{margin-top:20px;text-align:center;font-size:9px;color:#999}.hma-hdr{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #c9a84c}.hma-hdr img{width:80px;height:auto}.hma-hdr .ofc{font-size:12px;color:#1a3a6e;font-weight:900;margin-top:6px}@media print{body{margin:10px}}</style></head><body><div class=hma-hdr><img src=/hma-logo.png alt=HMA /><div class=ofc>مكتب هاني محمد عسيري للاستشارات الهندسية</div></div><h1>سجل المخالفات الرسمية — HMA Engineering</h1><p style=text-align:center;font-size:11px>تاريخ التصدير: "+new Date().toLocaleString("ar-SA")+"</p><table><thead><tr><th>#</th><th>الموظف</th><th>البند</th><th>الوصف</th><th>المرة</th><th>الجزاء</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>"+rows+"</tbody></table><div class=f>لائحة تنظيم العمل رقم 978004</div><script>setTimeout(function(){window.print()},500)<\/script></body></html>";
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
              {/* v6.51 — Formal warning PDF */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + t.sep, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={function(){
                  var emp = emps.find(function(x){ return x.id === v.empId; }) || { id: v.empId, name: v.empName };
                  exportFormalWarning(v, emp);
                }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid " + B.gold, background: B.gold + "15", color: B.gold, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                  📋 إنذار رسمي PDF
                </button>
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
    tawasul: false,
    attendance: true,
    violations_v2: true,
    warnings: false,
    complaints: true,
    investigations: true,
    appeals: true,
    notifications: true,
    leaves: false,
    permissions: false,
    gps_log: true,
    tickets: false,
    faces: false,
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
    tawasul: "🤝 مهام التواصل",
    attendance: "📍 سجل الحضور",
    violations_v2: "⚖️ المخالفات الرسمية",
    warnings: "⚠️ الإنذارات",
    complaints: "📣 الشكاوى",
    investigations: "🔍 التحقيقات",
    appeals: "📢 التظلمات",
    notifications: "🔔 الإشعارات",
    leaves: "📋 الإجازات",
    permissions: "🤚 الأذونات",
    gps_log: "🛰️ سجل GPS",
    tickets: "🎫 تذاكر الدعم",
    faces: "📸 بصمات الوجه",
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
