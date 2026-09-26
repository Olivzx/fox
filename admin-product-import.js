(()=> {
  const cfg = window.FOX_SUPABASE || {};
  const api = (cfg.url || '') + '/functions/v1/fetch-product-metadata';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (msg,error=false) => { const el=document.createElement('div'); el.className='admin-toast'+(error?' error':''); el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),3200); };
  async function getClient(){ if(window.__foxImportDb) return window.__foxImportDb; if(!window.supabase?.createClient) throw new Error('Supabase não carregou.'); window.__foxImportDb=window.supabase.createClient(cfg.url,cfg.publishableKey); return window.__foxImportDb; }
  function setValue(form,sel,val){ const el=form.querySelector(sel); if(el&&val!==null&&val!==undefined&&String(val)!=='') el.value=val; }
  function showPreview(form,data){
    let box=form.querySelector('.affiliate-preview');
    if(!box){ box=document.createElement('div'); box.className='affiliate-preview'; form.querySelector('#purl')?.closest('.field')?.appendChild(box); }
    const image=String(data.image_url||'');
    box.innerHTML = '<div class="affiliate-preview-media">'+(image ? '<img src="'+esc(image)+'" alt="Prévia do produto" referrerpolicy="no-referrer" onerror="this.closest(\'.affiliate-preview-media\').classList.add(\'no-image\')">' : '<div class="affiliate-preview-placeholder">🖼️</div>')+'</div><div class="affiliate-preview-copy"><strong>'+esc(data.name||'Produto detectado')+'</strong><span>'+esc(data.marketplace||'Marketplace detectado')+(data.price!==null&&data.price!==undefined ? ' · R$ '+Number(data.price).toFixed(2).replace('.',',') : '')+'</span></div>';
  }
  async function importProduct(form){
    const url=form.querySelector('#purl');
    if(!url||!url.value.trim()) return toast('Cole primeiro o link do produto afiliado.',true);
    let parsed; try{ parsed=new URL(url.value.trim()); }catch{ return toast('Digite uma URL válida.',true); }
    const button=form.querySelector('#fetchProductData');
    button.disabled=true; button.textContent='Buscando produto…';
    try{
      const client=await getClient();
      const {data:{session}}=await client.auth.getSession();
      if(!session?.access_token) throw new Error('Sua sessão administrativa expirou. Entre novamente.');
      const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':cfg.publishableKey},body:JSON.stringify({url:parsed.href})});
      const json=await res.json();
      if(!res.ok||!json.ok){ if(json.code==='SHOPEE_API_NOT_CONFIGURED') throw new Error('Para a Shopee, configure SHOPEE_APP_ID e SHOPEE_APP_SECRET no Supabase Edge Function Secrets.'); if(json.code==='SHOPEE_PRODUCT_NOT_FOUND') throw new Error('A Shopee encontrou o produto, mas ele não está disponível no catálogo de ofertas da sua conta de afiliado.'); throw new Error(json.error||'Não foi possível obter os dados.'); }
      const d=json.data||{};
      setValue(form,'#pname',d.name); setValue(form,'#pimage',d.image_url); setValue(form,'#pdesc',d.description);
      if(d.price!==null&&d.price!==undefined) setValue(form,'#pprice',d.price);
      const market=[...form.querySelector('#pmarket')?.options||[]].find(o=>o.textContent.trim().toLowerCase()===String(d.marketplace||'').toLowerCase());
      if(market) form.querySelector('#pmarket').value=market.value;
      form.dataset.lastImportedUrl=parsed.href;
      showPreview(form,d);
      let note=form.querySelector('.affiliate-import-note');
      if(!note){ note=document.createElement('div'); note.className='affiliate-import-note'; form.querySelector('#purl')?.closest('.field')?.appendChild(note); }
      const hasCore=Boolean(d.name||d.image_url);
      note.innerHTML=hasCore ? '<span>✓ Produto identificado automaticamente</span><small>'+esc(d.marketplace||'Marketplace')+' · revise os campos antes de cadastrar.</small>' : '<span>⚠️ A loja não expôs os dados do produto.</span><small>Você pode preencher nome e imagem manualmente.</small>';
      toast(hasCore?'Produto identificado. Confira nome e imagem.':'A loja não expôs os dados completos.',!hasCore);
    }catch(e){ toast(e.message||'Falha ao buscar o produto.',true); }
    finally{ button.disabled=false; button.textContent='↙ Preencher automaticamente'; }
  }
  function enhance(form){
    if(form.dataset.importEnhanced) return; form.dataset.importEnhanced='1';
    const field=form.querySelector('#purl')?.closest('.field'); if(!field) return;
    const btn=document.createElement('button'); btn.type='button'; btn.id='fetchProductData'; btn.className='table-action primary affiliate-import-btn'; btn.textContent='↙ Preencher automaticamente'; btn.addEventListener('click',()=>importProduct(form)); field.appendChild(btn);
    const help=document.createElement('small'); help.className='affiliate-import-help'; help.textContent='Cole o link e o sistema tentará preencher nome, imagem, descrição e preço. Você continua com a palavra final antes de salvar.'; field.appendChild(help);
    const input=form.querySelector('#purl');
    input?.addEventListener('paste',()=>setTimeout(()=>{if(input.value.trim()) importProduct(form)},180));
    input?.addEventListener('input',()=>{clearTimeout(form.__foxImportTimer); const value=input.value.trim(); if(value.startsWith('http')) form.__foxImportTimer=setTimeout(()=>{if(value===input.value.trim() && value!==form.dataset.lastImportedUrl) importProduct(form)},900);});
    input?.addEventListener('blur',()=>{const value=input.value.trim(); if(value&&value!==form.dataset.lastImportedUrl) importProduct(form);});
  }
  const scan=()=>document.querySelectorAll('#productForm').forEach(enhance);
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true}); scan();
})();