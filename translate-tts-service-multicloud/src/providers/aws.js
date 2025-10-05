import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
dotenv.config();

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const presignExpiry = parseInt(process.env.PRESIGN_EXPIRY_SECONDS || "604800", 10);

const translateClient = new TranslateClient({ region });
const pollyClient = new PollyClient({ region });
const s3 = new S3Client({ region });

async function translate(text, target) {
  const input = { Text: text, TargetLanguageCode: target };
  const cmd = new TranslateTextCommand(input);
  const resp = await translateClient.send(cmd);
  return resp.TranslatedText;
}

const VOICE_MAP = { en: 'Joanna', hi: 'Aditi', fr: 'Celine', es: 'Lucia', de: 'Vicki', pt: 'Camila' };
function chooseVoice(lang){ const p = lang.split('-')[0]; return VOICE_MAP[p]||'Joanna'; }

async function synthesize(text, voice) {
  const cmd = new SynthesizeSpeechCommand({ OutputFormat: 'mp3', Text: text, VoiceId: voice, TextType: 'text' });
  const resp = await pollyClient.send(cmd);
  const chunks = [];
  for await (const c of resp.AudioStream) chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));
  return Buffer.concat(chunks);
}

async function uploadToS3(key, buffer) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: 'audio/mpeg' });
  await s3.send(cmd);
}

async function presign(key) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, cmd, { expiresIn: presignExpiry });
}

export async function handleAWS(message, targetLanguage){
  const translated = await translate(message, targetLanguage);
  const voice = chooseVoice(targetLanguage);
  const audio = await synthesize(translated, voice);
  const key = `tts/${uuidv4()}.mp3`;
  await uploadToS3(key, audio);
  const url = await presign(key);
  return { translatedText: translated, audioUrl: url, key };
}
