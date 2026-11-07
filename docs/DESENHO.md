# Preço Certo – Oficina · Desenho do projeto

> **Fonte da verdade do projeto.** Qualquer mudança de regra, tela ou dado é registrada aqui no mesmo commit que a implementa.

## 1. Contexto

App web gratuito para um mecânico que abriu uma oficina e tem pouca familiaridade com finanças e tecnologia. Ele calcula quanto cobrar em um serviço, já com a taxa da maquininha repassada ao cliente, e mostra o lucro real.

- Roda 100% na conta Google do usuário: uma **Planilha Google** guarda os dados, e um **Apps Script vinculado** serve a página (App da Web).
- Implantação: **Executar como: Eu** · **Quem tem acesso: Somente eu**. A implantação é feita na conta Google **dele**.
- Uso: link no celular ("Adicionar à tela inicial") e no notebook, sempre logado na conta dele.
- Sem servidor próprio, sem login próprio, sem chamadas externas e sem custo.

### Diretriz principal: simples e intuitivo
- Menos campos, menos telas e menos números. Na dúvida, esconder em "Ver mais detalhes".
- Linguagem do dia a dia, sem jargão. Evitar "margem", "faturável", "modalidade", "base" e "MDR". Usar "Quanto você gasta por mês", "Preço mínimo da sua hora", "Seu lucro neste serviço" e "Cliente paga".
- Fonte mínima de 16px, valores principais com 28px ou mais, botões com 48px de altura ou mais, alto contraste. Cores: verde = bom, vermelho = prejuízo.
- Textos de ajuda de uma linha, logo abaixo do campo.
- `inputmode="decimal"` em todos os campos de valor.
- Toda a interface em PT-BR com acentuação correta.

## 2. Estrutura do repositório

```
/src/Codigo.gs           backend Apps Script
/src/Index.html          app inteiro (HTML + CSS + JS)
/src/appsscript.json     manifesto
/docs/DESENHO.md         este documento
/docs/LEIAME-instalacao.md   instalação (colar no editor ou clasp) e atualização
/docs/GUIA-DO-USUARIO.md     1 página para o mecânico
/docs/testes-calculo.md      casos de teste e resultados
.gitignore  .claspignore  .clasp.json.exemplo (rootDir "src", scriptId vazio)
```

**Disciplina de trabalho:** só commits locais. Nunca rodar `git push`, `clasp login`, `clasp push` nem `clasp deploy`; isso cabe ao dono do projeto.

## 3. Planilha (abas criadas automaticamente por `configurarPlanilha_()`)

### 3.0 Regra geral: leitura tolerante, gravação rígida, mesmos limites
- **Tudo o que `obterDados()` devolve precisa passar em `validarDados_()` sem erro.** Assim, uma edição manual errada na planilha nunca deixa o app preso em "Erro ao salvar".
- Os limites ficam num lugar só no backend (`LIMITES_PARAMETROS_`, `LIMITE_TAXA_`, `LIMITE_VALOR_GASTO_`) e valem tanto para a leitura quanto para a validação.
- **Leitura:**
  - parâmetro inválido ou fora do limite → usa o **padrão** daquela chave;
  - taxa ou valor de gasto inválido ou fora do limite → **vazio** (`null`);
  - parcela em destaque inválida → descartada;
  - textos longos → cortados no limite.
- **Validação (salvar):** dado inválido ou fora do limite → erro com mensagem em português.
- **Frontend:** nunca envia o que `validarDados_` rejeitaria. Valida no campo, mostra a mensagem em linguagem simples junto do campo e não dispara o salvamento enquanto houver campo inválido.

### 3.1 Aba `Gastos`
| Tipo | Descrição | Valor por mês (R$) |
|---|---|---|
| `Oficina` ou `Casa` | texto (até 100 caracteres) | número ≥ 0 ou vazio |

- Padrão: só o cabeçalho.
- Um valor vazio é aceito (linha recém-adicionada) e conta como 0 na soma.
- Na leitura, um `Tipo` diferente de "Oficina" vira "Casa" (inclusive o antigo "Pessoal").

### 3.2 Aba `Parâmetros`
Colunas `Chave` | `Valor`. A coluna `Valor` fica em formato **texto (`@`)**. Os números são gravados em formato pt-BR legível ("150,5") e lidos com `lerNumeroBR`.

| Chave | Padrão | Regra de validação |
|---|---|---|
| diasPorSemana | 5 | de 1 a 7 (aceita decimal, por exemplo 5,5) |
| horasPorDia | 8 | maior que 0 e até 24 |
| horasCobradasPorDia | 6 | maior que 0 e no máximo `horasPorDia` |
| valorHoraCobrado | 150 | ≥ 0 |
| impostoPercentual | 0 | de 0 a 99 |
| parcelasDestaque | "5,10" | inteiros de 1 a 12 separados por vírgula. Pode ficar vazio: aí nenhum card de cartão aparece em destaque, só "Ver outras formas de pagamento" |
| nomeOficina | "" | texto (até 60 caracteres) |

O `atualizadoEm` **não** fica na planilha; vai para `PropertiesService.getDocumentProperties()`.

### 3.3 Aba `Taxas`
Colunas: `Forma de pagamento` | `Parcelas` | `Visa/Master (%)` | `Elo (%)` | `Amex (%)` | `Hipercard (%)` (taxas em formato numérico `0.00`).

14 linhas **fixas**, nesta ordem: Pix 0 · Débito 0 · Crédito 1 … Crédito 12. Não é possível adicionar nem remover linhas. O servidor ignora linhas extras e regrava sempre na ordem padrão.

Padrão Visa/Master (InfinitePay, plano 1 dia útil):

| Débito | 1x | 2x | 3x | 4x | 5x | 6x | 7x | 8x | 9x | 10x | 11x | 12x |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,37 | 3,15 | 5,39 | 6,12 | 6,85 | 7,57 | 8,28 | 8,99 | 9,69 | 10,38 | 11,06 | 11,74 | 12,40 |

Fonte: 1x a 4x conferidos em prints da calculadora do app InfinitePay; 5x a 12x vêm da tabela pública.

- **Elo, Amex e Hipercard: vazios no padrão.** Os valores reais serão copiados da calculadora do app do usuário; não usar números pesquisados nem estimados.
- **Pix:** 0 gravado só na coluna Visa/Master. O código trata o Pix como 0% fixo, sem bandeira, e ele não aparece na edição de taxas.
- **Vazio ≠ 0, em todos os pontos:**
  - leitura: célula `""` vira `null`, e `0` continua `0`;
  - validação: `null` é aceito; números ficam entre 0 e 99;
  - gravação: `null` vira célula vazia;
  - cálculo: `null` esconde a linha.
  - Nunca usar `Number("")` ou `|| 0` sobre taxa.
- **Bandeiras disponíveis (viram chip):** as que têm pelo menos uma taxa de Débito ou Crédito preenchida.

## 4. Regras de cálculo

**Arredondamento:** valores intermediários (preço mínimo da hora, horas estimadas, `totalExato`) entram nos cálculos **sem arredondar**. Só se arredonda:
- (a) na exibição;
- (b) no total exibido de cada opção;
- (c) na parcela.

O arredondamento é comercial e feito em centavos inteiros (`Math.round(valor × 100)`, com proteção contra erro de ponto flutuante). Exemplo: o lucro usa `precoMinimoHora = 53,846153…`, não 53,85.

**Preço mínimo da hora:**
- `horasCobradasMes = horasCobradasPorDia × diasPorSemana × 52/12`
- `precoMinimoHora = totalGastos ÷ horasCobradasMes`; se `horasCobradasMes` for 0, o resultado é 0, sem erro.

**Mão de obra:**
- **Por horas:** `maoDeObra = horas × valorHoraCobrado`.
- **Valor fechado:** `maoDeObra` = valor digitado.
  - Se as horas ficarem vazias: `horas = maoDeObra ÷ valorHoraCobrado`, com o aviso "horas estimadas pelo valor da sua hora".
  - Se `valorHoraCobrado` for 0, não estima: horas = 0.

**Peças e à vista:**
- `pecasCobrar` = "quanto vai cobrar do cliente"; se vazio, usa "quanto você paga".
- `lucroPecas = pecasCobrar − pecasPagar`.
- `aVista = maoDeObra + pecasCobrar`.

**Taxa de cada linha conforme a bandeira:**
- **Bandeira específica:** o valor da coluna daquela bandeira. Se for `null`, a linha some.
- **"Não sei" (padrão):** a **maior** taxa entre as colunas preenchidas daquela linha. Se todas estiverem vazias, a linha some.

**Opção de pagamento (regra B):**
- `totalExato = aVista ÷ (1 − taxa/100)`
- total exibido = `arredondar(totalExato)`
- parcela = `arredondar(totalExato ÷ n)`
- Não exibir "parcela × n"; mostrar só "N× de R$ X" e "Total R$ Y".

**Lucro:**
- `imposto = totalDaOpcao × impostoPercentual/100`
- `lucro = (maoDeObra − horas × precoMinimoHora) + lucroPecas − imposto`
- O valor grande usa a opção à vista.
- Se o imposto for maior que 0, aparece embaixo e em letra pequena: "No cartão em {maior parcela em destaque}x: R$ …", na bandeira selecionada.

**Assinatura da função pura principal** (o `precoMinimoHora` é calculado fora e injetado, para facilitar os testes):

```
calcularOrcamento(entrada, parametros, taxas, bandeira, precoMinimoHora)
  entrada    = { modo: 'horas'|'fechado', horas, valorFechado, pecasPagar, pecasCobrar }
  parametros = { valorHoraCobrado, impostoPercentual, parcelasDestaque }
```

## 5. Contrato backend ↔ frontend

```
dados = {
  gastos:     [{ tipo: 'Oficina'|'Casa', descricao: string, valor: number|null }],
  parametros: { diasPorSemana, horasPorDia, horasCobradasPorDia, valorHoraCobrado,
                impostoPercentual: number, parcelasDestaque: string, nomeOficina: string },
  taxas:      [{ forma: 'Pix'|'Débito'|'Crédito', parcelas: 0..12,
                 visa: number|null, elo: number|null, amex: number|null, hiper: number|null }]  // 14 linhas
}
obterDados() → { ...dados, atualizadoEm: string|null, urlPlanilha: string }
salvarDados(dados) → atualizadoEm (ISO)
obterTaxasPadraoVisa() → [{ forma, parcelas, taxa }]   // Débito e Crédito 1..12
```

### Backend (`src/Codigo.gs`)
**Só ficam públicas as funções que a página realmente chama:** `doGet`, `obterDados`, `salvarDados` e `obterTaxasPadraoVisa`. Todas as outras terminam em `_` e são internas.

| Função | Papel |
|---|---|
| `doGet()` | Pega o `LockService` (`tryLock`, 10 s) e chama `configurarPlanilha_()`. Sem lock, segue sem configurar (outro acesso está configurando). Devolve `Index` com título "Preço Certo", viewport e XFrameOptionsMode DEFAULT |
| `configurarPlanilha_()` | Idempotente: cria abas ausentes ou vazias com cabeçalho, formatos e dados padrão. Quem chama segura o lock (`doGet`, ou `salvarDados` chamando direto, sem lock aninhado) |
| `obterDados()` | Lê as 3 abas, `atualizadoEm` e a URL da planilha |
| `salvarDados(d)` | Valida, pega o `LockService` (até 10 s), regrava o corpo das 3 abas, grava e retorna `atualizadoEm` |
| `obterTaxasPadraoVisa()` | Coluna Visa/Master padrão, para o botão "Voltar taxas da InfinitePay" |
| `validarDados_`, `lerGastos_`, `lerParametros_`, `lerTaxas_`, `dentroDoLimite_`, `exigirNumero_`, `regravarCorpo_`, `lerNumeroBR_`, `formatarNumeroBR_` | Internas. Leitura e validação compartilham os limites (seção 3.0) |

### Frontend (`src/Index.html`)
- **Cálculo (funções puras, testáveis):** `lerNumeroBR`, `centavos`, `formatarBRL`, `horasCobradasMes`, `precoMinimoHora`, `calcularMaoDeObra`, `taxaDaLinha(linha, bandeira)`, `bandeirasDisponiveis(taxas)`, `calcularOpcao(aVista, taxa, n)`, `calcularOrcamento(...)`, `textoWhatsApp(...)`.
- **Sincronização:**
  - `carregarCache` lê o `localStorage` para abrir rápido; em seguida `carregarServidor` substitui o cache, porque a planilha é a fonte da verdade.
  - `agendarSalvar` espera 800 ms após a última alteração e salva; `mostrarStatus` exibe "Salvando…", "Salvo ✓" ou "Erro ao salvar – tentar de novo".
  - Quando o app volta a ficar visível (`visibilitychange`) e não há alteração pendente, recarrega do servidor. Não há detecção de conflito: quem salvar por último vence.
  - O frontend só envia dados válidos. Um campo inválido mostra o aviso no próprio campo e não dispara o salvamento.
- **Telas:** `trocarTela`, `renderOrcamento`, `renderGastos`, `renderAjustes`.
- **Copiar e compartilhar:** `copiarTexto` tenta em 3 níveis: `navigator.clipboard`, depois `execCommand('copy')`, depois uma caixa de texto selecionada para copiar à mão. `testarCompartilhar` só mostra o botão "Compartilhar" se o recurso funcionar.
- **Teste:** `executarAutoteste()`, ativado por `?teste=1` (lido com `google.script.url.getLocation()`).
- O orçamento não é salvo na planilha; fica só em memória e no `localStorage`.

`lerNumeroBR`, igual no frontend e no backend:
- aceita "150,50", "1.234,56", "R$ 1.234,56" e "7,57%";
- sem vírgula, "1.234" é lido como milhar e "1.5" como decimal;
- vazio ou inválido vira `null`.

## 6. Telas

Abas no topo, com ícone e nome: **🧮 Orçamento · 📋 Meus gastos · ⚙️ Ajustes**. O status de salvamento fica discreto no canto.

**Tela inicial:** se não houver gastos cadastrados, abre em "Meus gastos" com a faixa "Comece colocando seus gastos do mês. Leva 2 minutos." Nos outros casos, abre no Orçamento.

### 6.1 🧮 Orçamento
```
Qual serviço / veículo?            [ texto opcional ]

Quantas horas de serviço?          [ 8 ]
Mão de obra: R$ 1.200,00
Prefiro digitar o valor fechado    ← link; troca para "Valor da mão de obra" + "Horas (opcional)"
                                     e o link "Prefiro calcular por horas"
Peças – quanto você paga               [ 400,00 ]
Peças – quanto vai cobrar do cliente   [ 500,00 ]

┌ 💵 À vista (Pix ou dinheiro) ─ R$ 1.700,00 ┐
Cartão do cliente:  ( Não sei ✓ ) ( Visa/Master ) ( Elo ) ( Amex ) ( Hiper )   ← só bandeiras com taxa
Não sabe o cartão do cliente? Deixe em "Não sei": o preço cobre qualquer bandeira.
┌ 💳 Cartão em 5x ─ 5× de R$ 367,85 · Total R$ 1.839,23 ┐   ← um card por parcelasDestaque
┌ 💳 Cartão em 10x ─ … ┐                                     (some se a linha estiver vazia)
▸ Ver outras formas de pagamento  → Débito — total R$ … ; "Nx de R$ X — total R$ Y" de 1x a 12x

┌ Seu lucro neste serviço ─ R$ 740,00 (verde; vermelho se < 0) ┐
  (se < 0) "Esse preço não cobre seus gastos do mês"
  (se imposto > 0) "No cartão em 10x: R$ …"
  ▸ Ver detalhes → Mão de obra · Gasto das horas · Lucro nas peças · Imposto
  (sem gastos) faixa "Coloque seus gastos em Meus gastos para ver o lucro"

[ 📲 Copiar para WhatsApp ] (verde, grande)  [ Compartilhar ] (se funcionar)  [ Novo orçamento ]
```
A taxa em R$ **não** aparece para o usuário; ela já está embutida no que o cliente paga. A bandeira volta para "Não sei" a cada novo orçamento.

**Texto do WhatsApp** (sem custo, lucro, taxa, nem bandeira quando for "Não sei"):
```
Orçamento – {nomeOficina}
{serviço/veículo}

Mão de obra: R$ …
Peças: R$ …

💵 À vista (Pix/dinheiro): R$ …
💳 Cartão em até 5x: R$ … (5x de R$ …)
💳 Cartão em até 10x: R$ … (10x de R$ …)
```
Com uma bandeira escolhida, a linha vira "💳 Cartão Elo em até 5x: R$ … (5x de R$ …)". As linhas de cartão seguem `parcelasDestaque`. Linhas sem valor (nome da oficina, serviço, peças zeradas) são omitidas.

### 6.2 📋 Meus gastos
```
Gastos da oficina   [desc][valor][🗑] … [+ Adicionar gasto]
  (lista vazia → chips: Aluguel · Luz · Água · Internet/Telefone · Contador/MEI · Ferramentas/Manutenção · Ajudante)
Gastos de casa      [desc][valor][🗑] … [+ Adicionar gasto]
  (lista vazia → chips: Aluguel/Financiamento · Mercado · Luz/Água · Escola · Carro/Combustível · Plano de saúde)

Sua rotina
  Dias de trabalho por semana   [5]
  Horas de trabalho por dia     [8]
  Das suas horas de trabalho por dia, quantas você consegue cobrar do cliente?  [6]
  Tem orçamento, busca de peça, espera… Normalmente 6 de 8.

┌ Você gasta R$ 7.000,00 por mês · Sua hora precisa valer no mínimo R$ 53,85 ┐
Quanto você vai cobrar por hora  [150,00]
Você ganha R$ 96,15 a mais por hora   (vermelho se negativo)
```
Um chip clicado cria a linha com o nome preenchido e coloca o foco no valor.

### 6.3 ⚙️ Ajustes (um layout só, no celular e no notebook)
```
Taxas da maquininha
Copie as taxas da calculadora do app da sua maquininha, bandeira por bandeira.
Editando: [ Visa/Master ▾ ]      (Visa/Master · Elo · Amex · Hipercard)
  Débito [1,37] %   1x [3,15] % … 12x [12,40] %
  Campo vazio = sem taxa: essa opção não aparece no orçamento.
[ Voltar taxas da InfinitePay ]  ← restaura só Visa/Master, pede confirmação

Imposto (%) [0]   Se for MEI, deixe 0 e coloque o DAS em Meus gastos.
Parcelas que aparecem no orçamento [5,10]
Nome da oficina [        ]
🔗 Abrir minha planilha
```

## 7. Casos de teste (Fatia 4, igualdade exata em centavos)

| # | Caso | Esperado |
|---|---|---|
| T1 | Visa, à vista 1.000, 1x 3,15% | total 1.032,53 · parcela 1.032,53 |
| T2 | Visa, à vista 1.000, 2x 5,39% | 1.056,97 · 528,49 |
| T3 | Visa, à vista 1.000, 3x 6,12% | 1.065,19 · 355,06 |
| T4 | Visa, à vista 1.000, 4x 6,85% | 1.073,54 · 268,38 |
| T5 | Gastos 4.000 + 3.000; 5 dias × 6 h × 52/12 | 130 h · R$ 53,85 (exibição) |
| T6 | 8 h × 150; `precoMinimoHora` = 70 **injetado**; peças 400 → 500; imposto 0 | à vista 1.700,00 · lucro 740,00 |
| T7 | T6 em 5x Visa 7,57% | 1.839,23 · 5× 367,85 |
| T8 | "Não sei" com só Visa preenchida | idêntico a Visa em todas as linhas |
| T9 | "Não sei", Elo 5x = 8,00 (fictício), Visa 5x = 7,57, à vista 1.700 | usa 8,00 → 1.847,83 · 5× 369,57 |
| T10 | Mesmo cenário do T9, linha 6x (Elo vazio) | usa Visa 8,28 |
| T11 | Bandeira Elo com só 5x preenchido | as outras linhas ficam ocultas e nenhuma linha dá total = à vista |
| T12 | Elo totalmente vazio | chip "Elo" não aparece |
| T13 | `lerNumeroBR("1.234,56")`, `"150,50"`, `""` | 1234,56 · 150,5 · `null` |
| T14 | Horas cobradas = 0 | preço mínimo da hora 0, sem erro |
| T15 | Valor fechado 900, horas vazias, valor da hora 150 | horas 6 · aviso ligado |

Se algum caso divergir, a fórmula **não** é ajustada para forçar o número: a divergência é reportada.

## 8. Fatias
1. Desenho ✅ (este documento)
2. Backend: `src/Codigo.gs` e `src/appsscript.json` ✅
3. Frontend: `src/Index.html`
4. Testes de cálculo: autoteste e `docs/testes-calculo.md`
5. Documentação: `docs/LEIAME-instalacao.md` e `docs/GUIA-DO-USUARIO.md`

Cada fatia termina com uma parada para revisão. O commit local só é feito depois da aprovação.
