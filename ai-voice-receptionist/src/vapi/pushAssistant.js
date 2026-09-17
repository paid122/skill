// Shared helper: creates or updates a Vapi assistant and persists its ID into .env.
// Used by both createAssistant.js (inbound) and createOutboundAssistant.js (outbound).
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const VAPI_API_BASE = "https://api.vapi.ai";

async function pushAssistant({ config, idEnvVar }) {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not set. Add it to your .env file first.");
  }

  const existingId = process.env[idEnvVar];

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
    persistEnvVar(idEnvVar, body.id);
  }

  return body;
}

// Writes/updates a key in .env so re-runs update instead of duplicating assistants.
function persistEnvVar(key, value) {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) {
    logger.info(`No .env file found — add ${key}=${value} to your .env manually.`);
    return;
  }
  let contents = fs.readFileSync(envPath, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) {
    contents = contents.replace(pattern, `${key}=${value}`);
  } else {
    contents += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, contents);
  logger.info(`Saved ${key} to .env`);
}

module.exports = { pushAssistant };
