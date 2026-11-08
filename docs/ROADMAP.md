# Próximas etapas

O MVP foi organizado para receber estas funcionalidades sem reescrever tudo.

## Mapa-múndi com várias cidades
- Cada cidade já é uma linha na tabela `cities` (slug, nome, seed).
- A rota `/c/[slug]` já mostra qualquer cidade; falta a tela do mapa-múndi
  (zoom out) listando as cidades com nome e posição aproximada.
- "Bloqueada até o primeiro resgate" já existe: `cities.mayor_handle` nulo =
  bloqueada. A função `claim_house` já entrega a prefeitura e libera a cidade.
- Adicionar colunas `lat`/`lng` (ou x/y no mapa estilizado) em `cities`.

## Pessoa presa à cidade
- `claims.instagram_handle` é único no mundo todo: uma casinha por @, em uma
  cidade. Já está garantido pelo banco.

## Chat por cidade com filtro de palavrões
- Nova tabela `messages (city_id, handle, text, created_at)`.
- Só quem tem casinha na cidade pode ler/escrever (conferir via `claims`).
- Precisa de um "login" leve: guardar no navegador um token gerado no momento
  do resgate (nova tabela `sessions`) ou usar Supabase Auth.
- Supabase Realtime para as mensagens aparecerem na hora.
- Filtro: lista de palavras em `src/lib/moderation/` aplicada no servidor.

## Mudança de cidade paga (R$ 5 via Pix)
- Provedor de Pix com webhook (ex.: Mercado Pago, Asaas, Efí).
- Fluxo: gera cobrança → webhook confirma → função SQL `move_house` troca
  `city_id`/`lot_index` da casinha (e a prefeitura antiga continua com o troféu).

## Bot de DM no Instagram
- Rota `src/app/api/instagram/webhook/route.ts` recebe comentários/DMs.
- Consulta a User Profile API e confere `is_user_follow_business`.
- Se seguir: `generateCode()` + `store.createCode()` (as mesmas funções do
  admin) e responde por DM com o código.
- Precisa de: app na Meta for Developers, conta profissional do Instagram
  ligada a uma página, token de acesso e verificação do webhook.

## Extras cosméticos
- Pintar a casa / trocar o tipo / enfeites: novas colunas em `claims`
  (`color`, `decorations`) e variações em `src/components/city/art.ts`.
