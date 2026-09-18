#requires -Version 7.0
param([string]$Container = 'supabase_db_terapeuta-eu-sou')
$ErrorActionPreference = 'Stop'
$patientRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$patientMigration = Get-Content -Raw (Join-Path $patientRepoRoot 'supabase/migrations/20260918140000_admin_patient_booking_restrictions.sql')

# Only use the explicitly named local container. All DDL and fixture operations
# remain inside the first transaction and roll back; the worker only tries locks.
$patientFixtureSql = @'
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000090',true);
DO $$ BEGIN
  PERFORM public.admin_execute_operation_command_v2('patient.suspend',
    'b1000000-0000-4000-8000-000000000001','Concurrency fixture reason','client-concurrency-command-140');
END; $$;
INSERT INTO public.bookings (patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status)
VALUES ('b1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001',
  '2099-05-07 10:00Z','2099-05-07 10:50Z','America/Sao_Paulo','draft','not_started');
SELECT 'PATIENT_LOCKS_READY';
SELECT pg_sleep(4);
ROLLBACK;
'@
$patientMainSql = "\set ON_ERROR_STOP on`nBEGIN;`n" + $patientMigration + "`n" + $patientFixtureSql
$patientStart = [System.Diagnostics.ProcessStartInfo]::new('docker')
$patientStart.UseShellExecute = $false
$patientStart.CreateNoWindow = $true
$patientStart.RedirectStandardInput = $true
$patientStart.RedirectStandardOutput = $true
$patientStart.RedirectStandardError = $true
foreach ($patientArg in @('exec','-i',$Container,'psql','-U','postgres','-d','postgres','-X','-At')) {
  $patientStart.ArgumentList.Add($patientArg)
}
$patientProcess = [System.Diagnostics.Process]::Start($patientStart)
try {
  $patientErrors = $patientProcess.StandardError.ReadToEndAsync()
  $patientProcess.StandardInput.WriteLine($patientMainSql)
  $patientProcess.StandardInput.Close()
  $patientReady = $false
  while (($patientLine = $patientProcess.StandardOutput.ReadLine()) -ne $null) {
    if ($patientLine -eq 'PATIENT_LOCKS_READY') { $patientReady = $true; break }
  }
  if (-not $patientReady) { throw "Local fixture failed: $($patientErrors.GetAwaiter().GetResult())" }
  $patientWorkerSql = @'
SELECT pg_try_advisory_xact_lock(hashtextextended('tes:patient-booking-restriction:b1000000-0000-4000-8000-000000000001',0));
SELECT pg_try_advisory_xact_lock(hashtextextended('tes:patient-booking-restriction:b1000000-0000-4000-8000-000000000002',0));
'@
  $patientWorkerResult = @($patientWorkerSql | docker exec -i $Container psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1)
  if ($LASTEXITCODE -ne 0 -or ($patientWorkerResult -join ',') -ne 'f,f') {
    throw 'Concurrent worker unexpectedly acquired an Admin or booking INSERT restriction lock.'
  }
  $patientRemaining = $patientProcess.StandardOutput.ReadToEnd()
  $patientProcess.WaitForExit()
  if ($patientProcess.ExitCode -ne 0 -or $patientRemaining -notmatch 'ROLLBACK') {
    throw "Local verification did not finish with rollback: $($patientErrors.GetAwaiter().GetResult())"
  }
  Write-Output 'PASS: both Admin and booking INSERT locks block a second connection; transaction rolled back.'
} finally {
  if (-not $patientProcess.HasExited) { $patientProcess.WaitForExit() }
  $patientProcess.Dispose()
}
