# Gracie Trinity Slack App (Bolt + OpenAI)

This starter lets you run a Slack app that serves:
- `/gt daily` – Daily Operations checklist
- `/gt scorecard chris` – KPI card for team members
- `/gt checkin` – Weekly Check-In modal
- App Home tab with mission + core values

## 1) Prereqs
- Slack workspace admin access
- Node.js 18+ installed
- Create a private test channel in Slack (e.g., `#gt-lab`)

## 2) Create the Slack app
1. Go to https://api.slack.com/apps → **Create New App** → *From scratch*.
2. Name: **Gracie Trinity GPT**. Pick your workspace.
3. **Basic Information** → **App-Level Tokens** → *Generate Token* with `connections:write`. Save the `xapp-` token.
4. **Socket Mode** → toggle **Enable Socket Mode** ON.
5. **OAuth & Permissions** → **Scopes (Bot Token Scopes)** → add:
   - `commands`, `chat:write`, `app_mentions:read`, `im:write`
6. Click **Install to Workspace**. Copy the **Bot User OAuth Token** (`xoxb-...`).
7. **App Home** → enable **Home Tab**.
8. **Slash Commands** → create `/gt` with a usage hint like: `daily | scorecard <name> | checkin`.
   - When using Socket Mode you do **not** need a public Request URL.
9. (Optional) **Interactivity & Shortcuts** → enable to use buttons/modals (Socket Mode works without a public URL).

## 3) Configure & run locally
```bash
git clone <this folder> gracie-trinity-slack-bolt
cd gracie-trinity-slack-bolt
cp .env.example .env
# paste your real tokens
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_SIGNING_SECRET=...
# SLACK_APP_TOKEN=xapp-...
# OPENAI_API_KEY=...
npm install
npm start
```

## 4) Test in Slack
- In Slack, invite the app to your test channel: type `@Gracie Trinity GPT` and press Enter to add.
- Try `/gt daily`, `/gt scorecard chris`, `/gt checkin`.
- Click the app in the sidebar → **Home** tab to see the mission/values.

## 5) Customize
- Edit **templates.json** to change KPIs, mission, values, or daily ops.
- You can add more subcommands in **app.js** under the `/gt` handler.

## 6) Deploy (optional)
Socket Mode does not require a public URL. You can run this on a small server or a free host.
Set the same environment variables (`.env`) on your host and run `npm start`.
