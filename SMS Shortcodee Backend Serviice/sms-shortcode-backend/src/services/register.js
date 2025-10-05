import { pool } from '../lib/db.js';
export default async function registerHandler(from, cmd) {
  // Simple sync registration (demo). In prod you might call a user service.
  await pool.query(
    'INSERT INTO users(phone) VALUES($1) ON CONFLICT (phone) DO NOTHING',
    [from]
  );
  return 'You are registered. Reply with your name to update profile.';
}
