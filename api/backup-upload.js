// backup-upload.js — يصدر token مؤقت للمتصفح لرفع الملفات مباشرة إلى Vercel Blob
// يحل مشكلة 413 Content Too Large نهائياً
// v6.77 — مستوحى من حل كوادر v37.138

export const config = { runtime: "nodejs", maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { handleUpload } = await import("@vercel/blob/client");

    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          allowedContentTypes: ["application/json", "application/octet-stream", "text/plain"],
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1 GB
          tokenPayload: JSON.stringify({
            pathname,
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("✅ Backup upload completed:", blob.pathname, blob.url);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (e) {
    console.error("Backup upload error:", e);
    return res.status(400).json({ error: e.message || String(e) });
  }
}
