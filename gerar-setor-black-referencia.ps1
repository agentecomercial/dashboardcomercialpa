Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$sourcePath = Join-Path (Split-Path $PSScriptRoot -Parent) "WhatsApp Image 2026-06-18 at 17.29.20.jpeg"
$outDir = Join-Path $PSScriptRoot "assets\evento-setores"
$outPath = Join-Path $outDir "setor-black-referencia-whatsapp.png"

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

    $topTint = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 0, 0, 0))
    $g.FillRectangle($topTint, 0, 0, $width, 300)

    for ($yy = 300; $yy -lt $height; $yy += 2) {
        if ($yy -lt 520) {
            $t = ($yy - 300) / 220
            $alpha = [Math]::Round(132 * [Math]::Pow($t, 1.6))
        } else {
            $t = ($yy - 520) / ($height - 520)
            $alpha = [Math]::Round(132 + (122 * [Math]::Pow($t, 0.65)))
        }
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 0, 12, 12))
        $g.FillRectangle($brush, 0, $yy, $width, 2)
        $brush.Dispose()
    }

    $cyanColor = [System.Drawing.Color]::FromArgb(255, 49, 226, 210)
    $cyan = New-Object System.Drawing.SolidBrush($cyanColor)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $black = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
    $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 225, 240, 238))
    $softPanel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(42, 255, 255, 255))
    $darkPanel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(130, 0, 0, 0))

    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse(120, 545, 840, 250)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(90, 49, 226, 210)
    $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 49, 226, 210))
    $g.FillPath($glowBrush, $glowPath)

    $aAcute = [char]0x00E1
    $eCirc = [char]0x00EA
    $iAcute = [char]0x00ED
    $oTilde = [char]0x00F5
    $eAcute = [char]0x00E9

    $fontBrand = New-Font "Arial" 24 ([System.Drawing.FontStyle]::Bold)
    $fontSmall = New-Font "Arial" 38 ([System.Drawing.FontStyle]::Bold)
    $fontBlack = New-Font "Arial Black" 116 ([System.Drawing.FontStyle]::Bold)
    $fontPrice = New-Font "Arial Black" 58 ([System.Drawing.FontStyle]::Bold)
    $fontLead = New-Font "Arial" 35 ([System.Drawing.FontStyle]::Bold)
    $fontBenefit = New-Font "Arial" 29 ([System.Drawing.FontStyle]::Regular)
    $fontFooter = New-Font "Arial" 27 ([System.Drawing.FontStyle]::Bold)

    Draw-Centered $g "TOUR CRESCIMENTO EMPRESARIAL" $fontBrand $white 590
    Draw-Centered $g "SETOR" $fontSmall $muted 655
    Draw-Centered $g "BLACK" $fontBlack $cyan 702

    Draw-RoundedRectangle $g $cyan 276 844 528 100 22
    Draw-Centered $g "R$ 1.497" $fontPrice $black 862

    $lead = "A experi" + $eCirc + "ncia mais exclusiva do evento."
    Draw-Centered $g $lead $fontLead $white 984

    Draw-RoundedRectangle $g $darkPanel 104 1052 872 152 20
    $benefit1 = "M" + $aAcute + "xima proximidade"
    $benefit2 = "Networking qualificado"
    $benefit3 = "Acesso diferenciado"
    $benefit4 = "Conex" + $oTilde + "es estrat" + $eAcute + "gicas"

    $g.FillEllipse($cyan, 145, 1096, 12, 12)
    $g.DrawString($benefit1, $fontBenefit, $muted, 173, 1084)
    $g.FillEllipse($cyan, 560, 1096, 12, 12)
    $g.DrawString($benefit2, $fontBenefit, $muted, 588, 1084)
    $g.FillEllipse($cyan, 145, 1156, 12, 12)
    $g.DrawString($benefit3, $fontBenefit, $muted, 173, 1144)
    $g.FillEllipse($cyan, 560, 1156, 12, 12)
    $g.DrawString($benefit4, $fontBenefit, $muted, 588, 1144)

    Draw-RoundedRectangle $g $softPanel 208 1240 664 58 14
    Draw-Centered $g "20 DE AGOSTO  |  TERESINA/PI" $fontFooter $white 1254

    $linePen = New-Object System.Drawing.Pen($cyanColor, 2)
    $g.DrawLine($linePen, 212, 1320, 868, 1320)
}
finally {
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bitmap.Dispose()
    $base.Dispose()
}

Write-Output $outPath
