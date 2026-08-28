$ErrorActionPreference = "Stop"

$statusOutput = & cmd.exe /c "npx supabase status -o env 2>NUL"
$serviceRoleLine = $statusOutput |
  Where-Object { $_ -match "^SERVICE_ROLE_KEY=" } |
  Select-Object -First 1

if (-not $serviceRoleLine) {
  throw "Local Supabase SERVICE_ROLE_KEY not found. Run npx supabase start first."
}

$serviceRoleKey = ($serviceRoleLine -replace "^SERVICE_ROLE_KEY=", "").Trim()

if (
  ($serviceRoleKey.StartsWith('"') -and $serviceRoleKey.EndsWith('"')) -or
  ($serviceRoleKey.StartsWith("'") -and $serviceRoleKey.EndsWith("'"))
) {
  $serviceRoleKey = $serviceRoleKey.Substring(1, $serviceRoleKey.Length - 2)
}

if (-not $serviceRoleKey) {
  throw "Local Supabase SERVICE_ROLE_KEY is empty."
}

$env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey

try {
  $envFiles = @(
    ".env.local",
    "supabase/functions/.env",
    "supabase/functions/.env.local"
  ) | Where-Object { Test-Path -LiteralPath $_ }

  $denoArgs = @(
    "run",
    "--allow-env",
    "--allow-net",
    "--allow-read=.tmp",
    "--allow-write=.tmp"
  )
  foreach ($envFile in $envFiles) {
    $denoArgs += "--env-file=$envFile"
  }
  $denoArgs += @(
    "--config",
    "supabase/functions/deno.json",
    "supabase/functions/_shared/email/real-email-test.ts"
  )

  & deno @denoArgs

  exit $LASTEXITCODE
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
}
