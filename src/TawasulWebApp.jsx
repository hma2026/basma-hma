/* ═══════════════════════════════════════════════════════════════
   TawasulWebApp — بصمة HMA تواصل على سطح المكتب (v6.31)
   Desktop-only web interface for Tawasul (task management), paired
   with mobile via a 6-char pair code + QR, WhatsApp Web-style.

   MVP: shows splash with QR + pair code → polls for auth →
   after auth, loads the mobile Tawasul UI inside a centered
   500px wide container (phone-like frame on desktop).
════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect } from "react";
import MobileApp from "./MobileApp.jsx";

const LS_SESSION = "basma_desktop_session_v1"; // { token, userId, userName, expiresAt }

// Simple QR code renderer using Google Chart API as fallback + pair-code prominence.
// Uses a pure-SVG QR generator based on qr-matrix encoding — minimal and no external libs.
// For MVP, we use an <img> tag pointing to a public QR service. If blocked, user can
// still type the pair code manually.
function QRImage({ data, size }) {
  var s = size || 200;
  // Use qrserver.com (free, no-auth QR API). If blocked by network, fallback shown.
  var url = "https://api.qrserver.com/v1/create-qr-code/?size=" + s + "x" + s + "&data=" + encodeURIComponent(data) + "&margin=1&qzone=1";
  var [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div style={{
        width: s, height: s, background: "#F2F2F7", borderRadius: 12,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        border: "2px dashed #C7C7CC", color: "#6E6E73", fontSize: 11, textAlign: "center", padding: 12,
      }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📱</div>
        <div>تعذّر تحميل QR</div>
        <div style={{ marginTop: 4 }}>استخدم الرمز أدناه</div>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="QR Code"
      width={s} height={s}
      style={{ display: "block", borderRadius: 8, background: "#fff", padding: 6 }}
      onError={function(){ setFailed(true); }}
    />
  );
}

/* ═══════════════════ PAIRING SPLASH (Screen 1) ═══════════════════ */
function PairingSplash({ onAuthorized }) {
  var [token, setToken] = useState(null);
  var [pairCode, setPairCode] = useState(null);
  var [expiresIn, setExpiresIn] = useState(300); // seconds
  var [status, setStatus] = useState("loading"); // loading | ready | expired | error
  var [err, setErr] = useState(null);
  var [copyMsg, setCopyMsg] = useState("");

  // Create a new pairing session
  async function initSession() {
    setStatus("loading");
    setErr(null);
    try {
      var res = await fetch("/api/data?action=tawasul-web-init");
      var d = await res.json();
      if (!res.ok || !d.token) throw new Error(d.error || "فشل إنشاء جلسة الإقران");
      setToken(d.token);
      setPairCode(d.pairCode);
      setExpiresIn(d.expiresInSec || 300);
      setStatus("ready");
    } catch (e) {
      setErr(e.message || "خطأ غير متوقع");
      setStatus("error");
    }
  }

  useEffect(function(){ initSession(); }, []);

  // Countdown
  useEffect(function(){
    if (status !== "ready") return;
    function tick(){
      setExpiresIn(function(prev){
        if (prev <= 1) { setStatus("expired"); return 0; }
        return prev - 1;
      });
    }
    var id = setInterval(tick, 1000);
    return function(){ clearInterval(id); };
  }, [status]);

  // Poll for auth status
  useEffect(function(){
    if (status !== "ready" || !token) return;
    var aborted = false;
    async function poll() {
      try {
        var res = await fetch("/api/data?action=tawasul-web-status&token=" + encodeURIComponent(token));
        var d = await res.json();
        if (aborted) return;
        if (d.status === "authorized" && d.userId) {
          var sess = {
            token: token,
            userId: d.userId,
            userName: d.userName || "",
            userData: d.userData || null,
            expiresAt: d.expiresAt,
            savedAt: new Date().toISOString(),
          };
          try { localStorage.setItem(LS_SESSION, JSON.stringify(sess)); } catch(e) {}
          onAuthorized(sess);
          return;
        }
        if (d.status === "expired") {
          setStatus("expired");
          return;
        }
      } catch (e) {}
    }
    var id = setInterval(poll, 2500);
    poll();
    return function(){ aborted = true; clearInterval(id); };
  }, [status, token, onAuthorized]);

  var min = Math.floor(expiresIn / 60);
  var sec = expiresIn % 60;
  function pad(n){ return n < 10 ? "0" + n : String(n); }
  var timeStr = pad(min) + ":" + pad(sec);

  function copyCode(){
    try {
      navigator.clipboard.writeText(pairCode);
      setCopyMsg("✅ نُسخ!");
      setTimeout(function(){ setCopyMsg(""); }, 1500);
    } catch(e) {}
  }

  // Data encoded in QR: the URL of this app + pair code (for future deep-link support).
  // For now, mobile users just need to type the 6 chars — the QR is informational.
  var qrData = "";
  try {
    qrData = window.location.origin + "/?pair=" + pairCode;
  } catch(e) { qrData = pairCode || ""; }

  return (
    <div style={{
      direction: "rtl",
      fontFamily: "'IBM Plex Sans Arabic','Cairo',-apple-system,sans-serif",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a3a6e 0%, #2b5ea7 50%, #3a7bd5 100%)",
      color: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        padding: "32px 36px",
        maxWidth: 900,
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 36,
      }}>
        {/* LEFT: Instructions */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg,#1a3a6e,#3a7bd5)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900,
            }}>B</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#1a3a6e" }}>بصمة HMA · تواصل</div>
              <div style={{ fontSize: 11, color: "#6E6E73" }}>سطح المكتب (Web)</div>
            </div>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "16px 0 14px" }}>
            استخدم تواصل على سطح مكتبك
          </h1>

          <ol style={{ listStyle: "decimal", paddingRight: 20, fontSize: 14, lineHeight: 1.9, color: "#3c3c43", margin: 0 }}>
            <li>افتح تطبيق <strong>بصمة HMA</strong> على جوالك</li>
            <li>اذهب إلى <strong>تواصل</strong> → اضغط على <strong>🖥 سطح المكتب</strong></li>
            <li>أدخل الرمز المعروض هنا أو امسح QR</li>
            <li>ستظهر مهامك هنا تلقائياً ✨</li>
          </ol>

          <div style={{ marginTop: 22, padding: 14, borderRadius: 12, background: "#F2F2F7", fontSize: 12, color: "#6E6E73", lineHeight: 1.6 }}>
            🔒 جلسة الإقران صالحة لمدة <strong>5 دقائق</strong>، وبعد الإقران تبقى الجلسة نشطة <strong>7 أيام</strong>.<br />
            يمكنك تسجيل الخروج في أي وقت.
          </div>
        </div>

        {/* RIGHT: QR + Pair code */}
        <div style={{
          background: "#F8F9FB",
          borderRadius: 20,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #E5E5EA",
        }}>
          {status === "loading" && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 14, color: "#6E6E73" }}>جارٍ إنشاء جلسة الإقران...</div>
            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
              <div style={{ fontSize: 14, color: "#FF3B30", marginBottom: 14, fontWeight: 700 }}>فشل الاتصال</div>
              <div style={{ fontSize: 12, color: "#6E6E73", marginBottom: 16 }}>{err}</div>
              <button onClick={initSession} style={{
                padding: "10px 20px", borderRadius: 10, background: "#0A84FF", color: "#fff",
                border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>إعادة المحاولة</button>
            </div>
          )}

          {status === "expired" && (
            <div style={{ textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏰</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#FF9500", marginBottom: 12 }}>انتهت صلاحية الرمز</div>
              <button onClick={initSession} style={{
                padding: "12px 22px", borderRadius: 10, background: "#0A84FF", color: "#fff",
                border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>🔄 إنشاء رمز جديد</button>
            </div>
          )}

          {status === "ready" && pairCode && (
            <>
              <QRImage data={qrData} size={200} />

              <div style={{ marginTop: 18, fontSize: 11, color: "#6E6E73", textTransform: "uppercase", letterSpacing: 1 }}>
                رمز الإقران
              </div>
              <div
                onClick={copyCode}
                style={{
                  marginTop: 6,
                  padding: "14px 22px",
                  borderRadius: 14,
                  background: "#fff",
                  border: "2px solid #0A84FF",
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: 6,
                  color: "#1a3a6e",
                  fontFamily: "'SF Mono',Menlo,monospace",
                  cursor: "pointer",
                  userSelect: "all",
                  minWidth: 220,
                  textAlign: "center",
                }}
                title="انقر للنسخ"
              >{pairCode}</div>
              {copyMsg && <div style={{ fontSize: 11, color: "#30D158", marginTop: 6, fontWeight: 700 }}>{copyMsg}</div>}

              <div style={{
                marginTop: 16, padding: "8px 14px", borderRadius: 20,
                background: expiresIn < 60 ? "rgba(255,59,48,0.1)" : "rgba(10,132,255,0.08)",
                color: expiresIn < 60 ? "#FF3B30" : "#0A84FF",
                fontSize: 12, fontWeight: 700,
              }}>
                ⏳ ينتهي خلال {timeStr}
              </div>

              <div style={{ marginTop: 14, fontSize: 11, color: "#8E8E93", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: "#0A84FF", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
                بانتظار الإقران...
              </div>
              <style>{"@keyframes pulse-dot{0%,100%{opacity:0.4}50%{opacity:1}}"}</style>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ DESKTOP FRAME (Screen 2) ═══════════════════ */
// Wraps the mobile app inside a phone-like frame centered on the desktop.
// MVP: reuses MobileApp entirely; future versions can swap for a dedicated desktop UI.
function DesktopFrame({ session, onLogout }) {
  var [logoutBusy, setLogoutBusy] = useState(false);

  // Inject session into localStorage in the same shape MobileApp expects.
  // MobileApp reads basma_user from localStorage. We populate it from the authorized session.
  // If userData (full profile) was transferred from mobile, use it; otherwise fall back to minimal fields.
  useEffect(function(){
    try {
      var existing = null;
      try { existing = JSON.parse(localStorage.getItem("basma_user") || "null"); } catch(e) {}
      if (!existing || String(existing.id || existing.username) !== String(session.userId)) {
        var u;
        if (session.userData && typeof session.userData === "object") {
          u = Object.assign({}, session.userData, { _desktopSession: true });
        } else {
          u = {
            id: session.userId,
            username: session.userId,
            name: session.userName,
            _desktopSession: true,
          };
        }
        localStorage.setItem("basma_user", JSON.stringify(u));
      }
      // Desktop should default to tawasul tab
      try { localStorage.setItem("basma_active_tab", "tawasul"); } catch(e) {}
    } catch(e) {}
  }, [session.userId]);

  async function handleLogout() {
    if (!window.confirm("تسجيل الخروج من سطح المكتب؟")) return;
    setLogoutBusy(true);
    try {
      await fetch("/api/data?action=tawasul-web-logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: session.token }),
      });
    } catch(e) {}
    try { localStorage.removeItem(LS_SESSION); } catch(e) {}
    try { localStorage.removeItem("basma_user"); } catch(e) {}
    setLogoutBusy(false);
    onLogout();
  }

  return (
    <div style={{
      direction: "rtl",
      fontFamily: "'IBM Plex Sans Arabic','Cairo',-apple-system,sans-serif",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a1f3d 0%, #1a3a6e 50%, #2b5ea7 100%)",
      padding: 0,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar — desktop chrome */}
      <div style={{
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg,#3a7bd5,#6ab0ff)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900,
          }}>B</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>بصمة HMA · تواصل</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>سطح المكتب · {session.userName}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            padding: "5px 10px", borderRadius: 12, background: "rgba(48,209,88,0.2)",
            color: "#30D158", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "#30D158", display: "inline-block" }} />
            متصل
          </div>
          <button onClick={handleLogout} disabled={logoutBusy} style={{
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(255,59,48,0.15)",
            border: "1px solid rgba(255,59,48,0.35)",
            color: "#FF6961", fontSize: 11, fontWeight: 700, cursor: logoutBusy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}>
            {logoutBusy ? "⏳ ..." : "🚪 خروج"}
          </button>
        </div>
      </div>

      {/* Phone-frame container */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "20px 20px 40px",
        overflow: "auto",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 520,
          minHeight: "calc(100vh - 120px)",
          background: "#000",
          borderRadius: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 8px #0b1526, 0 0 0 10px rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "relative",
        }}>
          <MobileApp />
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "12px 20px 18px", color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
        بصمة HMA تواصل · الإصدار 6.31 · سطح المكتب MVP
      </div>
    </div>
  );
}

/* ═══════════════════ ROOT — picks Screen 1 or Screen 2 ═══════════════════ */
export default function TawasulWebApp() {
  // Try to load saved session from localStorage (auto-login for 7 days)
  var [session, setSession] = useState(function(){
    try {
      var raw = localStorage.getItem(LS_SESSION);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token) return null;
      if (s.expiresAt && new Date(s.expiresAt) < new Date()) {
        localStorage.removeItem(LS_SESSION);
        return null;
      }
      return s;
    } catch(e) { return null; }
  });

  // On mount: if we have a session, verify it's still valid with the server
  var [verifying, setVerifying] = useState(!!session);
  useEffect(function(){
    if (!session) { setVerifying(false); return; }
    var aborted = false;
    (async function(){
      try {
        var res = await fetch("/api/data?action=tawasul-web-status&token=" + encodeURIComponent(session.token));
        var d = await res.json();
        if (aborted) return;
        if (d.status !== "authorized") {
          try { localStorage.removeItem(LS_SESSION); } catch(e) {}
          setSession(null);
        } else if (d.expiresAt) {
          // Update expiry from server
          var updated = Object.assign({}, session, { expiresAt: d.expiresAt });
          try { localStorage.setItem(LS_SESSION, JSON.stringify(updated)); } catch(e) {}
          setSession(updated);
        }
      } catch(e) {
        // Network error — keep session as-is, user may be offline
      }
      setVerifying(false);
    })();
    return function(){ aborted = true; };
  }, []);

  if (verifying) {
    return (
      <div style={{
        direction: "rtl",
        fontFamily: "'IBM Plex Sans Arabic','Cairo',-apple-system,sans-serif",
        minHeight: "100vh",
        background: "linear-gradient(135deg,#1a3a6e,#3a7bd5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>جارٍ التحقق من الجلسة...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <PairingSplash onAuthorized={function(s){ setSession(s); }} />;
  }

  return <DesktopFrame session={session} onLogout={function(){ setSession(null); }} />;
}
