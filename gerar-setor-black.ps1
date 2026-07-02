Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$sourcePath = Join-Path (Split-Path $PSScriptRoot -Parent) "WhatsApp Image 2026-06-18 at 17.29.25.jpeg"
$outDir = Join-Path $PSScriptRoot "assets\evento-setores"
$outPath = Join-Path $outDir "setor-black-whatsapp.png"

if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$width = 1080
$height = 1350

function New-Font($name, $size, $style = [System.Drawing.FontStyle]::Regular) {
    return New-Object System.Drawing.Font($name, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-RoundedRectangle($graphics, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath($brush, $path)
    $path.Dispose()
}

function Wrap-Lines($graphics, [string]$text, $font, [float]$maxWidth) {
    $words = $text -split "\s+"
    $lines = New-Object System.Collections.Generic.List[string]
    $line = ""

    foreach ($word in $words) {
        $candidate = if ($line.Length -eq 0) { $word } else { "$line $word" }
        $size = $graphics.MeasureString($candidate, $font)
        if ($size.Width -le $maxWidth -or $line.Length -eq 0) {
            $line = $candidate
        } else {
            $lines.Add($line)
            $line = $word
        }
    }

    if ($line.Length -gt 0) {
        $lines.Add($line)
    }

    return $lines
}

function Draw-WrappedText($graphics, [string]$text, $font, $brush, [float]$x, [float]$y, [float]$maxWidth, [float]$lineHeight) {
    $lines = Wrap-Lines $graphics $text $font $maxWidth
    foreach ($line in $lines) {
        $graphics.DrawString($line, $font, $brush, $x, $y)
        $y += $lineHeight
    }
    return $y
}

$base = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

try {
    $scale = [Math]::Max($width / $base.Width, $height / $base.Height)
    $drawW = $base.Width * $scale
    $drawH = $base.Height * $scale
    $drawX = ($width - $drawW) / 2
    $drawY = ($height - $drawH) / 2
    $g.DrawImage($base, $drawX, $drawY, $drawW, $drawH)

    $darkOverlay = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 0, 0, 0))
    $g.FillRectangle($darkOverlay, 0, 0, $width, $height)

    $leftShade = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle(0, 0, $width, $height)),
        [System.Drawing.Color]::FromArgb(245, 0, 0, 0),
        [System.Drawing.Color]::FromArgb(110, 0, 0, 0),
        [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
    )
    $g.FillRectangle($leftShade, 0, 0, $width, $height)

    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 235, 247, 245))
    $black = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
    $cyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 51, 226, 205))
    $cyanText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 80, 255, 235))
    $panel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 0, 0, 0))

    $fontSmall = New-Font "Arial" 28 ([System.Drawing.FontStyle]::Bold)
    $fontTitle = New-Font "Arial Black" 112 ([System.Drawing.FontStyle]::Bold)
    $fontPrice = New-Font "Arial Black" 58 ([System.Drawing.FontStyle]::Bold)
    $fontLead = New-Font "Arial" 37 ([System.Drawing.FontStyle]::Bold)
    $fontBody = New-Font "Arial" 31 ([System.Drawing.FontStyle]::Regular)
    $fontFooter = New-Font "Arial" 24 ([System.Drawing.FontStyle]::Bold)

    $x = 76
    $maxWidth = 928

    $g.DrawString("TOUR CRESCIMENTO EMPRESARIAL", $fontSmall, $cyanText, $x, 72)
    $g.DrawString("SETOR", $fontSmall, $white, $x, 144)
    $g.DrawString("BLACK", $fontTitle, $white, $x - 4, 174)

    Draw-RoundedRectangle $g $cyan 76 326 470 112 26
    $g.DrawString("R$ 1.497", $fontPrice, $black, 112, 344)

    $y = 488
    $eCirc = [char]0x00EA
    $aAcute = [char]0x00E1
    $iAcute = [char]0x00ED
    $oTilde = [char]0x00F5
    $eAcute = [char]0x00E9
    $lead = "A experi" + $eCirc + "ncia mais exclusiva do evento."
    $y = Draw-WrappedText $g $lead $fontLead $white $x $y $maxWidth 48

    Draw-RoundedRectangle $g $panel 64 615 952 482 30
    $y = 660
    $body = "Para quem busca m" + $aAcute + "xima proximidade, networking qualificado e acesso diferenciado. O setor Black " + $eAcute + " destinado a l" + $iAcute + "deres, empres" + $aAcute + "rios, investidores e profissionais que desejam extrair o m" + $aAcute + "ximo valor do evento e construir conex" + $oTilde + "es estrat" + $eAcute + "gicas de alto n" + $iAcute + "vel."
    $null = Draw-WrappedText $g $body $fontBody $muted 104 $y 872 43

    Draw-RoundedRectangle $g $cyan 148 1148 784 88 24
    $ctaFont = New-Font "Arial Black" 39 ([System.Drawing.FontStyle]::Bold)
    $cta = "GARANTA SEU SETOR BLACK"
    $ctaSize = $g.MeasureString($cta, $ctaFont)
    $g.DrawString($cta, $ctaFont, $black, (($width - $ctaSize.Width) / 2), 1168)

    $footer = "20 DE AGOSTO  |  ABERTO A TODOS OS SETORES"
    $footerSize = $g.MeasureString($footer, $fontFooter)
    $g.DrawString($footer, $fontFooter, $cyanText, (($width - $footerSize.Width) / 2), 1284)

    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $g.Dispose()
    $bitmap.Dispose()
    $base.Dispose()
}

Write-Output $outPath
