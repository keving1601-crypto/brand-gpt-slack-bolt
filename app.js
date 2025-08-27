// app.js — ESM version (package.json has "type":"module")

import 'dotenv/config';

// @slack/bolt is CommonJS; import default then pull { App } off it.
import boltPkg from '@slack/bolt';
const { App } = boltPkg;

import OpenAI from 'openai';

// ----- ENV -----
const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  OPENAI_API_KEY,
  BOT_NAME = 'brand' // set 'brand' or 'gracie' per Render service
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN) {
  console.error('Missing Slack env vars (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN).');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY.');
  process.exit(1);
}

// ----- INIT -----
const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ----- HELPERS -----
async function send(client, channel, text) {
  try { return await client.chat.postMessage({ channel, text }); }
  catch (e) { console.error('chat.postMessage failed:', e); }
}

const SYSTEM_PROMPT = `
You are ${BOT_NAME === 'brand' ? 'Brand GPT' : 'Gracie Trinity GPT'}, Kevin’s assistant for Gracie Trinity Academy.
Tone: friendly, concise, no fluff.
When relevant, include short CTAs with these links:
- Leg lock course: https://leglocks.unclecoachkevin.com/
- Skool community & class videos: https://www.skool.com/gracie-trinity-academy
Answer clearly and offer next steps if asking about schedule, pricing, or how to join.
`;

// ----- DM HANDLER (loop-proof) -----
app.event('message', async ({ event, client, logger }) => {
  // Only handle real user DMs. Ignore bot/system/edited/thread events.
  if (event.channel_type !== 'im') return;     // only DMs
  if (event.subtype) return;                   // ignore bot_message, message_changed, etc.
  if (!event.user || event.bot_id) return;     // ignore bot/system posts

  const textRaw = event.text || '';
  const text = textRaw.trim();
  const lower = text.toLowerCase();
  logger.info(`DM from ${event.user}: "${text}" (ts=${event.ts})`);

  // quick diagnostics
  if (lower === 'ping') return send(client, event.channel, 'BRAND-OK-123');

  // fast paths (links)
  if (lower.includes('leg lock')) {
    return send(client, event.channel, 'Leglocks for Dummies: https://leglocks.unclecoachkevin.com/');
  }
  if (lower.includes('skool') || lower.includes('videos') || lower.includes('intro curriculum')) {
    return send(client, event.channel, 'Skool (free intro + $15/mo full class videos): https://www.skool.com/gracie-trinity-academy');
  }

  // GPT response (no placeholder/edit to avoid loops)
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
      || "I didn’t catch that—could you rephrase?";
    await send(client, event.channel, reply);
  } catch (err) {
    logger.error('OpenAI error:', err);
    await send(client, event.channel, 'Sorry—hit a snag. Try again in a moment.');
  }
});

// ----- CHANNEL @MENTIONS -----
app.event('app_mention', async ({ event, client }) => {
  // short nudge to DM to keep noise down
  await send(client, event.channel, `Hey <@${event.user}> — DM me for full help. Try “leg lock course” or ask anything about Gracie Trinity.`);
});

// ----- START -----
(async () => {
  await app.start();
  console.log(`⚡ ${BOT_NAME} Slack bot running in Socket Mode`);
})();
