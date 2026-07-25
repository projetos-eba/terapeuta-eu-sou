$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$baseUrl = if ($env:PLAYWRIGHT_BASE_URL) { $env:PLAYWRIGHT_BASE_URL } else { "http://localhost:3000" }

function Test-HttpReady($url) {
  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  try {
    $response = $client.GetAsync($url).GetAwaiter().GetResult()
    return [int]$response.StatusCode -lt 500
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (-not (Test-HttpReady $baseUrl)) {
  throw "Next dev server is not responding at $baseUrl. Start it with npm run dev before running this UI smoke."
}

$functionsHealthUrl = "http://127.0.0.1:54321/functions/v1/check-email-verification-status"
try {
  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Options, $functionsHealthUrl)
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  if ([int]$response.StatusCode -ge 500) {
    throw "functions_not_ready"
  }
} catch {
  throw "Supabase Edge Functions are not responding locally. Start them with npm run dev:functions before running this UI smoke."
} finally {
  if ($client) {
    $client.Dispose()
  }
}

$env:PLAYWRIGHT_HEADLESS = "false"
npx playwright test tests/e2e/auth-signup.spec.ts --project=msedge --headed --workers=1
