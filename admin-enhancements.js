(() => {
  const adminApp=document.querySelector('#adminApp');
  if(!adminApp)return;

  const cfg=window.FOX_SUPABASE||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const fmtDate=d=>d?new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'—';
  let rendering=false;

  function dbClient(){
    return window.supabase&&cfg.url&&cfg.publishableKey?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
  }

  function displayName(){
    return document.querySelector('.admin-profile strong')?.textContent?.trim()||'Administrador';
  }

  function applyTheme(){
    const v=localStorage.getItem('fox-shopey-theme-v1')||'auto';
    document.documentElement.dataset.theme=v==='auto'?'':v;
  }

  function cycleTheme(){
    const v=localStorage.getItem('fox-shopey-theme-v1')||'auto';
    const n=v==='auto'?'light':v==='light'?'dark':'auto';
    localStorage.setItem('fox-shopey-theme-v1',n);
    document.documentElement.dataset.theme=n==='auto'?'':n;
    if(typeof toast==='function')toast('Tema: '+(n==='auto'?'automático':n==='light'?'claro':'escuro'));
  }

  function clickSeries(clicks){
    const now=new Date();
    return Array.from({length:7},(_,i)=>{
      const d=new Date(now.getTime()-(6-i)*86400000);
      const key=d.toISOString().slice(0,10);
      return {
        label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').slice(0,3),
        value:(clicks||[]).filter(x=>String(x.created_at||'').slice(0,10)===key).length
      };
    });
  }

  function renderClickChart(clicks){
    const series=clickSeries(clicks);
    const max=Math.max(1,...series.map(x=>x.value));
    const w=700,h=235,pad=28;
    const pts=series.map((d,i)=>{
      const x=pad+i*((w-pad*2)/(series.length-1));
      const y=24+(1-d.value/max)*155;
      return [x,y];
    });
    const poly=pts.map(p=>p[0]+','+p[1]).join(' ');
    const area=pts[0][0]+',187 '+poly+' '+pts[pts.length-1][0]+',187';
    const dots=pts.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4.5" class="chart-dot"><title>'+series[i].value+' clique(s)</title></circle>').join('');
    const labels=series.map(d=>'<span><em>'+esc(d.label)+'</em><b>'+d.value+'</b></span>').join('');
    return '<div class="admin-line-chart"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Cliques nos últimos sete dias"><g class="chart-grid"><line x1="'+pad+'" y1="60" x2="'+(w-pad)+'" y2="60"></line><line x1="'+pad+'" y1="122" x2="'+(w-pad)+'" y2="122"></line><line x1="'+pad+'" y1="187" x2="'+(w-pad)+'" y2="187"></line></g><polygon points="'+area+'" class="chart-area"></polygon><polyline points="'+poly+'" class="chart-line"></polyline>'+dots+'</svg><div class="chart-labels">'+labels+'</div></div>';
  }

  function topClicked(products,clicks){
    const counts={};
    (clicks||[]).forEach(x=>{counts[x.product_id]=(counts[x.product_id]||0)+1});
    const list=[...(products||[])].sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0)).slice(0,5);
    const max=Math.max(1,...list.map(p=>counts[p.id]||0));
    if(!list.length)return '<div class="empty-state">Nenhum produto cadastrado.</div>';
    return '<div class="admin-top-products">'+list.map((p,i)=>'<div class="admin-top-product"><span class="rank">'+String(i+1).padStart(2,'0')+'</span><div class="admin-top-product-main"><strong title="'+esc(p.name)+'">'+esc(p.name)+'</strong><div class="mini-progress"><i style="width:'+Math.max(5,Math.round(((counts[p.id]||0)/max)*100))+'%"></i></div></div><b>'+((counts[p.id]||0))+'</b></div>').join('')+'</div>';
  }

  function activity(clicks,comments,reviews,products){
    const productMap=new Map((products||[]).map(p=>[p.id,p.name]));
    const events=[
      ...(clicks||[]).slice(0,3).map(x=>({date:x.created_at,icon:'↗',title:'Clique em oferta',desc:productMap.get(x.product_id)||'Produto',kind:'click'})),
      ...(comments||[]).slice(0,2).map(x=>({date:x.created_at,icon:'💬',title:'Novo comentário',desc:x.name,kind:'comment'})),
      ...(reviews||[]).slice(0,2).map(x=>({date:x.created_at,icon:'★',title:'Nova avaliação',desc:String(x.display_name||'Usuário')+' · '+String(x.rating||0)+'/5',kind:'review'}))
    ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
    if(!events.length)return '<div class="empty-state">Nenhuma atividade recente.</div>';
    return '<div class="admin-activity-list">'+events.map(x=>'<div class="admin-activity"><span class="activity-icon '+x.kind+'">'+x.icon+'</span><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.desc)+'</small></div><time>'+fmtDate(x.date)+'</time></div>').join('')+'</div>';
  }

  function go(section){
    const btn=document.querySelector('[data-nav="'+section+'"]');
    if(btn)btn.click();
  }

  function bindTopbar(main){
    const search=main.querySelector('#adminGlobalSearch');
    search?.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      const q=search.value.trim();
      if(!q)return;
      go('products');
      setTimeout(()=>{
        const field=document.querySelector('#productSearch');
        if(field){field.value=q;field.dispatchEvent(new Event('input'));field.focus();}
      },80);
    });

    main.querySelector('#adminThemeToggle')?.addEventListener('click',cycleTheme);
    main.querySelectorAll('[data-admin-go]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.adminGo)));
    main.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.go)));
    if(typeof bindProductTable==='function')bindProductTable();
  }

  function topbar(name,pending){
    return '<div class="admin-topbar"><div class="admin-global-search"><span>⌕</span><input id="adminGlobalSearch" placeholder="Buscar no catálogo..." aria-label="Buscar no catálogo"><kbd>Enter</kbd></div><div class="admin-topbar-actions"><button class="admin-icon-btn" id="adminThemeToggle" title="Alternar tema">◐</button><button class="admin-icon-btn admin-notify" data-admin-go="comments" title="Moderação"><span>♢</span>'+(pending>0?'<b>'+pending+'</b>':'')+'</button><div class="admin-top-user"><div class="admin-top-avatar">'+esc((name||'A').slice(0,1).toUpperCase())+'</div><div><strong>'+esc(name)+'</strong><small>Administrador</small></div><span>⌄</span></div></div></div>';
  }

  async function enhanceOverview(main){
    if(rendering||main.dataset.foxDashboardEnhanced==='1')return;
    rendering=true;
    const name=displayName();
    const db=dbClient();
    if(!db){rendering=false;return;}

    const since=new Date(Date.now()-6*86400000).toISOString();
    const [productsRes,clickCountRes,clicksRes,commentsRes,reviewsRes]=await Promise.all([
      db.from('products').select('*,marketplaces(name),categories(name)').order('created_at',{ascending:false}),
      db.from('click_events').select('id',{count:'exact',head:true}),
      db.from('click_events').select('id,product_id,created_at,source').gte('created_at',since).order('created_at',{ascending:false}).limit(120),
      db.from('recommendations').select('id,name,rating,created_at,is_published').order('created_at',{ascending:false}).limit(100),
      db.from('product_reviews').select('id,display_name,rating,created_at,is_published').order('created_at',{ascending:false}).limit(100)
    ]);

    const products=productsRes.data||[];
    const clicks=clicksRes.data||[];
    const comments=commentsRes.data||[];
    const reviews=reviewsRes.data||[];
    const active=products.filter(x=>x.is_active).length;
    const featured=products.filter(x=>x.is_active&&x.is_featured).length;
    const archived=Math.max(0,products.length-active);
    const pending=comments.filter(x=>!x.is_published).length+reviews.filter(x=>!x.is_published).length;
    const activePct=products.length?Math.round(active/products.length*100):0;

    main.dataset.foxDashboardEnhanced='1';
    main.innerHTML=
      topbar(name,pending)+
      '<div class="admin-top"><div><h1>Dashboard</h1><p>Visão geral da sua vitrine, comunidade e desempenho.</p><div class="admin-live"><i></i> Sistema conectado ao Supabase</div></div></div>'+
      '<div class="admin-overview">'+
        '<div class="overview-kpis">'+
          '<div class="admin-kpi"><div class="kpi-icon">📦</div><small>Produtos</small><strong>'+products.length+'</strong><span>'+active+' ativos</span></div>'+
          '<div class="admin-kpi"><div class="kpi-icon">✓</div><small>Produtos ativos</small><strong>'+active+'</strong><span>'+activePct+'% da vitrine</span></div>'+
          '<div class="admin-kpi"><div class="kpi-icon">✨</div><small>Destaques</small><strong>'+featured+'</strong><span>em evidência</span></div>'+
          '<div class="admin-kpi"><div class="kpi-icon">↗</div><small>Cliques</small><strong>'+((clickCountRes&&clickCountRes.count)||0)+'</strong><span>links externos</span></div>'+
        '</div>'+
        '<div class="overview-grid overview-grid-top">'+
          '<section class="admin-panel overview-card analytics-card"><div class="admin-panel-head"><div><span class="overview-kicker">DESEMPENHO</span><h2>Cliques nas ofertas</h2><p>Movimentação dos últimos 7 dias.</p></div><span class="metric-chip">'+((clickCountRes&&clickCountRes.count)||0)+' total</span></div>'+renderClickChart(clicks)+'</section>'+
          '<section class="admin-panel overview-card health-card"><div class="admin-panel-head"><div><span class="overview-kicker">CATÁLOGO</span><h2>Saúde da vitrine</h2><p>Visão rápida do catálogo atual.</p></div></div><div class="health-ring" style="--pct:'+activePct+'%"><div><strong>'+activePct+'%</strong><small>ativos</small></div></div><div class="health-stats"><div><span>Ativos</span><b>'+active+'</b></div><div><span>Arquivados</span><b>'+archived+'</b></div><div><span>Em destaque</span><b>'+featured+'</b></div></div></section>'+
        '</div>'+
        '<div class="overview-grid overview-grid-bottom">'+
          '<section class="admin-panel overview-card top-products-card"><div class="admin-panel-head"><div><span class="overview-kicker">CATÁLOGO</span><h2>Produtos em destaque</h2><p>Itens com maior movimentação recente.</p></div><button class="table-action" data-admin-go="products">Ver catálogo</button></div>'+topClicked(products,clicks)+'</section>'+
          '<section class="admin-panel overview-card activity-card"><div class="admin-panel-head"><div><span class="overview-kicker">ATIVIDADE</span><h2>Atividade recente</h2><p>Últimos eventos registrados.</p></div></div>'+activity(clicks,comments,reviews,products)+'</section>'+
          '<section class="admin-panel overview-card community-card"><div class="admin-panel-head"><div><span class="overview-kicker">COMUNIDADE</span><h2>Comunidade</h2><p>Interação dos visitantes.</p></div><button class="table-action" data-admin-go="comments">Moderar</button></div><div class="community-big"><div><strong>'+(comments.length+reviews.length)+'</strong><span>interações</span></div><div class="community-metric"><b>'+pending+'</b><small>pendentes</small></div></div><div class="community-bars"><div><span>Comentários</span><i><b style="width:'+(comments.length+reviews.length?Math.max(6,Math.round(comments.length/(comments.length+reviews.length)*100)):6)+'%"></b></i><strong>'+comments.length+'</strong></div><div><span>Avaliações</span><i><b style="width:'+(comments.length+reviews.length?Math.max(6,Math.round(reviews.length/(comments.length+reviews.length)*100)):6)+'%"></b></i><strong>'+reviews.length+'</strong></div></div></section>'+
        '</div>'+
        '<section class="admin-panel overview-card recent-products-card"><div class="admin-panel-head"><div><span class="overview-kicker">RECENTES</span><h2>Últimos produtos adicionados</h2><p>Cadastros mais recentes no catálogo.</p></div><button class="table-action" data-admin-go="products">Gerenciar produtos</button></div>'+(typeof productTable==='function'?productTable(products.slice(0,6),true):'<div class="empty-state">Nenhum produto encontrado.</div>')+'</section>'+
      '</div>';

    bindTopbar(main);
    rendering=false;
  }

  function ensureTopbar(main){
    if(main.dataset.foxTopbar==='1'||main.querySelector('.admin-topbar'))return;
    main.insertAdjacentHTML('afterbegin',topbar(displayName(),0));
    main.dataset.foxTopbar='1';
    bindTopbar(main);
  }

  async function sync(){
    const main=adminApp.querySelector('.admin-main');
    if(!main)return;
    const activeNav=adminApp.querySelector('.admin-nav button.active');
    const isOverview=activeNav?.dataset.nav==='overview';
    if(isOverview){await enhanceOverview(main);}
    else{ensureTopbar(main);}
  }

  applyTheme();
  const observer=new MutationObserver(()=>{clearTimeout(observer._timer);observer._timer=setTimeout(sync,0)});
  observer.observe(adminApp,{childList:true,subtree:true});
  setTimeout(sync,0);
})();

/* Image editor: local upload + remote image URL, using Supabase Storage as the final source. */
(function installImageEditor(){
  if(typeof productForm!=='function')return;

  const escImg=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function getDb(){
    try{return typeof db!=='undefined'?db:null}catch{return null}
  }

  function isFoxStorageUrl(url){
    return typeof url==='string'&&url.includes('.supabase.co/storage/v1/object/public/product-images/');
  }

  async function importRemoteImage(url){
    const client=getDb();
    if(!client)throw new Error('Supabase não configurado.');
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw new Error('Sua sessão administrativa expirou. Entre novamente.');
    const base=window.FOX_SUPABASE?.url;
    const response=await fetch(base+'/functions/v1/import-product-image',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+session.access_token,
        'Content-Type':'application/json',
        'apikey':window.FOX_SUPABASE?.publishableKey||''
      },
      body:JSON.stringify({url})
    });
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok||!data.publicUrl)throw new Error(data.error||'Não foi possível importar a imagem.');
    return data.publicUrl;
  }

  async function uploadLocalImage(file){
    const client=getDb();
    if(!client)throw new Error('Supabase não configurado.');
    if(!file)throw new Error('Selecione uma imagem.');
    if(file.size>15*1024*1024)throw new Error('A imagem deve ter no máximo 15 MB.');
    const valid=file.type.startsWith('image/')||/\.(avif|webp|svg|png|jpe?g|gif|bmp|ico|tiff?|heic|heif)$/i.test(file.name);
    if(!valid)throw new Error('Selecione um arquivo de imagem válido.');
    const ext=(file.name.split('.').pop()||'img').toLowerCase().replace(/[^a-z0-9]/g,'')||'img';
    const path='products/'+crypto.randomUUID()+'.'+ext;
    const {error}=await client.storage.from('product-images').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(error)throw new Error('Não foi possível enviar a imagem: '+error.message);
    const {data}=client.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  }

  window.productForm=async function(id=null){
    const client=getDb();
    if(!client)return toast('Supabase não configurado.',true);

    const [{data:cats},{data:markets},{data:existing}]=await Promise.all([
      client.from('categories').select('id,name').eq('is_active',true).order('name'),
      client.from('marketplaces').select('id,name').eq('is_active',true).order('name'),
      id?client.from('products').select('*').eq('id',id).single():Promise.resolve({data:null})
    ]);
    const p=existing||{};
    let imageSource=p.image_url?'url':'file';
    let objectUrl=null;

    const wrap=document.createElement('div');
    wrap.className='image-editor-backdrop';
    wrap.innerHTML=
      '<section class="image-editor" role="dialog" aria-modal="true" aria-labelledby="imageEditorTitle">'+
        '<div class="image-editor-head">'+
          '<div><span class="image-editor-kicker">CATÁLOGO · IMAGEM</span><h2 id="imageEditorTitle">'+(id?'Editar produto':'Novo produto')+'</h2><p>Escolha uma imagem do computador ou cole o endereço direto da imagem.</p></div>'+
          '<button class="image-editor-close" type="button" aria-label="Fechar">×</button>'+
        '</div>'+
        '<form id="productImageForm" class="image-editor-body">'+
          '<div class="image-product-summary">'+
            '<div class="image-mini-fox">🦊</div>'+
            '<div><strong>Imagem da vitrine</strong><small>A imagem selecionada será salva no Supabase para evitar links externos quebrados.</small></div>'+
          '</div>'+
          '<div class="image-source-tabs">'+
            '<button type="button" class="image-source-tab '+(imageSource==='file'?'active':'')+'" data-source="file">↥ Do computador</button>'+
            '<button type="button" class="image-source-tab '+(imageSource==='url'?'active':'')+'" data-source="url">↗ Por link</button>'+
          '</div>'+
          '<div class="image-source-pane '+(imageSource==='file'?'active':'')+'" data-pane="file">'+
            '<label class="image-dropzone" id="imageDropzone">'+
              '<input id="imageFileNew" type="file" accept="image/*,.avif,.webp,.svg,.png,.jpg,.jpeg,.gif,.bmp,.ico,.tif,.tiff,.heic,.heif">'+
              '<span class="drop-icon">↥</span>'+
              '<strong>Escolher imagem do computador</strong>'+
              '<small>PNG, JPG, JPEG, WEBP, AVIF, GIF, SVG e outros formatos de imagem · até 15 MB</small>'+
            '</label>'+
          '</div>'+
          '<div class="image-source-pane '+(imageSource==='url'?'active':'')+'" data-pane="url">'+
            '<div class="image-url-row"><input id="imageUrlNew" type="url" value="'+escImg(p.image_url||'')+'" placeholder="https://site.com/imagem.jpg" autocomplete="off"><button type="button" class="table-action" id="testImageUrl">Testar link</button></div>'+
            '<small class="image-help">Cole o link direto da imagem. Links de páginas de produtos, como uma URL comum da Shopee, não são imagens.</small>'+
          '</div>'+
          '<div class="image-preview-card">'+
            '<div class="image-preview-top"><div><strong>Pré-visualização</strong><small id="imagePreviewStatus">'+(p.image_url?'Imagem atual':'Nenhuma imagem selecionada')+'</small></div><span class="image-status-dot" id="imageStatusDot"></span></div>'+
            '<div class="image-preview-stage" id="imagePreviewStage">'+
              (p.image_url?'<img src="'+escImg(p.image_url)+'" alt="Pré-visualização" id="imagePreviewImg" referrerpolicy="no-referrer"><div class="image-preview-fallback" hidden>🖼️<strong>Não foi possível visualizar esse link.</strong><small>Tente outro link ou use o upload do computador.</small></div>':'<div class="image-preview-empty">🖼️<strong>A imagem aparecerá aqui</strong><small>Faça upload ou teste um link.</small></div>')+
            '</div>'+
          '</div>'+
          '<div class="product-data-grid">'+
            '<div class="field"><label>Nome do produto</label><input id="pnameNew" value="'+escImg(p.name||'')+'" required maxlength="140"></div>'+
            '<div class="field"><label>Marketplace</label><select id="pmarketNew" required>'+((markets||[]).map(m=>'<option value="'+m.id+'" '+(m.id===p.marketplace_id?'selected':'')+'>'+escImg(m.name)+'</option>').join(''))+'</select></div>'+
            '<div class="field full"><label>Descrição</label><textarea id="pdescNew" rows="3" maxlength="1000">'+escImg(p.description||'')+'</textarea></div>'+
            '<div class="field"><label>Categoria</label><select id="pcatNew" required>'+((cats||[]).map(c=>'<option value="'+c.id+'" '+(c.id===p.category_id?'selected':'')+'>'+escImg(c.name)+'</option>').join(''))+'</select></div>'+
            '<div class="field"><label>Preço atual (R$)</label><input id="ppriceNew" type="number" min="0" step="0.01" value="'+(p.price??'')+'" required></div>'+
            '<div class="field"><label>Preço anterior (R$)</label><input id="poldNew" type="number" min="0" step="0.01" value="'+(p.old_price??'')+'"></div>'+
            '<div class="field"><label>Link de afiliado</label><input id="purlNew" type="url" value="'+escImg(p.affiliate_url||'')+'" required placeholder="https://..."></div>'+
            '<div class="check-row full"><label><input id="pfeaturedNew" type="checkbox" '+(p.is_featured?'checked':'')+'> Destacar na vitrine</label><label><input id="pactiveNew" type="checkbox" '+(p.is_active!==false?'checked':'')+'> Produto ativo</label></div>'+
          '</div>'+
          '<div class="image-editor-actions"><button class="table-action" type="button" id="cancelImageEditor">Cancelar</button><button class="buy-mini" type="submit" id="saveImageProduct">'+(id?'Salvar alterações':'Cadastrar produto')+'</button></div>'+
        '</form>'+
      '</section>';

    document.body.append(wrap);

    const close=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);wrap.remove()};
    const fileInput=wrap.querySelector('#imageFileNew');
    const urlInput=wrap.querySelector('#imageUrlNew');
    const previewStage=wrap.querySelector('#imagePreviewStage');
    const status=wrap.querySelector('#imagePreviewStatus');
    const dot=wrap.querySelector('#imageStatusDot');

    function setSource(src){
      imageSource=src;
      wrap.querySelectorAll('.image-source-tab').forEach(b=>b.classList.toggle('active',b.dataset.source===src));
      wrap.querySelectorAll('.image-source-pane').forEach(pane=>pane.classList.toggle('active',pane.dataset.pane===src));
    }

    function showFallback(message){
      previewStage.innerHTML='<div class="image-preview-fallback">🖼️<strong>Imagem indisponível na prévia</strong><small>'+escImg(message||'Tente outro link ou use o upload do computador.')+'</small></div>';
      status.textContent='Prévia indisponível';
      dot.classList.remove('ready');
    }

    function showPreview(src,label){
      previewStage.innerHTML='<img src="'+escImg(src)+'" alt="Pré-visualização" id="imagePreviewImg" referrerpolicy="no-referrer"><div class="image-preview-fallback" hidden>🖼️</div>';
      const img=previewStage.querySelector('#imagePreviewImg');
      img.onload=()=>{status.textContent=label||'Imagem pronta';dot.classList.add('ready')};
      img.onerror=()=>showFallback('O navegador não conseguiu abrir essa imagem.');
      status.textContent=label||'Carregando prévia...';
    }

    wrap.querySelectorAll('.image-source-tab').forEach(b=>b.onclick=()=>setSource(b.dataset.source));
    fileInput.onchange=()=>{
      const file=fileInput.files?.[0];
      if(!file)return;
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      objectUrl=URL.createObjectURL(file);
      status.textContent=file.name;
      dot.classList.remove('ready');
      showPreview(objectUrl,'Arquivo selecionado');
    };

    wrap.querySelector('#testImageUrl').onclick=()=>{
      const url=urlInput.value.trim();
      if(!/^https?:\\/\\//i.test(url))return toast('Cole uma URL http(s) válida.',true);
      showPreview(url,'Testando link...');
      setSource('url');
    };

    wrap.querySelector('.image-editor-close').onclick=close;
    wrap.querySelector('#cancelImageEditor').onclick=close;
    wrap.addEventListener('click',e=>{if(e.target===wrap)close()});

    wrap.querySelector('#productImageForm').onsubmit=async e=>{
      e.preventDefault();
      const save=wrap.querySelector('#saveImageProduct');
      save.disabled=true;
      save.textContent='Salvando...';

      try{
        const name=wrap.querySelector('#pnameNew').value.trim();
        const price=Number(wrap.querySelector('#ppriceNew').value);
        const old=Number(wrap.querySelector('#poldNew').value)||null;
        if(!name||!Number.isFinite(price)||price<0)throw new Error('Preencha nome e preço corretamente.');

        let imageUrl=(urlInput.value||'').trim()||null;
        const localFile=fileInput.files?.[0];

        if(imageSource==='file'){
          if(!localFile&&!isFoxStorageUrl(imageUrl||''))throw new Error('Selecione uma imagem do computador.');
          if(localFile)imageUrl=await uploadLocalImage(localFile);
        }else{
          if(!imageUrl)throw new Error('Cole o link direto da imagem.');
          if(!isFoxStorageUrl(imageUrl))imageUrl=await importRemoteImage(imageUrl);
        }

        const slug=p.slug||name.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^\u0000-\u007F]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/(^-|-$)/g,'')||crypto.randomUUID();
        const payload={
          name,
          slug,
          description:wrap.querySelector('#pdescNew').value.trim()||null,
          image_url:imageUrl,
          price,
          old_price:old,
          discount_percent:old?Math.max(0,Math.round((1-price/old)*100)):0,
          affiliate_url:wrap.querySelector('#purlNew').value.trim(),
          category_id:wrap.querySelector('#pcatNew').value,
          marketplace_id:wrap.querySelector('#pmarketNew').value,
          is_featured:wrap.querySelector('#pfeaturedNew').checked,
          is_active:wrap.querySelector('#pactiveNew').checked
        };

        const result=id?await client.from('products').update(payload).eq('id',id):await client.from('products').insert(payload);
        if(result.error)throw new Error(result.error.code==='23505'?'Já existe um produto com esse slug/nome.':'Não foi possível salvar o produto.');
        toast(id?'Produto atualizado.':'Produto cadastrado.');
        close();
        await dashboard(currentAdmin.display_name,'products');
      }catch(err){
        console.error(err);
        toast(err.message||'Não foi possível salvar a imagem.',true);
        save.disabled=false;
        save.textContent=id?'Salvar alterações':'Cadastrar produto';
      }
    };
  };
})();