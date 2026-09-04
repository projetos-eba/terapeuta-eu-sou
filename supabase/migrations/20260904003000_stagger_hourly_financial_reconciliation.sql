do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'tes-financial-reconciliation-hourly-v1';

  if v_job_id is not null then
    perform cron.alter_job(v_job_id, schedule => '17 * * * *');
  end if;
end $$;
