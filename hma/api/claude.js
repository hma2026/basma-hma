export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, anthropic-beta",
      },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
              || process.env.VITE_ANTHROPIC_API_KEY
              || "";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: "API key not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await req.json();

    // Extract only allowed Anthropic fields — strip everything else
    const { model, max_tokens, system, messages, stream, temperature, top_p, top_k, metadata, stop_sequences, tools, tool_choice } = body;
    const cleanBody = { model, max_tokens, messages };
    if (system)         cleanBody.system = system;
    if (stream)         cleanBody.stream = stream;
    if (temperature)    cleanBody.temperature = temperature;
    if (top_p)          cleanBody.top_p = top_p;
    if (top_k)          cleanBody.top_k = top_k;
    if (metadata)       cleanBody.metadata = metadata;
    if (stop_sequences) cleanBody.stop_sequences = stop_sequences;
    if (tools)          cleanBody.tools = tools;
    if (tool_choice)    cleanBody.tool_choice = tool_choice;

    // Extract beta header if sent
    const anthropicBeta = req.headers.get("anthropic-beta") || body._beta || "";

    const fetchHeaders = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    if (anthropicBeta) fetchHeaders["anthropic-beta"] = anthropicBeta;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(cleanBody),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
