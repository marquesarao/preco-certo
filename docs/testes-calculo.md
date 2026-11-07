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

**Frontend: 85 de 85 · Backend (dados): 45 de 45 · API: 26 de 26 · Tela: 10 cenários + 108 verificações (desconto, engrenagem, PIN, desconto padrão, peças discriminadas, dicas "?", card "Ver outras formas", espaço entre os botões, "Neste serviço"), estável em 3 rodadas seguidas · PWA: install, modo avião e versão nova.**

> Pacote "dicas ? + peças discriminadas": `apps-script/` sem nenhuma mudança (D10); `sw.js` v3. Os casos D usam peças = 1 item 1 × 100 e continuam iguais.

> Pacote "desconto à vista + engrenagem + PIN": `apps-script/` sem nenhuma mudança (D10). O cálculo novo está em `calcularPrecoComDesconto`.

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
| P5 | Peças discriminadas 2 × 50 + 1 × 350 | 450 pagos; + 47% → cliente 661,50 (Node e tela) | ✅ |
| P6 | Quantidade decimal 4,5 × 30 | 135 → cliente 198,45; "4,5" aceito; 0, vazio e "-1" recusados; na tela, qtd 0 mostra erro e a peça sai do total | ✅ |
| P7 | Lista vazia | peças 0, sem erro; base = só a mão de obra (8 h × 150 = 1.200,00); na tela, a dica "Sem peças?" | ✅ |
| P8 | Remover + desfazer; Novo orçamento | "Peça removida · DESFAZER"; volta no mesmo lugar ("Peça de volta."); depois de 6 s a remoção fica; nada salvo na planilha; "Novo orçamento" limpa a lista (tela) | ✅ |
| P9 | WhatsApp com peças | "Peças inclusas:", "2× Pastilha de freio", "1× Disco de freio", "4,5× Óleo 5W30", sem nenhum "R$"; peça sem descrição não aparece mas entra no total; depois os cartões (Node e tela, texto copiado de verdade) | ✅ |
| P10 | Modo "valor direto" | esconde a lista; P1–P4 continuam passando; WhatsApp sem lista; ao voltar, a lista está como antes (tela) | ✅ |
| — | Rascunho | a lista volta igual depois de recarregar a página | ✅ |
| — | `acrescimoPecasPadrao` lido fora do limite ("1500", "-1", "abc") | volta ao padrão 47; "0" → 0; "47,5" → 47,5; linha ausente → 47 | ✅ (back) |

### Neste serviço: oficina, casa e sobra (R)
Cenário S: gastos Oficina 4.000 e Casa 3.000; 5 dias × 6 h × 52/12 = 130 h; serviço 8 h × 150; peças pagas 400 (cobra 500); sem cartões (âncora = base); imposto 0.

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| R1 | Oficina e casa | 8 × 4.000/130 = 246,15 · 8 × 3.000/130 = 184,62 | ✅ |
| R2 | Sobra (preço 1.700) | 1.700 − 246,1538 − 184,6154 − 400 = 869,23, igual ao antigo "lucro" (`preco.lucro` e `aVista.lucro`) | ✅ |
| R3 | Total que é seu | 184,6154 + 869,2308 = 1.053,85 | ✅ |
| R4 | Pisos | oficina 646,15 · casa 830,77 (= piso antigo) · verde | ✅ |
| R5 | Preço 700 (valor fechado 200 + peças 500) | sobra −130,77; ≥ piso da oficina → âmbar | ✅ |
| R6 | Preço 600 | < 646,15 → vermelho | ✅ |
| R7 | Sem gastos de casa | sem linha da casa, sem "total que é seu", um só piso; oficina continua 246,15 | ✅ |
| R8 | Linhas do detalhe | fecham no centavo com a sobra exibida em S, S 700, S sem casa e no cenário D (5% e 10%, com imposto e diferença do desconto) | ✅ |

**Linguagem única:** um teste automático confere que nenhum texto da interface (index.html e frases do js/app.js) usa "lucro"; a única exceção é "Lucro nas peças". As faixas do desconto viraram "…sem perder nada — é só a taxa da maquininha que você não vai pagar." e "Com esse desconto você abre mão de R$ X da sua sobra extra." ✅

### Texto do WhatsApp (W)
| # | Caso | Esperado | Resultado |
|---|---|---|---|
| W4 | Negrito, ordem e acréscimo | `*Orçamento – CliniCar Motors Tech*` (ou `*Orçamento*`); cartão primeiro, `💵 À vista (Pix/dinheiro): *R$ 1.935,00*` por último; sem "Mão de obra"/"Peças"; o 47% não aparece | ✅ |

W1–W3 (fechamento da quebra "Mão de obra + Peças" no centavo) foram **removidos** junto com a quebra e com `valoresWhatsApp`, a pedido.

### Desconto à vista ancorado no cartão (D) e desconto padrão do aparelho (L)
Cenário: 12 h × R$ 165 + peças R$ 100 com 47% → base R$ 2.127,00; Visa/Master; destaque 5x e 10x; imposto 10%; gasto das horas R$ 936,92.

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| D1 | Âncora = 1ª parcela em destaque com taxa (5x 7,57%) | Total 2.301,20 · 5× 460,24 | ✅ |
| D2 | Desconto 5% | à vista 2.186,14 | ✅ |
| D3 | Máximo e "ainda pode dar" | máximo 7,57%; com 5%: 2,57% = R$ 59,14 | ✅ |
| D4 | Lucro com 5% | 2.186,14 − 936,92 − 100 − 218,61 = 930,61 | ✅ |
| D5 | Desconto 10% (acima do máximo) | 2.071,08; ainda pode 0; abre mão de R$ 55,92 | ✅ |
| D6 | Extra 2% soma aos 5% | 7% → 2.140,12; ainda 0,57%; total limitado a 99 | ✅ |
| D7 | Piso de prejuízo | (936,92 + 100) ÷ 0,9 = 1.152,13 | ✅ |
| D8 | Nenhuma parcela em destaque com taxa | âncora = base, sem desconto, sem erro | ✅ |
| D9 | WhatsApp | sem "ainda", "lucro", "taxa", "piso", "prejuízo"; desconto 0 → sem "de desconto" | ✅ |
| D10 | `apps-script/` | `git diff` e `git status` vazios | ✅ |
| D11 | 10x Visa 11,06% sobre a base | 2.127 ÷ 0,8894 = 2.391,4999 → Total 2.391,50 · 10× 239,15, também no WhatsApp | ✅ |
| D12 | Parcelas em destaque × à vista oferecido (0%, 5%, 7%, 10%) | nenhum total abaixo do à vista (Node e tela) | ✅ |
| L1 | Desconto padrão do aparelho | nada salvo → 5; "7" → 7; "7,5" → 7,5; "0" → 0; "abc", "150", "-1" → 5 | ✅ |

Com desconto 0, o à vista é igual à âncora (2.301,20).

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
| Aparelho sem configuração | tela de conexão; engrenagem e status escondidos; "Configurar manualmente" abre os campos ✅ |
| Abrir pelo link `#cfg=` | conexão guardada, **endereço limpo** (sem `#cfg`), "Aparelho conectado à planilha ✓", app aberto; uma edição salva com POST de texto ✅ |
| Link inválido (`#cfg=@@@`) | mensagem simples; nada guardado; endereço limpo ✅ |
| Link com token errado | "Este link não dá mais acesso à planilha. Peça um link novo."; nada guardado ✅ |
| Configuração manual | URL `/dev` recusada com mensagem; com a URL certa conecta ✅ |
| Desconectar | confirmação na página → tela de conexão; conexão e cache apagados ✅ |
| Sem internet (com cache) | "Sem conexão: só orçamento"; edição bloqueada; orçamento calcula ✅ |
| Token trocado | faixa "Este aparelho perdeu o acesso à planilha…"; status "Sem acesso à planilha"; edição bloqueada ✅ |
| `?teste=1` | "31 de 31 passaram." ✅ |
| PWA (Chrome em tempo real) | service worker ativo; casca com 15 arquivos; versão "v2"; **em modo avião o app abre** (faixa offline, fonte Inter, logo); publicação simulada "v3" → "Nova versão disponível · ATUALIZAR" → recarrega na v3 e o cache antigo é apagado ✅ |
| **Engrenagem** | abre só no Orçamento, sem barra de abas; engrenagem com `aria-label="Configurações"` e área de toque ≥ 44 px; abre Configurações → Meus gastos; aba Ajustes; "← Voltar ao orçamento", **Esc** e o **voltar do navegador** voltam ao orçamento sem sair do app; reabre na última aba; links "Meus gastos"/"Ajustes" das dicas abrem a aba certa ✅ |
| **Primeiro acesso** (sem gastos) | abre direto em Configurações → Meus gastos, com a faixa; "voltar" leva ao orçamento ✅ |
| **PIN** | desligado: a engrenagem não pede nada; ligar recusa PIN curto e PINs diferentes; ligado: a engrenagem pede o PIN; PIN errado não abre ("PIN errado. Tente de novo."); Esc volta; PIN certo abre; "avançar" do navegador não pula o PIN; "Esqueci o PIN" → desconectar apaga o PIN e **mantém o desconto padrão**; abrir o link de configuração de novo apaga o PIN, inclusive com o app já aberto na mesma aba (só muda o `#`) ✅ |
| **Desconto padrão do aparelho** | nada salvo → 5; Ajustes mostra 5 e "Vale só para este aparelho."; 150 → erro e não grava; 7 → gravado; mudar no orçamento não muda o padrão; Novo orçamento começa com 7; valor inválido guardado → 5 ✅ |
| **Neste serviço** | cenário S na tela: "Sobra extra: R$ 869,23" verde; "Total que é seu (casa + sobra): R$ 1.053,85" visível com peso 600; detalhes na ordem pedida (1.200,00 · 100,00 · − 246,15 · − 184,62 · 869,23) com a nota "é o seu salário"; os dois pisos; o "?" do título; preço 700 → âmbar "− R$ 130,77" e "Paga a oficina, mas não cobre toda a sua casa."; preço 600 → vermelho "Com esse preço a oficina não se paga."; sem casa → linhas e piso da casa somem; a soma visível fecha no centavo nos três estados e no cenário de desconto; WhatsApp sem "sobra", "casa", "salário", "oficina não se paga". Prints 390 e 1280 dos 3 estados ✅ |
| **Card "Ver outras formas"** | parcelas "5": só o link, sem fundo, sem sombra e sem área reservada, a 16 px do bloco de cima (espaçamento normal); o 5x continua no card do cartão; aberto, a lista aparece num card normal. Parcelas "5,10": card normal com o 10x. Prints 390 e 1280 dos dois casos ✅ |
| **Botões do fim do orçamento** | Copiar para WhatsApp · Compartilhar · Novo orçamento com 10 px entre eles (antes, "Novo orçamento" ficava colado) ✅ |
| **Dicas "?"** | 11 botões com `aria-label` "O que é \"…\"?" e área de toque ≥ 44 px; o do Desconto à vista mostra o máximo do orçamento (7,57%); só um aberto por vez; novo toque, toque fora e Esc fecham; em Configurações o 1º Esc fecha só o balão e o 2º volta ao orçamento; texto do Imposto conferido ✅ |
| **Desconto na tela** | card do cartão 5x 460,24 / 2.301,20; à vista 2.186,14 "· 5% de desconto"; faixa "ainda pode dar até 2,57% (R$ 59,14)"; 10x 239,15 / 2.391,50; detalhes somam o lucro (com "Diferença pelo desconto à vista" e imposto); piso; extra 2% → 2.140,12 / 0,57% (R$ 13,12); extra 5% → 2.071,08 + faixa vermelha "abre mão de R$ 55,92"; desconto 0 → 2.301,20 sem sufixo; 120 → erro; texto do WhatsApp copiado de verdade (área de transferência) na ordem certa e sem palavras proibidas; sem rolagem horizontal em 390 px ✅ |

Nenhum erro de JavaScript em nenhum cenário. Os fluxos já existentes (cartões, Desfazer, link, manual, desconectar, offline, sem acesso) foram refeitos com a engrenagem no lugar das abas e continuam passando.

## Divergências conhecidas

| Caso | App InfinitePay | Nosso cálculo | Diferença | Decisão |
|---|---|---|---|---|
| 1x 3,15% sobre R$ 1.000 | 1.032,53 | 1.032,52 | R$ 0,01 | **Aceito** |

1x 3,15% sobre R$ 1.000: o app InfinitePay mostra 1.032,53; nosso cálculo dá 1.032,52 (diferença de R$ 0,01, provavelmente porque a taxa real é exibida arredondada). Aceito.

Detalhes:
- Total exato: 1.000 ÷ (1 − 0,0315) = 1.032,5245…, que com arredondamento comercial dá 1.032,52.
- Para dar 1.032,53, a taxa real teria de estar entre 3,15004% e 3,15098%.
- Nenhuma regra simples bate com os 4 casos conferidos: arredondar para cima acerta o 1x, mas erra o 2x (daria 1.056,98 em vez de 1.056,97). Por isso a fórmula **não** foi alterada.
