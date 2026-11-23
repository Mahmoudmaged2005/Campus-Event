const CAIRO_TIME_ZONE = 'Africa/Cairo';
const ONE_MINUTE = 60 * 1000;

const cairoPartsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const cairoDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function cairoParts(date) {
  const result = { year: 0, month: 0, day: 0, hour: 0, minute: 0 };
  const parts = cairoPartsFormat.formatToParts(date);
  for (const part of parts) {
    if (result[part.type] !== undefined) {
      result[part.type] = Number(part.value);
    }
  }
  return result;
}

export function cairoMinutesOfDay(date) {
  const parts = cairoParts(date);
  return parts.hour * 60 + parts.minute;
}

export function cairoDateText(date) {
  return cairoDateFormat.format(date);
}

function cairoOffsetMinutes(date) {
  const parts = cairoParts(date);
  const sameClockInUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((sameClockInUtc - date.getTime()) / ONE_MINUTE);
}

export function cairoLocalToDate(year, month, day, hour, minute) {
  const sameClockInUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuessOffset = cairoOffsetMinutes(new Date(sameClockInUtc));
  const firstGuess = sameClockInUtc - firstGuessOffset * ONE_MINUTE;
  const realOffset = cairoOffsetMinutes(new Date(firstGuess));
  return new Date(sameClockInUtc - realOffset * ONE_MINUTE);
}
