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
| Manifest com `id` `"/preco-certo/"` (único na origem; veja "Mesma origem"), `start_url` e `scope` em `"./"`, `standalone`, ícones 192, 512, maskable e apple-touch | Ícones gerados do logo CliniCar por `tools/gerar-icones.ps1` |
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
/icons/                        logo-clinicar.jpg, logo-pdf.png (PDF), icon-192/512, icon-maskable-512, apple-touch-icon
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
| descontoAVistaPadrao | 5 | 0 a 99. Desconto à vista que cada orçamento novo traz (fase 10: saiu do aparelho e veio para a planilha). Ausente no `salvarDados` da tela antiga → mantém o valor da aba |
| parcelasDestaque | "5,10" | inteiros de 1 a 12, separados por vírgula. Vazio = nenhum card de destaque, só "Ver outras formas de pagamento" |
| nomeOficina | "CliniCar Motors Tech" | texto (até 60 caracteres) |

O `atualizadoEm` fica em `PropertiesService.getDocumentProperties()`, fora da planilha.

### 3.2.1 Abas `Orçamentos` e `Meses` (fase 10)
Colunas, regras e conflito na seção 11.4. As duas abas ganham, uma vez só, uma **proteção "somente aviso"** e uma **nota em A1** com o texto "Use o app para alterar orçamentos. Editar aqui pode deixar a lista diferente do orçamento." (`protegerComAviso_`, idempotente: marca `protecaoAvisoV1` nas Propriedades do documento + busca pela descrição; funciona com o escopo `spreadsheets.currentonly`). O app continua gravando normalmente. Se a proteção for removida de propósito, ela não volta sozinha.

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
- **Preço por forma de pagamento (seção 15):** com âncora, o débito paga o mesmo preço do Pix e o crédito de 1x até a parcela de referência paga o preço cheio (o da âncora); acima da referência, como antes.
- **Acima do máximo:** faixa vermelha "Com esse desconto você cobra R$ X abaixo do seu preço.", com X = base − oferecido. (Até a fase 11 dizia "abre mão de R$ X da sua sobra extra", mas a sobra cai menos que X, porque o imposto também diminui: ex. 447 − 411,07 = 35,93 abaixo do preço, e a sobra cai 32,34.)
- **Piso** = `(gasto das horas + peças pagas) ÷ (1 − imposto%)` (`preco.piso`). Na tela, ele virou o "piso da casa" (veja "Neste serviço" abaixo).
- As **outras** parcelas em destaque e "Ver outras formas" continuam calculadas sobre a **base** (regra B). Nenhuma fica abaixo do à vista oferecido (D12).
- Com desconto 0, o à vista é igual à âncora.
- **Desconto à vista padrão:** fica na **aba Parâmetros** (`descontoAVistaPadrao`, 0 a 99, padrão 5) e vale para **todos os aparelhos** da planilha (`descontoPadraoDosParametros`; ausente ou inválido → 5). Cada orçamento novo começa com ele, e dá para mudar só naquele orçamento. **Migração (fase 10):** a chave antiga do aparelho (`precoCerto.descontoPadrao.v1`) é gravada na planilha se a aba ainda não tem a linha (e apagada depois do "Salvo ✓"); se a aba já tem, a planilha vence, o app avisa "O desconto padrão agora vem da planilha: X%." e apaga a chave (11.9).

**Lucro (= "Sobra extra" na tela):**
- `imposto = total × impostoPercentual/100`, sobre o **total arredondado** (o que o cliente paga);
- `lucro = (maoDeObra − horas × precoMinimoHora) + lucroPecas − imposto`;
- o valor grande usa o **à vista oferecido**: `lucro = oferecido − gasto das horas − peças pagas − imposto sobre o oferecido`;
- com imposto maior que 0, aparece embaixo "Sobra extra no cartão em {maior parcela em destaque}x: R$ …".

**Neste serviço: oficina, casa e sobra** (`minimoHoraDoTipo`, `separarGanho`, `linhasDetalheServico`; sem arredondar no meio):
- Por quê: o gasto das horas usa o mínimo por hora, que soma oficina **e casa**. Os gastos de casa funcionam como o **salário** do mecânico, então chamar a sobra de "lucro" fazia parecer que só ela era dele.
- `minimoHoraOficina = gastos Oficina ÷ horas cobradas no mês`; `minimoHoraCasa = gastos Casa ÷ horas cobradas no mês` (somados = mínimo por hora).
- `pagaOficina = horas do serviço × minimoHoraOficina`; `vaiParaCasa = horas × minimoHoraCasa`.
- `sobra = preço cobrado − pagaOficina − vaiParaCasa − peças pagas − imposto` (**é o mesmo valor do antigo "lucro"**); `totalSeu = vaiParaCasa + sobra`.
- `pisoOficina = (pagaOficina + peças pagas) ÷ (1 − imposto%)`: "Abaixo de R$ X a oficina não se paga."; `pisoCasa = (pagaOficina + vaiParaCasa + peças pagas) ÷ (1 − imposto%)` (= piso antigo): "Abaixo de R$ Y não sobra nada para a sua casa."
- **Estados:** sobra ≥ 0 → verde; sobra < 0 mas preço ≥ pisoOficina → **âmbar** "Paga a oficina, mas não cobre toda a sua casa."; preço < pisoOficina → **vermelho** "Com esse preço a oficina não se paga.".
- **Sem gastos de casa:** sem as linhas "Vai para a sua casa" e "Total que é seu"; um só piso (o da oficina).
- **Arredondamento das linhas (R8):** cada linha de "Ver detalhes" é arredondada sozinha e **uma linha absorve a diferença** para a soma visível fechar no centavo com a "Sobra extra" exibida: "Vai para a sua casa" (com gastos de casa), senão "Paga os gastos da oficina", e sem horas "Lucro nas peças". A diferença é de poucos centavos. "Total que é seu" exibido = casa exibida + sobra exibida.
- Nada disso vai para o WhatsApp.
- **Linguagem única:** a interface não usa mais "lucro". O que sobra é a **"sobra extra"**, e o que é dele é o **"total que é seu"**. A única exceção é "Lucro nas peças" (o ganho bruto na peça, cobrar − pagar).

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
  ações de orçamento (fase 10)       → listarOrcamentos, obterOrcamento, salvarOrcamento, mudarSituacao,
                                       excluirOrcamento, usarGastosDeHojeNoMes (protocolo e conflito: seção 11.8)
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
| `ACOES_` | `obterDados`, `salvarDados`, `obterTaxasPadraoVisa` + as 6 de orçamento (seção 11.8) — as únicas ações |
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
  - **manifest:** "Preço Certo", `id` `/preco-certo/` (veja "Mesma origem" abaixo), `start_url` e `scope` `./`, `standalone`, `theme_color` e `background_color` `#0e0e0e`.
- **Mesma origem** (`marquesarao.github.io` também serve o app Pendências, em `/pendencias/`). Nada pode ser compartilhado sem prefixo:
  - **identidade do PWA:** o `id` do manifest é resolvido contra a **origem** do `start_url`; `"./"` virava `https://marquesarao.github.io/`, o mesmo id do Pendências, e o Chrome tratou os dois como o mesmo app (o Pendências instalado mostrou nome e ícone do Preço Certo). Agora `"id": "/preco-certo/"` → `https://marquesarao.github.io/preco-certo/` (único). `start_url` e `scope` continuam `./`;
  - **service worker:** registrado com `scope: './'` (= `/preco-certo/`), nunca `"/"`;
  - **caches:** só `preco-certo-vN`; o `activate` apaga só os caches com o prefixo `preco-certo-` (os do Pendências ficam);
  - **armazenamento do aparelho:** todas as chaves com o prefixo `precoCerto.` (`conexao.v1`, `dados.v1`, `orcamento.v1`, `pin.v1`, `descontoPadrao.v1`, `fotoMesPendente.v1`, `avisoInstalar`); não usa IndexedDB nem sessionStorage; **nenhuma** limpeza genérica (`localStorage.clear`, `caches.delete` sem filtro);
  - **"Desconectar este aparelho"** apaga só chaves `precoCerto.` (conexão, dados, PIN e a pendência do mês);
  - **quem já instalou** com o id antigo: desinstalar o Preço Certo **sem** marcar "Também limpar dados" (o armazenamento do site é o mesmo do Pendências) e reinstalar pelo link (GUIA e DEPLOY).
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
- **PIN (opcional):** 4 números no `localStorage` (`precoCerto.pin.v1`), só deste aparelho e desligado de fábrica. Protege **Resultados e Configurações**. Um desbloqueio vale para os dois **enquanto o app estiver aberto**; depois de **mais de 5 min em segundo plano**, pede de novo (e sai de Resultados/Configurações). **Não é segurança forte:** serve para evitar mexida sem querer. "Desconectar este aparelho" e abrir de novo o link de configuração apagam o PIN.
- **Link `#cfg=` com o app já aberto na mesma aba:** o navegador só troca o `#` e não recarrega. O app escuta `hashchange` e processa o link do mesmo jeito.
- **Resposta velha da planilha:** se o aparelho foi desconectado (ou ligado a outra planilha) enquanto esperava, a resposta é ignorada.
- **Google Tradutor:** `<html lang="pt-BR" translate="no">` e `<meta name="google" content="notranslate">`. Assim o Chrome não oferece traduzir a página nem troca números e palavras.
- **Vários aparelhos:** cada orçamento salvo é um registro independente, com conflito por `atualizadoEm` (seção 11.8). Já "Meus gastos" e "Ajustes": só uma pessoa mexe por vez (o último a salvar vale); o sincronismo por registro deles continua em "Próximas fases".

## 6. Telas

Topo preto: logo e "Preço Certo" à esquerda; status e **engrenagem** (SVG, área de toque de 44 px, `aria-label="Configurações"`) à direita. **Fase 10:** duas abas simples **"Orçamento | Resultados"** (`role="tab"`, 44 px): no celular numa linha embaixo da marca, no notebook no meio do topo. Resultados respeita o PIN (seção 11.7). Meus gastos e Ajustes continuam atrás da engrenagem.

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
  - **só para o mecânico:** faixa verde "Se o cliente pedir mais: ainda pode dar até 2,57% (R$ 59,14) sem perder nada — é só a taxa da maquininha que você não vai pagar." ou, acima do máximo, faixa vermelha "Com esse desconto você cobra R$ 55,92 abaixo do seu preço.";
  - **demais parcelas em destaque** (sobre a base), em blocos leves, e "Ver outras formas de pagamento", sem repetir as parcelas em destaque. Quando **só a âncora** está em destaque (ex.: parcelas "5"), não há card vazio: aparece **só o link** "Ver outras formas de pagamento", com o espaçamento normal entre os blocos; aberto, a lista aparece num card normal. Sem outras formas, nem o link aparece;
  - **card "Neste serviço"** (sobre o à vista oferecido), com "?" no título:
    - valor grande "Sobra extra: R$ 869,23": verde, **âmbar** ("Paga a oficina, mas não cobre toda a sua casa.") ou vermelho ("Com esse preço a oficina não se paga."), com o fundo do card no mesmo tom; negativo aparece como "− R$ 130,77";
    - logo abaixo, **sempre visível**, peso 600: "Total que é seu (casa + sobra): R$ 1.053,85";
    - com imposto: "Sobra extra no cartão em 10x: R$ …";
    - "Ver detalhes", nesta ordem: Mão de obra · Lucro nas peças · Diferença pelo desconto à vista (± oferecido − base) · Imposto (à vista) · Paga os gastos da oficina (−) · Vai para a sua casa (−, com a nota "é o seu salário") · **Sobra extra**. A soma visível fecha no centavo com a sobra. Embaixo, discretos, os dois pisos.
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
| Ajustes → Outros ajustes | Imposto | A porcentagem de imposto sobre o que o cliente paga (nota fiscal). O app tira esse imposto da sua sobra extra, no à vista e no cartão. É MEI? Deixe 0 e coloque o DAS em Meus gastos, porque o DAS é um valor fixo por mês. |
| Ajustes → Outros ajustes | Parcelas que aparecem no orçamento | Quais parcelas do cartão aparecem em destaque no orçamento e no WhatsApp. Ex.: "5,10" mostra 5x e 10x. A primeira (5x) é o preço cheio do cartão, e o desconto à vista é calculado em cima dela. As demais formas ficam em "Ver outras formas de pagamento". |
| Ajustes → Outros ajustes | Nome da oficina | Aparece no título do texto do WhatsApp: "*Orçamento – CliniCar Motors Tech*". Se ficar vazio, o título fica só "*Orçamento*". |
| Meus gastos → Sua rotina | Horas que você cobra por dia | Das horas que você trabalha, quantas viram serviço cobrado do cliente? O resto vai em orçamento, busca de peça, espera… Normalmente 6 de 8. Quanto menor esse número, mais a sua hora precisa valer. |
| Meus gastos | Quanto você vai cobrar por hora | Quanto você cobra por hora de serviço. Precisa ser maior que "Sua hora precisa valer no mínimo", logo acima: a diferença é a sua sobra extra em cada hora. Ex.: mínimo R$ 33,08 e você cobra R$ 165, sobram R$ 131,92 por hora. |
| Orçamento | Desconto à vista | Desconto para quem paga no Pix ou dinheiro, em cima do preço do cartão. Neste orçamento, até {máximo}% você não perde nada, porque não paga a maquininha. Já vem com o seu número de sempre (Ajustes → Outros ajustes). *(o máximo é o deste orçamento; sem âncora: "Até a taxa do cartão em destaque…")* |
| Orçamento | Desconto extra | Se o cliente pedir um pouco mais. Soma com o desconto à vista (5% + 2% = 7%). O app mostra até onde dá para ir sem perder nada e avisa em vermelho se passar disso. |
| Ajustes → Seus cartões (título) | Seus cartões | As taxas que a maquininha cobra em cada parcela (Débito, 1x … 12x). Copie da calculadora de taxas do app da maquininha, um cartão de cada vez. Campo vazio = essa parcela não aparece no orçamento. Vazio é diferente de 0: 0 quer dizer "sem taxa". |
| Ajustes → Outros ajustes | Desconto à vista padrão | O desconto que todo orçamento novo já traz para Pix ou dinheiro. Ex.: 5. Vale para todos os aparelhos ligados a esta planilha. Em cada orçamento dá para mudar só naquele. |
| Orçamento (título do card) | Neste serviço | Sua hora já inclui os gastos da oficina e os da sua casa. "Vai para a sua casa" é o seu salário; a "Sobra extra" é o que ficou além disso. O que é seu de verdade é a soma das duas. |
| Ajustes → Este aparelho | Proteger com PIN | Pede 4 números para abrir Resultados, Meus gastos e Ajustes neste aparelho. Depois de digitar, fica liberado enquanto o app estiver aberto; se ficar mais de 5 minutos fora do app, pede de novo. Serve para ninguém mexer sem querer: não é uma senha forte. Esqueceu? Na tela do PIN, toque em "Esqueci o PIN". |
| Resultados (card) | Resultado real do mês | Cada orçamento supõe que você vendeu todas as horas do mês. Aqui é o que aconteceu de verdade: o que entrou nos fechamentos menos peças, taxas, imposto e os gastos do mês. |
| Resultados (card) | Orçamentos feitos | Dos orçamentos feitos neste mês, quantos o cliente aceitou. Um orçamento feito em outubro e fechado em novembro conta como feito em outubro, mas o dinheiro entra em novembro. |
| Resultados (card) | Dinheiro que entrou | Soma dos orçamentos fechados com data de fechamento neste mês. Um orçamento feito em outubro e fechado em novembro conta como feito em outubro, mas o dinheiro entra em novembro. |
| Resultados (card) | Horas | Horas dos serviços fechados neste mês, comparadas com as horas que você pode cobrar no mês (Meus gastos → Sua rotina). |
| Fechar orçamento (card) | Neste fechamento | Valor combinado menos a taxa da maquininha da forma escolhida, o imposto, as peças e a parte da oficina e da sua casa. |

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
- **Card "Outros ajustes":** acréscimo padrão nas peças (%), **desconto à vista padrão (%)** (fase 10: vai para a planilha, "Vale para todos os aparelhos ligados a esta planilha."), imposto (%), parcelas em destaque e nome da oficina.
- "Abrir minha planilha" e "Última alteração salva: …".
- **Card "Este aparelho"** (fora do bloqueio de edição, funciona sem conexão):
  - "Planilha conectada: …/s/…a1B2c3/exec", só o final da URL;
  - "Versão do app";
  - "Instalar app", quando o navegador oferece;
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
| D10 | `apps-script/` | até a fase 9: `git diff` e `git status` vazios. **Fase 10b:** `Codigo.gs` = versão aprovada na 10a (sha256 conferido) e `appsscript.json` sem mudança |
| D11 | 10x Visa 11,06% sobre a base | 2.127 ÷ 0,8894 = 2.391,4999 → Total 2.391,50 · 10× 239,15 (também no WhatsApp) |
| D12 | Parcelas em destaque × à vista oferecido (0%, 5%, 7%, 10%) | nenhum total abaixo do à vista |
| L1 | Desconto padrão do aparelho (só para a migração) | nada salvo → 5; "7" → 7; "7,5" → 7,5; "0" → 0; inválido → 5 |
| L2 | Desconto padrão dos Ajustes (aba Parâmetros) | 7,5 → 7,5; 0 → 0; ausente, 100 ou texto → 5 |
| FC1 | Fechamentos do cenário F (11.6) | Pix 1.747,27 → sobra 811,66 · Débito 1.723,61 → 765,81 · 5x 1.839,23 → 758,88 · 10x 1.911,40 → 754,55 · Pix alterado 1.700 → 767,23 (taxa, imposto, oficina, casa e total que é seu da tabela) |
| FC2 | Coerência | Pix pelo oferecido = sobra de "Neste serviço" (811,66); 5x pelo total = sobra no cartão em 5x (758,88) |
| FC3 | Soma no centavo | 20 valores × com casa / sem casa / sem horas × Pix, débito e 7x: V − taxa − imposto − peças − oficina − casa = sobra; nenhuma linha negativa |
| FC4 | Estados | Pix 1.747,27 verde; 800 âmbar (−78,77); 600 vermelho (−266,77) |
| FC5 | Foto × recalcular | gastos novos mudam a conta de hoje (oficina 307,69); refeita com a foto gravada = resultado gravado; forma sem taxa → sem fechamento |
| M1 | Mês do exemplo 11.6 | 8.921,51 · 2.000 · 374,24 · 535,29 · depois da oficina 2.011,98 · casa em parte 67% · sobra −988,02 · total seu 2.011,98 · 40 de 130 h (31%) · 63% · ↑ R$ 1.421,51 (19%) · sobra ↑ R$ 511,98 |
| M2 | Três estados do mês | casa 1.500 → casa toda, sobra 511,98 (verde); oficina 8.000 → −1.988,02, casa nada, total seu 0 (vermelho); sem foto → sem resultado |
| M3 | Mês pela data do fechamento | feito em 28/10 e fechado em 03/11 → feito em outubro, dinheiro em novembro |
| M4 | Navegação de meses | dez/2026 → jan/2027 e volta; nomes; `mesDe` |
| M5 | Busca | cliente/serviço sem acento; telefone só pelos números |
| R1 | Cenário S (oficina 4.000, casa 3.000, 130 h, serviço 8 h, peças 400 → 500, sem cartões, imposto 0): oficina e casa | 8 × 4.000/130 = 246,15 · 8 × 3.000/130 = 184,62 |
| R2 | Sobra (preço 1.700) | 1.700 − 246,1538 − 184,6154 − 400 = 869,23 (= antigo "lucro") |
| R3 | Total que é seu | 184,6154 + 869,2308 = 1.053,85 |
| R4 | Pisos | oficina 646,15 · casa 830,77 (= piso antigo); verde |
| R5 | Preço 700 | sobra −130,77, ≥ piso da oficina → âmbar |
| R6 | Preço 600 | abaixo do piso da oficina → vermelho |
| R7 | Sem gastos de casa | sem linha da casa e sem "total que é seu"; um só piso; oficina continua 246,15 |
| R8 | Linhas do detalhe | fecham no centavo com a sobra exibida (S, S 700, S sem casa, cenário D com 5% e 10%) |

Os casos C4 (leitura), C6 e C7 são testes do **backend** (Node, com a planilha simulada). Os demais estão em `js/calculo.js`. Os testes da fase 10 que são de backend (O1–O16: upsert, conflito, excluído que não ressuscita, Meses, leitura tolerante, validação, proteção) e de tela (81 verificações com o `Codigo.gs` real rodando na página) estão em `docs/testes-calculo.md`.

Se algum caso divergir, a fórmula **não** é ajustada para forçar o número: a divergência é reportada.

## 8. Publicação

O clasp e o GitHub Actions foram **removidos** (`.github/workflows/deploy.yml`, `.claspignore`, `.clasp.json.exemplo`).

- **Tela:** `git push` na `main` → GitHub Pages ("Deploy from a branch", `main` / raiz), igual ao Pendências. A primeira publicação leva alguns minutos.
  - A cada mudança na tela, **subir a `VERSAO` em `sw.js`**. É isso que mostra "Nova versão · ATUALIZAR" nos aparelhos.
- **API:** colar `apps-script/Codigo.gs` e `appsscript.json` em **cada planilha** (Extensões → Apps Script). Implantar como App da Web com **Eu** e **Qualquer pessoa**, preencher `URL_DA_API` e rodar `gerarLinkDeConfiguracao()`.
  - Quando o backend mudar: colar de novo e usar "Gerenciar implantações → Nova versão", que mantém a mesma URL. **Se a tela também mudou (como na fase 10): primeiro o backend em cada planilha + `testarApi`, depois o `git push`.**
- **Primeira vez em uma planilha que já usava o app antigo:** apagar o `Index.html` do projeto Apps Script e substituir o "Código.gs". As abas e os dados não mudam, e a migração da aba Taxas continua valendo.
- Passo a passo: `docs/DEPLOY.md`.

## 9. Próximas fases (registradas, **não implementadas**)

1. **Imposto "por dentro" ou "por fora"**, escolhido em Ajustes:
   - "por dentro" é o atual: o imposto é **descontado do lucro**;
   - "por fora": o imposto é **somado ao preço** para preservar o lucro.
2. ~~Histórico de orçamentos~~ → desenhado na **fase 10** (seção 11).
3. **Sincronismo por registro entre aparelhos** de gastos, ajustes e cartões, no padrão do Pendências. Os orçamentos já ficam por registro na fase 10.
4. ~~Desconto à vista padrão salvo na planilha~~ → desenhado na **fase 10** (seção 11.9).

## 10. Fatias
1. Desenho ✅
2. Backend ✅
3. Frontend ✅ (Parte 2: novo visual, acréscimo nas peças e cartões cadastráveis ✅)
4. **Arquitetura Pendências:** tela no GitHub Pages, Apps Script como API, PWA e link de configuração (aguardando aprovação)
5. Testes de cálculo: autoteste completo (T14, T15)
6. Documentação final (`GUIA-DO-USUARIO.md` já existe; o `DEPLOY.md` cobre a instalação)
7. **Desconto à vista negociável + engrenagem/Configurações + PIN opcional** (só frontend; `apps-script/` sem mudança; `sw.js` v2) ✅
8. **Dicas "?" + peças discriminadas** (só frontend; `apps-script/` sem mudança; `sw.js` v3) ✅
9. **Neste serviço: oficina, casa e sobra** (só frontend; `apps-script/` sem mudança; `sw.js` v4) ✅
10. **Orçamentos salvos + situação + aba "Resultados"** (**muda o backend**; `sw.js` v5), desenho na seção 11 ✅
    - 10a **backend** (`Codigo.gs` + testes do backend/API + proteção "somente aviso") ✅ aprovada
    - 10b **tela + docs** (`sw.js` v5) ✅ (commit 22e71a4)
11. **Tela mais simples + mês atual automático** (só frontend; `apps-script/` sem mudança; `sw.js` v6), desenho na seção 12 ✅ (commit 43c8e82); identidade do PWA ✅ (950b599); ajustes da seção 13 ✅ (895f51f)
12. **Desempenho** (**muda o backend**; `sw.js` v9), desenho na seção 14 ✅ (commit f306a5d)
13. **Preço por forma de pagamento** (só frontend; `apps-script/` sem mudança; `sw.js` v10), seção 15 ✅ (commit d33c005, publicado)
14. **% por peça, terceiros, entrada + cartão, imposto separado** (**muda o backend**; `sw.js` v11), seção 16: pronto (commit local; publicado junto com o adendo 16.9)

Cada fatia termina com uma parada para revisão. O commit local só é feito depois da aprovação.

## 11. Fase 10 — Orçamentos salvos, situação e aba "Resultados" (desenho **aprovado**; fatia 10a = backend, fatia 10b = tela)

> Base: commit "Neste serviço: oficina, casa e sobra extra; linguagem sem 'lucro'". Reaproveita `calcularOrcamento`, `calcularPrecoComDesconto`, `separarGanho` e `linhasDetalheServico`, além da linguagem "Sobra extra", "Total que é seu", "Paga os gastos da oficina" e "Vai para a sua casa" (= o salário do mecânico). A interface continua **sem "lucro"** (exceção: "Lucro nas peças").
>
> **Esta fase altera o backend.** Ordem de publicação na 11.12: primeiro o `Codigo.gs` em cada planilha + "Nova versão", **depois** o `git push` da tela.

### 11.1 Decisões (A–H **aprovadas**, com os ajustes em D, E, H e B)
| # | Decisão proposta | Alternativa |
|---|---|---|
| A | Topo com **duas abas simples "Orçamento \| Resultados"** dentro da faixa preta, e a engrenagem à direita, como hoje | Ícone de gráfico ao lado da engrenagem (mais escondido) |
| B | **Resultados respeita o PIN** (o mesmo de Configurações). O PIN continua **desligado de fábrica**; ligado, um desbloqueio vale para Resultados **e** Configurações **enquanto o app estiver aberto**, e depois de **5 min em segundo plano** pede de novo | Pedir o PIN toda vez que entra (como hoje em Configurações): mais chato, porque ele vai e volta entre a lista e o orçamento |
| C | Orçamento **Fechado** ou **Não fechou** abre **só para ver**. Para mudar valores: "Voltar para Aberto" (desfaz o fechamento) ou "Duplicar". Cliente e telefone podem ser corrigidos sempre | Permitir editar um Fechado (o fechamento ficaria desencontrado do orçamento) |
| D | **Excluir apaga a linha** da aba (planilha limpa). O DESFAZER (6 s) é feito no app: o pedido só vai ao servidor quando a barra some | Exclusão "marcada" (coluna `excluido`, como no Pendências): a aba fica com linhas mortas |
| D (ajuste) | **Excluído não "ressuscita":** salvar ou mudar a situação de um ID que **não existe mais** na planilha, mas que o aparelho já tinha recebido do servidor (manda `atualizadoEmBase`), é **recusado** com "Esse orçamento foi excluído em outro aparelho." e as saídas [Salvar as minhas como novo] (ID novo) ou [Descartar]. **Só um ID inédito, sem `atualizadoEmBase`, vira linha nova** | — |
| E | **Contagem** pelo **mês em que o orçamento foi feito**, com rótulo explícito: "Orçamentos feitos em novembro: 8 · 5 fecharam · 2 não fecharam · 1 em aberto". **Dinheiro** pela **data do fechamento**: "Dinheiro que entrou em novembro" (e os cards do resultado real). Taxa de fechamento = fecharam ÷ feitos. "?": "Um orçamento feito em outubro e fechado em novembro conta como feito em outubro, mas o dinheiro entra em novembro." | Contar tudo pela data do fechamento (aí "feitos" e "fechados" ficam em bases diferentes) |
| F | No resumo, o card **"Resultado real do mês" vem primeiro** (é a pergunta que importa), depois Orçamentos, Dinheiro do mês e Horas | Manter a ordem da sua lista (Orçamentos primeiro) |
| G | **Situação só muda pela tela do orçamento salvo** (botão "Mudar situação") e pela lista de Resultados. A tela de fechamento **não pede PIN**: ela mostra o mesmo tipo de informação do card "Neste serviço", que já fica aberto | Pedir o PIN para fechar |
| H | **Sem conexão: não salva.** No "Copiar para WhatsApp" o texto é copiado e aparece, bem visível, "Sem conexão: orçamento NÃO foi salvo.". Sem fila offline, como já é regra do app | Fila offline (IndexedDB + reenvio), como no Pendências: bem mais complexo |

### 11.2 Salvar orçamentos (tela Orçamento)
- **Card "Serviço"** ganha, acima de "Qual serviço / veículo?", dois campos **opcionais**:
  - **"Cliente"** (até 60 letras);
  - **"Telefone"** (até 20 caracteres: números, espaço, `( ) + - .`; `inputmode="tel"`). Desde os ajustes da seção 13: máscara brasileira enquanto digita.
  - Nenhum dos dois vai para o WhatsApp.
- **Botões**, abaixo dos resultados, nesta ordem:
  - "Copiar para WhatsApp" (verde);
  - "Compartilhar";
  - **"Salvar orçamento"** (fantasma, novo);
  - "Novo orçamento".
- **Salvamento automático** ao tocar em "Copiar para WhatsApp" (e em "Compartilhar"): copia **primeiro** (não espera a rede) e salva em seguida. Aviso: "Copiado ✓ · Orçamento salvo ✓".
- **Sem mudanças desde o último salvamento:** não chama o servidor e mostra só "Copiado ✓".
- **Vínculo:**
  - o rascunho (`localStorage`) guarda `vinculo = {id, atualizadoEm, criadoEm, situacao}`;
  - salvar de novo um orçamento reaberto **atualiza o mesmo registro** (mesmo ID);
  - **"Novo orçamento"** desvincula.
- **Faixa no topo do card Serviço** quando o orçamento está salvo: "Salvo · Aberto · João" e o link "Ver em Resultados".
- **Foto do momento:** cada salvamento grava junto a entrada **e** tudo o que entrou na conta (11.4, campo `Dados`). Orçamento salvo **não muda** quando os gastos, as taxas ou os ajustes mudarem.
- **Ao reabrir:**
  - a tela calcula **com a foto** e mostra a faixa discreta "Valores de 03/11/2026" + o link **"Recalcular com os valores de hoje"**;
  - recalcular só troca a conta na tela;
  - **só grava se ele tocar em "Salvar orçamento"** (ou copiar), e aí a foto passa a ser a de hoje.
- **Rascunho não salvo e ele abre outro orçamento:** a página pergunta "Você tem um orçamento que não foi salvo." e oferece:
  - [Salvar e abrir];
  - [Descartar e abrir];
  - [Cancelar].

### 11.3 Situação do orçamento
- **Aberto** (padrão ao salvar) · **Fechado** (cliente aceitou) · **Não fechou**.
- **"Mudar situação"** (no orçamento salvo e na lista) abre um menu pequeno:
  - "Fechou" → **tela de fechamento**;
  - "Não fechou" → campo "Motivo (opcional)", até 80 letras, com sugestões em chips "Achou caro", "Vai pensar" e "Fez em outro lugar";
  - "Voltar para Aberto" (só quando Fechado ou Não fechou). Desfaz o fechamento, com a confirmação "O fechamento de R$ X será desfeito.".
- **Tela de fechamento** (tela cheia, empilha no histórico, "← Voltar"; detalhes na 11.7):
  - **"Como o cliente vai pagar?"** — chips:
    - Pix/dinheiro · Débito · Cartão;
    - com Cartão: chips das parcelas **que têm taxa** na foto (1x … 12x);
    - com mais de um cartão na foto: chips "Não sei · Visa/Master · Elo…". Começa no cartão do orçamento; "Não sei" = maior taxa, como no orçamento.
  - **"Valor combinado"** (R$), editável. Começa com:
    - Pix → **à vista oferecido** (com desconto);
    - Débito / Nx → **total daquela forma** (regra B sobre a base, igual a "Ver outras formas");
    - trocar a forma repõe o valor, **a não ser que ele já tenha digitado** um valor.
  - **"Data do fechamento"**: `<input type="date">`, hoje por padrão, sem datas futuras.
  - **Card "Neste fechamento"**: a mesma linguagem e as mesmas cores (verde, âmbar, vermelho) de "Neste serviço" (fórmulas na 11.5).
  - Botão **"Confirmar fechamento"**.
- **Excluir:**
  - "Excluir orçamento" (na lista e no orçamento salvo) mostra "Orçamento excluído · DESFAZER" por 6 s;
  - só depois disso vai o pedido `excluirOrcamento`.

### 11.4 Planilha: abas novas (criadas por `configurarPlanilha_`)

**Aba `Orçamentos`** — uma linha por orçamento, legível. As colunas A–U são **escritas pelo servidor a partir do `Dados` já validado**. A lista de Resultados lê as colunas A–U (rápido); o orçamento aberto lê o `Dados`. Por isso **não edite as colunas à mão** (a lista ficaria diferente do orçamento); apagar a linha = excluir. Datas e IDs ficam em formato **texto** (`@`) para a planilha não convertê-los.

| Col | Cabeçalho | Conteúdo |
|---|---|---|
| A | ID | UUID gerado no aparelho (como no Pendências) |
| B | Criado em | texto `aaaa-mm-dd hh:mm:ss` (servidor, fuso do script `America/Sao_Paulo`) |
| C | Atualizado em | **texto** `aaaa-mm-dd hh:mm:ss.SSS`, carimbado pelo servidor. É o controle de conflito (11.6) |
| D | Cliente | texto |
| E | Telefone | texto (`@`, para não perder o zero nem virar número) |
| F | Serviço / veículo | texto |
| G | Situação | Aberto · Fechado · Não fechou |
| H | Valor orçado (à vista) | R$ — o à vista oferecido |
| I | Data do fechamento | texto `aaaa-mm-dd` (vazio se não fechado) |
| J | Forma de pagamento | Pix/dinheiro · Débito · Cartão |
| K | Parcelas | 1 a 12 (vazio no Pix) |
| L | Cartão | nome ou "Não sei" (vazio no Pix) |
| M | Valor combinado | R$ |
| N | Horas | número |
| O | Peças pagas | R$ (o que ele pagou nas peças) |
| P | Taxa da maquininha | R$ |
| Q | Imposto | R$ |
| R | Paga a oficina | R$ |
| S | Vai para a casa | R$ |
| T | Sobra extra | R$ (pode ser negativa) |
| U | Motivo | texto (Não fechou) |
| V | Dados (JSON) | a foto completa (abaixo) |

As colunas M–T só são preenchidas quando a situação é Fechado. Os valores em R$ são os **exibidos** (centavos, depois do ajuste de arredondamento da 11.5), então a linha fecha no centavo.

**`Dados` (JSON, versão 1, no máximo 30.000 caracteres; o limite da célula é 50.000):**
```
{ v: 1,
  entrada:   { descricao, modo, horasTexto, valorTexto, horasFechadoTexto, pecasModo,
               pecas:[{descricao, qtdTexto, valorTexto}], pecasPagarTexto, pecasCobrarTexto,
               acrescimoTexto, descontoTexto, extraTexto, bandeira },          // exatamente o rascunho da tela
  foto:      { em: 'aaaa-mm-dd hh:mm', parametros:{…todos de Parâmetros…},
               gastosOficina, gastosCasa, horasCobradasMes, minimoHoraOficina, minimoHoraCasa,
               cartoes:[{nome, debito, p1 … p12}] },                            // o que entrou na conta
  resultado: { horas, pecasPagarC, pecasCobrarC, aVistaBaseC, ancora:{parcelas,totalC,parcelaC}|null,
               descontoTotal, oferecidoC, destaques:[{parcelas,totalC,parcelaC}],
               pagaOficinaC, vaiParaCasaC|null, sobraC, totalSeuC|null, pisoOficinaC, pisoCasaC, estado },
  fechamento: null | { forma:'pix'|'debito'|'credito', parcelas, cartao, taxaPct, valorCombinadoC, data:'aaaa-mm-dd',
                       taxaC, impostoC, pecasPagarC, pagaOficinaC, vaiParaCasaC|null, sobraC, totalSeuC|null, estado },
  motivo: '' }
```
(`…C` = centavos inteiros.) A **conta pode ser refeita** a partir de `entrada` + `foto` com as funções puras. Um teste confere que o resultado refeito é igual ao gravado.

**Aba `Meses`** — a foto dos gastos de cada mês:

| Mês | Gastos da oficina (R$) | Gastos da casa (R$) | Horas que você pode cobrar | Gravado em | Origem |
|---|---|---|---|---|---|
| `2026-11` (texto) | 4.000,00 | 3.000,00 | 130 | 05/11/2026 14:02 | Primeiro fechamento · ou · "Usar meus gastos de hoje" |

- **Gravação automática** no **primeiro fechamento de cada mês** (o mês da **data do fechamento**). O servidor lê as abas Gastos e Parâmetros **naquele momento**.
- Depois disso, mudar os gastos **não muda** aquele mês. Para trocar: botão **"Usar meus gastos de hoje neste mês"** em Resultados, com a confirmação "Os gastos de novembro passam a ser oficina R$ X e casa R$ Y.".
- **Mês sem linha:**
  - se for o atual, usa os gastos de hoje, com o aviso "Usando seus gastos de hoje. O mês fica gravado no primeiro fechamento.";
  - se for passado, mostra "Sem gastos gravados para este mês" e o botão para gravar.

**Aba `Parâmetros`** ganha a chave `descontoAVistaPadrao` (11.9).

`salvarDados` continua regravando **só** Gastos, Parâmetros e Taxas. **Nunca** toca em Orçamentos e Meses (tem teste).

### 11.5 Fórmulas
**Fechamento** (função pura nova `calcularFechamento(fotoResultado, foto, forma, parcelas, cartao, valorCombinadoC)` em `calculo.js`; sem arredondar no meio):
- `taxaPct`:
  - Pix = 0;
  - Débito / Nx = `taxaDaForma(foto.cartoes, campo, cartaoEfetivo)`, igual ao orçamento.
- `V = valorCombinadoC / 100`.
- `taxa = V × taxaPct/100` — o que a maquininha fica.
- `imposto = V × impostoPercentual/100` — por dentro, sobre o valor combinado.
- `pagaOficina = horas × minimoHoraOficina` e `vaiParaCasa = horas × minimoHoraCasa` (da foto).
- `sobra = V − taxa − imposto − peças pagas − pagaOficina − vaiParaCasa`.
- `totalSeu = vaiParaCasa + sobra`.
- `estado`:
  - verde: sobra ≥ 0;
  - âmbar: sobra < 0, mas a oficina se paga;
  - vermelho: a oficina não se paga.
- **Arredondamento (regra do R8):**
  - cada linha é arredondada sozinha;
  - "Vai para a sua casa" absorve a diferença (sem casa: "Paga os gastos da oficina"; sem horas: a própria "Sobra extra", porque as peças pagas têm de ser iguais às do orçamento — o servidor confere);
  - assim, **valor combinado − taxa − imposto − peças − oficina − casa = sobra**, exato em centavos;
  - é isso que vai para a planilha.
- **Coerência com o orçamento:** fechar em **Pix pelo à vista oferecido** dá **a mesma sobra** do card "Neste serviço". Fechar no **Nx pelo total** dá a mesma "sobra extra no cartão em Nx". Os dois casos entram como testes.

**Resultado real do mês** (só Fechados com data do fechamento no mês; somas em centavos dos valores gravados):
- `F` = Σ valor combinado (faturamento)
- `P` = Σ peças pagas
- `T` = Σ taxa da maquininha
- `I` = Σ imposto
- `GO`, `GC` = gastos da oficina e da casa **da aba Meses** (ou de hoje, no mês atual sem foto)
- `depoisDaOficina = F − P − T − I − GO` → **"A oficina se pagou?"**
  - ≥ 0: "Sim. Sobraram R$ X depois dos gastos da oficina." (verde)
  - < 0: "Não. Faltaram R$ X para os gastos da oficina." (vermelho)
- **"Sua casa foi coberta?"**, com `casaCoberta = mín(máx(depoisDaOficina, 0), GC)`:
  - `depoisDaOficina ≥ GC`: "Sim, toda: R$ GC."
  - `0 < depoisDaOficina < GC`: "Em parte: R$ casaCoberta de R$ GC (N%)."
  - `≤ 0`: "Não. Nada sobrou para a casa."
- `sobraDoMes = depoisDaOficina − GC` → **"Sobra extra do mês"**. Negativa aparece como "− R$ X", em âmbar ou vermelho, com a mesma regra de cores do card "Neste serviço".
- `totalSeuNoMes = casaCoberta + máx(sobraDoMes, 0)` (= máx(depoisDaOficina, 0)) → **"Total que é seu no mês"**.
- **Horas:**
  - `horasVendidas` = Σ horas dos Fechados;
  - `horasPossiveis` = horas da aba Meses;
  - "40 de 130 horas — 31%".
- "?" do card: "Cada orçamento supõe que você vendeu todas as horas do mês. Aqui é o que aconteceu de verdade: o que entrou nos fechamentos menos peças, taxas, imposto e os gastos do mês."
- **Comparação com o mês anterior** (só se o anterior tiver fechamentos):
  - faturamento: "↑ R$ 1.421,51 (19%)" ou "↓ …";
  - sobra do mês: só a diferença em R$ (porcentagem de número negativo não faz sentido).

### 11.6 Exemplo numérico completo (feito à mão e conferido em Node com as funções atuais)
**Cenário F:**
- gastos: oficina R$ 4.000 e casa R$ 3.000; 5 dias × 6 h × 52/12 = **130 h**;
- mínimo por hora: oficina 30,769231 e casa 23,076923;
- hora R$ 150; imposto **6%**; parcelas "5,10"; Visa/Master padrão (débito 1,37 · 5x 7,57 · 10x 11,06); desconto à vista 5%;
- serviço: **8 h** (mão de obra 1.200); peças pagas **400**, +25% = 500 → base **1.700,00**;
- âncora 5x = 1.700 ÷ 0,9243 = 1.839,2297 → **1.839,23**;
- à vista oferecido = 1.839,2297 × 0,95 = 1.747,268 → **1.747,27**;
- parte de cada serviço: oficina 8 × 30,769231 = **246,15**; casa 8 × 23,076923 = **184,62**.

**Fechamentos** (V = valor combinado):

| Forma | V | Taxa | Imposto 6% | Peças | Oficina | Casa | **Sobra** | Total seu |
|---|---|---|---|---|---|---|---|---|
| Pix (oferecido) | 1.747,27 | 0,00 | 104,84 | 400,00 | 246,15 | 184,62 | **811,66** (= "Neste serviço") | 996,28 |
| Débito 1,37% (1.700 ÷ 0,9863) | 1.723,61 | 23,61 | 103,42 | 400,00 | 246,15 | 184,62 | **765,81** | 950,43 |
| 5x 7,57% (total) | 1.839,23 | 139,23 | 110,35 | 400,00 | 246,15 | 184,62 | **758,88** (= sobra no cartão 5x) | 943,50 |
| 10x 11,06% (1.700 ÷ 0,8894) | 1.911,40 | 211,40 | 114,68 | 400,00 | 246,15 | 184,62 | **754,55** | 939,17 |
| Pix, **valor alterado** para 1.700,00 | 1.700,00 | 0,00 | 102,00 | 400,00 | 246,15 | 184,62 | **767,23** | 951,85 |

Conta de uma linha: 1.723,61 − 23,61 − 103,42 − 400 − 246,15 − 184,62 = 765,81 ✓. Neste cenário, todas as linhas fecham sem precisar de ajuste; o caso com ajuste fica nos testes.

**Mês (novembro/2026):**
- 8 orçamentos feitos: os 5 fechamentos acima, mais 2 "Não fechou" e 1 Aberto;
- foto em Meses: 4.000 · 3.000 · 130 h.

| Linha | Conta | Valor |
|---|---|---|
| Faturamento F | 1.747,27 + 1.723,61 + 1.839,23 + 1.911,40 + 1.700,00 | **8.921,51** |
| Peças P | 5 × 400 | 2.000,00 |
| Taxas T | 0 + 23,61 + 139,23 + 211,40 + 0 | 374,24 |
| Imposto I | 104,84 + 103,42 + 110,35 + 114,68 + 102,00 | 535,29 |
| Depois da oficina | 8.921,51 − 2.000 − 374,24 − 535,29 − 4.000 | **2.011,98** → "A oficina se pagou? **Sim**. Sobraram R$ 2.011,98." |
| Casa | 2.011,98 de 3.000,00 | "Sua casa foi coberta? **Em parte**: R$ 2.011,98 de R$ 3.000,00 (67%)." |
| Sobra extra do mês | 2.011,98 − 3.000 | **− R$ 988,02** (âmbar) |
| Total que é seu no mês | 2.011,98 + 0 | **R$ 2.011,98** |
| Horas | 5 × 8 = 40 de 130 | "40 de 130 horas — 31%" |
| Orçamentos | 8 feitos · 5 fechados · 2 não fecharam · 1 em aberto | fecharam **63%** (5 ÷ 8 = 62,5%) |
| vs. outubro (ex.: faturamento 7.500,00, sobra − 1.500,00) | 8.921,51 − 7.500 = 1.421,51 (18,95%) | "↑ R$ 1.421,51 (19%)" · sobra "↑ R$ 511,98" |

Leitura para o mecânico: **cada orçamento** mostrava sobra positiva (~R$ 750 a 810), porque supõe as 130 h vendidas. **No mês**, ele vendeu só 40 h. A oficina se pagou, mas a casa ficou R$ 988,02 descoberta. É exatamente essa diferença que a aba mostra.

### 11.7 Telas (layout em texto)

**Topo (decisão A):**
```
celular (390 px)                                   notebook (≥ 900 px)
┌──────────────────────────────────────┐          ┌──────────────────────────────────────────────────────────┐
│ [logo] Preço Certo        Salvo ✓  ⚙ │          │ [logo] Preço Certo   [ Orçamento | Resultados ]  Salvo ✓ ⚙│
│ [   Orçamento   |   Resultados    ]  │          └──────────────────────────────────────────────────────────┘
└──────────────────────────────────────┘
```
- Aba ativa sublinhada em laranja, como as abas de Configurações.
- **Com PIN ligado:** tocar em "Resultados" pede o PIN (decisão B). Cancelar volta ao Orçamento.

**Orçamento salvo (celular):**
```
┌ Serviço ─────────────────────────────┐
│ Salvo · [Aberto] · João   Ver em Resultados │
│ Valores de 03/11/2026 · Recalcular com os valores de hoje │
│ Cliente (opcional)    [João Silva         ] │
│ Telefone (opcional)   [(DDD) número       ] │
│ Qual serviço / veículo? [Pastilhas Gol 2015] │
│ …                                    │
└──────────────────────────────────────┘
 … resultados como hoje …
[ Copiar para WhatsApp ]  [ Compartilhar ]
[ Salvar orçamento ]      [ Mudar situação ]   (só quando salvo)
[ Novo orçamento ]
```
- Fechado ou Não fechou (decisão C): os campos de valor ficam desabilitados, com a faixa "Fechado em 07/11 por R$ 1.747,27 (Pix). Para mudar valores: Voltar para Aberto ou Duplicar.".

**Tela de fechamento (celular; no notebook, as duas colunas do orçamento: perguntas à esquerda e o card à direita):**
```
← Voltar
Fechar orçamento
João Silva · Pastilhas Gol 2015

Como o cliente vai pagar?
( Pix/dinheiro ) ( Débito ) ( Cartão )
  Parcelas: (1x)(2x)…(5x)…(12x)          ← só com Cartão; só parcelas com taxa
  Cartão:   (Não sei)(Visa/Master)(Elo)  ← só se houver 2+ cartões na foto
Valor combinado   [R$ 1.747,27]
  À vista com 5% de desconto. Pode mudar (ex.: desconto dado na hora).
Data do fechamento [07/11/2026]

┌ Neste fechamento ? ──────────────────┐
│ Sobra extra: R$ 811,66               │  (verde/âmbar/vermelho)
│ Total que é seu (casa + sobra): R$ 996,28 │
│ ▸ Ver detalhes                       │
│   Valor combinado          R$ 1.747,27 │
│   Taxa da maquininha       − R$ 0,00  │
│   Imposto                  − R$ 104,84 │
│   Peças (o que você pagou) − R$ 400,00 │
│   Paga os gastos da oficina − R$ 246,15 │
│   Vai para a sua casa      − R$ 184,62 │
│   Sobra extra                R$ 811,66 │
└──────────────────────────────────────┘
[ Confirmar fechamento ]
```

**Aba Resultados (celular; uma coluna):**
```
‹   Novembro 2026   ›                      (› desabilitado no mês atual)
┌ Resultado real do mês ? ─────────────┐
│ A oficina se pagou?  Sim. Sobraram R$ 2.011,98 │
│ Sua casa foi coberta? Em parte: R$ 2.011,98 de R$ 3.000,00 (67%) │
│ Sobra extra do mês:  − R$ 988,02     │  (grande, âmbar)
│ Total que é seu no mês: R$ 2.011,98  │
│ vs. outubro: faturamento ↑ R$ 1.421,51 (19%) · sobra ↑ R$ 511,98 │
│ Gastos do mês: oficina R$ 4.000 · casa R$ 3.000 · 130 h │
│   gravados em 05/11 · Usar meus gastos de hoje neste mês │
└──────────────────────────────────────┘
┌ Orçamentos ──────────────────────────┐
│ Feitos em novembro: 8 · 5 fecharam ·  │
│ 2 não fecharam · 1 em aberto  ?      │
│ Fecharam: 63%                        │
└──────────────────────────────────────┘
┌ Dinheiro que entrou em novembro ? ───┐
│ Faturamento          R$ 8.921,51     │
│ Peças (você pagou)   R$ 2.000,00     │
│ Taxas da maquininha  R$ 374,24       │
│ Imposto              R$ 535,29       │
└──────────────────────────────────────┘
┌ Horas ? ─────────────────────────────┐
│ 40 de 130 horas — 31%  [████░░░░░░]  │
└──────────────────────────────────────┘
[ Buscar cliente, telefone ou serviço ]
(Todos)(Aberto)(Fechado)(Não fechou)
┌──────────────────────────────────────┐
│ João Silva                [Fechado]  │
│ Pastilhas Gol 2015 · 07/11 · R$ 1.747,27 │
└──────────────────────────────────────┘
 … (tocar abre o menu: Abrir · Mudar situação · Duplicar · Excluir)
```
- **Notebook:** resumo à esquerda (cards) e lista à direita (busca, filtros e cards), até 1040 px.
- **Mês sem nada:** "Nenhum orçamento em novembro. Os orçamentos que você salvar aparecem aqui." Sem cards de resumo.
- **Lista do mês:** orçamentos **feitos** no mês **ou fechados** no mês. Um orçamento de outubro fechado em novembro aparece em novembro com "orçado em 28/10".
- **Valor no card da lista:** Fechado = valor combinado; os outros = valor orçado (à vista).
- **Busca e filtro:** no aparelho, sobre o mês carregado. O telefone é comparado só pelos números.
- **Atualiza:**
  - ao abrir a aba;
  - ao trocar de mês;
  - ao voltar para o app (`visibilitychange`), se a aba estiver aberta;
  - depois de cada ação.

**Dicas "?" novas (`DICAS`):**
- **Resultado real do mês:** o texto da 11.5.
- **Fecharam:** "Dos orçamentos feitos neste mês, quantos o cliente aceitou."
- **Dinheiro do mês:** "Soma dos orçamentos fechados com data de fechamento neste mês."
- **Horas:** "Horas dos serviços fechados neste mês, comparadas com as horas que você pode cobrar no mês (Meus gastos → Sua rotina)."
- **Neste fechamento:** "Valor combinado menos a taxa da maquininha da forma escolhida, o imposto, as peças e a parte da oficina e da sua casa."

### 11.8 API (ações novas, registro a registro)
O roteador continua aceitando **só** as ações de `ACOES_`. Ordem no `doPost` igual à de hoje: JSON → **token** → ação na lista → lock → `configurarPlanilha_` → ação.

```
listarOrcamentos  {mes:'aaaa-mm'}
  → {ok, mes, primeiroMes, orcamentos:[resumo…], meses:{'aaaa-mm': foto|null (mês e anterior)}, gastosHoje:{oficina, casa, horas}}
    resumo = colunas A–U (sem o JSON), dos orçamentos feitos OU fechados no mês pedido e no anterior (para a comparação).
obterOrcamento    {id} → {ok, orcamento:{id, criadoEm, atualizadoEm, cliente, telefone, situacao, dados}}
                          | {ok:false, naoEncontrado:true, erro:'Esse orçamento foi excluído em outro aparelho.'}
salvarOrcamento   {orcamento:{id, atualizadoEmBase|null, cliente, telefone, dados:{v, entrada, foto, resultado}}}
                  → {ok, id, criadoEm, atualizadoEm, situacao}
                    (upsert: ID novo → linha nova com situação "Aberto"; ID existente → atualiza A–V da MESMA linha;
                     situação, fechamento e motivo NÃO mudam por aqui; em Fechado/Não fechou só aceita cliente e telefone)
mudarSituacao     {id, atualizadoEmBase, situacao:'Fechado'|'Aberto'|'Não fechou', fechamento?:{…}, motivo?}
                  → {ok, atualizadoEm, mesGravado?:'aaaa-mm'}   (Fechado grava a aba Meses se o mês ainda não tiver linha)
excluirOrcamento  {id, atualizadoEmBase} → {ok}                  (apaga a linha)
usarGastosDeHojeNoMes {mes:'aaaa-mm'} → {ok, foto}               (grava ou sobrescreve a linha do mês)
obterDados / salvarDados / obterTaxasPadraoVisa                  (como hoje + descontoAVistaPadrao em parametros)
conflito (salvar, mudar situação ou excluir)
  → {ok:false, conflito:true, erro:'Esse orçamento foi alterado em outro aparelho.', atual:{resumo}}
```

**Regra de conflito (dois aparelhos ao mesmo tempo):**
- Cada orçamento é **uma linha independente**. Dois aparelhos salvando orçamentos **diferentes** nunca se atrapalham.
- O lock serializa as gravações, e cada uma escreve **só a sua linha**: `setValues` de 1 linha, achada pelo ID na coluna A.
- O servidor **carimba** `atualizadoEm` (texto com milissegundos; se coincidir com o anterior, soma 1 ms). O relógio do aparelho não importa.
- O aparelho manda o `atualizadoEmBase` que ele leu:
  - **igual** ao da linha → grava;
  - **diferente** → recusa com "Esse orçamento foi alterado em outro aparelho.";
  - **ID que sumiu** (com `atualizadoEmBase`) → **recusa** "Esse orçamento foi excluído em outro aparelho." (`excluido:true`). O orçamento **não volta** sozinho: o app oferece [Salvar as minhas como novo] (ID novo, sem base) ou [Descartar];
  - **ID que já existe sem `atualizadoEmBase`** (seria "novo") → conflito;
  - **excluir um ID que já não existe** → ok (`jaExcluido:true`), nada a fazer.
- **No app, depois de um conflito:**
  - aviso "Esse orçamento foi alterado em outro aparelho. Suas mudanças não foram salvas.";
  - [Ver a versão nova] recarrega com `obterOrcamento`;
  - [Salvar as minhas como um novo orçamento] cria um ID novo, com as mesmas entradas e a foto de agora;
  - nenhuma das duas opções perde nada sem aviso.
- **O que foi copiado do Pendências** (`apps-script/Code.gs`: `push_`/`pull_`; `js/store.js`) e o que mudou:

  | Copiado | Diferente, e por quê |
  |---|---|
  | ID gerado no aparelho (UUID) e upsert por ID | Pendências: "o último vence" (grava se `atualizadoEm` do aparelho ≥ o da planilha; o mais velho é ignorado em silêncio). **Aqui: recusa** a gravação feita sobre uma versão desatualizada, com aviso, porque você pediu que nada se perca em silêncio |
  | `atualizadoEm` por registro; gravar só a linha afetada, sem regravar a aba | Pendências usa o relógio do aparelho (com carimbo que só cresce). Aqui **o servidor carimba** e a comparação é por **igualdade**: sem problema de relógio |
  | Lock no servidor; validação por campo; teste de ponta a ponta no `testarApi` com registro de teste | Pendências marca `excluido` e tem `servidorEm`/`pull since`. Aqui **apaga a linha** (decisão D) e lista **por mês**: o volume é pequeno e não precisa de sincronização incremental |
  | — | **Sem fila offline (IndexedDB/outbox)** (decisão H) |

**Validação rígida (salvar e mudar situação):**
- `id`: UUID (36 caracteres `[0-9a-f-]`).
- Cliente: até 60; telefone: até 20 e `[0-9 ()+.-]`; motivo: até 80.
- `entrada`:
  - cada texto até 40 caracteres (descrição até 100);
  - peças: no máximo 30, descrição até 80.
- `foto`:
  - `parametros` passa por `validarParametros_`;
  - `cartoes` passa por `validarCartoes_`;
  - os números passam pelos limites de sempre.
- `resultado` e `fechamento`:
  - centavos inteiros entre −MAX e MAX;
  - forma na lista; parcelas de 1 a 12;
  - data `aaaa-mm-dd` válida, até amanhã (folga de fuso);
  - **conferência de soma:** `valorCombinado − taxa − imposto − peças − oficina − casa = sobra` exato.
- JSON acima de 30.000 caracteres → "Orçamento grande demais.".
- **Limites únicos** (`MAX_CLIENTE_`, `MAX_TELEFONE_`, `MAX_MOTIVO_`, `MAX_JSON_ORCAMENTO_`…), com paridade testada entre o frontend e o backend, como hoje.

**Leitura tolerante:**
- linha sem ID ou com JSON corrompido → **ignorada**, com `console.warn('Orçamentos: linha N ignorada (JSON inválido), ID …')` no registro de execução;
- situação desconhecida → "Aberto";
- número inválido numa coluna → 0 no resumo;
- linha de `Meses` inválida → tratada como mês sem foto.

### 11.9 Desconto à vista padrão vai para a planilha
- **Nova chave** `descontoAVistaPadrao` em `Parâmetros`, de 0 a 99, padrão 5, entrando em `LIMITES_PARAMETROS_` e `ORDEM_PARAMETROS_`.
- **O campo muda de lugar:** sai de "Este aparelho" e vai para **Ajustes → Outros ajustes** (atrás do PIN), com a ajuda "Vale para todos os aparelhos ligados a esta planilha." A dica "?" é ajustada.
- **Migração (uma vez):**
  - na leitura, se a chave **não existir** na aba, `obterDados` devolve `parametrosAusentes:['descontoAVistaPadrao']`;
  - se o aparelho tiver `precoCerto.descontoPadrao.v1` válido, o app grava esse valor (`salvarDados`) e, **depois do "Salvo ✓"**, apaga a chave local;
  - sem valor local, grava 5;
  - o primeiro aparelho a abrir vence: um segundo aparelho com valor diferente perde o dele, com o aviso "O desconto padrão agora vem da planilha: X%.".
- **Compatibilidade com a tela antiga** (o celular ainda não tocou em ATUALIZAR): `validarParametros_` aceita `descontoAVistaPadrao` **ausente** e, nesse caso, **mantém o valor que já está na aba**. Sem isso, a tela antiga não conseguiria salvar os gastos depois da troca do backend. Tem teste.

### 11.10 Frontend: o que muda (resumo)
- **`calculo.js`** (puras, testadas):
  - `calcularFechamento`, `linhasDetalheFechamento`, `resumoDoMes(fechados, fotoMes)`;
  - `mesDe(data)` e `navegarMes`;
  - `fotoDoOrcamento(dados, entrada)` e `refazerDaFoto(entrada, foto)`;
  - `normalizarTelefone`.
- **`app.js`:**
  - aba Resultados (com PIN);
  - tela de fechamento;
  - vínculo do rascunho;
  - salvar/copiar;
  - conflito;
  - DESFAZER da exclusão;
  - dicas novas;
  - migração do desconto.
- **`api.js`:** sem mudança. As ações novas usam o mesmo `chamar`; a resposta de conflito vira o erro com tipo `conflito`.
- **`sw.js`:** v5.
- **Linguagem:** nenhum texto novo com "lucro". O WhatsApp **não** muda (sem cliente, sem telefone, sem situação).

### 11.11 Testes (implementar depois do OK)
**Backend (Node, planilha simulada) e API:**
1. Upsert: salvar 2× o mesmo ID → **1 linha**, `Criado em` mantido, `Atualizado em` novo; ID novo → linha nova "Aberto".
2. Conflito: aparelho A e B leem; A salva; B salva com a base velha → `conflito:true` e a linha fica com os dados de A. Excluir e mudar situação com base velha → conflito. **Excluído não ressuscita:** A abre, B exclui, A salva → recusado ("excluído em outro aparelho"), nenhuma linha criada; A "salva como novo" (ID novo, sem base) → linha nova. Mudar situação de um excluído → recusado.
3. Orçamentos **diferentes** salvos em sequência intercalada por A e B → os dois gravados, nenhum tocado pelo outro.
4. `salvarDados` não altera Orçamentos nem Meses (conteúdo idêntico antes e depois).
5. Roteador: só as ações da lista (`apagarTudo`, `trocarToken`… → "Ação desconhecida."); sem token → "Acesso não autorizado" **antes** de tocar na planilha, para todas as ações novas.
6. Validação: cada limite (cliente 61, telefone com letra, 31 peças, JSON > 30.000, data inválida ou futura, soma do fechamento que não fecha, parcelas 13) → mensagem clara.
7. Leitura tolerante: linha com JSON quebrado é ignorada e registrada no log; as outras aparecem.
8. Meses: 1º fechamento de novembro grava a linha; 2º não muda; mudar Gastos e fechar de novo → novembro **igual**; "Usar meus gastos de hoje" → muda; outubro intacto.
9. `descontoAVistaPadrao`: ausente → `parametrosAusentes`; `salvarDados` da tela antiga (sem a chave) mantém o valor da aba; fora de 0–99 → erro.

**Cálculo (`calculo.js`, igualdade exata em centavos):**

10. Fechamentos do cenário F (11.6): Pix, Débito, 5x, 10x e Pix alterado (1.700) → os números da tabela (taxa, imposto, oficina, casa, sobra, total seu).
11. Coerência: Pix pelo oferecido = sobra de "Neste serviço" (811,66); 5x pelo total = sobra no cartão em 5x (758,88).
12. Soma no centavo (R8) em 20 valores combinados variados, com e sem casa, com e sem horas e com imposto: `V − taxa − imposto − peças − oficina − casa = sobra` sempre.
13. Estados do fechamento: verde, âmbar e vermelho.
14. Resumo do mês do exemplo (11.6): faturamento 8.921,51 · peças 2.000 · taxas 374,24 · imposto 535,29 · depois da oficina 2.011,98 · casa em parte 67% · sobra − 988,02 · total seu 2.011,98 · 40 de 130 h (31%) · 5 de 8 = 63% · ↑ R$ 1.421,51 (19%).
15. Mais dois meses, para os três estados: um em que a casa é coberta inteira (verde) e um em que a oficina não se paga (vermelho).
16. Mês pela **data do fechamento**: orçamento de 28/10 fechado em 03/11 conta no dinheiro de novembro e na contagem "feitos" de outubro.
17. Navegação de meses: dez/2026 → jan/2027 e volta; não passa do mês atual; mês vazio.
18. Foto × recalcular: reabrir com gastos alterados mostra os valores antigos; "Recalcular" mostra os de hoje e **não grava** até salvar; refazer a partir da foto = resultado gravado.

**Tela (puppeteer, 390 e 1280, prints):**

19. Salvar → "Orçamento salvo ✓"; copiar salva automaticamente; copiar de novo sem mudança não chama o servidor; sem conexão → aviso, e o texto foi copiado.
20. Reabrir, mudar e salvar → mesma linha; "Novo orçamento" desvincula.
21. Fechar com Pix, Débito, 5x e 10x pela tela; mudar o valor combinado → card recalculado; data futura recusada.
22. Não fechou com motivo; voltar para Aberto; excluir + DESFAZER (nada enviado) e excluir sem desfazer (enviado depois de 6 s).
23. Resultados: PIN pedido (decisão B); busca por cliente, telefone e serviço; filtros; mês vazio; `visibilitychange` atualiza.
24. Conflito simulado no mock → aviso e as duas saídas.
25. Varreduras de sempre:
    - interface sem "lucro" (exceto "Lucro nas peças");
    - WhatsApp sem termos internos (nem cliente, telefone ou situação);
    - segredos;
    - `sw.js` v5;
    - PWA v5 → v6.

Se alguma conta divergir do esperado acima: **parar e reportar** (não ajustar o esperado).

### 11.12 Publicação (o que o DEPLOY.md vai dizer) e riscos
**Ordem obrigatória:**
1. **Em cada planilha** (a de teste e a do mecânico):
   1. Extensões → Apps Script;
   2. **copie a sua `URL_DA_API`**;
   3. cole o `Codigo.gs` novo e recoloque a `URL_DA_API`;
   4. salve;
   5. **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** (a URL continua a mesma);
   6. rode **`testarApi`**: deve criar e apagar um orçamento de teste e passar tudo.
2. **Só depois:** subir `sw.js` para v5, fazer a conferência de segredos e o **`git push`** da tela.
3. Em cada aparelho: "Nova versão disponível · ATUALIZAR".

**Por que nessa ordem:** a tela nova chama ações que só o backend novo conhece. Ao contrário (tela antes), "Salvar orçamento" e "Resultados" dariam "Ação desconhecida.". Já a tela antiga continua funcionando com o backend novo (11.9).

**Riscos e cotas do Apps Script (conta Google gratuita):**
- **Lock:** todas as ações passam pelo mesmo lock (espera até 10 s). Com 2 aparelhos, a espera é rara; se estourar: "A planilha está ocupada. Tente de novo em alguns segundos.".
- **Velocidade:**
  - `listarOrcamentos` lê as colunas A–U da aba inteira (sem o JSON);
  - com ~100 orçamentos/mês, 5 anos = 6.000 linhas: ainda abaixo de 2 s;
  - o JSON só é lido em `obterOrcamento`.
  - Se um dia ficar lento: arquivar anos antigos numa aba "Orçamentos 2026" (fora desta fase).
- **Tamanho:** célula até 50.000 caracteres (limite nosso: 30.000); planilha até 10 milhões de células (22 colunas × 6.000 linhas = 132 mil).
- **Execuções simultâneas:** limite de 30 por usuário. Não é problema com 2 aparelhos.
- **Edição manual da aba Orçamentos:** apagar a linha = excluir. Mudar valores nas colunas deixa a lista diferente do orçamento aberto (que lê o JSON): o GUIA vai pedir para não editar.
- **Orçamentos ficam na planilha do mecânico:** nome e telefone de clientes passam a ficar lá, protegidos pelo mesmo token; nada vai para o repositório público.
- **Migração do desconto:** um segundo aparelho com valor diferente perde o dele (com aviso).

**Fatias:** 10a = backend (`Codigo.gs`) + testes do backend/API, com parada; 10b = tela, docs (DEPLOY, GUIA, testes-calculo), `sw.js` v5, todos os testes e prints, com parada antes do commit.

## 12. Fase 11 — Tela mais simples (Orçamento e Resultados) e mês atual automático (desenho **aprovado** com o ajuste da decisão 5)

**Só frontend.** `apps-script/` sem mudança (D10); `sw.js` v6. **Nenhuma conta existente muda** (os casos de cálculo continuam iguais); só uma conta nova ("quanto falta trabalhar"), com casos novos.

### 12.1 Orçamento ABERTO (ou novo): coluna da direita
- **Quanto cobrar:**
  - card do cartão (preço cheio) como hoje; chips de cartão só com 2+ cartões;
  - card à vista com o campo "Desconto à vista (%)";
  - link **"O cliente pediu mais desconto?"** → aparecem o campo "Desconto extra" e a faixa "ainda pode dar"; com extra > 0, já abre aberto;
  - a faixa vermelha **"cobra R$ X abaixo do seu preço"** (texto da seção 13; antes "abre mão da sua sobra extra") continua visível sem o link (é aviso; aparece também quando o próprio desconto à vista passa do máximo);
  - "Ver outras formas de pagamento" como hoje.
- **Fica para você neste serviço:**
  - número GRANDE = total que é seu (casa + sobra) no à vista com o desconto atual; sem gastos de casa, o número grande é a sobra;
  - linha: "R$ X do seu salário + R$ Y de sobra"; sobra negativa → "R$ X do seu salário, menos R$ Y que faltou"; sem casa → só "R$ Y de sobra";
  - linha discreta "No cartão em 5x fica: R$ Z" (5x = a parcela do card do cartão/âncora; Z = salário exibido + sobra no cartão arredondada, com `op.lucro` que já é calculado hoje; é a soma dos valores mostrados, como no R8: no print, 423,07 + 1.314,79 = 1.737,86, o mesmo total do fechamento em 5x). Hoje essa linha só aparece com imposto e na maior parcela;
  - cores verde/âmbar/vermelho e frases como hoje.
- **Ver detalhes:** fechado por padrão, mesmas linhas e os dois pisos. "Diferença pelo desconto à vista" → **"Ganho por ter desconto menor que a maquininha"**; quando negativa (desconto maior que a maquininha) → **"Perda por desconto maior que a maquininha"**.
- **Pisos só como alerta** (preço = à vista oferecido):
  - abaixo do piso da oficina → vermelho "Abaixo de R$ X a oficina não se paga";
  - senão, até 10% acima do piso da casa (preço ≤ piso da casa × 1,10) → âmbar "Cuidado: abaixo de R$ X não sobra nada para a sua casa";
  - sem casa: âmbar até 10% acima do piso da oficina, com a frase da oficina.

### 12.2 Orçamento FECHADO e NÃO FECHOU
- **Fechado:**
  - card de resumo no topo da coluna: "Fechado em 05/11 · Cartão em 5x · Cliente paga R$ 6.648,27";
  - somem chips, campos de desconto, o link do extra, "ainda pode dar" e "Ver outras formas";
  - os cards do cartão e do à vista **também somem** (ajuste aprovado da decisão 5): a coluna fica só com o card de resumo, o "Fica para você" (com a forma do fechamento) e os botões;
  - "Fica para você" usa o que foi **gravado no fechamento** (`vaiParaCasaC`, `sobraC`, `totalSeuC`, `estado`); nada é recalculado.
- **Não fechou:**
  - card "Não fechou · {data} · {motivo}" (sem afirmar que foi a data exata da decisão), sem bloco de cobrança e sem "Fica para você";
  - ações "Voltar para Aberto" e "Duplicar";
  - a data é a do "Atualizado em": a data do "não fechou" não é gravada à parte, e gravar exigiria mudar o backend. Se o cliente ou o telefone forem editados depois, essa data avança.

### 12.3 Botões
| Estado | Botões |
|---|---|
| Aberto/novo | **Copiar para WhatsApp** (grande) · em linha: **Salvar** e **O cliente fechou?** |
| Fechado | **Copiar para WhatsApp** · em linha: **Mudar situação** e **Duplicar** |
| Não fechou | em linha: **Voltar para Aberto** e **Duplicar** |

- **O cliente fechou?** abre direto a tela de fechamento. Num orçamento novo ou alterado, salva antes, como hoje. Na tela de fechamento entram os links **"O cliente não fechou"** (motivo, como hoje) e, se ele já estiver em "Não fechou", **"Voltar para Aberto"**.
- **Mudar situação** (Fechado): menu com "Voltar para Aberto" e "Excluir orçamento".
- **Excluir um orçamento Aberto:** pela lista de Resultados (sai da tela do orçamento aberto).
- **Compartilhar:** só com `navigator.share` **e** tela estreita (< 900 px, o mesmo corte das 2 colunas).
- **"+ Novo orçamento":** link discreto no topo do card Serviço. Com alteração não salva (orçamento salvo mudado, ou rascunho novo com conteúdo), pergunta na página: "Começar um novo? O que você fez aqui não foi salvo." [Salvar e começar novo] [Começar sem salvar] [Cancelar].
- "?" revistos: "Neste serviço" → "Fica para você neste serviço", desconto (com o link do extra) e situação.

### 12.4 Resultados
- **Card principal** (substitui "Resultado real do mês"):
  - título: "Novembro até agora · dia 8 de 30" no mês corrente; "Resultado de outubro" nos passados;
  - **barra "Oficina"** = livre ÷ gastos da oficina, com livre = F − P − T − I; 100% → verde "✓ paga", abaixo → âmbar com "R$ X de R$ Y";
  - **barra "Sua casa"** = casa coberta ÷ gastos da casa ("R$ 780,96 de R$ 5.500,00"); sem gastos de casa: só a barra da oficina;
  - **frase grande:**

    | Situação | Mês corrente | Mês passado |
    |---|---|---|
    | Casa coberta | "Sobrou R$ X além da casa este mês" (verde) | "Sobrou R$ X além da casa" (verde) |
    | Casa não coberta | "Faltam R$ X para cobrir a casa este mês" (âmbar) | "Faltaram R$ X para cobrir a casa" (vermelho discreto) |
    | Oficina não coberta | "Faltam R$ X para pagar a oficina este mês" (âmbar) | "Faltaram R$ X para pagar a oficina" (vermelho discreto) |

    Na linha "Oficina não coberta", X = gastos da oficina − livre; o que falta da casa aparece na barra da casa. O mês corrente **nunca** fica vermelho.

    > **Revogado pelo adendo da seção 17 (17.8):** a frase passa a dizer o TOTAL que falta (oficina + casa), com a divisão numa linha menor embaixo.
  - **rodapé discreto:** "Gastos do mês: oficina R$ X · casa R$ Y · Z h" e a comparação com o mês anterior. O link "Usar meus gastos de hoje" sai (12.5).
- **Quanto falta trabalhar** (só no mês corrente, só se a sobra do mês < 0, só com horas vendidas > 0 e livre > 0):
  - falta = −sobraDoMes (oficina + casa);
  - N = ⌈falta × horas vendidas ÷ livre⌉ (em centavos inteiros, sem arredondar o R$/h no meio);
  - média = horas vendidas ÷ serviços fechados no mês; M = ⌈N ÷ média⌉;
  - "Faltam cerca de N horas de serviço (uns M serviços como os deste mês)", com "Você ganha uns R$ 131,03 por hora de serviço, já tirando peças, maquininha e imposto." embaixo.
- **Extrato do mês** (no lugar de "Dinheiro que entrou"), em centavos inteiros (fecha por construção, como no R8):

  | Linha | Valor |
  |---|---|
  | Entrou | F |
  | − Peças | P |
  | − Maquininha | T |
  | − Imposto | I |
  | − Gastos da oficina | GO |
  | **= Ficou para a casa** | ("Faltou para a oficina" se negativo) |
  | − Gastos da casa | GC |
  | **= Sobra extra** | (ou **"Faltou"**) |

  O título "Dinheiro que entrou em {mês}" e o "?" da data do fechamento ficam.
- **Lista:** nos itens Aberto, "Mudar situação" → **"Fechou? / Não fechou?"** (mesma ação, o menu); em Fechado e Não fechou continua "Mudar situação". Abrir · Duplicar · Excluir ficam.

### 12.5 Mês atual acompanha os gastos (sem mudar o backend)
Usa a ação que já existe, `usarGastosDeHojeNoMes(mes)`: ela grava ou troca a linha do mês com os gastos atuais da planilha e só recusa mês futuro.
- **Depois de cada `salvarDados` com "Salvo ✓"**, se os totais mudaram (oficina, casa ou horas do mês, comparados antes e depois), o app chama a ação para o **mês corrente**, sem aviso.
  - Se falhar, guarda "pendente: {mês}" no aparelho e tenta de novo no próximo salvamento ou ao abrir Resultados.
  - Se o mês já virou, descarta a pendência (o mês novo é coberto pelo item abaixo).
- **Ao abrir Resultados no mês corrente:** se a foto do mês ≠ `gastosHoje` (os dois vêm na mesma resposta do `listarOrcamentos`), ou se ainda não há foto, chama a ação e redesenha. Isso cobre o caso de outro aparelho ter mudado os gastos; entre aparelhos vale "a última gravação vence", sem aviso.
- **Meses passados ficam congelados.** O link e o diálogo "Usar meus gastos de hoje neste mês" saem da aba Resultados.
- **Ajustes → Outros ajustes → "Corrigir gastos de um mês passado"** (atrás do PIN, como toda a engrenagem): escolhe o mês (‹ ›, só passados), mostra os gastos gravados ("Sem gastos gravados" se não houver) e oferece [Substituir pelos gastos de hoje], com confirmação na página.
- **"?" de Meus gastos** ganha: "Se um gasto só começa no mês que vem (ex.: aumento do aluguel), lance no dia 1º."
- **Na aba Meses**, as linhas gravadas por esta atualização automática aparecem com a Origem "Usar meus gastos de hoje" (texto do backend da fase 10, que não muda). Ao abrir Resultados no mês atual sem linha do mês, a linha é criada na hora; o 1º fechamento do mês não duplica.
- **Limitação conhecida (aprovada):** um mês sem nenhuma mudança de gastos, sem abrir Resultados e sem fechamento fica sem foto. Mas esse mês também não tem dinheiro, então o resultado não muda.

### 12.6 Testes (depois do OK)
- **Cálculo:** os 96 atuais iguais, mais os casos novos:
  - **Q1** (o exemplo): F 9.126,93 · P 3.780,00 · T 503,27 · I 912,70 · 30 h · 3 fechados · GO 3.150,00 · GC 5.500,00 → livre 3.930,96 · R$ 131,03/h · casa coberta 780,96 (14%) · falta 4.719,04 · **N = 37** (36,01) · média 10 h · **M = 4**;
  - **Q2:** sem horas, e livre ≤ 0 → não mostra;
  - **Q3:** sobra ≥ 0 → não mostra;
  - **Q4:** extrato fechando no centavo;
  - **Q5:** frases dos 4 estados × mês corrente/passado;
  - **Q6:** barras em 100%, parcial e sem casa.
- **Tela:**
  - aberto: extra escondido e aparecendo; extra > 0 já aberto; detalhes fechados; alerta de piso nos limites (abaixo, a 10%, acima de 10%);
  - fechado em Pix e em 5x; não fechou; botões por estado;
  - Compartilhar só no celular; "+ Novo orçamento" com confirmação;
  - mês automático: mudar um gasto → foto atualizada; dezembro simulado não mexe em novembro; outro aparelho → atualiza ao abrir Resultados; falha → nova tentativa no próximo salvamento; "Corrigir mês passado" com confirmação.
- **D10:** `apps-script/` sem mudança (hash). Os testes antigos só mudam onde este desenho muda a tela (textos, botões, link removido).
- **Prints 390/1280:**
  - Orçamento: aberto simples, aberto com "pediu mais desconto", fechado 5x, não fechou, alerta de piso;
  - Resultados: o mês do exemplo, um mês positivo e "Corrigir gastos de um mês passado".

### 12.7 Implementação (o que ficou registrado)
- Funções puras novas em `js/calculo.js` (com casos): `painelDoMes`, `fraseDoMes`, `quantoFaltaTrabalhar`, `extratoDoMes`, `alertaDoPiso`. As contas antigas não mudaram.
- **Exemplo do print** (casos PR1 e PR2, seção 7 do `testes-calculo.md`): o orçamento aberto mostra sobra no cartão 5x de 1.314,79 (casa absorve o centavo: 423,07); no fechamento em 5x, cada linha é arredondada sozinha: **423,08 + 1.314,78 = 1.737,86**. O total que é seu é idêntico. **Divergência aceita.**
- "No cartão em 5x fica" soma os valores mostrados (salário exibido + sobra no cartão arredondada): 423,07 + 1.314,79 = 1.737,86, igual ao total do fechamento em 5x.
- "Quanto falta trabalhar": N = ⌈falta × horas ÷ livre⌉, sem arredondar o R$/h no meio (exemplo: 36,01 → 37 h; média 10 h → 4 serviços).
- Tela de fechamento: links "O cliente não fechou" (Aberto) e "Voltar para Aberto" (Não fechou); depois de confirmar, sai da tela.
- "Compartilhar": `navigator.share` **e** `(max-width: 899px)`; acompanha a mudança de largura.

## 13. Ajustes pequenos: texto do desconto, máscara do telefone e espaçamento (só frontend; `sw.js` v8)

`apps-script/` sem mudança (D10). Nenhuma conta muda.

### 13.1 Texto da faixa vermelha do desconto
- "Com esse desconto você cobra R$ X abaixo do seu preço." (o mesmo X = base − à vista oferecido). O texto antigo ("abre mão de R$ X da sua sobra extra") exagerava: a sobra cai menos que X, porque o imposto também diminui (ex.: 447 − 411,07 = 35,93; a sobra cai 102,69 − 70,35 = 32,34).
- O "?" do desconto extra e o GUIA usam a mesma frase.

### 13.2 Máscara do telefone
- Funções puras em `js/calculo.js`: `digitosDoTelefone` (só números; tira o +55/55 do começo quando sobram 12 ou 13; no máximo 11) e `formatarTelefone` ("(11) 98888-7777" com 11 números, "(11) 3333-4444" com 10, parcial enquanto digita: "(1", "(11", "(11) 9888", "(11) 9888-8").
- Na tela (`mascararTelefone`): só números (letras e símbolos digitados são ignorados); a 12ª tecla é ignorada; colar aceita qualquer formato; o cursor fica depois do mesmo número em que estava; apagar um símbolo da máscara ("-", ")", espaço) apaga o número ao lado (senão nada mudaria).
- `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`, placeholder "(DDD) número".
- Grava na planilha já formatado. Telefone antigo sem máscara aparece formatado ao abrir e vai formatado no próximo salvamento. Número incompleto (menos de 10) é aceito como está, sem erro.
- Busca em Resultados: compara só os números (já era assim: "98888" e "(11) 9888" acham "(11) 98888-7777" e "11988887777").
- O backend não muda: o formato da máscara já passa na validação do `Codigo.gs` (até 20 caracteres, números, espaço, `( ) + - .`).

### 13.3 Espaçamento
- Cliente | Telefone usavam a grade dos campos de desconto, que zera a margem de baixo: o rótulo "Qual serviço / veículo?" ficava colado. Agora usam `.campos-lado` (2 colunas, 12 px entre elas, e os 16 px normais até o próximo rótulo); abaixo de 380 px, um embaixo do outro, com os mesmos 16 px.
- Conferidos os cards Peças, Meus gastos (gastos, Sua rotina, valor da hora) e Ajustes (cartões, Outros ajustes, Este aparelho): já estavam com 16 px; nada a corrigir.

## 14. Desempenho: menos tempo de Apps Script por chamada e menos chamadas (desenho **aprovado**: decisões 1 e 2 = sim)

**Muda o backend** (colar o `Codigo.gs` → Nova versão → `testarApi` → `git push`) e a tela (`sw.js` v9). **Nenhuma regra de cálculo muda.**

Medição real (planilha de teste, 5 rodadas, com *cold start*), por chamada:
- ~1,2–1,4 s de rede e "porta" do Apps Script (piso, não dá para tirar);
- **~0,9–1,25 s de `configurarPlanilha_`** (`garantirAba_` ×5 ~0,7 s, migração das taxas ~0,2 s, proteções ~0,12 s);
- ~0,13 s de lock;
- **~0,3 s por leitura de aba**;
- tela: 0,02–0,2 s.

Fluxos: abrir ~4,0 s · Resultados ~4,0 s · salvar ~3,4 s · fechar ~6,8 s.

### 14.1 Backend
**A. Pular `configurarPlanilha_` quando nada mudou**
- `ESQUEMA_VERSAO_ = 1` no código. Depois de uma configuração completa sem erro, ela é gravada em DocumentProperties (`esquemaV`).
- Em cada pedido, uma leitura só de DocumentProperties (`getProperties()`, que traz também a versão da config, em B): se `esquemaV` for a atual, não roda a configuração.
- **Aba sumiu** (apagada à mão): os pontos que pegam uma aba passam por `aba_(nome)`. Se ela vier `null`, roda a configuração completa uma vez e segue.
- Versão nova no código: migração e proteções rodam de novo, como hoje.

**B. Cache dos dados de configuração** (gastos, ajustes, cartões, `atualizadoEm`, `urlPlanilha`, `parametrosAusentes`)
- Fica no CacheService (cache do script; cada planilha tem o seu script, então o cache é por planilha), validade de 6 h (o máximo).
- **`obterDados` com cache: sem lock e sem tocar na planilha.**
- `obterDados` sem cache: lê a planilha **com lock** (como hoje) e repõe o cache.
- **`salvarDados`:** dentro do lock, depois de gravar, repõe o cache com o que foi gravado, já no formato em que a leitura devolveria (ex.: números com 4 casas, como a aba guarda). Um teste confere cache = leitura nova da planilha.
- **Tamanho:**
  - o limite é 100 KB por item;
  - o valor típico é de 2–10 KB (o pior caso, 200 gastos + 12 cartões, fica em ~35 KB);
  - acima de 90 KB, não usa cache (lê a planilha);
  - se o `put` falhar, segue sem cache.
- **Edição à mão na planilha**, conferido na documentação:
  - **não está confirmado** que o CacheService funcione em gatilho simples. A documentação só diz que gatilho simples não acessa "serviços que exigem autorização" e não cita o CacheService;
  - **o PropertiesService está confirmado** no modo do gatilho simples.
  - Por isso: um `onEdit(e)` simples, em edição nas abas Gastos, Parâmetros ou Taxas, sobe a "versão da config" (`configV`) nas DocumentProperties. O cache guarda a `configV` com que foi montado; se for diferente, é como se não houvesse cache.
  - Custo: nenhum a mais, porque a `configV` vem na mesma leitura das DocumentProperties de A.
  - Gravações feitas pelo próprio script não disparam o `onEdit` (está na documentação).
  - **Apagar linhas à mão** pode não disparar o `onEdit` (a documentação não diz).
- **Para esses casos:** em Ajustes, um link discreto **"Recarregar da planilha"** força a leitura completa (`obterDados` com `forcar:true`, com lock, e repõe o cache). Sem o link, a mudança aparece em até 6 h ou no próximo salvamento pelo app.
- **Escopo:** o CacheService não tem escopo OAuth; o `appsscript.json` continua só "esta planilha". Se aparecer pedido de autorização novo ao rodar o `testarApi`, eu paro e aviso.

**C. Lock só nas gravações**
- Sem lock: `obterDados` (com cache), `listarOrcamentos` e `obterOrcamento`.
- Conferido no código:
  - as abas Orçamentos e Meses **nunca** são apagadas e regravadas: as gravações são linha a linha (`setValues` de uma linha), e só o excluir usa `deleteRow`;
  - **já Gastos, Parâmetros e Taxas são apagadas e regravadas** (`regravarCorpo_`) em todo `salvarDados`. Por isso, ler essas abas continua **com lock** (só acontece quando não há cache).
- **O `deleteRow` sem lock pode deslocar linhas no meio de uma leitura.** Proteções:
  - `obterOrcamento` confere se o ID da linha lida é o pedido. Se não for, lê de novo **com lock**.
  - `listarOrcamentos`: linha sem ID válido é ignorada, como já é hoje. A conferência do JSON compara o ID da mesma leitura; se não bate, não descarta o orçamento.

**D. `listarOrcamentos` com menos leituras**
- **Orçamentos:** colunas A–U, uma leitura.
- **JSON:** só das linhas do **mês pedido**. Não é mais um bloco contínuo desde a primeira linha: são trechos seguidos de linhas, normalmente 1 ou 2 leituras (o mês está no fim da aba; um orçamento antigo fechado neste mês vira um trecho a mais).
- **Meses:** uma leitura (as fotos deste mês e do anterior saem dela).
- **Gastos de hoje:** do cache B (sem cache: leitura com lock, que repõe o cache).
- **Foto do mês corrente dentro do `listarOrcamentos`:**
  - quando não existe ou é diferente dos gastos de hoje, grava ali mesmo e devolve já atualizada;
  - pega o lock só para essa gravação e confere de novo dentro dele;
  - o mês corrente é o do servidor (America/Sao_Paulo).
  - Substitui a sequência `listarOrcamentos → usarGastosDeHojeNoMes → listarOrcamentos` da tela, que passa a fazer 1 chamada.
  - `usarGastosDeHojeNoMes` continua existindo (para "Corrigir gastos de um mês passado").
- **Resultado:** de 5 leituras + 2 `acharLinhaMes_` + 2 `lerFotoDoMes_` para 2–3 leituras.

**E. `mudarSituacao`:** **não precisa mudar.**
- Ele já só recebe `id` e `atualizadoEmBase` (o conflito é checado pelo `atualizadoEm` no servidor).
- Precisa ler a linha dentro do lock de qualquer jeito: confere o fechamento com a foto gravada (a validação rígida fica) e regrava a linha.
- O `obterOrcamento` antes dele era coisa da tela (F2).

**Decisão 1 (aprovada):** o `salvarDados` atualiza a foto do mês corrente no mesmo lock quando os totais mudam (1 chamada em vez de 2). A tela não chama mais `usarGastosDeHojeNoMes` depois de salvar gastos; a ação continua para "Corrigir gastos de um mês passado".

**F. Mantém:** token antes de tudo, roteador fechado (as mesmas 9 ações), validação rígida, leitura tolerante, conflito e excluído, proteção com aviso.

**`testarApi` ampliado:**
- cache preenchido depois do `obterDados`;
- cache reposto pelo `salvarDados`;
- cache ignorado depois de subir a `configV`;
- configuração pulada com a versão certa;
- **decisão 2 (aprovada):** o `testarApi` não apaga nenhuma aba da planilha real; o caso "aba sumida" fica só nos testes locais.

### 14.2 Frontend
- **F1. Resultados na hora:**
  - a última resposta de cada mês fica no aparelho (`precoCerto.resultados.v1`, com a URL da API e até 6 meses);
  - ao abrir ou trocar de mês, aparece na hora com "Atualizando…" discreto, e a resposta do servidor substitui;
  - "Desconectar este aparelho" apaga esse cache.
- **F2. "O cliente fechou?":**
  - sem alteração não salva, monta a tela de fechamento com o que já está no aparelho (entrada, foto e resultado do orçamento salvo) e não chama `obterOrcamento`;
  - "Confirmar" faz **1 chamada** (`mudarSituacao`);
  - com alteração não salva: salva antes (1 chamada) e abre a tela sem `obterOrcamento`;
  - pela lista de Resultados continua o `obterOrcamento`, porque a lista não tem o JSON.
- **F3. Salvar e fechar sem travar:**
  - na hora: "Salvando…" e, no fechamento, o resumo "Fechado em…" já aparece;
  - a interface continua livre;
  - se der erro (rede, conflito, excluído), volta o estado anterior e avisa, com os mesmos avisos de hoje.
- **F4. Abrir o app:** continua mostrando o cache na hora; o `obterDados` fica mais rápido por B.
- **F5. "Recarregar da planilha"** em Ajustes (B).

### 14.3 Estimativa (a confirmar na nova medição)
| Fluxo | Antes | Depois (estimado) | Por quê |
|---|---|---|---|
| Abrir (dados do servidor) | ~4,0 s | ~1,4–1,7 s | sem configuração, sem lock, sem ler a planilha (cache) |
| Resultados | ~4,0 s | **na hora** (cache) e ~2,0–2,5 s para atualizar | 1 chamada, 2–3 leituras, sem lock |
| Salvar orçamento | ~3,4 s | ~2,2 s (e "Salvando…" na hora) | sem configuração |
| Fechar | ~6,8 s | ~2,3 s (e o resumo na hora) | 1 chamada em vez de 2, sem configuração |

### 14.4 Testes e medição
- **Mantidos:** todos os atuais (cálculo inalterado). O D10 passa para o hash novo aprovado.
- **Novos:**
  - cache: hit, miss, reposição no `salvarDados` e invalidação pela `configV`;
  - cache = leitura nova;
  - configuração pulada e refeita quando falta aba;
  - `obterDados` sem lock com `salvarDados` concorrente (simulado) não vê aba vazia;
  - `obterOrcamento` com `deleteRow` no meio (relê com lock);
  - `listarOrcamentos` com a foto do mês dentro dele (uma linha só, mesmo com 2 pedidos);
  - Resultados com cache + atualização;
  - fechar com 1 chamada;
  - conflito e excluído funcionando.
- **Nova medição:** `Codigo-DIAGNOSTICO.gs` gerado de novo do código otimizado + `medir.js` atualizado; comparação lado a lado com a tabela de antes.

**Riscos:**
1. Edição manual de linhas pode demorar a aparecer (mitigado com `configV` + link).
2. Cache do aparelho em Resultados mostra a lista velha por 1–2 s.
3. Se o Google mudar o CacheService em gatilho: não usamos.

### 14.5 Implementação (o que ficou registrado)
- **Backend** (`apps-script/Codigo.gs`):
  - `doPost`: token → ação conhecida → `PEDIDO_` (contexto do pedido, com as propriedades do documento lidas UMA vez por `getProperties()`) → `configurarCompleto_` só se `esquemaV` ≠ `ESQUEMA_VERSAO_` (com lock) → leitura sem lock / gravação com lock;
  - `aba_(nome)`: aba sumida → configuração completa uma vez por pedido;
  - `comLock_` não pega o lock de novo se o pedido já o tem (`PEDIDO_.travado`);
  - cache: `dadosDaConfig_` (cache ou leitura com lock), `lerCacheDados_`/`gravarCacheDados_`/`apagarCacheDados_`; o cache guarda a `configV` com que foi montado;
  - o `salvarDados_` monta o cache das MESMAS linhas que gravou, com as funções da leitura (`gastosDasLinhas_`, `parametrosDasLinhas_`, `cartoesDasLinhas_`): um teste confere cache = leitura nova;
  - `onEdit` (gatilho simples, público): edição à mão em Gastos/Parâmetros/Taxas → `configV` = hora + sufixo aleatório (duas edições no mesmo milissegundo também mudam a versão; achado pelos testes);
  - `listarOrcamentos_`: Orçamentos A–U (1 leitura) + JSON só das linhas do mês pedido, por trechos de linhas seguidas (`trechosDeLinhas_`) + Meses (`lerMeses_`, 1 leitura) + gastos de hoje do cache; ID repetido entra uma vez; a foto do mês corrente é gravada ali mesmo quando difere (lock só para isso);
  - `obterOrcamento_`: sem lock; se a linha achada não for a do ID (exclusão no meio), relê com lock;
  - o `mudarSituacao` não mudou (já recebia só `id` e `atualizadoEmBase`).
- **Tela:**
  - Resultados: a última resposta de cada mês fica em `precoCerto.resultados.v1` (com a URL da API; até 6 meses); aparece na hora com "Atualizando…" e a resposta do servidor substitui; "Desconectar" apaga;
  - "O cliente fechou?" monta a tela de fechamento com o que está no aparelho (`orcamentoDaTela`), sem `obterOrcamento`;
  - fechamento otimista: volta na hora já com o resumo e o aviso fixo "Fechando…" ("Mudar situação" espera); "Orçamento fechado ✓" só com a resposta; falha → volta o estado e avisa ("Sem conexão: o orçamento NÃO foi fechado. Tente de novo." / "Não foi fechado. Tente de novo. (motivo)"); conflito e excluído como antes;
  - salvar: aviso fixo "Salvando…" (os campos continuam livres); "Orçamento salvo ✓" só com a resposta; erro → "Não foi salvo. Tente de novo. (motivo)"; sem conexão → "Sem conexão: orçamento NÃO foi salvo." (texto da fase 10);
  - Ajustes → "Recarregar da planilha" (`obterDados` com `forcar:true`);
  - a pendência da foto do mês no aparelho (`precoCerto.fotoMesPendente.v1`, seção 12.5) não é mais usada: o servidor faz tudo no mesmo pedido.

### 14.6 Limitações conhecidas (aceitas)
- **Lista sem lock no meio de uma exclusão:** por um instante, a lista pode pular ou repetir uma linha (a próxima atualização corrige). Ela **nunca** mostra o mesmo ID duas vezes (deduplicação por ID).
- **Edição à mão:** só o `onEdit` invalida o cache, e ele só reage a edições feitas à mão (as gravações do próprio script não disparam). **Nenhuma gravação do app depende do `onEdit`:** o `salvarDados` repõe o cache (e o mês corrente) dentro do lock. Apagar linhas à mão pode não disparar o `onEdit`: aparece em até 6 h, no próximo salvamento pelo app ou com "Recarregar da planilha".
- **Orçamento antigo fechado neste mês:** o JSON dele é lido num trecho a mais (uma leitura a mais), não mais num bloco contínuo desde a primeira linha do mês.

## 15. Preço por forma de pagamento (só frontend; `sw.js` v10)

`apps-script/` sem mudança (D10). O que muda é só o **preço** que o cliente paga em cada forma; a sobra de cada forma continua = preço − taxa daquela forma − custos − imposto (por dentro).

**Problema (achado no fechamento):** base 1.500, Pix com 5% = 1.541,71 (âncora 5x 1.622,85 × 0,95), mas o débito saía 1.520,84 (base ÷ (1 − 1,37%)): **mais barato que o Pix**. E o crédito 1x–4x saía abaixo do preço cheio, embora o WhatsApp diga "Cartão em até 5x: R$ 1.622,85".

**Regra (com âncora = taxa na 1ª parcela em destaque):**
- **Pix, dinheiro e débito:** o mesmo preço à vista oferecido (âncora × (1 − desconto − extra)).
- **Crédito de 1x até a parcela de referência (a âncora, ex.: 5x):** o mesmo preço cheio (total da âncora); parcela = arredondar(total exato ÷ n) (regra B).
- **Crédito acima da referência:** como antes (base ÷ (1 − taxa da parcela)).
- **Sem âncora:** como antes (cada forma sobre a base).
- Débito e 1x–4x: a sobra fica **maior ou igual** (taxa menor sobre o mesmo preço).
- **Desconto grande:** se o à vista ficar abaixo de base ÷ (1 − taxa do débito), o débito continua com o preço à vista; no fechamento em débito aparece a faixa vermelha "Com esse valor no débito você cobra R$ X abaixo do seu preço." (X = arredondar(base ÷ (1 − taxa do débito)) − valor combinado).

**Onde:**
- funções puras em `js/calculo.js`: `precoNaForma` (preço de cada forma para "Ver outras formas"; `calcularComFoto` devolve `outras` já com a regra), `valorSugeridoFechamento` (débito = o à vista oferecido gravado; crédito até a referência = o total da âncora gravado) e `abaixoDoPrecoNoDebito` (a faixa);
- tela de fechamento: valor sugerido, texto de ajuda ("No débito, o mesmo preço do Pix." / "Cartão em 3x: o mesmo preço do cartão em 5x.") e a faixa;
- "Ver outras formas": Débito = à vista; 1x…(ref)x = preço cheio com a parcela de cada n; acima da referência como antes. Cards em destaque inalterados;
- WhatsApp e o título do card à vista: "À vista (Pix, dinheiro ou débito)" (só com âncora; sem âncora o débito tem outro preço e fica "Pix/dinheiro"); a linha do cartão em destaque não muda;
- "?" do desconto e das parcelas, e GUIA: "No débito e no Pix o preço é o mesmo. No cartão, até {ref}x o preço é o mesmo; acima disso fica mais caro."

**Casos (exemplo do usuário; base 1.500 = mão de obra 1.000 + peças cobradas 500 (pagas 388,79), 8 h, oficina 4.000 e casa 3.000 em 130 h, imposto 0, Visa, desconto 5% → sobra Pix 722,15):** RP1–RP4 em `testes-calculo.md`.
- O FC1 (cenário F) mudou na linha do débito: valor sugerido 1.723,61 → **1.747,27** (= Pix): taxa 23,94 · imposto 104,84 · oficina 246,15 · casa 184,61 (absorve o centavo) · sobra **787,73** · total que é seu 972,34.
- O exemplo do mês da 11.6 (M1/M2 e a tela de Resultados) **não muda**: o débito daquele mês fica com o valor combinado 1.723,61 (o valor combinado é livre; o exemplo é de antes desta regra).

## 16. Pacote: % por peça, serviços de terceiros, entrada (sinal) + cartão e imposto separado (desenho **aprovado** com 2 ajustes: imposto legado e WhatsApp da entrada)

**Muda o backend** (campos novos no orçamento, no fechamento e na aba Orçamentos; 3 parâmetros novos) e a tela (`sw.js` v11).
Construído **em cima da seção 15** (débito = Pix; crédito até a referência = preço cheio).
**Compatibilidade obrigatória:** orçamentos e fechamentos já salvos (sem os campos novos) abrem e somam no mês **exatamente como hoje**.

### 16.1 % de acréscimo por peça
- Cada peça ganha "% em cima" (0 a 1000, o mesmo limite do acréscimo geral). Guardado como `pecas[i].acrescimoTexto`: `null` = segue o geral; texto = alterado à mão.
- O % geral continua: ao mudá-lo, as peças com `null` acompanham; as alteradas à mão ficam.
  - Marca discreta na alterada: borda laranja e um "↺" ao lado; tocar no "↺" volta a peça para o geral (`null`).
- **Cliente paga, por peça** = qtd × unitário × (1 + %peça/100). Os totais do card somam as peças (sem arredondar no meio).
- O modo "valor direto" das peças continua como hoje.
- **Compatibilidade:** orçamento antigo não tem `acrescimoTexto` → todas seguem o geral, e a conta é a mesma de hoje (Σ qtd×valor × (1 + geral) = (Σ qtd×valor) × (1 + geral)).
- **Exemplo (caso PC1):**
  - A 2 × 50 a 47% = 147; B 1 × 300 a 20% (à mão) = 360; cliente paga **507**;
  - geral → 30%: A = **130** (acompanha), B = **360** (fica); total 490;
  - "↺" em B → 30%: B = 390; total 520.

### 16.2 Serviços de terceiros
- Card novo **"Serviços de terceiros"**, abaixo de Peças. Lista: Descrição | Valor que você paga (R$) | % em cima | 🗑. Botão "+ Adicionar serviço", remover com DESFAZER, sem quantidade. Guardado em `entrada.terceiros = [{descricao, valorTexto, acrescimoTexto|null}]` (até 20).
- **Parâmetro novo** "Acréscimo padrão em serviços de terceiros (%)" (`acrescimoTerceirosPadrao`, padrão 0, de 0 a 1000), em Ajustes → Outros ajustes, na aba Parâmetros.
  - O backend aceita a tela antiga sem a chave (mesmo mecanismo do desconto padrão).
  - Cada serviço novo começa com ele, e dá para mudar por linha (com o mesmo "↺").
- **Cálculo** (os terceiros entram como as peças):
  - custo = valor pago; cliente paga = valor × (1 + %/100); ganho = cliente − pago;
  - **base** = mão de obra + peças (cliente) + terceiros (cliente);
  - **sobra** = preço − taxa − imposto − peças pagas − **terceiros pagos** − oficina − casa ("Paga a oficina" e "Vai para a casa" continuam só sobre as horas dele);
  - **pisos:** somam o custo dos terceiros, como o das peças.
- **Detalhes:** linha nova "Ganho nos serviços de terceiros" (= cliente − pago). A soma continua fechando no centavo (regra R8).
- **WhatsApp:** seção "Serviços inclusos:" só com as descrições, **sem valores**. Serviço sem descrição não aparece.
- **Fechamento e Resultados:**
  - grava `terceirosPagarC` no fechamento;
  - o extrato do mês ganha a linha "− Serviços de terceiros" (entre Peças e Maquininha);
  - registros antigos = 0.
- **Exemplo (caso TS1–TS3):** eletricista 100 a 0% → cliente 100, ganho 0; a 30% → cliente 130, ganho 30; a base, o imposto, a sobra e os pisos conferidos no caso.

### 16.3 Entrada (sinal) + resto no cartão
- **Regra:** o desconto à vista vale **só** sobre a parte paga à vista.
  - V = preço à vista oferecido (com desconto e extra); E = entrada, com 0 < E < V.
  - P_n = preço do cartão em n vezes pela regra da seção 15 (1x até a referência = preço cheio; acima, base ÷ (1 − taxa_n)).
  - f = E ÷ V; resto no cartão R_n = P_n × (1 − f); parcela = arredondar(R_n exato ÷ n) (regra B); total do cliente = E + R_n (R_n arredondado).
- **Taxa e imposto:**
  - taxa da maquininha = R_n × taxa_n (+ E × taxa do débito, se a entrada for no débito);
  - imposto "por dentro" sobre E + R_n (com a taxa efetiva de 16.4).
- **Exemplo (caso EN1):** âncora 5x = 5.000,00; desconto 5% → V = 4.750,00; E = 1.000 (Pix).
  - f = 0,2105263…; R₅ = 5.000 × 0,7894737 = 3.947,3684 → **3.947,37**; **5× 789,47**; total **4.947,37**.
  - No mesmo exemplo, com 10x (taxa 11,06%) acima da referência: P₁₀ = 4.621,50 ÷ 0,8894 = 5.196,20; R₁₀ = 4.102,26; 10× 410,23; total 5.102,26.
- **Tela do orçamento:** link **"O cliente vai dar uma entrada?"** perto dos cards do cartão.
  - Abre os campos "Entrada (R$)" e "Forma da entrada" (Pix/dinheiro | Débito) e mostra, para cada parcela em destaque: "Entrada R$ 1.000,00 + 5× de R$ 789,47 no cartão (total R$ 4.947,37)".
  - Guardado em `entrada.entradaTexto` e `entrada.formaEntrada`.
  - Validação: entrada > 0 e menor que o à vista ("A entrada precisa ser menor que o preço à vista (R$ X).").
- **Parcelas da entrada:** campo "Parcelas" no bloco da entrada (padrão = a parcela de referência; só as parcelas com taxa).
- **WhatsApp** (só com entrada válida): **uma linha só**, com as parcelas escolhidas no bloco, por exemplo "💳 Entrada de R$ 1.000,00 no Pix + 5x de R$ 789,47 no cartão (total R$ 4.947,37)". As linhas normais do cartão e do à vista continuam (ajuste aprovado: uma linha por parcela deixava a mensagem longa e confusa).
- **Fechamento:**
  - forma nova **"Entrada + cartão"**: entrada (valor e forma), parcelas e cartão;
  - **valor combinado** = E + R_n calculado (editável: se ele mudar o total, R = total − E, e a entrada fica);
  - grava: forma `entrada`, `entradaC`, `formaEntrada`, parcelas, cartão, `taxaPct` (do crédito), `taxaEntradaPct` (débito ou 0), valor combinado, `taxaC` (o total da maquininha), imposto, terceiros e sobra;
  - Resultados e extrato somam normalmente (faturamento = valor combinado; maquininha = `taxaC`);
  - validação (tela e servidor): 0 < E < à vista oferecido gravado; o servidor confere taxa ≈ (V − E)×taxa_n + E×taxa_deb (±1 centavo por parcela da conta) e a soma no centavo.

### 16.4 Imposto separado: peças × serviço
- **Parâmetros:** "Imposto sobre peças (%)" (`impostoPecasPercentual`) e "Imposto sobre serviço (%)" (`impostoServicoPercentual`), de 0 a 99, na aba Parâmetros. Os serviços de terceiros usam a taxa de **serviço**.
- **Migração e compatibilidade:**
  - planilha que **já existia** (só o imposto antigo, sem as linhas novas) → os dois novos valem o imposto antigo (nada muda nos números até ele editar). As linhas novas só são gravadas quando a tela nova salvar;
  - **planilha nova** (decisão do 3º retorno): já nasce com as linhas `impostoPecasPercentual` e `impostoServicoPercentual` = 0, visíveis na aba Parâmetros. A linha `impostoPercentual` também é criada (legado: a tela antiga manda e lê essa chave). Ela não é usada quando as linhas novas existem;
  - o backend aceita a tela antiga (só com a chave antiga) e mantém os novos;
  - a chave antiga `impostoPercentual` continua na aba como "legado", para os aparelhos que ainda não tocaram em ATUALIZAR. A tela nova passa a gravá-la = imposto sobre serviço;
  - **ajuste aprovado:** se a aba **já tem** as chaves novas, um `salvarDados` da tela antiga (só com a chave antiga) **não** mexe nelas: a chave antiga é ignorada para os impostos novos. A antiga só serve para **criar** as novas quando elas ainda não existem;
  - orçamentos e fechamentos antigos continuam com o imposto da foto deles, sem recálculo.
- **Taxa efetiva** = (peças_cliente × tPeças + (mão de obra + terceiros_cliente) × tServiço) ÷ base.
  - O imposto de cada forma continua "por dentro": preço cobrado × taxa efetiva.
  - Vale para à vista, cartão, entrada + cartão, fechamento, pisos e "Fica para você".
  - Sem base (0): efetiva = imposto sobre serviço.
- **Foto:** guarda as duas taxas (nos parâmetros) e a **efetiva** usada (`resultado.impostoEfetivoPct`).
  - O fechamento usa a efetiva gravada; o servidor confere o imposto com ela (registro antigo, sem ela: o imposto antigo da foto, como hoje).
- **Detalhes:** a linha "Imposto" ganha, em texto pequeno, "peças R$ X · serviço R$ Y" (proporcional: a parte das peças = imposto × peças_cliente×tPeças ÷ (Σ)). O resto vai para o serviço, então a soma fecha.
- **"?" do imposto:** "Peças e serviço costumam ter impostos diferentes. Confirme os percentuais com o seu contador. MEI: deixe 0 nos dois e coloque o DAS em Meus gastos."
- **Exemplo (caso IM1–IM3):**
  - MO 1.000 + peças cliente 500 = base 1.500; 4% e 6% → efetiva = 80 ÷ 1.500 = **5,3333%**; à vista 1.500 sem desconto → imposto **80,00** (peças 20,00 · serviço 60,00);
  - com terceiros 100 a 30% (cliente 130): base 1.630; efetiva = (20 + 67,80) ÷ 1.630 = 87,80 ÷ 1.630 = **5,3865%**;
  - planilha antiga com 10% → os dois = 10% e **todos os casos atuais de cálculo dão igual**.

### 16.5 Layout (texto)
**Celular (390 px):**
```
┌ Peças ─────────────────────────────┐
│ [Pastilha de freio              ] 🗑│
│ [2] × [R$ 50,00] · [47 %]           │  ← % alterado à mão: borda laranja + ↺
│ Cliente paga: R$ 147,00             │
│ + Adicionar peça                    │
│ Quanto você põe em cima (geral) [47]%│
│ Você paga R$ 400,00 · Cliente paga…  │
└────────────────────────────────────┘
┌ Serviços de terceiros ─────────────┐
│ [Eletricista – chicote          ] 🗑│
│ [R$ 100,00] · [30 %] ↺              │
│ Cliente paga: R$ 130,00             │
│ + Adicionar serviço                 │
│ Você paga R$ 100,00 · Cliente paga R$ 130,00 │
└────────────────────────────────────┘
Cartão em 5x … (card de sempre)
O cliente vai dar uma entrada?            ← link
  Entrada [R$ 1.000,00]  Forma (Pix/dinheiro | Débito)
  Entrada R$ 1.000,00 + 5× de R$ 789,47 no cartão (total R$ 4.947,37)
```
**Notebook (1280 px):** Peças e Terceiros numa linha por item: Descrição | Qtd × Valor | % | Cliente paga | 🗑. A coluna da direita é igual à do celular.

**Fechamento, forma "Entrada + cartão":**
```
Como o cliente vai pagar?  (Pix/dinheiro) (Débito) (Cartão) (Entrada + cartão)
Entrada [R$ 1.000,00]   Forma da entrada (Pix/dinheiro) (Débito)
Parcelas (1x … 12x)     Cartão (se 2+)
Valor combinado [R$ 4.947,37]  "Entrada R$ 1.000,00 + 5× de R$ 789,47"
Neste fechamento: Sobra extra … (linhas: Entrada · No cartão · Taxa da maquininha · Imposto · Peças · Terceiros · Oficina · Casa)
```

### 16.6 Backend (`Codigo.gs`)
- **Aba Orçamentos:** colunas novas **depois** da coluna V (o JSON), para não mudar a posição de nenhuma coluna existente:
  - **W "Terceiros pagos"**, **X "Entrada"**, **Y "Forma da entrada"**;
  - registros antigos: vazio = 0 / "";
  - o `ESQUEMA_VERSAO_` vai para '2': a configuração acrescenta os 3 cabeçalhos na aba que já existe, uma vez.
- **Custo na lista:** o `listarOrcamentos` lê A–U (como hoje) e mais W–Y numa leitura estreita (~0,3 s a mais; aprovado, porque Resultados abre com o cache do aparelho).
  - Conferido: `getRangeList` não economiza a ida (cada intervalo continua sendo uma leitura), e a leitura em lote da API do Sheets (`Values.batchGet`) exige o serviço avançado e o escopo `spreadsheets` (fora do "só esta planilha"). Por isso, a leitura a mais fica.
- **Validação nova:**
  - `entrada.pecas[i].acrescimoTexto`, `entrada.terceiros` (até 20; descrição até 80, valor até 40 letras), `entradaTexto` e `formaEntrada`;
  - `resultado.terceirosPagarC`, `terceirosCobrarC` e `impostoEfetivoPct` (opcionais: antigos sem eles);
  - fechamento: `terceirosPagarC` (obrigatório na tela nova; ausente = 0), forma `entrada` com `entradaC`, `formaEntrada` e `taxaEntradaPct`;
  - a soma no centavo passa a incluir os terceiros;
  - o `conferirFechamento_` usa a efetiva gravada (ou o imposto antigo da foto).
- **Parâmetros novos:** `acrescimoTerceirosPadrao`, `impostoPecasPercentual` e `impostoServicoPercentual`, todos em `PARAMETROS_OPCIONAIS_`. Ausentes na aba → os de imposto vêm do `impostoPercentual`, e o acréscimo, de 0.
- **Cache (seção 14):** os parâmetros novos entram no cache normalmente. A troca de versão do esquema limpa o cache.

### 16.7 Testes (depois do OK)
- **Casos de cálculo:** todos os atuais iguais (com planilha "antiga": um imposto só, sem % por peça, sem terceiros, sem entrada), mais os casos novos:
  - PC1–PC3 (% por peça);
  - TS1–TS4 (terceiros: base, imposto, sobra, pisos, R8, extrato);
  - EN1–EN4 (entrada: o exemplo, 10x, débito na entrada, validação, fechamento editado);
  - IM1–IM4 (imposto separado: o exemplo, com terceiros, planilha antiga igual, linha "peças · serviço").
- **Backend:** registros antigos (sem os campos) abrem e somam igual; colunas W–Y criadas uma vez; tela antiga salvando sem as chaves novas; validação da entrada e dos terceiros; `testarApi` ampliado.
- **Tela:**
  - % por peça (alterar, "↺", geral);
  - terceiros (adicionar, remover com DESFAZER, WhatsApp);
  - entrada (link, campos, WhatsApp, fechamento editável);
  - imposto (dois campos e migração);
  - sem rolagem lateral em 390 px;
  - prints 390 e 1280.

### 16.8 DEPLOY (duas planilhas: a de teste e a do André)
1. Em **cada** planilha: copiar a `URL_DA_API` → colar o `Codigo.gs` → recolocar a URL → salvar → **Gerenciar implantações → Nova versão** → `testarApi`.
   - No primeiro pedido, o esquema 2 cria as colunas W–Y e os parâmetros novos.
2. Só então: conferência de segredos e `git push`.
3. Aparelhos: ATUALIZAR. Até atualizar, o aparelho antigo funciona com um imposto só (o legado = imposto sobre serviço) e sem terceiros ou entrada; se ele salvar gastos ou ajustes, os impostos novos que o André já configurou **não** mudam.

### 16.8b Implementação (pacote 16 sem o adendo)
- **Tela:**
  - linha da peça com "% em cima"; o % próprio fica com a borda laranja e "↺ usar o geral (N%)". O campo geral passou a dizer "Vale para as peças em que você não mudou o %";
  - em 390 px: Descrição + lixeira em cima e "Qtd × Valor · %" embaixo. De 560 a 899 px fica numa linha só, com cabeçalho. A partir de 900 px (duas colunas) volta às duas linhas;
  - card "Serviços de terceiros" (Serviço | Valor pago | % em cima | lixeira), com "Cliente paga" em cada linha e os totais;
  - bloco da entrada como card logo depois das parcelas. Fechado, é só o link, sem card. Aberto: Entrada, chips Pix/dinheiro | Débito, chips das parcelas (padrão = a de referência), o resumo "Entrada R$ … no Pix + 5x de R$ … no cartão · total R$ …" e o link "Tirar a entrada";
  - Ajustes: "Imposto" com "?" e os dois campos lado a lado ("Nas peças" | "No serviço"), além de "Acréscimo padrão em serviços de terceiros". O campo do imposto único saiu da tela.
- **Fechamento:**
  - chip "Entrada + cartão": parcelas, cartão, Entrada e forma da entrada;
  - o rótulo do valor fica "Valor combinado (total: entrada + cartão)";
  - texto de ajuda: "Resto no cartão: 5x de R$ …". Mudar o total mantém a entrada;
  - orçamento salvo com entrada → o fechamento já abre nessa forma.
- **Dados:**
  - campos novos no rascunho (`pecas[].acrescimoTexto`, `terceiros`, `entradaTexto`, `formaEntrada`, `parcelasEntrada`);
  - o servidor normaliza (ausente → null/[]/''/'pix'/null), então o JSON de um orçamento novo sempre traz os campos;
  - `fotosIguais` trata a foto antiga (sem os impostos novos) como igual, para não mostrar "Valores de…" só por isso.
- **Backend (decisão 3):**
  - planilha nova = linhas novas com 0, visíveis;
  - `parametrosAusentes` não lista os impostos novos (eles vêm do antigo, não é pendência).
- **Testes:**
  - os cenários `orc*` da tela representam uma planilha de antes da seção 16: o mock tira as linhas novas, como na migração real;
  - backend `check-16.js` 13/13;
  - tela `teste-16.js` 46/46.

### 16.9 Adendo: desconto à vista diferente para serviço e peças (desenho **aprovado**; implementado em commit separado; publicado junto com o pacote 16)
Pedido do André: às vezes ele quer dar desconto só na mão de obra, porque a margem da peça é apertada.

**Tela (simplicidade primeiro)**
- Por padrão continua UM campo, "Desconto à vista (%)", valendo para tudo.
- O link discreto "Desconto diferente nas peças?" abre dois campos:
  - "Desconto no serviço (%)": mão de obra + terceiros;
  - "Desconto nas peças (%)".
  - Ao abrir, os dois começam com o valor do campo único.
- Fechar ("Mesmo desconto para tudo") volta ao campo único, com o valor do serviço. Se os dois eram diferentes, a página pede confirmação antes.
- "Desconto extra que vou dar" continua um só e soma ao desconto do **serviço**.
- Se os dois padrões dos Ajustes forem diferentes, o orçamento novo já abre com os dois campos.

**Cálculo (as demais regras não mudam)**
- A = preço cheio na parcela de referência (âncora); base = serviço_cliente + peças_cliente, com serviço_cliente = mão de obra + terceiros_cliente.
- A_serv = A × serviço_cliente ÷ base e A_peças = A × peças_cliente ÷ base, sem arredondar no meio.
- V (à vista oferecido) = A_serv × (1 − (dServ + extra)/100) + A_peças × (1 − dPeças/100), arredondado no centavo.
- Desconto equivalente = 1 − V ÷ A. É ele que entra em:
  - "ainda pode dar";
  - o aviso vermelho;
  - o texto "· 5% de desconto" quando os dois descontos são iguais;
  - o `descontoTotal` gravado.
- Débito = V (seção 15); entrada + cartão usa V (16.3).
- O imposto usa a taxa efetiva da base (16.4), como hoje.
- Os pisos, a sobra e "Ganho/Perda por desconto…" usam V, como hoje.
- O fechamento grava dServ, dPeças e o equivalente (no resultado; opcionais no backend).
- **Desconto em reais** (WhatsApp e tela, quando os descontos são diferentes) = A arredondado − V arredondado. A diferença exata (54,0950 no exemplo) pode virar 54,09 por arredondamento binário; a diferença dos valores exibidos dá 54,10 e confere com o que o cliente vê.

**Ajustes → Outros ajustes**
- Campo novo "Desconto padrão nas peças (%)", chave `descontoPecasPadrao` (0–99) na aba Parâmetros.
- Mesma regra do imposto legado (16.4):
  - sem a linha na aba, vale o `descontoAVistaPadrao`;
  - planilha nova nasce sem a linha;
  - a tela nova grava a linha;
  - um salvar da tela antiga (sem a chave) **não** mexe na linha que já existe.

**WhatsApp**
- Descontos iguais: como hoje ("— 5% de desconto").
- Descontos diferentes: "💵 À vista (Pix, dinheiro ou débito): *R$ 1.568,75* (R$ 54,10 de desconto)".

**Conferência dos números do pedido (em Node, antes de implementar) — todos batem**
- Base 1.500 (serviço 1.000, peças 500), Visa 5x 7,57%: A = 1.622,8497, A_serv = 1.081,8998, A_peças = 540,9499.
- dServ 5%, dPeças 0%: V = 1.027,8048 + 540,9499 = 1.568,7547 → **1.568,75**.
  - Desconto R$ **54,10**; equivalente **3,3333%**.
  - Ainda pode: 7,57 − 3,3333 = **4,2367%** (R$ 68,75 = 1.568,75 − 1.500).
- dServ = dPeças = 5%: **1.541,71**, igual à regra atual.
- Extra 2% com os campos separados (5% + 2% no serviço, 0% nas peças): V = 1.547,12.

**Decisões (3º e 4º retornos)**
1. **Extra — opção (b):** o extra vale só para o serviço **apenas com os dois campos abertos**. Com o campo único, ele continua valendo sobre o preço todo, como hoje. Os testes antigos não mudam: 5% + 2% = 7% sobre tudo = 1.509,25 no exemplo.
2. **Descontos diferentes:** a tela e o WhatsApp mostram o desconto em reais, "(R$ 54,10 de desconto)". Com os descontos iguais, continua em %.
3. **"?" do extra:** acrescenta "Com desconto diferente nas peças, o extra vale só para o serviço." O resto do texto continua igual.
4. **`descontoPecasPadrao`:** segue a mesma regra dos impostos novos (decisão 3 do pacote 16).
   - Planilha **nova**: já nasce com a linha (5).
   - Planilha **antiga** (sem a linha): vale o `descontoAVistaPadrao` até a tela nova salvar.
   - Tela antiga nunca sobrescreve a linha.

**Implementação**
- **Cálculo:** `calcularPrecoComDesconto(res, parametros, desconto, extra, divisao)`.
  - Sem `divisao` = a regra de sempre (desconto + extra sobre tudo).
  - Com `divisao` = {descontoPecas}, o extra soma só no serviço:
    - sem peças, ou com os descontos iguais → A × (1 − d/100), idêntico ao de antes;
    - só peças → o desconto das peças;
    - senão → V = A_serv × (1 − (dServ + extra)/100) + A_peças × (1 − dPeças/100), e descontoTotal = equivalente (1 − V exato ÷ A).
  - O retorno traz `descontoServico`, `descontoPecas`, `descontosIguais` e `descontoReaisCentavos` (A − V exibidos).
  - `calcularComFoto` só passa `divisao` quando os dois campos estão abertos.
- **Rascunho e JSON:** `descontoSeparado` (null = automático, abre os dois campos se os padrões dos Ajustes forem diferentes; true/false = a escolha) e `descontoPecasTexto` (null = o padrão das peças).
  - Orçamento de antes (sem a chave) continua sem ela, porque o servidor não acrescenta.
  - O resultado grava `descontoServico`/`descontoPecas`. O fechamento grava `descontoServicoPct`, `descontoPecasPct` e `descontoEquivalentePct` (opcionais no backend).
- **Tela:**
  - links "O cliente pediu mais desconto?" e "Desconto diferente nas peças?" lado a lado. Aberto, o segundo vira "Mesmo desconto para tudo";
  - os rótulos ficam "Desconto no serviço" e "Desconto nas peças";
  - o "?" do desconto fica no rótulo do serviço;
  - fechar com valores diferentes abre a confirmação na página: "Mesmo desconto para tudo?" · "O desconto das peças (0%) vai ficar igual ao do serviço (5%)." · [Usar 5% para tudo] [Cancelar];
  - fechamento no Pix: "À vista com R$ 54,10 de desconto, como no orçamento.";
  - Ajustes: campo "Desconto padrão nas peças". `sw.js` v12.
- **Testes:**
  - cálculo DS1–DS6, com 89 casos ao todo;
  - backend B7–B9 (`check-16.js` 19/19);
  - tela `teste-169.js` 20/20, incluindo campo único + extra = os números de hoje e dois campos + extra = 1.547,12.

**Testes (depois do OK)**
- Os números acima.
- Extra com os dois campos.
- Orçamento antigo (sem dPeças) igual ao de hoje.
- Ajustes: legado do desconto das peças nos dois cenários (como B1/B2).
- Fechamento grava dServ, dPeças e o equivalente.
- Link abrir/fechar com a confirmação.
- WhatsApp nos dois casos.
- Prints 390/1280.

## 17. Vários serviços da oficina, veículo em campos e WhatsApp separando oficina × parceiros (desenho **aprovado** com os ajustes das decisões 1 e 2; o backend MUDOU; `sw.js` v13)
Pedido do André:
1. listar vários serviços de mão de obra no mesmo orçamento (ex.: "Troca do radiador", "Suspensão dianteira");
2. no WhatsApp, deixar claro o que é serviço da oficina e o que é de parceiros.

Três adendos entraram no mesmo pacote:
- o veículo em campos separados (17.2);
- "Com essa entrada fica" (17.7);
- a frase do mês com o total que falta (17.8).

A etapa B (agrupar peças por serviço e mostrar o preço por serviço, para aprovação parcial) **não** foi implementada. O `id` estável de cada serviço deixa essa etapa possível sem migração: as peças e os parceiros ganham um `servicoId` opcional.

### 17.1 Decisões
1. **Backend:** `validarEntrada_` passa a aceitar `veiculo` e `servicos`, com limites. A coluna Z "Itens" serve à busca, e o `ESQUEMA_VERSAO_` vira `'3'`.
   - **Acréscimo aprovado:** a migração para o esquema 3 roda uma vez só, sob lock, e preenche a coluna Z de **todas** as linhas antigas a partir do JSON. As listagens normais não leem o JSON.
2. **Cada linha mostra Horas e R$ sempre visíveis**, sem botão de modo:
   - R$ vazio = horas × valor da hora;
   - R$ preenchido = valor fechado, com horas opcionais (vazias = valor ÷ valor da hora);
   - o R$ tem o placeholder "Valor fechado (opcional)";
   - a ajuda "Deixe o R$ vazio para calcular pelas horas." fica embaixo do 1º serviço e aparece só enquanto há **um** serviço e ele está sem valor.
3. **Campos antigos de reserva:** o orçamento novo também grava `modo:'fechado'`, `valorTexto` = Σ mão de obra e `horasFechadoTexto` = Σ horas, com números completos. Assim um app antigo ainda no cache abre com os mesmos números e não zera a mão de obra.

### 17.2 Tela: card "Serviço"
- **Topo:** Cliente · Telefone (como antes).
- **Grupo "Veículo (opcional)":** Placa e Ano lado a lado, Modelo inteiro e Combustível em chips (Flex · Gasolina · Etanol · Diesel · GNV). Tocar no chip marcado desmarca.
  - **Placa:** maiúsculas automáticas e só letras e números. O padrão antigo ganha o "-" ao digitar (abc1234 → ABC-1234); o Mercosul fica junto (ABC1D23).
  - O formato errado mostra "Placa no formato ABC-1234 ou ABC1D23." e **não** impede salvar.
  - **Ano:** só números (4). Fora de 1950 até o ano que vem, avisa sem impedir salvar.
- **"Serviços da oficina":** em cada linha, Descrição + lixeira em cima e "Horas (h) | R$ Valor fechado (opcional)" embaixo. De 560 a 899 px fica numa linha só.
  - Embaixo da linha aparece "Mão de obra: R$ 600,00" (por horas) ou "Horas estimadas pelo valor da sua hora: 0,53 horas" (valor fechado sem horas).
  - Botão "+ Adicionar serviço" (até 20). Lixeira com DESFAZER (6 s): "Serviço removido".
  - Orçamento novo já começa com 1 linha.
  - Rodapé: "Total: 6,53 h · Mão de obra R$ 980,00".
  - Sem valor da hora em Meus gastos: "Coloque quanto você cobra por hora em Meus gastos.".
- **Saíram:** o campo "Qual serviço / veículo?" e o link "Prefiro digitar o valor fechado" / "Prefiro calcular por horas".
- **Card de terceiros:** passa a se chamar "Serviços de parceiros (terceiros)", com o botão "+ Adicionar serviço de parceiro". A lixeira avisa "Serviço de parceiro removido".
- **Trava** (Fechado ou Não fechou): os campos do veículo, os serviços, os chips e as lixeiras também ficam desabilitados.

### 17.3 Cálculo (as regras não mudam)
- `calcularMaoDeObra` ganhou o modo `'servicos'`. Cada linha {horas, valor} é uma das contas de antes (valor vazio = por horas; valor com horas vazias = estimadas).
  - Mão de obra = Σ (horas × valor da hora) + Σ valores fechados.
  - Horas = Σ horas (informadas ou estimadas). Valem para pagaOficina, vaiParaCasa, horas vendidas e pisos.
  - Uma linha só dá exatamente a conta de antes (0 + x = x).
- A mão de obra entra na taxa de imposto de **serviço**, como antes. O resto não muda.
- `lerEntradaOrcamento`: com `servicos`, os campos antigos ficam só de reserva e não entram na conta.

### 17.4 Dados (coluna V, JSON v1 com campos a mais)
```
entrada.veiculo:  { placa (≤ 8), modelo (≤ 60), ano (≤ 4), combustivel ('' | Flex | Gasolina | Etanol | Diesel | GNV) }   (só quando tem algo)
entrada.servicos: [{ id: "s_…" (≤ 20, letras/números/_/-, sem repetir), descricao (≤ 80), horasTexto, valorTexto }]   (até 20)
entrada.descricao: "ABC-1234 · Saveiro CS 1.6 · Troca do radiador (+1)"  (coluna F; ≤ 100)
entrada.modo/valorTexto/horasFechadoTexto: reserva para o app antigo (17.1, decisão 3)
```
- **Orçamento antigo** (sem `servicos`) abre como **uma** linha, com o veículo vazio. Nenhum número muda.
  - Modo horas → a linha recebe as horas.
  - Valor fechado → valor + horas (vazias = estimadas).
  - Valor fechado **vazio** → "0", porque a mão de obra era 0 e não pode virar horas × valor da hora.
- O `id` é criado uma vez (`novoIdServico`) e se mantém ao salvar de novo.

### 17.5 WhatsApp (seções vazias e linhas sem descrição não aparecem; SEM valores por item)
```
*Orçamento – CliniCar Motors Tech*
Veículo: Saveiro CS 1.6 · 2014 · ABC-1234        ← só os campos preenchidos (modelo · ano · placa)

🔧 *Serviços da oficina:*
• Troca do radiador
• Suspensão dianteira

🤝 *Serviços de parceiros:*
• Retífica do cabeçote

🔩 *Peças:*
• 4× Óleo
• 1× Filtro de óleo

💳 Cartão em até 5x: … / entrada (se houver) / 💵 À vista …   (como antes)
```
- Todas as listas usam "•". O combustível não entra na linha do veículo, porque o pedido listou modelo, ano e placa.
- Continua proibido mostrar valores internos (custo, lucro, sobra, taxa, piso).

### 17.6 Backend (`Codigo.gs`) e busca
- `validarEntrada_` usa `validarVeiculo_` e `validarServicos_`. Sem os campos (tela antiga), grava como antes.
- **Coluna Z "Itens"** = placa · modelo · serviços da oficina (ou a descrição antiga) · parceiros · peças (até 2.000 letras). É calculada pelo servidor a cada gravação (`itensDoOrcamento_`).
- `listarOrcamentos_` lê W..Z numa leitura estreita (era W..Y) e o resumo ganha `itens`.
- **Esquema 3** (`garantirColunasOrcamentos_`):
  - acrescenta o cabeçalho Z;
  - **na mesma vez**, preenche Z de todas as linhas a partir do JSON, com uma leitura e uma escrita (`preencherItensAntigos_`); JSON quebrado → vazio;
  - com o cabeçalho Z já lá, não faz nada, mesmo se o esquema for forçado de novo.
- **Busca** (`combinaBusca`): cliente, coluna F e coluna Z, sem acento e sem maiúscula. Com letras **e** números no termo, também compara só letras e números: "abc1234" acha "ABC-1234". O telefone continua só pelos números.
  - Placeholder: "Buscar cliente, placa, serviço ou peça".
- **Card de Resultados:** "{placa} · {modelo} · {1º serviço} (+N) · data · valor". Os antigos mostram o texto antigo.
- `testarApi`: grava veículo + serviços, confere a devolução e confere os itens na listagem.

### 17.7 Adendo (só frontend): "Com essa entrada fica"
- Com a entrada preenchida e válida, o card "Fica para você neste serviço" ganha "Com essa entrada fica: R$ X" logo abaixo de "No cartão em Nx fica".
- **X** = casa + sobra (sem casa: a sobra) pela **mesma conta do fechamento "Entrada + cartão"** (`calcularFechamento` com forma `'entrada'`, sobre o resultado do orçamento):
  - o cliente paga E + R_n;
  - a maquininha cobra só sobre R_n (+ a taxa do débito sobre E, se a entrada for no débito);
  - o imposto (taxa efetiva) incide sobre E + R_n;
  - oficina, casa, peças e parceiros entram como hoje.
- A cor (verde / âmbar / vermelho) segue a regra de estados do fechamento e vale só para o texto da linha. "Ver detalhes" não muda.
- **Conferido:** base 1.800 (12 h × 150), Visa 5x 7,57%, desconto 5%, imposto 10%, oficina 3.150, casa 5.500, 130 h.
  - À vista fica 1.374,27.
  - Entrada 1.000 no Pix + 5x: R_5 = 894,79 e sobra 839,11 → **R$ 1.346,80**.
  - Entrada no débito: sobra 825,41 → **R$ 1.333,10**.
  - Sem entrada: a linha não aparece.

### 17.8 Adendo (só frontend): frase do mês com o TOTAL que falta (revoga a decisão 9 da seção 12)

| Situação | Mês corrente | Linha menor embaixo |
|---|---|---|
| Oficina e casa não cobertas | "Faltam R$ (oficina + casa) para pagar a oficina e a sua casa este mês" | "Oficina: faltam R$ X · Casa: faltam R$ Y" |
| Oficina coberta, casa não | "Faltam R$ Y para pagar a sua casa este mês" | "Oficina ✓ paga · Casa: faltam R$ Y" |
| Tudo coberto | "Sobrou R$ X além da casa este mês" (como antes) | — |
| Sem gastos de casa | só a oficina (como antes) | — |

- Meses encerrados: "Faltaram R$ …" com a mesma divisão ("faltaram").
- "Quanto falta trabalhar" já usava o total e não mudou.
- O "?" do card explica que "pagar o mês" = oficina + casa (o seu salário).
- **Exemplo:** oficina 7.562 e casa 6.370, nada coberto → "Faltam R$ 13.932,00 para pagar a oficina e a sua casa este mês" + "Oficina: faltam R$ 7.562,00 · Casa: faltam R$ 6.370,00".

### 17.9 Testes
- **Cálculo:** 148 casos (140 + 8 novos). P9 (WhatsApp das peças) e Q5 (frases do mês) foram atualizados para o texto aprovado.
  - SV1: 4 h + 2 h + R$ 80 → mão de obra 980, horas 6,5333, oficina 158,31, casa 276,40, pisos 175,90 / 483,02. É igual a um serviço fechado de 980 com 6,5333 h.
  - SV2: orçamento antigo (horas; valor fechado com e sem horas; valor fechado vazio) → os mesmos números.
  - SV3: campos de reserva, descrição da coluna F, ids.
  - WZ1: WhatsApp.
  - BV1: busca.
  - PL1: placa e ano.
  - EF1: "Com essa entrada fica".
  - Q7: frase do mês com o total.
- **Backend:** `check-17.js` 11/11.
  - Grava e devolve; coluna F e Z.
  - Limites.
  - **Migração:** a planilha do esquema 2 com orçamentos antigos ganha Z preenchida, e a busca por peça e por parceiro de um orçamento antigo funciona. A migração não roda de novo, e uma aba vazia ganha só o cabeçalho.
  - Z regravada ao salvar.
  - Os testes antigos mudaram só na largura (26 colunas) e no esquema "3".
- **Tela:** `teste-17.js` (card, placa, desfazer, WhatsApp, gravação, orçamento antigo, Resultados e busca, entrada) e prints 390/1280.
  - Os testes de tela antigos rodam com um adaptador **só de teste**: os ids antigos apontam para a 1ª linha de serviço.

## 18. Resultados com poucos dados e primeiro mês (ajuste, só frontend)

Caso real (André, dia 9): 1 fechamento de 2,67 h (R$ 437,78) gerava "Faltam cerca de 92 horas (uns 35 serviços como os deste mês)": estatisticamente sem sentido e desanimador. Ele começou a usar o app em 08/11; os serviços de 1º a 7 não estão no app.

**Só frontend.** `apps-script/` sem mudança; `sw.js` v14. Nenhuma conta existente muda.

1. **"Quanto falta trabalhar"** só aparece com dados suficientes no mês: **pelo menos 3 fechamentos E pelo menos 10 horas vendidas** (`MIN_FECHADOS_ESTIMATIVA`, `MIN_HORAS_ESTIMATIVA`). Abaixo disso, quando falta dinheiro no mês corrente, no mesmo lugar: "Ainda há poucos serviços fechados neste mês para estimar quantas horas faltam."
2. **Orçamentos em aberto como potencial** (só no mês corrente, só se houver orçamentos Aberto **criados no mês**), logo abaixo da faixa acima:
   - "Em aberto: {N} orçamentos · R$ {soma do à vista oferecido}. Se fecharem, cobrem {X}% do que falta."
   - X = soma ÷ o total da frase do mês (oficina + casa), inteiro para baixo; abaixo de 1%: "menos de 1%". Se a soma ≥ o que falta: "Se fecharem, cobrem tudo o que falta este mês."
   - Sem nada faltando: só "Em aberto: N orçamentos · R$ S."
   - **Não soma ao resultado**: é só informação.
3. **Primeiro mês de uso**: se o orçamento mais antigo da planilha (`primeiroMes` da listagem) foi criado no mês corrente, um aviso discreto no topo do card, logo abaixo do "dia X de Y": "Você começou a usar o app em {data}. Serviços anteriores não aparecem aqui." A data é a do orçamento mais antigo desse mês.
4. A frase principal com o total (oficina + casa) continua como no adendo da seção 17.

**Testes:** casos PD1, EA1, PM1; `teste-18.js` na tela.

## 19. Trava de versão da API e colunas do veículo na planilha (esquema 4)

**Origem:** caso real — um orçamento salvo com veículo e 2 serviços reabria com o veículo vazio e UM serviço (a descrição da coluna F, horas e valor somados). **Causa:** a planilha do André ainda rodava o backend de antes da seção 17 (o código não tinha ganhado _Nova versão_ na implantação). O `validarEntrada_` antigo monta a entrada só com os campos que conhece e descartou `veiculo` e `servicos` em silêncio; ao reabrir, sem `servicos`, o app tratou o orçamento como antigo (regra correta). O app e o backend novos estavam certos; faltava uma trava.

### 19.1 Trava de versão
- O backend devolve **`apiVersao: 4`** em **todas** as respostas (`API_VERSAO_`, incluindo GET, recusas e erros).
- O app tem **`APP_EXIGE_API = 4`** (`js/api.js`). Antes de **salvar** ou **mudar a situação** de um orçamento (Fechado, Não fechou, voltar para Aberto), confere a versão da planilha conectada: se ainda não sabe, ou se a última vista era antiga, pergunta com um `obterDados` (assim, depois que a planilha é atualizada, o próximo "Salvar" já funciona sem recarregar).
- Sem `apiVersao` ou menor que a exigida: **o pedido nem é enviado**; aviso "A planilha está com uma versão antiga. Atualize o código da planilha antes de salvar."; **nada se perde** (a tela e o rascunho do aparelho ficam como estão). Enquanto a versão não bater, uma faixa discreta no topo com o mesmo texto.
- **Leitura continua** permitida (orçamento, Resultados, Ajustes).
- **Próximas ondas:** quando a gravação ganhar campos que um backend antigo perderia, suba `API_VERSAO_` e `APP_EXIGE_API` juntos.

### 19.2 Colunas AA–AG na aba Orçamentos (esquema 4)
Depois da Z, sem mover as existentes (ordem final):

| Col. | Cabeçalho | Conteúdo |
|---|---|---|
| AA | Número do orçamento | **Reservada** para a onda do PDF (vazia por enquanto) |
| AB | Placa | `entrada.veiculo.placa` |
| AC | Modelo | `entrada.veiculo.modelo` |
| AD | Ano | `entrada.veiculo.ano` (texto) |
| AE | Combustível | `entrada.veiculo.combustivel` |
| AF | Serviços da oficina | descrições separadas por " · " |
| AG | Horas por serviço | as horas de cada serviço, na mesma ordem, " · " ("15 · 2"); "—" no serviço sem horas (valor fechado) |

- Preenchidas pelo servidor a partir do JSON **a cada salvamento** (`colunasDoVeiculo_`). A coluna F continua (compatibilidade e lista). **A fonte da verdade é o JSON (coluna V).**
- Orçamento de antes da seção 17 (sem `servicos`): veículo vazio; AF = a descrição antiga; AG = as horas do modo usado ("—" no valor fechado sem horas).
- **Migração** (troca de esquema, dentro do lock, uma vez): cabeçalhos AA–AG + AA–AG de todas as linhas existentes, numa leitura e numa escrita. JSON com defeito → vazio. Com os cabeçalhos já lá, não faz nada.
- As listagens **não leem** AA–AG (a busca continua pela coluna Z).
- A proteção "somente aviso" cobre a aba inteira, inclusive as colunas novas.

### 19.3 Deploy
A regra em negrito no topo do DEPLOY: **backend nas DUAS planilhas ANTES do push**, com _Nova versão_; a 1ª linha do registro do `testarApi` mostra a versão ("código da API versão 4 · esquema 4").

**Testes:** `check-19.js` (backend), V1 em todos os verificadores, `teste-trava.js` (backend antigo e novo), `teste-reabrir.js`.

## 20. Orçamento em PDF, número do orçamento, dados da oficina e WhatsApp do cliente (onda do PDF)

**Referência visual:** o orçamento do sistema que o André usava (cabeçalho com a oficina, "Orçamento 186-2026", cliente e telefone, "Informações básicas" do veículo, tabela de serviços com preço, peças com quantidade, subtotais Serviços/Peças/Total, "Pagamento" com a chave Pix, observações, cidade/data e assinaturas).

**O backend muda:** `API_VERSAO_` = **5** e `APP_EXIGE_API` = **5** (a trava da seção 19 impede o app novo de gravar ou gerar PDF numa planilha antiga). O esquema das abas continua **4** (nenhuma coluna nova: a AA já estava reservada).

### 20.1 Dados da oficina (Ajustes → "Dados da oficina")
- Chaves novas na aba **Parâmetros** (opcionais: a tela antiga não manda e não apaga; leitura tolerante; validação de tamanho/opções):
  `cnpjCpf` (18, máscara CPF/CNPJ pelo nº de dígitos) · `telefoneOficina` (20, máscara) · `enderecoOficina` (100) · `cidadeUf` (60) · `chavePix` (100) ·
  `tipoChavePix` ("", CNPJ, CPF, E-mail, Telefone, Aleatória) · `validadeOrcamentoDias` (inteiro 1–365; padrão 7) · `observacoesPdf` (300) ·
  `pdfPrecoServico` ("sim"/"nao"; padrão sim) · `pdfPrecoPeca` ("sim"/"nao"; padrão nao) · `proximoNumero` (inteiro 1–999999; padrão 1) ·
  `anoProximoNumero` (**interno**: só o servidor grava; nunca vem da tela).
- O "Nome da oficina" passou para este card (continua no WhatsApp). Logo: o já embutido no app (CliniCar); sem upload.

### 20.2 Número do orçamento ("{n}-{ano}", coluna AA)
- Gerado pelo **servidor, sob o lock**, no **primeiro salvamento** (e, nos orçamentos de antes desta onda, no próximo salvamento ou ao gerar o PDF, pela ação nova `numerarOrcamento`, que **não** muda "Atualizado em"). Guardado no JSON (`dados.numero`) e na coluna AA. O número que o aparelho mandar é ignorado; ao salvar, o servidor mantém o que já existe.
- n = o maior entre o "próximo número" do **ano corrente** (aba Parâmetros; outro ano → 1: **a numeração recomeça na virada**) e o maior n do ano já gravado na coluna AA + 1 (nunca repete, mesmo com a aba mexida à mão). Depois grava n + 1 e o ano.
- **Ajustes → "Próximo número do orçamento"**: para continuar a numeração do sistema antigo; **só aumenta** (a tela avisa ao tentar diminuir; o servidor guarda o maior). A tela só manda essa chave quando ele mexeu nela (uma tela aberta há tempo não volta a numeração).
- **DECIDIDO:** orçamentos existentes **não** são numerados na migração.
- O número aparece no card Serviço ("Orçamento nº 186-2026"), na lista de Resultados ("nº 186-2026") e é pesquisável ("186").

### 20.3 Conteúdo do PDF (A4 retrato)
- Montado por `documentoDoPdf` (puro, em `js/calculo.js`) e desenhado por `js/pdf.js` com a **jsPDF 4.2.1** (MIT; `js/vendor/`, 420 KB, carregada só na 1ª vez e guardada no cache do service worker; funciona sem internet; sem terceiros). Helvetica: acentos do português corretos.
- Cabeçalho (logo + nome, CNPJ/CPF, telefone, endereço, cidade/UF; "Orçamento nº", data, "Válido até" = data + validade) · Cliente (nome, telefone) · Informações básicas do veículo (só o que tiver) ·
  **Serviços** (oficina + parceiros com "(parceiro)"; valor por item se "preço de cada serviço") · **Peças** (quantidade + descrição; valor por item só se "preço de cada peça") · subtotais e caixa **Serviços · Peças · Total** ·
  **Pagamento** (as mesmas linhas do WhatsApp — exceto com desconto 0%, ver 20.5: cartão até a referência e demais destaques; entrada, se aberta; à vista com o desconto em % ou em R$ quando os descontos de serviço e peças forem diferentes; "Chave Pix (tipo): …") ·
  **Observações** (as do cliente + as padrão) · rodapé "{Cidade}, {data por extenso}" e linhas de assinatura (oficina / cliente; opcional).
- **Valores por item no PREÇO CHEIO** (o cartão até a parcela de referência): fator = âncora ÷ Σ bases (sem arredondar no meio); subtotal dos serviços = arredondar(Σ bases × fator); peças = âncora − serviços; em cada seção, cada item arredondado e o **último absorve o centavo** → itens = subtotais e Serviços + Peças = Total = âncora, exatos. Sem âncora: fator 1 (total = a base).
- **Nunca no PDF:** custo, sobra, salário, taxa da maquininha, piso, "ainda pode dar", imposto, lucro (conferido no texto extraído do PDF).
- Data e validade: a data em que o PDF é gerado.

### 20.4 Geração e envio
- Botões **"Enviar no WhatsApp do cliente"** e **"Enviar orçamento em PDF"** junto do "Copiar para WhatsApp" (não aparecem em "Não fechou").
- PDF: modal com as 3 opções (preço de cada serviço, de cada peça, linhas de assinatura; marcadas pelo padrão; valem só para aquele PDF) → **Gerar PDF**: salva o orçamento (sem conexão com mudança não salva, planilha antiga (trava) ou erro → avisa e não gera) e pega o número (`numerarOrcamento` se for antigo) → monta e desenha.
  Orçamento já salvo, numerado e sem mudança: gera mesmo sem internet (não há o que gravar).
- **Enviar** (segundo toque: o compartilhamento exige o toque da pessoa): com `navigator.share` + arquivos (celular; Windows com Chrome) → janela do sistema com o PDF e o texto curto "Orçamento nº {n} – {oficina}". Sem isso → baixa o PDF e, com telefone, abre a conversa do cliente (wa.me com o texto curto) e avisa "PDF baixado. Arraste o arquivo para a conversa do WhatsApp." **Baixar o PDF** sempre disponível.
- Nome do arquivo: "Orcamento-186-2026-{placa ou cliente}.pdf" (sem acentos nem espaços).
- **WhatsApp do cliente (texto):** telefone válido (10 ou 11 números) → `https://wa.me/55{DDD+número}?text={o MESMO texto do Copiar, codificado em UTF-8}`; sem telefone → botão desabilitado ("Preencha o telefone do cliente"; o Copiar continua). Texto codificado acima de **1.800** caracteres → copia o texto e abre a conversa sem o texto ("Texto copiado — é só colar na conversa"). Como o Copiar: abre primeiro e salva em seguida.
- **Observações para o cliente** (card Serviço, até 300 letras): no JSON (`entrada.observacoesCliente`, opcional) e no PDF.
- **Número no texto do WhatsApp** (aprovado): com o orçamento já numerado, o título do "Copiar para WhatsApp" e do "Enviar no WhatsApp do cliente" é "*Orçamento nº 186-2026 – {oficina}*" (sem oficina: "*Orçamento nº 186-2026*"); sem número (orçamento novo ainda não salvo), como antes.
- **Decisões aprovadas:** data/validade = o dia em que o PDF é gerado; orçamento já salvo, numerado e sem mudança gera o PDF sem internet; orçamento fechado: o PDF mostra os preços do orçamento (não o valor combinado); "Nome da oficina" no card "Dados da oficina".

**Testes:** casos PDF1–PDF4 e WA1; `check-20.js` (backend); `teste-pdf.js` (tela, PDF extraído e em imagem) e `teste-pdf.js v4` (trava).

### 20.5 Acabamento do PDF e da tela de envio (só frontend; `sw.js` v18)
- **Logo do PDF:** `icons/logo-pdf.png` (300 px, **redondo com fundo transparente**, gerado por `tools/gerar-icones.ps1` como os ícones "any"): no PDF não aparece nenhum quadrado em volta da bola preta. O logo do topo do app continua o `logo-clinicar.jpg`.
- **Tabelas (Serviços e Peças):** toda linha tem a **mesma altura** (7,4 mm; descrição longa acrescenta 4,6 mm por linha extra) com o texto **centralizado na faixa** — o mesmo respiro antes e depois de cada separador; o cabeçalho da tabela também centralizado.
- **Margem direita única:** a coluna "Valor", os subtotais ("Subtotal serviços", "Subtotal peças") e o quadro de totais (Serviços, Peças, Total) terminam na **mesma coordenada x** (2 mm antes da margem). O rótulo do subtotal fica à esquerda do valor, sem empurrá-lo.
- **Pagamento com desconto 0%** (à vista = cartão até a referência): **uma linha só** — "Cartão em até 5x (5x de R$ 409,76) ou à vista (Pix, dinheiro ou débito): R$ 2.048,81" (referência em 1x: "Cartão em 1x ou à vista …"). Com desconto, duas linhas como antes. Só no PDF: o texto do WhatsApp não muda.
- **Tela:** janela "Enviar orçamento em PDF" com **12 px** entre os botões empilhados ("Gerar PDF"/"Fechar"; "Enviar"/"Baixar o PDF"/"Fechar" — antes o "Fechar" ficava colado porque vinha depois de um bloco). Os demais pares empilhados (Copiar / Enviar no WhatsApp do cliente / Enviar orçamento em PDF / Salvar · O cliente fechou?) já tinham 10 px e foram medidos.
- **Card à vista:** "O cliente pediu mais desconto?" e "Desconto diferente nas peças?" nunca quebram em duas linhas: lado a lado na **mesma linha de base** quando cabem (computador), um embaixo do outro quando não cabem (celular).

**Testes:** caso PDF5; `teste-pdf.js` mede o PDF de verdade (PyMuPDF: fim de todos os valores na mesma x, ±0,5 pt; alturas das linhas iguais; texto centralizado; cantos do logo brancos) e gera o PDF com desconto 0%; `medir-botoes.js` mede o espaço entre botões empilhados (≥ 10 px) e a linha de base dos links, em 390 e 1280.
