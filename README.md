# Cidadezinha 🏘

Uma cidadezinha em pixel art (visão isométrica, estilo SimCity clássico, sem
mecânica de jogo) onde cada seguidor de um perfil do Instagram resgata uma
casinha com o seu @.

## O que já funciona

- **Mapa do Brasil** em pixel art com os 5.570 municípios (dados do IBGE). Busca
  por nome; capitais e cidades com moradores aparecem destacadas.
- **Cada município é uma cidade** gerada automaticamente (capitais são maiores).
  Toda cidade começa bloqueada; quem chega primeiro vira **prefeito** (só troféu).
- **Prefeitura com sucessão**: se o prefeito sai (remoção ou mudança), a
  prefeitura passa para o morador mais antigo; sem moradores, fica vaga.
- **Uma casa por @**, presa à cidade escolhida.
- **Dia e noite de verdade**: calculado pela posição do sol em cada cidade, com
  luzes nas casas, postes e faróis. Teste com `?hora=22` no fim do endereço.
- **População**: carros e pessoas aumentam conforme a cidade ganha casas.
- **Login do morador**: entra com o mesmo código do resgate ("Já tenho casinha").
- **Recursos pagos** (liberados manualmente no admin até o gateway ficar pronto):
  - 💬 Chat da cidade, só entre moradores, com filtro de palavrões (mensal)
  - 🎨 Personalização das cores da casa (e da prefeitura, para o prefeito)
  - 🚚 Caminhão de mudança para trocar de cidade (R$ 5)
- **Admin** (`/admin`): gerar códigos, liberar recursos pagos, remover casinha
  (remove também os códigos e o login da pessoa).

Sem o Supabase configurado, o site roda em **modo teste** (nada fica salvo).

---

## Colocando no ar (dá para fazer tudo pelo celular)

São 3 contas gratuitas: **GitHub** (já tem), **Supabase** (banco de dados) e
**Vercel** (hospedagem).

### 1. Supabase (banco de dados)

1. Entre em **supabase.com** → *Start your project* → entre com o GitHub.
2. Toque em **New project**. Dê um nome (ex.: `cidadezinha`), crie uma senha
   para o banco (guarde, mas não vamos precisar dela agora) e escolha a região
   **South America (São Paulo)**. Toque em **Create new project** e espere ~2 min.
3. No menu (☰), abra **SQL Editor** → **New query**.
4. Rode, em ordem, os arquivos da pasta [`supabase/migrations`](supabase/migrations)
   (`0001_init.sql`, depois `0002_brasil_chat_pagos.sql`): abra cada um aqui no
   GitHub, toque em **copiar**, cole no SQL Editor e toque em **Run**.
5. No menu, vá em **Project Settings** → **API** (ou **Data API** / **API Keys**). Anote:
   - **Project URL** (algo como `https://abcd.supabase.co`)
   - a chave **secret** / **service_role** (toque em *Reveal* para ver). ⚠️ Essa
     chave é como uma senha mestra: não mostre para ninguém.

### 2. Vercel (colocar o site no ar)

1. Entre em **vercel.com** → *Sign up* → **Continue with GitHub**.
2. Toque em **Add New… → Project** e escolha o repositório **NDCity** → **Import**.
3. Antes de tocar em Deploy, abra **Environment Variables** e adicione uma por uma:

   | Nome | Valor |
   |---|---|
   | `ADMIN_PASSWORD` | uma senha forte, inventada por você |
   | `SUPABASE_URL` | o *Project URL* do passo 1.5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave *secret/service_role* do passo 1.5 |
   | `NEXT_PUBLIC_INSTAGRAM_PROFILE` | (opcional) seu @ sem o arroba |

4. Toque em **Deploy** e espere. A Vercel te dá um endereço tipo
   `ndcity.vercel.app`.

> Mudou alguma variável depois? Vá em **Deployments → ⋯ → Redeploy** para valer.

### 3. Usando

- Abra `seu-site.vercel.app/admin`, entre com a `ADMIN_PASSWORD`.
- Digite o @ de um seguidor e toque em **Gerar**.
- Toque em **Copiar mensagem pra DM** e mande para a pessoa no Instagram.
- A pessoa abre o site, busca a cidade dela no mapa, toca em **Resgatar
  casinha**, digita o código, escolhe o tipo e o lote. Pronto!
- Alguém pagou um recurso por Pix? Em **Liberar recurso pago**, digite o @ e
  escolha o produto.

---

## Para quem programa

```bash
npm install
npm run dev        # http://localhost:3000  (sem Supabase = modo teste)
npm run typecheck
```

Crie um `.env.local` a partir do `.env.example`.

### Estrutura

```
src/
  app/                    páginas e APIs (Next.js App Router)
    page.tsx              mapa do Brasil
    c/[slug]/page.tsx     uma cidade (ex.: /c/goiania-go)
    admin/                painel do dono do perfil
    api/claim/            conferir código e resgatar
    api/me/               login do morador, personalizar, mudança
    api/chat/[slug]/      chat da cidade
    api/purchase/         início de compra (gateway entra aqui)
    api/admin/            códigos, liberar recursos, remover casinha
  components/
    world/                mapa do Brasil (PixiJS)
    CityView.tsx          tela da cidade e todos os fluxos
    ChatPanel.tsx         chat
    city/art.ts           pixel art feita por código (sem imagens de terceiros)
    city/scene.ts         PixiJS: câmera, animações, dia/noite, toques
  data/                   municípios e contorno do Brasil (gerados por scripts/)
  lib/
    city/generate.ts      seed -> ruas, lotes, caminhos
    geo/cities.ts         lista e busca de municípios
    sun.ts                posição do sol (dia e noite)
    resident.ts           login do morador e recursos liberados
    payments/products.ts  produtos pagos e preços
    moderation/           filtro de palavrões
    db/                   banco: Supabase ou memória (modo teste)
supabase/migrations/      SQL do banco
docs/ROADMAP.md           próximas etapas e onde cada uma se encaixa
```
