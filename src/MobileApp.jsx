import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ═══════ API ═══════
const API = '/api/data';
const api = async (action, method = 'GET', body = null, params = '') => {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${API}?action=${action}${params}`, opts);
    return await r.json();
  } catch { return null; }
};

// ═══════ THEME SYSTEM ═══════
const ThemeCtx = createContext({ dark: false, t: null, toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);

const LIGHT = {
  bg: "#F2F2F7", card: "#FFFFFF", cardBrd: "rgba(0,0,0,0.05)",
  cardSh: "0 1px 3px rgba(0,0,0,0.08)",
  tx: "#000000", tx2: "#6E6E73", txM: "#8E8E93",
  sep: "#E5E5EA", ac: "#0A84FF",
  ok: "#30D158", okLt: "rgba(48,209,88,0.1)",
  warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.1)",
  bad: "#FF3B30", badLt: "rgba(255,59,48,0.08)",
  info: "#5AC8FA", infoLt: "rgba(90,200,250,0.1)",
  acLt: "rgba(10,132,255,0.1)",
  track: "#E5E5EA", nav: "#F2F2F7", navBrd: "rgba(0,0,0,0.1)",
  inp: "#FFFFFF", inpBrd: "#E5E5EA",
  gold: "#FF9F0A", silver: "#8E8E93", bronze: "#0A84FF",
  headerBg: "rgba(242,242,247,0.85)",
};
const DARK = {
  bg: "#000000", card: "#1C1C1E", cardBrd: "rgba(255,255,255,0.1)",
  cardSh: "none",
  tx: "#FFFFFF", tx2: "#98989D", txM: "#636366",
  sep: "#2C2C2E", ac: "#0A84FF",
  ok: "#30D158", okLt: "rgba(48,209,88,0.15)",
  warn: "#FF9F0A", warnLt: "rgba(255,159,10,0.15)",
  bad: "#FF453A", badLt: "rgba(255,69,58,0.12)",
  info: "#64D2FF", infoLt: "rgba(100,210,255,0.12)",
  acLt: "rgba(10,132,255,0.18)",
  track: "#2C2C2E", nav: "#1C1C1E", navBrd: "rgba(255,255,255,0.1)",
  inp: "#2C2C2E", inpBrd: "rgba(255,255,255,0.1)",
  gold: "#FFD60A", silver: "#98989D", bronze: "#0A84FF",
  headerBg: "rgba(28,28,30,0.85)",
};

// ═══════ CONSTANTS ═══════
const APP = "بصمة HMA";
const VER = "v4.02";
const CO = "هاني محمد عسيري للإستشارات الهندسية";
const B = { blue: "#2B5EA7", yellow: "#FDD800", red: "#E2192C", black: "#1A1A1A", blueDk: "#1E4478", blueLt: "#EDF3FB", gold: "#D4A017", diamond: "#7C3AED" };
const C = LIGHT; // Default light - components use useTheme().t for dynamic
const Fn = "'IBM Plex Sans Arabic',-apple-system,'Segoe UI',sans-serif";
const FL = { position: "absolute", inset: 0, minHeight: "100vh", fontFamily: Fn };
const PB = { background: "#0A84FF", border: "none", borderRadius: 12, color: "#fff", padding: "13px", fontSize: 17, fontWeight: 600, cursor: "pointer", height: 44 };
const inp = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #E5E5EA", fontSize: 15, fontWeight: 600, color: "#000", outline: "none", fontFamily: Fn, background: "#FFFFFF" };
// Card style helper - components override with theme
const getCrd = (t) => ({ background: t.card, borderRadius: 14, padding: "16px", border: "1px solid " + t.cardBrd, boxShadow: t.cardSh });
const crd = { background: "#FFFFFF", borderRadius: 14, padding: "16px", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
const BR = { jed: "جدة", riy: "الرياض", ist: "اسطنبول", gaz: "غازي عنتاب" };
const LEVELS = [
  { name: "عضوية فعّال", badge: "🔹", color: C.ac, min: 0 },
  { name: "عضوية تميّز", badge: "🥈", color: "#8E8E93", min: 750 },
  { name: "عضوية نخبة", badge: "🥇", color: "#FF9F0A", min: 1500 },
];
const getLevel = pts => [...LEVELS].reverse().find(l => pts >= l.min) || LEVELS[0];
const EMP_TYPES = { office: "🏢 مكتبي", field: "🏗️ ميداني", mixed: "🔄 مختلط", remote: "🏠 عن بُعد" };
const CPS = [
  { id: 1, h: 8, m: 30, l: "الحضور", ic: "☀️" },
  { id: 2, h: 12, m: 25, l: "الاستراحة", ic: "☕" },
  { id: 3, h: 13, m: 5, l: "العودة", ic: "🔄" },
  { id: 4, h: 17, m: 0, l: "الانصراف", ic: "🌙" },
];
const CHALLENGES = [
  { q: "سبحان الله وبحمده ...", opts: ["سبحان الله العظيم", "الحمد لله", "لا إله إلا الله"], correct: 0, type: "ذكر" },
  { q: "ما وحدة قياس قوة الخرسانة؟", opts: ["نيوتن", "ميجا باسكال", "كيلو جرام"], correct: 1, type: "هندسي" },
  { q: "يمشي بلا أرجل؟", opts: ["الماء", "الوقت", "الهواء"], correct: 1, type: "لغز" },
  { q: "كم عدد أركان الإسلام؟", opts: ["3", "5", "7"], correct: 1, type: "سؤال" },
  { q: "اللهم بك أصبحنا وبك ...", opts: ["أمسينا", "حيينا", "توكلنا"], correct: 0, type: "ذكر" },
];
const COUPONS = [
  { id: 1, brand: "البيك", discount: "خصم 15%", icon: "🍔", pts: 50 },
  { id: 2, brand: "كافيه", discount: "قهوة مجانية", icon: "☕", pts: 15 },
  { id: 3, brand: "غسيل سيارة", discount: "غسلة مجانية", icon: "🚗", pts: 30 },
  { id: 4, brand: "مكتبة جرير", discount: "خصم 20%", icon: "📚", pts: 80 },
];

// ═══════ GPS ═══════
function getGPS() { return new Promise((ok, no) => { if (!navigator.geolocation) return no("none"); navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), no, { enableHighAccuracy: true, timeout: 8000 }); }); }
function gpsDist(a, b) { const R = 6371000, d = x => x * Math.PI / 180, dl = d(b.lat - a.lat), dn = d(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(dn / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }

// ═══════ SCE MEMBERSHIP CHECK ═══════
function checkSCE(emp) {
  if (!emp.sceExpiry) return null;
  const now = new Date(), exp = new Date(emp.sceExpiry);
  const days = Math.ceil((exp - now) / 86400000);
  if (days < 0) return { status: "expired", days: Math.abs(days), color: C.bad, icon: "🔴", text: `منتهية منذ ${Math.abs(days)} يوم`, alert: true };
  if (days <= 7) return { status: "critical", days, color: C.bad, icon: "🔴", text: `تنتهي خلال ${days} أيام!`, alert: true };
  if (days <= 30) return { status: "warning", days, color: C.warn, icon: "🟡", text: `تنتهي خلال ${days} يوم`, alert: true };
  if (days <= 60) return { status: "notice", days, color: B.yellow, icon: "🟡", text: `تنتهي خلال ${days} يوم`, alert: false };
  return { status: "ok", days, color: C.ok, icon: "🟢", text: `صالحة (${days} يوم)`, alert: false };
}

// ═══════ SMALL COMPONENTS ═══════
function Logo({ s = 24 }) { const h = s / 2, g = s * .02, r = s * .06, f = s * .28; return (<svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={0} y={0} width={h - g} height={h - g} rx={r} fill={B.blue} /><rect x={h + g} y={0} width={h - g} height={h - g} rx={r} fill={B.yellow} /><rect x={0} y={h + g} width={h - g} height={h - g} rx={r} fill={B.red} /><rect x={h + g} y={h + g} width={h - g} height={h - g} rx={r} fill={B.black} /><text x={h * .5} y={h * .68} textAnchor="middle" fill="#fff" fontSize={f} fontWeight="900" fontFamily="Arial">H</text><text x={h * 1.5 + g} y={h * .68} textAnchor="middle" fill={B.black} fontSize={f} fontWeight="900" fontFamily="Arial">M</text><text x={h * .5} y={h * 1.68 + g} textAnchor="middle" fill="#fff" fontSize={f} fontWeight="900" fontFamily="Arial">A</text><text x={h * 1.5 + g} y={h * 1.52 + g} textAnchor="middle" fill="#fff" fontSize={f * .45} fontWeight="800" fontFamily="Arial">ENG</text></svg>); }
function Stripe({ h = 4 }) { return <div style={{ display: "flex", height: h, flexShrink: 0 }}><div style={{ flex: 1, background: B.blue }} /><div style={{ flex: 1, background: B.yellow }} /><div style={{ flex: 1, background: B.red }} /></div>; }

// ═══════ GPS BADGE ═══════
function GpsBadge({ branch, empType, empId, onStatusChange }) {
  const [s, setS] = useState({ c: true, inR: false, d: 0, err: false, zone: null });

  useEffect(() => {
    // Remote employees don't need GPS
    if (empType === "remote") {
      const st = { c: false, inR: true, d: 0, err: false, remote: true, zone: "عن بُعد" };
      setS(st);
      if (onStatusChange) onStatusChange(st);
      return;
    }
    check();
    const i = setInterval(check, 30000); // Check every 30 seconds
    return () => clearInterval(i);
  }, []);

  const check = async () => {
    try {
      const pos = await getGPS();
      const branches = await api('branches') || [];
      const br = branches.find(b => b.id === branch) || { lat: 21.5433, lng: 39.1728, radius: 150, name: "المكتب" };

      // 1. Check branch distance
      const brDist = Math.round(gpsDist(pos, { lat: br.lat, lng: br.lng }));
      const inBranch = brDist <= br.radius;

      // 2. For field/mixed employees, also check project zones
      let inProject = false, projectName = null, projectDist = 0;
      if (empType === "field" || empType === "mixed") {
        const projects = await api('projects') || [];
        const myProjects = projects.filter(p => p.employees && p.employees.includes(empId) && p.active !== false);
        for (const proj of myProjects) {
          if (proj.lat && proj.lng && proj.radius) {
            const pd = Math.round(gpsDist(pos, { lat: proj.lat, lng: proj.lng }));
            if (pd <= proj.radius) {
              inProject = true;
              projectName = proj.name;
              projectDist = pd;
              break;
            }
          }
        }
      }

      // 3. Determine final status
      let inRange = false, zone = null, dist = brDist;
      if (empType === "office") {
        inRange = inBranch;
        zone = inBranch ? br.name || "المكتب" : null;
      } else if (empType === "field") {
        inRange = inProject || inBranch;
        zone = inProject ? `📍 ${projectName}` : inBranch ? br.name || "المكتب" : null;
        dist = inProject ? projectDist : brDist;
      } else if (empType === "mixed") {
        inRange = inBranch || inProject;
        zone = inBranch ? br.name || "المكتب" : inProject ? `📍 ${projectName}` : null;
        dist = inBranch ? brDist : inProject ? projectDist : brDist;
      }

      const st = { c: false, inR: inRange, d: dist, err: false, zone };
      setS(st);
      if (onStatusChange) onStatusChange(st);
    } catch {
      const st = { c: false, inR: false, d: 0, err: true };
      setS(st);
      if (onStatusChange) onStatusChange(st);
    }
  };

  // Remote badge
  if (s.remote) return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 10, background: "rgba(124,58,237,.1)", zIndex: 1, marginBottom: 4 }}>
      <span style={{ fontSize: 10 }}>🏠</span>
      <span style={{ fontSize: 10, color: B.diamond, fontWeight: 600 }}>عمل عن بُعد</span>
    </div>
  );

  const col = s.c ? C.warn : s.err ? C.bad : s.inR ? C.ok : C.bad;
  const txt = s.c ? "جارِ تحديد الموقع..."
    : s.err ? "GPS غير متوفر"
    : s.inR ? `في النطاق — ${s.zone || "المكتب"} (${s.d}م)`
    : `خارج النطاق (${s.d}م)`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 10, background: col + "11", zIndex: 1, marginBottom: 4 }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: col }} />
      <span style={{ fontSize: 10, color: col, fontWeight: 600 }}>{txt}</span>
    </div>
  );
}

// ═══════ FACE-API.JS ENGINE ═══════
// Neural network face detection, landmarks (68 points), and recognition (128-dim descriptor)

var FACE_MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";
var _modelsLoaded = false;

async function loadFaceModels(onProgress) {
  if (_modelsLoaded) return true;
  if (typeof faceapi === "undefined") { console.error("face-api.js not loaded"); return false; }
  try {
    if (onProgress) onProgress("تحميل نموذج كشف الوجه...");
    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
    if (onProgress) onProgress("تحميل نموذج نقاط الوجه...");
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODELS_URL);
    if (onProgress) onProgress("تحميل نموذج التعرّف...");
    await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
    _modelsLoaded = true;
    console.log("[FaceAPI] All models loaded");
    return true;
  } catch(e) {
    console.error("[FaceAPI] Model load error:", e);
    return false;
  }
}

// Detect face + get 128-dim descriptor
async function getFaceDescriptor(imgSrc) {
  if (!_modelsLoaded) return { ok: false, reason: "النماذج لم تُحمَّل بعد" };
  try {
    var img = await faceapi.fetchImage(imgSrc);
    var opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    var results = await faceapi.detectAllFaces(img, opts).withFaceLandmarks(true).withFaceDescriptors();
    if (results.length === 0) return { ok: false, reason: "لم يتم اكتشاف وجه — وجّه الكاميرا لوجهك" };
    if (results.length > 1) return { ok: false, reason: "أكثر من وجه في الصورة — صوّر وجهك فقط" };
    var det = results[0];
    // Check face size (must be at least 20% of image)
    var box = det.detection.box;
    var imgArea = img.width * img.height;
    var faceArea = box.width * box.height;
    if (faceArea / imgArea < 0.08) return { ok: false, reason: "الوجه بعيد — قرّب الجوال من وجهك" };
    // Check detection confidence
    if (det.detection.score < 0.65) return { ok: false, reason: "الصورة غير واضحة — تأكد من الإضاءة" };
    // Check face angle using landmarks (eyes should be roughly level)
    var landmarks = det.landmarks;
    var leftEye = landmarks.getLeftEye();
    var rightEye = landmarks.getRightEye();
    var eyeCenter = function(pts) { var sx = 0, sy = 0; pts.forEach(function(p) { sx += p.x; sy += p.y; }); return { x: sx / pts.length, y: sy / pts.length }; };
    var le = eyeCenter(leftEye), re = eyeCenter(rightEye);
    var angle = Math.abs(Math.atan2(re.y - le.y, re.x - le.x) * 180 / Math.PI);
    if (angle > 20) return { ok: false, reason: "وجهك مائل — انظر مباشرة للكاميرا" };
    return {
      ok: true,
      descriptor: Array.from(det.detection.score > 0 ? det.descriptor : []),
      score: Math.round(det.detection.score * 100),
      box: { x: box.x, y: box.y, w: box.width, h: box.height }
    };
  } catch(e) {
    console.error("[FaceAPI] Detection error:", e);
    return { ok: false, reason: "خطأ في تحليل الصورة" };
  }
}

// Compare two descriptors using Euclidean distance
function compareDescriptors(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== 128 || desc2.length !== 128) return 0;
  var dist = faceapi.euclideanDistance(desc1, desc2);
  // distance 0 = identical, 0.6+ = different person
  // Convert to percentage: 0 → 100%, 0.6 → 0%
  var sim = Math.max(0, Math.min(100, Math.round((1 - dist / 0.6) * 100)));
  console.log("[FaceAPI] Distance:", dist.toFixed(4), "→ Similarity:", sim + "%");
  return { similarity: sim, distance: dist };
}

// ═══════ FACE CAMERA COMPONENT ═══════
function FaceCamera({ onOk, onNo, empId }) {
  var themeObj = useTheme(); var t = themeObj.t;
  var vRef = useRef(null), cRef = useRef(null), sRef = useRef(null);
  var _st = useState("loading_models"), st = _st[0], setSt = _st[1];
  var _ph = useState(null), photo = _ph[0], setPhoto = _ph[1];
  var _mp = useState(0), matchPct = _mp[0], setMatchPct = _mp[1];
  var _er = useState(""), err = _er[0], setErr = _er[1];
  var _at = useState(0), attempts = _at[0], setAttempts = _at[1];
  var _pg = useState(""), progress = _pg[0], setProgress = _pg[1];
  var _li = useState(false), isLive = _li[0], setIsLive = _li[1];
  var _sd = useState(null), serverDesc = _sd[0], setServerDesc = _sd[1];
  var _fl = useState(true), faceLoading = _fl[0], setFaceLoading = _fl[1];

  // Load models then start camera
  useEffect(function() {
    var cancelled = false;
    (async function() {
      var ok = await loadFaceModels(function(msg) { if (!cancelled) setProgress(msg); });
      if (cancelled) return;
      if (!ok) { setErr("فشل تحميل نماذج الذكاء الاصطناعي — تحقق من الاتصال"); setSt("model_error"); return; }
      // Load face descriptor from server
      if (empId) {
        setProgress("تحميل بيانات البصمة...");
        try {
          var faceData = await api("face", "GET", null, "&empId=" + empId);
          if (faceData && faceData.ok && faceData.descriptor) {
            setServerDesc(faceData.descriptor);
            // Cache locally
            localStorage.setItem("basma_face_v2", JSON.stringify(faceData.descriptor));
          }
        } catch(e) {
          // Fallback to localStorage cache
          var cached = localStorage.getItem("basma_face_v2");
          if (cached) setServerDesc(JSON.parse(cached));
        }
      }
      setFaceLoading(false);
      setProgress("تشغيل الكاميرا...");
      try {
        var s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }
        });
        if (cancelled) { s.getTracks().forEach(function(tr) { tr.stop(); }); return; }
        sRef.current = s;
        if (vRef.current) {
          vRef.current.srcObject = s;
          vRef.current.onloadedmetadata = function() { if (!cancelled) setSt("ready"); };
        }
      } catch(e) {
        if (!cancelled) { setErr("لا يمكن تشغيل الكاميرا — فعّل صلاحية الكاميرا"); setSt("cam_error"); }
      }
    })();
    return function() { cancelled = true; stopCam(); };
  }, []);

  var stopCam = function() {
    if (sRef.current) sRef.current.getTracks().forEach(function(tr) { tr.stop(); });
  };

  // Real-time face detection indicator
  useEffect(function() {
    if (st !== "ready" || !_modelsLoaded) return;
    var interval = setInterval(async function() {
      var v = vRef.current;
      if (!v || v.readyState < 2) return;
      try {
        var dets = await faceapi.detectAllFaces(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 }));
        setIsLive(dets.length === 1);
      } catch(e) { /* ignore */ }
    }, 800);
    return function() { clearInterval(interval); };
  }, [st]);

  var snap = async function() {
    var v = vRef.current, c = cRef.current;
    if (!v || !c) return;
    var ctx = c.getContext("2d");
    c.width = 400; c.height = 400;
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(v, -400, 0, 400, 400); ctx.restore();
    var dataUrl = c.toDataURL("image/jpeg", 0.85);
    setSt("checking"); setErr("");
    var result = await getFaceDescriptor(dataUrl);
    if (result.ok) {
      setPhoto(dataUrl);
      // Store descriptor temporarily for confirm step
      cRef.current._descriptor = result.descriptor;
      cRef.current._score = result.score;
      setSt("snapped");
    } else {
      setErr(result.reason); setSt("ready");
      setAttempts(function(a) { return a + 1; });
    }
  };

  var confirm = async function() {
    setSt("checking");
    var descriptor = cRef.current._descriptor;
    var score = cRef.current._score;
    if (!descriptor || descriptor.length !== 128) {
      setErr("خطأ في بيانات الوجه — أعد المحاولة");
      setSt("ready"); setPhoto(null);
      return;
    }
    if (!serverDesc) {
      // First registration — save to server + localStorage
      var saveOk = await api("face", "POST", { empId: empId, descriptor: descriptor });
      if (!saveOk || saveOk.error) {
        // Fallback: save locally if server fails
        localStorage.setItem("basma_face_v2", JSON.stringify(descriptor));
        console.log("[FaceAPI] Server save failed, cached locally");
      } else {
        localStorage.setItem("basma_face_v2", JSON.stringify(descriptor));
        console.log("[FaceAPI] Descriptor saved to server ✓");
      }
      localStorage.removeItem("basma_face");
      api("checkin", "POST", { type: "face_register", empId: empId });
      setMatchPct(score);
      setSt("ok"); stopCam();
      setTimeout(function() { onOk(photo); }, 1400);
    } else {
      // Compare with stored descriptor (server or cache)
      var result = compareDescriptors(serverDesc, descriptor);
      setMatchPct(result.similarity);
      console.log("[FaceAPI] Compare: distance=" + result.distance.toFixed(4) + " sim=" + result.similarity + "% threshold=0.32");
      // Threshold: distance < 0.32 = same person (strict — rejects different people)
      if (result.distance < 0.32) {
        setSt("ok"); stopCam();
        setTimeout(function() { onOk(photo); }, 1400);
      } else {
        setErr("الوجه غير مطابق (" + result.similarity + "%) — حاول مرة أخرى");
        setSt("ready"); setPhoto(null);
        setAttempts(function(a) { return a + 1; });
      }
    }
  };

  var isFirst = !serverDesc && !faceLoading;
  var MAX_ATTEMPTS = 5;
  var borderColor = st === "ok" ? C.ok : err ? C.bad : st === "checking" ? B.yellow : isLive ? C.ok : B.blue;
  var statusColor = st === "ok" ? C.ok : B.yellow;

  var statusText =
    st === "loading_models" ? progress || "جارِ التحميل..." :
    st === "model_error" ? "خطأ في النماذج" :
    st === "cam_error" ? "خطأ في الكاميرا" :
    st === "ready" ? (isLive ? "✓ تم رصد وجه — اضغط التقاط" : "وجّه الكاميرا لوجهك") :
    st === "snapped" ? "تم التحليل بنجاح ✓" :
    st === "checking" ? "جارِ التحقق بالذكاء الاصطناعي..." :
    isFirst ? "تم تسجيل البصمة ✓" : "تم التحقق ✓";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, direction: "rtl" }}>
      {/* Header */}
      <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 2, letterSpacing: 0.3 }}>{isFirst ? "تسجيل بصمة الوجه" : "التحقق من الهوية"}</div>
      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11, marginBottom: 6 }}>Face Recognition AI — 128-point neural network</div>
      <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginBottom: 16 }}>{isFirst ? "التقط صورة واضحة لوجهك في إضاءة جيدة" : "سيتم مقارنة وجهك بالبصمة المسجّلة"}</div>

      {/* Circular viewfinder */}
      <div style={{ position: "relative", width: 260, height: 260 }}>
        {/* Animated scanning ring */}
        {st === "checking" && <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid " + B.blue, animation: "pulse 1s infinite", opacity: 0.5 }} />}
        {/* Live face indicator ring */}
        {st === "ready" && isLive && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid " + C.ok, opacity: 0.4, transition: "opacity .3s" }} />}
        {/* Guide ring */}
        <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px dashed rgba(255,255,255,.08)" }} />

        <div style={{ width: 260, height: 260, borderRadius: "50%", overflow: "hidden", border: "4px solid " + borderColor, background: "#111", transition: "border-color .4s", position: "relative" }}>
          {(st === "loading_models" || st === "model_error" || st === "cam_error") && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#111", zIndex: 2 }}>
            {st === "loading_models" && <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,.1)", borderTopColor: B.blue, borderRadius: "50%", animation: "spin .8s linear infinite" }} />}
            {st === "model_error" && <span style={{ fontSize: 36 }}>⚠️</span>}
            {st === "cam_error" && <span style={{ fontSize: 36 }}>📷</span>}
          </div>}
          <video ref={vRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {(st === "snapped" || st === "checking") && photo && <img src={photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
          {st === "ok" && <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(48,209,88,.08)" }}>
            <span style={{ fontSize: 52, color: C.ok }}>✓</span>
            {matchPct > 0 && <span style={{ fontSize: 14, color: C.ok, marginTop: 6, fontWeight: 700 }}>تطابق {matchPct}%</span>}
          </div>}
        </div>
      </div>

      <canvas ref={cRef} style={{ display: "none" }} />

      {/* Error */}
      {err && <div style={{ color: C.bad, fontSize: 12, fontWeight: 600, marginTop: 12, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>{err}</div>}

      {/* Attempts */}
      {attempts > 0 && attempts < MAX_ATTEMPTS && st !== "ok" && <div style={{ color: "rgba(255,255,255,.2)", fontSize: 10, marginTop: 4 }}>المحاولة {attempts} من {MAX_ATTEMPTS}</div>}

      {/* Status */}
      <div style={{ color: statusColor, fontSize: 13, fontWeight: 700, marginTop: err ? 6 : 14, transition: "color .3s" }}>{statusText}</div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        {st === "ready" && <button onClick={attempts >= MAX_ATTEMPTS ? undefined : snap} disabled={attempts >= MAX_ATTEMPTS} style={{ padding: "12px 32px", borderRadius: 50, background: attempts >= MAX_ATTEMPTS ? "#555" : isLive ? C.ok : B.blue, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: attempts >= MAX_ATTEMPTS ? "not-allowed" : "pointer", opacity: attempts >= MAX_ATTEMPTS ? 0.5 : 1, transition: "background .3s" }}>{isLive ? "التقاط ✓" : "التقاط"}</button>}
        {st === "snapped" && <>
          <button onClick={confirm} style={{ padding: "12px 28px", borderRadius: 50, background: C.ok, color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>تأكيد</button>
          <button onClick={function() { setPhoto(null); setSt("ready"); setErr(""); }} style={{ padding: "12px 28px", borderRadius: 50, background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>إعادة</button>
        </>}
        {(st === "model_error" || st === "cam_error") && <button onClick={function() { setSt("loading_models"); setErr(""); loadFaceModels(setProgress).then(function(ok) { if (ok) startCam(); }); }} style={{ padding: "12px 28px", borderRadius: 50, background: B.blue, color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>إعادة المحاولة</button>}
      </div>

      {/* Max attempts */}
      {attempts >= MAX_ATTEMPTS && st !== "ok" && <div style={{ color: C.bad, fontSize: 12, fontWeight: 600, marginTop: 12, textAlign: "center" }}>تم تجاوز الحد الأقصى للمحاولات — تواصل مع المدير</div>}

      {/* Secondary actions */}
      {st !== "ok" && st !== "checking" && st !== "loading_models" && <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <button onClick={function() { stopCam(); onNo(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", fontSize: 11, cursor: "pointer" }}>إلغاء</button>
        {!isFirst && <button onClick={function() { api("face", "DELETE", null, "&empId=" + empId); localStorage.removeItem("basma_face_v2"); localStorage.removeItem("basma_face"); setServerDesc(null); setErr(""); setSt("ready"); setPhoto(null); setAttempts(0); }} style={{ background: "none", border: "none", color: C.warn, fontSize: 11, cursor: "pointer" }}>إعادة تسجيل البصمة</button>}
      </div>}

      {/* CSS animations */}
      <style>{"\
@keyframes pulse{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.06);opacity:.6}}\
@keyframes spin{to{transform:rotate(360deg)}}\
      "}</style>
    </div>
  );
}

// ═══════ CALL NOTIFICATION ═══════
function CallNotif({ type, title, sub, onAnswer, onDecline }) {
  const audioRef = useRef(null);
  // Generate ringtone using Web Audio API
  useEffect(() => {
    let ctx, osc, gain, interval, stopped = false;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const ring = () => {
        if (stopped) return;
        osc = ctx.createOscillator(); gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 440; osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
        // Second tone
        setTimeout(() => {
          if (stopped) return;
          const o2 = ctx.createOscillator(), g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 520; o2.type = "sine";
          g2.gain.setValueAtTime(0.3, ctx.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
          o2.start(ctx.currentTime); o2.stop(ctx.currentTime + 0.8);
        }, 200);
      };
      ring();
      interval = setInterval(ring, 2500);
    } catch {}
    // Vibration
    let vibInt;
    if (navigator.vibrate) { vibInt = setInterval(() => navigator.vibrate([300, 150, 300, 150, 300]), 2500); }
    return () => {
      stopped = true;
      clearInterval(interval); clearInterval(vibInt);
      if (navigator.vibrate) navigator.vibrate(0);
      try { ctx?.close(); } catch {}
    };
  }, []);
  // Auto dismiss after 25 seconds
  useEffect(() => { const t = setTimeout(() => onDecline(), 25000); return () => clearTimeout(t); }, []);
  const icons = { checkin: "☀️", break_s: "☕", break_e: "🔄", retry: "⚠️" };
  return (<div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg,#0B0F1A,#1a2332)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, direction: "rtl" }}>
    <style>{`@keyframes rpl{0%{transform:scale(.8);opacity:.5}100%{transform:scale(2.2);opacity:0}} @keyframes shk{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}} @keyframes blk{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    {[0, 1, 2].map(i => <div key={i} style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", border: "2px solid rgba(43,94,167,.25)", animation: `rpl 2s ease-out infinite ${i * .5}s` }} />)}
    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(43,94,167,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, border: "3px solid rgba(43,94,167,.3)", marginBottom: 14 }}>{icons[type] || "📞"}</div>
    <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{title}</div>
    <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, marginTop: 4 }}>{sub}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}><Logo s={14} /><span style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>{APP}</span></div>
    <div style={{ color: B.blue, fontSize: 11, fontWeight: 600, marginTop: 20, marginBottom: 30, animation: "blk 1.5s infinite" }}>اضغط للرد...</div>
    <div style={{ display: "flex", gap: 44 }}>
      <button onClick={onDecline} style={{ width: 58, height: 58, borderRadius: "50%", background: B.red, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${B.red}55` }}><span style={{ fontSize: 24, transform: "rotate(135deg)", display: "block" }}>📞</span></button>
      <button onClick={onAnswer} style={{ width: 58, height: 58, borderRadius: "50%", background: C.ok, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: "shk .5s infinite", boxShadow: "0 4px 20px rgba(5,150,105,.4)" }}><span style={{ fontSize: 24 }}>📞</span></button>
    </div>
    <div style={{ display: "flex", gap: 56, marginTop: 8 }}><span style={{ color: "rgba(255,255,255,.3)", fontSize: 10 }}>رفض</span><span style={{ color: "rgba(255,255,255,.3)", fontSize: 10 }}>رد</span></div>
  </div>);
}

// ═══════ SPLASH ═══════
function Splash({ onDone }) {
  const { t } = useTheme();
  useEffect(() => { api('init'); setTimeout(onDone, 1800); }, []);
  return (<div style={{ ...FL, background: t.card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><Logo s={100} /><div style={{ fontSize: 26, fontWeight: 800, color: B.blue, marginTop: 16 }}>{APP}</div><div style={{ fontSize: 12, color: t.txM, marginTop: 6 }}>{CO}</div></div>);
}

// ═══════ REGISTRATION ═══════
function Reg({ onDone }) {
  const { t } = useTheme();
  const [st, setSt] = useState(0), [eid, setEid] = useState(""), [code, setCode] = useState(""), [err, setErr] = useState(""), [found, setFound] = useState(null), [showCam, setShowCam] = useState(false);
  const go = async () => { const emps = await api('employees') || []; const e = emps.find(x => x.id === eid.toUpperCase()); if (e) { setFound(e); setSt(1); setErr(""); } else setErr("الرقم الوظيفي غير موجود"); };
  const doLogin = async () => { const r = await api('login', 'POST', { empId: eid.toUpperCase(), code }); if (r?.ok) { localStorage.setItem("basma_uid", found.id); setShowCam(true); } else setErr(r?.error || "رمز خاطئ"); };
  if (showCam) return <FaceCamera empId={found.id} onOk={() => onDone(found)} onNo={() => setShowCam(false)} />;
  return (<div style={{ ...FL, background: t.card, display: "flex", flexDirection: "column" }}><Stripe h={5} /><div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center" }}>
    {st === 0 && <div style={{ textAlign: "center" }}><Logo s={70} /><div style={{ fontSize: 11, color: "#000", fontWeight: 600, marginTop: 10 }}>مكتب هاني محمد عسيري للاستشارات الهندسية</div><div style={{ fontSize: 20, fontWeight: 800, color: B.blue, marginTop: 6 }}>أهلاً بك في {APP}</div><div style={{ fontSize: 12, color: t.txM, marginTop: 6 }}>أدخل الرقم الوظيفي</div><input value={eid} onChange={e => { setEid(e.target.value.toUpperCase()); setErr(""); }} placeholder="E001" style={{ ...inp, textAlign: "center", letterSpacing: 3, fontSize: 20, marginTop: 16 }} onKeyDown={e => e.key === "Enter" && go()} />{err && <div style={{ color: C.bad, fontSize: 12, marginTop: 8, fontWeight: 600 }}>{err}</div>}<button onClick={go} style={{ ...PB, width: "100%", marginTop: 18 }}>التالي</button><div style={{ fontSize: 12, color: t.txM, marginTop: 14 }}>{new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div><div style={{ fontSize: 9, color: "rgba(0,0,0,.15)", marginTop: 20 }}>{VER}</div></div>}
    {st === 1 && found && <div style={{ textAlign: "center" }}><div style={{ background: t.okLt, borderRadius: 12, padding: 12, marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: C.ok }}>✓ {found.name}</div><div style={{ fontSize: 11, color: t.tx2, marginTop: 2 }}>{found.role} — {BR[found.branch]} — {EMP_TYPES[found.type] || "🏢 مكتبي"}</div></div><div style={{ fontSize: 28 }}>🔑</div><div style={{ fontSize: 12, color: t.txM, marginTop: 6 }}>رمز التفعيل</div><input value={code} onChange={e => { setCode(e.target.value); setErr(""); }} placeholder="6 أرقام" maxLength={6} style={{ ...inp, textAlign: "center", letterSpacing: 6, fontSize: 22, marginTop: 12 }} onKeyDown={e => e.key === "Enter" && doLogin()} />{err && <div style={{ color: C.bad, fontSize: 12, marginTop: 8, fontWeight: 600 }}>{err}</div>}<button onClick={doLogin} style={{ ...PB, width: "100%", marginTop: 18 }}>دخول</button><button onClick={() => { setSt(0); setFound(null); setCode(""); setErr(""); }} style={{ marginTop: 10, background: "none", border: "none", color: t.txM, fontSize: 12, cursor: "pointer" }}>← رجوع</button></div>}
  </div></div>);
}

// ═══════ WIDGET (MAIN CIRCLE) ═══════
function Widget({ emp, onApp }) {
  const { dark: dk, t } = useTheme();
  const now = new Date();
  const [sH, setSH] = useState(now.getHours()), [sM, setSM] = useState(now.getMinutes());
  const [cs, setCs] = useState("idle"), [done, setDone] = useState([]), [cd, setCd] = useState(60), [acp, setAcp] = useState(null);
  const [ch, setCh] = useState(null);
  // Load challenge from server (HR-managed) or fallback to defaults
  useEffect(() => {
    api('settings').then(s => {
      const pool = (s?.questions?.length > 0) ? s.questions : CHALLENGES;
      // Pick based on day of year to avoid repetition within a week
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const picked = pool[dayOfYear % pool.length];
      // Shuffle options but track correct answer
      const correctAns = picked.opts[picked.correct || 0];
      const shuffled = [...picked.opts].sort(() => Math.random() - 0.5);
      setCh({ ...picked, opts: shuffled, correct: shuffled.indexOf(correctAns) });
    });
  }, []);
  const [chDone, setChDone] = useState(false), [sel, setSel] = useState(null);
  const [showFace, setShowFace] = useState(false), [callNotif, setCallNotif] = useState(null);
  const [gpsStatus, setGpsStatus] = useState({ inR: true, d: 0 });
  const [lastCallType, setLastCallType] = useState(null);
  const cdRef = useRef(null), cpTrig = useRef(new Set()), retryRef = useRef(null);
  const level = getLevel(emp.points || 0);
  // Stable per-employee break offset (2-5 min based on employee ID)
  const empHash = emp.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const breakOffsetBefore = (empHash % 4) + 2; // 2-5 minutes before break
  const breakOffsetAfter = ((empHash + 7) % 4) + 2; // 2-5 minutes after break

  // Real time
  useEffect(() => { const t = setInterval(() => { const n = new Date(); setSH(n.getHours()); setSM(n.getMinutes()); }, 30000); return () => clearInterval(t); }, []);

  // Load today's records
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    api('attendance', 'GET', null, `&empId=${emp.id}&date=${today}`).then(recs => {
      if (Array.isArray(recs)) setDone(recs.map(r => r.type));
    });
  }, []);

  // On leave?
  const isLeave = emp.onLeave;
  const dur = sH >= 8 && sH < 17, aft = sH >= 17, bef = sH < 8 || (sH === 8 && sM < 30);
  const mW = dur ? Math.max(0, (sH - 8) * 60 + sM - 30) : aft ? 510 : 0;
  const pct = Math.min(100, Math.max(0, Math.round((mW / 510) * 100)));
  const tStr = `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}`;
  const S = 260, R = 108, cx = 130, cy = 130, RC = 2 * Math.PI * R;

  // Call notification system
  const triggerCall = useCallback((type, title, sub) => {
    if (isLeave) return;
    if (!gpsStatus.inR && type !== "checkin") return; // No call if outside range (except first)
    setLastCallType(type);
    setCallNotif({ type, title, sub });
  }, [isLeave, gpsStatus]);

  // Checkpoint detection
  useEffect(() => {
    if (cs !== "idle" || isLeave) return;
    const cur = sH * 60 + sM;
    // CP1: Start of work (8:30 = 510)
    if (cur >= 510 && cur <= 512 && !cpTrig.current.has(1)) {
      cpTrig.current.add(1);
      triggerCall("checkin", "☀️ وقت الحضور", "سجّل حضورك الآن");
      return;
    }
    // CP2: Before break (12:30 = 750, minus stable offset per employee)
    const breakCallTime = 750 - breakOffsetBefore;
    if (cur >= breakCallTime && cur <= breakCallTime + 2 && !cpTrig.current.has(2)) {
      cpTrig.current.add(2);
      triggerCall("break_s", "☕ وقت الاستراحة", `سجّل قبل الاستراحة (${breakOffsetBefore} دقائق)`);
      return;
    }
    // CP3: After break (13:00 = 780, plus stable offset per employee)
    const returnCallTime = 780 + breakOffsetAfter;
    if (cur >= returnCallTime && cur <= returnCallTime + 2 && !cpTrig.current.has(3)) {
      cpTrig.current.add(3);
      triggerCall("break_e", "🔄 نهاية الاستراحة", `سجّل عودتك (${breakOffsetAfter} دقائق)`);
      return;
    }
    // CP4: End of work (17:00 = 1020) — NO CALL, just countdown on circle
    if (cur >= 1020 && cur <= 1022 && !cpTrig.current.has(4)) {
      cpTrig.current.add(4);
      setAcp({ id: 4, l: "الانصراف", ic: "🌙" });
      setCd(60);
      setCs("countdown");
      cdRef.current = setInterval(() => setCd(p => { if (p <= 1) { clearInterval(cdRef.current); doAutoCheckout(); return 0; } return p - 1; }), 1000);
      // Auto checkout after 5 minutes if no overtime
      setTimeout(doAutoCheckout, 5 * 60 * 1000);
    }
  }, [sH, sM, cs, isLeave]);

  useEffect(() => () => { clearInterval(cdRef.current); clearTimeout(retryRef.current); }, []);

  const doAutoCheckout = async () => {
    if (done.includes("الانصراف")) return;
    if (!emp.flexOT) {
      await api('checkin', 'POST', { empId: emp.id, type: "الانصراف" });
      setDone(p => [...p, "الانصراف"]);
      setCs("done");
      setTimeout(() => setCs("idle"), 2000);
    }
  };

  // Handle call answer → open camera
  const onCallAnswer = () => {
    setCallNotif(null);
    setShowFace(true);
  };

  // Handle call decline → retry after 10 min for first call only
  const onCallDecline = () => {
    const type = lastCallType;
    setCallNotif(null);
    // Only retry for checkin (first call), and only if employee didn't check in yet
    if (type === "checkin" && !cpTrig.current.has("retry")) {
      cpTrig.current.add("retry");
      retryRef.current = setTimeout(() => {
        if (!done.includes("الحضور")) {
          triggerCall("retry", "⚠️ لم تسجّل حضورك", "تنبيه أخير — سجّل الآن");
        }
      }, 10 * 60 * 1000); // 10 minutes
    }
  };

  // Camera done → record checkin to server
  const onFaceDone = async (photo) => {
    setShowFace(false);
    setCs("scan");
    let gps = { lat: 0, lng: 0 };
    try { gps = await getGPS(); } catch {}
    // Determine checkin type based on last call
    let type;
    if (lastCallType === "break_s") type = "الاستراحة";
    else if (lastCallType === "break_e") type = "العودة";
    else if (!done.includes("الحضور")) type = "الحضور";
    else type = "الانصراف";
    await api('checkin', 'POST', { empId: emp.id, type, lat: gps.lat, lng: gps.lng, facePhoto: true });
    setTimeout(() => { setDone(p => [...p, type]); setCs("done"); setTimeout(() => { setCs("idle"); setAcp(null); setLastCallType(null); }, 1800); }, 1500);
  };

  // Demo: advance time
  const advTime = () => { if (cs !== "idle") return; setSM(p => { let n = p + 15; if (n >= 60) { setSH(h => Math.min(h + 1, 18)); return n - 60; } return n; }); };

  const doScan = () => { clearInterval(cdRef.current); setShowFace(true); };
  const pickAns = i => { if (sel !== null) return; setSel(i); setTimeout(() => { if (i === ch.correct) { api('employees', 'PUT', { id: emp.id, points: (emp.points || 0) + 5 }); } setCs(i === ch.correct ? "correct" : "wrong"); setTimeout(() => { setCs("idle"); setSel(null); setChDone(true); }, 2000); }, 700); };

  const outOfRange = !gpsStatus.inR && !gpsStatus.remote && emp.type !== "remote";
  const rCol = outOfRange && cs === "idle" ? C.bad : cs === "countdown" ? B.yellow : cs === "scan" ? B.blue : cs === "done" || cs === "correct" ? C.ok : cs === "challenge" ? B.gold : cs === "wrong" ? C.bad : pct >= 60 ? B.blue : B.yellow;

  // Leave screen
  if (isLeave) return (<div style={{ ...FL, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.tx }}>
    <div style={{ fontSize: 48 }}>🏖</div>
    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 12, color: B.blue }}>أنت في إجازة</div>
    <div style={{ fontSize: 13, color: t.txM, marginTop: 8 }}>استمتع بوقتك!</div>
    <div style={{ marginTop: 20, padding: "8px 20px", borderRadius: 12, background: t.card, border: "1px solid " + t.sep }}><span style={{ fontSize: 12, color: B.blue, fontWeight: 700 }}>باقي: {emp.leaveRemaining || "?"} أيام</span></div>
    <button onClick={onApp} style={{ marginTop: 30, padding: "10px 30px", borderRadius: 14, background: t.card, border: "1px solid " + t.sep, color: B.blue, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>التفاصيل ←</button>
  </div>);

  return (<div style={{ ...FL, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", color: t.tx, position: "relative", overflow: "hidden" }}>
    {showFace && <FaceCamera empId={emp.id} onOk={onFaceDone} onNo={() => { setShowFace(false); setCs("idle"); }} />}
    {callNotif && <CallNotif type={callNotif.type} title={callNotif.title} sub={callNotif.sub} onAnswer={onCallAnswer} onDecline={onCallDecline} />}
    <style>{`@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}} @keyframes spin{to{transform:rotate(360deg)}} button:active{transform:scale(.95)!important}`}</style>

    {/* Top bar */}
    <div style={{ width: "100%", padding: "12px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
      <span style={{ color: t.tx2, fontWeight: 600, fontSize: 13 }}>{tStr}</span>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <span style={{ padding: "2px 6px", borderRadius: 8, background: B.yellow + "15", fontSize: 9, fontWeight: 800, color: B.gold }}>⭐{emp.points || 0}</span>
        {level.badge && <span style={{ fontSize: 12 }}>{level.badge}</span>}
      </div>
    </div>

    <GpsBadge branch={emp.branch} empType={emp.type} empId={emp.id} onStatusChange={s => setGpsStatus(s)} />

    {/* SCE Membership Warning */}
    {(() => { const sce = checkSCE(emp); if (!sce || !sce.alert) return null; return (
      <div style={{ margin: "0 16px 4px", padding: "8px 12px", borderRadius: 12, background: `${sce.color}15`, border: `1px solid ${sce.color}33`, width: "calc(100% - 32px)", zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{sce.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: sce.color }}>عضوية الهيئة السعودية للمهندسين</div>
          <div style={{ fontSize: 9, color: t.tx2 }}>{sce.text}</div>
        </div>
        {sce.status === "expired" && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4, background: C.bad, color: "#fff", fontWeight: 700 }}>⚠️ منتهية</span>}
      </div>
    ); })()}

    {/* Out of range warning with exception request */}
    {!gpsStatus.inR && !gpsStatus.remote && emp.type !== "remote" && cs === "idle" && (
      <div style={{ margin: "0 16px 4px", padding: "10px 14px", borderRadius: 14, background: t.badLt, border: `1px solid ${C.bad}33`, width: "calc(100% - 32px)", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>🚫</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.bad }}>لم تقم بتسجيل الحضور</div>
            <div style={{ fontSize: 10, color: t.tx2, marginTop: 1 }}>خارج منطقة العمل {gpsStatus.d > 0 ? `(${gpsStatus.d}م)` : ""}</div>
          </div>
        </div>
        <button onClick={async () => {
          const reason = prompt("سبب الاستثناء:");
          if (reason) {
            await api('exceptions', 'POST', { empId: emp.id, reason, date: new Date().toISOString().split("T")[0], distance: gpsStatus.d });
            alert("✅ تم إرسال طلب الاستثناء لمدير النظام");
          }
        }} style={{ marginTop: 8, width: "100%", padding: "7px", borderRadius: 10, background: t.card, border: "1px solid " + t.sep, color: C.bad, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📝 طلب استثناء</button>
      </div>
    )}

    {/* Circle */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
      <div style={{ position: "relative", width: S, height: S, cursor: cs === "idle" ? "pointer" : "default" }} onClick={cs === "idle" && ch && !chDone && sH >= 7 && sH < 8 ? () => setCs("challenge") : cs === "idle" ? advTime : cs === "countdown" ? doScan : undefined}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={t.sep} strokeWidth="10" />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={rCol} strokeWidth="10" strokeDasharray={`${(pct / 100) * RC} ${RC}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dasharray .5s" }} />
          {cs === "scan" && <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke={B.yellow} strokeWidth="2" strokeDasharray="40 30" style={{ animation: "spin 1.5s linear infinite", transformOrigin: `${cx}px ${cy}px` }} />}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {cs === "idle" && bef && !outOfRange && <><div style={{ fontSize: 10, color: t.txM }}>قبل الدوام</div><div style={{ fontSize: 38, fontWeight: 800, color: t.tx }}>{8 - sH}<span style={{ fontSize: 14, color: t.txM }}>س</span></div></>}
          {cs === "idle" && dur && !outOfRange && <><div style={{ fontSize: 10, color: t.txM }}>ساعات العمل</div><div style={{ fontSize: 42, fontWeight: 800, color: t.tx }}>{Math.floor(mW / 60)}<span style={{ fontSize: 14, color: t.txM }}>:{String(mW % 60).padStart(2, "0")}</span></div><div style={{ fontSize: 13, fontWeight: 700, color: rCol }}>{pct}%</div></>}
          {cs === "idle" && aft && !outOfRange && <><div style={{ fontSize: 40 }}>✅</div><div style={{ fontSize: 14, fontWeight: 700, color: C.ok, marginTop: 6 }}>اكتمل الدوام</div></>}
          {cs === "idle" && outOfRange && <><div style={{ fontSize: 36 }}>🚫</div><div style={{ fontSize: 12, fontWeight: 700, color: C.bad, marginTop: 6, textAlign: "center", lineHeight: 1.6 }}>لم تقم بتسجيل{"\n"}الحضور</div><div style={{ fontSize: 9, color: t.txM, marginTop: 4 }}>خارج منطقة العمل</div></>}
          {cs === "countdown" && <><div style={{ fontSize: 11, color: B.gold, fontWeight: 700 }}>{acp?.ic} {acp?.l}</div><div style={{ fontSize: 56, fontWeight: 800, color: t.tx, fontVariantNumeric: "tabular-nums" }}>{cd}</div><div style={{ fontSize: 11, color: t.txM }}>اضغط للبصمة</div></>}
          {cs === "scan" && <div style={{ fontSize: 48, animation: "pu 1s ease-in-out infinite" }}>🪪</div>}
          {cs === "done" && <><div style={{ fontSize: 44 }}>✅</div><div style={{ fontSize: 15, fontWeight: 800, color: C.ok, marginTop: 6 }}>تم التسجيل</div></>}
          {cs === "challenge" && ch && <div style={{ padding: "0 20px", textAlign: "center" }}><div style={{ fontSize: 9, color: B.gold, fontWeight: 700 }}>⚡ {ch.type}</div><div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, lineHeight: 1.4, color: t.tx }}>{ch.q}</div></div>}
          {cs === "correct" && <><div style={{ fontSize: 48 }}>🎉</div><div style={{ fontSize: 16, fontWeight: 800, color: C.ok, marginTop: 4 }}>+5 نقاط!</div></>}
          {cs === "wrong" && <><div style={{ fontSize: 40 }}>😅</div><div style={{ fontSize: 13, fontWeight: 700, color: C.bad, marginTop: 4 }}>حاول غداً</div></>}
        </div>
      </div>

      {/* Challenge answers */}
      {cs === "challenge" && ch && <div style={{ display: "flex", gap: 8, marginTop: 12, padding: "0 12px" }}>{ch.opts.map((opt, i) => {
        const ic = sel === i && i === ch.correct, iw = sel === i && i !== ch.correct;
        return <button key={i} onClick={() => pickAns(i)} style={{ flex: 1, padding: "10px 6px", borderRadius: 12, background: ic ? t.okLt : iw ? t.badLt : "#fff", border: `1.5px solid ${ic ? C.ok : iw ? C.bad : t.sep}`, color: ic ? C.ok : iw ? C.bad : t.tx2, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>{opt}</button>;
      })}</div>}

      {(cs === "challenge" || cs === "wrong") && <span onClick={() => { setCs("idle"); setSel(null); setChDone(true); }} style={{ fontSize: 11, color: t.txM, cursor: "pointer", marginTop: 8 }}>تجاوز</span>}

      {/* Checkpoints */}
      {cs === "idle" && <div style={{ display: "flex", gap: 12, marginTop: 14 }}>{CPS.map(cp => { const d = done.includes(cp.l); return (<div key={cp.id} style={{ textAlign: "center" }}><div style={{ width: 30, height: 30, borderRadius: "50%", background: d ? t.okLt : "#fff", border: `2px solid ${d ? C.ok : t.sep}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: d ? 11 : 7, color: d ? C.ok : t.txM, fontWeight: 700 }}>{d ? "✓" : `${cp.h}:${String(cp.m).padStart(2, "0")}`}</div><div style={{ fontSize: 7, color: t.txM, marginTop: 2 }}>{cp.l}</div></div>); })}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}><Logo s={14} /><span style={{ fontSize: 10, fontWeight: 600, color: t.tx2 }}>{emp.name?.split(" ").slice(0, 2).join(" ")}</span></div>
    </div>

    <div style={{ padding: "8px 20px 20px", width: "100%", zIndex: 1 }}>
      <button onClick={onApp} style={{ width: "100%", padding: "11px", borderRadius: 14, background: t.card, border: "1px solid " + t.sep, color: B.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{emp.isManager || emp.isAssistant ? "التفاصيل والإدارة ←" : "التفاصيل والمحفظة ←"}</button>
      {cs === "idle" && <div style={{ textAlign: "center", marginTop: 3, fontSize: 7, color: t.txM }}>اضغط الدائرة لتقديم الوقت (تجريبي)</div>}
    </div>
  </div>);
}

// ═══════ FULL APP ═══════
function FullApp({ emp, onBack, onLogout }) {
  const { dark: dk, t, toggle: toggleTheme } = useTheme();
  const crd = getCrd(t);
  const isHR = emp.isManager || emp.isAssistant;
  const [tab, setTab] = useState(isHR ? "admin" : "wallet");
  const [emps, setEmps] = useState([]);
  const [att, setAtt] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [projects, setProjects] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddDeleg, setShowAddDeleg] = useState(false);
  const [newProj, setNewProj] = useState({ name: "", lat: "", lng: "", radius: 150, employees: [] });
  const [newDeleg, setNewDeleg] = useState({ empId: "", reason: "", from: "", to: "" });
  const level = getLevel(emp.points || 0);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    const e = await api('employees'); if (Array.isArray(e)) setEmps(e);
    const a = await api('attendance', 'GET', null, `&date=${today}`); if (Array.isArray(a)) setAtt(a);
    const l = await api('leaves'); if (Array.isArray(l)) setLeaves(l);
    const p = await api('projects'); if (Array.isArray(p)) setProjects(p);
    const d = await api('delegations'); if (Array.isArray(d)) setDelegations(d);
    const ex = await api('exceptions'); if (Array.isArray(ex)) setExceptions(ex);
  };

  const approveLeave = async (id) => { await api('leaves', 'PUT', { id, status: 'approved' }); loadData(); };
  const rejectLeave = async (id) => { await api('leaves', 'PUT', { id, status: 'rejected' }); loadData(); };
  const approveDeleg = async (id) => { await api('delegations', 'PUT', { id, status: 'approved' }); loadData(); };
  const rejectDeleg = async (id) => { await api('delegations', 'PUT', { id, status: 'rejected' }); loadData(); };
  const approveExc = async (id) => { await api('exceptions', 'PUT', { id, status: 'approved' }); loadData(); };
  const rejectExc = async (id) => { await api('exceptions', 'PUT', { id, status: 'rejected' }); loadData(); };

  const addProject = async () => {
    if (!newProj.name || !newProj.lat || !newProj.lng) return alert("أدخل اسم المشروع والموقع");
    await api('projects', 'POST', { ...newProj, lat: parseFloat(newProj.lat), lng: parseFloat(newProj.lng), radius: parseInt(newProj.radius), active: true });
    setNewProj({ name: "", lat: "", lng: "", radius: 150, employees: [] });
    setShowAddProject(false);
    loadData();
  };

  const addDelegation = async () => {
    if (!newDeleg.empId || !newDeleg.reason || !newDeleg.from) return alert("أكمل البيانات");
    const empName = emps.find(e => e.id === newDeleg.empId)?.name || newDeleg.empId;
    await api('delegations', 'POST', { ...newDeleg, empName, managerId: emp.id, managerName: emp.name });
    setNewDeleg({ empId: "", reason: "", from: "", to: "" });
    setShowAddDeleg(false);
    loadData();
  };

  const toggleProjectEmp = (projId, empId) => {
    const p = projects.find(x => x.id === projId);
    if (!p) return;
    const emps = p.employees || [];
    const updated = emps.includes(empId) ? emps.filter(e => e !== empId) : [...emps, empId];
    api('projects', 'PUT', { id: projId, employees: updated }).then(loadData);
  };

  const [events, setEvents] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: "", emoji: "🎉", date: "", bg: "#006C35", giftElite: false, giftDuration: 24, notify: true });

  // Load events
  useEffect(() => { api('events').then(e => { if (Array.isArray(e)) setEvents(e); }); }, []);

  // Pre-built events
  const PRESET_EVENTS = [
    { name: "اليوم الوطني", emoji: "🇸🇦", date: "09-23", bg: "#006C35" },
    { name: "يوم التأسيس", emoji: "🏰", date: "02-22", bg: "#4A1A6B" },
    { name: "رمضان", emoji: "🌙", date: "03-01", bg: "#1A3A2A" },
    { name: "عيد الفطر", emoji: "🎉", date: "04-01", bg: "#B8860B" },
    { name: "عيد الأضحى", emoji: "🐑", date: "06-07", bg: "#8B4513" },
    { name: "عيد الأم", emoji: "💐", date: "03-21", bg: "#C71585" },
    { name: "يوم العلم", emoji: "🏳️", date: "03-11", bg: "#006C35" },
  ];

  const addEvent = async () => {
    if (!newEvent.name || !newEvent.date) return alert("أدخل الاسم والتاريخ");
    await api('events', 'POST', newEvent);
    setNewEvent({ name: "", emoji: "🎉", date: "", bg: "#006C35", giftElite: false, giftDuration: 24, notify: true });
    setShowAddEvent(false);
    const e = await api('events'); if (Array.isArray(e)) setEvents(e);
  };

  const deleteEvent = async (id) => {
    if (!confirm("حذف هذه المناسبة؟")) return;
    await api('events', 'DELETE', null, `&id=${id}`);
    const e = await api('events'); if (Array.isArray(e)) setEvents(e);
  };

  // Check birthdays and anniversaries for temporary elite
  const checkBirthdayElite = () => {
    const todayMD = today.slice(5); // "MM-DD"
    const empData = emps.find(e => e.id === emp.id);
    if (!empData) return null;
    // Employee birthday → 48 hours elite
    if (empData.dob && empData.dob.slice(5) === todayMD) return { type: "birthday", badge: "🎂", text: "عيد ميلاد سعيد! عضوية نخبة لمدة 48 ساعة", duration: 48 };
    // Join anniversary → 1 day
    if (empData.joinDate && empData.joinDate.slice(5) === todayMD) return { type: "anniversary", badge: "🎉", text: "ذكرى التحاقك! عضوية نخبة ليوم واحد", duration: 24 };
    // Active event with gift
    const activeEvent = events.find(ev => ev.date && ev.date.slice(5) === todayMD && ev.giftElite);
    if (activeEvent) return { type: "event", badge: activeEvent.emoji, text: `${activeEvent.name}! عضوية نخبة مؤقتة`, duration: activeEvent.giftDuration || 24 };
    return null;
  };
  const birthdayGift = checkBirthdayElite();

  // Leave balance
  const [leaveBalance] = useState({ annual: 30, used: 8, sick: 3, unpaid: 1, remaining: 18 });
  const [showLeaveReq, setShowLeaveReq] = useState(false);
  const [newLeave, setNewLeave] = useState({ type: "سنوية", from: "", to: "", reason: "" });
  const [questions, setQuestions] = useState([]);
  const [showAddQ, setShowAddQ] = useState(false);
  const [newQ, setNewQ] = useState({ q: "", opts: ["", "", ""], correct: 0, type: "سؤال" });

  useEffect(() => { api('settings').then(s => { if (s?.questions) setQuestions(s.questions); }); }, []);

  const submitLeave = async () => {
    if (!newLeave.from) return alert("حدد تاريخ البداية");
    const from = new Date(newLeave.from), to = newLeave.to ? new Date(newLeave.to) : from;
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    await api('leaves', 'POST', { empId: emp.id, empName: emp.name, ...newLeave, days });
    setNewLeave({ type: "سنوية", from: "", to: "", reason: "" });
    setShowLeaveReq(false);
    loadData();
    alert("✅ تم إرسال طلب الإجازة");
  };

  const addQuestion = async () => {
    if (!newQ.q || !newQ.opts[0] || !newQ.opts[1] || !newQ.opts[2]) return alert("أكمل السؤال والإجابات");
    const updated = [...questions, { id: Date.now(), ...newQ }];
    setQuestions(updated);
    await api('settings', 'PUT', { questions: updated });
    setNewQ({ q: "", opts: ["", "", ""], correct: 0, type: "سؤال" });
    setShowAddQ(false);
  };

  const deleteQuestion = async (id) => {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    await api('settings', 'PUT', { questions: updated });
  };

  const tabs = isHR
    ? [{ id: "admin", i: "🏢", l: "الإدارة" }, { id: "projects", i: "🏗️", l: "المشاريع" }, { id: "events", i: "🎉", l: "المناسبات" }, { id: "questions", i: "⚡", l: "الأسئلة" }, { id: "leaves_tab", i: "🏖", l: "الإجازات" }, { id: "wallet", i: "🎁", l: "المحفظة" }, { id: "profile", i: "👤", l: "حسابي" }]
    : [{ id: "leaves_tab", i: "🏖", l: "الإجازات" }, { id: "wallet", i: "🎁", l: "المحفظة" }, { id: "membership", i: "🏅", l: "العضوية" }, { id: "attendance", i: "📊", l: "الحضور" }, { id: "profile", i: "👤", l: "حسابي" }];

  return (<div style={{ ...FL, background: t.bg, display: "flex", flexDirection: "column" }}>
    <Stripe h={4} />
    <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: t.card, borderBottom: "1px solid " + t.sep }}>
      <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>→</button>
      <Logo s={22} />
      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.tx }}>{emp.name}</div>
      {level.badge && <span style={{ fontSize: 12 }}>{level.badge}</span>}
    </div>

    <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 90px" }}>

      {/* ADMIN TAB */}
      {tab === "admin" && <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[{ l: "الموظفين", v: emps.length, c: B.blue, i: "👥" }, { l: "حاضر اليوم", v: [...new Set(att.map(r => r.empId))].length, c: C.ok, i: "✅" }, { l: "إجازات معلّقة", v: leaves.filter(l => l.status === "pending").length, c: C.warn, i: "📋" }, { l: "بصمات اليوم", v: att.length, c: B.blueDk, i: "📊" }].map((s, i) => (
            <div key={i} style={{ background: t.card, borderRadius: 14, padding: 12, border: "1px solid " + t.sep, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.c + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.i}</div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div><div style={{ fontSize: 9, color: t.txM }}>{s.l}</div></div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>👥 الموظفين</div>
        {emps.map(e => (
          <div key={e.id} style={{ ...crd, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: t.okLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 9, color: t.txM }}>{e.role} · {EMP_TYPES[e.type] || "🏢"} · {e.id}</div></div>
            <span style={{ fontSize: 10, fontWeight: 800, color: getLevel(e.points || 0).color }}>{getLevel(e.points || 0).badge}</span>
          </div>
        ))}
        {leaves.filter(l => l.status === "pending").length > 0 && <>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 8 }}>📋 طلبات الإجازات</div>
          {leaves.filter(l => l.status === "pending").map(l => (
            <div key={l.id} style={{ ...crd, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{l.empName || l.empId}</div><div style={{ fontSize: 10, color: t.tx2 }}>{l.type} · {l.from} → {l.to}</div></div>
                <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: t.warnLt, color: C.warn }}>معلّق</span>
              </div>
              {emp.isManager && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => approveLeave(l.id)} style={{ flex: 1, padding: 8, borderRadius: 8, background: C.ok, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>اعتماد ✓</button>
                <button onClick={() => rejectLeave(l.id)} style={{ flex: 1, padding: 8, borderRadius: 8, background: C.bad, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>رفض ✕</button>
              </div>}
            </div>
          ))}
        </>}

        {/* DELEGATIONS - طلبات الانتداب */}
        {delegations.filter(d => d.status === "pending").length > 0 && <>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 8 }}>🚗 طلبات الانتداب</div>
          {delegations.filter(d => d.status === "pending").map(d => (
            <div key={d.id} style={{ ...crd, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{d.empName || d.empId}</div><div style={{ fontSize: 10, color: t.tx2 }}>{d.reason}</div><div style={{ fontSize: 9, color: t.txM }}>{d.from} → {d.to || "يوم واحد"} · طلب من: {d.managerName}</div></div>
                <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: t.warnLt, color: C.warn, height: "fit-content" }}>معلّق</span>
              </div>
              {emp.isManager && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => approveDeleg(d.id)} style={{ flex: 1, padding: 8, borderRadius: 8, background: C.ok, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>اعتماد ✓</button>
                <button onClick={() => rejectDeleg(d.id)} style={{ flex: 1, padding: 8, borderRadius: 8, background: C.bad, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>رفض ✕</button>
              </div>}
            </div>
          ))}
        </>}

        {/* EXCEPTIONS - طلبات الاستثناء */}
        {exceptions.filter(e => e.status === "pending").length > 0 && <>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 8 }}>📝 طلبات الاستثناء</div>
          {exceptions.filter(e => e.status === "pending").map(e => (
            <div key={e.id} style={{ ...crd, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{e.empId}</div><div style={{ fontSize: 10, color: t.tx2 }}>{e.reason}</div><div style={{ fontSize: 9, color: t.txM }}>{e.date} · المسافة: {e.distance}م</div></div>
                <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: t.warnLt, color: C.warn, height: "fit-content" }}>معلّق</span>
              </div>
              {emp.isManager && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => approveExc(e.id)} style={{ flex: 1, padding: 8, borderRadius: 8, background: C.ok, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>قبول ✓</button>
                <button onClick={() => rejectExc(e.id)} style={{ flex: 1, padding: 8, borderRadius: 8, background: C.bad, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>رفض ✕</button>
              </div>}
            </div>
          ))}
        </>}

        {/* Add delegation button for managers */}
        {emp.isManager && !showAddDeleg && <button onClick={() => setShowAddDeleg(true)} style={{ ...PB, width: "100%", marginTop: 14, background: B.blueDk }}>🚗 طلب انتداب لموظف</button>}
        {showAddDeleg && <div style={{ ...crd, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 10 }}>🚗 طلب انتداب جديد</div>
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>الموظف</label>
          <select value={newDeleg.empId} onChange={e => setNewDeleg(p => ({ ...p, empId: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }}>
            <option value="">اختر الموظف</option>
            {emps.filter(e => e.id !== emp.id).map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
          </select>
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>السبب</label>
          <input value={newDeleg.reason} onChange={e => setNewDeleg(p => ({ ...p, reason: e.target.value }))} placeholder="سبب الانتداب" style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>من تاريخ</label>
          <input type="date" value={newDeleg.from} onChange={e => setNewDeleg(p => ({ ...p, from: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>إلى تاريخ (اختياري)</label>
          <input type="date" value={newDeleg.to} onChange={e => setNewDeleg(p => ({ ...p, to: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addDelegation} style={{ ...PB, flex: 1, padding: 10 }}>إرسال</button>
            <button onClick={() => setShowAddDeleg(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>}
      </div>}

      {/* PROJECTS TAB */}
      {tab === "projects" && <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🏗️ المشاريع الميدانية</div>
          {emp.isManager && <button onClick={() => setShowAddProject(true)} style={{ padding: "6px 14px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ مشروع</button>}
        </div>

        {/* Add project form */}
        {showAddProject && <div style={{ ...crd, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 10 }}>مشروع جديد</div>
          <input value={newProj.name} onChange={e => setNewProj(p => ({ ...p, name: e.target.value }))} placeholder="اسم المشروع" style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={newProj.lat} onChange={e => setNewProj(p => ({ ...p, lat: e.target.value }))} placeholder="خط العرض (Lat)" style={{ ...inp, fontSize: 12, flex: 1 }} />
            <input value={newProj.lng} onChange={e => setNewProj(p => ({ ...p, lng: e.target.value }))} placeholder="خط الطول (Lng)" style={{ ...inp, fontSize: 12, flex: 1 }} />
          </div>
          <label style={{ fontSize: 11, color: t.tx2 }}>النطاق: {newProj.radius}م</label>
          <input type="range" min="50" max="900" value={newProj.radius} onChange={e => setNewProj(p => ({ ...p, radius: e.target.value }))} style={{ width: "100%", marginBottom: 8 }} />
          <div style={{ fontSize: 10, color: t.txM, marginBottom: 6 }}>💡 افتح Google Maps ← اضغط على الموقع ← انسخ الإحداثيات</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addProject} style={{ ...PB, flex: 1, padding: 10 }}>حفظ</button>
            <button onClick={() => setShowAddProject(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>}

        {/* Projects list */}
        {projects.length === 0 && !showAddProject && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 12 }}>لا توجد مشاريع ميدانية</div>}
        {projects.map(p => (
          <div key={p.id} style={{ ...crd, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>📍 {p.name}</div>
                <div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>النطاق: {p.radius}م · الموقع: {p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</div>
              </div>
              <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: p.active !== false ? t.okLt : t.badLt, color: p.active !== false ? C.ok : C.bad }}>{p.active !== false ? "نشط" : "متوقف"}</span>
            </div>
            {/* Assigned employees */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.tx2, marginBottom: 4 }}>المهندسين المعيّنين ({(p.employees || []).length}):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {emps.filter(e => e.type === "field" || e.type === "mixed").map(e => {
                  const assigned = (p.employees || []).includes(e.id);
                  return <button key={e.id} onClick={() => emp.isManager && toggleProjectEmp(p.id, e.id)} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, border: `1px solid ${assigned ? C.ok : t.sep}`, background: assigned ? t.okLt : "#F2F2F7", color: assigned ? C.ok : t.txM, cursor: emp.isManager ? "pointer" : "default" }}>{assigned ? "✓ " : ""}{e.name?.split(" ")[0]}</button>;
                })}
              </div>
              {emps.filter(e => e.type === "field" || e.type === "mixed").length === 0 && <div style={{ fontSize: 10, color: t.txM }}>لا يوجد موظفين ميدانيين أو مختلطين</div>}
            </div>
          </div>
        ))}
      </div>}

      {/* EVENTS TAB */}
      {tab === "events" && <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🎉 المناسبات</div>
          {emp.isManager && <button onClick={() => setShowAddEvent(true)} style={{ padding: "6px 14px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ مناسبة</button>}
        </div>

        {/* Quick add from presets */}
        {showAddEvent && <div style={{ ...crd, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 10 }}>مناسبة جديدة</div>
          
          {/* Preset buttons */}
          <div style={{ fontSize: 10, color: t.tx2, marginBottom: 6 }}>اختر جاهزة:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {PRESET_EVENTS.map((pe, i) => (
              <button key={i} onClick={() => setNewEvent(p => ({ ...p, name: pe.name, emoji: pe.emoji, bg: pe.bg }))} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, border: "1px solid " + t.sep, background: newEvent.name === pe.name ? B.blue : "#fff", color: newEvent.name === pe.name ? "#fff" : t.tx2, cursor: "pointer" }}>{pe.emoji} {pe.name}</button>
            ))}
          </div>

          <input value={newEvent.name} onChange={e => setNewEvent(p => ({ ...p, name: e.target.value }))} placeholder="اسم المناسبة" style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={newEvent.emoji} onChange={e => setNewEvent(p => ({ ...p, emoji: e.target.value }))} placeholder="الإيموجي" style={{ ...inp, fontSize: 20, width: 60, textAlign: "center" }} />
            <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} style={{ ...inp, fontSize: 13, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: t.tx2 }}>لون الخلفية</label>
              <input type="color" value={newEvent.bg} onChange={e => setNewEvent(p => ({ ...p, bg: e.target.value }))} style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid " + t.sep, cursor: "pointer" }} />
            </div>
          </div>
          
          {/* Gift elite toggle */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", marginBottom: 6 }}>
            <div><div style={{ fontSize: 12, fontWeight: 600 }}>💎 هدية عضوية نخبة</div><div style={{ fontSize: 9, color: t.txM }}>ترقية مؤقتة لكل الموظفين</div></div>
            <button onClick={() => setNewEvent(p => ({ ...p, giftElite: !p.giftElite }))} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: newEvent.giftElite ? C.ok : "#E0E4EC", position: "relative" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.card, position: "absolute", top: 3, transition: "all .3s", ...(newEvent.giftElite ? { left: 22 } : { left: 3 }), boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
            </button>
          </div>
          {newEvent.giftElite && <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: t.tx2 }}>المدة (ساعات)</label>
            <select value={newEvent.giftDuration} onChange={e => setNewEvent(p => ({ ...p, giftDuration: parseInt(e.target.value) }))} style={{ ...inp, fontSize: 13 }}>
              <option value={12}>12 ساعة</option>
              <option value={24}>24 ساعة (يوم)</option>
              <option value={48}>48 ساعة (يومين)</option>
              <option value={72}>72 ساعة (3 أيام)</option>
            </select>
          </div>}

          {/* Preview */}
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 10, border: "1px solid " + t.sep }}>
            <div style={{ background: newEvent.bg, padding: "20px 16px", textAlign: "center", position: "relative", overflow: "hidden", minHeight: 80 }}>
              <div style={{ fontSize: 32 }}>{newEvent.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 4 }}>{newEvent.name || "اسم المناسبة"}</div>
              {newEvent.giftElite && <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", marginTop: 4 }}>💎 عضوية نخبة لمدة {newEvent.giftDuration}س</div>}
            </div>
            <div style={{ padding: "6px 12px", background: t.card, textAlign: "center" }}>
              <span style={{ fontSize: 9, color: t.txM }}>معاينة على شاشة الموظف</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addEvent} style={{ ...PB, flex: 1, padding: 10 }}>حفظ</button>
            <button onClick={() => setShowAddEvent(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>}

        {/* Events list */}
        {events.length === 0 && !showAddEvent && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 12 }}>لا توجد مناسبات مسجّلة</div>}
        {events.map(ev => (
          <div key={ev.id} style={{ ...crd, marginBottom: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: ev.bg || B.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{ev.emoji}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{ev.name}</div>
                  <div style={{ fontSize: 10, color: t.txM }}>{ev.date}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {ev.giftElite && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: B.diamond + "15", color: B.diamond, fontWeight: 600 }}>💎 {ev.giftDuration}س</span>}
                {emp.isManager && <button onClick={() => deleteEvent(ev.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.bad }}>🗑</button>}
              </div>
            </div>
          </div>
        ))}

        {/* Auto birthdays section */}
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 8 }}>🎂 أعياد الميلاد التلقائية</div>
        <div style={{ ...crd }}>
          <div style={{ fontSize: 11, color: t.tx2, lineHeight: 1.8 }}>
            🎂 عيد ميلاد الموظف → نخبة 💎 لمدة <b>48 ساعة</b>{"\n"}
            🎈 عيد ميلاد الأولاد → نخبة 💎 لمدة <b>يوم واحد</b>{"\n"}
            🎉 ذكرى الالتحاق → نخبة 💎 لمدة <b>يوم واحد</b>
          </div>
          <div style={{ fontSize: 9, color: t.txM, marginTop: 6 }}>تعمل تلقائياً بناءً على تاريخ الميلاد وتاريخ الالتحاق في ملف الموظف</div>
        </div>
      </div>}

      {/* LEAVES TAB */}
      {tab === "leaves_tab" && <div>
        {/* Balance card */}
        <div style={{ background: `linear-gradient(135deg, ${B.blue}, ${B.blueDk})`, borderRadius: 18, padding: 20, marginBottom: 12, color: "#fff" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>الرصيد المتبقي</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: B.yellow }}>{leaveBalance.remaining}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>يوم من {leaveBalance.annual}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.15)", marginTop: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(leaveBalance.used / leaveBalance.annual) * 100}%`, borderRadius: 3, background: B.yellow }} />
          </div>
        </div>

        {/* Balance breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[{ l: "سنوية مستخدمة", v: leaveBalance.used, c: B.blue }, { l: "مرضية", v: leaveBalance.sick, c: C.warn }, { l: "بدون راتب", v: leaveBalance.unpaid, c: C.bad }].map((x, i) => (
            <div key={i} style={{ ...crd, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: x.c }}>{x.v}</div>
              <div style={{ fontSize: 9, color: t.txM, marginTop: 2 }}>{x.l}</div>
            </div>
          ))}
        </div>

        {/* Request leave button */}
        {!showLeaveReq && <button onClick={() => setShowLeaveReq(true)} style={{ ...PB, width: "100%", marginBottom: 12 }}>🏖 طلب إجازة</button>}

        {/* Leave request form */}
        {showLeaveReq && <div style={{ ...crd, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 10 }}>🏖 طلب إجازة جديد</div>
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>النوع</label>
          <select value={newLeave.type} onChange={e => setNewLeave(p => ({ ...p, type: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }}>
            <option value="سنوية">سنوية</option>
            <option value="مرضية">مرضية</option>
            <option value="بدون راتب">بدون راتب</option>
            <option value="طارئة">طارئة</option>
          </select>
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>من تاريخ</label>
          <input type="date" value={newLeave.from} onChange={e => setNewLeave(p => ({ ...p, from: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>إلى تاريخ</label>
          <input type="date" value={newLeave.to} onChange={e => setNewLeave(p => ({ ...p, to: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>السبب (اختياري)</label>
          <textarea value={newLeave.reason} onChange={e => setNewLeave(p => ({ ...p, reason: e.target.value }))} rows={2} placeholder="السبب..." style={{ ...inp, fontSize: 12, resize: "none", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitLeave} style={{ ...PB, flex: 1, padding: 10 }}>إرسال الطلب</button>
            <button onClick={() => setShowLeaveReq(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>}

        {/* My leave requests */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📋 طلباتي</div>
        {leaves.filter(l => l.empId === emp.id).length === 0 && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 11 }}>لا توجد طلبات إجازة</div>}
        {leaves.filter(l => l.empId === emp.id).map(l => {
          const sc = l.status === "approved" ? C.ok : l.status === "rejected" ? C.bad : C.warn;
          const sl = l.status === "approved" ? "معتمد" : l.status === "rejected" ? "مرفوض" : "معلّق";
          return (
            <div key={l.id} style={{ ...crd, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{l.type} — {l.days || 1} يوم</div>
                  <div style={{ fontSize: 10, color: t.txM }}>{l.from} {l.to ? `→ ${l.to}` : ""}</div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: sc + "15", color: sc }}>{sl}</span>
              </div>
              {l.reason && <div style={{ fontSize: 10, color: t.tx2, marginTop: 4 }}>{l.reason}</div>}
            </div>
          );
        })}

        {/* Leave rules info */}
        <div style={{ ...crd, marginTop: 10, background: B.blueLt }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.blue }}>📌 نظام الإجازات</div>
          <div style={{ fontSize: 9, color: B.blueDk, lineHeight: 2, marginTop: 4 }}>
            • الإجازة السنوية: 30 يوم{"\n"}
            • مرضية: 30 يوم (100%) ← 60 يوم (75%) ← 30 يوم (0%){"\n"}
            • الطلب يحتاج اعتماد مدير النظام{"\n"}
            • الإجازة الطارئة تُخصم من الرصيد السنوي
          </div>
        </div>
      </div>}

      {/* QUESTIONS TAB - HR Only */}
      {tab === "questions" && <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div><div style={{ fontSize: 14, fontWeight: 700 }}>⚡ أسئلة تحدي الصباح</div><div style={{ fontSize: 10, color: t.txM, marginTop: 2 }}>يختارها HR لضمان عدم التكرار</div></div>
          <button onClick={() => setShowAddQ(true)} style={{ padding: "6px 14px", borderRadius: 10, background: B.blue, color: "#fff", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>+ سؤال</button>
        </div>

        {/* Add question form */}
        {showAddQ && <div style={{ ...crd, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 10 }}>سؤال جديد</div>
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>التصنيف</label>
          <select value={newQ.type} onChange={e => setNewQ(p => ({ ...p, type: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 8 }}>
            {["ذكر", "هندسي", "لغز", "سؤال", "معلومة"].map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>السؤال</label>
          <input value={newQ.q} onChange={e => setNewQ(p => ({ ...p, q: e.target.value }))} placeholder="اكتب السؤال..." style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>الإجابة 1 (الصحيحة ✓)</label>
          <input value={newQ.opts[0]} onChange={e => { const o = [...newQ.opts]; o[0] = e.target.value; setNewQ(p => ({ ...p, opts: o })); }} placeholder="الإجابة الصحيحة" style={{ ...inp, fontSize: 13, marginBottom: 6, borderColor: C.ok }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>الإجابة 2</label>
          <input value={newQ.opts[1]} onChange={e => { const o = [...newQ.opts]; o[1] = e.target.value; setNewQ(p => ({ ...p, opts: o })); }} placeholder="إجابة خاطئة" style={{ ...inp, fontSize: 13, marginBottom: 6 }} />
          <label style={{ fontSize: 11, color: t.tx2, display: "block", marginBottom: 3 }}>الإجابة 3</label>
          <input value={newQ.opts[2]} onChange={e => { const o = [...newQ.opts]; o[2] = e.target.value; setNewQ(p => ({ ...p, opts: o })); }} placeholder="إجابة خاطئة" style={{ ...inp, fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addQuestion} style={{ ...PB, flex: 1, padding: 10 }}>حفظ</button>
            <button onClick={() => setShowAddQ(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>}

        {/* Questions list */}
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>الأسئلة المسجّلة ({questions.length})</div>
        {questions.length === 0 && !showAddQ && <div style={{ ...crd, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: t.txM }}>لا توجد أسئلة مخصصة</div>
          <div style={{ fontSize: 9, color: t.txM, marginTop: 4 }}>سيتم استخدام الأسئلة الافتراضية</div>
        </div>}
        {questions.map((q, i) => (
          <div key={q.id || i} style={{ ...crd, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, background: B.gold + "15", color: B.gold }}>{q.type}</span>
                  <span style={{ fontSize: 9, color: t.txM }}>#{i + 1}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{q.q}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {q.opts.map((o, j) => (
                    <span key={j} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: j === 0 ? t.okLt : "#F2F2F7", color: j === 0 ? C.ok : t.txM, border: `1px solid ${j === 0 ? C.ok + "33" : t.sep}` }}>{j === 0 ? "✓ " : ""}{o}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => deleteQuestion(q.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.bad, marginRight: -4 }}>🗑</button>
            </div>
          </div>
        ))}

        {/* Default questions info */}
        <div style={{ ...crd, marginTop: 10, background: B.blueLt }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.blue }}>📌 ملاحظة</div>
          <div style={{ fontSize: 9, color: B.blueDk, lineHeight: 2, marginTop: 4 }}>
            • الإجابة الأولى دائماً هي الصحيحة (تُخلط تلقائياً عند العرض){"\n"}
            • إذا لم تُضف أسئلة، تُستخدم الأسئلة الافتراضية{"\n"}
            • كل يوم يظهر سؤال مختلف — لا تكرار خلال الأسبوع{"\n"}
            • الإجابة الصحيحة = +5 نقاط
          </div>
        </div>
      </div>}

      {/* WALLET */}
      {tab === "wallet" && <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🎁 المحفظة</div>
        {COUPONS.map(c => (
          <div key={c.id} style={{ ...crd, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{c.brand}</div><div style={{ fontSize: 10, color: C.ok }}>{c.discount}</div></div>
            <span style={{ padding: "4px 8px", borderRadius: 8, background: (emp.points || 0) >= c.pts ? B.blue : "#EEF", color: (emp.points || 0) >= c.pts ? "#fff" : t.txM, fontSize: 10, fontWeight: 700 }}>⭐{c.pts}</span>
          </div>
        ))}
      </div>}

      {/* MEMBERSHIP */}
      {tab === "membership" && <div>
        {/* Birthday/Event gift banner */}
        {birthdayGift && <div style={{ background: `linear-gradient(135deg, ${B.diamond}15, ${B.gold}15)`, borderRadius: 18, padding: 16, border: `2px solid ${B.diamond}33`, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>{birthdayGift.badge}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: B.diamond, marginTop: 6 }}>{birthdayGift.text}</div>
          <div style={{ fontSize: 10, color: t.txM, marginTop: 4 }}>عضوية مؤقتة تنتهي خلال {birthdayGift.duration} ساعة</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 14px", borderRadius: 14, background: B.diamond + "15", marginTop: 8, fontSize: 12, fontWeight: 700, color: B.diamond }}>💎 عضوية نخبة مؤقتة</div>
        </div>}

        <div style={{ background: (birthdayGift ? B.diamond : level.color) + "08", borderRadius: 18, padding: 22, border: `2px solid ${(birthdayGift ? B.diamond : level.color)}33`, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>{birthdayGift ? "💎" : level.badge}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: birthdayGift ? B.diamond : level.color, marginTop: 6 }}>{birthdayGift ? "عضوية نخبة" : level.name}</div>
          <div style={{ fontSize: 12, color: t.txM, marginTop: 4 }}>{emp.points || 0} نقطة</div>
          {birthdayGift && <div style={{ fontSize: 9, color: B.diamond, marginTop: 4 }}>{birthdayGift.badge} ترقية مؤقتة — {birthdayGift.type === "birthday" ? "عيد ميلاد" : birthdayGift.type === "anniversary" ? "ذكرى التحاق" : "مناسبة"}</div>}
        </div>
        <div style={{ background: B.blueLt, borderRadius: 12, padding: 12, marginBottom: 14, border: `1px solid ${B.blue}22` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.blue }}>📌 تنويه</div>
          <div style={{ fontSize: 10, color: B.blueDk, lineHeight: 1.8 }}>هذه العضوية مقياس للانضباط وليست مقياساً للأداء الوظيفي السنوي</div>
        </div>
        {LEVELS.map((l, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < LEVELS.length - 1 ? "1px solid " + t.sep : "none", opacity: i > LEVELS.indexOf(level) ? .4 : 1 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: t.bg, border: l === level ? "2px solid " + l.color : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{l.badge}</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: l === level ? l.color : t.tx }}>{l.name} {l === level && "← أنت"}</div><div style={{ fontSize: 9, color: t.txM }}>{l.min > 0 ? `${l.min}+ نقطة` : "الأساسي"}</div></div></div>))}
      </div>}

      {/* ATTENDANCE */}
      {tab === "attendance" && <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📊 سجل الحضور</div>

        {/* My attendance today - for all users */}
        <div style={{ fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 6 }}>بصماتي اليوم:</div>
        {att.filter(r => r.empId === emp.id).length === 0 && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 12, marginBottom: 10 }}>لا توجد بصمات اليوم</div>}
        {att.filter(r => r.empId === emp.id).map((r, i) => (
          <div key={i} style={{ ...crd, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: t.okLt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{r.type}</div><div style={{ fontSize: 10, color: t.txM }}>{new Date(r.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</div></div>
            {r.manual && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: t.warnLt, color: C.warn, fontWeight: 600 }}>يدوي</span>}
          </div>
        ))}

        {/* MANUAL ATTENDANCE - Admin only */}
        {emp.isManager && <>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>✋ التحضير اليدوي</div>
          <div style={{ fontSize: 10, color: t.txM, marginBottom: 8 }}>مدير النظام فقط — سجّل حضور الموظفين يدوياً</div>
          <div style={{ ...crd }}>
            {emps.map(e => {
              const hasAtt = att.some(r => r.empId === e.id);
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid " + t.sep }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div>
                    <div style={{ fontSize: 9, color: t.txM }}>{e.id} · {EMP_TYPES[e.type] || "🏢"}</div>
                  </div>
                  {hasAtt ? (
                    <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: t.okLt, color: C.ok }}>✅ حاضر</span>
                  ) : (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={async () => { await api('manual_checkin', 'POST', { empId: e.id, type: "حضور يدوي", date: today, adminId: emp.id }); loadData(); }} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, background: C.ok, color: "#fff", border: "none", cursor: "pointer" }}>✅ حاضر</button>
                      <button onClick={async () => { await api('manual_checkin', 'POST', { empId: e.id, type: "متأخر (يدوي)", date: today, adminId: emp.id }); loadData(); }} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, background: C.warn, color: "#fff", border: "none", cursor: "pointer" }}>⏰ متأخر</button>
                      <button onClick={async () => { await api('manual_checkin', 'POST', { empId: e.id, type: "غائب (يدوي)", date: today, adminId: emp.id }); loadData(); }} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700, background: C.bad, color: "#fff", border: "none", cursor: "pointer" }}>❌ غائب</button>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 8, padding: "8px", borderRadius: 8, background: t.bg, textAlign: "center" }}>
              <span style={{ fontSize: 9, color: t.txM }}>✋ تم التحضير يدوياً بواسطة: {emp.name} — {new Date().toLocaleString("ar-SA")}</span>
            </div>
          </div>

          {/* EXPORT REPORTS - Admin only */}
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>📄 تصدير التقارير</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => window.open(`/api/data?action=export&type=attendance`, '_blank')} style={{ ...crd, padding: 12, textAlign: "center", cursor: "pointer", border: `1px solid ${B.blue}33` }}>
              <div style={{ fontSize: 20 }}>📊</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>سجل الحضور</div>
              <div style={{ fontSize: 9, color: t.txM }}>CSV — كل البصمات</div>
            </button>
            <button onClick={() => window.open(`/api/data?action=export&type=payroll`, '_blank')} style={{ ...crd, padding: 12, textAlign: "center", cursor: "pointer", border: "1px solid " + C.ok + "33" }}>
              <div style={{ fontSize: 20 }}>💰</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>مسير الرواتب</div>
              <div style={{ fontSize: 9, color: t.txM }}>CSV — بصيغة البنك</div>
            </button>
          </div>

          {/* All employees attendance today */}
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>👥 حضور اليوم — كل الموظفين</div>
          {emps.map(e => {
            const empAtt = att.filter(r => r.empId === e.id);
            return (
              <div key={e.id} style={{ ...crd, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{e.name} <span style={{ fontSize: 9, color: t.txM }}>({e.id})</span></div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: empAtt.length > 0 ? C.ok : C.bad }}>{empAtt.length > 0 ? `${empAtt.length} بصمات` : "غائب"}</span>
                </div>
                {empAtt.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {empAtt.map((r, i) => (
                    <span key={i} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, background: r.manual ? t.warnLt : t.okLt, color: r.manual ? C.warn : C.ok, fontWeight: 600 }}>{r.type} {new Date(r.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} {r.manual ? "(يدوي)" : ""}</span>
                  ))}
                </div>}
              </div>
            );
          })}
        </>}
      </div>}

      {/* PROFILE */}
      {tab === "profile" && <ProfileTab emp={emp} emps={emps} level={level} onLogout={onLogout} loadData={loadData} />}
    </div>

    {/* Tab bar */}
    <div style={{ display: "flex", justifyContent: "space-around", padding: "4px 0 12px", background: t.card, borderTop: "1px solid " + t.sep, position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto" }}>
      {tabs.map(tb => { const a = tab === tb.id; return (<button key={tb.id} onClick={() => setTab(tb.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "4px 8px", position: "relative" }}>{a && <div style={{ position: "absolute", top: -4, width: 18, height: 3, borderRadius: 2, background: B.blue }} />}<span style={{ fontSize: 15, filter: a ? "none" : "grayscale(.7) opacity(.4)" }}>{tb.i}</span><span style={{ fontSize: 8, fontWeight: 700, color: a ? B.blue : t.txM }}>{tb.l}</span></button>); })}
    </div>
  </div>);
}

// ═══════ PROFILE TAB ═══════
function ProfileTab({ emp, emps, level, onLogout, loadData }) {
  const { dark: dk, t, toggle: toggleTheme } = useTheme();
  const crd = getCrd(t);
  const [subTab, setSubTab] = useState("info");
  const [files, setFiles] = useState(() => JSON.parse(localStorage.getItem("basma_files_" + emp.id) || "[]"));
  const [deps, setDeps] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [showAddDep, setShowAddDep] = useState(false);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [newDep, setNewDep] = useState({ name: "", relation: "ابن", dob: "", idNumber: "", externalIns: false });
  const [newTicket, setNewTicket] = useState({ type: "شكوى وتظلم", subject: "", body: "" });

  useEffect(() => {
    api('dependents', 'GET', null, `&empId=${emp.id}`).then(d => { if (Array.isArray(d)) setDeps(d); });
    api('tickets').then(t => { if (Array.isArray(t)) setTickets(t.filter(x => x.empId === emp.id)); });
  }, []);

  const DOC_TYPES = [
    { id: "id_front", name: "صورة الهوية (أمام)", icon: "🪪" },
    { id: "id_back", name: "صورة الهوية (خلف)", icon: "🪪" },
    { id: "passport", name: "صورة الجواز", icon: "📕" },
    { id: "iqama", name: "صورة الإقامة", icon: "📄" },
    { id: "contract", name: "نسخة العقد", icon: "📋" },
    { id: "cert_1", name: "شهادة أكاديمية", icon: "🎓" },
    { id: "cert_2", name: "شهادة مهنية", icon: "📜" },
    { id: "other", name: "مستند آخر", icon: "📎" },
  ];

  const handleFileUpload = (docType, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newFile = { id: Date.now(), docType, name: file.name, size: file.size, date: new Date().toISOString().split("T")[0], status: "بانتظار الاعتماد", data: ev.target.result };
      const updated = [...files, newFile];
      setFiles(updated);
      localStorage.setItem("basma_files_" + emp.id, JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  const deleteFile = (id) => {
    const updated = files.filter(f => f.id !== id);
    setFiles(updated);
    localStorage.setItem("basma_files_" + emp.id, JSON.stringify(updated));
  };

  const addDep = async () => {
    if (!newDep.name || !newDep.dob) return alert("أدخل الاسم وتاريخ الميلاد");
    await api('dependents', 'POST', { ...newDep, empId: emp.id });
    setNewDep({ name: "", relation: "ابن", dob: "", idNumber: "", externalIns: false });
    setShowAddDep(false);
    const d = await api('dependents', 'GET', null, `&empId=${emp.id}`); if (Array.isArray(d)) setDeps(d);
  };

  const addTicket = async () => {
    if (!newTicket.subject) return alert("أدخل الموضوع");
    await api('tickets', 'POST', { ...newTicket, empId: emp.id, empName: emp.name });
    setNewTicket({ type: "شكوى وتظلم", subject: "", body: "" });
    setShowAddTicket(false);
    const t = await api('tickets'); if (Array.isArray(t)) setTickets(t.filter(x => x.empId === emp.id));
  };

  const subTabs = [
    { id: "info", i: "👤", l: "بياناتي" },
    { id: "files", i: "📎", l: "المرفقات" },
    { id: "deps", i: "👨‍👩‍👧", l: "المرافقين" },
    { id: "tickets", i: "🎫", l: "الدعم" },
  ];

  return (<div>
    {/* Sub-tabs */}
    <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto" }}>
      {subTabs.map(st => (
        <button key={st.id} onClick={() => setSubTab(st.id)} style={{ padding: "6px 14px", borderRadius: 10, fontSize: 11, fontWeight: 700, border: subTab === st.id ? "none" : "1px solid " + t.sep, background: subTab === st.id ? B.blue : "#fff", color: subTab === st.id ? "#fff" : t.tx2, cursor: "pointer", whiteSpace: "nowrap" }}>{st.i} {st.l}</button>
      ))}
    </div>

    {/* INFO */}
    {subTab === "info" && <div style={{ textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 8px", background: level.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: `3px solid ${level.color}` }}>👤</div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{emp.name}</div>
      <div style={{ fontSize: 11, color: t.txM }}>{emp.role} — {emp.id}</div>
      <div style={{ fontSize: 10, color: t.tx2, marginTop: 2 }}>{EMP_TYPES[emp.type] || "🏢 مكتبي"}</div>
      <div style={{ ...crd, marginTop: 14, textAlign: "right" }}>
        {[{ l: "الفرع", v: BR[emp.branch] }, { l: "المسمى", v: emp.role }, { l: "الرقم", v: emp.id }, { l: "التصنيف", v: EMP_TYPES[emp.type] || "مكتبي" }, { l: "الدوام المرن", v: emp.flexBase ? "✓" : "✕" }, { l: "أوفرتايم", v: emp.flexOT ? `✓ (${emp.flexOTMax}س)` : "✕" }, { l: "الالتحاق", v: emp.joinDate }].map((x, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 6 ? "1px solid " + t.sep : "none" }}>
            <span style={{ fontSize: 11, color: t.txM }}>{x.l}</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{x.v}</span>
          </div>
        ))}
      </div>
      {/* Settings */}
      <div style={{ ...crd, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.tx2, marginBottom: 10 }}>الإعدادات</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid " + t.sep }}>
          <span style={{ fontSize: 14, color: t.tx }}>الوضع الليلي</span>
          <button onClick={toggleTheme} style={{ width: 50, height: 28, borderRadius: 14, background: dk ? "#30D158" : "#E5E5EA", border: "none", cursor: "pointer", position: "relative" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, transition: "all .2s", ...(dk ? { left: 25 } : { left: 3 }), boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          <span style={{ fontSize: 14, color: t.tx }}>اللغة</span>
          <span style={{ fontSize: 14, color: t.ac }}>العربية</span>
        </div>
      </div>
      <button onClick={onLogout} style={{ width: "100%", padding: 11, borderRadius: 12, background: t.badLt, border: "none", color: t.bad, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 14, height: 44 }}>تسجيل خروج</button>
    </div>}

    {/* FILES */}
    {subTab === "files" && <div>
      {/* SCE Membership Card */}
      {emp.sceNumber && (() => {
        const sce = checkSCE(emp);
        const sceFile = files.find(f => f.docType === "sce_renewal");
        return (
          <div style={{ ...crd, marginBottom: 12, border: `2px solid ${sce?.color || C.ok}33`, background: `${sce?.color || C.ok}05` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>🏛 عضوية الهيئة السعودية للمهندسين</div>
              <span style={{ padding: "3px 8px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: `${sce?.color || C.ok}15`, color: sce?.color || C.ok }}>{sce?.icon} {sce?.status === "expired" ? "منتهية" : sce?.status === "critical" ? "حرجة" : sce?.status === "warning" ? "قريبة" : "سارية"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "1px solid " + t.sep }}>
              <span style={{ color: t.txM }}>رقم العضوية</span>
              <span style={{ fontWeight: 700 }}>{emp.sceNumber}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "1px solid " + t.sep }}>
              <span style={{ color: t.txM }}>تاريخ الانتهاء</span>
              <span style={{ fontWeight: 700, color: sce?.color }}>{emp.sceExpiry}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0" }}>
              <span style={{ color: t.txM }}>الأيام المتبقية</span>
              <span style={{ fontWeight: 700, color: sce?.color }}>{sce?.days || 0} يوم</span>
            </div>
            {/* Renewal upload */}
            {(sce?.status === "expired" || sce?.status === "critical" || sce?.status === "warning") && (
              <label style={{ display: "block", marginTop: 8, padding: 10, borderRadius: 10, background: sceFile ? t.okLt : `${sce?.color}10`, border: `1px dashed ${sceFile ? C.ok : sce?.color}`, textAlign: "center", cursor: "pointer" }}>
                <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => handleFileUpload("sce_renewal", e)} />
                {sceFile ? <><div style={{ fontSize: 12, fontWeight: 700, color: C.ok }}>✅ تم رفع النسخة المجددة</div><div style={{ fontSize: 9, color: t.txM }}>{sceFile.date} — بانتظار اعتماد HR</div></>
                  : <><div style={{ fontSize: 12, fontWeight: 700, color: sce?.color }}>📤 ارفع النسخة المجددة</div><div style={{ fontSize: 9, color: t.txM }}>صورة أو PDF</div></>}
              </label>
            )}
            <div style={{ fontSize: 8, color: t.txM, marginTop: 6 }}>📌 بيانات العضوية تأتي من كوادر HMA — رقم العضوية وتاريخ الانتهاء</div>
          </div>
        );
      })()}

      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📎 المرفقات</div>
      <div style={{ fontSize: 10, color: t.txM, marginBottom: 12 }}>ارفع صور الهوية والجواز والشهادات</div>

      {/* Upload buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        {DOC_TYPES.map(dt => {
          const uploaded = files.find(f => f.docType === dt.id);
          return (
            <label key={dt.id} style={{ ...crd, padding: 10, textAlign: "center", cursor: "pointer", border: `1px solid ${uploaded ? C.ok + "44" : t.sep}`, background: uploaded ? t.okLt : "#fff" }}>
              <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => handleFileUpload(dt.id, e)} />
              <div style={{ fontSize: 18 }}>{uploaded ? "✅" : dt.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: uploaded ? C.ok : t.tx, marginTop: 4 }}>{dt.name}</div>
              {uploaded && <div style={{ fontSize: 8, color: t.txM, marginTop: 2 }}>{uploaded.date}</div>}
            </label>
          );
        })}
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && <>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>الملفات المرفوعة ({files.length})</div>
        {files.map(f => {
          const dt = DOC_TYPES.find(d => d.id === f.docType);
          const sc = f.status === "معتمد" ? C.ok : f.status === "مرفوض" ? C.bad : C.warn;
          return (
            <div key={f.id} style={{ ...crd, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{dt?.icon || "📎"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{dt?.name || f.docType}</div>
                <div style={{ fontSize: 9, color: t.txM }}>{f.name} · {f.date}</div>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: sc + "15", color: sc }}>{f.status}</span>
              <button onClick={() => deleteFile(f.id)} style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: C.bad }}>🗑</button>
            </div>
          );
        })}
      </>}
      {files.length === 0 && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 11 }}>لم ترفع أي ملفات بعد</div>}

      <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: B.blueLt }}>
        <div style={{ fontSize: 9, color: B.blueDk }}>📌 الشهادات الأكاديمية والمهنية تتزامن تلقائياً من كوادر HMA (للقراءة فقط)</div>
      </div>
    </div>}

    {/* DEPENDENTS */}
    {subTab === "deps" && <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>👨‍👩‍👧 المرافقين</div>
        <button onClick={() => setShowAddDep(true)} style={{ padding: "5px 12px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>+ إضافة</button>
      </div>
      <div style={{ fontSize: 10, color: t.txM, marginBottom: 10 }}>سجّل مرافقيك للتأمين الصحي</div>

      {showAddDep && <div style={{ ...crd, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 8 }}>مرافق جديد</div>
        <input value={newDep.name} onChange={e => setNewDep(p => ({ ...p, name: e.target.value }))} placeholder="الاسم الكامل" style={{ ...inp, fontSize: 13, marginBottom: 6 }} />
        <select value={newDep.relation} onChange={e => setNewDep(p => ({ ...p, relation: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 6 }}>
          {["زوج", "زوجة", "ابن", "ابنة", "أب", "أم"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="date" value={newDep.dob} onChange={e => setNewDep(p => ({ ...p, dob: e.target.value }))} placeholder="تاريخ الميلاد" style={{ ...inp, fontSize: 13, marginBottom: 6 }} />
        <input value={newDep.idNumber} onChange={e => setNewDep(p => ({ ...p, idNumber: e.target.value }))} placeholder="رقم الهوية" style={{ ...inp, fontSize: 13, marginBottom: 6 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", marginBottom: 6 }}>
          <span style={{ fontSize: 11 }}>مؤمّن مع جهة أخرى</span>
          <button onClick={() => setNewDep(p => ({ ...p, externalIns: !p.externalIns }))} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: newDep.externalIns ? C.ok : "#E0E4EC", position: "relative" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: t.card, position: "absolute", top: 3, transition: "all .3s", ...(newDep.externalIns ? { left: 20 } : { left: 3 }) }} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addDep} style={{ ...PB, flex: 1, padding: 10 }}>حفظ</button>
          <button onClick={() => setShowAddDep(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
        </div>
      </div>}

      {deps.length === 0 && !showAddDep && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 11 }}>لا يوجد مرافقين مسجّلين</div>}
      {deps.map(d => (
        <div key={d.id} style={{ ...crd, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0F4F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{d.relation === "زوج" || d.relation === "زوجة" ? "💑" : d.relation === "أب" || d.relation === "أم" ? "👴" : "👶"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{d.name}</div>
            <div style={{ fontSize: 9, color: t.txM }}>{d.relation} · {d.dob}</div>
          </div>
          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: d.externalIns ? t.warnLt : t.okLt, color: d.externalIns ? C.warn : C.ok }}>{d.externalIns ? "مؤمّن خارجياً" : "مشمول بالمكتب"}</span>
          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: d.status === "approved" ? t.okLt : t.warnLt, color: d.status === "approved" ? C.ok : C.warn }}>{d.status === "approved" ? "معتمد" : "بانتظار"}</span>
        </div>
      ))}
    </div>}

    {/* TICKETS */}
    {subTab === "tickets" && <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>🎫 تذاكر الدعم</div>
        <button onClick={() => setShowAddTicket(true)} style={{ padding: "5px 12px", borderRadius: 8, background: B.blue, color: "#fff", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}>+ تذكرة</button>
      </div>

      {showAddTicket && <div style={{ ...crd, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.blue, marginBottom: 8 }}>تذكرة جديدة</div>
        <select value={newTicket.type} onChange={e => setNewTicket(p => ({ ...p, type: e.target.value }))} style={{ ...inp, fontSize: 13, marginBottom: 6 }}>
          <option value="شكوى وتظلم">شكوى وتظلم</option>
          <option value="رد على إفادة">رد على إفادة</option>
          <option value="أخرى">أخرى</option>
        </select>
        <input value={newTicket.subject} onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))} placeholder="الموضوع" style={{ ...inp, fontSize: 13, marginBottom: 6 }} />
        <textarea value={newTicket.body} onChange={e => setNewTicket(p => ({ ...p, body: e.target.value }))} placeholder="التفاصيل..." rows={3} style={{ ...inp, fontSize: 12, resize: "none", marginBottom: 6 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addTicket} style={{ ...PB, flex: 1, padding: 10 }}>إرسال</button>
          <button onClick={() => setShowAddTicket(false)} style={{ flex: 1, padding: 10, borderRadius: 14, background: t.bg, border: "1px solid " + t.sep, color: t.tx2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>إلغاء</button>
        </div>
      </div>}

      {tickets.length === 0 && !showAddTicket && <div style={{ ...crd, textAlign: "center", color: t.txM, fontSize: 11 }}>لا توجد تذاكر</div>}
      {tickets.map(tk => {
        const sc = tk.status === "open" ? C.warn : tk.status === "closed" ? C.ok : t.txM;
        return (
          <div key={tk.id} style={{ ...crd, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{tk.subject}</div>
                <div style={{ fontSize: 10, color: t.txM }}>{tk.type} · {tk.ts?.split("T")[0]}</div>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: sc + "15", color: sc }}>{tk.status === "open" ? "مفتوح" : "مغلق"}</span>
            </div>
            {tk.body && <div style={{ fontSize: 10, color: t.tx2, marginTop: 4, lineHeight: 1.6 }}>{tk.body}</div>}
          </div>
        );
      })}
    </div>}
  </div>);
}

// ═══════ MAIN ═══════
export default function MobileApp() {
  const [sc, setSc] = useState("splash"), [emp, setEmp] = useState(null);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("basma_theme") === "dark");
  const t = isDark ? DARK : LIGHT;
  const toggleTheme = () => { setIsDark(v => { const nv = !v; localStorage.setItem("basma_theme", nv ? "dark" : "light"); return nv; }); };
  useEffect(() => { const uid = localStorage.getItem("basma_uid"); if (uid) { api('employees').then(emps => { if (Array.isArray(emps)) { const e = emps.find(x => x.id === uid); if (e) setEmp(e); } }); } }, []);
  const logout = () => { localStorage.removeItem("basma_uid"); localStorage.removeItem("basma_face"); localStorage.removeItem("basma_face_v2"); setEmp(null); setSc("reg"); };
  return (<ThemeCtx.Provider value={{ dark: isDark, t, toggle: toggleTheme }}>
    <div style={{ direction: "rtl", fontFamily: Fn, maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: t.bg }}>
    <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:0}button:active{opacity:0.8!important}input::placeholder{color:${t.txM}}`}</style>
    {sc === "splash" && <Splash onDone={() => setSc(emp ? "widget" : "reg")} />}
    {sc === "reg" && <Reg onDone={e => { setEmp(e); setSc("widget"); }} />}
    {sc === "widget" && emp && <Widget emp={emp} onApp={() => setSc("app")} />}
    {sc === "app" && emp && <FullApp emp={emp} onBack={() => setSc("widget")} onLogout={logout} />}
  </div>
  </ThemeCtx.Provider>);
}
