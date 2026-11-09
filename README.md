# NDCity 🏘

O Brasil em pixel art (visão isométrica, estilo cidade clássica de computador
antigo, sem mecânica de jogo). Cada pessoa cria uma conta e ganha uma casinha na
sua cidade. Quem chega primeiro numa cidade vira prefeito.

Site: https://ndcity.vercel.app

## O que tem

- **Mapa do Brasil** com os 5.570 municípios (dados do IBGE), busca por nome e
  dia/noite de verdade passando pelo país.
- **Cada município é uma cidade** gerada automaticamente. Toda cidade começa
  bloqueada; o primeiro morador vira **prefeito** (só troféu). Se o prefeito
  sai, o morador mais antigo assume.
- **Conta normal**: nome de usuário + senha. Uma casa por pessoa, presa à cidade.
- **17 tipos de construção**, carrinhos e pessoas (mais casas, mais movimento),
  luzes à noite.
- **Recursos pagos** (Mercado Pago, Pix ou cartão, cobrança única):
  - 💬 Chat da cidade, só entre moradores, com filtro de palavrões: R$ 5 por 30 dias
  - 🎨 Pintura: R$ 1 por pintura (cores, 12 modelos prontos, bandeira de estado ou
    desenhada à mão, com prévia)
  - 🚚 Mudança de cidade: R$ 5 por mudança
  - Estorno ou contestação tira o recurso automaticamente.
  - **Limite mensal de vendas** (padrão R$ 2.000): ao chegar nele, as compras param
    até o dia 1º.
- **Prefeitura votada**: o prefeito propõe a pintura, os moradores votam (24h).
- **Eleições** para governador e presidente, criadas pelo admin.
- **Admin** (`/admin`): acessos, histórico de tudo, casas (com remover), ocupação
  por estado/cidade, código de acesso para quem esqueceu a senha, moderação do
  chat, eleições e recursos pagos (liberar manualmente ou cortesia).
- **Termos e Privacidade** em `/termos`.

## Configuração (Vercel → Settings → Environment Variables)

| Nome | O que é |
|---|---|
| `ADMIN_PASSWORD` | senha do `/admin` |
| `SUPABASE_URL` | endereço do projeto no Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta do Supabase (nunca no navegador) |
| `NEXT_PUBLIC_SITE_URL` | `https://ndcity.vercel.app` |
| `MP_ACCESS_TOKEN` | Access Token de produção do Mercado Pago (liga os pagamentos) |
| `MP_WEBHOOK_SECRET` | opcional: assinatura do aviso de pagamento do Mercado Pago |
| `NEXT_PUBLIC_GA_ID` | opcional: Google Analytics |

Sem Supabase, o site roda em **modo teste** (dados só na memória). Sem
`MP_ACCESS_TOKEN`, o botão de comprar pede para falar com a equipe e o admin
libera manualmente.

### Banco de dados

Rode, em ordem, os arquivos de [`supabase/migrations`](supabase/migrations) no
SQL Editor do Supabase. Todos podem ser rodados de novo sem problema.

### Mercado Pago

Aviso de pagamento (webhook): `https://ndcity.vercel.app/api/payments/webhook`,
evento **Pagamentos**. O site nunca confia só no aviso: sempre confirma o
pagamento direto na API do Mercado Pago antes de liberar.

## Para quem programa

```bash
npm install
npm run dev        # http://localhost:3000  (sem Supabase = modo teste)
npm run typecheck
```

Crie um `.env.local` a partir do `.env.example`.

```
src/
  app/                    páginas e APIs (Next.js App Router)
    page.tsx              mapa do Brasil
    c/[slug]/page.tsx     uma cidade (ex.: /c/goiania-go)
    termos/               termos e privacidade
    admin/                painel do dono
    api/signup, api/me/   conta, login, senha, pintura, mudança
    api/claim/            resgatar a casinha
    api/chat/[slug]/      chat da cidade
    api/purchase/         abrir pagamento e conferir
    api/payments/webhook/ aviso do Mercado Pago
    api/admin/            tudo do admin
  components/
    world/                mapa do Brasil (PixiJS)
    city/                 cidade (PixiJS): art.ts (pixel art por código), scene.ts
    CityView.tsx          tela da cidade e todos os fluxos
  data/                   municípios e contorno do Brasil (gerados por scripts/)
  lib/
    city/generate.ts      seed -> ruas, lotes, caminhos
    payments/             produtos, Mercado Pago, limite mensal, liberação
    db/                   banco: Supabase ou memória (modo teste)
promo-assets/             material para vídeos e posts
supabase/migrations/      SQL do banco
```
