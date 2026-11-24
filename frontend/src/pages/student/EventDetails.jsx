import { useState } from 'react';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';

const REMINDER_CHOICES = [
  { minutes: 15, label: '15 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

function isOpen(event) {
  return event.status === 'APPROVED' && new Date(event.startsAt) > new Date();
}

function placesText(event) {
  if (event.capacity === null) {
    return event.registeredCount + ' registered, no limit';
  }
  return event.registeredCount + ' of ' + event.capacity + ' places taken';
}

function WeatherBox({ event, onError }) {
  const [weatherText, setWeatherText] = useState('');

  async function handleShowWeather() {
    try {
      const data = await apiRequest('/student/events/' + event.id + '/weather');
      const weather = data.weather;
      if (!weather.available) {
        setWeatherText(weather.reason);
        return;
      }
      setWeatherText(
        weather.summary + ', ' + weather.minTemperature + ' to ' + weather.maxTemperature +
        ' °C, ' + weather.rainChance + '% chance of rain',
      );
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <div className="details-box">
      <button type="button" className="button-secondary" onClick={handleShowWeather}>Show weather</button>
      {weatherText ? <p>{weatherText}</p> : null}
    </div>
  );
}

function ReminderForm({ event, runAction }) {
  const [minutesBefore, setMinutesBefore] = useState(60);

  function handleSubmit(formEvent) {
    formEvent.preventDefault();
    runAction(function () {
      return apiRequest('/student/events/' + event.id + '/reminders', {
        method: 'POST',
        body: { minutesBefore: Number(minutesBefore) },
      });
    }, 'Reminder added');
  }

  return (
    <form className="details-box" onSubmit={handleSubmit}>
      <label>
        Remind me
        <select value={minutesBefore} onChange={(changeEvent) => setMinutesBefore(changeEvent.target.value)}>
          {REMINDER_CHOICES.map(function (choice) {
            return <option key={choice.minutes} value={choice.minutes}>{choice.label}</option>;
          })}
        </select>
      </label>
      <button type="submit" className="button-secondary">Add reminder</button>
    </form>
  );
}

function ReportForm({ event, runAction }) {
  const [reason, setReason] = useState('');

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    const worked = await runAction(function () {
      return apiRequest('/student/events/' + event.id + '/report', { method: 'POST', body: { reason: reason } });
    }, 'Thank you, an admin will look at your report');
    if (worked) {
      setReason('');
    }
  }

  return (
    <form className="details-box" onSubmit={handleSubmit}>
      <label>
        Something wrong with this event?
        <textarea value={reason} maxLength={500} onChange={(changeEvent) => setReason(changeEvent.target.value)} />
      </label>
      <button type="submit" className="button-secondary">Report</button>
    </form>
  );
}

function SaveAndRegisterButtons({ event, runAction }) {
  const savePath = '/student/events/' + event.id + '/save';
  const registerPath = '/student/events/' + event.id + '/registration';
  return (
    <>
      {event.isSaved ? (
        <button type="button" className="button-secondary" onClick={() => runAction(() => apiRequest(savePath, { method: 'DELETE' }), 'Removed from saved events')}>
          Unsave
        </button>
      ) : (
        <button type="button" onClick={() => runAction(() => apiRequest(savePath, { method: 'POST' }), 'Event saved')}>
          Save
        </button>
      )}
      {event.isRegistered ? (
        <button type="button" className="button-danger" onClick={() => runAction(() => apiRequest(registerPath, { method: 'DELETE' }), 'Registration cancelled')}>
          Cancel registration
        </button>
      ) : (
        <button type="button" onClick={() => runAction(() => apiRequest(registerPath, { method: 'POST' }), 'You are registered')}>
          Register
        </button>
      )}
    </>
  );
}

export default function EventDetails({ event, runAction, onError }) {
  const open = isOpen(event);
  return (
    <div className="event-details">
      <EventCard event={event}>
        {open ? <SaveAndRegisterButtons event={event} runAction={runAction} /> : null}
      </EventCard>
      <p className="event-where">{placesText(event)}</p>
      {open ? <WeatherBox key={event.id} event={event} onError={onError} /> : null}
      {open && (event.isSaved || event.isRegistered) ? <ReminderForm event={event} runAction={runAction} /> : null}
      {event.status === 'APPROVED' ? <ReportForm key={event.id} event={event} runAction={runAction} /> : null}
    </div>
  );
}
