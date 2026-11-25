# وسيط رحلات بدون Node — يشغّله Windows PowerShell المدمج
# http://localhost:3000/
$ErrorActionPreference = 'Stop'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

$Port = 3000
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
$script:FaSession = $null

function Send-Bytes($res, [int]$code, [byte[]]$bytes, [string]$contentType) {
  $res.StatusCode = $code
  $res.ContentType = $contentType
  try { $res.Headers.Add('Access-Control-Allow-Origin', '*') } catch {}
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

function Send-Text($res, [int]$code, [string]$text, [string]$contentType) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($text)
  Send-Bytes $res $code $bytes $contentType
}

function ConvertTo-JsonText($obj) {
  try {
    Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = 67108864
    $ser.RecursionLimit = 8
    return $ser.Serialize($obj)
  } catch {
    $html = [string]$obj.html
    $html = $html.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n').Replace("`t", '\t')
    $err = [string]$obj.error
    $err = $err.Replace('\', '\\').Replace('"', '\"')
    $ok = if ($obj.ok) { 'true' } else { 'false' }
    $url = ([string]$obj.url).Replace('\', '\\').Replace('"', '\"')
    $ident = ([string]$obj.ident).Replace('"', '')
    return '{"ok":' + $ok + ',"ident":"' + $ident + '","url":"' + $url + '","error":"' + $err + '","html":"' + $html + '"}'
  }
}

function Send-Json($res, [int]$code, $obj) {
  $json = ConvertTo-JsonText $obj
  Send-Text $res $code $json 'application/json; charset=utf-8'
}

function Test-FaUrl([string]$url) {
  try {
    $u = [Uri]$url
    if ($u.Scheme -ne 'https') { return $false }
    $hostName = $u.Host.ToLowerInvariant()
    return ($hostName -eq 'www.flightaware.com' -or $hostName.EndsWith('.flightaware.com'))
  } catch { return $false }
}

function Get-FaPage([string]$Url) {
  $last = $null
  for ($i = 0; $i -lt 2; $i++) {
    try {
      $params = @{
        Uri = $Url
        UseBasicParsing = $true
        TimeoutSec = 20
        MaximumRedirection = 5
        UserAgent = $Ua
        Headers = @{
          Accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          'Accept-Language' = 'en-US,en;q=0.9'
        }
      }
      if ($script:FaSession) { $params.WebSession = $script:FaSession }
      else { $params.SessionVariable = 'faSession' }
      $resp = Invoke-WebRequest @params
      if (-not $script:FaSession -and (Get-Variable -Name faSession -ErrorAction SilentlyContinue)) {
        $script:FaSession = $faSession
      }
      $html = [string]$resp.Content
      $head = ''
      if ($html.Length -gt 0) {
        $n = [Math]::Min(2000, $html.Length)
        $head = $html.Substring(0, $n).ToLowerInvariant()
      }
      $blocked = $head.Contains('just a moment') -or $head.Contains('cf-browser-verification') -or $head.Contains('captcha')
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400 -and $html.Length -gt 400 -and -not $blocked) {
        return $html
      }
      $last = "status $($resp.StatusCode)"
    } catch {
      $last = $_.Exception.Message
    }
    if ($i -eq 0) { Start-Sleep -Milliseconds 400 }
  }
  throw $last
}

function Get-Mime([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js' { return 'application/javascript; charset=utf-8' }
    '.css' { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.png' { return 'image/png' }
    '.jpg' { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.svg' { return 'image/svg+xml' }
    '.ico' { return 'image/x-icon' }
    '.txt' { return 'text/plain; charset=utf-8' }
    '.md' { return 'text/plain; charset=utf-8' }
    default { return 'application/octet-stream' }
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host ''
  Write-Host 'Could not open http://localhost:3000/'
  Write-Host $_.Exception.Message
  Write-Host 'Close any old START window, then run this file again.'
  Write-Host 'If it still fails, right-click START.bat and choose Run as administrator.'
  Read-Host 'Press Enter'
  exit 1
}

Write-Host ''
Write-Host '========================================'
Write-Host '  Flight proxy without Node.js'
Write-Host "  http://localhost:$Port/"
Write-Host '  Leave this window open.'
Write-Host '========================================'
Write-Host ''

while ($listener.IsListening) {
  $ctx = $null
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
      try {
        $res.Headers.Add('Access-Control-Allow-Origin', '*')
        $res.Headers.Add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
      } catch {}
      $res.Close()
      continue
    }
    $path = $req.Url.AbsolutePath
    if ($path -eq '/api/health') {
      Send-Json $res 200 @{ ok = $true; service = 'flight-proxy-ps'; port = $Port }
      continue
    }
    if ($path.StartsWith('/api/flight/')) {
      $rest = $path.Substring('/api/flight/'.Length)
      $ident = ($rest.Split('/')[0]).ToUpperInvariant()
      if ($ident -notmatch '^[A-Z0-9]{2,10}$') {
        Send-Json $res 400 @{ ok = $false; error = 'bad ident'; html = '' }
        continue
      }
      $wantHistory = $rest -match '/history/?$' -or $req.Url.Query -match 'history=1'
      $fa = 'https://www.flightaware.com/live/flight/' + [Uri]::EscapeDataString($ident)
      if ($wantHistory) { $fa = $fa + '/history' }
      try {
        $html = Get-FaPage $fa
        Send-Json $res 200 @{ ok = $true; ident = $ident; url = $fa; html = $html; error = '' }
      } catch {
        Send-Json $res 502 @{ ok = $false; ident = $ident; url = $fa; error = [string]$_.Exception.Message; html = '' }
      }
      continue
    }
    if ($path -eq '/api/proxy') {
      $target = [string]$req.QueryString['url']
      if (-not $target) { $target = '' }
      $target = $target.Trim()
      if (-not (Test-FaUrl $target)) {
        Send-Json $res 400 @{ ok = $false; error = 'flightaware only'; html = '' }
        continue
      }
      try {
        $html = Get-FaPage $target
        Send-Json $res 200 @{ ok = $true; url = $target; html = $html; error = '' }
      } catch {
        Send-Json $res 502 @{ ok = $false; url = $target; error = [string]$_.Exception.Message; html = '' }
      }
      continue
    }
    $rel = [Uri]::UnescapeDataString($path)
    if ($rel -eq '/' -or $rel -eq '') { $rel = '/index.html' }
    $rel = $rel.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    $rootPrefix = $Root.TrimEnd('\') + '\'
    if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      Send-Text $res 403 'Forbidden' 'text/plain; charset=utf-8'
      continue
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      Send-Text $res 404 'Not found' 'text/plain; charset=utf-8'
      continue
    }
    $bytes = [IO.File]::ReadAllBytes($full)
    Send-Bytes $res 200 $bytes (Get-Mime $full)
  } catch {
    try { Send-Text $res 500 ([string]$_.Exception.Message) 'text/plain; charset=utf-8' } catch {}
  }
}
