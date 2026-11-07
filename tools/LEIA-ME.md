# tools/

Ferramentas de apoio. **Não fazem parte do app**: o service worker não as coloca em cache, mas elas ficam no repositório.

## Gerar os ícones (logo CliniCar)

- **Fonte:** `tools/logo-origem.jpg`, o logo da CliniCar recortado do perfil da oficina (700 × 700, fundo preto).
- **Script:** `tools/gerar-icones.ps1` (PowerShell, usa o `System.Drawing` do Windows; não precisa instalar nada).

```powershell
cd "C:\Users\leand\OneDrive\Pessoal\APP-Andre"
powershell -ExecutionPolicy Bypass -File tools\gerar-icones.ps1
```

Gera em `icons/`:

| Arquivo | Uso |
|---|---|
| `icon-192.png`, `icon-512.png` | ícones do app (logo em círculo, fundo transparente) |
| `icon-maskable-512.png` | Android: fundo preto cheio, logo dentro da área segura (80%), porque o sistema recorta em círculo |
| `apple-touch-icon.png` | iPhone/iPad (180 px, fundo preto) |
| `logo-clinicar.jpg` | logo do topo do app (256 px) |

Se os ícones mudarem, **suba a `VERSAO` em `sw.js`** antes de publicar (veja `docs/DEPLOY.md`, item f).
