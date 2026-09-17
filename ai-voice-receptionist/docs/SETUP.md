# Setup

## 1. Accounts you need
- **Vapi** — https://dashboard.vapi.ai (handles telephony + STT + LLM orchestration + TTS)
- **Anthropic** — API key added inside the Vapi dashboard (Settings → Provider Keys), not in this repo's `.env`. Vapi calls Claude on your behalf.
- **ElevenLabs** — API key added inside the Vapi dashboard, for voice.
- **Deepgram** — API key added inside the Vapi dashboard, for transcription.
- **Google Cloud project** (optional, for real calendar booking) — see step 4.
- **Slack incoming webhook** (optional, for call/booking notifications).
- A place to deploy this server: Railway, Render, or Fly.io all work with zero config beyond `npm start`.

## 2. Local setup
```bash
npm install
cp .env.example .env
```
Fill in `.env`:
- `VAPI_API_KEY` — from the Vapi dashboard's API Keys page.
- `BUSINESS_NAME`, `BUSINESS_HOURS`, `BUSINESS_SERVICES`, `TRANSFER_PHONE_NUMBER` — used in the assistant's system prompt and for call transfers.

## 3. Deploy the webhook server first
Vapi needs a public URL to send tool calls to, so deploy before creating the assistant:
1. Push this repo, connect it to Railway/Render, deploy with `npm start`.
2. Copy the deployed URL (e.g. `https://your-app.up.railway.app`) into `.env` as `PUBLIC_SERVER_URL`.
3. Set `VAPI_WEBHOOK_SECRET` to a random string — Vapi will echo it back in the `x-vapi-secret` header on every request so you can verify it's really Vapi calling.

## 4. (Optional but recommended) Wire up Google Calendar
Without this, `check_availability` always says "free" and `book_appointment` returns a demo confirmation without actually saving anything — fine for a first demo call, not for a real client.

1. In Google Cloud Console, create a project, enable the **Google Calendar API**.
2. Create an OAuth client of type **Desktop app**, copy its Client ID/Secret into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Run `npm run google-auth`, follow the printed URL, paste the code back in. It prints a `GOOGLE_REFRESH_TOKEN` — add that to `.env` too.
4. Redeploy so the server picks up the new env vars.

## 5. Create the assistant on Vapi
```bash
npm run create-assistant
```
This reads `src/vapi/assistantConfig.js`, creates the assistant via the Vapi API, and saves the returned `VAPI_ASSISTANT_ID` back into `.env`. Re-run it any time you edit the system prompt or tools — it'll update the existing assistant instead of creating a new one.

## 6. Get a phone number
```bash
npm run setup-phone-number -- --area-code 415
```
Prints the new number and its ID. Call it — you're talking to your AI receptionist.

## 7. (Optional) Set up outbound missed-call follow-up
Calls a lead back automatically instead of waiting for them to call again.

1. `npm run create-outbound-assistant` — creates a second assistant (different opening
   line and goals, since it's calling *them*) and saves `VAPI_OUTBOUND_ASSISTANT_ID` to `.env`.
2. Set `MISSED_CALL_WEBHOOK_SECRET` in `.env` to a random string, redeploy.
3. Point whatever detects a missed lead (a Twilio missed-call webhook, a form tool, a
   Zapier/Make automation, a CRM trigger) at:
   ```
   POST https://your-app.up.railway.app/trigger-missed-call
   Headers: x-webhook-secret: <your MISSED_CALL_WEBHOOK_SECRET>
   Body: { "phone": "+14155551234", "name": "Jane Doe" }
   ```
   `phone` must be E.164 format. This places a real, billable outbound call — test with
   your own number first.

## 8. Iterate
- Edit the system prompt / tool descriptions in `src/vapi/assistantConfig.js`, re-run `npm run create-assistant`.
- Watch `docs/SETUP.md` → server logs (or Slack, if configured) for tool-call and end-of-call activity while testing.
- Common tuning: adjust `firstMessage`, tighten the system prompt against caller edge cases you hit in test calls, adjust `voiceId` for tone.
