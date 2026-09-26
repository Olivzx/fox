import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const supabaseAnon=Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const shopeeAppId=Deno.env.get("SHOPEE_APP_ID")||"";
const shopeeSecret=Deno.env.get("SHOPEE_APP_SECRET")||"";

const clean=(v:string|null|undefined)=>(v||"").replace(/\s+/g," ").trim();
const absolute=(u:string,b:string)=>{try{return new URL(u,b).href}catch{return u}};
const decodeHtml=(v:string)=>v.replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").trim();
const detectMarketplace=(url:string)=>{try{const h=new URL(url).hostname.toLowerCase();if(h.includes("shopee"))return"Shopee";if(h.includes("mercadolivre")||h.includes("mercadolibre"))return"Mercado Livre";if(h.includes("amazon"))return"Amazon";if(h.includes("aliexpress"))return"AliExpress"}catch{}return"Outro"};

function extractShopeeIds(url:string){
  const u=new URL(url);let m=u.pathname.match(/\/product\/(\d+)\/(\d+)/i);
  if(m)return{shopId:m[1],itemId:m[2]};
  m=u.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/i);
  if(m)return{shopId:m[1],itemId:m[2]};
  const shopId=u.searchParams.get("shopid")||u.searchParams.get("shop_id"),itemId=u.searchParams.get("itemid")||u.searchParams.get("item_id");
  return shopId&&itemId?{shopId,itemId}:null;
}
async function sha256Hex(input:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}

async function fetchShopeeOfficial(url:string){
  if(!shopeeAppId||!shopeeSecret)throw new Error("SHOPEE_API_NOT_CONFIGURED");
  const ids=extractShopeeIds(url);if(!ids)throw new Error("SHOPEE_URL_ID_NOT_FOUND");
  const query="query { productOfferV2(shopId: "+ids.shopId+", itemId: "+ids.itemId+", page: 1, limit: 1) { nodes { itemId productName imageUrl price priceMin priceMax priceDiscountRate ratingStar sales shopId shopName productLink offerLink } pageInfo { page limit hasNextPage } } }";
  const payload=JSON.stringify({query}),timestamp=Math.floor(Date.now()/1000),signature=await sha256Hex(shopeeAppId+timestamp+payload+shopeeSecret);
  const res=await fetch("https://open-api.affiliate.shopee.com.br/graphql",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"SHA256 Credential="+shopeeAppId+", Timestamp="+timestamp+", Signature="+signature},body:payload});
  const json=await res.json();if(!res.ok||json?.errors?.length)throw new Error("SHOPEE_API_ERROR:"+(json?.errors?.[0]?.extensions?.code||res.status));
  const n=json?.data?.productOfferV2?.nodes?.[0];if(!n)throw new Error("SHOPEE_PRODUCT_NOT_FOUND");
  const price=n.price??n.priceMin??n.priceMax??null;
  return{name:clean(n.productName),image_url:n.imageUrl?absolute(String(n.imageUrl),url):"",description:n.shopName?"Loja: "+clean(n.shopName):"",price:price!==null?Number(String(price).replace(",",".")):null,old_price:null,discount_percent:Number(n.priceDiscountRate||0),marketplace:"Shopee",source_url:n.productLink||url,affiliate_url:n.offerLink||""};
}

function attr(tag:string,name:string){const re=new RegExp(name+"\\s*=\\s*([\\\"'])(.*?)\\1","i");return re.exec(tag)?.[2]||""}
function findMeta(html:string,names:string[]){for(const tag of html.match(/<meta\\b[^>]*>/gi)||[]){const key=(attr(tag,"property")||attr(tag,"name")||attr(tag,"itemprop")).toLowerCase(),value=decodeHtml(attr(tag,"content"));if(value&&names.includes(key))return value}return""}
function firstProduct(v:any):any{
  if(!v||typeof v!=="object")return null;
  if(Array.isArray(v)){for(const x of v){const p=firstProduct(x);if(p)return p}return null}
  const type=Array.isArray(v["@type"])?v["@type"].join(" ").toLowerCase():String(v["@type"]||"").toLowerCase();
  if(type.includes("product")&&(v.name||v.image||v.offers))return v;
  if(v["@graph"]){const p=firstProduct(v["@graph"]);if(p)return p}
  for(const k of Object.keys(v)){if(k!=="@graph"&&typeof v[k]==="object"){const p=firstProduct(v[k]);if(p)return p}}
  return null;
}
function parseJsonLd(html:string,url:string){
  const scripts=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const script of scripts){const raw=script.replace(/^<script[^>]*>/i,"").replace(/<\/script>$/i,"").trim();try{const p=firstProduct(JSON.parse(raw));if(!p)continue;let image="";if(Array.isArray(p.image))image=String(p.image[0]||"");else if(typeof p.image==="string")image=p.image;else if(p.image?.url)image=String(p.image.url);const offers=Array.isArray(p.offers)?p.offers[0]:p.offers;return{name:clean(p.name),image_url:image?absolute(image,url):"",description:clean(p.description),price:offers?.price!=null?Number(String(offers.price).replace(",",".")):null,currency:clean(offers?.priceCurrency||offers?.currency)}}catch{}}
  return{};
}
function parseProduct(html:string,url:string){
  const ld=parseJsonLd(html,url),image=ld.image_url||findMeta(html,["og:image","og:image:url","og:image:secure_url","twitter:image","twitter:image:src","image"]),name=ld.name||findMeta(html,["og:title","twitter:title","title"])||clean(decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"")),description=ld.description||findMeta(html,["description","og:description","twitter:description"]);
  return{name,image_url:image?absolute(decodeHtml(String(image)),url):"",description,price:ld.price??null,currency:ld.currency||"BRL",marketplace:detectMarketplace(url),source_url:url};
}

async function fetchDirect(url:string){
  const res=await fetch(url,{redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"pt-BR,pt;q=0.9,en;q=0.8"}});
  if(!res.ok)throw new Error("HTTP "+res.status);const finalUrl=res.url||url,html=(await res.text()).slice(0,3000000);return{data:parseProduct(html,finalUrl),finalUrl};
}

async function fetchMicrolink(url:string){
  const endpoint="https://api.microlink.io/?url="+encodeURIComponent(url);
  const res=await fetch(endpoint,{headers:{"Accept":"application/json"}});
  if(!res.ok)throw new Error("Microlink HTTP "+res.status);
  const json=await res.json();const d=json?.data||{};
  const image=typeof d.image==="string"?d.image:d.image?.url||d.logo?.url||"";
  const title=typeof d.title==="string"?d.title:d.title?.value||"";
  const description=typeof d.description==="string"?d.description:d.description?.value||"";
  const priceRaw=typeof d.price==="number"?d.price:typeof d.price?.value==="number"?d.price.value:null;
  return{data:{name:clean(title),image_url:image?absolute(String(image),url):"",description:clean(description),price:priceRaw,marketplace:detectMarketplace(url),source_url:url},finalUrl:d.url||url};
}

async function fetchReader(url:string){
  const res=await fetch("https://r.jina.ai/"+url,{headers:{"Accept":"application/json","X-Locale":"pt-BR"}});
  if(!res.ok)throw new Error("Reader HTTP "+res.status);
  const text=await res.text();let title="",content=text;try{const json=JSON.parse(text);title=clean(json?.title);content=String(json?.content||text)}catch{}
  const name=title||clean(content.match(/^#\s+(.+)$/m)?.[1]||content.match(/^Title:\s*(.+)$/mi)?.[1]||"");
  const image=content.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i)?.[1]||"";
  return{data:{name,image_url:image?absolute(image,url):"",description:clean(content.slice(0,700)),price:null,marketplace:detectMarketplace(url),source_url:url},finalUrl:url};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)throw new Error("Sessão não encontrada.");
    const authClient=createClient(supabaseUrl,supabaseAnon,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userErr}=await authClient.auth.getUser(token);if(userErr||!user)throw new Error("Sessão inválida.");
    const adminClient=createClient(supabaseUrl,supabaseServiceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:admin,error:adminErr}=await adminClient.from("admin_profiles").select("role").eq("user_id",user.id).maybeSingle();if(adminErr)return new Response(JSON.stringify({error:"Não foi possível validar o administrador."}),{status:500,headers:cors});if(admin?.role!=="admin")return new Response(JSON.stringify({error:"Acesso restrito ao administrador."}),{status:403,headers:cors});
    const body=await req.json();if(typeof body?.url!=="string")return new Response(JSON.stringify({error:"URL inválida."}),{status:400,headers:cors});
    const parsed=new URL(body.url);if(!["http:","https:"].includes(parsed.protocol))throw new Error("Protocolo inválido.");
    const marketplace=detectMarketplace(parsed.href);let result:any=null;let errors:string[]=[];
    if(marketplace==="Shopee"&&shopeeAppId&&shopeeSecret){try{result={data:await fetchShopeeOfficial(parsed.href),finalUrl:parsed.href,source:"shopee_official_api"}}catch(e){errors.push(e instanceof Error?e.message:"shopee-api");}}
    if(!result?.data?.name&&!result?.data?.image_url){try{result=await fetchMicrolink(parsed.href);result.source="microlink"}catch(e){errors.push(e instanceof Error?e.message:"microlink")}}
    if(!result?.data?.name&&!result?.data?.image_url){try{result=await fetchDirect(parsed.href);result.source="direct"}catch(e){errors.push(e instanceof Error?e.message:"direct")}}
    if(!result?.data?.name&&!result?.data?.image_url){try{result=await fetchReader(parsed.href);result.source="reader"}catch(e){errors.push(e instanceof Error?e.message:"reader")}}
    const data=result?.data||{};if(!data.name&&!data.image_url)throw new Error("Não consegui ler os dados públicos deste produto. A loja pode estar bloqueando automação.");
    return new Response(JSON.stringify({ok:true,data,source:result.source,diagnostics:{errors}}),{headers:cors});
  }catch(e){return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:"Não foi possível obter os dados."}),{status:422,headers:cors})}
});