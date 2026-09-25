import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function clean(v: string | null | undefined) {
  return (v || "").replace(/\s+/g, " ").trim();
}

function absolute(url: string, base: string) {
  try { return new URL(url, base).href; } catch { return url; }
}

function meta(html: string, re: RegExp) {
  return clean(html.match(re)?.[1]);
}

function parse(html: string, pageUrl: string) {
  const title =
    meta(html, /property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
    meta(html, /name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i) ||
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const image =
    meta(html, /property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']*)["']/i) ||
    meta(html, /name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i);
  const description = meta(html, /(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["']/i);
  const price = meta(html, /property=["']product:price:amount["'][^>]*content=["']([^"']*)["']/i);
  const currency = meta(html, /property=["']product:price:currency["'][^>]*content=["']([^"']*)["']/i);

  let marketplace = "Outro";
  const host = new URL(pageUrl).hostname.toLowerCase();
  if (host.includes("shopee")) marketplace = "Shopee";
  else if (host.includes("mercadolivre") || host.includes("mercadolibre")) marketplace = "Mercado Livre";
  else if (host.includes("amazon")) marketplace = "Amazon";
  else if (host.includes("aliexpress")) marketplace = "AliExpress";

  return {
    name: title || "",
    image_url: image ? absolute(image, pageUrl) : "",
    description: description || "",
    price: price ? Number(price.replace(",", ".")) : null,
    currency: currency || "BRL",
    marketplace,
    source_url: pageUrl,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Sessão não encontrada.");

    // Validate the caller JWT first. The service key is used only server-side,
    // after authentication, and is never sent to the browser.
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) throw new Error("Sessão inválida.");

    // Server-side admin lookup avoids depending on public RLS policies for the
    // authorization check while keeping the service role completely private.
    const adminClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: admin, error: adminErr } = await adminClient
      .from("admin_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminErr) {
      console.error("admin_profiles check failed", adminErr);
      return new Response(JSON.stringify({ error: "Não foi possível validar o administrador." }), {
        status: 500,
        headers: cors,
      });
    }

    if (admin?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso restrito ao administrador." }), {
        status: 403,
        headers: cors,
      });
    }

    const { url } = await req.json();
    if (typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL inválida" }), { status: 400, headers: cors });
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Protocolo inválido");

    const res = await fetch(parsed.href, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoxShoopeyMetadata/1.2)" },
    });
    if (!res.ok) throw new Error(`A loja respondeu HTTP ${res.status}`);

    const html = (await res.text()).slice(0, 1_500_000);
    return new Response(JSON.stringify({ ok: true, data: parse(html, res.url) }), { headers: cors });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Não foi possível obter os dados." }),
      { status: 422, headers: cors },
    );
  }
});