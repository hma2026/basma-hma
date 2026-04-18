// Email sender API - supports Gmail, Yahoo, Outlook SMTP
// Uses nodemailer via dynamic import

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const { to, subject, html, text, provider, user, pass } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: "Missing required fields: to, subject, html/text" });
    }

    // Determine SMTP settings
    const emailUser = user || process.env.EMAIL_USER || "";
    const emailPass = pass || process.env.EMAIL_PASS || "";
    const emailProvider = provider || process.env.EMAIL_PROVIDER || "gmail";

    if (!emailUser || !emailPass) {
      return res.status(400).json({ error: "Email credentials not configured" });
    }

    const SMTP_CONFIGS = {
      gmail: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass }
      },
      yahoo: {
        host: "smtp.mail.yahoo.com",
        port: 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass }
      },
      outlook: {
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: { user: emailUser, pass: emailPass },
        tls: { ciphers: "SSLv3" }
      }
    };

    const smtpConfig = SMTP_CONFIGS[emailProvider] || SMTP_CONFIGS.gmail;

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport(smtpConfig);

    const info = await transporter.sendMail({
      from: `"بوابة الكوادر الهندسية — مكتب هاني محمد عسيري" <${emailUser}>`,
      to,
      subject,
      text: text || "",
      html: html || text || "",
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (e) {
    console.error("Email error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
