import React, { useState, useEffect } from "react";
import MobileApp from "./MobileApp.jsx";
import AdminApp from "./AdminApp.jsx";
export default function App() {
  const [mode, setMode] = useState("app");
  useEffect(() => {
    const check = () => {
      const h = window.location.hash;
      const s = new URLSearchParams(window.location.search);
      if (h === "#admin") return setMode("admin");
      if (h === "#update" || s.get("sec") === "sys_update") return setMode("update");
      setMode("app");
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // Emergency update screen
  if (mode === "update") return <UpdateScreen />;

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
      <div style={{ fontSize: 13, color: "#6E6E73", marginTop: 6 }}>بصمة HMA v3.0 — تحديث طارئ</div>
      
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
      <div style={{ marginTop: 12, fontSize: 11, color: "#8E8E93" }}>v4.04 · basma-hma.vercel.app</div>
    </div>
  );
}
