# Testes de cálculo – Preço Certo

> Situação na **arquitetura Pendências** (tela no GitHub Pages + Apps Script como API). A Fatia 5 acrescenta T14 e T15 e registra o autoteste rodando no app publicado (`?teste=1`).

## Como os testes rodam

- **Cálculo:** os casos ficam em `js/calculo.js` (`casosDeTeste()` e `rodarCasosDeTeste()`).
  - **No app:** abra `https://marquesarao.github.io/preco-certo/?teste=1`. Aparece a tabela PASSOU/FALHOU.
  - **No computador (Node):** o `js/calculo.js` é carregado direto e executado com os mesmos casos. Nada é copiado à mão.
- **Backend:** o `apps-script/Codigo.gs` roda em Node com a planilha simulada (leitura, validação, migração), e a API (`doPost`) com um "espião" que registra qualquer acesso à planilha.
- **Tela:** Chrome headless, servido em `localhost` com a API simulada. O PWA (service worker, modo avião e versão nova) é testado no Chrome em tempo real (puppeteer-core).
- A comparação dos valores é **exata, em centavos inteiros**, sem tolerância.
- Os casos T8–T12, do modelo antigo de bandeiras fixas, foram **substituídos** por C1–C8 (cartões cadastráveis).

## Resultados (07/11/2026)

**Frontend: 58 de 58 · Backend (dados): 45 de 45 · API: 26 de 26 · Tela: 10 cenários · PWA: install, modo avião e versão nova.**

### Taxas e cálculo base (T)
| # | Caso | Esperado | Resultado |
|---|---|---|---|
| T1 | Visa/Master, à vista 1.000, 1x 3,15% | 1.032,52 · 1.032,52 | ✅ (ver divergência conhecida) |
| T2 | 2x 5,39% | 1.056,97 · 528,49 | ✅ |
| T3 | 3x 6,12% | 1.065,19 · 355,06 | ✅ |
| T4 | 4x 6,85% | 1.073,54 · 268,38 | ✅ |
| T5 | Gastos 4.000 + 3.000; 5 dias × 6 h × 52/12 | 130 h · R$ 53,85 | ✅ |
| T6 | 8 h × 150; preço mínimo da hora 70 (injetado); peças 400 → 500 | à vista 1.700,00 · lucro 740,00 | ✅ |
| T7 | T6 em 5x Visa/Master 7,57% | 1.839,23 · 5× 367,85 | ✅ |
| T13 | `lerNumeroBR("1.234,56")`, `"150,50"`, `""` | 1234,56 · 150,5 · vazio | ✅ |
| T14 | Horas cobradas = 0 | preço mínimo 0, sem erro | Fatia 4 |
| T15 | Valor fechado 900, horas vazias, valor da hora 150 | horas 6 · aviso ligado | Fatia 4 |

### Cartões cadastráveis (C)
| # | Caso | Esperado | Onde | Resultado |
|---|---|---|---|---|
| C1 | Um só cartão (Elo, 5x 8,00) | usado direto, sem escolha; 5x = 1.847,83; sem nome no texto do cliente | front | ✅ |
| C2 | "Não sei" com Visa/Master 5x 7,57 e Elo 5x 8,00, à vista 1.700 | 5x usa 8,00 → 1.847,83 · 5× 369,57; 6x (Elo vazio) usa 8,28 | front | ✅ |
| C3 | Elo escolhido com só 5x preenchido | só a linha 5x; nenhum total igual ao à vista | front | ✅ |
| C4 | Nome repetido ("Elo" × "elo"; "Hipercard" × "HIPERCÁRD") | front: "Já existe um cartão com esse nome."; back: validação recusa e a leitura mantém o primeiro | front + back | ✅ |
| C5 | Nenhum cartão | só o à vista (1.700,00), sem parcelas e sem erro | front + back | ✅ |
| C6 | 13º cartão | validação: "Você pode cadastrar no máximo 12 cartões."; leitura fica com 12 | back | ✅ |
| C7 | Migração: formato antigo com Visa preenchida e Elo só no 5x | 2 cartões; valores idênticos; vazios preservados (null, não 0); migra uma única vez; cópia "Taxas (antigo)" (ou "Taxas (antigo) 2" se já existir) com o conteúdo antigo intacto; leitura antes da migração já sai no formato novo | back | ✅ |
| C8 | WhatsApp com "Cabal" escolhido / com "Não sei" | contém "💳 Cartão Cabal em até 5x" / sem nome de cartão | front | ✅ |

### Peças com acréscimo (P)
| # | Caso | Esperado | Resultado |
|---|---|---|---|
| P1 | Paga 500 + 47% | cliente paga 735,00 | ✅ |
| P2 | Acréscimo 0% (e acréscimo vazio) | mesmo valor: 500,00 | ✅ |
| P3 | 333,33 + 47% | 489,9951 sem arredondar no meio → 490,00 | ✅ |
| P4 | Lucro nas peças = cobrar − pagar | 333,33 + 47% → 156,67; 8 h × 150 + peças 400 + 25% → à vista 1.700,00 · lucro 740,00 | ✅ |
| — | `acrescimoPecasPadrao` lido fora do limite ("1500", "-1", "abc") | volta ao padrão 47; "0" → 0; "47,5" → 47,5; linha ausente → 47 | ✅ (back) |

### Texto do WhatsApp (W)
| # | Caso | Esperado | Resultado |
|---|---|---|---|
| W1 | 7,3 h × 150 + peças 333,33 | 1.095,00 + 333,33 = à vista 1.428,33 | ✅ |
| W2 | 1,5 h × 133,33 (= 199,995) + peças 10,005 | 200,00 + 10,00 = 210,00 (sem o ajuste daria 210,01) | ✅ |
| W3 | Só peças (99,995) / só mão de obra (1,2345 h × 150) | a linha que existe = à vista (100,00 · 185,18) | ✅ |
| W4 | Negrito e acréscimo | `*Orçamento – CliniCar Motors Tech*` (ou `*Orçamento*`); `💵 À vista (Pix/dinheiro): *R$ 1.935,00*`; "Peças: R$ 735,00"; o 47% não aparece | ✅ |

### Verificações extras
- **Paridade frontend × backend:**
  - `lerNumeroBR` dá a mesma resposta em 24 de 24 entradas;
  - limites dos parâmetros, limite de taxa, limite de gasto, `MAX_GASTOS`, `MAX_CARTOES` e `MAX_NOME_CARTAO` idênticos;
  - campos dos cartões (`debito`, `p1` … `p12`) idênticos;
  - `chaveNome` = `chaveNome_`;
  - taxas padrão do backend = dado de teste `VISA_TESTE`.
- **Regras do código:**
  - o app nunca usa dados de teste;
  - não há emoji na interface (fora do texto do WhatsApp; o "✓" de "Salvo ✓" é um símbolo de texto pedido);
  - não há caracteres invisíveis de acento no código, nem no front nem no back. Isso evita voltar o bug do `semAcento_`.
- **Backend:** a leitura tolerante sempre passa em `validarDados_`.

### API: roteador, token e link (R, L, P)
| # | Caso | Esperado | Resultado |
|---|---|---|---|
| R1 | GET (mesmo com token na URL) | `{ok:false, erro:"Acesso não autorizado"}` em JSON; planilha não tocada | ✅ |
| R2 | Corpo que não é JSON | "Pedido inválido."; planilha não tocada | ✅ |
| R3 / R4 | Sem token / token errado / tamanho diferente / número / vazio | "Acesso não autorizado"; **planilha não tocada** | ✅ |
| R5 | Servidor ainda sem token | "Acesso não autorizado" para qualquer token | ✅ |
| R6 | Token certo + ação desconhecida ou ausente | "Ação desconhecida."; planilha não tocada | ✅ |
| R7 | Token certo + `action` = `gerarLinkDeConfiguracao`, `trocarToken`, `testarApi`, `doGet`, `doPost`, funções internas, `toString`, `constructor`, `__proto__`, `hasOwnProperty` | "Ação desconhecida." para todas; o token não muda; planilha não tocada | ✅ |
| R8 | `obterDados` | cria as 3 abas e devolve o padrão (Visa/Master, 47%, CliniCar); não devolve o token | ✅ |
| R9 | `salvarDados` com dados inválidos / nome de cartão repetido | mensagem de validação em PT-BR (não "erro interno") | ✅ |
| R10 | `salvarDados` válido → `obterDados` | devolve o que foi salvo e o mesmo `atualizadoEm` | ✅ |
| R11 | `obterTaxasPadraoVisa` | `{ok:true, taxas:{…}}` | ✅ |
| R12 | Erro inesperado | "Erro interno no servidor. Tente de novo." (detalhe só no log) | ✅ |
| R13 | Toda resposta | JSON com `ok` booleano; erros com `erro` em texto | ✅ |
| L1–L3 | `gerarLinkDeConfiguracao()` com `URL_DA_API` vazia / fora do formato `/exec` / `URL_DO_APP` vazia | para com mensagem clara no Logger e não cria token | ✅ |
| L4 | `gerarLinkDeConfiguracao()` com as URLs certas | link `URL_DO_APP#cfg=<base64url sem "=">` que decodifica para `{api, token}`; token de 64 hex | ✅ |
| L5 | Rodar de novo | mesmo token (aparelhos continuam valendo) | ✅ |
| L6 / L7 | Token do link funciona / `trocarToken()` | token novo; o antigo passa a receber "Acesso não autorizado" | ✅ |
| P1 | Funções públicas | só `doGet`, `doPost`, `gerarLinkDeConfiguracao`, `trocarToken`, `testarApi` | ✅ |
| P2 | Ações da API | só `obterDados`, `salvarDados`, `obterTaxasPadraoVisa` | ✅ |
| P3 / P4 | Backend sem HtmlService; `URL_DA_API` vazia no repositório | ok | ✅ |

### Link de configuração no app (F)
| # | Caso | Esperado | Resultado |
|---|---|---|---|
| F1 / F2 | Link válido (com ou sem "=" no final) | `{api, token}` | ✅ |
| F3 / F4 / F5 | base64 inválido / não é JSON / link cortado | "O link de configuração está incompleto ou foi copiado errado. Peça um link novo." | ✅ |
| F6 / F7 | JSON sem `api` / sem `token` | mensagem própria para cada um | ✅ |
| F8 / F9 | `api` que não é `/exec` (ou outro site) / token curto ou com espaço | recusado | ✅ |
| F10 | Endereço sem `#cfg=` | não é link de configuração (`null`) | ✅ |
| F11 | **Link gerado pelo backend** é lido pelo app | `{api, token}` idênticos | ✅ |
| F12 / F13 | Configuração manual; "Planilha conectada" mostra só o final da URL | ok | ✅ |
| — | Formato `/exec` e mensagem "Acesso não autorizado" iguais no app e no backend | ok | ✅ |
| — | Toda a casca do service worker existe; todo arquivo usado pelo `index.html` está na casca; manifest correto | ok | ✅ |
| — | **Varredura do repositório:** nenhuma URL `/exec` real, token, link `#cfg=` ou ID de planilha | nada encontrado | ✅ |

### Tela (Chrome headless, API simulada em `localhost`)
| Cenário | Resultado |
|---|---|
| Aparelho sem configuração | tela de conexão; abas escondidas; "Configurar manualmente" abre os campos ✅ |
| Abrir pelo link `#cfg=` | conexão guardada, **endereço limpo** (sem `#cfg`), "Aparelho conectado à planilha ✓", app aberto; uma edição salva com POST de texto ✅ |
| Link inválido (`#cfg=@@@`) | mensagem simples; nada guardado; endereço limpo ✅ |
| Link com token errado | "Este link não dá mais acesso à planilha. Peça um link novo."; nada guardado ✅ |
| Configuração manual | URL `/dev` recusada com mensagem; com a URL certa conecta ✅ |
| Desconectar | confirmação na página → tela de conexão; conexão e cache apagados ✅ |
| Sem internet (com cache) | "Sem conexão: só orçamento"; edição bloqueada; orçamento calcula (R$ 447,00) ✅ |
| Token trocado | faixa "Este aparelho perdeu o acesso à planilha…"; status "Sem acesso à planilha"; edição bloqueada ✅ |
| `?teste=1` | "22 de 22 passaram." ✅ |
| PWA (Chrome em tempo real) | service worker ativo; casca com 15 arquivos; versão "v1"; **em modo avião o app abre** (faixa offline, fonte Inter, logo); publicação "v2" → "Nova versão disponível · ATUALIZAR" → recarrega na v2 e o cache antigo é apagado ✅ |

Nenhum erro de JavaScript em nenhum cenário. Os fluxos já existentes (cartões, Desfazer, orçamento) continuam com a mesma lógica; só a camada de comunicação mudou.

## Divergências conhecidas

| Caso | App InfinitePay | Nosso cálculo | Diferença | Decisão |
|---|---|---|---|---|
| 1x 3,15% sobre R$ 1.000 | 1.032,53 | 1.032,52 | R$ 0,01 | **Aceito** |

1x 3,15% sobre R$ 1.000: o app InfinitePay mostra 1.032,53; nosso cálculo dá 1.032,52 (diferença de R$ 0,01, provavelmente porque a taxa real é exibida arredondada). Aceito.

Detalhes:
- Total exato: 1.000 ÷ (1 − 0,0315) = 1.032,5245…, que com arredondamento comercial dá 1.032,52.
- Para dar 1.032,53, a taxa real teria de estar entre 3,15004% e 3,15098%.
- Nenhuma regra simples bate com os 4 casos conferidos: arredondar para cima acerta o 1x, mas erra o 2x (daria 1.056,98 em vez de 1.056,97). Por isso a fórmula **não** foi alterada.
