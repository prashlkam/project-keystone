import Twilio from 'twilio';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const provider = (process.env.SMS_GATEWAY || 'twilio').toLowerCase();
let twClient = null;
if (provider === 'twilio') {
  twClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendSms(to, body) {
  if (provider === 'twilio') {
    const from = process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!from) throw new Error('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID must be set');
    await twClient.messages.create({ to, from, body });
    return;
  }

  // Generic aggregator outbound: POST to GATEWAY_OUTBOUND_URL with API key
  if (provider === 'generic') {
    const url = process.env.GATEWAY_OUTBOUND_URL;
    const apiKey = process.env.GATEWAY_API_KEY;
    if (!url) throw new Error('GATEWAY_OUTBOUND_URL missing');
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ to, message: body })
    });
    return;
  }

  throw new Error('Unknown SMS_GATEWAY provider');
}
