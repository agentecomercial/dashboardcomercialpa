Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$outDir = Join-Path $PSScriptRoot "assets\evento-setores"
$outPath = Join-Path $outDir "setor-black-premium-whatsapp.png"

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

function Draw-Centered($graphics, [string]$text, $font, $brush, [float]$y) {
    $size = $graphics.MeasureString($text, $font)
    $graphics.DrawString($text, $font, $brush, (($script:width - $size.Width) / 2), $y)
}

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

try {
    $bgRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect,
        [System.Drawing.Color]::FromArgb(255, 2, 7, 9),
        [System.Drawing.Color]::FromArgb(255, 0, 0, 0),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($bg, $bgRect)

    $cyan = [System.Drawing.Color]::FromArgb(255, 55, 224, 206)
    $cyanBrush = New-Object System.Drawing.SolidBrush($cyan)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 218, 232, 232))
    $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(185, 190, 205, 205))
    $black = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
    $panel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(105, 255, 255, 255))
    $panelDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 0, 0, 0))

    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse(430, 150, 520, 520)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(95, 55, 224, 206)
    $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 55, 224, 206))
    $g.FillPath($glowBrush, $glowPath)

    $skylineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 255, 255, 255))
    $randHeights = @(175, 110, 145, 205, 128, 245, 160, 118, 198, 150, 225, 132, 175, 112)
    $x = 0
    foreach ($h in $randHeights) {
        $w = 78
        $g.FillRectangle($skylineBrush, $x, 1010 - $h, $w, $h)
        $x += 78
    }
    $bridgePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(42, 55, 224, 206), 3)
    $g.DrawLine($bridgePen, 80, 930, 1000, 930)
    for ($i = 130; $i -lt 980; $i += 70) {
        $g.DrawLine($bridgePen, $i, 930, $i + 90, 840)
    }

    $fontTop = New-Font "Arial" 28 ([System.Drawing.FontStyle]::Bold)
    $fontSector = New-Font "Arial" 36 ([System.Drawing.FontStyle]::Bold)
    $fontBlack = New-Font "Arial Black" 142 ([System.Drawing.FontStyle]::Bold)
    $fontPrice = New-Font "Arial Black" 64 ([System.Drawing.FontStyle]::Bold)
    $fontLead = New-Font "Arial" 42 ([System.Drawing.FontStyle]::Bold)
    $fontBenefit = New-Font "Arial" 34 ([System.Drawing.FontStyle]::Regular)
    $fontFooter = New-Font "Arial" 25 ([System.Drawing.FontStyle]::Bold)

    $aAcute = [char]0x00E1
    $eCirc = [char]0x00EA
    $iAcute = [char]0x00ED
    $oTilde = [char]0x00F5
    $eAcute = [char]0x00E9
    $lead = "A experi" + $eCirc + "ncia mais exclusiva do evento."
    $maxima = "M" + $aAcute + "xima proximidade"
    $conexoes = "Conex" + $oTilde + "es estrat" + $eAcute + "gicas de alto n" + $iAcute + "vel"
    $lideres = "L" + $iAcute + "DERES  |  EMPRES" + $aAcute + "RIOS  |  INVESTIDORES"

    Draw-Centered $g "TOUR CRESCIMENTO EMPRESARIAL" $fontTop $cyanBrush 82
    Draw-Centered $g "SETOR" $fontSector $white 178
    Draw-Centered $g "BLACK" $fontBlack $white 224

    Draw-RoundedRectangle $g $cyanBrush 258 420 564 116 26
    Draw-Centered $g "R$ 1.497" $fontPrice $black 440

    Draw-Centered $g $lead $fontLead $white 615

    Draw-RoundedRectangle $g $panelDark 108 720 864 342 28
    $benefits = @(
        $maxima,
        "Networking qualificado",
        "Acesso diferenciado",
        $conexoes
    )
    $y = 765
    foreach ($benefit in $benefits) {
        $g.FillEllipse($cyanBrush, 170, $y + 16, 15, 15)
        $g.DrawString($benefit, $fontBenefit, $soft, 210, $y)
        $y += 72
    }

    Draw-RoundedRectangle $g $panel 154 1118 772 72 20
    Draw-Centered $g $lideres $fontFooter $white 1138

    Draw-Centered $g "20 DE AGOSTO" $fontFooter $cyanBrush 1248
    Draw-Centered $g "ABERTO A TODOS OS SETORES" $fontFooter $muted 1288

    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $g.Dispose()
    $bitmap.Dispose()
}

Write-Output $outPath
