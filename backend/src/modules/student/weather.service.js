import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { cairoDateText } from '../../shared/cairoTime.js';

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const CAMPUS_LATITUDE = 30.0444;
const CAMPUS_LONGITUDE = 31.2357;
const FORECAST_DAYS = 15;
const ONE_DAY = 24 * 60 * 60 * 1000;
const WAIT_FOR_ANSWER_MS = 5000;

function weatherCodeText(code) {
  if (code === 0) {
    return 'Clear sky';
  }
  if (code <= 3) {
    return 'Partly cloudy';
  }
  if (code === 45 || code === 48) {
    return 'Fog';
  }
  if (code >= 51 && code <= 57) {
    return 'Drizzle';
  }
  if (code >= 61 && code <= 67) {
    return 'Rain';
  }
  if (code >= 71 && code <= 77) {
    return 'Snow';
  }
  if (code >= 80 && code <= 82) {
    return 'Rain showers';
  }
  if (code >= 95) {
    return 'Thunderstorm';
  }
  return 'Mixed weather';
}

function buildForecastUrl(dateText) {
  const url = new URL(WEATHER_API_URL);
  url.searchParams.set('latitude', String(CAMPUS_LATITUDE));
  url.searchParams.set('longitude', String(CAMPUS_LONGITUDE));
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('timezone', 'Africa/Cairo');
  url.searchParams.set('start_date', dateText);
  url.searchParams.set('end_date', dateText);
  return url;
}

async function fetchForecast(dateText) {
  let response;
  let body;
  try {
    response = await fetch(buildForecastUrl(dateText), { signal: AbortSignal.timeout(WAIT_FOR_ANSWER_MS) });
    body = await response.json();
  } catch (error) {
    throw new AppError(503, 'The weather service is not reachable right now, try again later');
  }
  if (!response.ok || body.error === true) {
    return null;
  }
  return body.daily;
}

function notAvailable(dateText, reason) {
  return { available: false, date: dateText, reason: reason };
}

export async function getWeatherForDate(date) {
  const dateText = cairoDateText(date);
  const now = new Date();
  if (date <= now) {
    return notAvailable(dateText, 'This date has already passed');
  }
  if (date.getTime() - now.getTime() > FORECAST_DAYS * ONE_DAY) {
    return notAvailable(dateText, 'The forecast is only available up to ' + FORECAST_DAYS + ' days ahead');
  }
  const daily = await fetchForecast(dateText);
  if (daily === null) {
    return notAvailable(dateText, 'There is no forecast for this date yet');
  }
  return {
    available: true,
    date: dateText,
    summary: weatherCodeText(daily.weather_code[0]),
    maxTemperature: daily.temperature_2m_max[0],
    minTemperature: daily.temperature_2m_min[0],
    rainChance: daily.precipitation_probability_max[0],
  };
}

export async function getEventWeather(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null || event.status !== 'APPROVED') {
    throw new AppError(404, 'Event not found');
  }
  const weather = await getWeatherForDate(event.startsAt);
  return { eventId: event.id, title: event.title, weather: weather };
}

export function weatherShortText(weather) {
  return (
    weather.summary + ', ' + weather.minTemperature + ' to ' + weather.maxTemperature +
    ' °C, ' + weather.rainChance + '% chance of rain'
  );
}
