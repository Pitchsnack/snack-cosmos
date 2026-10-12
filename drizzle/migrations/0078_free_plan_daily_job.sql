CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'free-plan-daily';
SELECT cron.schedule('free-plan-daily', '5 17 * * *',
  $$SELECT net.http_post(url := 'https://pitchsnack.com/api/public/free-plan-job', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb)$$);