CREATE TABLE IF NOT EXISTS sms_commands (
  id SERIAL PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  handler TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id SERIAL PRIMARY KEY,
  sender VARCHAR(32) NOT NULL,
  shortcode VARCHAR(16) NOT NULL,
  body TEXT,
  received_at TIMESTAMP DEFAULT now(),
  handled BOOLEAN DEFAULT false,
  response_text TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(32) UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);
