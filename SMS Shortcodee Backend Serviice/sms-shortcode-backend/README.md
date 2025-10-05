# SMS Shortcode Backend (Twilio + Generic Aggregator)

## Overview
This repository contains a Node.js (Express) backend that accepts inbound SMS webhooks from an SMS aggregator (Twilio or a generic provider), maps short numeric codes (e.g. `1`, `2`) to services, supports multi-step sessions with Redis, logs messages in Postgres, and sends outbound SMS replies either via Twilio or a generic aggregator outbound API.

## Quickstart (local)
1. Copy `.env.example` to `.env` and fill values (or set env vars).
2. Start with Docker Compose:
   ```bash
   docker compose up --build
   ```
3. Run migrations to create tables (connect to Postgres and run `migrations/001_create_tables.sql`).
4. Expose local server to the internet (for testing webhooks) using `ngrok`:
   ```bash
   ngrok http 3000
   ```
   Set your aggregator webhook to: `https://<ngrok-id>.ngrok.io/sms-handler`

## Endpoints
- `POST /sms-handler` — main webhook for inbound SMS
- `GET /health` — health check

## Add a new command
Insert into `sms_commands`:
```sql
INSERT INTO sms_commands(code,name,handler,config) VALUES('4','check_offers','offers', '{"endpoint":"https://api.platform/offers"}');
```

## Notes
- For India, ensure DLT registration and approved templates for outbound messages.
- The `smsGateway` abstraction chooses Twilio or a generic outbound API based on `SMS_GATEWAY` env var.

