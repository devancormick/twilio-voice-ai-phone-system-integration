function parseHourMinute(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid business-hours time: ${value}`);
  }

  return {
    hour: Number.parseInt(match[1], 10),
    minute: Number.parseInt(match[2], 10)
  };
}

function getZonedParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function isBusinessHours(date, config) {
  const zoned = getZonedParts(date, config.businessTimezone);
  const weekday = zoned.weekday;
  const currentMinutes = Number.parseInt(zoned.hour, 10) * 60 + Number.parseInt(zoned.minute, 10);
  const start = parseHourMinute(config.businessHoursStart);
  const end = parseHourMinute(config.businessHoursEnd);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const weekdayOpen = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);

  return weekdayOpen && currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
