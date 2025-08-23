import pkg from "@slack/bolt";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const { App } = pkg;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

app.message(async ({ message, say, logger }) => {
  try {
    if (message.subtype === "bot_message") return;

    logger.info(`Got a message from ${message.user}: ${message.text}`);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message.text }],
    });

    await say(completion.choices[0].message.content);

  } catch (err) {
    logger.error(err);
    await say("Something went wrong, please try again later.");
  }
});

(async () => {
  await app.start();
  console.log("⚡ Brand GPT is running and responding!");
})();

