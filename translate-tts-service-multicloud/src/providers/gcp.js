import textToSpeech from '@google-cloud/text-to-speech';
import { Translate } from '@google-cloud/translate';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const projectId = process.env.GCP_PROJECT;
const bucketName = process.env.GCP_BUCKET;
const presignSeconds = parseInt(process.env.PRESIGN_EXPIRY_SECONDS || '604800', 10);

const translateClient = new Translate({ projectId });
const ttsClient = new textToSpeech.TextToSpeechClient();
const storage = new Storage({ projectId });

function chooseVoice(lang) {
  const p = lang.split('-')[0];
  const map = { en: 'en-US-Wavenet-F', hi: 'hi-IN-Standard-A', fr: 'fr-FR-Wavenet-C', es: 'es-ES-Wavenet-A' };
  return map[p] || 'en-US-Wavenet-F';
}

export async function handleGCP(message, targetLanguage) {
  // translate
  const [translated] = await translateClient.translate(message, targetLanguage);
  // synthesize
  const voice = chooseVoice(targetLanguage);
  const [resp] = await ttsClient.synthesizeSpeech({
    input: { text: translated },
    voice: { languageCode: targetLanguage, name: voice },
    audioConfig: { audioEncoding: 'MP3' }
  });
  const audioBuffer = resp.audioContent;
  // upload
  const key = `tts/${uuidv4()}.mp3`;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(key);
  await file.save(audioBuffer, { contentType: 'audio/mpeg' });
  // signed url
  const expires = Date.now() + presignSeconds * 1000;
  const [url] = await file.getSignedUrl({ action: 'read', expires });
  return { translatedText: translated, audioUrl: url, key };
}
