// One-off script: creates the Vapi assistant from assistantConfig.js, or updates it
// if VAPI_ASSISTANT_ID is already set in .env. Run with: npm run create-assistant
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { buildAssistantConfig } = require("./assistantConfig");
const logger = require("../utils/logger");

const VAPI_API_BASE = "https://api.vapi.ai";

async function main() {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set. Add it to your .env file first.");
  }
  if (!process.env.PUBLIC_SERVER_URL) {
    logger.info(
      "Warning: PUBLIC_SERVER_URL is not set yet — the assistant will be created without a " +
        "tool-call webhook. Deploy the server, set PUBLIC_SERVER_URL, and re-run this script."
    );
  }

  const config = buildAssistantConfig();
  const existingId = process.env.VAPI_ASSISTANT_ID;

  const res = await fetch(
    existingId ? `${VAPI_API_BASE}/assistant/${existingId}` : `${VAPI_API_BASE}/assistant`,
    {
      method: existingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Vapi API error (${res.status}): ${JSON.stringify(body)}`);
  }

  logger.info(existingId ? "Assistant updated:" : "Assistant created:", body.id);

  if (!existingId) {
    persistAssistantId(body.id);
  }
}

// Writes VAPI_ASSISTANT_ID into .env so re-runs update instead of duplicating.
function persistAssistantId(id) {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) {
    logger.info(`No .env file found — add VAPI_ASSISTANT_ID=${id} to your .env manually.`);
    return;
  }
  let contents = fs.readFileSync(envPath, "utf8");
  if (contents.includes("VAPI_ASSISTANT_ID=")) {
    contents = contents.replace(/VAPI_ASSISTANT_ID=.*/g, `VAPI_ASSISTANT_ID=${id}`);
  } else {
    contents += `\nVAPI_ASSISTANT_ID=${id}\n`;
  }
  fs.writeFileSync(envPath, contents);
  logger.info("Saved VAPI_ASSISTANT_ID to .env");
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
