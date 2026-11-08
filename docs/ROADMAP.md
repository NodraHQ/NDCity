# Próximas etapas

## Gateway de pagamento (quando for escolhido)
Tudo já está preparado; falta só conectar o provedor (Mercado Pago, Asaas, Efí…):
1. Em `src/app/api/purchase/route.ts`: criar a cobrança Pix, salvar uma linha
   na tabela `purchases` (status `pending`) e devolver `{ url }` ou o QR do Pix.
2. Criar `src/app/api/payments/webhook/route.ts`: quando o provedor avisar que
   pagou, marcar a compra como `paid` e chamar
   `store.grantEntitlement(handle, product.feature, { days, credits })`
   (o mesmo que o botão "Liberar" do admin faz).
3. Mudar `PAYMENTS_ENABLED` para `true` em `src/lib/payments/products.ts`.
4. Ajustar preços em `src/lib/payments/products.ts`.

## Bot de DM no Instagram
- Rota `src/app/api/instagram/webhook/route.ts` recebe comentários/DMs.
- Consulta a User Profile API e confere `is_user_follow_business`.
- Se seguir: `generateCode()` + `store.createCode()` (as mesmas funções do
  admin) e responde por DM com o código.
- Precisa de: app na Meta for Developers, conta profissional do Instagram
  ligada a uma página, token de acesso e verificação do webhook.

## Ideias
- Chat em tempo real com Supabase Realtime (hoje atualiza a cada 4 s).
- Cidades litorâneas com mar do lado certo; tamanho da cidade pela população.
- Mais itens de personalização: enfeites, placas, troca do tipo de construção.
- Ranking de cidades mais populosas no mapa.
