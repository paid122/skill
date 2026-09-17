// Defines the OUTBOUND follow-up assistant: calls back leads who missed a call or
// went cold, qualifies them, and books a meeting. Separate from assistantConfig.js
// (the inbound receptionist) because the opening line and goals are different —
// this assistant is calling *them*, unprompted, so it has to earn the first 10 seconds.

function buildOutboundAssistantConfig() {
  const businessName = process.env.BUSINESS_NAME || "the business";
  const businessServices = process.env.BUSINESS_SERVICES || "our services";
  const transferNumber = process.env.TRANSFER_PHONE_NUMBER;
  const serverUrl = process.env.PUBLIC_SERVER_URL;

  const systemPrompt = `You are calling on behalf of ${businessName}. You are calling back someone
who recently tried to reach the business (a missed call or a web inquiry) and didn't get an answer.

Your job:
- Open by identifying yourself and why you're calling: "Hi, this is ${businessName} calling you
  back about your recent inquiry." Do not pretend to be a human if directly asked.
- Find out what they need help with regarding ${businessServices}.
- If they're still interested, use check_availability and book_appointment to get them on the
  calendar before you hang up. Always confirm the date/time out loud before booking.
- If they're not interested, thank them for their time and end the call politely — do not push.
- If they ask a question you can't answer, or want to speak to a person right now, transfer the call.
- Keep it short and natural. If they don't answer or it goes to voicemail, leave a brief message
  with a callback number and end the call — do not talk to a voicemail beep as if it were a person.`;

  return {
    name: `${businessName} Follow-up Caller`,
    firstMessage: `Hi, this is ${businessName} calling you back about your recent inquiry — is now an okay time to talk?`,
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
            description: "Book an appointment. Only call this after check_availability confirms the slot is free and they've agreed to it.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format." },
                time: { type: "string", description: "24-hour time in HH:MM format." },
                callerName: { type: "string", description: "The lead's full name." },
                callerPhone: { type: "string", description: "A callback number for the lead." },
                reason: { type: "string", description: "Brief reason for the appointment." },
              },
              required: ["date", "time", "callerName"],
            },
          },
        },
        transferNumber
          ? {
              type: "transferCall",
              destinations: [
                { type: "number", number: transferNumber, message: "Let me connect you now, please hold." },
              ],
            }
          : null,
      ].filter(Boolean),
    },

    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },

    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en-US",
    },

    // Outbound calls should end promptly if it's clearly voicemail/no answer.
    voicemailDetectionEnabled: true,
    silenceTimeoutSeconds: 15,
    maxDurationSeconds: 300,
  };
}

module.exports = { buildOutboundAssistantConfig };
