import React, { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   بصمة HMA v4.51 — Mobile App
   Built from scratch — Approved Design
   + Face Verify + Challenge + Toasts
   ═══════════════════════════════════════════ */

const VER = "4.51";

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

/* ── Inject Global CSS ── */
if (typeof document !== "undefined" && !document.getElementById("basma-css")) {
  const style = document.createElement("style");
  style.id = "basma-css";
  style.textContent = [
    "@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}",
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

function memberBadge(points) {
  if (points >= 1000) return { icon: "🥇", label: "تميّز", color: C.gold };
  if (points >= 500) return { icon: "🥈", label: "فضي", color: "#c0c0c0" };
  return { icon: "🔹", label: "أساسي", color: "#80b4f0" };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Challenge Questions ── */
const CHALLENGES = [
  { q: "ما هي أقصى مدة للخرسانة قبل الصب؟", opts: ["30 دقيقة","60 دقيقة","90 دقيقة","120 دقيقة"], correct: 2 },
  { q: "ما هو الحد الأدنى لغطاء الخرسانة للأعمدة؟", opts: ["25 مم","40 مم","50 مم","75 مم"], correct: 1 },
  { q: "ما هو معامل الأمان المعتمد للأساسات؟", opts: ["1.5","2.0","2.5","3.0"], correct: 3 },
  { q: "كم يوم يلزم لمعالجة الخرسانة بالماء؟", opts: ["3 أيام","5 أيام","7 أيام","14 يوم"], correct: 2 },
  { q: "ما هي نسبة الماء إلى الأسمنت المثالية؟", opts: ["0.30","0.40","0.45","0.55"], correct: 2 },
  { q: "أي نوع تربة يحتاج أكبر عمق حفر؟", opts: ["صخرية","رملية","طينية","مختلطة"], correct: 2 },
  { q: "ما الحد الأقصى لانحراف العمود الرأسي؟", opts: ["L/200","L/300","L/500","L/1000"], correct: 2 },
  { q: "متى يتم فك شدات الأسقف؟", opts: ["7 أيام","14 يوم","21 يوم","28 يوم"], correct: 2 },
];


/* ═══════════ MAIN COMPONENT ═══════════ */
export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [branch, setBranch] = useState(null);
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
  const [initDone, setInitDone] = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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
    if (type === "checkin" || type === "checkout") { setFaceModal({ type }); }
    else { doCheckin(type); }
  }

  async function doCheckin(type, facePhoto) {
    setFaceModal(null);
    if (!user) return;
    setLoading(true);
    try {
      const body = { empId: user.id, type, lat: gps?.lat, lng: gps?.lng, facePhoto };
      const r = await api("checkin", { method: "POST", body });
      if (r.ok) {
        setTodayAtt(prev => [...prev, r.record]);
        const labels = { checkin: "تم تسجيل الحضور ✓", break_start: "بداية الاستراحة ☕", break_end: "تم تسجيل العودة 🔄", checkout: "تم تسجيل الانصراف 🌙" };
        showToast(labels[type] || "تم التسجيل ✓");
        const emps = await api("employees");
        const me = emps.find(e => e.id === user.id);
        if (me) { setUser(me); localStorage.setItem("basma_user", JSON.stringify(me)); }
      } else { showToast("حدث خطأ في التسجيل", "error"); }
    } catch { showToast("خطأ في الاتصال", "error"); }
    finally { setLoading(false); }
  }

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

      {page === "home" && <HomePage user={user} branch={branch} now={now} todayAtt={todayAtt} allAtt={allAtt} gps={gps} gpsDist={gpsDist} streak={streak} loading={loading} dayState={getDayState()} checkpoints={getCheckpoints()} onCheckin={requestCheckin} onChallenge={() => setChallengeOpen(true)} />}
      {page === "report" && <ReportPage user={user} allAtt={allAtt} branch={branch} />}
      {page === "profile" && <ProfilePage user={user} branch={branch} onLogout={logout} />}

      <BottomNav page={page} setPage={setPage} />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {confirmModal && <ConfirmModal label={confirmModal.label} onConfirm={confirmCheckin} onCancel={() => setConfirmModal(null)} />}
      {faceModal && <FaceModal onVerified={(photo) => doCheckin(faceModal.type, photo)} onSkip={() => doCheckin(faceModal.type)} onCancel={() => setFaceModal(null)} />}
      {challengeOpen && <ChallengeModal user={user} onClose={() => setChallengeOpen(false)} onPoints={(pts) => { const u = { ...user, points: (user.points||0)+pts }; setUser(u); localStorage.setItem("basma_user", JSON.stringify(u)); showToast("🎉 +" + pts + " نقطة!"); }} />}
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
function HomePage({ user, branch, now, todayAtt, allAtt, gps, gpsDist, streak, loading, dayState, checkpoints, onCheckin, onChallenge }) {
  const { time, ampm } = formatTime(now);
  const badge = memberBadge(user.points || 0);
  const inRange = branch && gpsDist !== null && gpsDist <= (branch.radius || 150);

  const SIZE = 200, STROKE = 10, R = (SIZE - STROKE) / 2, CIRC = 2 * Math.PI * R;
  let pct = dayState === "before" ? 5 : dayState === "after" ? 100 : 50;
  if (branch && dayState === "during") {
    const mins = now.getHours() * 60 + now.getMinutes();
    pct = Math.min(100, Math.round(((mins - timeToMin(branch.start)) / (timeToMin(branch.end) - timeToMin(branch.start))) * 100));
  }
  const ringOff = CIRC - (pct / 100) * CIRC;
  const ringCol = dayState === "during" ? "#5ec47a" : dayState === "after" ? C.gold : "#80b4f0";

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
  const lateDays = branch ? monthAtt.filter(r => r.type === "checkin" && (new Date(r.ts).getHours() * 60 + new Date(r.ts).getMinutes()) > timeToMin(branch.start) + 5).length : 0;
  const attendPct = presentDays > 0 ? Math.round((presentDays / Math.max(1, new Date().getDate())) * 100) : 0;
  const todayLate = branch && todayAtt.some(r => r.type === "checkin" && (new Date(r.ts).getHours() * 60 + new Date(r.ts).getMinutes()) > timeToMin(branch.start) + 5);

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
          </div>
        </div>
        <div style={S.clockWrap}>
          <div style={{ position: "relative", width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={STROKE} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={ringCol} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOff} style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={S.clockInner}>
              <div style={S.clockTime}>{time}</div>
              <div style={S.clockAmpm}>{ampm}</div>
              {btnAction ? (
                <button onClick={() => !loading && onCheckin(btnAction, btnLabel)} disabled={loading} style={S.clockBtn}>
                  {loading ? <span className="basma-pulse">⏳</span> : btnText}
                </button>
              ) : (
                <div style={{ ...S.clockBtn, opacity: .6, cursor: "default" }}>{btnText}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={S.content}>
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

        {dayState === "before" && (
          <div onClick={onChallenge} style={S.challengeCard} className="basma-fadein-d1">
            <div style={{ fontSize: 14, fontWeight: 800 }}>⚡ سؤال التحدي — 25 نقطة</div>
            <div style={{ fontSize: 10, opacity: .8, marginTop: 3 }}>اضغط للإجابة وكسب النقاط</div>
          </div>
        )}

        <div style={S.card} className="basma-fadein-d1">
          <div style={S.cardTitle}><span>ملخص اليوم</span><span style={{ fontSize: 12, color: C.blue }}>›</span></div>
          <div style={S.summaryGrid}>
            <SummaryItem num={checkpoints.checkin ? 1 : 0} label="حاضر" cls="ok" />
            <SummaryItem num={todayLate ? 1 : 0} label="متأخر" cls="warn" />
            <SummaryItem num={!checkpoints.checkin && dayState === "after" ? 1 : 0} label="غائب" cls="bad" />
            <SummaryItem num={0} label="إجازة" cls="info" />
          </div>
        </div>

        <div style={S.card} className="basma-fadein-d2">
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

/* ═══════════ REPORT ═══════════ */
function ReportPage({ user, allAtt, branch }) {
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

  return (
    <div style={{ flex: 1, paddingBottom: 80 }}>
      <div style={S.detailHeader}>
        <div style={{ width: 60 }} />
        <div style={S.detailTitle}>تقريري</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }} className="basma-fadein">
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
            <MonthStat num="0" label="ساعات إضافية" color={C.blue} />
            <MonthStat num="0" label="أيام إجازة" color={C.orange} />
          </div>
        </div>

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

        <button style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg,"+C.blue+","+C.blueBright+")", color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Cairo',sans-serif", marginBottom: 12 }}>
          📊 تصدير التقرير
        </button>
      </div>
    </div>
  );
}

/* ═══════════ PROFILE ═══════════ */
function ProfilePage({ user, branch, onLogout }) {
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

        <div style={S.card} className="basma-fadein-d2">
          <div style={S.cardTitle}>الإعدادات</div>
          <ToggleRow label="📞 تذكير بالحضور" storeKey="remind_in" border={true} />
          <ToggleRow label="📞 تذكير بالانصراف" storeKey="remind_out" border={false} />
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

        <button onClick={onLogout} style={{ width: "100%", padding: 14, borderRadius: 16, border: "2px solid " + C.red, background: "transparent", color: C.red, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo',sans-serif" }}>
          🚪 تسجيل خروج
        </button>
        <div style={{ textAlign: "center", color: "rgba(0,0,0,.2)", fontSize: 10, marginTop: 16, marginBottom: 12 }}>{"v" + VER}</div>
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

function FaceModal({ onVerified, onSkip, onCancel }) {
  var videoRef = useRef(null);
  var canvasRef = useRef(null);
  var [status, setStatus] = useState("init");
  var [stream, setStream] = useState(null);

  useEffect(function() {
    var s = null;
    (async function() {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 320 } });
        setStream(s);
        if (videoRef.current) { videoRef.current.srcObject = s; }
        setStatus("ready");
      } catch(e) { setStatus("error"); }
    })();
    return function() { if (s) s.getTracks().forEach(function(t){ t.stop(); }); };
  }, []);

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    var ctx = canvasRef.current.getContext("2d");
    canvasRef.current.width = 320;
    canvasRef.current.height = 320;
    ctx.drawImage(videoRef.current, 0, 0, 320, 320);
    var photo = canvasRef.current.toDataURL("image/jpeg", 0.6);
    setStatus("captured");
    if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
    setTimeout(function(){ onVerified(photo); }, 600);
  }

  function handleClose() {
    if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
    onCancel();
  }

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div className="basma-slideup" style={{ ...S.modal, maxWidth: 340 }} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif", textAlign: "center", marginBottom: 12 }}>📸 التحقق بالوجه</div>
        <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden", margin: "0 auto 16px", border: "4px solid " + (status === "captured" ? C.green : C.blue), position: "relative", background: "#000" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {status === "captured" && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(45,159,111,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 48, color: "#fff" }}>✓</span>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {status === "error" && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 8 }}>لا يمكن الوصول للكاميرا</div>
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
        {status === "captured" && <div style={{ textAlign: "center", color: C.green, fontSize: 14, fontWeight: 700 }}>جارِ التسجيل...</div>}
        {status === "init" && <div style={{ textAlign: "center", color: C.sub, fontSize: 12 }} className="basma-pulse">جارِ تشغيل الكاميرا...</div>}
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

/* ═══════════ SMALL COMPONENTS ═══════════ */

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

function BottomNav({ page, setPage }) {
  var items = [
    { id: "home", icon: "🏠", label: "الرئيسية" },
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
var S = {
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

  card: { background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,.06)" },
  cardTitle: { fontSize: 15, fontWeight: 800, fontFamily: "'Cairo',sans-serif", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },

  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" },
  cpRow: { display: "flex", gap: 8, marginTop: 12 },

  detailHeader: { background: "linear-gradient(180deg,"+C.hdr1+","+C.hdr2+")", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 },
  detailTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "'Cairo',sans-serif" },

  nav: { position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", background: "#fff", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-around", padding: "8px 0 16px", zIndex: 100 },
  navItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", padding: "4px 12px", cursor: "pointer", fontFamily: "'Tajawal',sans-serif" },
  navBar: { position: "absolute", top: -1, width: 24, height: 3, borderRadius: 2, background: C.blue },

  loginInput: { width: "100%", padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'Tajawal',sans-serif", outline: "none", textAlign: "center", direction: "ltr" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 },
  modal: { background: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 380 },
};
