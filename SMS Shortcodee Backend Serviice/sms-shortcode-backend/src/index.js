import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config();

import { pool } from './lib/db.js';
import { getSession, setSession, clearSession } from './lib/redis.js';
import { sendSms } from './lib/smsGateway.js';
import { validateRequest } from './lib/validator.js';
import registerHandler from './services/register.js';
import balanceHandler from './services/balance.js';
import supportHandler from './services/support.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/sms-handler', async (req, res) => {
  try {
    if (!validateRequest(req)) return res.status(403).send('Forbidden');

    const from = (req.body.From || req.body.from || req.body.sender || '').trim();
    const to = (req.body.To || req.body.to || req.body.shortcode || '').trim();
    const rawBody = (req.body.Body || req.body.body || req.body.message || '').trim();

    // log
    const insertRes = await pool.query(
      'INSERT INTO sms_logs(sender, shortcode, body, metadata) VALUES($1,$2,$3,$4) RETURNING id',
      [from, to, rawBody, req.body]
    );
    const logId = insertRes.rows[0].id;

    // resume session
    const session = await getSession(from);
    if (session && session.step) {
      const responseText = await resumeFlow(session, rawBody, from);
      await pool.query('UPDATE sms_logs SET handled=true, response_text=$1 WHERE id=$2', [responseText, logId]);
      await sendSms(from, responseText);
      return res.status(200).send('OK');
    }

    const code = parseSmsCode(rawBody);
    if (!code) {
      const text = 'Invalid input. Send the option number.';
      await pool.query('UPDATE sms_logs SET handled=true, response_text=$1 WHERE id=$2', [text, logId]);
      await sendSms(from, text);
      return res.status(200).send('OK');
    }

    const cmdRes = await pool.query('SELECT * FROM sms_commands WHERE code=$1', [code]);
    if (cmdRes.rowCount === 0) {
      const text = 'Invalid option. Please try again.';
      await pool.query('UPDATE sms_logs SET handled=true, response_text=$1 WHERE id=$2', [text, logId]);
      await sendSms(from, text);
      return res.status(200).send('OK');
    }

    const cmd = cmdRes.rows[0];
    let reply = '';

    // dispatch
    if (cmd.handler === 'register') {
      await setSession(from, { step: 'register_name', createdAt: Date.now() });
      reply = 'Welcome! Reply with your full name to register.';
    } else if (cmd.handler === 'balance') {
      reply = await balanceHandler(from, cmd);
    } else if (cmd.handler === 'support') {
      await setSession(from, { step: 'support_issue' });
      reply = 'Please describe your issue. Reply with the issue details.';
    } else if (cmd.handler === 'register_sync') {
      // call internal register handler synchronously
      reply = await registerHandler(from, cmd);
    } else {
      reply = 'Service not implemented yet.';
    }

    await pool.query('UPDATE sms_logs SET handled=true, response_text=$1 WHERE id=$2', [reply, logId]);
    await sendSms(from, reply);

    res.status(200).send('OK');
  } catch (err) {
    console.error('sms-handler err', err);
    res.status(500).send('Server error');
  }
});

function parseSmsCode(body) {
  const m = body.trim().match(/^([0-9]{1,4})$/);
  return m ? m[1] : null;
}

async function resumeFlow(session, body, from) {
  if (session.step === 'register_name') {
    const name = body.trim();
    await pool.query(
      'INSERT INTO users(phone, name) VALUES($1,$2) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name',
      [from, name]
    );
    await clearSession(from);
    return `Thanks ${name}! You are registered.`;
  }
  if (session.step === 'support_issue') {
    const issue = body.trim();
    // In production: push to ticketing system
    await clearSession(from);
    return `Thanks — support ticket created. Our team will contact you.`;
  }
  return 'Unknown session state. Please start over.';
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('SMS backend listening on', port));
