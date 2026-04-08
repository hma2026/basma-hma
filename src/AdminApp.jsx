import { useState } from "react";

const APP = "بصمة HMA";
const CO = "هاني محمد عسيري للإستشارات الهندسية";
const B = { blue: "#2B5EA7", yellow: "#FDD800", red: "#E2192C", black: "#1A1A1A", blueDk: "#1E4478", blueLt: "#EDF3FB", gold: "#D4A017" };

// Theme palettes
const LT = { bg: "#F2F2F7", card: "#fff", tx: "#000000", tx2: "#6E6E73", txM: "#8E8E93", sep: "#E5E5EA", ac: "#0A84FF", ok: "#30D158", okLt: "rgba(48,209,88,0.1)", warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.1)", bad: "#FF3B30", badLt: "rgba(255,59,48,0.08)", cardBrd: "rgba(0,0,0,0.05)", cardSh: "0 1px 3px rgba(0,0,0,0.08)", nav: "#F2F2F7", navBrd: "rgba(0,0,0,0.1)", inp: "#FFFFFF", inpBrd: "#E5E5EA" };
const DK = { bg: "#000000", card: "#1C1C1E", tx: "#FFFFFF", tx2: "#98989D", txM: "#636366", sep: "#2C2C2E", ac: "#0A84FF", ok: "#30D158", okLt: "rgba(48,209,88,0.15)", warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.15)", bad: "#FF453A", badLt: "rgba(255,69,58,0.12)", cardBrd: "rgba(255,255,255,0.1)", cardSh: "none", nav: "#1C1C1E", navBrd: "rgba(255,255,255,0.1)", inp: "#2C2C2E", inpBrd: "rgba(255,255,255,0.1)" };
const Fn = "'IBM Plex Sans Arabic',-apple-system,'Segoe UI',sans-serif";

// ═══════ DATA ═══════
const BRANCHES = [
  { id: "jed", name: "جدة", count: 12, present: 10, pct: 88, radius: 150, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh" },
  { id: "riy", name: "الرياض", count: 8, present: 7, pct: 85, radius: 150, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Asia/Riyadh" },
  { id: "ist", name: "اسطنبول", count: 5, present: 4, pct: 82, radius: 200, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Europe/Istanbul" },
  { id: "gaz", name: "غازي عنتاب", count: 3, present: 3, pct: 95, radius: 120, start: "08:30", end: "17:00", breakStart: "12:30", breakEnd: "13:00", offDay: "الجمعة", tz: "Europe/Istanbul" },
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

// ═══════ LOGIN ═══════
function Login({ onLogin }) {
  var dk = localStorage.getItem("basma_theme") === "dark";
  var t = dk ? DK : LT;
  const [role, setRole] = useState("manager");
  return (<div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: t.card, borderRadius: 24, padding: "48px 40px", width: 380, textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,.08)" }}>
      <Logo s={60} /><div style={{ fontSize: 24, fontWeight: 800, color: B.blue, marginTop: 12 }}>{APP}</div><div style={{ fontSize: 13, color: t.txM, marginTop: 4 }}>لوحة إدارة الموارد البشرية</div><Stripe />
      <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: `1px solid ${t.sep}`, margin: "24px 0 20px" }}>
        {[{ id: "manager", l: "مدير" }, { id: "assistant", l: "مساعد" }].map(r => <button key={r.id} onClick={() => setRole(r.id)} style={{ flex: 1, padding: "12px", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: role === r.id ? B.blue : "#F8F9FC", color: role === r.id ? "#fff" : t.txM }}>{r.l}</button>)}
      </div>
      <button onClick={() => onLogin(role)} style={{ width: "100%", padding: "14px", borderRadius: 14, background: B.blue, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>دخول</button>
    </div>
  </div>);
}

// ═══════ MAIN DASHBOARD ═══════
export default function AdminApp() {
  const [dk, setDk] = useState(() => localStorage.getItem("basma_theme") === "dark");
  const t = dk ? DK : LT;
  const toggleTheme = () => { setDk(v => { const n = !v; localStorage.setItem("basma_theme", n ? "dark" : "light"); return n; }); };
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState("manager");
  const [tab, setTab] = useState("dashboard");
  const [leaves, setLeaves] = useState(LEAVE_INIT);
  const [search, setSearch] = useState("");
  const [brFilter, setBrFilter] = useState("all");
  const [selEmp, setSelEmp] = useState(null);
  const [events, setEvents] = useState(EVENTS);
  const [branches, setBranches] = useState(BRANCHES);
  const [settingsTab, setSettingsTab] = useState("general");
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

  if (!loggedIn) return <Login onLogin={r => { setRole(r); setLoggedIn(true); }} />;

  const approve = id => role === "manager" && setLeaves(l => l.map(x => x.id === id ? { ...x, status: "معتمد" } : x));
  const reject = id => role === "manager" && setLeaves(l => l.map(x => x.id === id ? { ...x, status: "مرفوض" } : x));
  const pending = leaves.filter(l => l.status === "معلّق").length;
  const present = EMPS.filter(e => e.status === "حاضر").length;
  const absent = EMPS.filter(e => e.status === "غائب").length;
  const late = EMPS.filter(e => e.status === "متأخر").length;

  const filteredEmps = EMPS.filter(e => {
    if (brFilter !== "all" && e.branch !== brFilter) return false;
    if (search && !e.name.includes(search) && !e.id.includes(search.toUpperCase())) return false;
    return true;
  });

  const sideItems = [
    { id: "dashboard", icon: "📊", label: "الرئيسية" },
    { id: "employees", icon: "👥", label: "الموظفين" },
    { id: "leaves", icon: "📋", label: "الإجازات", badge: pending },
    { id: "violations", icon: "⚠️", label: "المخالفات" },
    { id: "geofence", icon: "📍", label: "النطاق الجغرافي" },
    { id: "reports", icon: "📄", label: "التقارير" },
    { id: "events", icon: "🎉", label: "المناسبات" },
    { id: "settings", icon: "⚙️", label: "الإعدادات" },
  ];

  return (<div style={{ direction: "rtl", fontFamily: Fn, display: "flex", minHeight: "100vh", background: t.bg }}>
    <style>{`button:active{transform:scale(.97)!important} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}`}</style>

    {/* Sidebar */}
    <div style={{ width: 220, background: t.card, borderLeft: `1px solid ${t.sep}`, display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", marginBottom: 6 }}><Logo s={30} /><div><div style={{ fontSize: 14, fontWeight: 800, color: B.blue }}>{APP}</div><div style={{ fontSize: 8, color: t.txM }}>لوحة الإدارة</div></div></div>
      <Stripe />
      <div style={{ flex: 1, padding: "10px 8px" }}>
        {sideItems.map(item => { const a = tab === item.id; return (<button key={item.id} onClick={() => { setTab(item.id); setSelEmp(null); }} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", marginBottom: 2, background: a ? B.blueLt : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, filter: a ? "none" : "grayscale(.5) opacity(.6)" }}>{item.icon}</span>
          <span style={{ fontSize: 12, fontWeight: a ? 700 : 500, color: a ? B.blue : t.tx2, flex: 1, textAlign: "right" }}>{item.label}</span>
          {item.badge > 0 && <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.bad, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</div>}
        </button>); })}
      </div>
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${t.sep}` }}>
        <button onClick={toggleTheme} style={{ width: "100%", padding: "8px", borderRadius: 8, background: dk ? "#2C2C2E" : "#E5E5EA", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>{dk ? "☀️" : "🌙"}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.tx2 }}>{dk ? "الوضع النهاري" : "الوضع الليلي"}</span>
        </button>
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.sep}` }}>
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
          {[{ l: "حاضر", v: present, i: "✅", c: t.ok, s: `من ${EMPS.length}` }, { l: "غائب", v: absent, i: "🚫", c: t.bad }, { l: "متأخر", v: late, i: "⏰", c: t.warn }, { l: "طلبات معلّقة", v: pending, i: "📋", c: B.blue }].map((s, i) => <div key={i} style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 11, color: t.txM }}>{s.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.c, marginTop: 4 }}>{s.v}</div>{s.s && <div style={{ fontSize: 10, color: t.txM }}>{s.s}</div>}</div><div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.c}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.i}</div></div></div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>⚡ يحتاج إجراء</div>{ALERTS.map((a, i) => <div key={i} style={{ padding: "8px 10px", borderRadius: 10, marginBottom: 6, background: a.type === "danger" ? t.badLt : a.type === "warn" ? t.warnLt : t.okLt, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>{a.type === "danger" ? "🚨" : a.type === "warn" ? "⚠️" : "🏆"}</span><span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{a.text}</span><span style={{ fontSize: 9, color: t.txM }}>{a.time}</span></div>)}</div>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 أداء الفروع</div>{BRANCHES.map((b, i) => { const pc = b.pct >= 90 ? t.ok : b.pct >= 75 ? t.warn : t.bad; return <div key={i} style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{b.name}</span><span style={{ fontWeight: 800, color: pc }}>{b.pct}%</span></div><div style={{ height: 6, borderRadius: 3, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", width: `${b.pct}%`, borderRadius: 3, background: pc }} /></div></div>; })}<div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📈 الأسبوع</div><div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>{WEEKLY.map((d, i) => { const pc = d.p >= 90 ? t.ok : d.p >= 80 ? B.blue : t.warn; return <div key={i} style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 9, fontWeight: 700, color: pc }}>{d.p}%</div><div style={{ height: d.p * .7, borderRadius: 4, background: pc, minHeight: 6 }} /><div style={{ fontSize: 8, color: t.txM, marginTop: 3 }}>{d.d}</div></div>; })}</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, color: t.ok, marginBottom: 10 }}>🏆 الأكثر انضباطاً</div>{EMPS.sort((a, b) => b.pct - a.pct).slice(0, 3).map((e, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 2 ? `1px solid ${t.sep}` : "none" }}><span style={{ fontSize: 16 }}>{["🥇", "🥈", "🥉"][i]}</span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div></div><span style={{ fontSize: 13, fontWeight: 800, color: t.ok }}>{e.pct}%</span></div>)}</div>
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, color: t.bad, marginBottom: 10 }}>⚠️ يحتاج متابعة</div>{EMPS.sort((a, b) => a.pct - b.pct).slice(0, 3).map((e, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 2 ? `1px solid ${t.sep}` : "none" }}><div style={{ width: 24, height: 24, borderRadius: "50%", background: t.badLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: t.bad }}>{i + 1}</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div></div><span style={{ fontSize: 13, fontWeight: 800, color: t.bad }}>{e.pct}%</span></div>)}</div>
        </div>
      </>}

      {/* ═══ EMPLOYEES ═══ */}
      {tab === "employees" && !selEmp && <>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.sep}`, fontSize: 13, outline: "none", background: t.card }} />
          <select value={brFilter} onChange={e => setBrFilter(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.sep}`, fontSize: 12, background: t.card, fontWeight: 600, cursor: "pointer" }}><option value="all">كل الفروع</option>{BRANCHES.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
        </div>
        <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.sep}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: "#F8FAFC" }}>{["الموظف", "الفرع", "الحالة", "الالتزام", "السلسلة", "المستوى", "المخالفات", "البصمات"].map((h, i) => <th key={i} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: t.txM, textAlign: "right", borderBottom: `1px solid ${t.sep}` }}>{h}</th>)}</tr></thead>
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
          <div style={{ background: t.card, borderRadius: 14, padding: "20px", border: `1px solid ${t.sep}`, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${(selEmp.status === "حاضر" ? t.ok : selEmp.status === "متأخر" ? t.warn : t.bad)}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 10px", border: `3px solid ${selEmp.status === "حاضر" ? t.ok : selEmp.status === "متأخر" ? t.warn : t.bad}` }}>👤</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{selEmp.name}</div><div style={{ fontSize: 11, color: t.txM }}>{selEmp.role} — {selEmp.id}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 14 }}>{[{ l: "التزام", v: `${selEmp.pct}%`, c: selEmp.pct >= 85 ? t.ok : t.warn }, { l: "السلسلة", v: `🔥${selEmp.streak}`, c: "#FF6B35" }, { l: "النقاط", v: selEmp.pts, c: B.gold }].map((x, i) => <div key={i} style={{ background: t.bg, borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 14, fontWeight: 800, color: x.c }}>{x.v}</div><div style={{ fontSize: 8, color: t.txM, marginTop: 2 }}>{x.l}</div></div>)}</div>
            <div style={{ marginTop: 10, fontSize: 11, color: selEmp.gps ? t.ok : t.bad, fontWeight: 600 }}>{selEmp.gps ? "📍 في النطاق" : "📍 خارج النطاق"}</div>
          </div>
          <div><div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}`, marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>بصمات اليوم</div><div style={{ display: "flex", gap: 10 }}>{["☀️ حضور", "☕ استراحة", "🔄 عودة", "🌙 انصراف"].map((l, i) => <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 10, background: selEmp.checks[i] ? t.okLt : t.badLt }}><div style={{ fontSize: 18 }}>{selEmp.checks[i] ? "✅" : "❌"}</div><div style={{ fontSize: 9, color: t.tx2, marginTop: 3 }}>{l}</div></div>)}</div></div>
            <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>إجراءات</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={actBtn}>📊 تقرير</button><button style={{ ...actBtn, background: t.warnLt, color: t.warn }}>⚠️ إنذار</button>{role === "manager" && <button style={{ ...actBtn, background: t.badLt, color: t.bad }}>🗑 حذف</button>}<button style={{ ...actBtn, background: t.okLt, color: t.ok }}>📤 تصدير لكوادر</button></div><div style={{ marginTop: 10, padding: "10px", borderRadius: 8, background: B.blueLt, fontSize: 11, fontWeight: 600, color: B.blue }}>النسبة المُصدّرة لكوادر: <strong>{selEmp.pct}%</strong></div></div></div>
        </div>
      </>}

      {/* ═══ LEAVES ═══ */}
      {tab === "leaves" && <>
        {leaves.map(l => { const sc = l.status === "معلّق" ? t.warn : l.status === "معتمد" ? t.ok : t.bad; return <div key={l.id} style={{ background: t.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${t.sep}`, marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${sc}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{l.status === "معلّق" ? "⏳" : l.status === "معتمد" ? "✅" : "❌"}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{l.emp}</div><div style={{ fontSize: 11, color: t.tx2, marginTop: 2 }}>{l.type} · {l.days} أيام · {l.from} → {l.to}</div>{l.reason && <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>{l.reason}</div>}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${sc}15`, color: sc }}>{l.status}</span>
            {l.status === "معلّق" && role === "manager" && <div style={{ display: "flex", gap: 4 }}><button onClick={() => approve(l.id)} style={{ padding: "5px 10px", borderRadius: 6, background: t.ok, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>اعتماد</button><button onClick={() => reject(l.id)} style={{ padding: "5px 10px", borderRadius: 6, background: t.bad, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>رفض</button></div>}
            {l.status === "معلّق" && role === "assistant" && <span style={{ fontSize: 9, color: t.txM }}>بانتظار المدير</span>}
          </div>
        </div>; })}
      </>}

      {/* ═══ VIOLATIONS ═══ */}
      {tab === "violations" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>{[{ l: "مخالفات", v: 12, c: t.warn }, { l: "إنذارات", v: 7, c: "#F97316" }, { l: "خصومات الشهر", v: "2,420", c: t.bad }, { l: "بدون مخالفات", v: 4, c: t.ok }].map((s, i) => <div key={i} style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 10, color: t.txM }}>{s.l}</div><div style={{ fontSize: 24, fontWeight: 800, color: s.c, marginTop: 4 }}>{s.v}</div></div>)}</div>
        <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.sep}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: "#F8FAFC" }}>{["الموظف", "المخالفات", "الإنذارات", "الخصومات", "الالتزام"].map((h, i) => <th key={i} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: t.txM, textAlign: "right", borderBottom: `1px solid ${t.sep}` }}>{h}</th>)}</tr></thead>
          <tbody>{EMPS.filter(e => e.violations > 0).map(e => <tr key={e.id}><td style={td}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 9, color: t.txM }}>{e.id}</div></td><td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: t.bad }}>{e.violations}</span></td><td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: t.warn }}>{e.warnings}</span></td><td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: t.bad }}>-{e.deductions.toLocaleString()}</span></td><td style={td}><span style={{ fontSize: 13, fontWeight: 800, color: e.pct >= 70 ? t.warn : t.bad }}>{e.pct}%</span></td></tr>)}</tbody></table>
        </div>
      </>}

      {/* ═══ GEOFENCE ═══ */}
      {tab === "geofence" && <>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>{branches.map(b => { const ins = EMPS.filter(e => e.branch === b.name && e.gps).length; const out = EMPS.filter(e => e.branch === b.name && !e.gps).length; return <div key={b.id} style={{ flex: 1, background: t.card, borderRadius: 14, padding: "14px", border: `1px solid ${t.sep}`, textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</div><div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 6 }}><span style={{ fontSize: 11, color: t.ok }}>✓{ins}</span>{out > 0 && <span style={{ fontSize: 11, color: t.bad }}>✕{out}</span>}</div><div style={{ fontSize: 10, color: B.blue, marginTop: 4 }}>📍 {b.radius}م</div><input type="range" min="50" max="900" step="10" value={b.radius} onChange={e => setBranches(bs => bs.map(x => x.id === b.id ? { ...x, radius: parseInt(e.target.value) } : x))} style={{ width: "100%", marginTop: 6, accentColor: B.blue }} /><div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: t.txM }}><span>50م</span><span>900م</span></div></div>; })}</div>
        {EMPS.filter(e => !e.gps).length > 0 && <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, color: t.bad, marginBottom: 10 }}>🚨 خارج النطاق</div>{EMPS.filter(e => !e.gps).map((e, i) => <div key={i} style={{ padding: "8px 10px", borderRadius: 10, background: t.badLt, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><span>🚨</span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 10, color: t.bad }}>{e.branch} · {e.status}</div></div>{role === "manager" && <button style={{ padding: "4px 10px", borderRadius: 6, background: B.blue, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>إجراء</button>}</div>)}</div>}
      </>}

      {/* ═══ REPORTS ═══ */}
      {tab === "reports" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>{[
          { t: "تقرير الحضور الشهري", d: "نسب حضور جميع الموظفين", i: "📊", c: B.blue },
          { t: "تصدير لكوادر", d: "تصدير النسب لنظام كوادر", i: "📤", c: t.ok },
          { t: "مسير الرواتب (بنك)", d: "ملف جاهز للرفع على البنك", i: "🏦", c: B.blueDk },
          { t: "بيانات التأمين", d: "موظفين + مرافقين + إفصاح صحي", i: "🏥", c: "#7C3AED" },
          { t: "تقرير الغياب", d: "تفاصيل الغياب والتأخير", i: "🚨", c: t.bad },
          { t: "تقرير شامل", d: "جميع البيانات في ملف واحد", i: "📋", c: B.blueDk },
        ].map((r, i) => <div key={i} style={{ background: t.card, borderRadius: 14, padding: "20px", border: `1px solid ${t.sep}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.06)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${r.c}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>{r.i}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{r.t}</div><div style={{ fontSize: 11, color: t.txM, marginTop: 4 }}>{r.d}</div>
          <button style={{ marginTop: 10, padding: "7px 14px", borderRadius: 8, background: r.c, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>تحميل</button>
        </div>)}</div>
      </>}

      {/* ═══ EVENTS ═══ */}
      {tab === "events" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 700 }}>إدارة المناسبات</span><button style={{ padding: "8px 16px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>+ مناسبة جديدة</button></div>
        {events.map(ev => <div key={ev.id} style={{ background: t.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${t.sep}`, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0B0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{ev.emoji}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{ev.name}</div><div style={{ fontSize: 10, color: t.txM }}>{ev.date}</div>{ev.upgrade && <span style={{ padding: "2px 6px", borderRadius: 4, background: "#EDE9FE", fontSize: 9, fontWeight: 700, color: "#7C3AED" }}>💎 ترقية نخبة</span>}</div>
          <Toggle on={ev.active} onClick={() => setEvents(es => es.map(x => x.id === ev.id ? { ...x, active: !x.active } : x))} />
        </div>)}
        <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}`, marginTop: 12 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🎂 أعياد الميلاد التلقائية</div>{[{ l: "عيد ميلاد الموظف", v: "ترقية نخبة يومين + 🎂", on: true }, { l: "عيد ميلاد الأبناء", v: "ترقية يوم + 🎈", on: true }, { l: "ذكرى الالتحاق", v: "ترقية يوم + 🎉", on: true }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? `1px solid ${t.sep}` : "none" }}><div><div style={{ fontSize: 12, fontWeight: 600 }}>{x.l}</div><div style={{ fontSize: 10, color: t.txM }}>{x.v}</div></div><Toggle on={x.on} onClick={() => {}} /></div>)}</div>
      </>}

      {/* ═══ SETTINGS ═══ */}
      {tab === "settings" && <>
        {/* Sub-tabs for settings */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>{[{ id: "general", l: "⚙️ عام" }, { id: "email", l: "📧 توجيه الإيميل" }, { id: "observation", l: "👁 تحت الملاحظة" }].map(t => <button key={t.id} onClick={() => setSettingsTab(t.id)} style={{ padding: "8px 18px", borderRadius: 10, border: settingsTab === t.id ? "none" : `1px solid ${t.sep}`, background: settingsTab === t.id ? B.blue : "#fff", color: settingsTab === t.id ? "#fff" : t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{t.l}</button>)}</div>

        {/* GENERAL */}
        {settingsTab === "general" && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Branch Schedules */}
          <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: `1px solid ${t.sep}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>🕐 أوقات الدوام لكل فرع</div><div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>كل فرع له إعدادات مستقلة — الفروع تتزامن مع كوادر</div></div>
              {role === "manager" && <button style={{ padding: "7px 14px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ فرع جديد</button>}
            </div>
            {branches.map((br, bi) => (
              <div key={br.id} style={{ padding: "14px", borderRadius: 12, background: bi % 2 === 0 ? "#F8FAFC" : "#fff", border: `1px solid ${t.sep}`, marginBottom: 8 }}>
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
                        <select value={f.v} onChange={e => setBranches(bs => bs.map(x => x.id === br.id ? { ...x, [f.k]: e.target.value } : x))} style={{ ...sinp, width: "100%" }} disabled={role !== "manager"}>
                          {["الجمعة", "السبت", "الأحد", "الجمعة+السبت", "السبت+الأحد"].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input value={f.v} onChange={e => setBranches(bs => bs.map(x => x.id === br.id ? { ...x, [f.k]: e.target.value } : x))} style={{ ...sinp, width: "100%" }} disabled={role !== "manager"} />
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
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🎁 النقاط</div>{[{ l: "بصمة بوقتها", v: "10" }, { l: "تحدي الصباح", v: "25" }, { l: "بونص مبكر", v: "10" }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < 2 ? `1px solid ${t.sep}` : "none" }}><span style={{ fontSize: 12, color: t.tx2 }}>{x.l}</span><input defaultValue={x.v} style={{ ...sinp, width: 50 }} disabled={role !== "manager"} /></div>)}</div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🔗 كوادر</div><div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px", borderRadius: 8, background: t.okLt }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: t.ok }} /><span style={{ fontSize: 11, fontWeight: 600, color: t.ok }}>متصل — مزامنة يومية 04:00</span></div>{role === "manager" && <button style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", width: "100%" }}>مزامنة الآن</button>}</div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🏅 العضوية</div>{[{ l: "عضوية فعّال 🔵", v: "0 نقطة" }, { l: "عضوية تميّز 🥇", v: "500 نقطة" }, { l: "عضوية نخبة 💎", v: "1200 نقطة" }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 2 ? `1px solid ${t.sep}` : "none" }}><span style={{ fontSize: 12, color: t.tx2 }}>{x.l}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{x.v}</span></div>)}{role === "manager" && <button style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, background: t.warnLt, color: t.warn, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", width: "100%" }}>⏸ تجميد عضوية موظف</button>}</div>
            <div style={{ background: t.card, borderRadius: 14, padding: "18px", border: `1px solid ${t.sep}` }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⏱ البريك العشوائي</div><div style={{ fontSize: 11, color: t.txM, marginBottom: 10 }}>البصمة تجي عشوائياً قبل/بعد الاستراحة</div>{[{ l: "أقل مدة عشوائية", v: "2 دقيقة" }, { l: "أكثر مدة عشوائية", v: "7 دقائق" }].map((x, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 1 ? `1px solid ${t.sep}` : "none" }}><span style={{ fontSize: 12, color: t.tx2 }}>{x.l}</span><span style={{ fontSize: 11, fontWeight: 700 }}>{x.v}</span></div>)}<div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: t.warnLt, fontSize: 10, color: "#92400E" }}>⚠️ أثناء الاستراحة ممنوع أي تواصل — وقت الموظف</div></div>
          </div>
        </div>}

        {/* EMAIL ROUTING */}
        {settingsTab === "email" && <>
          {/* Distribution Lists */}
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: `1px solid ${t.sep}`, marginBottom: 14 }}>
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
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: `1px solid ${t.sep}`, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.tx, marginBottom: 4 }}>📄 توجيه المستندات → البريد (الإعداد العام)</div>
            <div style={{ fontSize: 11, color: t.txM, marginBottom: 14 }}>حدد أي جهة تستلم نسخة من كل نوع مستند</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {docRouting.map((dr, di) => (
                <div key={di} style={{ padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: `1px solid ${t.sep}` }}>
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
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: `1px solid ${t.sep}` }}>
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
            {role === "manager" && <button style={{ width: "100%", padding: "10px", borderRadius: 10, background: "#F8FAFC", border: `2px dashed ${t.sep}`, color: t.tx2, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>+ إضافة تخصيص لموظف</button>}
          </div>
        </>}

        {/* UNDER OBSERVATION (Layer 3) */}
        {settingsTab === "observation" && <>
          <div style={{ background: t.card, borderRadius: 16, padding: "20px", border: `1px solid ${t.sep}`, marginBottom: 14 }}>
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
          <div style={{ background: t.card, borderRadius: 14, padding: "16px", border: `1px solid ${t.sep}`, marginBottom: 14 }}>
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
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: t.badLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `2px solid ${t.bad}` }}>👁</div>
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

          {role === "manager" && <button style={{ width: "100%", padding: "12px", borderRadius: 12, background: t.badLt, border: `2px dashed ${t.bad}`, color: t.bad, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>👁 وضع موظف تحت الملاحظة</button>}
        </>}
      </>}
    </div>
  </div>);
}

const td = { padding: "10px 12px", borderBottom: `1px solid ${t.sep}`, fontSize: 12 };
const actBtn = { padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: B.blue, color: "#fff" };
const sinp = { width: 70, padding: "5px 8px", borderRadius: 6, border: `1px solid ${t.sep}`, fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", fontFamily: "'Segoe UI',Tahoma,sans-serif" };
