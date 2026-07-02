import { pool } from "./db.js";

const migration = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(11) UNIQUE,
  email varchar(254) UNIQUE,
  password_hash text,
  display_name varchar(100),
  google_subject varchar(255) UNIQUE,
  role varchar(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(40) NOT NULL DEFAULT 'خانه',
  recipient_name varchar(100) NOT NULL,
  phone varchar(11) NOT NULL,
  province varchar(80) NOT NULL,
  city varchar(80) NOT NULL,
  postal_code varchar(10) NOT NULL,
  address_line varchar(500) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default
  ON user_addresses(user_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON user_addresses(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);
`;

try {
  await pool.query(migration);
  await pool.query("DELETE FROM user_sessions WHERE expires_at < now()");
  console.log("Database migration completed.");
} finally {
  await pool.end();
}
