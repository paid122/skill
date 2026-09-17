const logger = require("../utils/logger");

async function notifySlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      logger.error("Slack notify failed:", res.status, await res.text());
    }
  } catch (err) {
    logger.error("Slack notify error:", err.message);
  }
}

module.exports = { notifySlack };
