// One-time interactive script to obtain a Google OAuth refresh token for
// Calendar access. Run with: npm run google-auth
// Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET already set in .env,
// from a Google Cloud OAuth "Desktop app" client (see docs/SETUP.md).
require("dotenv").config();
const readline = require("readline");
const { google } = require("googleapis");
const logger = require("../src/utils/logger");

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // out-of-band, for CLI/desktop flows

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent",
  });

  logger.info("1. Open this URL, sign in, and approve calendar access:\n");
  console.log(authUrl + "\n");
  logger.info("2. Paste the code Google gives you back here:");

  const code = await promptForInput("Code: ");
  const { tokens } = await oauth2Client.getToken(code);

  logger.info("\nAdd this to your .env:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
}

function promptForInput(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
