-- 0005_email_template_variables.sql
--
-- Persist the variables used to render queued emails through the shared
-- Resend transactional template.

ALTER TABLE notification_logs
  ADD COLUMN template_variables jsonb;
