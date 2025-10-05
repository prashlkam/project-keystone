# Integration Guide — AWS / GCP / Azure

This guide explains how to configure each cloud provider to support the Translate+TTS+Storage workflow, how to grant permissions, create lifecycle rules, and sample code to call the service.

---
## Common architecture
1. Caller (SMS backend / web / mobile) -> POST /translate-tts -> microservice
2. Microservice uses chosen provider to translate the text and synthesize audio
3. Microservice uploads audio to cloud storage and returns presigned URL (valid <= 7 days)
4. Caller sends the presigned URL back to the user (e.g., via SMS)

---
## AWS (recommended steps)

### Services used
- AWS Translate (TranslateText)
- Amazon Polly (SynthesizeSpeech)
- S3 (PutObject, GetObject)
- IAM for credentials or attach role to EC2/ECS/Lambda

### Setup
1. Create S3 bucket, e.g., `your-aws-tts-bucket`.
2. Add lifecycle rule: prefix `tts/`, expire objects after 7 days.
3. Create IAM policy (least privilege):
```json
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["translate:TranslateText"],"Resource":"*"},
    {"Effect":"Allow","Action":["polly:SynthesizeSpeech"],"Resource":"*"},
    {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::your-aws-tts-bucket/*"]}
  ]
}
```
4. Attach policy to IAM role or user. Use IAM role for ECS/EKS/Lambda to avoid handling long-term keys.
5. Set `AWS_REGION` and `AWS_S3_BUCKET` in `.env` or environment.

### Presigned URL
- The SDK's `getSignedUrl` uses v4 signing and supports expiry up to 7 days for GET object operations.
- Keep `PRESIGN_EXPIRY_SECONDS` ≤ 604800.

### Cost considerations
- Translate cost per character; Polly cost per second of audio; S3 storage costs small but monitor.

---
## Google Cloud Platform (GCP)

### Services used
- Cloud Translation API (Model: 'nmt' or 'base')
- Cloud Text-to-Speech (Wavenet for best quality)
- Cloud Storage (object storage)
- Service Account with appropriate roles

### Setup
1. Create a service account with roles:
   - `roles/cloudtranslate.apiUser`
   - `roles/texttospeech.user`
   - `roles/storage.admin` (or `roles/storage.objectAdmin` for bucket access)
2. Create a Cloud Storage bucket `your-gcp-tts-bucket` and set lifecycle rule to delete after 7 days.
3. Download service account JSON and set `GOOGLE_APPLICATION_CREDENTIALS` env var or use Workload Identity on GKE.
4. Set `GCP_PROJECT` and `GCP_BUCKET` env vars.

### Signed URL
- Use `file.getSignedUrl({ action: 'read', expires })` with `expires` as Date or timestamp. Max expiry depends on auth; using service account you can sign URLs up to 7 days easily.

### Cost
- Wavenet voices are more expensive. Monitor usage; enable billing alerts.

---
## Azure

### Services used
- Azure Translator (Cognitive Services)
- Azure Speech (Text-to-Speech)
- Azure Blob Storage (SAS tokens for presigned URLs)

### Setup
1. Create a Resource Group and the following resources:
   - Azure Cognitive Services (Speech + Translator) or separate Translator and Speech resources. Note keys and endpoints.
   - Storage Account with container `your-azure-container`.
2. Configure lifecycle management rule on Blob container to delete blobs after 7 days.
3. For auth:
   - For TTS/Translator: use `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_ENDPOINT` env vars.
   - For Blob: prefer `AZURE_STORAGE_CONNECTION_STRING` or `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_ACCOUNT_KEY` or Managed Identity.
4. Generate SAS token for blob read permission valid up to 7 days. The SDK `generateBlobSASQueryParameters` can be used server-side (requires account key). If using Managed Identity, consider using Azure AD to sign SAS or temporarily make objects private and implement proxy streaming service.

### SAS and expiry
- SAS tokens support expiry times; generate with `permissions: r` and `expiresOn` set to now+7days.

### Cost
- Azure Speech pricing depends on region and voice model. Monitor and set budgets.

---
## Security & Best Practices (All Clouds)
- Use short-lived credentials or managed identities when possible.
- Restrict permissions to specific buckets/containers, not `*` resources.
- Rate-limit API endpoints and validate inputs to prevent abuse and high bills.
- Keep `PRESIGN_EXPIRY_SECONDS` reasonable (≤7 days). For extra security, generate one-time tokens and store mapping server-side.
- Consider URL shortener service control for SMS delivery (avoid very long URLs).

---
## Integration with SMS backend
1. SMS backend calls `/translate-tts` with JSON payload and chosen provider. Example:
```js
const resp = await fetch('https://translate-tts.example.com/translate-tts', {
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer ...'},
  body: JSON.stringify({ message: 'Hello', targetLanguage: 'hi', provider: 'aws' })
});
const json = await resp.json();
const audioUrl = json.audioUrl;
```
2. Shorten URL (optional) and send SMS: `Your audio is here: https://short.link/abcd`.

---
## Troubleshooting
- If translation fails for rare languages, fallback to original text and still synthesize.
- If TTS voice is not available for a language, choose nearest regional voice or default to English voice.
- Monitor errors from cloud SDKs and retry with exponential backoff for transient errors.
