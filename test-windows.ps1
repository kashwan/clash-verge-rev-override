#Requires -Version 5.1
# Clash Verge Rev 全局覆写配置 - Windows 只读检查脚本
# 前提：已在 Verge 中开启 TUN 模式，并关闭「DNS 覆写」和「IPv6」
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\test-windows.ps1

$ErrorActionPreference = 'Continue'
$script:pass = 0
$script:fail = 0

function Pass($m) { $script:pass++; Write-Host "[PASS] $m" -ForegroundColor Green }
function Fail($m) { $script:fail++; Write-Host "[FAIL] $m" -ForegroundColor Red }
function Info($m) { Write-Host "[INFO] $m" -ForegroundColor Cyan }

if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
  Write-Host "未找到 curl.exe（Windows 10 1803+ 自带），无法继续。" -ForegroundColor Red
  exit 1
}

function Get-A([string]$name) {
  try {
    (Resolve-DnsName $name -Type A -DnsOnly -ErrorAction Stop |
      Where-Object { $_.IPAddress } |
      Select-Object -ExpandProperty IPAddress) -join ','
  } catch { '' }
}

function Get-Text([string]$url, [string]$extra = '') {
  try {
    $curlArgs = @('-s', '--max-time', '12')
    if ($extra) { $curlArgs += $extra }
    $curlArgs += $url
    (& curl.exe @curlArgs 2>$null)
  } catch { '' }
}

Info "1) DNS / fake-ip"
$g = Get-A 'google.com'
if ($g -match '^198\.18\.') {
  Pass "google.com -> $g (fake-ip)"
} else {
  Fail "google.com -> '$g'，期望 198.18.x.x；TUN 或 DNS 未生效（可先 ipconfig /flushdns 再试）"
}

$b = Get-A 'baidu.com'
if ($b -and $b -notmatch '^198\.18\.') {
  Pass "baidu.com -> $b (真实 IP)"
} else {
  Fail "baidu.com -> '$b'，期望真实国内 IP"
}

$t = Get-A 'time.windows.com'
if ($t -and $t -notmatch '^198\.18\.') {
  Pass "time.windows.com -> $t (fake-ip-filter 生效)"
} else {
  Fail "time.windows.com -> '$t'，期望真实 IP"
}

Info "2) 出口 IP"
$proxyIp = ((Get-Text 'https://api.ipify.org' '-4') -join '').Trim()
$cnRaw = (Get-Text 'https://myip.ipip.net') -join ''
$cnIp = if ($cnRaw -match '\d{1,3}(?:\.\d{1,3}){3}') { $Matches[0] } else { '' }

if ($proxyIp -match '^\d{1,3}(?:\.\d{1,3}){3}$') {
  Pass "代理出口: $proxyIp"
} else {
  Fail "无法获取代理出口 IP"
}

if ($cnIp) {
  Pass "国内出口: $cnIp"
} else {
  Fail "无法获取国内出口 IP"
}

if ($proxyIp -and $cnIp -and $proxyIp -ne $cnIp) {
  Pass "代理与直连出口不同，分流生效"
} elseif ($proxyIp -and $cnIp) {
  Fail "代理与直连出口相同（$proxyIp），检查节点或分流规则"
}

Info "3) IPv6 出口"
$v6 = ((Get-Text 'https://api64.ipify.org' '-6') -join '').Trim()
if ($v6 -match ':') {
  Fail "检测到 IPv6 出口 $v6，请确认设置里已关闭 IPv6"
} else {
  Pass "无 IPv6 出口"
}

Info "4) 规则集可达性"
$code = (& curl.exe -s -o NUL -w '%{http_code}' --max-time 12 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/cn.mrs' 2>$null)
if ($code -match '^(200|301|302)$') {
  Pass "规则集下载正常 (HTTP $code)"
} else {
  Fail "规则集下载异常 (HTTP $code)"
}

Info "5) 仍需手动确认"
Write-Host "  https://ipleak.net          -> DNS 不含本地运营商，IPv6 为空"
Write-Host "  https://dnsleaktest.com     -> Extended test，DNS 结果为代理侧"
Write-Host "  https://browserleaks.com/webrtc -> 未暴露本地 IP"

Write-Host ""
Write-Host "结果: $($script:pass) 项通过, $($script:fail) 项失败"
if ($script:fail -gt 0) { exit 1 }
