#requires -Version 7.0
param([string]$Container = 'supabase_db_terapeuta-eu-sou')

$ErrorActionPreference = 'Stop'

# The first connection records a test Payout and deliberately keeps its
# transaction open. The second connection invokes the real V3 reconciler for
# the same account/Payout. It must wait on the shared advisory lock, then finish
# after the first transaction rolls back. No fixture survives this test.
$holderSql = @'
\set ON_ERROR_STOP on
BEGIN;
SELECT public.record_automatic_stripe_payout_v1(
  'po_test_deadlock_serialization_156',
  (SELECT stripe_account_id
   FROM public.therapist_connect_accounts
   WHERE stripe_account_id IS NOT NULL
   ORDER BY created_at
   LIMIT 1),
  100, 'BRL', 'paid', 'completed',
  'evt_test_deadlock_serialization_156', now(),
  'txn_test_deadlock_serialization_156', 'bank_account', now(), null, null
);
SELECT 'PAYOUT_LOCK_READY';
SELECT pg_sleep(6);
ROLLBACK;
'@

$holderStart = [System.Diagnostics.ProcessStartInfo]::new('docker')
$holderStart.UseShellExecute = $false
$holderStart.CreateNoWindow = $true
$holderStart.RedirectStandardInput = $true
$holderStart.RedirectStandardOutput = $true
$holderStart.RedirectStandardError = $true
foreach ($argument in @(
  'exec', '-i', $Container, 'psql', '-U', 'postgres', '-d', 'postgres',
  '-X', '-qAt'
)) {
  $holderStart.ArgumentList.Add($argument)
}

$holder = [System.Diagnostics.Process]::Start($holderStart)
try {
  $holderErrors = $holder.StandardError.ReadToEndAsync()
  $holder.StandardInput.WriteLine($holderSql)
  $holder.StandardInput.Close()

  $ready = $false
  while (($line = $holder.StandardOutput.ReadLine()) -ne $null) {
    if ($line -eq 'PAYOUT_LOCK_READY') {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    throw "Payout lock fixture failed: $($holderErrors.GetAwaiter().GetResult())"
  }

  $unrelatedSql = @'
\set ON_ERROR_STOP on
BEGIN;
SELECT public.reconcile_automatic_stripe_payout_v3(
  'po_test_unrelated_serialization_156',
  (SELECT stripe_account_id
   FROM public.therapist_connect_accounts
   WHERE stripe_account_id IS NOT NULL
   ORDER BY created_at
   LIMIT 1),
  '[]'::jsonb,
  now()
) ->> 'reason';
ROLLBACK;
'@

  $unrelatedStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $unrelatedOutput = @(
    $unrelatedSql |
      docker exec -i $Container psql -U postgres -d postgres -X -qAt -v ON_ERROR_STOP=1
  )
  $unrelatedExitCode = $LASTEXITCODE
  $unrelatedStopwatch.Stop()

  if ($unrelatedExitCode -ne 0) {
    throw 'Unrelated Payout reconciliation failed.'
  }
  if (($unrelatedOutput -join "`n") -notmatch 'payout_not_found') {
    throw "Unrelated Payout reconciliation returned an unexpected result: $($unrelatedOutput -join ',')"
  }
  if ($unrelatedStopwatch.ElapsedMilliseconds -ge 2000) {
    throw "An unrelated Payout was serialized unnecessarily ($($unrelatedStopwatch.ElapsedMilliseconds) ms)."
  }

  $workerSql = @'
\set ON_ERROR_STOP on
BEGIN;
SELECT public.reconcile_automatic_stripe_payout_v3(
  'po_test_deadlock_serialization_156',
  (SELECT stripe_account_id
   FROM public.therapist_connect_accounts
   WHERE stripe_account_id IS NOT NULL
   ORDER BY created_at
   LIMIT 1),
  '[]'::jsonb,
  now()
) ->> 'reason';
ROLLBACK;
'@

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $workerOutput = @(
    $workerSql |
      docker exec -i $Container psql -U postgres -d postgres -X -qAt -v ON_ERROR_STOP=1
  )
  $workerExitCode = $LASTEXITCODE
  $stopwatch.Stop()

  $remainingOutput = $holder.StandardOutput.ReadToEnd()
  $holder.WaitForExit()
  $holderErrorText = $holderErrors.GetAwaiter().GetResult()

  if ($holder.ExitCode -ne 0) {
    throw "Payout lock holder failed: $holderErrorText"
  }
  if ($workerExitCode -ne 0) {
    throw 'Concurrent reconciler failed instead of waiting safely.'
  }
  if (($workerOutput -join "`n") -notmatch 'payout_not_found') {
    throw "Concurrent reconciler returned an unexpected result: $($workerOutput -join ',')"
  }
  if ($stopwatch.ElapsedMilliseconds -lt 3000) {
    throw "Concurrent reconciler did not wait for the same-Payout lock ($($stopwatch.ElapsedMilliseconds) ms)."
  }
  if ($remainingOutput -match 'deadlock detected' -or $holderErrorText -match 'deadlock detected') {
    throw 'A deadlock was detected during same-Payout serialization.'
  }

  Write-Output (
    'PASS: unrelated Payout completed in {0} ms; same-Payout reconciliation waited {1} ms without deadlock; all transactions rolled back.' -f
      $unrelatedStopwatch.ElapsedMilliseconds,
      $stopwatch.ElapsedMilliseconds
  )
} finally {
  if (-not $holder.HasExited) {
    $holder.Kill($true)
    $holder.WaitForExit()
  }
  $holder.Dispose()
}
