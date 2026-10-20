# Rebuild the NSIS bitmaps from the canonical CastLink icon. Windows PowerShell.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$iconPath=Join-Path $PSScriptRoot '..\assets\castlink-icon.ico'
$icon=[System.Drawing.Icon]::new($iconPath,256,256)
$image=$icon.ToBitmap()
function Write-BrandBitmap([string]$Name,[int]$Width,[int]$Height,[bool]$Sidebar) {
  $bitmap=[System.Drawing.Bitmap]::new($Width,$Height,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g=[System.Drawing.Graphics]::FromImage($bitmap)
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#191c20'))
  $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $ink=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#eef0f2'))
  $muted=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#acd9bb'))
  $font=[System.Drawing.Font]::new('Segoe UI',16,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
  $small=[System.Drawing.Font]::new('Segoe UI',12,[System.Drawing.FontStyle]::Regular,[System.Drawing.GraphicsUnit]::Pixel)
  try {
    if($Sidebar) {
      $g.DrawImage($image,24,28,112,112)
      $g.DrawString('CastLink',$font,$ink,24,248)
      $g.DrawString('Client',$small,$muted,25,275)
    } else {
      $g.DrawImage($image,94,7,44,44)
    }
    $bitmap.Save((Join-Path $PSScriptRoot $Name),[System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally { $small.Dispose(); $font.Dispose(); $ink.Dispose(); $muted.Dispose(); $g.Dispose(); $bitmap.Dispose() }
}
try { Write-BrandBitmap 'installer-sidebar.bmp' 164 314 $true; Write-BrandBitmap 'installer-header.bmp' 150 57 $false }
finally { $image.Dispose(); $icon.Dispose() }
