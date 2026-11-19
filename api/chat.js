// Vercel serverless route: browser -> /api/chat -> Supabase Edge Function
// Keep all connection values in Vercel Environment Variables.

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Yalnızca POST isteği destekleniyor." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const proxySecret = process.env.AURA_PROXY_SECRET;

  if (!supabaseUrl || !publishableKey || !proxySecret) {
    console.error("Eksik sunucu ortam değişkeni: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / AURA_PROXY_SECRET");
    return res.status(500).json({ error: "Sunucu yapılandırması eksik." });
  }

  let message = req.body && typeof req.body.message === "string"
    ? req.body.message.trim()
    : "";

  if (!message) {
    return res.status(400).json({ error: "Mesaj boş olamaz." });
  }
  if (message.length > 12000) {
    return res.status(413).json({ error: "Mesaj çok uzun. En fazla 12.000 karakter gönderebilirsin." });
  }

  let baseUrl;
  try {
    baseUrl = new URL(supabaseUrl);
    if (baseUrl.protocol !== "https:") throw new Error("HTTPS gerekli");
  } catch {
    return res.status(500).json({ error: "Sunucu Supabase adresi geçersiz." });
  }

  const edgeFunctionUrl = `${baseUrl.origin}/functions/v1/aurai-chat`;

  try {
    const upstream = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": publishableKey,
        "x-aura-proxy-secret": proxySecret
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(30000)
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      console.error("Supabase Edge Function error:", upstream.status);
      return res.status(502).json({ error: "Yapay zekâ servisi şu anda yanıt veremiyor." });
    }

    const reply = payload && typeof payload.reply === "string" ? payload.reply : null;
    if (!reply) {
      console.error("Edge Function yanıtında reply alanı yok.");
      return res.status(502).json({ error: "Yapay zekâdan geçerli bir yanıt alınamadı." });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("/api/chat request failed:", error && error.name ? error.name : "unknown");
    return res.status(502).json({ error: "Yapay zekâ sunucusuna ulaşılamadı." });
  }
};
