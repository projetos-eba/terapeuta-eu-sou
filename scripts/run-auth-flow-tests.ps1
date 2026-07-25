$ErrorActionPreference = "Stop"

$runtimeDir = Join-Path (Get-Location) ".codex\runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Resolve-BaseEnvFile {
  $functionEnvFile = "supabase\functions\.env.local"
  if (Test-Path -LiteralPath $functionEnvFile) {
    return $functionEnvFile
  }

  $functionDefaultEnvFile = "supabase\functions\.env"
  if (Test-Path -LiteralPath $functionDefaultEnvFile) {
    return $functionDefaultEnvFile
  }

  $rootEnvFile = ".env.local"
  if (Test-Path -LiteralPath $rootEnvFile) {
    return $rootEnvFile
  }

  throw "Missing local env file. Configure supabase\functions\.env.local, supabase\functions\.env or .env.local before running auth flow tests."
}

$statusOutput = & cmd.exe /c "npx supabase status -o env 2>NUL"
$envMap = @{}

foreach ($line in $statusOutput) {
  if ($line -match "^([^=]+)=(.*)$") {
    $envMap[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}

$supabaseUrl = $envMap["API_URL"]
$anonKey = $envMap["ANON_KEY"]
$serviceRoleKey = $envMap["SERVICE_ROLE_KEY"]

if (-not $supabaseUrl -or -not $anonKey -or -not $serviceRoleKey) {
  throw "Local Supabase API_URL, ANON_KEY or SERVICE_ROLE_KEY not found. Run npx supabase start first."
}

$baseEnvFile = Resolve-BaseEnvFile

$baseEnvContent = Get-Content -LiteralPath $baseEnvFile -ErrorAction Stop
$masterLine = $baseEnvContent | Where-Object { $_ -match "^\s*MASTER_PASSWORD\s*=\s*.+" } | Select-Object -First 1
$recipientLine = $baseEnvContent | Where-Object { $_ -match "^\s*EMAIL_E2E_RECIPIENT\s*=\s*.+" } | Select-Object -First 1

if (-not $masterLine) {
  throw "MASTER_PASSWORD must be configured in $baseEnvFile for auth flow tests."
}

if (-not $recipientLine) {
  throw "EMAIL_E2E_RECIPIENT must be configured in $baseEnvFile for auth flow tests."
}

function Get-EnvLineValue {
  param([Parameter(Mandatory = $true)][string] $Line)

  $value = ($Line -replace "^[^=]+=", "").Trim()
  if (
    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
    ($value.StartsWith("'") -and $value.EndsWith("'"))
  ) {
    return $value.Substring(1, $value.Length - 2)
  }

  return ($value -replace "\s+#.*$", "").Trim()
}

$masterPassword = Get-EnvLineValue -Line $masterLine
$emailRecipient = Get-EnvLineValue -Line $recipientLine

function New-AuthEnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path,
    [Parameter(Mandatory = $true)]
    [ValidateSet("true", "false")]
    [string] $AutoConfirm
  )

  $content = New-Object System.Collections.Generic.List[string]
  foreach ($line in $baseEnvContent) {
    if ($line -match "^\s*SUPABASE_(URL|SERVICE_ROLE_KEY|ANON_KEY|PUBLISHABLE_KEY)\s*=") {
      continue
    }
    if ($line -match "^\s*(MASTER_PASSWORD|EMAIL_E2E_RECIPIENT)\s*=") {
      continue
    }
    if ($line -match "^\s*CONFIRMED_AUTOMATICALLY_EMAIL\s*=") {
      continue
    }
    $content.Add($line)
  }

  $content.Add("MASTER_PASSWORD=$(ConvertTo-DotenvQuotedValue -Value $masterPassword)")
  $content.Add("EMAIL_E2E_RECIPIENT=$(ConvertTo-DotenvQuotedValue -Value $emailRecipient)")
  $content.Add("CONFIRMED_AUTOMATICALLY_EMAIL=$AutoConfirm")

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllLines(
    (Resolve-Path -LiteralPath (Split-Path -Parent $Path)).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $Path),
    [string[]] $content,
    $utf8NoBom
  )
}

function ConvertTo-DotenvQuotedValue {
  param([Parameter(Mandatory = $true)][string] $Value)

  $escaped = $Value.Replace("\", "\\").Replace('"', '\"')
  return "`"$escaped`""
}

function Stop-ProcessTree {
  param([Parameter(Mandatory = $true)][int] $ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-LocalEdgeRuntimeContainer {
  $containerName = "supabase_edge_runtime_$(Split-Path -Leaf (Get-Location))"
  docker stop $containerName 2>$null | Out-Null
}

function Invoke-AuthFlowMode {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("normal", "auto")]
    [string] $Mode
  )

  $autoConfirm = if ($Mode -eq "auto") { "true" } else { "false" }
  $envFile = Join-Path $runtimeDir "auth-flow-$Mode.env"
  $outLog = Join-Path $runtimeDir "auth-flow-$Mode.out.log"
  $errLog = Join-Path $runtimeDir "auth-flow-$Mode.err.log"
  Stop-LocalEdgeRuntimeContainer
  New-AuthEnvFile -Path $envFile -AutoConfirm $autoConfirm

  $command = "npx supabase functions serve --env-file `"$envFile`" --no-verify-jwt"
  $env:SUPABASE_URL = $supabaseUrl
  $env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
  $env:SUPABASE_ANON_KEY = $anonKey
  $env:SUPABASE_PUBLISHABLE_KEY = $anonKey
  $env:MASTER_PASSWORD = $masterPassword
  $env:EMAIL_E2E_RECIPIENT = $emailRecipient
  $env:CONFIRMED_AUTOMATICALLY_EMAIL = $autoConfirm
  $process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList @("/c", $command) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

  try {
    $deadline = (Get-Date).AddSeconds(45)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
      try {
        Invoke-WebRequest `
          -UseBasicParsing `
          -Uri "$supabaseUrl/functions/v1/client-auth-login" `
          -Method Options `
          -TimeoutSec 3 | Out-Null
        $ready = $true
        break
      } catch {
        Start-Sleep -Milliseconds 750
      }
    }

    if (-not $ready) {
      throw "Supabase functions serve did not become ready for mode $Mode."
    }

    $env:AUTH_FLOW_MODE = $Mode
    & deno run `
      --allow-env `
      --allow-net `
      --config supabase/functions/deno.json `
      supabase/functions/_shared/auth/auth-flow-integration-test.ts

    if ($LASTEXITCODE -ne 0) {
      throw "Auth flow integration test failed for mode $Mode."
    }
  } finally {
    Remove-Item Env:AUTH_FLOW_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:MASTER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:EMAIL_E2E_RECIPIENT -ErrorAction SilentlyContinue
    Remove-Item Env:CONFIRMED_AUTOMATICALLY_EMAIL -ErrorAction SilentlyContinue

    if ($process) {
      Stop-ProcessTree -ProcessId $process.Id
      Stop-LocalEdgeRuntimeContainer
      Start-Sleep -Seconds 2
    }
  }
}

Invoke-AuthFlowMode -Mode "normal"
Invoke-AuthFlowMode -Mode "auto"

Write-Host "Auth flow integration tests completed."
