# Preço Certo – Oficina · Desenho do projeto

> **Fonte da verdade do projeto.** Qualquer mudança de regra, tela ou dado é registrada aqui no mesmo commit que a implementa.

## 1. Contexto

App web gratuito para um mecânico que abriu uma oficina e tem pouca familiaridade com finanças e tecnologia. Ele calcula quanto cobrar em um serviço, já com a taxa da maquininha repassada ao cliente, e mostra o lucro real.

- Roda 100% na conta Google do usuário: uma **Planilha Google** guarda os dados, e um **Apps Script vinculado** serve a página (App da Web).
- Implantação: **Executar como: Eu** · **Quem tem acesso: Somente eu**. A implantação é feita na conta Google **dele**.
- **Instalação (opção A):** atalho no navegador. Não há página própria nem GitHub Pages.
  - Celular: Chrome → ⋮ → "Adicionar à tela inicial".
  - Notebook: Chrome → ⋮ → "Salvar e compartilhar" → "Criar atalho" → marcar "Abrir como janela".
  - O ícone do atalho não pode ser personalizado: o Apps Script não permite manifesto próprio, e o `setFaviconUrl` exige uma URL pública.
- Sem servidor próprio, sem login próprio, sem custo. A única chamada externa é a folha de estilo da fonte Inter (Google Fonts); se ela não carregar, a página usa a fonte do sistema.

### Diretriz principal: simples e intuitivo
- Menos campos, menos telas, menos números. Na dúvida, esconder em "Ver detalhes" ou "Ver outras formas de pagamento".
- Linguagem do dia a dia, sem jargão. Evitar "margem", "faturável", "modalidade", "base" e "MDR". Usar "Quanto você gasta por mês", "Sua hora precisa valer no mínimo", "Seu lucro neste serviço" e "Cliente paga".
- Ajuda de uma linha, logo abaixo do campo. `inputmode="decimal"` em todos os campos de valor. PT-BR com acentuação correta.
- **Sem emoji na interface do app** (ícones SVG de traço). Os emojis 💵 e 💳 ficam só no texto do WhatsApp.

### Identidade e direção visual (CliniCar Motors Tech)
- **Referência:** app de banco digital (Nubank, InfinitePay, Mercado Pago): limpo, leve e respirado.
- **Logo:** recortado do perfil da oficina (240 px, JPEG) e embutido no `Index.html` como `data:` URI. Aparece no topo (52 px) e na tela de carregamento.
- **Fonte:** Inter (400, 500, 600 e 700) via Google Fonts, com reserva `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
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
/src/Codigo.gs                 backend Apps Script
/src/Index.html                app inteiro (HTML + CSS + JS)
/src/appsscript.json           manifesto
/docs/DESENHO.md               este documento
/docs/GUIA-DO-USUARIO.md       guia para o mecânico (uso no dia a dia, instalação, cartões)
/docs/LEIAME-instalacao.md     instalação (colar no editor ou clasp) e atualização — Fatia 5
/docs/testes-calculo.md        casos de teste e resultados
/docs/DEPLOY.md                deploy automático: secrets, clasp login, segurança
/.github/workflows/deploy.yml  GitHub Actions: clasp push + atualização da implantação
.gitignore  .claspignore  .clasp.json.exemplo (rootDir "src", scriptId vazio)
```

**Disciplina de trabalho:** só commits locais. Nunca rodar `git push`, `clasp login`, `clasp push` nem `clasp deploy`; isso cabe ao dono do projeto.

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
- **acréscimo (modo padrão):** `cliente paga = paga × (1 + acréscimo/100)`. Ex.: 500 + 47% = 735,00 e 333,33 + 47% = 489,9951, exibido como 490,00. Acréscimo vazio conta como 0%.
- **valor direto** (link "Prefiro digitar o valor das peças"): o valor digitado; se ficar vazio, usa o que ele paga.
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

**Lucro:**
- `imposto = totalDaOpcao × impostoPercentual/100`, sobre o **total arredondado** (o que o cliente paga);
- `lucro = (maoDeObra − horas × precoMinimoHora) + lucroPecas − imposto`;
- o valor grande usa o à vista;
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
obterDados()            → { ...dados, atualizadoEm: string|null, urlPlanilha: string }
salvarDados(dados)      → atualizadoEm (ISO)
obterTaxasPadraoVisa()  → { debito, p1, …, p12 }   // InfinitePay, para "Preencher com as taxas padrão"
```

### Backend (`src/Codigo.gs`)
**Só ficam públicas as funções que a página chama:** `doGet`, `obterDados`, `salvarDados` e `obterTaxasPadraoVisa`. Todas as outras terminam em `_`.

| Função | Papel |
|---|---|
| `doGet()` | `tryLock` (10 s) e `configurarPlanilha_()`; sem lock, segue sem configurar. Devolve `Index` (título "Preço Certo", viewport, XFrame DEFAULT) |
| `configurarPlanilha_()` | Idempotente: cria abas ausentes ou vazias e roda `migrarTaxasAntigas_` (uma única vez). Quem chama segura o lock |
| `obterDados()` | Lê gastos, parâmetros e cartões, mais `atualizadoEm` e a URL da planilha |
| `salvarDados(d)` | Valida, pega o lock, regrava as 3 abas e grava `atualizadoEm` |
| `obterTaxasPadraoVisa()` | Taxas InfinitePay Visa/Master |
| `converterTaxasAntigas_`, `limparCartoesLidos_` | Funções puras de migração e de leitura tolerante dos cartões (testadas em Node) |
| `validarCartoes_`, `validarGastos_`, `validarParametros_`, `lerCartoes_`, `lerGastos_`, `lerParametros_`, `chaveNome_`, `lerNumeroBR_` … | Internas |

### Frontend (`src/Index.html`)
- **Cálculo** (funções puras, no bloco `<script id="calculo">`):
  - números e validação: `lerNumeroBR`, `validarNumeroCampo`, `validarHorasCobradas`, `normalizarParcelas`, `centavos`, `formatarBRL`, `formatarHoras`;
  - gastos e horas: `horasCobradasMes`, `precoMinimoHora`, `calcularMaoDeObra`, `calcularPecasCobrar`;
  - cartões: `chaveNome`, `acharCartao`, `cartaoEfetivo`, `taxaDaForma`, `validarNomeCartao`;
  - orçamento e texto: `calcularOpcao`, `calcularOrcamento`, `valoresWhatsApp`, `textoWhatsApp`.
- **Dados de teste** (`VISA_TESTE`, `cartaoDeTeste`, `casosDeTeste`): só o autoteste usa. Um teste automático garante que o app nunca os usa.
- **Sincronização:**
  - **cache e servidor:** o cache local abre o app rápido, e em seguida a planilha (fonte da verdade) substitui o cache. O app recarrega da planilha quando volta a ficar visível, se não houver nada pendente.
  - **salvamento:** acontece 800 ms depois da última alteração, com o status "Salvando…", "Salvo ✓" ou "Erro ao salvar – tentar de novo". Ao sair do app, o que estiver pendente é salvo na hora.
  - **antes de carregar a planilha:** "Meus gastos" e "Ajustes" ficam bloqueados.
  - **sem conexão e com cache:** aparece a faixa "Sem conexão: só orçamento".
  - **remover gasto ou cartão:** some na hora e aparece a barra "Gasto removido · DESFAZER" (ou "Cartão removido · DESFAZER") por 6 s. O salvamento só acontece quando a barra some, ou junto com a próxima alteração.
- **Copiar:** tenta em 3 níveis: clipboard, depois `execCommand`, depois uma caixa com o texto selecionado. O botão "Compartilhar" só aparece se funcionar.
- **Autoteste:** `?teste=1`.

## 6. Telas

Topo preto com o logo, "Preço Certo" e o status. Abas com ícone SVG: **Orçamento · Meus gastos · Ajustes**. No primeiro acesso, sem gastos, o app abre em "Meus gastos".

### 6.1 Orçamento
No notebook, os campos ficam à esquerda e os resultados à direita.
- **Card "Serviço":**
  - "Qual serviço / veículo?";
  - "Quantas horas de serviço?", com "Mão de obra: R$ …" embaixo, que só aparece quando há horas;
  - link "Prefiro digitar o valor fechado" (valor com R$ e horas opcionais).
- **Card "Peças":**
  - "Peças – quanto você paga" (R$);
  - "Quanto você põe em cima da peça" (%), que começa com o acréscimo padrão de Ajustes e pode ser mudado só naquele orçamento;
  - embaixo, "Cliente paga pelas peças: R$ 735,00";
  - link "Prefiro digitar o valor das peças", que troca para o valor direto (o link de volta é "Prefiro usar o acréscimo (%)").
- **Resultados:**
  - **card à vista**, com detalhe laranja à esquerda;
  - **card de cartão:**
    - chips "Não sei · Visa/Master · Elo…" (só com 2 ou mais cartões), com a ajuda "Não sabe o cartão do cliente? Deixe em 'Não sei': o preço cobre qualquer bandeira.";
    - parcelas em destaque, em blocos leves: "5× de R$ X" e "Total R$ Y". O 1x mostra só o total;
    - "Ver outras formas de pagamento", sem repetir as parcelas em destaque.
  - **card de lucro:** valor verde (vermelho com "Esse preço não cobre seus gastos do mês"). Em "Ver detalhes":
    - Mão de obra;
    - "Gasto das suas 8 horas: − R$ 430,77" (nenhuma multiplicação visível);
    - Lucro nas peças;
    - Imposto.
  - **botões:** "Copiar para WhatsApp" (verde, ícone de balão), "Compartilhar" (fantasma) e "Novo orçamento" (fantasma).
  - Sem valor: a dica "Preencha as horas (ou o valor) e as peças para ver o preço."

**Texto do WhatsApp:**
```
*Orçamento – {nomeOficina}*          (ou *Orçamento* sem nome)
{serviço/veículo}

Mão de obra: R$ …
Peças: R$ …

💵 À vista (Pix/dinheiro): *R$ …*
💳 Cartão em até 5x: R$ … (5x de R$ …)
💳 Cartão em até 10x: R$ … (10x de R$ …)
```
- Com um cartão **escolhido** (2 ou mais cartões cadastrados), a linha vira "💳 Cartão Cabal em até 5x: …". Com "Não sei", ou com um único cartão, não há nome.
- O texto **sempre fecha com o à vista, no centavo** (`valoresWhatsApp`): peças = à vista − mão de obra arredondada.
- Sem custo, lucro, taxa nem acréscimo.

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

## 7. Casos de teste (igualdade exata em centavos)

Ficam no próprio `Index.html` (`casosDeTeste()`). Rodam no app com `?teste=1` e em Node. Resultados em `docs/testes-calculo.md`.

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
| W1–W4 | Texto do WhatsApp | fecha com o à vista no centavo; negrito; acréscimo não aparece |

Os casos C4 (leitura), C6 e C7 são testes do **backend** (Node, com a planilha simulada). Os demais são do bloco de cálculo do frontend.

Se algum caso divergir, a fórmula **não** é ajustada para forçar o número: a divergência é reportada.

## 8. Deploy

- **Repositório:** privado, no GitHub do dono do projeto. Só ele faz `git push`; aqui só há commits locais.
- **Automático:** a cada push na `main` que altere `src/**`, ou manualmente por `workflow_dispatch`, o workflow `.github/workflows/deploy.yml` roda.
  - Ambiente: `ubuntu-latest`, Node LTS e `@google/clasp@3.4.1` fixado.
  - Passos: `clasp push --force` e depois `clasp deploy --deploymentId $DEPLOYMENT_ID --description "<sha curto> – <título do commit até 60 caracteres>"`.
  - O deploy cria uma versão nova e atualiza a implantação existente, mantendo a mesma URL `/exec`.
  - `concurrency` impede dois deploys ao mesmo tempo.
- **Versões fixadas e comprovadas** (releases oficiais, 07/11/2026): `actions/checkout@v7` (v7.0.1, 20/07/2026) e `actions/setup-node@v7` (v7.1.0, 08/10/2026).
- **O `clasp login` local precisa usar a mesma versão do workflow (3.4.1):** o formato do `.clasprc.json` mudou no clasp 3.
- **Secrets:** `CLASPRC_JSON`, `SCRIPT_ID` e `DEPLOYMENT_ID`.
  - O `.clasp.json` é gerado na hora (`rootDir: "src"`).
  - As credenciais são gravadas com `umask 077`, nunca aparecem no log e são apagadas no fim.
- **Envio:** o `push` manda exatamente `src/Codigo.gs`, `src/Index.html` e `src/appsscript.json`. O primeiro push substitui o "Código.gs" colado à mão.
- **Teste antes de publicar:** URL `/dev` (Implantar → Testar implantações).
- **Migração para a conta do mecânico:** novo `clasp login` e substituição dos 3 secrets.
- Passo a passo: `docs/DEPLOY.md`.

## 9. Fatias
1. Desenho ✅
2. Backend: `src/Codigo.gs` e `src/appsscript.json` ✅
3. Frontend: `src/Index.html` ✅
   - Parte 2: novo visual, acréscimo nas peças e cartões cadastráveis (aguardando aprovação)
4. Testes de cálculo: autoteste completo (T14, T15) e `docs/testes-calculo.md`
5. Documentação: `docs/LEIAME-instalacao.md` (o `GUIA-DO-USUARIO.md` já existe)

Cada fatia termina com uma parada para revisão. O commit local só é feito depois da aprovação.
