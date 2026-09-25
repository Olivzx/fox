(()=>{
  const cfg=window.FOX_SUPABASE||{};
  const api=`${cfg.url||''}/functions/v1/fetch-product-metadata`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast=(msg,error=false)=>{const el=document.createElement('div');el.className='admin-toast'+(error?' error':'');el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),3000)};
  async function importProduct(form){
    const url=form.querySelector('#purl'); if(!url||!url.value.trim()) return toast('Cole primeiro o link do produto afiliado.',true);
    let parsed; try{parsed=new URL(url.value.trim())}catch{return toast('Digite uma URL válida.',true)}
    const button=form.querySelector('#fetchProductData'); button.disabled=true; button.textContent='Buscando dados…';
    try{
      const session=window.__foxAdminSession;
      let token=session?.access_token;
      if(!token&&window.supabase){ const client=window.__foxAdminDb; const r=client?await client.auth.getSession():null; token=r?.data?.session?.access_token; }
      if(!token) throw new Error('Sessão administrativa não encontrada.');
      const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'apikey':cfg.publishableKey},body:JSON.stringify({url:parsed.href})});
      const json=await res.json(); if(!res.ok||!json.ok) throw new Error(json.error||'Não foi possível obter os dados.');
      const d=json.data||{};
      const set=(sel,val)=>{const el=form.querySelector(sel);if(el&&val!==null&&val!==undefined&&String(val)!=='')el.value=val};
      set('#pname',d.name);set('#pimage',d.image_url);set('#pdesc',d.description);if(d.price)set('#pprice',d.price);
      const market=[...form.querySelector('#pmarket')?.options||[]].find(o=>o.textContent.trim().toLowerCase()===String(d.marketplace||'').toLowerCase()); if(market) form.querySelector('#pmarket').value=market.value;
      let note=form.querySelector('.affiliate-import-note'); if(!note){note=document.createElement('div');note.className='affiliate-import-note';form.querySelector('#purl')?.closest('.field')?.appendChild(note)}
      note.innerHTML=`<span>✓ Dados encontrados automaticamente</span><small>${esc(d.marketplace||'Marketplace detectado')} · confira os campos antes de salvar.</small>`;
      toast('Dados do produto carregados. Confira e salve.');
    }catch(e){toast(e.message||'Falha ao buscar o produto.',true)}finally{button.disabled=false;button.textContent='↙ Preencher automaticamente'}
  }
  function enhance(form){
    if(form.dataset.importEnhanced)return; form.dataset.importEnhanced='1';
    const field=form.querySelector('#purl')?.closest('.field'); if(!field)return;
    const btn=document.createElement('button');btn.type='button';btn.id='fetchProductData';btn.className='table-action primary affiliate-import-btn';btn.textContent='↙ Preencher automaticamente';btn.addEventListener('click',()=>importProduct(form));
    const help=document.createElement('small');help.className='affiliate-import-help';help.textContent='Cole o link da Shopee, Mercado Livre, Amazon, AliExpress ou outra loja. A imagem e os dados disponíveis serão preenchidos para você revisar.';
    field.appendChild(btn);field.appendChild(help);
  }
  const observer=new MutationObserver(()=>document.querySelectorAll('#productForm').forEach(enhance));
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('fox-admin-ready',e=>{if(e.detail?.db)window.__foxAdminDb=e.detail.db;if(e.detail?.session)window.__foxAdminSession=e.detail.session});
})();