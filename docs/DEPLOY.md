# Deploy automático (GitHub Actions + clasp)

A cada `git push` na branch `main` que altere algo em `src/`, o workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) faz duas coisas:

1. **`clasp push --force`**: envia `src/Codigo.gs`, `src/Index.html` e `src/appsscript.json` para o projeto Apps Script.
2. **`clasp deploy --deploymentId … --description …`**: cria uma versão nova e atualiza a **implantação existente**. A URL `/exec` continua a mesma.

A descrição da versão fica `<sha curto> – <1ª linha do commit, até 60 caracteres>`, por exemplo `452f361 – Fatia 3: frontend (Index.html) com identidade CliniCar`.

**Versões fixadas** (conferidas em 07/11/2026):

| Item | Versão | Evidência |
|---|---|---|
| `@google/clasp` | 3.4.1 (major 3) | `npm view @google/clasp version` → 3.4.1 (tag `latest`). Flags conferidas no `--help`: `push -f/--force`, `deploy -i/--deploymentId`, `deploy -d/--description` |
| `actions/checkout` | `@v7` | última versão estável: v7.0.1, publicada em 20/07/2026 — https://github.com/actions/checkout/releases/tag/v7.0.1 |
| `actions/setup-node` | `@v7` | última versão estável: v7.1.0, publicada em 08/10/2026 — https://github.com/actions/setup-node/releases/tag/v7.1.0 |

> **O `clasp login` local precisa usar a mesma versão do workflow (3.4.1).** Veja o item c.

> Os comandos abaixo são para **você** rodar. Nada aqui é executado automaticamente fora do GitHub Actions.

---

## a) Criar o repositório privado e ligar o repositório local

1. No GitHub: **New repository**.
   - Nome sugerido: `preco-certo`.
   - **Private**.
   - **Não** marque README, .gitignore nem licença: o repositório precisa nascer vazio.
2. No terminal, dentro da pasta do projeto:

```bash
git remote add origin https://github.com/<seu-usuario>/preco-certo.git
git push -u origin main
```

O primeiro push dispara o workflow, mas ele vai falhar em "Conferir secrets" até você criar os 3 secrets (itens d e e). É o esperado.

## b) Ativar a Apps Script API

1. Abra https://script.google.com/home/usersettings, logado na **conta Google dona da planilha**.
2. Ligue **"API do Google Apps Script"**.

Sem isso, o `clasp push` falha com uma mensagem sobre a API desativada. O workflow avisa qual é o problema.

## c) Instalar o clasp e fazer login (uma vez, no seu computador)

> ⚠️ **IMPORTANTE: faça o `clasp login` local com a MESMA versão usada no workflow (`@google/clasp@3.4.1`).**
> O formato do `.clasprc.json` mudou no clasp 3. Um arquivo gerado por outra versão (por exemplo, o clasp 2) pode não funcionar no GitHub Actions. Confira com `clasp --version` antes do login: tem de aparecer `3.4.1`.
> Se um dia o workflow mudar de versão (`CLASP_VERSION` no `deploy.yml`), refaça o login local com a nova versão e atualize o secret `CLASPRC_JSON`.

```bash
npm install -g @google/clasp@3.4.1
clasp --version        # deve mostrar 3.4.1
clasp login
```

O `clasp login` abre o navegador. Entre com a **conta dona da planilha** e autorize.

## d) Copiar o `.clasprc.json` para o secret `CLASPRC_JSON`

- O login grava as credenciais em:
  - **Windows:** `%USERPROFILE%\.clasprc.json` (por exemplo, `C:\Users\leand\.clasprc.json`);
  - **macOS/Linux:** `~/.clasprc.json`.
- Abra o arquivo no Bloco de Notas, selecione **tudo** (Ctrl+A) e copie.
- Não mostre esse conteúdo a ninguém, não cole em chat e não commite (veja o item g).

## e) Achar `SCRIPT_ID` e `DEPLOYMENT_ID` e criar os 3 secrets

| Secret | Onde achar |
|---|---|
| `CLASPRC_JSON` | conteúdo inteiro do `.clasprc.json` (item d) |
| `SCRIPT_ID` | Planilha → Extensões → Apps Script → ⚙️ **Configurações do projeto** → **ID do script** |
| `DEPLOYMENT_ID` | No editor do Apps Script: **Implantar → Gerenciar implantações** → selecione a implantação "App da Web" → **ID da implantação** (começa com `AKfy…`) |

Para criar cada secret: no GitHub, abra o repositório → **Settings → Secrets and variables → Actions → New repository secret**. O nome deve ser exatamente o da tabela, e o valor é colado sem espaços nem linhas a mais.

> O `DEPLOYMENT_ID` precisa ser o da implantação **App da Web** que você já usa, aquela cuja URL termina em `/exec`. Não use o ID da implantação de teste (`/dev`).

## f) Rodar manualmente e ver o log

- **Rodar à mão:** repositório no GitHub → **Actions** → **Deploy Apps Script** → **Run workflow** → branch `main` → **Run workflow**.
- **Ver o log:** em Actions, clique na execução e depois no job **deploy**. Cada passo abre o seu log. O resumo final mostra a versão publicada.
- **Erros já tratados** (aparecem em vermelho, com o que fazer):
  - secrets ausentes;
  - `CLASPRC_JSON` inválido;
  - credencial expirada ("refaça clasp login e atualize o secret CLASPRC_JSON");
  - API desativada;
  - `SCRIPT_ID` errado;
  - `DEPLOYMENT_ID` errado.

## g) Segurança

- O `CLASPRC_JSON` contém um **token de acesso aos projetos Apps Script da conta Google** que fez o `clasp login`. Trate como senha.
- **Nunca** commite `.clasprc.json` nem `.clasp.json`. Os dois estão no `.gitignore`.
- O workflow grava a credencial com permissão restrita (`umask 077`), não mostra o conteúdo no log e apaga o arquivo no fim, mesmo se der erro.
- Se o token vazar ou você trocar a senha do Google: rode `clasp logout`, depois `clasp login` de novo, e atualize o secret. Você também pode revogar o acesso em https://myaccount.google.com/permissions ("clasp").
- **Ao migrar para a conta do usuário final** (o mecânico):
  1. refaça `clasp login` com a conta **dele**;
  2. substitua os **3** secrets: `CLASPRC_JSON` (novo login), `SCRIPT_ID` (o script da planilha dele) e `DEPLOYMENT_ID` (a implantação dele).

## h) Testar o último código antes de virar versão (`/dev`)

No editor do Apps Script: **Implantar → Testar implantações** → copie a URL que termina em `/dev`.

- A `/dev` sempre roda o **último código enviado** (o `clasp push`), mesmo sem versão nova. Só a conta dona consegue abrir.
- Para conferir sem publicar, rode `clasp push` local (sem `deploy`) e abra a `/dev`.
- Para o autoteste, abra a `/dev` com `?teste=1` no fim.

## i) Primeira vez: o código colado à mão será substituído

Hoje o projeto Apps Script tem o código que foi colado à mão, num arquivo **"Código.gs"** (com acento). O primeiro `clasp push --force` **substitui todos os arquivos do projeto** pelos de `src/`. Depois dele, o projeto fica com exatamente:

- `Codigo.gs` (sem acento; o "Código.gs" antigo é removido);
- `Index.html`;
- `appsscript.json` (o manifesto, com fuso `America/Sao_Paulo`, `executeAs: USER_DEPLOYING`, `access: MYSELF` e o escopo `spreadsheets.currentonly`).

A planilha e os dados não são afetados: o push mexe só no código. A implantação continua com a mesma URL, porque é atualizada pelo `DEPLOYMENT_ID`.
