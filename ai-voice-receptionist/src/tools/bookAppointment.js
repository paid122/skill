const { isSlotAvailable, createAppointment } = require("../integrations/googleCalendar");
const { notifySlack } = require("../integrations/slackNotify");

const APPOINTMENT_LENGTH_MINUTES = 30;

async function bookAppointment(args) {
  const { date, time, callerName, callerPhone, reason } = args;

  if (!date || !time || !callerName) {
    return { booked: false, error: "Missing date, time, or caller name." };
  }

  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) {
    return { booked: false, error: "Could not parse that date/time." };
  }
  const end = new Date(start.getTime() + APPOINTMENT_LENGTH_MINUTES * 60 * 1000);

  const stillFree = await isSlotAvailable(start.toISOString(), end.toISOString());
  if (!stillFree) {
    return { booked: false, error: "That slot was just taken. Ask the caller for another time." };
  }

  const event = await createAppointment({
    summary: `${callerName} — ${reason || "Appointment"}`,
    description: `Booked by AI receptionist.\nCaller phone: ${callerPhone || "unknown"}\nReason: ${reason || "n/a"}`,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    attendeeName: callerName,
  });

  await notifySlack(
    `📅 New appointment booked by AI receptionist:\n*${callerName}* — ${date} at ${time}\nReason: ${reason || "n/a"}\nPhone: ${callerPhone || "unknown"}`
  );

  return {
    booked: true,
    eventId: event.id,
    confirmation: `Booked for ${callerName} on ${date} at ${time}.`,
  };
}

module.exports = bookAppointment;
