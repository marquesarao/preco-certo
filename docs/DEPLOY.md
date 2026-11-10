# Publicação e instalação (GitHub Pages + Apps Script como API)

Mesmo modelo do app **Pendências**:

- **Tela** (HTML/CSS/JS) no **GitHub Pages**: você dá `git push` e o GitHub publica sozinho.
  - Repositório **público** `marquesarao/preco-certo`.
  - Endereço do app: **https://marquesarao.github.io/preco-certo/**
- **Apps Script vinculado a cada planilha**, funcionando só como **API** (lê e grava a planilha). Ele é colado à mão, **uma vez em cada planilha**: a sua planilha de teste e a do mecânico.
- **Um único app para todos.** Cada **aparelho** fica ligado à planilha do seu dono por um **link de configuração**.

> Os comandos e passos abaixo são para **você** fazer. Nada aqui roda sozinho.

> ### ⚠️ Regra de ouro: **o backend vai nas DUAS planilhas ANTES do `git push`.**
> **Cole o `Codigo.gs` na planilha de teste E na do André → Implantar → Gerenciar implantações → lápis → Versão: _Nova versão_ → Implantar → rode `testarApi`. Só depois dê o `git push`.**
> Colar o código e salvar **não basta**: sem _Nova versão_, o endereço /exec continua rodando o código antigo.
>
> **Como confirmar que a planilha está na versão certa:** a **primeira linha** do registro do `testarApi` diz a versão, por exemplo:
> `Preço Certo – código da API versão 5 · esquema 4 (colunas até "Horas por serviço")`.
> Ela precisa bater com a versão deste pacote, e o `testarApi` precisa terminar com "Todos os testes da API passaram". Os itens da versão aparecem no registro (ex.: "as respostas trazem apiVersao 4", "colunas AB–AG preenchidas…").
> Rode o `testarApi` pelo editor **depois** de criar a Nova versão; ele roda o código salvo no editor. Para conferir o /exec de verdade, abra o app: se a planilha estiver antiga, aparece a faixa **"A planilha está com uma versão antiga. Atualize o código da planilha antes de salvar."** e o app **não salva** orçamentos.
>
> **Desde o esquema 4 há uma trava:** o app novo só salva, muda a situação ou numera orçamentos se a planilha responder com a `apiVersao` que ele exige (hoje: **5**). Se você inverter a ordem, o app avisa e não perde nada (antes da trava, um backend antigo descartava em silêncio os campos novos, como o veículo e a lista de serviços).

---

## ⚠️ Onda do PDF (orçamento em PDF, número do orçamento, dados da oficina, WhatsApp do cliente): o backend MUDOU — versão 5

Vale para quem já está no esquema 4. **Se o esquema 4 ainda não foi publicado numa planilha, este `Codigo.gs` já contém tudo:** um deploy só.

1. **Em cada planilha** (a de teste **e** a do André): Extensões → Apps Script → **copie a sua `URL_DA_API`** → cole o `apps-script/Codigo.gs` novo → recoloque a `URL_DA_API` → salve → **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** → rode **`testarApi`**.
   - A **1ª linha** do registro deve ser: **`Preço Certo – código da API versão 5 · esquema 4 (colunas até "Horas por serviço")`**, e o final: "Todos os testes da API passaram".
   - O `testarApi` agora também confere o número do orçamento ("o orçamento novo ganha número…", "salvar de novo mantém o número"). O orçamento de teste usa um número e, no fim, **a numeração volta a ser como era** (não pula número).
   - **Se aparecer pedido de autorização novo:** **pare** e me avise (o `appsscript.json` não mudou).
   - Nada muda de lugar na planilha. A aba **Parâmetros** ganha as linhas novas (dados da oficina, validade, observações, exibição no PDF, próximo número) na primeira vez que alguém salvar os Ajustes; até lá valem os padrões. A coluna **AA "Número do orçamento"** passa a ser preenchida.
2. **Só depois, nas DUAS planilhas:** conferência de segredos e **`git push`** (`sw.js` v17; arquivos novos: `js/pdf.js` e `js/vendor/jspdf.umd.min.js` + `js/vendor/jspdf.LICENSE.txt`).
   - Se inverter: o app novo mostra a faixa "A planilha está com uma versão antiga…" e **não salva** orçamentos nem gera PDF até a planilha ser atualizada (nada se perde).
3. Em cada aparelho: "Nova versão disponível · ATUALIZAR".
4. **Antes do primeiro orçamento novo do André:** em **Ajustes → Dados da oficina**, preencha os dados (CNPJ, telefone, endereço, cidade, chave Pix…) e o **"Próximo número do orçamento"** para continuar a numeração do sistema antigo (ex.: 186). Se ficar em 1, o primeiro orçamento vira "1-2026" (e o número só pode aumentar depois).

---

## ⚠️ Esquema 4 (trava de versão + colunas AA–AG): o backend MUDOU — ordem obrigatória

Vale para quem já está na seção 17 (esquema 3). Se a seção 17 ainda não foi publicada numa planilha, este `Codigo.gs` já contém tudo: um deploy só.

1. **Em cada planilha** (a de teste **e** a do André): Extensões → Apps Script → **copie a sua `URL_DA_API`** → cole o `apps-script/Codigo.gs` novo → recoloque a `URL_DA_API` → salve → **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** → rode **`testarApi`**.
   - A 1ª linha do registro deve ser: **`Preço Certo – código da API versão 4 · esquema 4 (colunas até "Horas por serviço")`**, e o final: "Todos os testes da API passaram".
   - **Se aparecer pedido de autorização novo:** **pare** e me avise (o `appsscript.json` não mudou).
   - O primeiro pedido depois de colar o código atualiza o esquema (versão 4), **uma vez só**:
     - acrescenta, **depois da Z**, as colunas **AA "Número do orçamento"** (reservada, fica vazia até a onda do PDF), **AB Placa · AC Modelo · AD Ano · AE Combustível · AF Serviços da oficina · AG Horas por serviço**. Nada muda de lugar;
     - **preenche AA–AG de todos os orçamentos que já existem**, a partir dos dados de cada um. Os orçamentos de antes da seção 17 ficam com o veículo vazio; o serviço é a descrição antiga;
     - a proteção "somente aviso" já cobre a aba inteira, inclusive as colunas novas.
   - Essas colunas são **só para ler na planilha**: o app continua usando os dados da coluna V. Editar AB–AG à mão não muda o orçamento (e o próximo salvamento regrava).
2. **Só depois, nas DUAS planilhas:** conferência de segredos e **`git push`** (`sw.js` v15).
   - Se inverter: o app novo mostra a faixa "A planilha está com uma versão antiga…" e **não salva** orçamentos até a planilha ser atualizada (nada se perde; o que está na tela fica no aparelho). Depois de atualizar a planilha, o próximo "Salvar" já funciona, sem recarregar.
3. Em cada aparelho: "Nova versão disponível · ATUALIZAR".

---

## ⚠️ Seção 17 (vários serviços, veículo em campos, WhatsApp separado): o backend MUDOU — ordem obrigatória

Vale para quem já está no pacote 16 + adendo (esquema 2). **Se o pacote 16 ainda não foi publicado**, publique tudo junto com um deploy só deste `Codigo.gs` final, que já contém o pacote 16. Os avisos do pacote 16 (impostos em Ajustes) continuam valendo.

1. **Em cada planilha** (a de teste **e** a do André): Extensões → Apps Script → **copie a sua `URL_DA_API`** → cole o `apps-script/Codigo.gs` novo → recoloque a `URL_DA_API` → salve → **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** → rode **`testarApi`** (deve terminar com "Todos os testes da API passaram"; ele agora também confere o veículo, os serviços e os itens da busca).
   - **Se aparecer pedido de autorização novo:** **pare** e me avise (não era para aparecer; o `appsscript.json` não mudou).
   - O primeiro pedido depois de colar o código atualiza o esquema (versão 3), **uma vez só**:
     - acrescenta a coluna **Z "Itens"** na aba Orçamentos (nada muda de lugar);
     - **preenche a coluna Z de todos os orçamentos que já existem**, a partir dos dados de cada um (descrição antiga, parceiros e peças), para a busca achar também os antigos. É uma leitura e uma escrita só; numa planilha com muitos orçamentos, esse primeiro pedido pode levar alguns segundos a mais.
2. **Só depois, nas DUAS planilhas:** conferência de segredos e **`git push`** (`sw.js` v13).
   - **Não inverta a ordem:** se o app novo salvar um orçamento com o backend antigo, a lista de serviços e o veículo **se perdem** (o backend antigo descarta campos que não conhece). O total continua certo, porque o app grava também os campos antigos com o total.
3. Em cada aparelho: "Nova versão disponível · ATUALIZAR".
   - Até atualizar, o aparelho antigo continua funcionando. Se ele abrir um orçamento novo, mostra um serviço só com o total (mesmos números). Se salvar esse orçamento, a lista de serviços vira uma linha só com o texto "placa · modelo · 1º serviço (+N)".

---

## ⚠️ Pacote 16 + adendo dos descontos: o backend MUDOU — UM deploy só, ordem obrigatória

Dois commits locais: o pacote 16 (% por peça, serviços de terceiros, entrada + cartão, imposto separado) e logo depois o adendo dos descontos (serviço × peças). **Os dois são publicados juntos**, com **um único** deploy do `Codigo.gs` (o do commit do adendo, o final) nas duas planilhas. Não publique o pacote 16 sozinho.

1. **Em cada planilha** (a de teste e a do André): Extensões → Apps Script → **copie a sua `URL_DA_API`** → cole o `apps-script/Codigo.gs` FINAL → recoloque a `URL_DA_API` → salve → **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** → rode **`testarApi`** (deve terminar com "Todos os testes da API passaram").
   - **Se aparecer pedido de autorização novo:** **pare** e me avise (não era para aparecer; o `appsscript.json` não mudou).
   - O primeiro pedido depois de colar o código atualiza o esquema (versão 2):
     - acrescenta as colunas **W–Y** na aba Orçamentos ("Terceiros pagos | Entrada | Forma da entrada"), sem mudar nenhuma coluna de lugar;
     - os parâmetros novos **não** são criados nas planilhas que já existem: os dois impostos valem o imposto antigo, e o desconto das peças vale o desconto à vista, até a tela nova salvar os Ajustes;
     - numa planilha **nova**, as linhas `impostoPecasPercentual` e `impostoServicoPercentual` já nascem com 0 e `descontoPecasPadrao` nasce com 5.
   - A linha `impostoPercentual` continua na aba como **legado**: a tela antiga ainda usa essa chave e a tela nova grava nela o imposto do serviço. Ela não vale quando as linhas novas existem.
2. **Só depois:** conferência de segredos e **`git push`** dos dois commits juntos (`sw.js` v12).
3. Em cada aparelho: "Nova versão disponível · ATUALIZAR". **Depois de atualizar, confira em Ajustes os dois impostos** (vêm iguais ao imposto antigo) e ajuste com o contador.
   - Até atualizar, o aparelho antigo continua funcionando com um imposto só e sem terceiros nem entrada.
   - Se o aparelho antigo salvar gastos ou ajustes, os impostos novos já salvos **não** mudam.

**Versões do Apps Script:** este deploy usa **uma** "Nova versão" em cada planilha (limite de 200 por script).

---

## ⚠️ Desempenho (`sw.js` v9): o backend MUDOU — ordem obrigatória

Esta versão muda **as duas pontas**: o `apps-script/Codigo.gs` (cache dos gastos e ajustes, configuração das abas só quando precisa, lock só nas gravações, `onEdit`) e a tela (`sw.js` v9). Mesma ordem de sempre:

1. **Em cada planilha** (a de teste e a do mecânico): Extensões → Apps Script → **copie a sua `URL_DA_API`** → cole o `apps-script/Codigo.gs` novo → recoloque a `URL_DA_API` → salve → **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar** → rode **`testarApi`**. O registro deve terminar com "Todos os testes da API passaram". Ele agora confere também o cache e a versão do esquema, **sem apagar nenhuma aba**.
   - **Se aparecer pedido de autorização novo** ao rodar o `testarApi`: **pare** e me avise (não era para aparecer: o cache não pede permissão nova; o `appsscript.json` não mudou).
   - O `onEdit` é um **gatilho simples**: funciona sozinho, não precisa instalar nada em "Acionadores".
   - A primeira chamada depois de colar o código configura as abas (como antes) e grava a versão do esquema; as seguintes não configuram mais.
2. **Só depois:** conferência de segredos e **`git push`**.
3. Em cada aparelho: "Nova versão disponível · ATUALIZAR".

**Versões do Apps Script:** cada "Nova versão" conta no limite de **200 versões por script**. Crie versão só para publicar de verdade; para medir com o `Codigo-DIAGNOSTICO.gs` na planilha de teste, use a mesma implantação e volte o código normal depois (sem criar versões a mais do que o necessário).

Se fizer ao contrário (tela antes do backend): a tela nova funciona com o backend antigo, só que continua lenta, o "Recarregar da planilha" vira uma leitura normal e **a linha do mês atual na aba Meses deixa de se atualizar sozinha** (agora quem faz isso é o backend novo) até você colar o `Codigo.gs` novo. Por isso: backend primeiro.

---

## Identidade do PWA (`sw.js` v7): só a tela muda — e quem já instalou precisa reinstalar

- O `manifest.webmanifest` tinha `"id": "./"`, que o Chrome resolve contra a **origem** (`https://marquesarao.github.io/`): o mesmo id do app Pendências. Agora é `"id": "/preco-certo/"` → `https://marquesarao.github.io/preco-certo/`. O `Codigo.gs` não muda.
- Publicar: conferência de segredos e **`git push`** (a `VERSAO` do `sw.js` já está em `v7`).
- **Em cada aparelho que já tinha o Preço Certo instalado** (e o Pendências), uma vez só:
  1. **Desinstale o Preço Certo** (celular: segure o ícone → "Desinstalar"/"Remover"; computador: abra o app → 3 pontinhos (⋮) → "Desinstalar Preço Certo").
  2. Se aparecer a opção **"Também limpar dados do Chrome"** (ou parecida), **NÃO marque**: o Preço Certo e o Pendências usam o mesmo armazenamento do site, e marcar apaga a ligação e os dados guardados dos **dois** apps.
  3. Abra o app de novo pelo link de sempre (`https://marquesarao.github.io/preco-certo/`) e **instale de novo** (como acima).
  4. Se o **Pendências** instalado estiver com o nome ou o ícone do Preço Certo: abra o Pendências com internet; o Chrome pode corrigir sozinho (às vezes pede para confirmar a troca de nome e ícone, e pode levar um dia). Se não corrigir, desinstale e reinstale o Pendências também, do mesmo jeito (**sem** limpar dados).
- Nada muda no repositório nem na pasta do Pendências.

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
