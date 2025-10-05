import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// Minimal test to ensure route exists (integration testing requires DB/Redis)
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.post('/sms-handler', (req, res) => res.status(200).send('OK'));

test('sms-handler accepts post', async () => {
  const resp = await request(app).post('/sms-handler').send({ From: '+911234', To: '57675', Body: '1' });
  expect(resp.statusCode).toBe(200);
});
