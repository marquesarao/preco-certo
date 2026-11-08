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

## Resultados (08/11/2026)

**Fase 11 (tela mais simples + mês atual automático): Frontend 105/105 (os 96 de antes + 9 casos novos) · Backend (dados) 45/45 · API 26/26 · Backend de orçamentos 79/79 · Tela 111/111 (fluxos antigos) + 81/81 (fase 10) + 65/65 (fase 11), estáveis em 3 rodadas seguidas · 10 cenários antigos sem erro · PWA: v6 → v7.**

> Fase 11: só frontend. `apps-script/` sem mudança (o teste D10 confere o sha256 da versão aprovada na 10a). `sw.js` v6. Nenhum caso de cálculo antigo mudou; os testes de tela antigos mudaram só onde a seção 12 do DESENHO mudou a tela (ex.: "+ Novo orçamento" pergunta antes, extra atrás do link, card "Fica para você", 18 "?", a linha do mês atual na aba Meses criada ao abrir Resultados).

> Fase 10 (07/11/2026): Frontend 96/96 · Backend (dados) 45/45 · API 26/26 · Backend de orçamentos 79/79 · Tela 109/109 (fluxos antigos) + 81/81 (fase 10, com o `Codigo.gs` real rodando na página), estáveis em 3 rodadas seguidas · 10 cenários antigos sem erro · PWA: v5 → v6.**

> Fase 10: o backend mudou de propósito na fatia 10a (aprovada). Na 10b o `Codigo.gs` não muda: o teste D10 confere o sha256 da versão aprovada. `sw.js` v5.

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
| L1 | Desconto padrão do aparelho (agora só para a migração) | nada salvo → 5; "7" → 7; "7,5" → 7,5; "0" → 0; "abc", "150", "-1" → 5 | ✅ |
| L2 | Desconto padrão dos Ajustes (aba Parâmetros) | 7,5 → 7,5; 0 → 0; ausente, 100 ou texto → 5 | ✅ |

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
| **Engrenagem** | abre no Orçamento (fase 10: com as abas Orçamento \| Resultados no topo); engrenagem com `aria-label="Configurações"` e área de toque ≥ 44 px; abre Configurações → Meus gastos; aba Ajustes; "← Voltar ao orçamento", **Esc** e o **voltar do navegador** voltam ao orçamento sem sair do app; reabre na última aba; links "Meus gastos"/"Ajustes" das dicas abrem a aba certa ✅ |
| **Primeiro acesso** (sem gastos) | abre direto em Configurações → Meus gastos, com a faixa; "voltar" leva ao orçamento ✅ |
| **PIN** | desligado: a engrenagem não pede nada; ligar recusa PIN curto e PINs diferentes; ligado: a engrenagem pede o PIN; PIN errado não abre ("PIN errado. Tente de novo."); Esc volta; PIN certo abre; "avançar" do navegador não pula o PIN; "Esqueci o PIN" → desconectar apaga o PIN e **mantém o desconto padrão**; abrir o link de configuração de novo apaga o PIN, inclusive com o app já aberto na mesma aba (só muda o `#`) ✅ |
| **Desconto padrão do aparelho** | nada salvo → 5; Ajustes mostra 5 e "Vale só para este aparelho."; 150 → erro e não grava; 7 → gravado; mudar no orçamento não muda o padrão; Novo orçamento começa com 7; valor inválido guardado → 5 ✅ |
| **Neste serviço** | cenário S na tela: "Sobra extra: R$ 869,23" verde; "Total que é seu (casa + sobra): R$ 1.053,85" visível com peso 600; detalhes na ordem pedida (1.200,00 · 100,00 · − 246,15 · − 184,62 · 869,23) com a nota "é o seu salário"; os dois pisos; o "?" do título; preço 700 → âmbar "− R$ 130,77" e "Paga a oficina, mas não cobre toda a sua casa."; preço 600 → vermelho "Com esse preço a oficina não se paga."; sem casa → linhas e piso da casa somem; a soma visível fecha no centavo nos três estados e no cenário de desconto; WhatsApp sem "sobra", "casa", "salário", "oficina não se paga". Prints 390 e 1280 dos 3 estados ✅ |
| **Card "Ver outras formas"** | parcelas "5": só o link, sem fundo, sem sombra e sem área reservada, a 16 px do bloco de cima (espaçamento normal); o 5x continua no card do cartão; aberto, a lista aparece num card normal. Parcelas "5,10": card normal com o 10x. Prints 390 e 1280 dos dois casos ✅ |
| **Botões do fim do orçamento** | Copiar para WhatsApp · Compartilhar · Novo orçamento com 10 px entre eles (antes, "Novo orçamento" ficava colado) ✅ |
| **Dicas "?"** | 11 botões com `aria-label` "O que é \"…\"?" e área de toque ≥ 44 px; o do Desconto à vista mostra o máximo do orçamento (7,57%); só um aberto por vez; novo toque, toque fora e Esc fecham; em Configurações o 1º Esc fecha só o balão e o 2º volta ao orçamento; texto do Imposto conferido ✅ |
| **Desconto na tela** | card do cartão 5x 460,24 / 2.301,20; à vista 2.186,14 "· 5% de desconto"; faixa "ainda pode dar até 2,57% (R$ 59,14)"; 10x 239,15 / 2.391,50; detalhes somam o lucro (com "Diferença pelo desconto à vista" e imposto); piso; extra 2% → 2.140,12 / 0,57% (R$ 13,12); extra 5% → 2.071,08 + faixa vermelha "abre mão de R$ 55,92"; desconto 0 → 2.301,20 sem sufixo; 120 → erro; texto do WhatsApp copiado de verdade (área de transferência) na ordem certa e sem palavras proibidas; sem rolagem horizontal em 390 px ✅ |

Nenhum erro de JavaScript em nenhum cenário. Os fluxos já existentes (cartões, Desfazer, link, manual, desconectar, offline, sem acesso) foram refeitos com a engrenagem no lugar das abas e continuam passando.

### Fase 10: fechamento (FC) e resumo do mês (M) — cenário F, DESENHO 11.6
Cenário F: oficina R$ 4.000 e casa R$ 3.000; 130 h; hora R$ 150; imposto 6%; Visa/Master padrão; serviço 8 h; 1 peça 400 + 25%; desconto 5% → base 1.700,00, âncora 5x 1.839,23, à vista oferecido 1.747,27.

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| FC1 | Pix pelo oferecido | 1.747,27 − 0 − 104,84 − 400 − 246,15 − 184,62 = **811,66** · total seu 996,28 | ✅ |
| FC1 | Débito 1,37% | 1.700 ÷ 0,9863 = 1.723,61; taxa 23,61; imposto 103,42 → **765,81** · 950,43 | ✅ |
| FC1 | Cartão 5x 7,57% | 1.839,23; taxa 139,23; imposto 110,35 → **758,88** · 943,50 | ✅ |
| FC1 | Cartão 10x 11,06% | 1.700 ÷ 0,8894 = 1.911,40; taxa 211,40; imposto 114,68 → **754,55** · 939,17 | ✅ |
| FC1 | Pix com valor alterado (1.700) | imposto 102,00 → **767,23** · 951,85 | ✅ |
| FC2 | Coerência com o orçamento | Pix pelo oferecido = sobra de "Neste serviço" (811,66); 5x pelo total = sobra extra no cartão em 5x (758,88) | ✅ |
| FC3 | Soma no centavo (regra do R8) | 20 valores × com casa / sem casa / sem horas × Pix, débito, 7x: V − taxa − imposto − peças − oficina − casa = sobra; nenhuma linha negativa | ✅ |
| FC4 | Estados | 1.747,27 verde; 800 âmbar (sobra −78,77, paga a oficina); 600 vermelho (−266,77) | ✅ |
| FC5 | Foto × recalcular | gastos 5.000/3.500 → oficina 307,69 na conta de hoje; refeita com a foto gravada = resultado gravado; forma sem taxa → sem fechamento | ✅ |
| M1 | Mês da 11.6 (5 fechados, 2 não fecharam, 1 aberto; foto 4.000/3.000/130 h) | faturamento 8.921,51 · peças 2.000,00 · taxas 374,24 · imposto 535,29 · depois da oficina 2.011,98 (oficina se pagou) · casa em parte 2.011,98 de 3.000,00 (67%) · sobra do mês **−988,02** (âmbar) · total que é seu 2.011,98 · 40 de 130 h (31%) · 8 · 5 fecharam (63%) · vs. anterior (7.500,00 / −1.500,00): ↑ R$ 1.421,51 (19%) · sobra ↑ R$ 511,98 | ✅ |
| M2 | Outros gastos com os mesmos fechamentos | casa 1.500 → casa toda, sobra 511,98 (verde) · oficina 8.000 → −1.988,02, casa nada, total seu 0 (vermelho) · sem foto → sem resultado | ✅ |
| M3 | Mês pela data do fechamento | feito em 28/10, fechado em 03/11 → conta como feito em outubro; dinheiro e horas em novembro | ✅ |
| M4 | Navegação de meses | 2026-12 → 2027-01 e volta; −13 meses; "Novembro 2026"/"março"; `mesDe` | ✅ |
| M5 | Busca | "joao" acha "João"; "GOL" acha o serviço; "98888-77" e "11 9888" acham "(11) 98888-7777"; "maria" não acha | ✅ |

### Fase 10: backend de orçamentos (O) — Node, planilha simulada, relógio controlado
| # | Caso | Resultado |
|---|---|---|
| O1 | Upsert: mesmo ID → 1 linha ("Criado em" mantido, "Atualizado em" novo); ID novo → linha nova; cada gravação escreve **uma** linha (nunca a aba inteira) | ✅ |
| O2 | Conflito: B salva com base velha → `conflito:true` + mensagem, a linha fica com os dados de A; ID existente sem base → conflito; mudar situação e excluir com base velha → conflito | ✅ |
| O3 | Dois aparelhos, orçamentos diferentes intercalados → os dois gravados, nenhum tocou no outro | ✅ |
| O4 | **Excluído não ressuscita:** A abre, B exclui, A salva → "excluído em outro aparelho", nenhuma linha criada; "salvar como novo" (ID novo, sem base) → linha nova; mudar situação de excluído → recusado; excluir de novo → ok | ✅ |
| O5 | Fechamentos da 11.6 gravados nas colunas I–T; somas do mês pela lista (8.921,51 · 2.000 · 374,24 · 535,29 · 40 h); cada linha fecha no centavo | ✅ |
| O6 | Fechamento: soma, taxa, imposto e total que é seu conferidos (±1 centavo); data futura/inexistente/antes de 2000; parcelas 13; forma desconhecida; Pix com taxa; valor 0; nada gravado quando recusa; Fechado só aceita cliente/telefone; Aberto desfaz; Não fechou com motivo | ✅ |
| O7 | Aba Meses: 1º fechamento de cada mês grava a foto (mês da DATA DO FECHAMENTO); mudar os gastos não muda meses gravados; "Usar meus gastos de hoje" troca só aquele mês; mês futuro recusado | ✅ |
| O8 | Listar: feitos OU fechados no mês e no anterior; primeiroMes; mês vazio; virada de ano | ✅ |
| O9 | Leitura tolerante: JSON corrompido ignorado e registrado no log; sem ID / ID ruim ignorados; situação desconhecida → Aberto; Meses inválido → sem foto | ✅ |
| O10 | `salvarDados` não altera Orçamentos nem Meses (conteúdo idêntico, nenhuma escrita) | ✅ |
| O11 | Validação rígida: cliente 61, telefone com letra/21, 31 peças, JSON > 30.000, ID, versão, modo, estado, centavos, ajustes e cartões da foto | ✅ |
| O12 | Desconto padrão: planilha nova com 5; planilha antiga → `parametrosAusentes`; **tela antiga sem a chave mantém o valor da aba**; fora de 0–99 → erro | ✅ |
| O13 | Roteador: ações novas sem token → "Acesso não autorizado" sem tocar na planilha; funções internas → "Ação desconhecida."; públicas continuam as 5 | ✅ |
| O14 | Carimbo com milissegundos no fuso de São Paulo; mesmo milissegundo → carimbo diferente | ✅ |
| O15 | `testarApi()` inteiro passa e não deixa rastro | ✅ |
| O16 | Proteção "somente aviso" + nota em A1 nas abas Orçamentos e Meses; não duplica (5 pedidos, e mesmo sem a marca); o app continua gravando | ✅ |

### Fase 10: tela (Chrome headless, `Codigo.gs` real rodando na página)
| Cenário | Resultado |
|---|---|
| **Topo** | abas Orçamento \| Resultados (≥ 44 px); Resultados no mês atual; mês vazio com mensagem; › e ‹ desabilitados quando não há para onde ir ✅ |
| **Salvar** | telefone com letra não salva; "Salvar orçamento" → "Orçamento salvo ✓" + "Salvo · Aberto · João Silva"; copiar sem mudança não chama o servidor; copiar com mudança salva no MESMO registro ("Copiado ✓ · Orçamento salvo ✓"); **sem conexão: copia e mostra em vermelho "Sem conexão: orçamento NÃO foi salvo."**; WhatsApp sem cliente/telefone/situação/termos internos ✅ |
| **Fechamento** | Pix 1.747,27 → 811,66; Débito 1.723,61 → 765,81; 5x 1.839,23 → 758,88; 10x 1.911,40 → 754,55; valor alterado 1.700 → 767,23; detalhes fecham no centavo; valor 0 e data futura bloqueiam; confirmar trava os valores (cliente continua editável); planilha e aba Meses gravadas ✅ |
| **Situação** | Voltar para Aberto com confirmação ("O fechamento de R$ 1.747,27 será desfeito."); Não fechou com motivo ✅ |
| **Foto × recalcular** | gastos mudam → orçamento continua com os valores do dia + "Valores de …"; "Recalcular" → sobra 780,90 sem gravar; salvar grava a foto nova ✅ |
| **Dois aparelhos** | conflito → "Esse orçamento foi alterado em outro aparelho." → "Ver a versão nova" carrega a do outro; excluído em outro aparelho → recusado, não ressuscita → "Salvar as minhas como novo" cria ID novo ✅ |
| **Lista** | busca por cliente, telefone (só números) e serviço; filtros; Excluir + DESFAZER (nada enviado); sem desfazer, o pedido vai depois de 6 s; rascunho não salvo pergunta antes de abrir outro ("Salvar e abrir"); Duplicar; fechar pela lista volta para a lista; `visibilitychange` atualiza ✅ |
| **PIN** | Resultados pede o PIN ("Resultados protegidos"); o desbloqueio vale para a engrenagem; mais de 5 min em segundo plano → pede de novo ✅ |
| **Mês da 11.6** | "Sim. Sobraram R$ 2.011,98" · "Em parte: R$ 2.011,98 de R$ 3.000,00 (67%)" · "− R$ 988,02" âmbar · "Total que é seu no mês: R$ 2.011,98" · comparação "↑ R$ 1.421,51 (19%) · sobra ↑ R$ 511,98" · 8 · 5 fecharam · 2 não fecharam · 1 em aberto · 63% · dinheiro 8.921,51 / 2.000,00 / 374,24 / 535,29 · 40 de 130 horas — 31%; mês anterior −1.500,00 ✅ |
| **Mês positivo** (casa 1.500) | "Sim, toda: R$ 1.500,00" · sobra R$ 511,98 verde ✅ |
| **Desconto padrão** | planilha antiga + aparelho 8% → grava 8 e apaga a chave; planilha 5% + aparelho 7% → planilha vence, avisa e apaga; campo em Outros ajustes (some de "Este aparelho"); 150 → erro; 7,5 gravado; orçamento novo usa 7,5 ✅ |

### Fase 11: orçamento do print (PR), card do mês (Q) e alerta do piso (A)
Orçamento do print (dados reais): oficina 3.150 e casa 5.500; 5 dias × 6 h = 130 h (mínimo/h oficina 24,2308 · casa 42,3077); hora R$ 100; imposto 10%; serviço 10 h; peças 4 × 500 + 1 × 1.500 com 47%; desconto 5%; Visa/Master padrão e Elo; parcelas "5"; "Não sei".

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| PR1 | Aberto | 5x 6.648,27 (5× 1.329,65) · à vista 6.315,86 · ainda pode 2,57% / 170,86 · imposto 631,59 · oficina 242,31 · casa 423,07 · sobra 1.518,89 · total seu 1.941,96 · pisos 4.158,12 / 4.628,21 · sobra no cartão 1.314,79 · "No cartão em 5x fica" 1.737,86 | ✅ |
| PR2 | Fechado em 5x por 6.648,27 | taxa 503,27 · imposto 664,83 · oficina 242,31 · **casa 423,08 + sobra 1.314,78 = 1.737,86** (divergência aceita, abaixo) | ✅ |
| Q1 | Mês do exemplo: F 9.126,93 · P 3.780 · T 503,27 · I 912,70 · 30 h · 3 fechados · GO 3.150 · GC 5.500 | livre 3.930,96 · 131,03/h · oficina paga · casa 780,96 (14%) · falta 4.719,04 → **37 h** (36,01) · média 10 h → **4 serviços** | ✅ |
| Q2 | Sem horas; livre ≤ 0; mês passado | "quanto falta trabalhar" não aparece | ✅ |
| Q3 | Sobra do mês ≥ 0 (casa 500 → 280,96); sem gastos do mês | não aparece; sem card | ✅ |
| Q4 | Extrato | Entrou − Peças − Maquininha − Imposto − Oficina = Ficou para a casa (780,96) − Casa = Faltou (−4.719,04), no centavo; sem casa e oficina não paga ("Faltou para a oficina" −1.069,04) | ✅ |
| Q5 | Frases × mês corrente/passado | "Sobrou R$ 280,96 além da casa (este mês)" verde · "Faltam/Faltaram R$ 4.719,04 para cobrir a casa" âmbar/vermelho · "Faltam/Faltaram R$ 1.069,04 para pagar a oficina" · sem casa: "além da oficina" | ✅ |
| Q6 | Barras | oficina 100% e casa 14%; oficina 79% (3.930,96 de 5.000) e casa 0%; sem casa: sem barra da casa | ✅ |
| A1 | Alerta do piso (4.158,12 / 4.628,21) | 6.315,86 nada · até 5.091,03 âmbar (casa) · 5.091,04 nada · < 4.158,12 vermelho · sem casa: âmbar até 4.573,93 | ✅ |

### Fase 11: tela (Chrome headless, `Codigo.gs` real na página) — 65 verificações

| Área | O que foi conferido | Resultado |
|---|---|---|
| Aberto | valores do print; extra e "ainda pode" escondidos até o link; extra > 0 reabre aberto; "Ver detalhes" fechado; "Ganho/Perda por desconto…"; botões Copiar + Salvar e "O cliente fechou?" | ✅ |
| Alerta do piso | 20% nada; 24% número verde + âmbar da casa; 40% vermelho da oficina | ✅ |
| Compartilhar | só com `navigator.share` e tela estreita (some em 1280 e sem o recurso) | ✅ |
| Fechado 5x / Pix | resumo; sem cards de cobrança; "Fica para você" 1.737,86 (423,08 + 1.314,78) e 1.941,96 no Pix; detalhes no centavo; botões Copiar · Mudar situação · Duplicar | ✅ |
| Não fechou | pela tela de fechamento; "Não fechou · DD/MM · motivo"; só Voltar para Aberto e Duplicar; "Voltar para Aberto" na tela de fechamento | ✅ |
| + Novo orçamento | sem alteração: direto; com alteração: Salvar e começar novo / Começar sem salvar / Cancelar | ✅ |
| Resultados | título "… até agora · dia N de M"; barras; frase âmbar; 37 h / 4 serviços; extrato no centavo com subtotais em negrito; rodapé; sem o link antigo | ✅ |
| Mês automático | mudar gasto → foto do mês atual (sem aviso); falha → pendente → refeito no próximo salvamento; outro aparelho → atualiza ao abrir Resultados; mês seguinte simulado não mexe no anterior | ✅ |
| Corrigir mês passado | escondido em Outros ajustes; mostra gravados × hoje; confirmação; Cancelar não muda; "Sim, trocar" grava | ✅ |

## Divergências conhecidas

| Caso | App InfinitePay | Nosso cálculo | Diferença | Decisão |
|---|---|---|---|---|
| 1x 3,15% sobre R$ 1.000 | 1.032,53 | 1.032,52 | R$ 0,01 | **Aceito** |
| Fechamento em 5x do orçamento do print (fase 11) | aberto: sobra no cartão 5x 1.314,79 (casa 423,07) | fechamento: 423,08 + 1.314,78 | R$ 0,01 na divisão casa/sobra; total que é seu igual (1.737,86) | **Aceito** |

1x 3,15% sobre R$ 1.000: o app InfinitePay mostra 1.032,53; nosso cálculo dá 1.032,52 (diferença de R$ 0,01, provavelmente porque a taxa real é exibida arredondada). Aceito.

Detalhes:
- Total exato: 1.000 ÷ (1 − 0,0315) = 1.032,5245…, que com arredondamento comercial dá 1.032,52.
- Para dar 1.032,53, a taxa real teria de estar entre 3,15004% e 3,15098%.
- Nenhuma regra simples bate com os 4 casos conferidos: arredondar para cima acerta o 1x, mas erra o 2x (daria 1.056,98 em vez de 1.056,97). Por isso a fórmula **não** foi alterada.

Orçamento aberto mostra sobra no cartão 5x de 1.314,79 (casa absorve o centavo: 423,07); no fechamento a divisão gravada é 423,08 + 1.314,78. O total que é seu (1.737,86) é idêntico. Aceito.
- Motivo: a casa exata é 10 h × 42,3077 = 423,0769. Na tela aberta, "Vai para a sua casa" absorve o centavo para os detalhes fecharem com a sobra (R8); no fechamento, cada linha é arredondada sozinha (regra da fase 10) e a soma já fecha sem ajuste.
