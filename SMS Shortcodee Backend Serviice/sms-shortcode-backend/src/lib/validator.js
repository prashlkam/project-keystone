import dotenv from 'dotenv';
dotenv.config();

export function validateRequest(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  const header = req.headers['x-webhook-secret'] || req.headers['x-twilio-signature'];
  if (!header) return false;
  return header === secret;
}
