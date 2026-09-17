const { isSlotAvailable } = require("../integrations/googleCalendar");

const APPOINTMENT_LENGTH_MINUTES = 30;

// args come from the LLM's function call, matching the schema in assistantConfig.js
async function checkAvailability(args) {
  const { date, time } = args; // date: "2026-09-20", time: "14:00" (24h, business's local time)

  if (!date || !time) {
    return { available: false, error: "Missing date or time." };
  }

  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) {
    return { available: false, error: "Could not parse that date/time." };
  }
  const end = new Date(start.getTime() + APPOINTMENT_LENGTH_MINUTES * 60 * 1000);

  const available = await isSlotAvailable(start.toISOString(), end.toISOString());

  return {
    available,
    slotStart: start.toISOString(),
    slotEnd: end.toISOString(),
    message: available
      ? `${date} at ${time} is open.`
      : `${date} at ${time} is already booked — offer the caller a different time.`,
  };
}

module.exports = checkAvailability;
