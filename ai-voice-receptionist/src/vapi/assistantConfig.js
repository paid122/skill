// Defines the Vapi assistant: the "brain" (model + system prompt), voice, transcriber,
// and the tools it can call mid-call. Edit this file per client, then run
// `npm run create-assistant` to push it to Vapi (creates on first run, updates after).
//
// Docs: https://docs.vapi.ai/assistants/dynamic-variables (schema evolves — verify
// field names against the current Vapi API reference before relying on this in prod).

function buildAssistantConfig() {
  const businessName = process.env.BUSINESS_NAME || "the business";
  const businessHours = process.env.BUSINESS_HOURS || "our normal business hours";
  const businessServices = process.env.BUSINESS_SERVICES || "our services";
  const transferNumber = process.env.TRANSFER_PHONE_NUMBER;
  const serverUrl = process.env.PUBLIC_SERVER_URL;

  const systemPrompt = `You are the AI phone receptionist for ${businessName}.

Your job:
- Greet callers warmly and find out why they're calling.
- Answer questions about hours (${businessHours}) and services (${businessServices}).
- If they want to book, reschedule, or cancel an appointment, use the check_availability
  and book_appointment tools. Always check availability before confirming a time out loud.
- Collect the caller's name and a callback number before booking.
- If the caller is upset, asks for a person, has an emergency, or asks something you
  genuinely can't answer, transfer the call to a human immediately — don't guess.
- Keep responses short and conversational, like a real phone call. Never say you are
  an AI unless directly asked. Never invent prices, policies, or availability.`;

  return {
    name: `${businessName} Receptionist`,
    firstMessage: `Thanks for calling ${businessName}, how can I help you today?`,
    serverUrl: serverUrl ? `${serverUrl}/webhook` : undefined,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET || undefined,

    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "system", content: systemPrompt }],
      tools: [
        {
          type: "function",
          function: {
            name: "check_availability",
            description: "Check whether a given date and time is free on the business calendar.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format." },
                time: { type: "string", description: "24-hour time in HH:MM format." },
              },
              required: ["date", "time"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "book_appointment",
            description: "Book an appointment. Only call this after check_availability confirms the slot is free and the caller has agreed to it.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format." },
                time: { type: "string", description: "24-hour time in HH:MM format." },
                callerName: { type: "string", description: "The caller's full name." },
                callerPhone: { type: "string", description: "A callback number for the caller." },
                reason: { type: "string", description: "Brief reason for the appointment." },
              },
              required: ["date", "time", "callerName"],
            },
          },
        },
        // transferCall is a Vapi built-in tool type — no server webhook needed for it.
        transferNumber
          ? {
              type: "transferCall",
              destinations: [
                {
                  type: "number",
                  number: transferNumber,
                  message: "Transferring you now, please hold.",
                },
              ],
            }
          : null,
      ].filter(Boolean),
    },

    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM", // "Rachel" — swap for your preferred ElevenLabs voice ID
    },

    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en-US",
    },

    // Ends the call automatically after this much caller silence.
    silenceTimeoutSeconds: 20,
    // Lets the caller talk over the assistant and interrupt it.
    endCallPhrases: ["goodbye", "that's all, thank you"],
  };
}

module.exports = { buildAssistantConfig };
