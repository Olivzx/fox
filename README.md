# Fox Shoopey

Catálogo de produtos afiliados com vitrine responsiva, categorias, ofertas, recomendações e área administrativa isolada.

## Vitrine pública

- produtos ativos carregados do Supabase
- categorias e marketplaces reais
- busca
- favoritos locais
- redirecionamento direto para a loja parceira
- registro de cliques de afiliado
- recomendações publicadas
- tema automático seguindo `prefers-color-scheme`
- botão `Auto → Claro → Escuro → Auto`
- animações e ícones flutuantes na hero

Não existe carrinho, checkout ou pagamento interno. A compra acontece na plataforma parceira.

## Área administrativa

A entrada fica em `admin.html` e não aparece na navegação pública. O dashboard só libera acesso depois de Supabase Auth + `admin_profiles` + RLS.

### Criar o primeiro administrador

1. No Supabase, abra **Authentication → Users → Add user** e crie seu usuário de acesso.
2. Copie o UUID desse usuário.
3. No SQL Editor, execute:

```sql
insert into public.admin_profiles (user_id, role, display_name)
values ('UUID_DO_USUARIO', 'admin', 'Administrador');
```

Não existe senha administrativa fixa no código.

## Supabase já conectado

O projeto já possui as tabelas `products`, `categories`, `marketplaces`, `recommendations`, `banners`, `admin_profiles` e `click_events`, com RLS ativo.

A configuração pública do frontend usa somente a URL do projeto e a publishable key. Nunca coloque `service_role` ou qualquer secret key no navegador.

## Afiliados

Cadastre o link específico do produto gerado pelo programa oficial de cada marketplace. O botão **Ver oferta** registra o clique e abre a URL externa. A Fox Shoopey não processa a compra.

## Vercel

O projeto é estático e pode ser importado diretamente do repositório GitHub:

`Olivzx/Fox-Shoopey`

Não é necessário adicionar uma variável secreta para a vitrine, porque a publishable key já é apropriada para uso no cliente. Se a estratégia mudar para variáveis de ambiente, nunca exponha uma chave `service_role`.
