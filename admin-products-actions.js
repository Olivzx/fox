/* Fox Shoopey — ações administrativas do catálogo */
(function(){
  const originalProductTable = window.productTable;
  if(typeof originalProductTable !== 'function') return;

  window.productTable = function(products, compact){
    if(!products?.length) return '<div class="empty-state">Nenhum produto encontrado.</div>';
    return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Produto</th><th>Marketplace</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead><tbody>${products.map(p=>`<tr>
      <td><div class="product-admin-name"><img class="product-admin-thumb" src="${esc(p.image_url||'/favicon.svg')}" onerror="this.src='/favicon.svg'"><div><strong>${esc(p.name)}</strong><small>${esc(p.categories?.name||'Sem categoria')}</small></div></div></td>
      <td>${esc(p.marketplaces?.name||'—')}</td>
      <td><strong>${money(p.price)}</strong>${p.old_price?`<small style="display:block;color:var(--muted);text-decoration:line-through">${money(p.old_price)}</small>`:''}</td>
      <td><span class="status-pill ${p.is_active?'active':'archived'}">${p.is_active?'● Ativo':'○ Arquivado'}</span>${p.is_featured?'<small style="display:block;color:#ff963f;margin-top:4px">★ Destaque</small>':''}</td>
      <td><div class="table-actions">
        <button class="table-action primary" data-edit-product="${p.id}">Editar</button>
        ${p.is_active?`<button class="table-action" data-archive="${p.id}">Arquivar</button>`:`<button class="table-action" data-restore="${p.id}">Restaurar</button>`}
        <button class="table-action danger-product" data-delete-product="${p.id}" data-product-name="${esc(p.name)}">Apagar</button>
      </div></td>
    </tr>`).join('')}</tbody></table></div>`;
  };

  window.bindProductTable = function(){
    root.querySelectorAll('[data-edit-product]').forEach(b=>b.onclick=()=>productForm(b.dataset.editProduct));
    root.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>archive(b.dataset.archive));
    root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restore(b.dataset.restore));
    root.querySelectorAll('[data-delete-product]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.deleteProduct,b.dataset.productName));

    const search=document.querySelector('#productSearch'),status=document.querySelector('#productStatus'),store=document.querySelector('#productStore');
    if(search) search.oninput=()=>filterProducts();
    if(status) status.onchange=()=>filterProducts();
    if(store) store.onchange=()=>filterProducts();
  };

  window.deleteProduct = async function(id,name='este produto'){
    const ok=confirm(`Apagar permanentemente "${name}"?\n\nEsta ação não pode ser desfeita. O produto sairá da vitrine e as avaliações vinculadas serão removidas.`);
    if(!ok) return;

    const button=root.querySelector(`[data-delete-product="${CSS.escape(id)}"]`);
    if(button){button.disabled=true;button.textContent='Apagando...';}

    const {error}=await db.from('products').delete().eq('id',id);
    if(error){
      if(button){button.disabled=false;button.textContent='Apagar';}
      console.error(error);
      return toast('Não foi possível apagar o produto. Verifique as permissões do administrador.',true);
    }

    toast('Produto apagado permanentemente.');
    await dashboard(currentAdmin.display_name,'products');
  };
})();
