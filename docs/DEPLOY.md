# Publicação e instalação (GitHub Pages + Apps Script como API)

Mesmo modelo do app **Pendências**:

- **Tela** (HTML/CSS/JS) no **GitHub Pages**: você dá `git push` e o GitHub publica sozinho.
  - Repositório **público** `marquesarao/preco-certo`.
  - Endereço do app: **https://marquesarao.github.io/preco-certo/**
- **Apps Script vinculado a cada planilha**, funcionando só como **API** (lê e grava a planilha). Ele é colado à mão, **uma vez em cada planilha**: a sua planilha de teste e a do mecânico.
- **Um único app para todos.** Cada **aparelho** fica ligado à planilha do seu dono por um **link de configuração**.

> Os comandos e passos abaixo são para **você** fazer. Nada aqui roda sozinho.

---

## Fase 11 (tela mais simples + mês atual automático): só a tela muda

- O `apps-script/Codigo.gs` **não mudou** desde a fase 10. Não precisa colar nada nem criar "Nova versão".
- A tela nova usa as ações da fase 10 (`listarOrcamentos` e `usarGastosDeHojeNoMes`). **Se a fase 10 ainda não foi publicada**, faça primeiro o passo 1 da seção da fase 10 (abaixo) em cada planilha; só depois o `git push`.
- Fase 10 já publicada: conferência de segredos e **`git push`**. A `VERSAO` do `sw.js` já está em `v6`. Em cada aparelho: **"Nova versão disponível · ATUALIZAR"**.
- O que muda na planilha: a aba **Meses** passa a ter a linha do mês atual atualizada sozinha sempre que os gastos mudam (e ao abrir Resultados). Nessas linhas, a coluna "Origem" aparece como **"Usar meus gastos de hoje"** (texto do backend da fase 10).

---

## ⚠️ Fase 10 (orçamentos salvos + Resultados): o backend MUDOU — ordem obrigatória

Esta versão muda **as duas pontas**: o `apps-script/Codigo.gs` (ações novas de orçamento, abas `Orçamentos` e `Meses`, desconto padrão na aba `Parâmetros`) e a tela (`sw.js` v5).
A tela nova chama ações que só o backend novo conhece. Por isso, **nesta ordem**:

1. **Em cada planilha** (a sua de teste e a do mecânico):
   1. Extensões → Apps Script;
   2. **copie a sua `URL_DA_API`** (a linha do topo do `Codigo.gs`) para um lugar seguro;
   3. apague o conteúdo do arquivo de código e cole o **`apps-script/Codigo.gs` novo**;
   4. recoloque a sua `URL_DA_API` e **salve** (Ctrl+S);
   5. **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** (a URL continua a mesma; os aparelhos não precisam de nada);
   6. no seletor de funções, escolha **`testarApi`** e clique em **Executar**. O registro deve terminar com **"Todos os testes da API passaram (o orçamento de teste foi apagado)."** Ele cria um orçamento de teste (cliente "TESTE testarApi", fechado em 01/2000) e o apaga no fim, junto com a linha "2000-01" da aba Meses.
   - Na primeira chamada, aparecem as abas **`Orçamentos`** e **`Meses`**, com um aviso ao editar à mão ("Use o app para alterar orçamentos…"). **Não edite essas abas à mão**: apagar uma linha = excluir o orçamento.
   - O `appsscript.json` **não mudou** (o escopo continua só "esta planilha"). Não deve aparecer pedido de autorização novo.
2. **Só depois**, publique a tela: conferência de segredos (abaixo) e **`git push`**. A `VERSAO` do `sw.js` já está em `v5`.
3. Em cada aparelho: **"Nova versão disponível · ATUALIZAR"**. Na primeira abertura, o desconto à vista padrão que estava no aparelho vai para a planilha (o primeiro aparelho a abrir vence; o outro recebe o aviso "O desconto padrão agora vem da planilha: X%.").

Se fizer ao contrário (tela antes do backend), "Salvar orçamento" e "Resultados" mostram "Ação desconhecida." até o backend ser atualizado. Já a tela antiga continua funcionando com o backend novo (inclusive salvando gastos e ajustes).

---

## Antes de cada `git push`: nada sensível no repositório

O repositório é **público**. Nunca podem ir para ele:

- o **token** (64 letras e números; fica nas Propriedades do script e no aparelho);
- a **URL `/exec`** de uma implantação real (`https://script.google.com/macros/s/AKfy…/exec`);
- um **link de configuração** (`…#cfg=…`);
- o endereço ou o ID de uma planilha;
- prints com qualquer um desses dados.

No código, `apps-script/Codigo.gs` vai com `URL_DA_API = ''` (vazia). Você preenche **só no editor do Apps Script de cada planilha**, nunca no arquivo do repositório.

Conferência rápida antes do push, no PowerShell, na pasta do projeto. **Os dois comandos devem voltar vazios:**

```powershell
git add -A
git grep --cached -nE "macros/s/[A-Za-z0-9_-]{20,}"   # alguma URL /exec real?
git grep --cached -nE "#cfg=[A-Za-z0-9_-]{40,}"       # algum link de configuração?
```

Se algum mostrar uma linha, **não faça o push**: tire o valor do arquivo, rode `git add -A` de novo e repita.

---

## a) Criar o repositório público e fazer o primeiro push

1. No GitHub: **New repository**.
   - Nome: **`preco-certo`**.
   - **Public** (o GitHub Pages gratuito exige repositório público, como no Pendências).
   - **Não** marque README, .gitignore nem licença.
2. No PowerShell, na pasta do projeto:

```powershell
cd "C:\Users\leand\OneDrive\Pessoal\APP-Andre"
git remote add origin https://github.com/marquesarao/preco-certo.git
git push -u origin main
```

## b) Ligar o GitHub Pages

1. Repositório → **Settings** → **Pages** (menu lateral, em "Code and automation").
2. **Build and deployment → Source: Deploy from a branch**.
3. **Branch: `main`**, pasta **`/ (root)`** → **Save**.

**A primeira publicação leva alguns minutos** (às vezes 5 a 10). Até lá, o endereço pode mostrar "404". Não quebrou: é só esperar.

Como saber que publicou:
- aba **Actions**: o fluxo **"pages build and deployment"** fica com ✓ verde;
- em **Settings → Pages** aparece "Your site is live at **https://marquesarao.github.io/preco-certo/**".

Abra o endereço no Chrome. Sem configuração, o app mostra "Este aparelho ainda não está ligado a uma planilha" (é o esperado).

> O arquivo `.nojekyll` (vazio) faz o Pages servir os arquivos como estão.

## c) Em cada planilha: colar a API e implantar

Faça isto **na sua planilha de teste** e depois **na planilha do mecânico** (na conta Google dele).

1. Abra a planilha → **Extensões → Apps Script**.
2. **Código:** apague o que houver no arquivo de código (ex.: o antigo "Código.gs", que também tinha a tela) e cole o conteúdo de **`apps-script/Codigo.gs`**.
   - Se houver um arquivo **`Index.html`** antigo no projeto, **apague** (a tela agora fica no Pages).
3. **Manifesto:** ⚙️ **Configurações do projeto** → marque **"Mostrar arquivo de manifesto 'appsscript.json' no editor"** → abra o `appsscript.json` e cole o conteúdo de **`apps-script/appsscript.json`**.
4. Confira no topo do `Codigo.gs`: `URL_DO_APP = 'https://marquesarao.github.io/preco-certo/'` (já vem preenchida).
5. **Salve** (Ctrl+S).
6. **Implantar:**
   - Primeira vez: **Implantar → Nova implantação** → engrenagem → **App da Web**.
     - **Executar como: Eu**
     - **Quem pode acessar: Qualquer pessoa**
     - → **Implantar**.
   - Se já existia uma implantação (do app antigo): **Implantar → Gerenciar implantações** → lápis → **Versão: Nova versão** → confirme **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa** → **Implantar**. A URL continua a mesma.
7. **Autorize** quando pedir. Na tela "O Google não verificou este app": **Avançado → Acessar (não seguro)** → **Permitir**. O app só pede acesso a **esta** planilha.
8. Copie a **URL do app da Web**, que termina em **`/exec`**.
9. Cole essa URL na constante **`URL_DA_API`** no topo do `Codigo.gs` **do editor** e salve. (Mudar só essa constante não exige nova versão: ela é usada pela função manual do passo d.)

> Por que "Qualquer pessoa": o app chama a URL sem login do Google. Quem protege os dados é o **token**. Sem ele, toda chamada recebe `{"ok": false, "erro": "Acesso não autorizado"}`, e a planilha nem é lida.

## d) Gerar o link de configuração e ligar o aparelho

1. No editor do Apps Script, escolha a função **`gerarLinkDeConfiguracao`** no seletor e clique em **Executar**.
2. Abra o **Registro de execução**. Aparece o **link de configuração**: copie a linha inteira.
   - Se aparecer um aviso ⚠️ (ex.: "Preencha URL_DA_API…"), corrija a constante, salve e rode de novo.
   - Rodar de novo **não** troca o token: o link continua o mesmo, e os aparelhos já ligados continuam funcionando.
3. **No seu aparelho:** abra o link no Chrome. Deve aparecer **"Aparelho conectado à planilha ✓"**. O endereço é limpo sozinho (o token sai da barra de endereço).
4. **No celular do mecânico:**
   1. mande o link **para ele, pelo WhatsApp**;
   2. ele toca no link e abre no **Chrome**;
   3. confira que apareceu "Aparelho conectado à planilha ✓";
   4. **depois, apague a mensagem com o link, dos dois lados** ("Apagar para todos"). Ela dá acesso à planilha.
5. Instale o app:
   - no celular: Chrome → **"Instalar app"** (ou ⋮ → "Adicionar à tela inicial");
   - no notebook: ícone de instalar na barra de endereço, ou ⋮ → **"Instalar Preço Certo"**.
   - O ícone é o logo da CliniCar.

Para conferir a API sem o app: rode **`testarApi`** no editor. O registro mostra "✓" para cada verificação e não altera os dados: regrava os mesmos gastos e ajustes e apaga o orçamento de teste que ele cria.

## e) Quando o backend mudar (`apps-script/Codigo.gs` ou `appsscript.json`)

Em **cada planilha** (a sua e a do mecânico):
1. Extensões → Apps Script → cole o `Codigo.gs` novo.
2. **Mantenha** o valor da sua `URL_DA_API`: copie antes de colar o arquivo novo e recoloque depois.
3. Salve → **Implantar → Gerenciar implantações** → lápis → **Versão: Nova versão** → **Implantar**. A URL continua a mesma, e os aparelhos não precisam de nada.

Se a mudança for nas duas pontas (API e tela), atualize o Apps Script **antes** do `git push`.

## f) Quando só a tela mudar

1. **Aumente a versão** em `sw.js`: `const VERSAO = 'v1';` → `'v2'` (depois `'v3'`…). É isso que faz os aparelhos baixarem a versão nova.
2. Faça a conferência de segredos (início deste documento) e dê o `git push`.
3. Em 1 a 2 minutos o Pages publica. Ao abrir, o app mostra **"Nova versão disponível · ATUALIZAR"**. Ao tocar, ele recarrega já na versão nova (aparece em **engrenagem (⚙) → Ajustes → Este aparelho → Versão do app**).

Se trocar os ícones: rode `tools/gerar-icones.ps1` (veja `tools/LEIA-ME.md`) e suba a versão do `sw.js`.

## g) Segurança

- **O link de configuração dá acesso aos dados daquela planilha.** Mande só para o dono. Depois de configurar o aparelho, **apague a mensagem**.
- **Se o link vazar** (ou um celular for perdido):
  1. no editor do Apps Script daquela planilha, rode **`trocarToken`**. Todos os aparelhos ligados a ela perdem o acesso na hora e passam a mostrar "Este aparelho perdeu o acesso à planilha";
  2. rode **`gerarLinkDeConfiguracao`** e abra o **link novo** em cada aparelho que deve continuar usando o app.
- O token fica só em dois lugares:
  - nas **Propriedades do script** (⚙️ Configurações do projeto → Propriedades do script → `TOKEN`);
  - no armazenamento do navegador de cada aparelho.
- A parte do link depois do `#` **não é enviada a nenhum servidor** (nem ao GitHub Pages, nem à prévia de link do WhatsApp).
- No aparelho, **engrenagem (⚙) → Ajustes → Este aparelho → Desconectar este aparelho** apaga a ligação, os dados guardados e o PIN daquele aparelho. Os orçamentos salvos ficam na planilha. A planilha não é afetada. Com PIN ligado e esquecido: **Esqueci o PIN → Desconectar este aparelho** e abrir o link de configuração de novo.
- As funções `gerarLinkDeConfiguracao`, `trocarToken` e `testarApi` são públicas no editor, mas **não podem ser chamadas pela internet**: a única entrada externa é a API, que só aceita as ações `obterDados`, `salvarDados`, `obterTaxasPadraoVisa`, `listarOrcamentos`, `obterOrcamento`, `salvarOrcamento`, `mudarSituacao`, `excluirOrcamento` e `usarGastosDeHojeNoMes`.
- Os orçamentos salvos guardam **nome e telefone de clientes** na planilha do mecânico. Eles ficam protegidos pelo mesmo token; nada disso vai para o repositório.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| App mostra "Resposta inesperada da planilha" | Implantação com acesso diferente de "Qualquer pessoa", ou URL `/dev` no lugar de `/exec` |
| "Este aparelho perdeu o acesso à planilha" | O token foi trocado (`trocarToken`). Gere e abra um link novo |
| "O link de configuração está incompleto…" | O link foi cortado ao copiar. Copie a linha inteira do Registro de execução |
| Endereço do Pages dá 404 | A primeira publicação ainda não terminou (espere alguns minutos) ou Pages não está ligado (item b) |
| Versão nova não aparece | Esqueceu de subir a `VERSAO` no `sw.js` antes do push |
| "Ação desconhecida." ao salvar orçamento ou abrir Resultados | A tela nova foi publicada antes do `Codigo.gs` novo. Faça a fase 10, passo 1, nesta planilha |
| "Esse orçamento foi alterado em outro aparelho." | Outra pessoa salvou o mesmo orçamento antes. Escolha "Ver a versão nova" ou "Salvar as minhas como um novo orçamento" |
