param(
  [string]$BaseUrl = $(if ($env:PLAYWRIGHT_BASE_URL) { $env:PLAYWRIGHT_BASE_URL } else { "http://127.0.0.1:3000" }),
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$startedProcess = $null

function Test-AppReady {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-PortAvailable {
  param([int]$CandidatePort)

  $listener = $null

  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $CandidatePort)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Get-FreePort {
  param([int]$StartPort)

  for ($candidate = $StartPort; $candidate -lt ($StartPort + 20); $candidate++) {
    if (Test-PortAvailable -CandidatePort $candidate) {
      return $candidate
    }
  }

  throw "No free local port found from $StartPort to $($StartPort + 19)."
}

function Stop-ProcessTree {
  param([int]$RootProcessId)

  $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $RootProcessId }

  foreach ($child in $children) {
    Stop-ProcessTree -RootProcessId $child.ProcessId
  }

  Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
}

try {
  if (-not (Test-AppReady -Url $BaseUrl)) {
    $Port = Get-FreePort -StartPort $Port
    $BaseUrl = "http://127.0.0.1:$Port"
    $logsDir = Join-Path (Get-Location) ".playwright-mcp"
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    $stdout = Join-Path $logsDir "payments-headed-next.out.log"
    $stderr = Join-Path $logsDir "payments-headed-next.err.log"

    $startedProcess = Start-Process -FilePath "npm.cmd" `
      -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "$Port") `
      -WorkingDirectory (Get-Location) `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr `
      -PassThru

    $deadline = (Get-Date).AddSeconds(45)

    while ((Get-Date) -lt $deadline) {
      if (Test-AppReady -Url $BaseUrl) {
        break
      }

      Start-Sleep -Seconds 1
    }

    if (-not (Test-AppReady -Url $BaseUrl)) {
      throw "Next dev server did not become ready at $BaseUrl."
    }
  }

  $env:PLAYWRIGHT_BASE_URL = $BaseUrl
  $env:PLAYWRIGHT_HEADLESS = "false"

  npx playwright test tests/e2e/payments-checkout.spec.ts --project=chromium --headed
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($startedProcess -and -not $startedProcess.HasExited) {
    Stop-ProcessTree -RootProcessId $startedProcess.Id
  }
}
