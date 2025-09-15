// app.js — ESM, loop-proof, no "Thinking..." placeholder

import 'dotenv/config';
import boltPkg from '@slack/bolt';
const { App } = boltPkg;
import OpenAI from 'openai';

const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  OPENAI_API_KEY,
  BOT_NAME = 'brand'
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing required env vars'); process.exit(1);
}

const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true
});

import express from 'express';

const web = express();
web.get('/', (_req, res) => res.status(200).send('ok'));
web.get('/health', (_req, res) => res.status(200).send('ok'));

const PORT = process.env.PORT || 3000;
web.listen(PORT, () => {
console.log(`HTTP keepalive server running on ${PORT}`);
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ---- helpers -------------------------------------------------
async function send(client, channel, text) {
  try { return await client.chat.postMessage({ channel, text }); }
  catch (e) { console.error('postMessage failed:', e); }
}

// simple de-dupe per-process
const seen = new Set();
const VERSION = 'brand-v4';

// prompt
const SYSTEM_PROMPT = `
You are ${BOT_NAME === 'brand' ? 'Brand GPT' : 'Gracie Trinity GPT'}, Kevin’s assistant for Gracie Trinity Academy.
Keep replies short, friendly, and actionable. Include links when useful:
- Leg lock course: https://leglocks.unclecoachkevin.com/
- Skool community & videos: https://www.skool.com/gracie-trinity-academy
`;

// ---- DM handler (ONLY real user DMs) -------------------------
app.event('message', async ({ event, client, logger }) => {
  // Only handle plain user DMs; ignore everything else
  if (event.channel_type !== 'im') return;
  if (event.subtype) return;               // ignore bot_message, message_changed, etc.
  if (!event.user || event.bot_id) return; // ignore bots/system
  if (!event.ts || seen.has(event.ts)) return; // de-dupe
  seen.add(event.ts);

  const text = (event.text || '').trim();
  const lower = text.toLowerCase();
  logger.info(`DM ${event.user} -> "${text}" ts=${event.ts}`);

  // quick diagnostics
  if (lower === 'version') return send(client, event.channel, `OK: ${VERSION}`);
  if (lower === 'ping') return send(client, event.channel, 'BRAND-OK-123');

  // fast-path links
  if (lower.includes('leg lock')) {
    return send(client, event.channel, 'Leglocks for Dummies: https://leglocks.unclecoachkevin.com/');
  }
  if (lower.includes('skool') || lower.includes('videos') || lower.includes('intro curriculum')) {
    return send(client, event.channel, 'Skool (free intro + $15/mo full class videos): https://www.skool.com/gracie-trinity-academy');
  }

  // GPT reply (single post; no edits/placeholders)
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 600
    });
    const reply = completion?.choices?.[0]?.message?.content?.trim()
      || 'I didn’t catch that—mind rephrasing?';
    await send(client, event.channel, reply);
  } catch (err) {
    logger.error('OpenAI error:', err);
    await send(client, event.channel, 'Sorry—hit a snag. Try again in a moment.');
  }
});

// ---- Channel @mentions (short nudge) -------------------------
app.event('app_mention', async ({ event, client }) => {
  await send(client, event.channel, `Hey <@${event.user}> — DM me for full help. Try “leg lock course” or ask anything about Gracie Trinity.`);
});

// ---- Start ---------------------------------------------------
(async () => {
  await app.start();
  console.log(`⚡ ${BOT_NAME} Slack bot running in Socket Mode — ${VERSION}`);
})();
