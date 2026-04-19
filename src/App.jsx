import React, { useState, useEffect } from "react";
import MobileApp from "./MobileApp.jsx";
import AdminApp from "./AdminApp.jsx";
import TawasulWebApp from "./TawasulWebApp.jsx";

function getInitialMode() {
  try {
    var h = window.location.hash;
    var s = new URLSearchParams(window.location.search);
    if (s.get("sso")) return "sso_processing";
    if (h === "#admin") {
      localStorage.setItem("basma_last_mode", "admin");
      return "admin";
    }
    if (h === "#update" || s.get("sec") === "sys_update") return "update";
    if (h === "#desktop" || h.indexOf("#desktop") === 0) return "desktop"; // v6.31 — Tawasul Desktop Web

    // If user explicitly chose to switch to employee view, respect that
    var explicitEmployee = localStorage.getItem("basma_explicit_employee") === "1";
    if (explicitEmployee) {
      return "app";
    }

    // Persist admin mode across F5
    var savedAdminEmail = localStorage.getItem("basma_admin_email");
    var lastMode = localStorage.getItem("basma_last_mode");
    if (lastMode === "admin" && savedAdminEmail) {
      try { window.history.replaceState({}, document.title, "/#admin"); } catch(e) {}
      return "admin";
    }
    return "app";
  } catch(e) { return "app"; }
}

export default function App() {
  const [mode, setMode] = useState(getInitialMode);
  const [ssoProcessing, setSsoProcessing] = useState(function(){
    try { return !!new URLSearchParams(window.location.search).get("sso"); } catch(e) { return false; }
  });
  const [ssoError, setSsoError] = useState("");

  useEffect(() => {
    const check = async () => {
      const h = window.location.hash;
      const s = new URLSearchParams(window.location.search);

      // ═══ SSO handling (from kadwar) ═══
      const ssoToken = s.get("sso");
      const viewMode = s.get("view"); // "admin" or null
      if (ssoToken) {
        setSsoProcessing(true);
        setSsoError("");
        try {
          const r = await fetch("/api/data?action=sso-verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: ssoToken }),
          });
          const d = await r.json();
          if (d.ok && d.employee) {
            localStorage.setItem("basma_user", JSON.stringify(d.employee));
            localStorage.setItem("basma_last_username", d.employee.username || d.employee.email || "");
            if (d.employee.isAdmin || d.employee.isGeneralManager) {
              localStorage.setItem("basma_admin_email", d.employee.email || "");
            }
            const isAdminUser = d.employee.isAdmin || d.employee.isGeneralManager || d.employee.accountRole === "admin";
            if (viewMode === "admin" && isAdminUser) {
              localStorage.setItem("basma_last_mode", "admin");
              window.history.replaceState({}, document.title, "/#admin");
              setMode("admin");
            } else {
              localStorage.setItem("basma_last_mode", "app");
              window.history.replaceState({}, document.title, "/");
              setMode("app");
            }
            setSsoProcessing(false);
            return;
          } else {
            setSsoError(d.error || "فشل التحقق من الجلسة");
            setSsoProcessing(false);
            return;
          }
        } catch (e) {
          setSsoError("خطأ في الاتصال: " + e.message);
          setSsoProcessing(false);
          return;
        }
      }

      // ═══ Normal routing (on hashchange) ═══
      if (h === "#admin") {
        localStorage.setItem("basma_last_mode", "admin");
        localStorage.removeItem("basma_explicit_employee");
        return setMode("admin");
      }
      if (h === "#update" || s.get("sec") === "sys_update") return setMode("update");

      // If user explicitly chose employee view, respect it
      if (localStorage.getItem("basma_explicit_employee") === "1") {
        localStorage.setItem("basma_last_mode", "app");
        return setMode("app");
      }

      // If user explicitly navigated to root (no hash) and they are admin, go to admin
      var savedAdminEmail = localStorage.getItem("basma_admin_email");
      var lastMode = localStorage.getItem("basma_last_mode");
      if (lastMode === "admin" && savedAdminEmail && !h) {
        window.history.replaceState({}, document.title, "/#admin");
        return setMode("admin");
      }

      localStorage.setItem("basma_last_mode", "app");
      setMode("app");
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // SSO loading screen
  if (ssoProcessing) {
    return (
      <div style={{ direction: "rtl", fontFamily: "'Tajawal','Cairo',sans-serif", minHeight: "100vh", background: "linear-gradient(180deg,#0f1e3c,#1a3a6e,#2b5ea7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <div style={{ width: 36, height: 36, border: "3px solid rgba(252,211,77,0.3)", borderTopColor: "#FCD34D", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>جارِ تسجيل الدخول من كوادر</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>يرجى الانتظار...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }
  if (ssoError) {
    return (
      <div style={{ direction: "rtl", fontFamily: "'Tajawal','Cairo',sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 400, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#DC2626", marginBottom: 8 }}>فشل تسجيل الدخول</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{ssoError}</div>
          <button onClick={() => { window.location.href = "/"; }} style={{ padding: "12px 24px", borderRadius: 10, background: "#1a3a6e", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>تسجيل دخول يدوي</button>
        </div>
      </div>
    );
  }

  // Emergency update screen
  if (mode === "update") return <UpdateScreen />;

  // Tawasul Desktop Web (v6.31) — QR-paired desktop interface for task management
  if (mode === "desktop") return <TawasulWebApp />;

  return mode === "admin" ? <AdminApp /> : <MobileApp />;
}

function UpdateScreen() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, success, error
  const [msg, setMsg] = useState("");
  const [details, setDetails] = useState(null);

  const doUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setMsg("جارِ رفع الملف وتحديث GitHub...");
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = () => reject(new Error("فشل قراءة الملف"));
        reader.readAsDataURL(file);
      });
      const r = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip: base64 }),
      });
      const text = await r.text();
      var data;
      try { data = JSON.parse(text); } catch { data = { error: text.substring(0, 200) }; }
      if (data.success) {
        setStatus("success");
        setMsg("تم التحديث بنجاح! Vercel يبني الآن...");
        setDetails(data);
      } else {
        setStatus("error");
        setMsg(data.error || "حدث خطأ — status " + r.status);
        setDetails(data);
      }
    } catch (err) {
      setStatus("error");
      setMsg(err.message || "خطأ غير متوقع");
    }
  };

  return (
    <div style={{ direction: "rtl", fontFamily: "'IBM Plex Sans Arabic',-apple-system,sans-serif", minHeight: "100vh", background: "#F2F2F7", color: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 60, height: 60, borderRadius: 14, background: status === "success" ? "rgba(48,209,88,0.1)" : status === "error" ? "rgba(255,59,48,0.08)" : "rgba(10,132,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        {status === "success" ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        ) : status === "error" ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>تحديث النظام</div>
      <div style={{ fontSize: 13, color: "#6E6E73", marginTop: 6 }}>بصمة HMA v6.31 — تحديث طارئ</div>
      
      <div style={{ marginTop: 20, width: "100%", maxWidth: 400 }}>
        <div style={{ background: "#FFFFFF", borderRadius: 14, padding: 20, border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>

          {status === "idle" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>رفع ملف التحديث</div>
              <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 12 }}>ارفع ملف ZIP (بدون ضغط: zip -0 -r update.zip basma-web/)</div>
              <label style={{ display: "block", padding: 24, borderRadius: 12, border: "2px dashed " + (file ? "#30D158" : "#E5E5EA"), textAlign: "center", cursor: "pointer", background: file ? "rgba(48,209,88,0.05)" : "transparent" }}>
                <input type="file" accept=".zip" style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0])} />
                {file ? (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#30D158" }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#0A84FF" }}>اختر ملف ZIP</div>
                )}
              </label>
              <button onClick={doUpload} disabled={!file} style={{ width: "100%", height: 44, borderRadius: 12, background: file ? "#0A84FF" : "#E5E5EA", color: file ? "#fff" : "#8E8E93", fontSize: 17, fontWeight: 600, border: "none", cursor: file ? "pointer" : "default", marginTop: 14 }}>تطبيق التحديث</button>
            </div>
          )}

          {status === "uploading" && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0A84FF" }}>{msg}</div>
              <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 8 }}>لا تغلق الصفحة...</div>
            </div>
          )}

          {status === "success" && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#30D158" }}>{msg}</div>
              {details && (
                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#8E8E93", padding: "6px 0", borderBottom: "1px solid #E5E5EA" }}>Commit: <span style={{ fontWeight: 600, color: "#000" }}>{details.commit}</span></div>
                  <div style={{ fontSize: 12, color: "#8E8E93", padding: "6px 0", borderBottom: "1px solid #E5E5EA" }}>الملفات: <span style={{ fontWeight: 600, color: "#000" }}>{details.files?.length}</span></div>
                  <div style={{ fontSize: 12, color: "#8E8E93", padding: "6px 0" }}>النسخة الاحتياطية: <span style={{ fontWeight: 600, color: "#30D158" }}>محفوظة</span></div>
                </div>
              )}
              <div style={{ fontSize: 12, color: "#6E6E73", marginTop: 12 }}>Vercel يبني تلقائياً — انتظر 1-2 دقيقة ثم أعد تحميل الصفحة</div>
              <button onClick={() => { setStatus("idle"); setFile(null); setDetails(null); }} style={{ width: "100%", height: 44, borderRadius: 12, background: "rgba(10,132,255,0.08)", color: "#0A84FF", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", marginTop: 14 }}>رفع تحديث آخر</button>
            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#FF3B30" }}>{msg}</div>
              {details?.setup && <div style={{ fontSize: 12, color: "#FF9F0A", marginTop: 8, padding: 10, borderRadius: 8, background: "rgba(255,159,10,0.08)" }}>{details.setup}</div>}
              <button onClick={() => { setStatus("idle"); setFile(null); }} style={{ width: "100%", height: 44, borderRadius: 12, background: "rgba(255,59,48,0.08)", color: "#FF3B30", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", marginTop: 14 }}>حاول مرة أخرى</button>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => { window.location.hash = ""; window.location.search = ""; }} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 12, background: "#FFFFFF", border: "1px solid #E5E5EA", color: "#0A84FF", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>رجوع للتطبيق</button>
      <div style={{ marginTop: 12, fontSize: 11, color: "#8E8E93" }}>v6.31 · basma-hma.vercel.app</div>
    </div>
  );
}
