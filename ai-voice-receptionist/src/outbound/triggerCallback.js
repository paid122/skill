const logger = require("../utils/logger");

const VAPI_API_BASE = "https://api.vapi.ai";

// Places an outbound call via Vapi so the follow-up assistant calls the lead back.
// phone must be E.164 format, e.g. "+14155551234".
async function triggerCallback({ phone, name }) {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_OUTBOUND_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey || !assistantId || !phoneNumberId) {
    throw new Error(
      "Missing VAPI_API_KEY, VAPI_OUTBOUND_ASSISTANT_ID, or VAPI_PHONE_NUMBER_ID — " +
        "run `npm run create-outbound-assistant` and `npm run setup-phone-number` first."
    );
  }
  if (!phone || !/^\+\d{8,15}$/.test(phone)) {
    throw new Error(`Phone number must be E.164 format (e.g. +14155551234), got: ${phone}`);
  }

  const res = await fetch(`${VAPI_API_BASE}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: phone, name: name || undefined },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Vapi API error (${res.status}): ${JSON.stringify(body)}`);
  }

  logger.info(`Outbound callback triggered for ${phone} — call id ${body.id}`);
  return body;
}

module.exports = { triggerCallback };
