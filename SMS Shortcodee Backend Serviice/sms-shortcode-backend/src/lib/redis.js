import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
const redis = new Redis(process.env.REDIS_URL);

async function setSession(phone, obj) {
  const key = `sess:${phone}`;
  await redis.set(key, JSON.stringify(obj), 'EX', 60 * 60);
}
async function getSession(phone) {
  const key = `sess:${phone}`;
  const v = await redis.get(key);
  return v ? JSON.parse(v) : null;
}
async function clearSession(phone) {
  const key = `sess:${phone}`;
  await redis.del(key);
}
export { redis as redisClient, setSession, getSession, clearSession };
