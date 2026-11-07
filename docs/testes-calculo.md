# Testes de cálculo – Preço Certo

> Situação na **Fatia 3**. A Fatia 4 completa os casos T8–T12, T14 e T15 e registra o autoteste rodando no app publicado (`?teste=1`).

## Como os testes rodam

- Os casos ficam no próprio `src/Index.html`, dentro do bloco `<script id="calculo">` (funções `casosDeTeste()` e `rodarCasosDeTeste()`).
- **No app:** abrir o link do App da Web com `?teste=1` no final. Aparece a tabela PASSOU/FALHOU.
- **No computador (Node):** o bloco de cálculo é extraído do `Index.html` e executado com os mesmos casos. Nada é copiado à mão.
- A comparação é **exata, em centavos inteiros** (sem tolerância).

## Resultados: Fatia 3 (Node, 07/11/2026)

| # | Caso | Esperado | Obtido | Resultado |
|---|---|---|---|---|
| T1 | Visa, à vista 1.000, 1x 3,15% | 1.032,52 · 1.032,52 | 1.032,52 · 1.032,52 | ✅ PASSOU (ver divergência conhecida) |
| T2 | Visa, à vista 1.000, 2x 5,39% | 1.056,97 · 528,49 | 1.056,97 · 528,49 | ✅ PASSOU |
| T3 | Visa, à vista 1.000, 3x 6,12% | 1.065,19 · 355,06 | 1.065,19 · 355,06 | ✅ PASSOU |
| T4 | Visa, à vista 1.000, 4x 6,85% | 1.073,54 · 268,38 | 1.073,54 · 268,38 | ✅ PASSOU |
| T5 | Gastos 4.000 + 3.000; 5 dias × 6 h × 52/12 | 130 h · R$ 53,85 | 130 h · R$ 53,85 | ✅ PASSOU |
| T6 | 8 h × 150; preço mínimo da hora 70 (injetado); peças 400 → 500; imposto 0 | à vista 1.700,00 · lucro 740,00 | 1.700,00 · 740,00 | ✅ PASSOU |
| T7 | T6 em 5x Visa 7,57% | 1.839,23 · 5× 367,85 | 1.839,23 · 5× 367,85 | ✅ PASSOU |
| T13 | `lerNumeroBR("1.234,56")`, `"150,50"`, `""` | 1234,56 · 150,5 · vazio | 1234,56 · 150,5 · vazio | ✅ PASSOU |
| W1 | WhatsApp: 7,3 h × 150 + peças 333,33 | 1.095,00 + 333,33 = 1.428,33 | 1.095,00 + 333,33 = 1.428,33 | ✅ PASSOU |
| W2 | WhatsApp: 1,5 h × 133,33 (= 199,995) + peças 10,005 | 200,00 + 10,00 = 210,00 | 200,00 + 10,00 = 210,00 | ✅ PASSOU |
| W3 | WhatsApp: só peças (99,995) / só mão de obra (1,2345 h × 150) | 0 + 100,00 · 185,18 + 0 | 0 + 100,00 · 185,18 + 0 | ✅ PASSOU |

**Verificações extras (Node):**
- `lerNumeroBR` do frontend e `lerNumeroBR_` do backend dão a mesma resposta em 24 de 24 entradas.
- Os limites do frontend são idênticos aos do backend.
- `centavos(528,485)` = 528,49 (sem o erro de ponto flutuante).
- Taxa vazia → `null` e `"0"` → 0.
- Horas cobradas maiores que as horas de trabalho são bloqueadas.
- O bloco do app não usa `VISA_TESTE`, `taxasDeTeste` nem `casosDeTeste`.
- Backend: 30 de 30.

**Verificação da tela (Chrome headless, com `google.script.run` simulado):**
- primeiro acesso, chips de sugestão, preço mínimo e "você ganha…";
- campo inválido bloqueando o salvamento;
- "Desfazer": nenhum salvamento durante a barra e nenhum ao desfazer; um salvamento depois de 6 s;
- orçamento, bandeiras, detalhes do lucro sem multiplicação e valor fechado;
- modo sem conexão com a faixa "Sem conexão: só orçamento";
- nenhum erro de JavaScript.

## Divergências conhecidas

| Caso | App InfinitePay | Nosso cálculo | Diferença | Decisão |
|---|---|---|---|---|
| 1x 3,15% sobre R$ 1.000 | 1.032,53 | 1.032,52 | R$ 0,01 | **Aceito** |

1x 3,15% sobre R$ 1.000: o app InfinitePay mostra 1.032,53; nosso cálculo dá 1.032,52 (diferença de R$ 0,01, provavelmente porque a taxa real é exibida arredondada). Aceito.

Detalhes:
- Total exato: 1.000 ÷ (1 − 0,0315) = 1.032,5245…, que com arredondamento comercial dá 1.032,52.
- Para dar 1.032,53, a taxa real teria de estar entre 3,15004% e 3,15098%.
- Nenhuma regra simples bate com os 4 casos conferidos: arredondar para cima acerta o 1x, mas erra o 2x (daria 1.056,98 em vez de 1.056,97). Por isso a fórmula **não** foi alterada.
