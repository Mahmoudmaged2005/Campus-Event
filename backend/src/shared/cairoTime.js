const CAIRO_TIME_ZONE = 'Africa/Cairo';

const cairoClockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CAIRO_TIME_ZONE,
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

export function cairoMinutesOfDay(date) {
  const parts = cairoClockFormat.formatToParts(date);
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === 'hour') {
      hours = Number(part.value);
    }
    if (part.type === 'minute') {
      minutes = Number(part.value);
    }
  }
  return hours * 60 + minutes;
}

export function cairoDateText(date) {
  return cairoDateFormat.format(date);
}
