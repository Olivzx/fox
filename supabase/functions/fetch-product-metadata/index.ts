import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const clean=(value:string|null|undefined)=>(value||"").replace(/\\s+/g," ").trim();
function absolute(url:string,base:string){try{return new URL(url,base).href}catch{return url}}
function decodeHtml(v:string){return v.replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").trim()}
function attr(tag:string,name:string){const re=new RegExp(name+"\\\\s*=\\\\s*([\\\\\"'])(.*?)\\\\1","i");return re.exec(tag)?.[2]||""}
function findMeta(html:string,names:string[]){for(const tag of html.match(/<meta\\\\b[^>]*>/gi)||[]){const key=(attr(tag,"property")||attr(tag,"name")||attr(tag,"itemprop")).toLowerCase();const content=decodeHtml(attr(tag,"content"));if(content&&names.includes(key))return content}return ""}
function firstProduct(value:any):any{
  if(!value||typeof value!=="object")return null;
  if(Array.isArray(value)){for(const item of value){const found=firstProduct(item);if(found)return found}return null}
  const t=Array.isArray(value["@type"])?value["@type"].join(" ").toLowerCase():String(value["@type"]||"").toLowerCase();
  if(t.includes("product")&&(value.name||value.image||value.offers))return value;
  if(value["@graph"]){const found=firstProduct(value["@graph"]);if(found)return found}
  for(const key of Object.keys(value)){if(key!=="@graph"&&typeof value[key]==="object"){const found=firstProduct(value[key]);if(found)return found}}
  return null
}
function parseJsonLd(html:string,pageUrl:string){
  for(const script of html.match(/<script[^>]+type=["']application\\\\/ld\\\\+json["'][^>]*>[\\\\s\\\\S]*?<\\\\/script>/gi)||[]){
    const raw=script.replace(/^<script[^>]*>/i,"").replace(/<\\\\/script>$/i,"").trim();
    try{
      const p=firstProduct(JSON.parse(raw)); if(!p)continue;
      let image=""; if(Array.isArray(p.image))image=String(p.image[0]||""); else if(typeof p.image==="string")image=p.image; else if(p.image?.url)image=String(p.image.url);
      const offers=Array.isArray(p.offers)?p.offers[0]:p.offers; const price=offers?.price??offers?.lowPrice??null; const currency=offers?.priceCurrency||offers?.currency||"";
      return {name:clean(p.name),image_url:image?absolute(image,pageUrl):"",description:clean(p.description),price:price!==null?Number(String(price).replace(",",".")):null,currency:clean(currency)};
    }catch{}
  }
  return {}
}
function parseEmbedded(html:string,pageUrl:string){
  const out:any={};
  for(const re of [/"productName"\\\\s*:\\\\s*"([^"\\\\]{3,180})"/i,/"product_name"\\\\s*:\\\\s*"([^"\\\\]{3,180})"/i,/"name"\\\\s*:\\\\s*"([^"\\\\]{3,180})"/i]){
    const m=html.match(re); if(m&&!/shopee|mercado livre|amazon|aliexpress/i.test(m[1])){out.name=decodeHtml(m[1]);break}
  }
  for(const re of [/"(?:image|imageUrl|image_url|cover)"\\\\s*:\\\\s*"((?:https?:)?\\\\/\\\\/[^"\\\\s]+)"/gi,/<img[^>]+(?:data-src|data-original|src)=["']([^"']+)["']/gi]){
    let m; while((m=re.exec(html))){const c=decodeHtml(m[1].replace(/\\\\\\\\/g,""));if(/\\\\.(?:jpg|jpeg|png|webp)(?:[?&#].*)?$/i.test(c)||/shopee|image/i.test(c)){out.image_url=absolute(c,pageUrl);break}} if(out.image_url)break
  }
  const pm=html.match(/"(?:price|currentPrice|priceValue)"\\\\s*:\\\\s*"?([0-9]+(?:[.,][0-9]{1,2})?)"?/i); if(pm)out.price=Number(pm[1].replace(",","."));
  return out
}
function parse(html:string,pageUrl:string){
  const ld=parseJsonLd(html,pageUrl), emb=parseEmbedded(html,pageUrl);
  const image=ld.image_url||findMeta(html,["og:image","og:image:url","og:image:secure_url","twitter:image","twitter:image:src","image"]);
  const name=ld.name||emb.name||findMeta(html,["og:title","twitter:title","title"])||clean(decodeHtml(html.match(/<title[^>]*>([\\\\s\\\\S]*?)<\\\\/title>/i)?.[1]||""));
  const description=ld.description||findMeta(html,["description","og:description","twitter:description"]);
  let marketplace="Outro";try{const h=new URL(pageUrl).hostname.toLowerCase();if(h.includes("shopee"))marketplace="Shopee";else if(h.includes("mercadolivre")||h.includes("mercadolibre"))marketplace="Mercado Livre";else if(h.includes("amazon"))marketplace="Amazon";else if(h.includes("aliexpress"))marketplace="AliExpress"}catch{}
  return {name,image_url:image?absolute(decodeHtml(String(image)),pageUrl):(emb.image_url||""),description,price:ld.price??emb.price??null,currency:ld.currency||"BRL",marketplace,source_url:pageUrl}
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,""); if(!token)throw new Error("Sessão não encontrada.");
    const authClient=createClient(supabaseUrl,supabaseAnon,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userErr}=await authClient.auth.getUser(token); if(userErr||!user)throw new Error("Sessão inválida.");
    const adminClient=createClient(supabaseUrl,supabaseServiceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:admin,error:adminErr}=await adminClient.from("admin_profiles").select("role").eq("user_id",user.id).maybeSingle();
    if(adminErr)return new Response(JSON.stringify({error:"Não foi possível validar o administrador."}),{status:500,headers:cors});
    if(admin?.role!=="admin")return new Response(JSON.stringify({error:"Acesso restrito ao administrador."}),{status:403,headers:cors});
    const body=await req.json(); if(typeof body?.url!=="string")return new Response(JSON.stringify({error:"URL inválida"}),{status:400,headers:cors});
    const parsed=new URL(body.url); if(!["http:","https:"].includes(parsed.protocol))throw new Error("Protocolo inválido.");
    const res=await fetch(parsed.href,{redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"pt-BR,pt;q=0.9,en;q=0.8"}});
    if(!res.ok)throw new Error("A loja respondeu HTTP "+res.status);
    const finalUrl=res.url||parsed.href; const html=(await res.text()).slice(0,3000000); const data=parse(html,finalUrl); const meaningful=Boolean(data.name||data.image_url);
    return new Response(JSON.stringify({ok:meaningful,data,diagnostics:{final_url:finalUrl,html_bytes:html.length}}),{status:meaningful?200:422,headers:cors});
  }catch(e){return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:"Não foi possível obter os dados."}),{status:422,headers:cors})}
});