# Draws the plugin icon (imgs/plugin/icon.png 288 px and icon@2x.png 576 px),
# which Stream Deck wants as PNG: the Combined key's amber/green split with ? and a check.
# Run with `npm run icons`.
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\com.mctonnie.claude-notify.sdPlugin\imgs\plugin'
foreach ($pair in @(@(288, 'icon.png'), @(576, 'icon@2x.png'))) {
    $size = $pair[0]; $k = $size / 288
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)
    $pt = { param($x, $y) New-Object System.Drawing.PointF ($x * $k), ($y * $k) }
    $amber = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#f0a64a'))
    $green = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#74c48a'))
    $g.FillPolygon($amber, [System.Drawing.PointF[]]@((& $pt 24 24), (& $pt 264 24), (& $pt 24 264)))
    $g.FillPolygon($green, [System.Drawing.PointF[]]@((& $pt 264 24), (& $pt 264 264), (& $pt 24 264)))
    $font = New-Object System.Drawing.Font 'Segoe UI Black', ([single](92 * $k)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#1d1408'))
    $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $g.DrawString('?', $font, $ink, (New-Object System.Drawing.RectangleF (30 * $k), (40 * $k), (120 * $k), (120 * $k)), $fmt)
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#0f1f14')), ([single](16 * $k))
    $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
    $g.DrawLines($pen, [System.Drawing.PointF[]]@((& $pt 160 188), (& $pt 188 216), (& $pt 240 158)))
    $bmp.Save((Join-Path $out $pair[1]), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
Write-Output 'wrote icon.png, icon@2x.png'
