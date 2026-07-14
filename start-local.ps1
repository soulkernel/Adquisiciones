$ErrorActionPreference = "Stop"

$port = 8770
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://127.0.0.1:$port/"

Set-Location $root

Add-Type -AssemblyName System.Web

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

function Get-SafePath {
  param([string]$UrlPath)

  $relative = [System.Web.HttpUtility]::UrlDecode($UrlPath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($relative)) {
    $relative = "index.html"
  }

  $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  $rootFull = [System.IO.Path]::GetFullPath($root)

  if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $candidate
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
$listener.Start()

Write-Host ""
Write-Host "Piloto GLF iniciado correctamente."
Write-Host "Abre: $prefix"
Write-Host "Credenciales: ADMIN / DEMO"
Write-Host "Para detenerlo, cierra esta ventana o presiona Ctrl+C."
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    while ($reader.ReadLine()) {}

    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      $client.Close()
      continue
    }

    $parts = $requestLine.Split(" ")
    $requestPath = if ($parts.Length -ge 2) { $parts[1].Split("?")[0] } else { "/" }
    $filePath = Get-SafePath $requestPath

    if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Archivo no encontrado")
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nCache-Control: no-store`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      $client.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)

    $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nCache-Control: no-store`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $client.Close()
  }
} finally {
  $listener.Stop()
}
