export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, anthropic-beta",
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Claude ────────────────────────────────────────────────────────────────────
async function callClaude(body, betaHeader) {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) throw new Error("CLAUDE_API_KEY not configured");

  const { model, max_tokens, system, messages, stream, temperature, tools, tool_choice } = body;
  const clean = { model: model || "claude-sonnet-4-20250514", max_tokens: max_tokens || 4000, messages };
  if (system)      clean.system = system;
  if (stream)      clean.stream = stream;
  if (temperature) clean.temperature = temperature;
  if (tools)       clean.tools = tools;
  if (tool_choice) clean.tool_choice = tool_choice;

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (betaHeader) headers["anthropic-beta"] = betaHeader;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(clean),
  });
  return res;
}

// ── Gemini ────────────────────────────────────────────────────────────────────
async function callGemini(body) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // Map model names
  const modelMap = {
    "gemini-pro":       "gemini-2.5-pro",
    "gemini-3.1-pro":   "gemini-2.5-pro",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-flash":     "gemini-2.5-flash",
  };
  const geminiModel = modelMap[body.model] || "gemini-2.5-flash";

  // Convert Anthropic messages format → Gemini format
  const contents = [];
  if (body.system) {
    contents.push({ role: "user", parts: [{ text: "[System]: " + body.system }] });
    contents.push({ role: "model", parts: [{ text: "فهمت." }] });
  }
  for (const msg of (body.messages || [])) {
    const role = msg.role === "assistant" ? "model" : "user";
    let parts = [];
    if (typeof msg.content === "string") {
      parts = [{ text: msg.content }];
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") parts.push({ text: block.text });
        else if (block.type === "image" && block.source?.data) {
          parts.push({ inlineData: { mimeType: block.source.media_type, data: block.source.data } });
        } else if (block.type === "document" && block.source?.data) {
          parts.push({ inlineData: { mimeType: "application/pdf", data: block.source.data } });
        }
      }
    }
    contents.push({ role, parts });
  }

  const geminiBody = {
    contents,
    generationConfig: {
      maxOutputTokens: body.max_tokens || 4000,
      temperature: body.temperature || 0.4,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Gemini API error " + res.status);

  // Convert Gemini response → Anthropic format
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return new Response(JSON.stringify({
    content: [{ type: "text", text }],
    model: geminiModel,
    usage: { input_tokens: 0, output_tokens: 0 },
  }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
}

// ── DeepSeek ──────────────────────────────────────────────────────────────────
async function callDeepSeek(body) {
  const apiKey = process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const messages = [];
  if (body.system) messages.push({ role: "system", content: body.system });
  for (const msg of (body.messages || [])) {
    const content = typeof msg.content === "string"
      ? msg.content
      : (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    messages.push({ role: msg.role, content });
  }

  const dsBody = {
    model: body.model || "deepseek-chat",
    messages,
    max_tokens: body.max_tokens || 4000,
    temperature: body.temperature || 0.4,
  };

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
    body: JSON.stringify(dsBody),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "DeepSeek API error " + res.status);

  // Convert → Anthropic format
  const text = data?.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({
    content: [{ type: "text", text }],
    model: dsBody.model,
    usage: data.usage || {},
  }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
}

// ── OpenAI (ChatGPT) ──────────────────────────────────────────────────────────
async function callOpenAI(body) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const messages = [];
  if (body.system) messages.push({ role: "system", content: body.system });
  for (const msg of (body.messages || [])) {
    const content = typeof msg.content === "string"
      ? msg.content
      : (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    messages.push({ role: msg.role, content });
  }

  const modelMap = {
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "chatgpt": "gpt-4o-mini",
  };
  const oaiModel = modelMap[body.model] || "gpt-4o-mini";

  const oaiBody = {
    model: oaiModel,
    messages,
    max_tokens: body.max_tokens || 4000,
    temperature: body.temperature || 0.4,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
    body: JSON.stringify(oaiBody),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "OpenAI API error " + res.status);

  const text = data?.choices?.[0]?.message?.content || "";
  return new Response(JSON.stringify({
    content: [{ type: "text", text }],
    model: oaiModel,
    usage: data.usage || {},
  }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const model = (body.model || "").toLowerCase();
    const betaHeader = req.headers.get("anthropic-beta") || body._beta || "";

    let res;

    if (model.startsWith("gemini")) {
      res = await callGemini(body);
    } else if (model.startsWith("deepseek")) {
      res = await callDeepSeek(body);
    } else if (model.startsWith("gpt") || model === "chatgpt") {
      res = await callOpenAI(body);
    } else {
      // Default: Claude
      const raw = await callClaude(body, betaHeader);
      const data = await raw.json();
      return new Response(JSON.stringify(data), {
        status: raw.status,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    return res;
  } catch (e) {
    return jsonRes({ error: { message: e.message } }, 500);
  }
}
