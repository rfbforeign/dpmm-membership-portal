-- 0006_automation_schedule.sql
--
-- Disable automatic payment reminders and defer expiry until one year after
-- the paid period ends.

CREATE OR REPLACE FUNCTION automation_expire_members(p_lookback_days integer, p_apply boolean)
RETURNS TABLE (out_member_id uuid, out_membership_no text, out_expiry_date date, out_applied boolean)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_apply THEN
    RETURN QUERY
    WITH changed AS (
      UPDATE members m SET status = 'expired'
      WHERE m.deleted_at IS NULL AND m.status = 'active' AND m.expiry_date IS NOT NULL
        AND m.expiry_date <= my_today() - p_lookback_days
      RETURNING m.id, m.membership_no, m.expiry_date
    )
    SELECT c.id, c.membership_no, c.expiry_date, true FROM changed c ORDER BY c.membership_no;
  ELSE
    RETURN QUERY
    SELECT m.id, m.membership_no, m.expiry_date, false
    FROM members m
    WHERE m.deleted_at IS NULL AND m.status = 'active' AND m.expiry_date IS NOT NULL
      AND m.expiry_date <= my_today() - p_lookback_days
    ORDER BY m.membership_no;
  END IF;
END $$;

-- Close out reminders already queued under the previous schedule so they
-- cannot be delivered after the new behavior is deployed.
UPDATE notification_logs
SET status = 'failed',
    attempts = GREATEST(attempts, 3),
    error = 'Automatic payment reminders have been disabled.'
WHERE type = 'renewal_reminder'
  AND status IN ('queued', 'failed');
