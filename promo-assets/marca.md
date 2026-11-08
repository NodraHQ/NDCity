# NDCity — identidade visual

## Logo

**Ainda não existe um logo.** No site, o nome aparece só como texto: **NDCity**
em fonte monoespaçada, em negrito, dentro de uma caixa creme (`#fffaf0`) com
borda grossa e sombra dura escura (`#1f1d2b`), no mesmo estilo dos botões (veja
os prints). Para os vídeos, dá para usar esse mesmo tratamento como marca.

## Fonte

O site pede a fonte monoespaçada do sistema (`ui-monospace, Menlo, Consolas,
monospace`), então ela muda de aparelho para aparelho. Os prints e vídeos desta
pasta foram gerados com a **Liberation Mono** (negrito nos títulos e botões).
Ela é gratuita (licença SIL OFL 1.1) e está em `fonte/`:

- `fonte/LiberationMono-Regular.ttf`
- `fonte/LiberationMono-Bold.ttf`
- `fonte/LICENCA-OFL.txt`

Os emojis vêm da fonte de emoji do sistema (nos prints: Noto Color Emoji).

## Cores da interface

| Uso | Hex |
|---|---|
| Fundo (céu/mar atrás da cidade) | `#2f6e9e` |
| Painéis e botões | `#fffaf0` |
| Texto, bordas e sombras | `#1f1d2b` |
| Texto secundário | `#6b6878` |
| Destaque (botão principal, faixas) | `#ffcc33` |
| Texto sobre o destaque | `#3a2a00` |
| Nome do prefeito e cidades com moradores (no mapa) | `#ffe14f` |
| Erro | `#c0392b` |
| Sucesso | `#2e8b57` |

Estilo dos elementos: cantos retos, borda de 3 px em `#1f1d2b` e sombra dura
deslocada 3–5 px, sem desfoque.

## Cores do mapa (pixel art)

| Elemento | Hex |
|---|---|
| Grama | `#5fae4e` |
| Parque | `#4f9f44` |
| Lote | `#79b85a` |
| Rua | `#54575e` |
| Calçada | `#b8b2a6` |
| Faixa da rua | `#f0d25a` |
| Praça | `#d8cdb3` |
| Água (cidade) | `#3a8bd4` |
| Areia | `#e4d197` |
| Oceano (mapa do Brasil) | `#2a5d9c` |
| Praia (mapa do Brasil) | `#e6d39a` |
| Cúpula da prefeitura | `#e8b830` |
| Paredes da prefeitura | `#f2efe6` |
| Janelas / janelas acesas | `#2f4a6b` / `#ffe27a` |
| Céu à noite | `#101a33` |

## Paleta da personalização

São as 29 cores que os moradores podem usar na casa, na prefeitura e na
bandeira:

`#f1e3c6` `#f4c7a1` `#f6e27f` `#d9f0c4` `#bfe0f2` `#d2c6d8` `#ffffff` `#9fb4c8`
`#8b9bb0` `#6b2e7a` `#8a1f4f` `#2f4a6b` `#c0483a` `#8a4b32` `#3f6fa8` `#5a7d3a`
`#9c3a60` `#e8b830` `#ff4fd8` `#4ff0ff` `#2e9e4a` `#1f1d2b` `#ff8a3a` `#7a5cff`
`#e87aa0` `#1e6b34` `#ffd400` `#1d3f8f` `#d81e1e`

## Visual geral

- Pixel art isométrica, estilo cidade clássica de computador antigo, sem
  serrilhado nem suavização: ao ampliar, use sempre "vizinho mais próximo"
  (nearest neighbor).
- Um tile do chão tem 32x16 pixels. Os sprites estão no tamanho original, sem
  fundo, em `sprites/`.
- O mapa tem dia e noite de verdade, pela posição do sol em cada cidade. À
  noite tudo fica azulado e as janelas, os postes e os faróis acendem (veja
  `prints/extra-cidade-a-noite.png`).
