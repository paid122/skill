require("dotenv").config();
const express = require("express");
const logger = require("./utils/logger");
const { notifySlack } = require("./integrations/slackNotify");

const checkAvailability = require("./tools/checkAvailability");
const bookAppointment = require("./tools/bookAppointment");

const app = express();
app.use(express.json());

// Maps the function name the LLM calls to the handler that runs it.
const TOOL_HANDLERS = {
  check_availability: checkAvailability,
  book_appointment: bookAppointment,
};

// Verifies the request actually came from Vapi, if a shared secret is configured.
function verifyVapiSecret(req, res, next) {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return next(); // not configured yet — skip in early dev
  const provided = req.headers["x-vapi-secret"];
  if (provided !== expected) {
    logger.error("Rejected webhook with invalid/missing x-vapi-secret");
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.post("/webhook", verifyVapiSecret, async (req, res) => {
  const message = req.body?.message;
  if (!message) return res.status(400).json({ error: "missing message" });

  try {
    switch (message.type) {
      case "tool-calls":
        return res.json({ results: await runToolCalls(message.toolCallList) });

      case "end-of-call-report":
        await handleEndOfCall(message);
        return res.status(200).end();

      case "status-update":
        logger.info("Call status update:", message.status);
        return res.status(200).end();

      default:
        // Other Vapi event types (transcripts, speech-update, etc.) — no-op.
        return res.status(200).end();
    }
  } catch (err) {
    logger.error("Webhook handler error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

async function runToolCalls(toolCallList = []) {
  const results = [];
  for (const call of toolCallList) {
    const name = call.function?.name;
    const args = safeParse(call.function?.arguments);
    const handler = TOOL_HANDLERS[name];

    let result;
    if (!handler) {
      logger.error(`No handler registered for tool "${name}"`);
      result = { error: `Unknown tool: ${name}` };
    } else {
      try {
        result = await handler(args);
      } catch (err) {
        logger.error(`Tool "${name}" threw:`, err);
        result = { error: err.message };
      }
    }

    results.push({ toolCallId: call.id, result: JSON.stringify(result) });
  }
  return results;
}

function safeParse(value) {
  if (typeof value !== "string") return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function handleEndOfCall(message) {
  const call = message.call || {};
  const summary = message.summary || "(no summary)";
  const endedReason = message.endedReason || "unknown";
  logger.info(`Call ${call.id} ended (${endedReason}). Summary: ${summary}`);

  await notifySlack(
    `📞 Call ended — ${endedReason}\n*Summary:* ${summary}\n*Transcript:* ${
      message.transcript ? message.transcript.slice(0, 1500) : "n/a"
    }`
  );
}

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => logger.info(`Voice receptionist webhook server listening on :${port}`));
