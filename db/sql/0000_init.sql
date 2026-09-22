-- =====================================================================
-- DPMM Membership Management System — initial schema (PostgreSQL 15+, Neon)
-- Derived from: DPMM_Membership_Tracker_6.xlsx
--   Members            -> members (+ lookup tables)
--   Membership Types   -> membership_types
--   Invoices           -> invoices (+ invoice_items)
--   Payments           -> payments
--   Notification Logs  -> notification_logs
--   Dashboard formulas -> dashboard_metrics view
-- New (not in the workbook): users, membership_periods, audit_logs
--
-- STATUS: written against the workbook analysis; not yet executed on a
-- live Postgres. Run it on a Neon dev branch first.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fast fuzzy search for the member directory
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed for the no-overlap constraint on periods

-- ---------------------------------------------------------------------
-- Enums (value sets that come from the workbook's dropdowns)
-- ---------------------------------------------------------------------
CREATE TYPE user_role            AS ENUM ('member', 'secretariat', 'treasurer', 'admin');
CREATE TYPE entity_type          AS ENUM ('individual', 'company', 'cooperative');
CREATE TYPE member_status        AS ENUM ('pending', 'active', 'expired', 'suspended');
CREATE TYPE invoice_type         AS ENUM ('registration', 'renewal', 'other');
CREATE TYPE invoice_status       AS ENUM ('unpaid', 'paid', 'cancelled');   -- "overdue" is derived: unpaid AND due_date < today
CREATE TYPE payment_method       AS ENUM ('fpx', 'credit_card', 'bank_transfer', 'cash', 'other');
CREATE TYPE payment_status       AS ENUM ('pending', 'successful', 'failed');
CREATE TYPE notification_type    AS ENUM ('registration', 'renewal_reminder', 'invoice', 'payment_receipt', 'alert');
CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp');
CREATE TYPE notification_status  AS ENUM ('queued', 'sent', 'failed');

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- users: login accounts. NOT the same as members — several memberships
-- can share one login (the workbook has one person holding 2 companies,
-- and 4 emails shared across 7 members).
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext NOT NULL UNIQUE,
  name              text,
  password_hash     text,                       -- NULL if using magic-link / OAuth only
  role              user_role NOT NULL DEFAULT 'member',
  is_active         boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- membership_types  <- "Membership Types" sheet (Fasal 6.2.x)
-- ---------------------------------------------------------------------
CREATE TABLE membership_types (
  id               smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fasal            text NOT NULL UNIQUE,        -- '6.2.1' ... '6.2.6'
  category         text NOT NULL,
  entity_type      entity_type NOT NULL,        -- replaces the sheet's "Entity Type (Legacy)" column
  registration_fee numeric(10,2) NOT NULL CHECK (registration_fee >= 0),
  annual_fee       numeric(10,2) NOT NULL CHECK (annual_fee >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       smallint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Lookup tables. The sheet has free-text values with spelling variants
-- (e.g. "PERDANGANGAN" vs "PERDAGANGAN", "F&B" vs "BAVERAGES"); the
-- import maps each variant to one canonical row here.
-- ---------------------------------------------------------------------
CREATE TABLE business_sectors (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE business_types (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE introducers (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- members  <- "Members" sheet
-- full_name  = the person (for companies: the director / representative)
-- company_name = the business / trading name
-- ---------------------------------------------------------------------
CREATE SEQUENCE membership_no_seq START 249;    -- workbook currently ends at PJ-2026-0248

CREATE TABLE members (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_no        text NOT NULL UNIQUE,      -- 'PJ-2026-0001'
  legacy_membership_no text UNIQUE,               -- 'DPMMPTJ/0034/IN/34'
  user_id              uuid REFERENCES users(id) ON DELETE SET NULL,
  membership_type_id   smallint NOT NULL REFERENCES membership_types(id),
  status               member_status NOT NULL DEFAULT 'pending',

  full_name            text NOT NULL,
  company_name         text,
  email                citext NOT NULL,           -- deliberately NOT unique (shared emails exist)
  phone                text,                      -- import normalises to +60 format
  office_tel           text,
  ic_no                text,                      -- sensitive (PDPA): encrypt/restrict in the app layer
  ssm_no               text,                      -- kept as text: 37 rows hold two numbers (new + old format)

  business_sector_id   smallint REFERENCES business_sectors(id),
  business_type_id     smallint REFERENCES business_types(id),
  introducer_id        smallint REFERENCES introducers(id),

  mailing_address      text,
  registered_address   text,

  joined_date          date NOT NULL,             -- sheet stores this as text; 10 rows are timestamps
  expiry_date          date,                      -- blank for all 248 rows in the sheet; maintained from membership_periods

  -- Preserved from the sheet for traceability during the migration:
  legacy_entity_type   text,                      -- 'Individu' / 'Syarikat'
  legacy_payment_year  smallint,                  -- "Payment Year"
  legacy_data          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- raw "Receipt No" + "Payment Notes" text etc.

  admin_notes          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,               -- soft delete

  CONSTRAINT members_ic_not_placeholder CHECK (ic_no IS NULL OR ic_no <> '0')  -- sheet uses "0" for missing IC
);

CREATE INDEX members_status_idx       ON members (status)             WHERE deleted_at IS NULL;
CREATE INDEX members_type_idx         ON members (membership_type_id);
CREATE INDEX members_expiry_idx       ON members (expiry_date)        WHERE deleted_at IS NULL;
CREATE INDEX members_email_idx        ON members (email);
CREATE INDEX members_ic_idx           ON members (ic_no)              WHERE ic_no IS NOT NULL;
CREATE INDEX members_user_idx         ON members (user_id);
CREATE INDEX members_name_trgm_idx    ON members USING gin (full_name    gin_trgm_ops);
CREATE INDEX members_company_trgm_idx ON members USING gin (company_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- invoices / invoice_items  <- "Invoices" sheet
-- ---------------------------------------------------------------------
CREATE SEQUENCE invoice_no_seq START 2;         -- workbook has one sample invoice: INV-2026-0001

CREATE TABLE invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no    text NOT NULL UNIQUE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  invoice_type  invoice_type NOT NULL DEFAULT 'renewal',
  description   text,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),   -- total; equals the sum of invoice_items
  status        invoice_status NOT NULL DEFAULT 'unpaid',
  issued_date   date NOT NULL DEFAULT current_date,
  due_date      date NOT NULL,
  period_start  date,                            -- membership period this invoice pays for
  period_end    date,
  sent_at       timestamptz,
  cancelled_at  timestamptz,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_due_after_issue CHECK (due_date >= issued_date),
  CONSTRAINT invoices_period_valid    CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start)
);

CREATE INDEX invoices_member_idx ON invoices (member_id);
CREATE INDEX invoices_status_due_idx ON invoices (status, due_date);

CREATE TABLE invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,                     -- e.g. 'Registration fee', 'Annual fee 2026'
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount numeric(12,2) NOT NULL CHECK (unit_amount >= 0),
  line_total  numeric(12,2) GENERATED ALWAYS AS (quantity * unit_amount) STORED,
  sort_order  smallint NOT NULL DEFAULT 0
);

CREATE INDEX invoice_items_invoice_idx ON invoice_items (invoice_id);

-- ---------------------------------------------------------------------
-- payments  <- "Payments" sheet
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE,           -- 'TXN-000123'
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  member_id      uuid NOT NULL REFERENCES members(id)  ON DELETE RESTRICT,
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  method         payment_method NOT NULL,
  status         payment_status NOT NULL DEFAULT 'pending',
  paid_at        timestamptz,
  gateway        text,                           -- e.g. name of the online gateway; NULL for manual entries
  gateway_ref    text,                           -- gateway's transaction id (idempotency for webhooks)
  bank_reference text,                           -- manual bank-transfer reference (currently buried in Payment Notes)
  receipt_no     text,
  proof_url      text,                           -- uploaded transfer slip
  raw_payload    jsonb,                          -- last webhook payload, for debugging
  recorded_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_paid_at_when_successful CHECK (status <> 'successful' OR paid_at IS NOT NULL)
);

CREATE INDEX payments_invoice_idx ON payments (invoice_id);
CREATE INDEX payments_member_idx  ON payments (member_id);
CREATE UNIQUE INDEX payments_gateway_ref_uidx ON payments (gateway, gateway_ref) WHERE gateway_ref IS NOT NULL;

-- ---------------------------------------------------------------------
-- membership_periods: the source of truth for "paid up until when".
-- Replaces the blank "Expiry Date" column and the "Payment Year" /
-- "Receipt No" / "Payment Notes" text (e.g. '23/4/25-22/4/26', 'FOR 3 YRS').
-- members.expiry_date = MAX(period_end) for that member.
-- ---------------------------------------------------------------------
CREATE TABLE membership_periods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  invoice_id   uuid REFERENCES invoices(id) ON DELETE SET NULL,
  source       text NOT NULL DEFAULT 'invoice' CHECK (source IN ('invoice', 'legacy_import', 'manual')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_periods_valid CHECK (period_end >= period_start),
  CONSTRAINT membership_periods_no_overlap
    EXCLUDE USING gist (member_id WITH =, daterange(period_start, period_end, '[]') WITH &&)
);

CREATE INDEX membership_periods_member_idx ON membership_periods (member_id, period_end DESC);

-- ---------------------------------------------------------------------
-- notification_logs  <- "Notification Logs" sheet
-- dedupe_key stops the daily cron from sending the same reminder twice,
-- e.g. 'renewal_reminder:<member_id>:2027-01-31:30d'
-- ---------------------------------------------------------------------
CREATE TABLE notification_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           uuid REFERENCES members(id)  ON DELETE SET NULL,
  invoice_id          uuid REFERENCES invoices(id) ON DELETE SET NULL,
  type                notification_type NOT NULL,
  channel             notification_channel NOT NULL DEFAULT 'email',
  recipient           text NOT NULL,
  subject             text,
  message             text,
  status              notification_status NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error               text,
  dedupe_key          text UNIQUE,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_logs_member_idx ON notification_logs (member_id, created_at DESC);
CREATE INDEX notification_logs_status_idx ON notification_logs (status) WHERE status <> 'sent';

-- ---------------------------------------------------------------------
-- audit_logs: who changed what (important for an NGO handling member data)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,                     -- 'member.update', 'payment.record', ...
  entity_type text NOT NULL,
  entity_id   text,
  changes     jsonb,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
CREATE TRIGGER users_set_updated_at            BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER membership_types_set_updated_at BEFORE UPDATE ON membership_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER members_set_updated_at          BEFORE UPDATE ON members          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoices_set_updated_at         BEFORE UPDATE ON invoices         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_set_updated_at         BEFORE UPDATE ON payments         FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- dashboard_metrics: replaces the formulas on the workbook's Dashboard sheet
-- Note: total_invoiced excludes cancelled invoices (the workbook's SUM did not).
-- ---------------------------------------------------------------------
CREATE VIEW dashboard_metrics AS
SELECT
  (SELECT count(*) FROM members WHERE deleted_at IS NULL)                            AS total_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'active')      AS active_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'pending')     AS pending_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'expired')     AS expired_members,
  (SELECT count(*) FROM members WHERE deleted_at IS NULL AND status = 'suspended')   AS suspended_members,
  (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'successful')        AS total_revenue,
  (SELECT COALESCE(sum(amount), 0) FROM invoices WHERE status <> 'cancelled')        AS total_invoiced,
  (SELECT COALESCE(sum(amount), 0) FROM invoices WHERE status = 'unpaid')            AS outstanding_amount,
  (SELECT count(*) FROM invoices WHERE status = 'unpaid')                            AS unpaid_invoices,
  (SELECT count(*) FROM invoices WHERE status = 'unpaid' AND due_date < current_date) AS overdue_invoices;

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------
-- From the "Membership Types" sheet (only 6.2.1 and 6.2.5 are used by current members).
INSERT INTO membership_types (fasal, category, entity_type, registration_fee, annual_fee, sort_order) VALUES
  ('6.2.1', 'Ahli Biasa (Individu) - Tuan Punya Tunggal/Bersama', 'individual',  50,  50, 1),
  ('6.2.2', 'Ahli Biasa (Individu) - Perniagaan Berlesen',         'individual',  50,  50, 2),
  ('6.2.3', 'Ahli Biasa (Profesional)',                            'individual', 200, 150, 3),
  ('6.2.4', 'Ahli Biasa (Syarikat) - Milik Kerajaan 100%',         'company',    200, 150, 4),
  ('6.2.5', 'Ahli Biasa (Syarikat) - Milik Melayu 100%',           'company',    200, 150, 5),
  ('6.2.6', 'Ahli Biasa (Koperasi) - Milik Melayu 100%',           'cooperative',200, 150, 6);

-- Canonical lookup values. The workbook's misspelled / variant spellings are mapped to these at import time.
-- (Review the wording: "TEKNOLOGI DAN DIGITAL" corrects the sheet's "TEKNOLOGI DAN DAN DIGITAL".)
INSERT INTO business_sectors (name) VALUES
  ('SEKTOR PERKHIDMATAN PROFESIONAL'),
  ('SEKTOR PERDAGANGAN DAN RUNCIT'),
  ('SEKTOR INFRASTRUKTUR & PEMBANGUNAN'),
  ('SEKTOR GAYA HIDUP DAN KREATIF'),
  ('SEKTOR TEKNOLOGI DAN DIGITAL'),
  ('SEKTOR LOGISTIK DAN MOBILITY'),
  ('SEKTOR TENAGA'),
  ('SEKTOR KOMODITI DAN AGRO'),
  ('SEKTOR HALAL');

INSERT INTO business_types (name) VALUES
  ('PROFESSIONAL & BUSINESS SERVICES'),
  ('CONSTRUCTION, CONTRACTORS & FACILITY MANAGEMENT'),
  ('TRADING, IMPORT & EXPORT'),
  ('FASHION, APPARELS & LIFESTYLE'),
  ('INFORMATION TECHNOLOGY & TELECOMMUNICATIONS (ICT)'),
  ('FOOD & BEVERAGES (F&B) & AGRICULTURE'),
  ('AUTOMOTIVE, MOBILITY & ENGINEERING'),
  ('FINANCE, INVESTMENT & EDUCATION'),
  ('TOURISM, EVENTS, HOSPITALITY & ENTERTAINMENT');

COMMIT;
