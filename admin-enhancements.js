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