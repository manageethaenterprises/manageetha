Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\saira\.gemini\antigravity-ide\brain\b5b91b18-ccfb-418f-9652-ec8bf6b40d58\manageetha_favicon_1792559933094.jpg'
$assetsDir = 'c:\Users\saira\Downloads\manageetha\assets'
$rootDir = 'c:\Users\saira\Downloads\manageetha'

if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$cropX = 112
$cropY = 108
$cropW = 798
$cropH = 786

function Generate-ResizedPng {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$size,
        [string]$destinationPath
    )
    $dest = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $r = [float]($size * 0.225) # ~22.5% squircle corner radius
    $d = [float]($r * 2.0)
    $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
    $path.AddArc([float]($size - $d), 0.0, $d, $d, 270.0, 90.0)
    $path.AddArc([float]($size - $d), [float]($size - $d), $d, $d, 0.0, 90.0)
    $path.AddArc(0.0, [float]($size - $d), $d, $d, 90.0, 90.0)
    $path.CloseFigure()

    $g.SetClip($path)
    $srcRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropW, $cropH)
    $destRect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    $g.DrawImage($source, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.ResetClip()

    $dest.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $path.Dispose()
    $g.Dispose()
    return $dest
}

Write-Host "Generating PNG favicon sizes..."
$bmp512 = Generate-ResizedPng $src 512 (Join-Path $assetsDir "favicon-512x512.png")
$bmp192 = Generate-ResizedPng $src 192 (Join-Path $assetsDir "favicon-192x192.png")
$bmp180 = Generate-ResizedPng $src 180 (Join-Path $assetsDir "apple-touch-icon.png")
$bmp48  = Generate-ResizedPng $src 48  (Join-Path $assetsDir "favicon-48x48.png")
$bmp32  = Generate-ResizedPng $src 32  (Join-Path $assetsDir "favicon-32x32.png")
$bmp16  = Generate-ResizedPng $src 16  (Join-Path $assetsDir "favicon-16x16.png")

# Also copy apple-touch-icon.png to root for iOS crawlers
Copy-Item (Join-Path $assetsDir "apple-touch-icon.png") (Join-Path $rootDir "apple-touch-icon.png") -Force

Write-Host "Building multi-resolution ICO file (16, 32, 48)..."
function Build-IcoFile {
    param(
        [string[]]$pngPaths,
        [string]$icoPath
    )
    
    $pngBytesList = @()
    foreach ($p in $pngPaths) {
        $pngBytesList += , [System.IO.File]::ReadAllBytes($p)
    }

    $count = $pngBytesList.Count
    $headerSize = 6
    $dirEntrySize = 16
    $dataOffset = $headerSize + ($count * $dirEntrySize)

    $ms = [System.IO.MemoryStream]::new()
    $bw = [System.IO.BinaryWriter]::new($ms)

    # ICONDIR
    $bw.Write([uint16]0)      # Reserved
    $bw.Write([uint16]1)      # Type 1 = ICO
    $bw.Write([uint16]$count) # Number of images

    $currentOffset = $dataOffset
    for ($i = 0; $i -lt $count; $i++) {
        $bytes = $pngBytesList[$i]
        $size = if ($i -eq 0) { 16 } elseif ($i -eq 1) { 32 } else { 48 }
        
        $bw.Write([byte]$size)           # Width
        $bw.Write([byte]$size)           # Height
        $bw.Write([byte]0)               # Color count (0 for >=8bpp)
        $bw.Write([byte]0)               # Reserved
        $bw.Write([uint16]1)             # Color planes
        $bw.Write([uint16]32)            # Bits per pixel
        $bw.Write([uint32]$bytes.Length) # Image data size
        $bw.Write([uint32]$currentOffset)# Offset of data
        $currentOffset += $bytes.Length
    }

    # Write PNG byte streams
    for ($i = 0; $i -lt $count; $i++) {
        $bw.Write($pngBytesList[$i])
    }

    $bw.Flush()
    [System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
    $bw.Dispose()
    $ms.Dispose()
}

$icoImages = @(
    (Join-Path $assetsDir "favicon-16x16.png"),
    (Join-Path $assetsDir "favicon-32x32.png"),
    (Join-Path $assetsDir "favicon-48x48.png")
)

$assetsIco = Join-Path $assetsDir "favicon.ico"
$rootIco   = Join-Path $rootDir "favicon.ico"

Build-IcoFile $icoImages $assetsIco
Copy-Item $assetsIco $rootIco -Force
Write-Host "ICO created at $assetsIco and $rootIco"

# Cleanup bitmaps
$bmp512.Dispose()
$bmp192.Dispose()
$bmp180.Dispose()
$bmp48.Dispose()
$bmp32.Dispose()
$bmp16.Dispose()
$src.Dispose()

Write-Host "Favicon generation suite finished successfully!"
