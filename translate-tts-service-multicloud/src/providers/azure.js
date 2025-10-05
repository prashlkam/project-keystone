import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
dotenv.config();

const presignExpiry = parseInt(process.env.PRESIGN_EXPIRY_SECONDS || '604800', 10);

async function translateText(text, target) {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
  const url = `${endpoint}/translate?api-version=3.0&to=${target}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ Text: text }])
  });
  const body = await res.json();
  return body[0].translations[0].text;
}

function chooseVoice(lang) {
  const p = lang.split('-')[0];
  const map = { en: 'en-US-AriaNeural', hi: 'hi-IN-SwaraNeural', fr: 'fr-FR-DeniseNeural', es: 'es-ES-ElviraNeural' };
  return map[p] || 'en-US-AriaNeural';
}

async function synthesizeAzure(text, voice) {
  const ttsKey = process.env.AZURE_TTS_KEY;
  const ttsRegion = process.env.AZURE_TTS_REGION;
  const url = `https://${ttsRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='en-US'><voice name='${voice}'>${text}</voice></speak>`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': ttsKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
    },
    body: ssml
  });
  if (!resp.ok) throw new Error('Azure TTS error ' + resp.statusText);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf;
}

async function uploadToAzure(key, buffer) {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  let blobService;
  if (conn) blobService = BlobServiceClient.fromConnectionString(conn);
  else {
    const account = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const cred = new StorageSharedKeyCredential(account, accountKey);
    const url = `https://${account}.blob.core.windows.net`;
    blobService = new BlobServiceClient(url, cred);
  }
  const containerName = process.env.AZURE_STORAGE_CONTAINER;
  const containerClient = blobService.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  const blockClient = containerClient.getBlockBlobClient(key);
  await blockClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'audio/mpeg' } });
}

function presignAzure(key) {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const container = process.env.AZURE_STORAGE_CONTAINER;
  const expiry = new Date(Date.now() + presignExpiry * 1000);
  const sas = generateBlobSASQueryParameters({
    containerName: container,
    blobName: key,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: expiry
  }, new StorageSharedKeyCredential(account, accountKey)).toString();
  return `https://${account}.blob.core.windows.net/${container}/${key}?${sas}`;
}

export async function handleAzure(message, targetLanguage) {
  const translated = await translateText(message, targetLanguage);
  const voice = chooseVoice(targetLanguage);
  const audio = await synthesizeAzure(translated, voice);
  const key = `tts/${uuidv4()}.mp3`;
  await uploadToAzure(key, audio);
  const url = presignAzure(key);
  return { translatedText: translated, audioUrl: url, key };
}
