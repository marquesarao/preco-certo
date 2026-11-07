# Gera os ícones do app a partir de tools/logo-origem.jpg (logo CliniCar, quadrado, fundo preto).
# Uso (PowerShell, na pasta do projeto):  powershell -ExecutionPolicy Bypass -File tools\gerar-icones.ps1
# Depois de gerar ícones novos, suba a VERSAO em sw.js antes de publicar.

Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$origem = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'logo-origem.jpg'))
$pastaIcones = Join-Path $raiz 'icons'

function Novo-Grafico($bmp) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return $g
}

# Logo recortado em círculo, sobre fundo transparente (ícones "any").
function Gerar-Circulo($lado, $nome) {
  $logo = New-Object System.Drawing.Bitmap $lado, $lado
  $g = Novo-Grafico $logo
  $g.DrawImage($origem, 0, 0, $lado, $lado)
  $g.Dispose()
  $bmp = New-Object System.Drawing.Bitmap $lado, $lado, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = Novo-Grafico $bmp
  $g.Clear([System.Drawing.Color]::Transparent)
  $pincel = New-Object System.Drawing.TextureBrush $logo
  $g.FillEllipse($pincel, 0, 0, $lado - 1, $lado - 1)
  $g.Dispose(); $pincel.Dispose(); $logo.Dispose()
  $bmp.Save((Join-Path $pastaIcones $nome), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Fundo preto cheio com o logo centralizado ocupando "fracao" do lado (maskable / apple-touch).
function Gerar-Cheio($lado, $fracao, $nome) {
  $bmp = New-Object System.Drawing.Bitmap $lado, $lado, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = Novo-Grafico $bmp
  $g.Clear([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
  $d = [int]($lado * $fracao)
  $m = [int](($lado - $d) / 2)
  $caminho = New-Object System.Drawing.Drawing2D.GraphicsPath
  $caminho.AddEllipse($m, $m, $d, $d)
  $g.SetClip($caminho)
  $g.DrawImage($origem, $m, $m, $d, $d)
  $g.Dispose(); $caminho.Dispose()
  $bmp.Save((Join-Path $pastaIcones $nome), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Logo do topo do app (JPEG leve; o CSS deixa redondo).
function Gerar-LogoTopo($lado, $nome) {
  $bmp = New-Object System.Drawing.Bitmap $lado, $lado
  $g = Novo-Grafico $bmp
  $g.Clear([System.Drawing.Color]::Black)
  $g.DrawImage($origem, 0, 0, $lado, $lado)
  $g.Dispose()
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $par = New-Object System.Drawing.Imaging.EncoderParameters 1
  $par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
  $bmp.Save((Join-Path $pastaIcones $nome), $enc, $par)
  $bmp.Dispose()
}

Gerar-Circulo 192 'icon-192.png'
Gerar-Circulo 512 'icon-512.png'
Gerar-Cheio 512 0.80 'icon-maskable-512.png'   # área segura do maskable: círculo de 80%
Gerar-Cheio 180 0.94 'apple-touch-icon.png'     # o iOS arredonda os cantos sozinho
Gerar-LogoTopo 256 'logo-clinicar.jpg'
$origem.Dispose()
Get-ChildItem $pastaIcones | ForEach-Object { '{0,-24} {1,8} bytes' -f $_.Name, $_.Length }
