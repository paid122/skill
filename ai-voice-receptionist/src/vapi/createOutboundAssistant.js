// One-off script: creates/updates the OUTBOUND follow-up assistant.
// Run with: npm run create-outbound-assistant
require("dotenv").config();
const { buildOutboundAssistantConfig } = require("./outboundAssistantConfig");
const { pushAssistant } = require("./pushAssistant");
const logger = require("../utils/logger");

async function main() {
  await pushAssistant({
    config: buildOutboundAssistantConfig(),
    idEnvVar: "VAPI_OUTBOUND_ASSISTANT_ID",
  });
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
