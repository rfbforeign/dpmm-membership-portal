-- 0001_auth.sql: sign-in support
-- Adds account lockout tracking to users and a sessions table.
-- Sessions are stored server-side (only a SHA-256 hash of the cookie token is kept),
-- so signing out, deactivating a user or changing a password takes effect immediately.

ALTER TABLE users
  ADD COLUMN failed_login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz;

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
