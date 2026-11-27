import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const CAIRO = 'Africa/Cairo';

export function inputToIso(inputValue) {
  if (!inputValue) {
    return '';
  }
  return fromZonedTime(inputValue, CAIRO).toISOString();
}

export function isoToInput(isoText) {
  return formatInTimeZone(isoText, CAIRO, "yyyy-MM-dd'T'HH:mm");
}

export function showCairoDateTime(isoText) {
  return formatInTimeZone(isoText, CAIRO, 'EEE d MMM yyyy, HH:mm');
}

export function showCairoClock(isoText) {
  return formatInTimeZone(isoText, CAIRO, 'HH:mm');
}

export function showCairoRange(startIso, endIso) {
  const startDay = formatInTimeZone(startIso, CAIRO, 'yyyy-MM-dd');
  const endDay = formatInTimeZone(endIso, CAIRO, 'yyyy-MM-dd');
  if (startDay === endDay) {
    return showCairoDateTime(startIso) + ' to ' + showCairoClock(endIso);
  }
  return showCairoDateTime(startIso) + ' to ' + showCairoDateTime(endIso);
}
