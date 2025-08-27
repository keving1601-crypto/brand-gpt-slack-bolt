import 'dotenv/config';
import { App } from '@slack/bolt';
import OpenAI from 'openai';

const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  BOT_NAME = 'brand',
  OPENAI_API_KEY
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

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- DM handler (full Brand GPT brain) ---
app.event('message', async ({ event, client, logger }) => {
  if (event.subtype === 'bot_message') return;
  if (event.channel_type !== 'im') return; // only DMs here

  const text = (event.text || '').trim();
  const lower = text.toLowerCase();
  logger.info(`DM received: "${text}" from ${event.user}`);

  // Quick answers (fast path)
  if (lower.includes('leg lock')) {
    await client.chat.postMessage({
      channel: event.channel,
      text: 'Leglocks for Dummies: https://leglocks.unclecoachkevin.com/'
    });
    return;
  }

  if (lower.includes('skool') || lower.includes('intro curriculum') || lower.includes('videos')) {
    await client.chat.postMessage({
      channel: event.channel,
      text: 'Skool (free intro + $15/mo full videos): https://www.skool.com/gracie-trinity-academy'
    });
    return;
  }

  // Optional: show a quick “thinking” message, then edit it with the final reply
  const placeholder = await client.chat.postMessage({
    channel: event.channel,
    text: 'Thinking…'
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            `You are Brand GPT, Kevin's assistant for the Gracie Trinity Academy brand.
             Be concise, friendly, and useful. When relevant, include short CTAs with links:
             - Leg lock course: https://leglocks.unclecoachkevin.com/
             - Skool community & class videos: https://www.skool.com/gracie-trinity-academy
             If asked about prices, schedules, or policies, answer clearly and offer next steps.`
        },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 600
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "I couldn't find that—mind rephrasing?";
    await client.chat.update({
      channel: event.channel,
      ts: placeholder.ts,
      text: reply
    });
  } catch (err) {
    logger.error(err);
    await client.chat.update({
      channel: event.channel,
      ts: placeholder.ts,
      text: 'Sorry—my brain hiccupped. Try again in a moment.'
    });
  }
});

// --- Channel @mentions: steer people to DM (or answer briefly) ---
app.event('app_mention', async ({ event, client }) => {
  await client.chat.postMessage({
    channel: event.channel,
    text: `Hey <@${event.user}>—DM me for full help. Try “leg lock course” or ask me anything about Gracie Trinity.`
  });
});

(async () => {
  await app.start();
  console.log(`⚡ ${BOT_NAME} Slack bot running in Socket Mode`);
})();
