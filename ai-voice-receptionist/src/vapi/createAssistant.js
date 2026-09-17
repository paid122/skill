// One-off script: creates/updates the INBOUND assistant from assistantConfig.js.
// Run with: npm run create-assistant
require("dotenv").config();
const { buildAssistantConfig } = require("./assistantConfig");
const { pushAssistant } = require("./pushAssistant");
const logger = require("../utils/logger");

async function main() {
  if (!process.env.PUBLIC_SERVER_URL) {
    logger.info(
      "Warning: PUBLIC_SERVER_URL is not set yet — the assistant will be created without a " +
        "tool-call webhook. Deploy the server, set PUBLIC_SERVER_URL, and re-run this script."
    );
  }
  await pushAssistant({ config: buildAssistantConfig(), idEnvVar: "VAPI_ASSISTANT_ID" });
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
