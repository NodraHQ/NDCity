# Material promocional do NDCity

Tudo o que é preciso para montar vídeos promocionais do NDCity.

| Pasta / arquivo | O que tem |
|---|---|
| `fluxo.md` | Como a pessoa ganha a casinha e quanto custa cada extra |
| `marca.md` | Cores em hex, fonte e estilo visual (não existe logo ainda) |
| `fonte/` | Liberation Mono, a fonte dos prints e vídeos (gratuita, SIL OFL) |
| `sprites/` | PNGs originais, sem fundo e no tamanho real (pixel art: amplie com "vizinho mais próximo") |
| `sprites/visao-geral-sprites.png` | Prancha com todos os sprites ampliados 3x, para consulta rápida |
| `prints/` | Telas do site em 1080x1920 |
| `videos/` | Vídeos curtos em 1080x1920, MP4 (H.264), sem som |

## Sprites

- `construcoes/`: os 17 tipos de construção mais a prefeitura e a plaquinha de
  lote livre. Cada tipo tem 5 variações de cor (`-cor2` a `-cor5`), porque as
  casas mudam de cor de morador para morador.
- `carrinhos/`: 5 cores, nas duas direções da rua (`diagonal-a` e `diagonal-b`).
- `pessoas/`: 6 pessoinhas.
- `tiles/`: chão de 32x16 px (grama, lote, parque, praça, água, areia e rua em
  duas direções e em cruzamento).
- `enfeites/`: árvores, arbustos, flores, banco, fonte e poste.

Os sprites são desenhados por código no site (`src/components/city/art.ts`).
Estes PNGs foram exportados direto dessas funções, sem nenhuma alteração.

## Prints (1080x1920)

1. `01-mapa-do-brasil.png`: o Brasil inteiro, com as cidades que têm moradores e
   o presidente ao lado.
2. `02-cidade-cheia.png`: Goiânia com 126 casinhas.
3. `03-digitar-codigo.png`: tela de digitar o código.
4. `04-escolher-construcao.png`: escolha do tipo de construção.
5. `05a-prefeitura-em-destaque.png` e `05b-prefeitura-com-autoridades.png`: a
   prefeitura de perto, com a bandeira de Goiás, e o cartão com prefeito,
   governador e presidente.
6. `06-chat-da-cidade.png`: o chat de Goiânia.
7. `extra-cidade-a-noite.png` (bônus): a mesma cidade à noite.

## Vídeos (1080x1920, até 10 s)

1. `01-carrinhos-andando.mp4` (8 s): a cidade com carrinhos e pessoas andando.
2. `02-zoom-brasil-ate-cidade.mp4` (10 s): sai do Brasil inteiro, aproxima até
   Goiânia, entra na cidade. **Acelerado 1,4x.**
3. `03-casinha-aparecendo.mp4` (10 s): escolha do lote, confirmação e a casinha
   nova no mapa. **Acelerado 2x.**

Gravados com o `recordVideo` do Playwright (Chromium headless) e convertidos
para MP4. Os vídeos 2 e 3 passavam de 10 segundos porque a gravação deixa o
navegador lento; foram acelerados em vez de cortados. Nos vídeos, os botões e
painéis estão ampliados 2x para ficarem do tamanho de um celular.

## Dados de demonstração

Todos os @ que aparecem (ex.: `@prefeita.pixel`, `@cris.bits`,
`@malu.solzinho`) são **inventados**. Eles foram criados num servidor local de
teste, sem banco de dados: nada disso existe no site real e nenhum dado de
usuário real foi usado. Os códigos que aparecem nos prints também só existiam
nesse servidor de teste e não funcionam no site.
