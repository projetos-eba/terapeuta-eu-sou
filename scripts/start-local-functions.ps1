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

  throw "Missing local env file. Configure supabase\functions\.env.local, supabase\functions\.env or .env.local before serving functions."
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

$envFile = Join-Path $runtimeDir "local-functions.env"
$content = New-Object System.Collections.Generic.List[string]
$forwardRuntimeSecrets = @(
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PLATFORM_WEBHOOK_SECRET",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
  "STRIPE_CONNECT_V2_WEBHOOK_SECRET"
)
$forwardRuntimeOverrides = @(
  "EMAIL_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SITE_URL"
)
$baseKeys = New-Object System.Collections.Generic.HashSet[string]

foreach ($line in $baseEnvContent) {
  if ($line -match "^\s*SUPABASE_(URL|SERVICE_ROLE_KEY|ANON_KEY|PUBLISHABLE_KEY)\s*=") {
    continue
  }

  if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=" -and $forwardRuntimeOverrides -contains $Matches[1]) {
    [void] $baseKeys.Add($Matches[1])
    continue
  }

  if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=") {
    [void] $baseKeys.Add($Matches[1])
  }

  $content.Add($line)
}

foreach ($key in $forwardRuntimeSecrets) {
  $value = [Environment]::GetEnvironmentVariable($key)
  if (-not [string]::IsNullOrWhiteSpace($value) -and -not $baseKeys.Contains($key)) {
    $content.Add("$key=$value")
  }
}

foreach ($key in $forwardRuntimeOverrides) {
  $value = [Environment]::GetEnvironmentVariable($key)
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $content.Add("$key=$value")
  }
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($envFile, [string[]] $content, $utf8NoBom)

function Stop-LocalEdgeRuntimeContainer {
  $containerName = "supabase_edge_runtime_$(Split-Path -Leaf (Get-Location))"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    docker stop $containerName 2>$null | Out-Null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

Stop-LocalEdgeRuntimeContainer

$env:SUPABASE_URL = $supabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
$env:SUPABASE_ANON_KEY = $anonKey
$env:SUPABASE_PUBLISHABLE_KEY = $anonKey

try {
  & npx supabase functions serve --env-file $envFile --no-verify-jwt
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
}
