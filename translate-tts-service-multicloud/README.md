# Translate-TTS Multi-Cloud Service (AWS, GCP, Azure)

This repository contains a Node.js microservice that:
1. Accepts JSON `{ message, targetLanguage, provider }`.
2. Translates `message` to `targetLanguage` using AWS/GCP/Azure translation services.
3. Synthesizes speech using Amazon Polly, Google Cloud Text-to-Speech, or Azure TTS.
4. Uploads audio to cloud storage (S3/Cloud Storage/Azure Blob) and returns a presigned URL valid up to 7 days.
5. Integrates with SMS backends or other platform components.

Supported providers: `aws` (default), `gcp`, `azure`.

See `docs/INTEGRATION.md` for full cloud integration guides and IAM/service-account role examples.

Quickstart:
- Copy `.env.example` to `.env` and set values.
- `npm ci`
- `node src/app.js`

API:
- `POST /translate-tts`
  - Body (JSON): `{ "message": "Hello", "targetLanguage": "fr", "provider": "aws" }`
  - Response: `{ translatedText, audioUrl, key }`
