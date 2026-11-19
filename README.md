# AURA AI — güvenli sohbet bağlantısı

Bu paket, mevcut AURA AI HTML arayüzünün kullandığı `POST /api/chat` isteğini çalıştırır.
Tarayıcı yalnızca kendi sitendeki `/api/chat` yoluna istek gönderir. Supabase adresi ve anahtarı
HTML/JavaScript dosyalarına yazılmaz; Vercel ortam değişkenlerinde tutulur.

## Dosyalar

- `public/index.html` — sohbet arayüzü
- `api/chat.js` — Vercel sunucu uç noktası; Supabase'e sunucu tarafından bağlanır
- `supabase/functions/aurai-chat/index.ts` — Supabase Edge Function; AI sağlayıcısına sunucu tarafından bağlanır
- `supabase/config.toml` — Edge Function JWT ayarı (var olan dosyana yalnızca ilgili bölümü ekle)

## 1. Vercel ortam değişkenleri

Vercel projesinde **Settings → Environment Variables** bölümüne şunları ekle:

- `SUPABASE_URL` — Supabase Project URL
- `SUPABASE_PUBLISHABLE_KEY` — Supabase Publishable Key
- `AURA_PROXY_SECRET` — uzun ve rastgele bir gizli değer

`AURA_PROXY_SECRET` için güçlü bir rastgele değer üret. Aynı değeri birazdan Supabase Edge Function Secrets içine de ekle. Bu değer hiçbir zaman HTML'e eklenmemeli.

## 2. Supabase Edge Function Secrets

Supabase Dashboard → Edge Functions → Secrets bölümüne şunları ekle:

- `AURA_PROXY_SECRET` — Vercel'e koyduğun değerle birebir aynı
- `AURAI_API_URL` — AI sağlayıcının OpenAI uyumlu Chat Completions tam adresi
- `AURAI_API_KEY` — AI sağlayıcının API anahtarı
- `AURAI_MODEL` — kullanacağın model adı

Not: `AURAI_API_URL`, `/chat/completions` dahil tam uç nokta olmalı. Sağlayıcın OpenAI uyumlu değilse bu fonksiyondaki istek/yanıt biçimi sağlayıcıya göre uyarlanmalıdır.

## 3. Supabase Function ayarı ve dağıtım

Var olan `supabase/config.toml` dosyanı silme. Şu bölümü mevcut dosyaya ekle veya aynı bölümü güncelle:

```toml
[functions.aurai-chat]
verify_jwt = false
```

Bu fonksiyon, JWT yerine Vercel sunucusunda saklanan `AURA_PROXY_SECRET` ile doğrulanır. Bu nedenle aynı gizli değeri başka kimseyle paylaşma.

Supabase CLI ile proje klasöründe:

```bash
supabase login
supabase link --project-ref PROJE_REF
supabase functions deploy aurai-chat
```

## 4. Vercel'e dağıtım

Bu klasörün içeriğini bir GitHub deposuna yükleyip Vercel'de o depoyu içe aktar. Vercel ortam değişkenlerini ekledikten sonra yeniden Deploy et.

**Önemli:** GitHub Pages yalnızca statik HTML barındırır; `api/chat.js` gibi sunucu fonksiyonlarını çalıştırmaz. Bu nedenle bu paket `/api/chat` için Vercel gibi sunucu fonksiyonu çalıştıran bir barındırma ortamına ihtiyaç duyar.

## İstek/yanıt biçimi

Arayüz şu isteği gönderir:

```json
{ "message": "Merhaba" }
```

Sunucunun arayüze döndürdüğü yanıt:

```json
{ "reply": "Merhaba! Sana nasıl yardımcı olabilirim?" }
```

Bu paket gerçek AI sağlayıcısının API anahtarını içermez. `AURAI_API_URL`, `AURAI_API_KEY` ve `AURAI_MODEL` değerleri doğru girilmeden gerçek AI yanıtı üretilemez.
