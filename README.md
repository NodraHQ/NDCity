# Cidadezinha 🏘

Uma cidadezinha em pixel art (visão isométrica, estilo SimCity clássico, sem
mecânica de jogo) onde cada seguidor de um perfil do Instagram resgata uma
casinha com o seu @.

## O que já funciona (MVP)

- Uma cidade gerada automaticamente a partir de uma "seed" (ruas, lotes, praças, praia).
- Carrinhos e pessoas andando (só animação).
- Resgate por código: o código vem ligado a um @ e vale para uma casinha só.
- A pessoa escolhe o tipo (casa, prédio, oficina, padaria, cabaré) e o lote no mapa.
- A primeira pessoa a resgatar vira prefeita (só troféu) e libera a cidade.
- Página `/admin` com senha para gerar códigos, ver quem usou e remover casinhas.
- Funciona no celular: arrastar, pinça para zoom, tocar numa casa mostra o @.

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
4. Abra o arquivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   aqui no GitHub, toque no botão de **copiar** (ícone de dois quadradinhos),
   cole no SQL Editor e toque em **Run**. Deve aparecer "Success".
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
- A pessoa abre o site, toca em **Resgatar casinha**, digita o código, escolhe
  o tipo e o lote. Pronto!

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
    page.tsx              cidade padrão
    c/[slug]/page.tsx     qualquer cidade (pronto para o mapa-múndi)
    admin/                painel de códigos
    api/claim/            conferir código e resgatar
    api/admin/            login, códigos, remover casinha
    api/cities/[slug]/    dados públicos da cidade
  components/
    CityView.tsx          interface e fluxo de resgate
    city/art.ts           pixel art feita por código (sem imagens de terceiros)
    city/scene.ts         PixiJS: câmera, animações, toques
  lib/
    city/generate.ts      seed -> ruas, lotes, caminhos (roda no navegador e no servidor)
    db/                   banco: Supabase ou memória (modo teste)
    codes.ts              gera códigos (será usado também pelo bot do Instagram)
supabase/migrations/      SQL do banco
docs/ROADMAP.md           próximas etapas e onde cada uma se encaixa
```
