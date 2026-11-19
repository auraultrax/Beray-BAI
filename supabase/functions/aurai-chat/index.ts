// Supabase Edge Function: aurai-chat
// Called only by the server-side /api/chat proxy.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aura-proxy-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
  });
}

function getText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Yalnızca POST isteği destekleniyor." });
  }

  const expectedProxySecret = Deno.env.get("AURA_PROXY_SECRET");
  const suppliedProxySecret = req.headers.get("x-aura-proxy-secret");
  if (!expectedProxySecret || !suppliedProxySecret || suppliedProxySecret !== expectedProxySecret) {
    return jsonResponse(401, { error: "Yetkisiz istek." });
  }

  const apiUrl = Deno.env.get("AURAI_API_URL");
  const apiKey = Deno.env.get("AURAI_API_KEY");
  const model = Deno.env.get("AURAI_MODEL");

  if (!apiUrl || !apiKey || !model) {
    console.error("AURAI_API_URL, AURAI_API_KEY veya AURAI_MODEL eksik.");
    return jsonResponse(500, { error: "Yapay zekâ sunucusu henüz yapılandırılmadı." });
  }

  let message = "";
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return jsonResponse(400, { error: "Geçersiz JSON isteği." });
  }

  if (!message) return jsonResponse(400, { error: "Mesaj boş olamaz." });
  if (message.length > 12000) {
    return jsonResponse(413, { error: "Mesaj çok uzun." });
  }

  let endpoint: URL;
  try {
    endpoint = new URL(apiUrl);
    if (endpoint.protocol !== "https:") throw new Error("HTTPS gerekli");
  } catch {
    return jsonResponse(500, { error: "AURAI_API_URL geçerli bir HTTPS adresi olmalı." });
  }

  try {
    // AURAI_API_URL, OpenAI uyumlu /chat/completions uç noktasının TAM adresi olmalı.
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Sen AURA AI adlı yardımcı bir yapay zekâ asistanısın. Kullanıcıyla doğal, açık, saygılı ve yardımcı bir Türkçeyle konuş. Soruları doğrudan yanıtla; emin olmadığın bilgileri kesinmiş gibi sunma."
          },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        stream: false
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!aiResponse.ok) {
      console.error("AI sağlayıcısı HTTP status:", aiResponse.status);
      return jsonResponse(502, { error: "AI sağlayıcısı isteği reddetti." });
    }

    const result = await aiResponse.json();
    const reply =
      getText(result?.choices?.[0]?.message?.content) ||
      getText(result?.reply) ||
      getText(result?.message);

    if (!reply) {
      console.error("AI sağlayıcısından beklenen yanıt biçimi alınamadı.");
      return jsonResponse(502, { error: "AI sağlayıcısından boş veya desteklenmeyen yanıt geldi." });
    }

    return jsonResponse(200, { reply });
  } catch (error) {
    console.error("AI request failed:", error instanceof Error ? error.name : "unknown");
    return jsonResponse(502, { error: "AI sağlayıcısına bağlanılamadı." });
  }
});
