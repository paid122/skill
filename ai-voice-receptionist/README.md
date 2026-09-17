# AI Voice Receptionist

A Vapi-based AI phone agent, two-directional:
- **Inbound** — answers calls, checks calendar availability, books appointments, transfers to a human when it should.
- **Outbound** — automatically calls back missed leads (a missed call, an unfinished form) and tries to book them.

Built to be reskinned per client — swap the business info, tools, and voice.

## How it works

```
Caller dials number
      │
      ▼
   Vapi (telephony + Deepgram STT + Claude + ElevenLabs TTS)
      │  mid-call tool calls (check_availability, book_appointment)
      ▼
This server (src/server.js)
      │
      ▼
Google Calendar + Slack notifications
```

Vapi owns the real-time audio pipeline (speech-to-text, the LLM turn, text-to-speech,
interruption handling). This repo owns everything client-specific: the system prompt,
what tools the assistant can call, and what those tools actually do (check a real
calendar, book a real event, notify Slack).

## Quick start

```bash
npm install
cp .env.example .env   # fill in your keys
npm run create-assistant
npm run setup-phone-number -- --area-code 415
npm start               # or deploy, see docs/SETUP.md
```

Full walkthrough, including Google Calendar OAuth: **[docs/SETUP.md](docs/SETUP.md)**.

## Project layout

```
src/
  server.js                     Express server — Vapi tool-call/end-of-call webhooks + /trigger-missed-call
  vapi/
    assistantConfig.js          Inbound assistant: system prompt, tools, voice, transcriber
    outboundAssistantConfig.js  Outbound follow-up assistant (different opening line/goals)
    pushAssistant.js            Shared create-or-update logic used by both create scripts
    createAssistant.js          Pushes assistantConfig.js to the Vapi API
    createOutboundAssistant.js  Pushes outboundAssistantConfig.js to the Vapi API
  tools/
    checkAvailability.js        Tool handler: checks Google Calendar free/busy
    bookAppointment.js          Tool handler: creates a Calendar event, notifies Slack
  outbound/
    triggerCallback.js          Places an outbound call via Vapi's /call API
  integrations/
    googleCalendar.js           Google Calendar API wrapper (falls back to "always free" if unconfigured)
    slackNotify.js              Posts call summaries / bookings to a Slack webhook
scripts/
  setup-phone-number.js       Buys/links a phone number via Vapi
  get-google-refresh-token.js One-time OAuth flow for Calendar access
docs/SETUP.md            Full setup instructions
```

## Reskinning for a new client

1. Update `BUSINESS_NAME`, `BUSINESS_HOURS`, `BUSINESS_SERVICES`, `TRANSFER_PHONE_NUMBER` in `.env`.
2. Adjust the system prompt in `src/vapi/assistantConfig.js` for their specific FAQs/edge cases.
3. Add/remove tools as needed (e.g. an order-lookup tool for e-commerce, an insurance-check tool for a clinic).
4. `npm run create-assistant` to push the changes.

## Status

Demo-grade scaffold: works end-to-end for booking/checking a real Google Calendar and
notifying Slack. Before handing to a paying client, add: call recording/transcript
storage, retry/error handling around the Calendar API, and a proper CRM integration
in place of (or alongside) Slack.
