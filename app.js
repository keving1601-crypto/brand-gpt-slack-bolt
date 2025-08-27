// app.js — ESM version (works when package.json has "type":"module")

import 'dotenv/config';

// @slack/bolt is CommonJS; import the default and pull { App } off it.
import boltPkg from '@slack/bolt';
const { App } = boltPkg;

// OpenAI SDK (ESM)
import OpenAI from 'openai';

const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  BOT_NAME = 'brand',        // set to 'brand' or 'gracie' per Render service
  OPENAI_API_KEY
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN) {
  console.error('Missing Slack env vars (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN).');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY.');
  process.exit(1);
}

const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function safePost(client, args) {
  try { return await client.chat.postMessage(args); } catch (e) { console.error(e); }
}
async function safeUpdate(client, args) {
  try { return await client.chat.update(args); } catch (e) { console.error(e); }
}

// --- DMs ---
app.event('message', async ({ event, client, logger }) => {
  if (event.subtype === 'bot_message') return;
  if (event.channel_type !== 'im') return;

  const text = (event.text || '').trim();
  const lower = text.toLowerCase();
  logger.info(`DM received from ${event.user}: "${text}"`);

  if (lower === 'ping') {
    await safePost(client, { channel: event.channel, text: 'BRAND-OK-123' });
    return;
  }

  if (lower.includes('leg lock')) {
    await safePost(client, { channel: event.channel, text: 'Leglocks for Dummies: https://leglocks.unclecoachkevin.com/' });
    return;
  }

  if (lower.includes('skool') || lower.includes('videos') || lower.includes('intro curriculum')) {
    await safePost(client, { channel: event.channel, text: 'Skool (free intro + $15/mo full class videos): https://www.skool.com/gracie-trinity-academy' });
    return;
  }

  const placeholder = await safePost(client, { channel: event.channel, text: 'Thinking…' });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are ${BOT_NAME === 'brand' ? 'Brand GPT' : 'Gracie Trinity GPT'}, Kevin’s assistant for Gracie Trinity Academy.
Be concise, friendly, and helpful. When relevant, include short CTAs with links:
- Leg lock course: https://leglocks.unclecoachkevin.com/
- Skool community & class videos: https://www.skool.com/gracie-trinity-academy
If asked about prices, schedules, or policies, answer clearly and offer next steps.`
        },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 600
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim()
      || "I couldn’t find that—mind rephrasing?";
    if (placeholder?.ts) {
      await safeUpdate(client, { channel: event.channel, ts: placeholder.ts, text: reply });
    } else {
      await safePost(client, { channel: event.channel, text: reply });
    }
  } catch (err) {
    logger.error('OpenAI error:', err);
    const fallback = 'Sorry—my brain hiccupped. Try again in a moment.';
    if (placeholder?.ts) {
      await safeUpdate(client, { channel: event.channel, ts: placeholder.ts, text: fallback });
    } else {
      await safePost(client, { channel: event.channel, text: fallback });
    }
  }
});

// --- @mentions in channels ---
app.event('app_mention', async ({ event, client }) => {
  await safePost(client, {
    channel: event.channel,
    text: `Hey <@${event.user}> — DM me for full help. Try “leg lock course” or ask me anything about Gracie Trinity.`
  });
});

(async () => {
  await app.start();
  console.log(`⚡ ${BOT_NAME} Slack bot running in Socket Mode`);
})();
