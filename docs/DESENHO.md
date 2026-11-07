# Preço Certo – Oficina · Desenho do projeto

> **Fonte da verdade do projeto.** Qualquer mudança de regra, tela ou dado é registrada aqui no mesmo commit que a implementa.

## 1. Contexto

App web gratuito para um mecânico que abriu uma oficina e tem pouca familiaridade com finanças e tecnologia. Ele calcula quanto cobrar em um serviço, já com a taxa da maquininha repassada ao cliente, e mostra o lucro real.

### Arquitetura (modelo do app Pendências)
- **Tela no GitHub Pages:** HTML, CSS e JS estáticos, num repositório **público** `marquesarao/preco-certo`, publicado em **https://marquesarao.github.io/preco-certo/**. Publicar a tela = `git push`.
- **Apps Script como API:** vinculado a **cada planilha**, colado à mão uma vez, só lê e grava a planilha. App da Web com **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**. O que protege os dados é o **token**.
- **Um único app (mesmo link) para todos.** Cada **aparelho** fica ligado à planilha do seu dono (a planilha de teste do dono do projeto; a planilha do mecânico, na conta dele) por um **link de configuração** `#cfg=`.
- **PWA instalável** (manifest, service worker, ícones CliniCar): botão "Instalar" no celular e no notebook; abre sem internet, mas, sem conexão, só para orçar.
- Sem servidor próprio, sem login próprio, sem custo, **sem nenhuma chamada a terceiros além da planilha**. A fonte Inter fica hospedada no próprio app.

**O que foi copiado do Pendências e o que é diferente:**

| Copiado | Diferente, e por quê |
|---|---|
| Só `doPost`, com corpo JSON enviado como texto puro (`text/plain`, sem a checagem prévia de CORS); leitura com `resp.text()` + `JSON.parse`; tempo limite de 30 s | Ações `obterDados`, `salvarDados` e `obterTaxasPadraoVisa`, em vez de pull/push incremental. Os dados são pequenos e a planilha é a fonte da verdade |
| Token nas Propriedades do script (2 UUIDs = 64 hex), comparação em tempo constante, checagem antes de tudo | Mensagem única "Acesso não autorizado" (também quando o servidor ainda não tem token) |
| Funções manuais públicas no editor (`trocarToken`, `testarApi`) | `gerarLinkDeConfiguracao()` gera o **link `#cfg=`**. O Pendências só tem configuração manual; aqui ela fica como opção discreta |
| `sw.js` com `VERSAO`, cache-first da casca, `cache:'reload'`, sem `skipWaiting` automático ("Nova versão · ATUALIZAR"); `beforeinstallprompt` | — |
| Manifest com `id`, `start_url` e `scope` em `"./"`, `standalone`, ícones 192, 512, maskable e apple-touch | Ícones gerados do logo CliniCar por `tools/gerar-icones.ps1` |
| Fonte hospedada no repositório; Pages "Deploy from a branch" (main, raiz), `.nojekyll`; conferência de segredos antes do push | **Sem IndexedDB nem fila de envio offline:** sem conexão, só orçar (regra que já existia), mais simples e sem conflitos |

### Diretriz principal: simples e intuitivo
- Menos campos, menos telas, menos números. Na dúvida, esconder em "Ver detalhes" ou "Ver outras formas de pagamento".
- Linguagem do dia a dia, sem jargão. Evitar "margem", "faturável", "modalidade", "base" e "MDR". Usar "Quanto você gasta por mês", "Sua hora precisa valer no mínimo", "Seu lucro neste serviço" e "Cliente paga".
- Ajuda de uma linha, logo abaixo do campo. `inputmode="decimal"` em todos os campos de valor. PT-BR com acentuação correta.
- **Sem emoji na interface do app** (ícones SVG de traço). Os emojis 💵 e 💳 ficam só no texto do WhatsApp.

### Identidade e direção visual (CliniCar Motors Tech)
- **Referência:** app de banco digital (Nubank, InfinitePay, Mercado Pago): limpo, leve e respirado.
- **Logo:** recortado do perfil da oficina (`tools/logo-origem.jpg`, 700 px) e gerado em `icons/logo-clinicar.jpg` (256 px). Aparece no topo (52 px), na tela de carregamento e na tela de conexão. É também o ícone do app instalado.
- **Fonte:** Inter variável, hospedada em `fonts/inter-var.woff2` (subconjunto latino, licença OFL em `fonts/OFL.txt`), com reserva `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Hierarquia por peso e tamanho:**
  - texto e campos: 400;
  - rótulos: 500, 14px, cinza-escuro;
  - títulos de card: 600, 18px;
  - **valores principais** (à vista, parcela, lucro, mínimo por hora): 700, 28 a 32px. São os únicos em peso forte;
  - ajuda: 400, 13px, cinza médio.
  - Texto principal `#1f2328`.
- **Cores:**
  - fundo `#f5f6f8`;
  - cards brancos, cantos de 16px, sombra suave, sem borda;
  - topo preto `#0e0e0e` com faixa laranja;
  - **laranja `#ed8a1f` só como acento:** aba ativa, chip selecionado (fundo `#fff1e3`), foco do campo e detalhe do card à vista;
  - laranja escuro `#a85a00` em links sobre fundo branco;
  - **verde e vermelho só para lucro e prejuízo.** O botão "Copiar para WhatsApp" é verde.
- **Campos:** 48px de altura, cantos de 12px, borda 1px `#d9dce1`. No foco: borda laranja e leve sombra laranja. "R$" fica dentro do campo à esquerda, e "%" dentro à direita.
- **Botões:**
  - o principal (só o do WhatsApp) é verde, peso 600, 52px, com ícone de balão;
  - os secundários são "fantasma": borda 1px cinza-claro, texto cinza-escuro, peso 500;
  - "Adicionar gasto" é texto laranja com ícone de +;
  - a lixeira é um ícone cinza com área de toque de 44px, vermelho no toque.
- **Chips:**
  - sugestões: fundo cinza-claro, sem borda;
  - seleção: fundo laranja-claro com borda e texto laranja, sem "✓".
- **Layout:**
  - celular: uma coluna, até 720px;
  - notebook (900px ou mais): duas colunas, até 1040px;
  - espaçamentos em múltiplos de 4 e 8px.
- **Microinterações:**
  - transição de 160ms em hover e foco;
  - "Salvando…" com um pontinho animado e "Salvo ✓" discreto;
  - aviso curto ao copiar.

## 2. Estrutura do repositório

```
/index.html                    telas (markup) — publicado no GitHub Pages
/manifest.webmanifest          PWA
/sw.js                         service worker (cache da casca, VERSAO)
/.nojekyll                     Pages serve os arquivos como estão
/css/app.css                   visual
/js/calculo.js                 funções puras de cálculo + casos de teste (script comum, também roda em Node)
/js/config.js                  conexão do aparelho (localStorage) e leitura do link #cfg=
/js/api.js                     chamada à API (fetch POST text/plain)
/js/pwa.js                     service worker, "Nova versão · ATUALIZAR", instalar
/js/app.js                     telas, eventos, cache, Desfazer
/fonts/inter-var.woff2  /fonts/OFL.txt
/icons/                        logo-clinicar.jpg, icon-192/512, icon-maskable-512, apple-touch-icon
/apps-script/Codigo.gs         API (colar em cada planilha)
/apps-script/appsscript.json   manifesto do Apps Script
/tools/gerar-icones.ps1  /tools/logo-origem.jpg  /tools/LEIA-ME.md
/docs/DESENHO.md               este documento
/docs/GUIA-DO-USUARIO.md       guia para o mecânico (uso no dia a dia, instalação, cartões)
/docs/testes-calculo.md        casos de teste e resultados
/docs/DEPLOY.md                publicação no Pages, Apps Script em cada planilha, link de configuração, segurança
.gitignore
```

**Disciplina de trabalho:** só commits locais. Nunca rodar `git push` nem `clasp` de qualquer tipo; publicar cabe ao dono do projeto.

**Repositório público, nada sensível:** não entram token, URL `/exec`, link `#cfg=`, nem endereço ou ID de planilha. `URL_DA_API` vai vazia no `Codigo.gs`; a `URL_DO_APP` (endereço do Pages, que não é segredo) vai preenchida. Um teste automático varre o repositório procurando esses padrões, e o DEPLOY.md traz a conferência com `git grep` antes do push.

## 3. Planilha (abas criadas automaticamente por `configurarPlanilha_()`)

### 3.0 Regra geral: leitura tolerante, gravação rígida, mesmos limites
- **Tudo o que `obterDados()` devolve precisa passar em `validarDados_()` sem erro.** Assim, uma edição manual errada na planilha nunca deixa o app preso em "Erro ao salvar".
- Os limites ficam num lugar só no backend e valem tanto para a leitura quanto para a validação: `LIMITES_PARAMETROS_`, `LIMITE_TAXA_`, `LIMITE_VALOR_GASTO_`, `MAX_CARTOES_` e `MAX_NOME_CARTAO_`.
- O frontend usa os **mesmos** valores. Um teste automático confere essa paridade.
- **Leitura:**
  - parâmetro inválido ou fora do limite → **padrão**;
  - taxa ou valor de gasto inválido ou fora do limite → **vazio** (`null`);
  - parcela em destaque inválida → descartada;
  - cartão sem nome → descartado;
  - nome de cartão repetido → fica o primeiro;
  - mais de 12 cartões → ficam os 12 primeiros;
  - textos longos → cortados.
- **Validação (salvar):** dado inválido → erro com mensagem em português.
- **Frontend:** nunca envia o que `validarDados_` rejeitaria. Valida no campo, mostra a mensagem junto do campo e não salva enquanto houver campo inválido. Nesse caso, o status mostra "Corrija o campo em vermelho".

### 3.1 Aba `Gastos`
| Tipo | Descrição | Valor por mês (R$) |
|---|---|---|
| `Oficina` ou `Casa` | texto (até 100 caracteres) | número ≥ 0 ou vazio |

- Valor vazio é aceito e conta 0.
- Na leitura, um `Tipo` diferente de "Oficina" vira "Casa".

### 3.2 Aba `Parâmetros`
Colunas `Chave` | `Valor`. A coluna `Valor` fica em **texto (`@`)**. Os números são gravados em pt-BR ("150,5") e lidos com `lerNumeroBR`.

| Chave | Padrão | Regra |
|---|---|---|
| diasPorSemana | 5 | 1 a 7 (aceita decimal) |
| horasPorDia | 8 | maior que 0 e até 24 |
| horasCobradasPorDia | 6 | maior que 0 e no máximo `horasPorDia` |
| valorHoraCobrado | 150 | ≥ 0 |
| impostoPercentual | 0 | 0 a 99 |
| acrescimoPecasPadrao | 47 | 0 a 1000. É o acréscimo (%) que cada orçamento novo traz em cima do que ele paga pelas peças |
| parcelasDestaque | "5,10" | inteiros de 1 a 12, separados por vírgula. Vazio = nenhum card de destaque, só "Ver outras formas de pagamento" |
| nomeOficina | "CliniCar Motors Tech" | texto (até 60 caracteres) |

O `atualizadoEm` fica em `PropertiesService.getDocumentProperties()`, fora da planilha.

### 3.3 Aba `Taxas`: um cartão por linha
Colunas: `Cartão` | `Débito (%)` | `1x (%)` | `2x (%)` | … | `12x (%)`. As taxas ficam em formato numérico `0.00`.

- **Fábrica:** **uma** linha, "Visa/Master", com as taxas da InfinitePay (plano 1 dia útil). Nenhum outro cartão vem criado.

  | Débito | 1x | 2x | 3x | 4x | 5x | 6x | 7x | 8x | 9x | 10x | 11x | 12x |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 1,37 | 3,15 | 5,39 | 6,12 | 6,85 | 7,57 | 8,28 | 8,99 | 9,69 | 10,38 | 11,06 | 11,74 | 12,40 |

  Fonte: 1x a 4x conferidos em prints da calculadora do app; 5x a 12x da tabela pública.
- **Pix não fica na aba:** é sempre 0%, fixo no código.
- **Nome do cartão:**
  - de 1 a 30 caracteres;
  - **único**, comparado sem diferenciar maiúsculas, acentos e espaços repetidos (`chaveNome_` / `chaveNome`);
  - sem linhas com nome vazio.
- **Máximo de 12 cartões.**
- **Vazio ≠ 0 em todos os pontos:**
  - na leitura, célula vazia vira `null`, e `0` continua `0`;
  - na validação, `null` é aceito, e números ficam entre 0 e 99;
  - na gravação, `null` vira célula vazia;
  - no cálculo, `null` faz a forma de pagamento não aparecer.
- **Migração do formato antigo**, em `configurarPlanilha_`, sob o lock e uma única vez:
  - **detecção:** a primeira célula do cabeçalho é "Forma de pagamento" (formato antigo, com colunas fixas Visa/Master, Elo, Amex e Hipercard);
  - **cópia de segurança:** a aba antiga é copiada para **"Taxas (antigo)"**, que não é apagada automaticamente. Se esse nome já existir, a cópia vira "Taxas (antigo) 2", e assim por diante;
  - **conversão:** a aba "Taxas" é regravada no formato novo. Cada bandeira antiga com pelo menos uma taxa preenchida vira um cartão, e Visa/Master vira sempre. Os valores e os vazios são preservados;
  - **reserva:** se o `obterDados()` rodar antes da migração, ele converte em memória (`converterTaxasAntigas_`, uma função pura e testada).

## 4. Regras de cálculo

**Arredondamento:** valores intermediários (preço mínimo da hora, horas estimadas, peças com acréscimo, `totalExato`) entram nas contas **sem arredondar**. Só se arredonda:
- (a) na exibição;
- (b) no total exibido de cada opção;
- (c) na parcela.

É arredondamento comercial, em centavos inteiros (`centavos()`, com proteção contra erro de ponto flutuante).

**Preço mínimo da hora:**
- `horasCobradasMes = horasCobradasPorDia × diasPorSemana × 52/12`
- `precoMinimoHora = totalGastos ÷ horasCobradasMes`; se as horas forem 0, dá 0.

**Mão de obra:**
- **por horas:** `horas × valorHoraCobrado`;
- **valor fechado:** o valor digitado. Se as horas ficarem vazias, `horas = valor ÷ valorHoraCobrado`, com o aviso "horas estimadas pelo valor da sua hora".

**Peças:**
- **lista de peças (modo padrão):** cada item tem descrição, quantidade (decimal, maior que 0; padrão 1) e valor unitário que ele paga (≥ 0). `peças pagas = Σ qtd × unitário` (`totalPecasItens`); item com número inválido conta 0 e mostra o erro na linha. Lista vazia = sem peças (só mão de obra), sem erro. Até 30 itens.
- **acréscimo** (um só para o orçamento inteiro, vale para todos os itens): `cliente paga = paga × (1 + acréscimo/100)`. Ex.: 500 + 47% = 735,00 e 333,33 + 47% = 489,9951, exibido como 490,00. Acréscimo vazio conta como 0%.
- **valor direto** (link "Prefiro digitar o valor das peças"): esconde a lista e volta aos dois campos de antes ("quanto você paga" e "quanto vai cobrar"; vazio = o que ele paga).
- Todo o resto (base, âncora, desconto, lucro, piso) usa esses totais, sem outra mudança.
- `lucroPecas = cobrar − pagar` (sem arredondar).
- `aVista = maoDeObra + pecasCobrar`.

**Cartão que vale no cálculo** (`cartaoEfetivo`):
- com **um só cartão**, é ele, e não há escolha (os chips ficam escondidos);
- com 2 ou mais cartões, é o escolhido; se ele não existir mais, volta para "Não sei".

**Taxa de cada forma** (Débito, 1x … 12x; `taxaDaForma`):
- **cartão escolhido:** a taxa dele (`null` faz a forma não aparecer);
- **"Não sei":** a **maior** taxa entre os cartões que têm aquela forma preenchida.
- **Sem nenhum cartão:** só o à vista, mais a dica "Cadastre seus cartões em Ajustes para ver as parcelas".

**Opção de pagamento (regra B):**
- `totalExato = aVista ÷ (1 − taxa/100)`
- total = `arredondar(totalExato)`
- parcela = `arredondar(totalExato ÷ n)`; no débito, n = 1.

**Divergência conhecida (aceita):** 1x 3,15% sobre R$ 1.000. O app InfinitePay mostra 1.032,53, e o nosso cálculo dá 1.032,52 (total exato 1.032,5245). A diferença é de R$ 0,01, provavelmente porque a taxa real é exibida arredondada. Nenhuma regra simples bate com os 4 casos conferidos. Veja `docs/testes-calculo.md`.

**Desconto à vista, ancorado no cartão** (`calcularPrecoComDesconto`):
- **Base** = `aVista` (mão de obra + peças cobradas). É o piso **sem perder lucro**.
- **Âncora** (preço cheio) = a **primeira parcela em destaque que tem taxa**, no cartão escolhido ("Não sei" = maior taxa). Sem nenhuma, âncora = base e não há desconto.
- **À vista oferecido** = `âncora.totalExato × (1 − (desconto + extra)/100)`, arredondado em centavos. Desconto e extra **somam**, e o total fica limitado a 99.
- **Máximo sem perder lucro** = `(1 − base ÷ âncora) × 100` (é a taxa da âncora).
- **Ainda pode dar** = máximo − total (mín. 0), em % e em R$ (= oferecido − base).
- **Acima do máximo:** faixa vermelha "Com esse desconto você abre mão de R$ X do seu lucro", com X = base − oferecido.
- **Piso de prejuízo** = `(gasto das horas + peças pagas) ÷ (1 − imposto%)`: "Abaixo de R$ X você trabalha no prejuízo."
- As **outras** parcelas em destaque e "Ver outras formas" continuam calculadas sobre a **base** (regra B). Nenhuma fica abaixo do à vista oferecido (D12).
- Com desconto 0, o à vista é igual à âncora.
- **Desconto à vista padrão:** fica **por aparelho**, no `localStorage` (`precoCerto.descontoPadrao.v1`, texto "7,5"), de 0 a 99, e é 5 de fábrica. Valor ausente ou inválido vale 5 (`descontoPadraoDoAparelho`). "Desconectar este aparelho" **não** apaga. Cada orçamento novo começa com ele, e dá para mudar só naquele orçamento.

**Lucro:**
- `imposto = total × impostoPercentual/100`, sobre o **total arredondado** (o que o cliente paga);
- `lucro = (maoDeObra − horas × precoMinimoHora) + lucroPecas − imposto`;
- o valor grande usa o **à vista oferecido**: `lucro = oferecido − gasto das horas − peças pagas − imposto sobre o oferecido`;
- com imposto maior que 0, aparece embaixo "No cartão em {maior parcela em destaque}x: R$ …".

**Assinatura da função pura principal** (o `precoMinimoHora` é calculado fora e injetado):
```
calcularOrcamento(entrada, parametros, cartoes, cartaoEscolhido, precoMinimoHora)
  entrada  = { modo: 'horas'|'fechado', horas, valorFechado,
               pecasPagar, pecasModo: 'acrescimo'|'valor', pecasAcrescimo, pecasCobrar }
  cartoes  = [{ nome, debito, p1 … p12 }]      cartaoEscolhido = nome | NAO_SEI ('')
  → { aVista, opcoes, destaques, outras, maoDeObra, pecasCobrar, lucroPecas, gastoHoras,
      semCartoes, cartao (efetivo), cartaoNoTexto }
```

## 5. Contrato backend ↔ frontend

```
dados = {
  gastos:     [{ tipo: 'Oficina'|'Casa', descricao, valor: number|null }],
  parametros: { diasPorSemana, horasPorDia, horasCobradasPorDia, valorHoraCobrado, impostoPercentual,
                acrescimoPecasPadrao: number, parcelasDestaque: string, nomeOficina: string },
  cartoes:    [{ nome: string, debito, p1, …, p12: number|null }]     // 0 a 12 cartões
}
```

### API (Apps Script `/exec`)
```
POST <URL /exec>   corpo como texto (text/plain): {"token":"…","action":"…", …}
  action "obterDados"                → {ok:true, gastos, parametros, cartoes, atualizadoEm, urlPlanilha}
  action "salvarDados", dados:{…}    → {ok:true, atualizadoEm}
  action "obterTaxasPadraoVisa"      → {ok:true, taxas:{debito, p1 … p12}}
  qualquer erro                      → {ok:false, erro:"mensagem em PT-BR"}
GET <URL /exec>                      → {ok:false, erro:"Acesso não autorizado"}   (nunca HTML)
```
**Ordem no `doPost`:**
1. ler o JSON (inválido → "Pedido inválido.");
2. **conferir o token** (ausente, errado ou servidor sem token → **"Acesso não autorizado"**). **Nada da planilha é tocado antes disso;**
3. conferir a ação, que tem de estar na lista `ACOES_` (fora dela → **"Ação desconhecida."**);
4. pegar o lock;
5. `configurarPlanilha_()` (cria abas e migra a aba Taxas antiga);
6. executar a ação.

Erros de validação voltam com a própria mensagem ("Dias de trabalho por semana: digite um número."). Erros inesperados voltam como "Erro interno no servidor. Tente de novo.", e o detalhe vai só para o log.

### Segurança
- O token tem 64 caracteres hexadecimais (2 UUIDs). Fica nas **Propriedades do script** (chave `TOKEN`) e no `localStorage` de cada aparelho. Nunca entra no repositório.
- **Funções públicas** (sem `_`) do `Codigo.gs`: `doGet`, `doPost` e as três manuais `gerarLinkDeConfiguracao()`, `trocarToken()` e `testarApi()`.
  - As manuais precisam ser públicas: funções com `_` são privadas e não aparecem no menu "Executar" do editor.
  - Isso é seguro porque o projeto **não usa HtmlService**. Não existe `google.script.run`, e a **única porta de entrada externa é o `doPost`**, que só executa as ações de `ACOES_`.
  - Mesmo com o token válido, `action: "trocarToken"` (ou qualquer outro nome) recebe "Ação desconhecida.". Um teste automático confere isso.
- Todas as outras funções terminam em `_`.
- **Link de configuração:** `URL_DO_APP + "#cfg=" + base64url({"api": URL_DA_API, "token": …})`.
  - A parte depois do `#` não é enviada a nenhum servidor (nem ao Pages, nem à prévia de link do WhatsApp).
  - O app limpa o endereço (`history.replaceState`) assim que lê o link.
  - Quem recebe o link tem acesso à planilha. Depois de configurar o aparelho do mecânico, **apagar a mensagem do WhatsApp**. Se vazar: `trocarToken()` + link novo.
- `trocarToken()` invalida todos os aparelhos daquela planilha. Eles passam a mostrar "Este aparelho perdeu o acesso à planilha", e a edição fica bloqueada.

### Backend (`apps-script/Codigo.gs`)
| Função | Papel |
|---|---|
| `doGet()` | Sempre `{ok:false, erro:"Acesso não autorizado"}` |
| `doPost(e)` | Roteador da API (ordem acima) |
| `ACOES_` | `obterDados`, `salvarDados`, `obterTaxasPadraoVisa` — as únicas ações |
| `gerarLinkDeConfiguracao()` | **Manual.** Confere `URL_DO_APP` e `URL_DA_API` e, se faltar algo ou o formato estiver errado, para com uma mensagem clara no Logger. Cria o token se não existir e imprime o link com instruções |
| `trocarToken()` | **Manual.** Gera um token novo (todos os aparelhos perdem o acesso) |
| `testarApi()` | **Manual.** Teste de ponta a ponta do `doPost` no editor, sem alterar os dados |
| `configurarPlanilha_()` | Idempotente: cria abas ausentes ou vazias e roda `migrarTaxasAntigas_` (uma única vez). Roda dentro do lock |
| `obterDados_()`, `salvarDados_(limpo)`, `obterTaxasPadraoVisa_()` | Ações internas |
| `converterTaxasAntigas_`, `limparCartoesLidos_`, `problemaNasUrls_`, `montarLinkDeConfiguracao_` | Funções puras (testadas em Node) |
| `validarToken_`, `iguais_`, `validarDados_`, `validarCartoes_`, `lerCartoes_`, `chaveNome_`, `lerNumeroBR_` … | Internas |

**Constantes no topo** (preenchidas em cada planilha):
- `URL_DO_APP` = `https://marquesarao.github.io/preco-certo/` (já vem preenchida);
- `URL_DA_API` = a URL `/exec` daquela implantação. Vai vazia no repositório; preenchida à mão, sem `ScriptApp`.

**Manifesto:** `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`, escopo **`spreadsheets.currentonly`**. `ContentService`, `PropertiesService`, `LockService`, `Utilities` e `Logger` não pedem escopo.

### Frontend (GitHub Pages)
- **Conexão do aparelho** (`js/config.js`):
  - fica no `localStorage` (chave `precoCerto.conexao.v1`, `{api, token}`);
  - **link `#cfg=`:** o app decodifica o base64url (com ou sem `=`), valida o JSON (`api` no formato `/exec`, igual ao do backend; `token` com 32 a 256 caracteres `[A-Za-z0-9_-]`), **testa com `obterDados`**, só então guarda, limpa o endereço e mostra "Aparelho conectado à planilha ✓". Com erro, aparece uma mensagem simples e nada é guardado;
  - **sem configuração:** tela "Este aparelho ainda não está ligado a uma planilha. Abra o link de configuração que você recebeu.", com a opção discreta **"Configurar manualmente"** (colar a URL e o token, com as mesmas validações);
  - ao ligar o aparelho a **outra** planilha, o cache de dados da anterior é apagado.
- **Chamada à API** (`js/api.js`): `fetch` POST com o corpo como texto, segue o redirecionamento do Apps Script e tem tempo limite de 30 s. Os erros têm tipo:
  - `rede`: "Sem conexão" ou falha de rede;
  - `acesso`: "Acesso não autorizado";
  - `servidor`: resposta que não é JSON (implantação errada) ou `{ok:false}`.
- **PWA** (`js/pwa.js`, `sw.js`, `manifest.webmanifest`):
  - **service worker:** cache `preco-certo-vN` com a casca (15 arquivos); a navegação recebe sempre o `index.html` do cache; a API não passa pelo cache;
  - **versão nova:** barra "Nova versão disponível · ATUALIZAR". Só recarrega quando a pessoa toca;
  - **instalação:** `beforeinstallprompt` → aviso único "Instale o Preço Certo…" e botão "Instalar app" em Ajustes;
  - **manifest:** "Preço Certo", `./`, `standalone`, `theme_color` e `background_color` `#0e0e0e`.
- **Cálculo** (funções puras, em `js/calculo.js`):
  - números e validação: `lerNumeroBR`, `validarNumeroCampo`, `validarHorasCobradas`, `normalizarParcelas`, `centavos`, `formatarBRL`, `formatarHoras`;
  - gastos e horas: `horasCobradasMes`, `precoMinimoHora`, `calcularMaoDeObra`, `calcularPecasCobrar`;
  - cartões: `chaveNome`, `acharCartao`, `cartaoEfetivo`, `taxaDaForma`, `validarNomeCartao`;
  - orçamento e texto: `calcularOpcao`, `calcularOrcamento`, `calcularPrecoComDesconto`, `descontoPadraoDoAparelho`, `formatarPercentual`, `textoWhatsApp` (`valoresWhatsApp` foi removida junto com a quebra mão de obra/peças).
- **Dados de teste** (`VISA_TESTE`, `cartaoDeTeste`, `casosDeTeste`): só o autoteste usa. Um teste automático garante que o app nunca os usa.
- **Sincronização:**
  - **cache e servidor:** o cache local abre o app rápido, e em seguida a planilha (fonte da verdade) substitui o cache. O app recarrega da planilha quando volta a ficar visível, se não houver nada pendente.
  - **salvamento:** acontece 800 ms depois da última alteração, com o status "Salvando…", "Salvo ✓" ou "Erro ao salvar – tentar de novo". Ao sair do app, o que estiver pendente é salvo na hora.
  - **antes de carregar a planilha:** "Meus gastos" e "Ajustes" ficam bloqueados.
  - **sem conexão e com cache:** aparece a faixa "Sem conexão: só orçamento". O app abre pela casca do service worker, inclusive em modo avião.
  - **token trocado:** aparece a faixa "Este aparelho perdeu o acesso à planilha. Abra o novo link de configuração." e a edição fica bloqueada.
  - **remover gasto ou cartão:** some na hora e aparece a barra "Gasto removido · DESFAZER" (ou "Cartão removido · DESFAZER") por 6 s. O salvamento só acontece quando a barra some, ou junto com a próxima alteração.
- **Copiar:** fora do iframe do Apps Script, a área de transferência funciona em HTTPS. São 2 níveis: área de transferência e, se falhar, a caixa com o texto selecionado. O botão "Compartilhar" aparece sempre que o navegador tiver `navigator.share`.
- **Autoteste:** `?teste=1`, lido direto de `location.search`.
- **Navegação:** abrir Configurações (ou a tela do PIN) empilha uma entrada no histórico (`history.pushState`). O "voltar" do celular (`popstate`), o **Esc** e "← Voltar ao orçamento" levam ao orçamento. O "avançar" do navegador nunca reabre Configurações, para não pular o PIN.
- **PIN (opcional):** 4 números no `localStorage` (`precoCerto.pin.v1`), só deste aparelho e desligado de fábrica. **Não é segurança forte:** serve para evitar mexida sem querer. "Desconectar este aparelho" e abrir de novo o link de configuração apagam o PIN.
- **Link `#cfg=` com o app já aberto na mesma aba:** o navegador só troca o `#` e não recarrega. O app escuta `hashchange` e processa o link do mesmo jeito.
- **Resposta velha da planilha:** se o aparelho foi desconectado (ou ligado a outra planilha) enquanto esperava, a resposta é ignorada.
- **Google Tradutor:** `<html lang="pt-BR" translate="no">` e `<meta name="google" content="notranslate">`. Assim o Chrome não oferece traduzir a página nem troca números e palavras.
- **Vários aparelhos:** orçamentos podem ser feitos em vários aparelhos ao mesmo tempo. Já "Meus gastos" e "Ajustes": só uma pessoa mexe por vez (o último a salvar vale). Sincronização entre aparelhos e histórico de orçamentos ficam para a v2.

## 6. Telas

Topo preto: logo e "Preço Certo" à esquerda; status e **engrenagem** (SVG, área de toque de 44 px, `aria-label="Configurações"`) à direita. **Não há barra de abas:** a tela principal é **só o Orçamento**.

- **Engrenagem:** abre a área **"Configurações"** em tela cheia, com o título, o botão visível "← Voltar ao orçamento" e as abas internas **Meus gastos | Ajustes** (o conteúdo é o mesmo de antes). Reabre na última aba usada.
- **Voltar:** Esc (notebook) e o "voltar" do celular voltam ao orçamento.
- **Primeiro acesso** sem gastos (e sem PIN): abre direto em Configurações → Meus gastos, com a faixa "Comece colocando seus gastos do mês. Leva 2 minutos.". Nos outros casos, abre no Orçamento.
- Os links "Meus gastos" e "Ajustes" das dicas do orçamento abrem Configurações na aba certa (pedindo o PIN, se ligado).
- **PIN ligado:** a engrenagem abre "Configurações protegidas" ("Digite o PIN deste aparelho", Entrar, "Voltar ao orçamento"). PIN errado: "PIN errado. Tente de novo." **"Esqueci o PIN"** explica que basta desconectar o aparelho e abrir o link de configuração de novo (isso apaga o PIN) e oferece "Desconectar este aparelho", com confirmação.
- As telas "não conectado" e "perdeu o acesso" continuam como estavam.

### 6.1 Orçamento
No notebook, os campos ficam à esquerda e os resultados à direita.
- **Card "Serviço":**
  - "Qual serviço / veículo?";
  - "Quantas horas de serviço?", com "Mão de obra: R$ …" embaixo, que só aparece quando há horas;
  - link "Prefiro digitar o valor fechado" (valor com R$ e horas opcionais).
- **Card "Peças"** (lista):
  - cada linha: Descrição | Qtd | Valor unitário que você paga (R$) | lixeira (SVG). Na tela larga (≥ 560 px), numa linha só, com cabeçalho "Peça · Qtd · Valor unit. (você paga)". No celular, a descrição e a lixeira em cima e "Qtd × R$ valor" embaixo, sem rolagem lateral em 390 px;
  - embaixo de cada linha, discreto: "Cliente paga: R$ X" (= qtd × unitário × (1 + acréscimo/100));
  - "+ Adicionar peça" (a peça nova começa com quantidade 1). Lista vazia mostra "Sem peças? Deixe vazio: o orçamento fica só com a mão de obra.";
  - remover mostra "Peça removida · DESFAZER" por 6 s (como nos gastos). Nada vai para a planilha: a lista é só do rascunho do orçamento neste aparelho (`localStorage`); "Novo orçamento" limpa;
  - "Quanto você põe em cima da peça" (%), um só para o orçamento inteiro, com a ajuda "Vale para todas as peças deste orçamento.". Começa com o acréscimo padrão de Ajustes e pode ser mudado só naquele orçamento;
  - totais: "Você paga: R$ X · Cliente paga: R$ Y";
  - link "Prefiro digitar o valor das peças", que esconde a lista e mostra o valor total direto, como antes (o link de volta é "Prefiro usar o acréscimo (%)", e a lista volta como estava).
  - Rascunho da versão anterior (campo único preenchido): vira uma peça "1 × valor", sem perder o que estava digitado.
- **Resultados:**
  - **card do cartão (âncora)**, com detalhe laranja à esquerda: "Cartão em 5x", "5× de R$ 460,24" e "Total R$ 2.301,20", mais os chips "Não sei · Visa/Master · Elo…" (só com 2 ou mais cartões) e a ajuda "Não sabe o cartão do cliente? Deixe em 'Não sei': o preço cobre qualquer bandeira.";
  - **card à vista:** "R$ 2.186,14 · 5% de desconto", com os campos "Desconto à vista" (%) e "Desconto extra que vou dar (opcional)" (%), ambos de 0 a 99 e com erro na hora. Sem âncora, os campos somem e aparece "Cadastre a taxa do cartão em Ajustes para oferecer desconto à vista.";
  - **só para o mecânico:** faixa verde "Se o cliente pedir mais: ainda pode dar até 2,57% (R$ 59,14) sem mexer no seu lucro." ou, acima do máximo, faixa vermelha "Com esse desconto você abre mão de R$ 55,92 do seu lucro.";
  - **demais parcelas em destaque** (sobre a base), em blocos leves, e "Ver outras formas de pagamento", sem repetir as parcelas em destaque. Quando **só a âncora** está em destaque (ex.: parcelas "5"), não há card vazio: aparece **só o link** "Ver outras formas de pagamento", com o espaçamento normal entre os blocos; aberto, a lista aparece num card normal. Sem outras formas, nem o link aparece;
  - **card de lucro** (sobre o à vista oferecido): valor verde (vermelho com "Esse preço não cobre seus gastos do mês"). Em "Ver detalhes":
    - Mão de obra;
    - "Gasto das suas 8 horas: − R$ 430,77" (nenhuma multiplicação visível);
    - Lucro nas peças;
    - "Diferença pelo desconto à vista" (± oferecido − base);
    - Imposto (à vista).
    A soma das linhas é o lucro. Embaixo: "Abaixo de R$ X você trabalha no prejuízo."
  - **botões:** "Copiar para WhatsApp" (verde, ícone de balão), "Compartilhar" (fantasma) e "Novo orçamento" (fantasma).
  - Sem valor: a dica "Preencha as horas (ou o valor) e as peças para ver o preço."

**Texto do WhatsApp:**
```
*Orçamento – {nomeOficina}*          (ou *Orçamento* sem nome)
{serviço/veículo}

Peças inclusas:                      (só se houver peças na lista)
2× Pastilha de freio
1× Disco de freio
4,5× Óleo 5W30

💳 Cartão em até 5x: R$ … (5x de R$ …)
💳 Cartão em até 10x: R$ … (10x de R$ …)
💵 À vista (Pix/dinheiro): *R$ …* — 5% de desconto
```
- **"Peças inclusas"** lista as peças **sem nenhum valor**: "2× …", "1× …", "4,5× …". Peça sem descrição não aparece (mas entra no cálculo). No modo "valor total direto" não há lista.
- Com desconto 0, o à vista fica sem o "— N% de desconto".
- A quebra "Mão de obra / Peças" foi **removida** (com ela, `valoresWhatsApp` e os casos W1–W3).
- Com um cartão **escolhido** (2 ou mais cartões cadastrados), a linha vira "💳 Cartão Cabal em até 5x: …". Com "Não sei", ou com um único cartão, não há nome.
- **Nunca** contém valores de peças ou de mão de obra, "ainda", "lucro", "taxa", "piso" nem "prejuízo", nem custo ou acréscimo.

### 6.1.1 Dicas "?"
Botão redondo "?" ao lado do rótulo (área de toque de 44 px; `aria-label` "O que é \"…\"?"; `aria-expanded`). Toque ou clique abre um balão logo abaixo (nos dois campos de desconto lado a lado, embaixo dos dois). Abre **por toque, não por passar o mouse** (que não existe no celular). Só um aberto por vez; fecha com novo toque, toque fora ou **Esc** (em Configurações, o 1º Esc fecha o balão e o 2º volta ao orçamento). A frase curta embaixo de cada campo continua. Os textos ficam em `DICAS` (`js/app.js`):

| Onde | "?" de | Texto do balão |
|---|---|---|
| Ajustes → Outros ajustes | Acréscimo padrão nas peças | Quanto você põe em cima do preço que paga pela peça. Ex.: paga R$ 100 com 47%, o cliente paga R$ 147. Cada orçamento novo começa com este número. Dá para mudar só naquele orçamento, no campo "Quanto você põe em cima da peça". |
| Ajustes → Outros ajustes | Imposto | A porcentagem de imposto sobre o que o cliente paga (nota fiscal). O app tira esse imposto do seu lucro, no à vista e no cartão. É MEI? Deixe 0 e coloque o DAS em Meus gastos, porque o DAS é um valor fixo por mês. |
| Ajustes → Outros ajustes | Parcelas que aparecem no orçamento | Quais parcelas do cartão aparecem em destaque no orçamento e no WhatsApp. Ex.: "5,10" mostra 5x e 10x. A primeira (5x) é o preço cheio do cartão, e o desconto à vista é calculado em cima dela. As demais formas ficam em "Ver outras formas de pagamento". |
| Ajustes → Outros ajustes | Nome da oficina | Aparece no título do texto do WhatsApp: "*Orçamento – CliniCar Motors Tech*". Se ficar vazio, o título fica só "*Orçamento*". |
| Meus gastos → Sua rotina | Horas que você cobra por dia | Das horas que você trabalha, quantas viram serviço cobrado do cliente? O resto vai em orçamento, busca de peça, espera… Normalmente 6 de 8. Quanto menor esse número, mais a sua hora precisa valer. |
| Meus gastos | Quanto você vai cobrar por hora | Quanto você cobra por hora de serviço. Precisa ser maior que "Sua hora precisa valer no mínimo", logo acima: a diferença é o seu lucro em cada hora. Ex.: mínimo R$ 33,08 e você cobra R$ 165, sobram R$ 131,92 por hora. |
| Orçamento | Desconto à vista | Desconto para quem paga no Pix ou dinheiro, em cima do preço do cartão. Neste orçamento, até {máximo}% você não perde nada, porque não paga a maquininha. Já vem com o seu número de sempre (Ajustes → Este aparelho). *(o máximo é o deste orçamento; sem âncora: "Até a taxa do cartão em destaque…")* |
| Orçamento | Desconto extra | Se o cliente pedir um pouco mais. Soma com o desconto à vista (5% + 2% = 7%). O app mostra até onde dá para ir sem mexer no seu lucro e avisa em vermelho se passar disso. |
| Ajustes → Seus cartões (título) | Seus cartões | As taxas que a maquininha cobra em cada parcela (Débito, 1x … 12x). Copie da calculadora de taxas do app da maquininha, um cartão de cada vez. Campo vazio = essa parcela não aparece no orçamento. Vazio é diferente de 0: 0 quer dizer "sem taxa". |
| Ajustes → Este aparelho | Desconto à vista padrão | O desconto que todo orçamento novo já traz para Pix ou dinheiro. Ex.: 5. Vale só para este aparelho: outro celular pode usar outro número. Em cada orçamento dá para mudar só naquele. |
| Ajustes → Este aparelho | Proteger com PIN | Pede 4 números para abrir Meus gastos e Ajustes neste aparelho. Serve para ninguém mexer sem querer: não é uma senha forte. Esqueceu? Na tela do PIN, toque em "Esqueci o PIN". |

### 6.2 Meus gastos
- **Cards "Gastos da oficina" e "Gastos de casa":**
  - cada linha tem descrição, valor (com R$) e lixeira, numa linha só;
  - "Adicionar gasto";
  - lista vazia mostra sugestões em chips cinza;
  - total à direita.
- **Card "Sua rotina":** dias, horas por dia e horas cobradas.
- **Card de resultado:**
  - "Você gasta por mês";
  - "Sua hora precisa valer no mínimo", em destaque;
  - "Quanto você vai cobrar por hora" (R$), seguido de "Você ganha R$ X a mais por hora" (X em verde) ou "Você cobra R$ X a menos…" (X em vermelho).

### 6.3 Ajustes
- **Card "Seus cartões":**
  - chips com os cartões cadastrados, mais o chip tracejado "+ Adicionar cartão" (some quando chega a 12).
  - **Adicionar:**
    - sugestões rápidas: Elo, Amex, Hipercard, Visa, Mastercard, Cabal, Banescard, Sorocred, sem as que já existem;
    - "Outro…" abre o campo "Nome do cartão";
    - o cartão novo abre já para edição, com as taxas vazias e o foco no Débito.
  - **Editando um cartão:**
    - "Nome do cartão" (editável, com validação de nome único);
    - faixa "Copie as taxas da calculadora da sua maquininha para este cartão." quando ele está todo vazio;
    - grade de Débito e 1x a 12x, com "%" dentro do campo. No notebook, são duas colunas (Débito e 1x a 6x | 7x a 12x);
    - "Preencher com as taxas padrão Visa/Master da InfinitePay", com confirmação na própria página;
    - "Remover cartão", com Desfazer.
  - Renomear o cartão escolhido no orçamento mantém a escolha.
- **Card "Outros ajustes":** acréscimo padrão nas peças (%), imposto (%), parcelas em destaque e nome da oficina.
- "Abrir minha planilha" e "Última alteração salva: …".
- **Card "Este aparelho"** (fora do bloqueio de edição, funciona sem conexão):
  - "Planilha conectada: …/s/…a1B2c3/exec", só o final da URL;
  - "Versão do app";
  - "Instalar app", quando o navegador oferece;
  - **"Desconto à vista padrão"** (%), com a ajuda "Vale só para este aparelho. Cada orçamento novo começa com este número."; inválido mostra erro e não grava;
  - **"Proteger configurações com PIN"**: Ligar (PIN de 4 números, digitado 2 vezes) ou Desligar, com a ajuda "Não é uma senha forte: serve só para evitar que alguém mexa nos gastos e ajustes sem querer. Vale só para este aparelho.";
  - "Desconectar este aparelho", com confirmação na página. Apaga a conexão, o cache de dados e o PIN (ficam o rascunho do orçamento e o desconto padrão) e volta para a tela de conexão.

### 6.4 Tela de conexão (aparelho sem planilha)
- Logo, "Preço Certo" e o texto "Este aparelho ainda não está ligado a uma planilha. Abra o link de configuração que você recebeu.".
- O link discreto "Configurar manualmente" abre os campos "URL da planilha (termina em /exec)" e "Chave de acesso", mais o botão "Conectar".
- Nessa tela, a engrenagem e o status ficam escondidos.

## 7. Casos de teste (igualdade exata em centavos)

Ficam em `js/calculo.js` (`casosDeTeste()`). Rodam no app com `?teste=1` e em Node. Resultados em `docs/testes-calculo.md`, junto com os testes da API (R, L, P), do link `#cfg=` (F), da varredura de segredos e de tela.

| # | Caso | Esperado |
|---|---|---|
| T1 | 1x 3,15% sobre 1.000 | 1.032,52 · 1.032,52 (InfinitePay: 1.032,53, divergência aceita) |
| T2 | 2x 5,39% | 1.056,97 · 528,49 |
| T3 | 3x 6,12% | 1.065,19 · 355,06 |
| T4 | 4x 6,85% | 1.073,54 · 268,38 |
| T5 | Gastos 7.000; 5 dias × 6 h × 52/12 | 130 h · R$ 53,85 |
| T6 | 8 h × 150; preço mínimo 70 injetado; peças 400 → 500 | à vista 1.700,00 · lucro 740,00 |
| T7 | T6 em 5x Visa/Master 7,57% | 1.839,23 · 5× 367,85 |
| T13 | `lerNumeroBR` | 1234,56 · 150,5 · vazio |
| T14 | Horas cobradas = 0 | preço mínimo 0, sem erro (Fatia 4) |
| T15 | Valor fechado 900, horas vazias, hora 150 | horas 6 · aviso (Fatia 4) |
| C1 | Um só cartão | sem escolha; cálculo igual ao desse cartão; sem nome no texto |
| C2 | "Não sei": Visa/Master 5x 7,57 e Elo 5x 8,00; à vista 1.700 | 5x usa 8,00 → 1.847,83 · 5× 369,57; 6x usa 8,28 |
| C3 | Cartão escolhido só com 5x | só a linha 5x; nenhum total igual ao à vista |
| C4 | "Elo" e "elo" | recusado com "Já existe um cartão com esse nome."; a leitura mantém o primeiro |
| C5 | Nenhum cartão | só o à vista, sem erro |
| C6 | 13º cartão | a validação recusa; a leitura fica com 12 |
| C7 | Migração: Visa preenchida + Elo só no 5x | 2 cartões, valores idênticos, vazios preservados, cópia "Taxas (antigo)" |
| C8 | WhatsApp com "Cabal" / "Não sei" | contém "Cartão Cabal" / sem nome de cartão |
| P1–P4 | Peças com acréscimo | 735,00 · 0% = mesmo valor · 489,9951 → 490,00 · lucro nas peças = cobrar − pagar |
| P5 | Peças discriminadas: 2 × 50 + 1 × 350 | 450 pagos; + 47% → cliente 661,50 |
| P6 | Quantidade decimal: 4,5 × 30 | 135 → cliente 198,45; 0, vazio e "-1" recusados |
| P7 | Lista vazia | peças 0, sem erro; base = só mão de obra |
| P8 | Remover peça + Desfazer; "Novo orçamento" | a peça volta no mesmo lugar; nada salvo na planilha; a lista fica vazia (tela) |
| P9 | WhatsApp com peças | "Peças inclusas:" sem nenhum "R$"; "1×" aparece; peça sem descrição não aparece |
| P10 | Modo "valor direto" | continua como antes (P1–P4); sem lista no WhatsApp (tela) |
| W4 | Texto do WhatsApp | negrito; cartão primeiro, à vista por último; sem quebra mão de obra/peças; acréscimo não aparece (W1–W3 removidos com a quebra) |
| D1 | Âncora: Visa 5x 7,57% sobre a base 2.127 (12 h × 165 + peças 100 + 47%) | Total 2.301,20 · 5× 460,24 |
| D2 | Desconto 5% | à vista 2.186,14 |
| D3 | Máximo / ainda pode | 7,57% · com 5%: 2,57% = R$ 59,14 |
| D4 | Lucro com 5% (imposto 10%, gasto das horas 936,92) | 2.186,14 − 936,92 − 100 − 218,61 = 930,61 |
| D5 | Desconto 10% | 2.071,08 · ainda pode 0 · abre mão de R$ 55,92 |
| D6 | Extra 2% soma aos 5% | 7% → 2.140,12 · ainda 0,57% · total limitado a 99 |
| D7 | Piso de prejuízo | (936,92 + 100) ÷ 0,9 = 1.152,13 |
| D8 | Nenhuma parcela em destaque com taxa | âncora = base, sem desconto, sem erro |
| D9 | WhatsApp | sem "ainda/lucro/taxa/piso/prejuízo"; desconto 0 → sem "de desconto" |
| D10 | `apps-script/` | `git diff` e `git status` vazios |
| D11 | 10x Visa 11,06% sobre a base | 2.127 ÷ 0,8894 = 2.391,4999 → Total 2.391,50 · 10× 239,15 (também no WhatsApp) |
| D12 | Parcelas em destaque × à vista oferecido (0%, 5%, 7%, 10%) | nenhum total abaixo do à vista |
| L1 | Desconto padrão do aparelho | nada salvo → 5; "7" → 7; "7,5" → 7,5; "0" → 0; inválido → 5 |

Os casos C4 (leitura), C6 e C7 são testes do **backend** (Node, com a planilha simulada). Os demais estão em `js/calculo.js`.

Se algum caso divergir, a fórmula **não** é ajustada para forçar o número: a divergência é reportada.

## 8. Publicação

O clasp e o GitHub Actions foram **removidos** (`.github/workflows/deploy.yml`, `.claspignore`, `.clasp.json.exemplo`).

- **Tela:** `git push` na `main` → GitHub Pages ("Deploy from a branch", `main` / raiz), igual ao Pendências. A primeira publicação leva alguns minutos.
  - A cada mudança na tela, **subir a `VERSAO` em `sw.js`**. É isso que mostra "Nova versão · ATUALIZAR" nos aparelhos.
- **API:** colar `apps-script/Codigo.gs` e `appsscript.json` em **cada planilha** (Extensões → Apps Script). Implantar como App da Web com **Eu** e **Qualquer pessoa**, preencher `URL_DA_API` e rodar `gerarLinkDeConfiguracao()`.
  - Quando o backend mudar: colar de novo e usar "Gerenciar implantações → Nova versão", que mantém a mesma URL.
- **Primeira vez em uma planilha que já usava o app antigo:** apagar o `Index.html` do projeto Apps Script e substituir o "Código.gs". As abas e os dados não mudam, e a migração da aba Taxas continua valendo.
- Passo a passo: `docs/DEPLOY.md`.

## 9. Próximas fases (registradas, **não implementadas**)

1. **Imposto "por dentro" ou "por fora"**, escolhido em Ajustes:
   - "por dentro" é o atual: o imposto é **descontado do lucro**;
   - "por fora": o imposto é **somado ao preço** para preservar o lucro.
2. **Histórico de orçamentos:** aba "Orçamentos", com a situação de cada um e as ações reabrir e duplicar.
3. **Sincronismo por registro entre aparelhos**, no padrão do Pendências.
4. **Desconto à vista padrão salvo na planilha.** Hoje ele é guardado por aparelho, no `localStorage`.

## 10. Fatias
1. Desenho ✅
2. Backend ✅
3. Frontend ✅ (Parte 2: novo visual, acréscimo nas peças e cartões cadastráveis ✅)
4. **Arquitetura Pendências:** tela no GitHub Pages, Apps Script como API, PWA e link de configuração (aguardando aprovação)
5. Testes de cálculo: autoteste completo (T14, T15)
6. Documentação final (`GUIA-DO-USUARIO.md` já existe; o `DEPLOY.md` cobre a instalação)
7. **Desconto à vista negociável + engrenagem/Configurações + PIN opcional** (só frontend; `apps-script/` sem mudança; `sw.js` v2) ✅
8. **Dicas "?" + peças discriminadas** (só frontend; `apps-script/` sem mudança; `sw.js` v3) (aguardando aprovação)

Cada fatia termina com uma parada para revisão. O commit local só é feito depois da aprovação.
