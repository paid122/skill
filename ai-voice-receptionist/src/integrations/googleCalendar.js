const { google } = require("googleapis");

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

// slotStart/slotEnd are ISO strings. Returns true if the slot is free.
async function isSlotAvailable(slotStartISO, slotEndISO) {
  if (!isConfigured()) {
    // Demo fallback so the agent is testable before Google Calendar is wired up.
    return true;
  }
  const calendar = getCalendarClient();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: slotStartISO,
      timeMax: slotEndISO,
      items: [{ id: CALENDAR_ID }],
    },
  });
  const busy = res.data.calendars[CALENDAR_ID]?.busy || [];
  return busy.length === 0;
}

async function createAppointment({ summary, description, startISO, endISO, attendeeEmail, attendeeName }) {
  if (!isConfigured()) {
    return {
      id: `demo-${Date.now()}`,
      htmlLink: null,
      note: "Google Calendar not configured yet — appointment was NOT actually saved. See docs/SETUP.md.",
    };
  }
  const calendar = getCalendarClient();
  const event = {
    summary,
    description,
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    attendees: attendeeEmail ? [{ email: attendeeEmail, displayName: attendeeName }] : undefined,
  };
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: event,
    sendUpdates: attendeeEmail ? "all" : "none",
  });
  return { id: res.data.id, htmlLink: res.data.htmlLink };
}

module.exports = { isConfigured, isSlotAvailable, createAppointment };
