import React, { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   بصمة HMA v4.50 — Mobile App
   Built from scratch — Approved Design
   ═══════════════════════════════════════════ */

const VER = "4.50";

/* ── Colors ── */
const C = {
  hdr1: "#1a3a6e", hdr2: "#2b5ea7", hdr3: "#3a7bd5",
  green: "#2d9f6f", greenDark: "#27ae60",
  orange: "#e67e22", orangeDark: "#d35400",
  red: "#e74c3c", redDark: "#c0392b",
  blue: "#2b5ea7", blueBright: "#3a7bd5",
  bg: "#f0f2f7", card: "#fff", text: "#1a1a1a", sub: "#888",
  gold: "#ffd700",
};

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
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "م" : "ص";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { time: String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"), ampm };
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

/* ── Membership Badge ── */
function memberBadge(points) {
  if (points >= 1000) return { icon: "🥇", label: "تميّز", color: C.gold };
  if (points >= 500) return { icon: "🥈", label: "فضي", color: "#c0c0c0" };
  return { icon: "🔹", label: "أساسي", color: "#80b4f0" };
}

/* ── GPS Distance ── */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [branch, setBranch] = useState(null);
  const [todayAtt, setTodayAtt] = useState([]);
  const [allAtt, setAllAtt] = useState([]);
  const [now, setNow] = useState(new Date());
  const [gps, setGps] = useState(null); // { lat, lng }
  const [gpsDist, setGpsDist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const clockRef = useRef(null);

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem("basma_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        loadData(u);
      } catch { /**/ }
    }
  }, []);

  // Clock tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS watch
  useEffect(() => {
    if (!user || !navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, [user]);

  // Calculate distance when GPS or branch changes
  useEffect(() => {
    if (gps && branch) {
      const d = haversine(gps.lat, gps.lng, branch.lat, branch.lng);
      setGpsDist(Math.round(d));
    }
  }, [gps, branch]);

  async function loadData(emp) {
    try {
      const branches = await api("branches");
      const b = branches.find(x => x.id === emp.branch);
      if (b) setBranch(b);

      const today = todayStr();
      const recs = await api("attendance", { params: { empId: emp.id } });
      setAllAtt(recs);
      setTodayAtt(recs.filter(r => r.date === today));

      // Calculate streak
      let s = 0;
      const d = new Date();
      for (let i = 1; i <= 60; i++) {
        d.setDate(d.getDate() - 1);
        const ds = d.toISOString().split("T")[0];
        if (recs.some(r => r.date === ds && r.type === "checkin")) s++;
        else break;
      }
      setStreak(s);
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
        return null;
      }
      return r.error || "خطأ غير متوقع";
    } catch (e) { return e.message; }
    finally { setLoading(false); }
  }

  async function doCheckin(type) {
    if (!user) return;
    setLoading(true);
    try {
      const body = { empId: user.id, type, lat: gps?.lat, lng: gps?.lng };
      const r = await api("checkin", { method: "POST", body });
      if (r.ok) {
        setTodayAtt(prev => [...prev, r.record]);
        // Refresh employee points
        const emps = await api("employees");
        const me = emps.find(e => e.id === user.id);
        if (me) { setUser(me); localStorage.setItem("basma_user", JSON.stringify(me)); }
      }
    } catch { /**/ }
    finally { setLoading(false); }
  }

  function logout() {
    setUser(null);
    setBranch(null);
    setTodayAtt([]);
    setAllAtt([]);
    localStorage.removeItem("basma_user");
  }

  // Determine day state
  function getDayState() {
    if (!branch) return "before";
    const mins = now.getHours() * 60 + now.getMinutes();
    const start = timeToMin(branch.start);
    const end = timeToMin(branch.end);
    if (mins < start) return "before";
    if (mins >= end) return "after";
    return "during";
  }

  // Check what checkpoints are done today
  function getCheckpoints() {
    const hasType = t => todayAtt.some(r => r.type === t);
    return {
      checkin: hasType("checkin"),
      breakStart: hasType("break_start"),
      breakEnd: hasType("break_end"),
      checkout: hasType("checkout"),
    };
  }

  if (!user) return <LoginScreen onLogin={handleLogin} loading={loading} />;

  return (
    <div style={S.phone}>
      {page === "home" && (
        <HomePage
          user={user} branch={branch} now={now} todayAtt={todayAtt} allAtt={allAtt}
          gps={gps} gpsDist={gpsDist} streak={streak} loading={loading}
          dayState={getDayState()} checkpoints={getCheckpoints()}
          onCheckin={doCheckin}
        />
      )}
      {page === "report" && (
        <ReportPage user={user} allAtt={allAtt} branch={branch} onBack={() => setPage("home")} />
      )}
      {page === "profile" && (
        <ProfilePage user={user} branch={branch} onLogout={logout} onBack={() => setPage("home")} />
      )}
      <BottomNav page={page} setPage={setPage} />
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   LOGIN SCREEN
   ══════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin, loading }) {
  const [empId, setEmpId] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!empId || !code) { setErr("أدخل رقم الموظف والرمز"); return; }
    const e = await onLogin(empId.toUpperCase(), code);
    if (e) setErr(e);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, " + C.hdr1 + " 0%, " + C.hdr2 + " 50%, " + C.hdr3 + " 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Logo */}
      <div style={{ width: 90, height: 90, borderRadius: 28, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, border: "2px solid rgba(255,255,255,.2)", backdropFilter: "blur(8px)" }}>
        <span style={{ fontSize: 42 }}>🕐</span>
      </div>
      <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, fontFamily: "'Cairo',sans-serif", marginBottom: 4 }}>بصمة HMA</div>
      <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, fontWeight: 500, marginBottom: 32 }}>نظام الحضور والانصراف الذكي</div>

      {/* Form */}
      <div style={{ width: "100%", maxWidth: 340, background: "rgba(255,255,255,.1)", borderRadius: 24, padding: 24, border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(12px)" }}>
        <input
          value={empId} onChange={e => setEmpId(e.target.value)} placeholder="رقم الموظف (مثال: E001)"
          style={S.loginInput}
        />
        <input
          value={code} onChange={e => setCode(e.target.value)} placeholder="رمز الدخول" type="password"
          style={{ ...S.loginInput, marginTop: 10 }}
          onKeyDown={e => e.key === "Enter" && submit()}
        />
        {err && <div style={{ color: "#FF6B6B", fontSize: 12, fontWeight: 700, marginTop: 10, textAlign: "center" }}>{err}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 16, background: loading ? "rgba(255,255,255,.2)" : "#fff", color: loading ? "rgba(255,255,255,.5)" : C.hdr1, fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", border: "none", cursor: "pointer" }}>
          {loading ? "جارِ الدخول..." : "تسجيل دخول"}
        </button>
      </div>

      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 24 }}>v{VER} · basma-hma.vercel.app</div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   HOME PAGE
   ══════════════════════════════════════════════════════════════ */
function HomePage({ user, branch, now, todayAtt, allAtt, gps, gpsDist, streak, loading, dayState, checkpoints, onCheckin }) {
  const { time, ampm } = formatTime(now);
  const badge = memberBadge(user.points || 0);
  const inRange = branch && gpsDist !== null && gpsDist <= (branch.radius || 150);

  // Progress ring calculation
  const SIZE = 200, STROKE = 10, R = (SIZE - STROKE) / 2, CIRC = 2 * Math.PI * R;
  let pct = dayState === "before" ? 10 : dayState === "after" ? 100 : 67;
  if (branch) {
    const mins = now.getHours() * 60 + now.getMinutes();
    const start = timeToMin(branch.start), end = timeToMin(branch.end);
    if (dayState === "during") pct = Math.min(100, Math.round(((mins - start) / (end - start)) * 100));
  }
  const ringOff = CIRC - (pct / 100) * CIRC;
  const ringCol = dayState === "during" ? "#5ec47a" : dayState === "after" ? C.gold : "#80b4f0";

  // Button state
  let btnText = "☀️ سجّل حضورك", btnAction = "checkin";
  if (dayState === "during") {
    if (!checkpoints.checkin) { btnText = "☀️ سجّل حضورك"; btnAction = "checkin"; }
    else if (!checkpoints.breakStart) { btnText = "☕ بداية الاستراحة"; btnAction = "break_start"; }
    else if (!checkpoints.breakEnd) { btnText = "🔄 عودة من الاستراحة"; btnAction = "break_end"; }
    else if (!checkpoints.checkout) { btnText = "🌙 تسجيل انصراف"; btnAction = "checkout"; }
    else { btnText = "✓ اكتمل الدوام"; btnAction = null; }
  } else if (dayState === "after") {
    if (!checkpoints.checkout && checkpoints.checkin) { btnText = "🌙 تسجيل انصراف"; btnAction = "checkout"; }
    else { btnText = "✓ اكتمل الدوام"; btnAction = null; }
  }

  // Monthly stats
  const thisMonth = todayStr().slice(0, 7);
  const monthAtt = allAtt.filter(r => r.date?.startsWith(thisMonth));
  const presentDays = new Set(monthAtt.filter(r => r.type === "checkin").map(r => r.date)).size;
  const lateDays = monthAtt.filter(r => r.type === "checkin" && branch && (() => {
    const t = new Date(r.ts);
    return t.getHours() * 60 + t.getMinutes() > timeToMin(branch.start) + 5;
  })()).length;
  const attendPct = presentDays > 0 ? Math.round((presentDays / Math.max(1, new Date().getDate())) * 100) : 0;

  // Checkpoint times
  function cpTime(type) {
    const r = todayAtt.find(a => a.type === type);
    return r ? formatTimeStr(r.ts) : "--:--";
  }

  return (
    <div style={{ flex: 1, paddingBottom: 80 }}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.headerCurve} />
        <div style={S.headerTop}>
          <div>
            <div style={S.welcome}>أهلاً، {user.name?.split(" ")[0]} 👋</div>
            <div style={S.date}>{formatArabicDate(now)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{badge.icon} {badge.label}</span>
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 800 }}>⭐{user.points || 0}</span>
          </div>
        </div>

        {/* ── Clock Ring ── */}
        <div style={S.clockWrap}>
          <div style={{ position: "relative", width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={STROKE} />
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={ringCol} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOff} style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={S.clockInner}>
              <div style={S.clockTime}>{time}</div>
              <div style={S.clockAmpm}>{ampm}</div>
              {btnAction ? (
                <button onClick={() => !loading && onCheckin(btnAction)} disabled={loading} style={S.clockBtn}>
                  {loading ? "⏳" : btnText}
                </button>
              ) : (
                <div style={{ ...S.clockBtn, opacity: .6 }}>{btnText}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={S.content}>

        {/* ── Stat Cards ── */}
        <div style={S.statsRow}>
          <div style={{ ...S.statCard, background: "linear-gradient(135deg, " + C.green + ", " + C.greenDark + ")" }}>
            <div style={S.statIcon}>✓</div>
            <div>
              <div style={S.statNum}>{attendPct}%</div>
              <div style={S.statLabel}>نسبة الحضور</div>
            </div>
          </div>
          <div style={{ ...S.statCard, background: "linear-gradient(135deg, " + C.orange + ", " + C.orangeDark + ")" }}>
            <div style={S.statIcon}>⏰</div>
            <div>
              <div style={S.statNum}>{lateDays}</div>
              <div style={S.statLabel}>أيام تأخر</div>
            </div>
          </div>
        </div>

        {/* ── GPS Status ── */}
        <div style={S.gpsRow}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: inRange ? C.green : C.red }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: inRange ? C.green : C.red }}>
            {gps ? (inRange ? "📍 في نطاق العمل" : "📍 خارج النطاق") + (branch ? " — " + branch.name + " (" + (gpsDist || "...") + " م)" : "") : "📍 جارِ تحديد الموقع..."}
          </span>
          {streak > 0 && <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 800, color: C.orange }}>🔥 {streak} يوم</span>}
        </div>

        {/* ── Challenge Card (before only) ── */}
        {dayState === "before" && (
          <div style={S.challengeCard}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>⚡ سؤال التحدي — 25 نقطة</div>
            <div style={{ fontSize: 10, opacity: .8, marginTop: 3 }}>اضغط للإجابة وكسب النقاط</div>
          </div>
        )}

        {/* ── Summary Card ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span>ملخص اليوم</span>
            <span style={{ fontSize: 12, color: C.blue }}>›</span>
          </div>
          <div style={S.summaryGrid}>
            <SummaryItem num={checkpoints.checkin ? 1 : 0} label="حاضر" cls="ok" />
            <SummaryItem num={lateDays > 0 && todayStr() === todayStr() ? 0 : 0} label="متأخر" cls="warn" />
            <SummaryItem num={0} label="غائب" cls="bad" />
            <SummaryItem num={0} label="إجازة" cls="info" />
          </div>
        </div>

        {/* ── Checkpoints Card ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>نقاط البصمة</div>
          <div style={S.cpRow}>
            <Checkpoint icon="☀️" label="حضور" time={cpTime("checkin")} done={checkpoints.checkin} />
            <Checkpoint icon="☕" label="استراحة" time={cpTime("break_start")} done={checkpoints.breakStart} />
            <Checkpoint icon="🔄" label="عودة" time={cpTime("break_end")} done={checkpoints.breakEnd} />
            <Checkpoint icon="🌙" label="انصراف" time={cpTime("checkout")} done={checkpoints.checkout} />
          </div>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   REPORT PAGE
   ══════════════════════════════════════════════════════════════ */
function ReportPage({ user, allAtt, branch, onBack }) {
  const thisMonth = todayStr().slice(0, 7);
  const monthAtt = allAtt.filter(r => r.date?.startsWith(thisMonth));
  const checkins = monthAtt.filter(r => r.type === "checkin");
  const presentDays = new Set(checkins.map(r => r.date)).size;
  const lateDays = checkins.filter(r => branch && (() => {
    const t = new Date(r.ts);
    return t.getHours() * 60 + t.getMinutes() > timeToMin(branch.start) + 5;
  })()).length;
  const absentDays = Math.max(0, new Date().getDate() - presentDays - 2); // rough estimate minus weekends
  const attendPct = presentDays > 0 ? Math.round((presentDays / Math.max(1, new Date().getDate())) * 100) : 0;

  // Recent timeline
  const recent = [...monthAtt].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 6);
  const typeMap = { checkin: { label: "حاضر", color: C.green, icon: "👷" }, break_start: { label: "استراحة", color: C.orange, icon: "☕" }, break_end: { label: "عودة", color: C.blue, icon: "🔄" }, checkout: { label: "انصراف", color: C.hdr1, icon: "🌙" } };

  const monthName = AR_MONTHS[new Date().getMonth()];

  return (
    <div style={{ flex: 1, paddingBottom: 80 }}>
      {/* Header */}
      <div style={S.detailHeader}>
        <button onClick={onBack} style={S.backBtn}>→ رجوع</button>
        <div style={S.detailTitle}>تقريري</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* Period */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ background: "#fff", padding: "8px 18px", borderRadius: 12, fontSize: 12, fontWeight: 700, color: C.blue, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            1 {monthName} — 30 {monthName} ▾
          </div>
        </div>

        {/* Report Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <ReportStat num={presentDays} unit="يوم" label="حاضر" bg={"linear-gradient(135deg," + C.green + "," + C.greenDark + ")"} />
          <ReportStat num={lateDays} unit="يوم" label="متأخر" bg={"linear-gradient(135deg," + C.orange + "," + C.orangeDark + ")"} />
          <ReportStat num={absentDays > 0 ? absentDays : 0} unit="يوم" label="غائب" bg={"linear-gradient(135deg," + C.red + "," + C.redDark + ")"} />
        </div>

        {/* Monthly Stats */}
        <div style={S.card}>
          <div style={S.cardTitle}>إحصائيات الشهر</div>
          <div style={{ display: "flex", gap: 1, background: C.bg, borderRadius: 16, overflow: "hidden" }}>
            <MonthStat num={attendPct + "%"} label="نسبة الحضور" color={C.green} />
            <MonthStat num="0" label="ساعات إضافية" color={C.blue} />
            <MonthStat num="0" label="أيام إجازة" color={C.orange} />
          </div>
        </div>

        {/* Timeline */}
        <div style={S.card}>
          <div style={S.cardTitle}>آخر البصمات</div>
          {recent.length === 0 && <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: 20 }}>لا توجد بصمات بعد</div>}
          {recent.map((r, i) => {
            const info = typeMap[r.type] || { label: r.type, color: C.sub, icon: "📌" };
            return (
              <div key={r.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < recent.length - 1 ? "1px solid " + C.bg : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: info.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{info.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 10, color: info.color, marginTop: 1 }}>{info.label}</div>
                </div>
                <div style={{ marginRight: "auto", fontSize: 12, fontWeight: 700, color: "#555" }}>{formatTimeStr(r.ts)}</div>
              </div>
            );
          })}
        </div>

        {/* Export */}
        <button style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg," + C.blue + "," + C.blueBright + ")", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: 12 }}>
          📊 تصدير التقرير
        </button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   PROFILE PAGE
   ══════════════════════════════════════════════════════════════ */
function ProfilePage({ user, branch, onLogout, onBack }) {
  const typeMap = { office: "🏢 مكتبي", field: "🏗️ ميداني", mixed: "🔀 مختلط", remote: "🏠 عن بعد" };
  const rows = [
    ["الفرع", branch?.name || "—"],
    ["المسمى", user.role || "—"],
    ["الرقم", user.id],
    ["التصنيف", typeMap[user.type] || user.type || "—"],
    ["الالتحاق", user.joinDate || "—"],
  ];

  return (
    <div style={{ flex: 1, paddingBottom: 80 }}>
      <div style={S.detailHeader}>
        <button onClick={onBack} style={S.backBtn}>→ رجوع</button>
        <div style={S.detailTitle}>حسابي</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* Avatar */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg," + C.blue + "," + C.blueBright + ")", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, border: "3px solid #fff", boxShadow: "0 4px 15px rgba(43,94,167,.3)" }}>👤</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Cairo',sans-serif" }}>{user.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{user.role} — {user.id}</div>
        </div>

        {/* Data */}
        <div style={S.card}>
          {rows.map(([label, val], i) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: i < rows.length - 1 ? "1px solid " + C.bg : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{val}</span>
              <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div style={S.card}>
          <div style={S.cardTitle}>الإعدادات</div>
          <ToggleRow label="📞 تذكير بالحضور" border />
          <ToggleRow label="📞 تذكير بالانصراف" />
        </div>

        {/* Logout */}
        <button onClick={onLogout} style={{ width: "100%", padding: 14, borderRadius: 16, border: "2px solid " + C.red, background: "transparent", color: C.red, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          🚪 تسجيل خروج
        </button>

        <div style={{ textAlign: "center", color: "rgba(0,0,0,.2)", fontSize: 10, marginTop: 16, marginBottom: 12 }}>v{VER}</div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function SummaryItem({ num, label, cls }) {
  const colors = { ok: C.green, warn: C.orange, bad: C.red, info: C.blue };
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
      <div style={{
        width: 40, height: 40, borderRadius: 14, margin: "0 auto 4px",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        background: done ? "#e6f4ed" : "#f5f5f5",
        border: done ? "2.5px solid " + C.green : "2px solid #ddd",
      }}>
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
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif", color }}>{num}</div>
      <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ToggleRow({ label, border }) {
  const [on, setOn] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: border ? "1px solid " + C.bg : "none" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div onClick={() => setOn(!on)} style={{ width: 44, height: 24, borderRadius: 12, background: on ? C.green : "#ddd", position: "relative", cursor: "pointer", transition: "background .3s" }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, transition: "right .3s, left .3s", ...(on ? { left: 3 } : { right: 3 }), boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );
}

function BottomNav({ page, setPage }) {
  const items = [
    { id: "home", icon: "🏠", label: "الرئيسية" },
    { id: "report", icon: "📊", label: "تقريري" },
    { id: "profile", icon: "👤", label: "حسابي" },
  ];
  return (
    <div style={S.nav}>
      {items.map(n => {
        const active = page === n.id;
        return (
          <button key={n.id} onClick={() => setPage(n.id)} style={{ ...S.navItem, position: "relative" }}>
            {active && <div style={S.navBar} />}
            <span style={{ fontSize: 20, opacity: active ? 1 : .35 }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: active ? C.blue : "#aaa" }}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════════ */
const S = {
  phone: { width: "100%", maxWidth: 430, minHeight: "100vh", margin: "0 auto", background: C.bg, position: "relative", display: "flex", flexDirection: "column" },

  // Header
  header: { background: "linear-gradient(180deg, " + C.hdr1 + " 0%, " + C.hdr2 + " 50%, " + C.hdr3 + " 100%)", padding: "20px 20px 60px", position: "relative", overflow: "hidden" },
  headerCurve: { position: "absolute", bottom: -30, left: "-10%", width: "120%", height: 80, background: C.bg, borderRadius: "50% 50% 0 0" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  welcome: { color: "#fff", fontSize: 20, fontWeight: 800, fontFamily: "'Cairo',sans-serif" },
  date: { color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 500, marginTop: 2 },

  // Clock
  clockWrap: { display: "flex", justifyContent: "center", marginTop: 16, position: "relative", zIndex: 1 },
  clockInner: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  clockTime: { fontSize: 38, fontWeight: 900, color: "#fff", fontFamily: "'Cairo',sans-serif", letterSpacing: 1 },
  clockAmpm: { fontSize: 14, color: "rgba(255,255,255,.8)", fontWeight: 600, marginTop: -4 },
  clockBtn: { marginTop: 8, padding: "6px 20px", borderRadius: 20, background: "rgba(255,255,255,.2)", color: "#fff", fontSize: 11, fontWeight: 700, backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,.3)", cursor: "pointer", fontFamily: "'Tajawal',sans-serif" },

  // Content
  content: { padding: "0 16px", marginTop: -20, position: "relative", zIndex: 2 },

  // Stats
  statsRow: { display: "flex", gap: 10, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10, color: "#fff" },
  statIcon: { width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  statNum: { fontSize: 22, fontWeight: 900, fontFamily: "'Cairo',sans-serif" },
  statLabel: { fontSize: 9, fontWeight: 600, opacity: .85 },

  // GPS
  gpsRow: { display: "flex", alignItems: "center", gap: 6, padding: "4px 4px 10px" },

  // Challenge
  challengeCard: { background: "linear-gradient(135deg, " + C.green + ", " + C.greenDark + ")", borderRadius: 16, padding: 14, marginBottom: 12, textAlign: "center", color: "#fff", cursor: "pointer" },

  // Card
  card: { background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.06)" },
  cardTitle: { fontSize: 15, fontWeight: 800, fontFamily: "'Cairo',sans-serif", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },

  // Summary
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" },

  // Checkpoints
  cpRow: { display: "flex", gap: 8, marginTop: 12 },

  // Detail pages
  detailHeader: { background: "linear-gradient(180deg, " + C.hdr1 + ", " + C.hdr2 + ")", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 },
  backBtn: { background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", padding: "6px 14px", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Tajawal',sans-serif" },
  detailTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif" },

  // Nav
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", background: "#fff", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-around", padding: "8px 0 16px", zIndex: 100 },
  navItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", padding: "4px 12px", cursor: "pointer", fontFamily: "'Tajawal',sans-serif" },
  navBar: { position: "absolute", top: -1, width: 24, height: 3, borderRadius: 2, background: C.blue },

  // Login
  loginInput: { width: "100%", padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'Tajawal',sans-serif", outline: "none", textAlign: "center", direction: "ltr" },
};
