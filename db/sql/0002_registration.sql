-- 0002_registration.sql: online membership applications
-- Records when an applicant agreed to the personal-data (PDPA) notice on the registration form.
-- NULL for members imported from the old spreadsheet, who have not been asked yet.

ALTER TABLE members ADD COLUMN pdpa_consent_at timestamptz;
