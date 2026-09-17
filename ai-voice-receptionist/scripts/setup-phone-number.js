// Buys a phone number through Vapi (backed by Twilio under the hood) and links it
// to your assistant. Run with: npm run setup-phone-number -- --area-code 415
require("dotenv").config();
const logger = require("../src/utils/logger");

const VAPI_API_BASE = "https://api.vapi.ai";

function getAreaCode() {
  const flagIndex = process.argv.indexOf("--area-code");
  return flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined;
}

async function main() {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!apiKey) throw new Error("VAPI_API_KEY is not set.");
  if (!assistantId) {
    throw new Error("VAPI_ASSISTANT_ID is not set — run `npm run create-assistant` first.");
  }

  const areaCode = getAreaCode();
  logger.info(`Requesting a Vapi phone number${areaCode ? ` (area code ${areaCode})` : ""}...`);

  const res = await fetch(`${VAPI_API_BASE}/phone-number`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "vapi",
      assistantId,
      numberDesiredAreaCode: areaCode,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Vapi API error (${res.status}): ${JSON.stringify(body)}`);
  }

  logger.info("Phone number provisioned:", body.number);
  logger.info("Phone number ID (save as VAPI_PHONE_NUMBER_ID):", body.id);
  logger.info("Call that number to talk to your assistant.");
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
