import { useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { showCairoRange } from '../../utils/cairoDates.js';

const REMINDER_CHOICES = [
  { minutes: 15, label: '15 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

function hideBrokenPoster(errorEvent) {
  errorEvent.target.style.display = 'none';
}

function isOpen(event) {
  return event.status === 'APPROVED' && new Date(event.startsAt) > new Date();
}

function Places({ event }) {
  if (event.capacity === null) {
    return <p className="muted small">{event.registeredCount} registered · no place limit</p>;
  }
  let percent = Math.round((event.registeredCount / event.capacity) * 100);
  if (percent > 100) {
    percent = 100;
  }
  return (
    <div className="stack-tight">
      <p className="muted small">{event.registeredCount} of {event.capacity} places taken</p>
      <div className="places-bar">
        <div className="places-bar-fill" style={{ width: percent + '%' }} />
      </div>
    </div>
  );
}

function WeatherSection({ eventId }) {
  const [weatherText, setWeatherText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleShowWeather() {
    setLoading(true);
    try {
      const data = await apiRequest('/student/events/' + eventId + '/weather');
      const weather = data.weather;
      if (!weather.available) {
        setWeatherText(weather.reason);
      } else {
        setWeatherText(
          weather.summary + ', ' + weather.minTemperature + ' to ' + weather.maxTemperature +
          ' °C, ' + weather.rainChance + '% chance of rain',
        );
      }
    } catch (error) {
      setWeatherText(error.message);
    }
    setLoading(false);
  }

  return (
    <div className="details-section">
      <h4>Weather</h4>
      {weatherText ? (
        <p>{weatherText}</p>
      ) : (
        <button type="button" className="button-secondary button-small" disabled={loading} onClick={handleShowWeather}>
          {loading ? 'Loading...' : 'Show the forecast'}
        </button>
      )}
    </div>
  );
}

function ReminderSection({ busy, onAdd }) {
  const [minutesBefore, setMinutesBefore] = useState(60);

  function handleSubmit(formEvent) {
    formEvent.preventDefault();
    onAdd(Number(minutesBefore));
  }

  return (
    <form className="details-section" onSubmit={handleSubmit}>
      <label>
        Remind me
        <select value={minutesBefore} onChange={(changeEvent) => setMinutesBefore(changeEvent.target.value)}>
          {REMINDER_CHOICES.map(function (choice) {
            return <option key={choice.minutes} value={choice.minutes}>{choice.label}</option>;
          })}
        </select>
      </label>
      <div>
        <button type="submit" className="button-secondary button-small" disabled={busy}>Add reminder</button>
      </div>
    </form>
  );
}

function ReportSection({ busy, onReport }) {
  const [reason, setReason] = useState('');

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    const worked = await onReport(reason);
    if (worked) {
      setReason('');
    }
  }

  return (
    <form className="details-section" onSubmit={handleSubmit}>
      <label>
        Something wrong with this event?
        <textarea value={reason} maxLength={500} required onChange={(changeEvent) => setReason(changeEvent.target.value)} />
      </label>
      <div>
        <button type="submit" className="button-danger button-small" disabled={busy}>Report to an admin</button>
      </div>
    </form>
  );
}

export default function EventDetails({ event, onEventChanged }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const eventPath = '/student/events/' + event.id;
  const open = isOpen(event);

  async function runAction(action, successText) {
    setBusy(true);
    setMessage({ type: 'info', text: '' });
    let worked = true;
    try {
      await action();
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      worked = false;
    }
    setBusy(false);
    return worked;
  }

  function handleSave() {
    runAction(async function () {
      await apiRequest(eventPath + '/save', { method: 'POST' });
      onEventChanged(event.id, { isSaved: true });
    }, 'Saved. You find it under My events.');
  }

  function handleUnsave() {
    runAction(async function () {
      await apiRequest(eventPath + '/save', { method: 'DELETE' });
      onEventChanged(event.id, { isSaved: false });
    }, 'Removed from your saved events.');
  }

  function handleRegister() {
    runAction(async function () {
      await apiRequest(eventPath + '/registration', { method: 'POST' });
      onEventChanged(event.id, { isRegistered: true, registeredCount: event.registeredCount + 1 });
    }, 'You are registered. A confirmation email is on its way.');
  }

  function handleCancelRegistration() {
    runAction(async function () {
      await apiRequest(eventPath + '/registration', { method: 'DELETE' });
      onEventChanged(event.id, { isRegistered: false, registeredCount: event.registeredCount - 1 });
    }, 'Your registration is cancelled.');
  }

  function handleAddReminder(minutesBefore) {
    runAction(function () {
      return apiRequest(eventPath + '/reminders', { method: 'POST', body: { minutesBefore: minutesBefore } });
    }, 'Reminder added.');
  }

  function handleReport(reason) {
    return runAction(function () {
      return apiRequest(eventPath + '/report', { method: 'POST', body: { reason: reason } });
    }, 'Thank you, an admin will look at your report.');
  }

  return (
    <aside className="details-panel">
      {event.imageUrl ? <img className="event-poster" src={event.imageUrl} alt={'Poster for ' + event.title} onError={hideBrokenPoster} /> : null}
      <div className="stack-tight">
        <div className="event-title-row">
          <h3>{event.title}</h3>
          <StatusBadge status={event.status} />
        </div>
        <p className="event-when">{showCairoRange(event.startsAt, event.endsAt)}</p>
        <p className="event-where">
          {event.location}
          {event.category ? ' · ' + event.category.name : ''}
        </p>
      </div>
      <p>{event.description}</p>
      <Places event={event} />
      <Message type={message.type} text={message.text} />

      {open ? (
        <div className="row">
          {event.isRegistered ? (
            <button type="button" className="button-danger" disabled={busy} onClick={handleCancelRegistration}>Cancel registration</button>
          ) : (
            <button type="button" disabled={busy} onClick={handleRegister}>Register</button>
          )}
          {event.isSaved ? (
            <button type="button" className="button-secondary" disabled={busy} onClick={handleUnsave}>Unsave</button>
          ) : (
            <button type="button" className="button-secondary" disabled={busy} onClick={handleSave}>Save</button>
          )}
        </div>
      ) : (
        <p className="muted small">This event is not open for registration.</p>
      )}

      {open ? <WeatherSection eventId={event.id} /> : null}
      {open && (event.isSaved || event.isRegistered) ? <ReminderSection busy={busy} onAdd={handleAddReminder} /> : null}
      {event.status === 'APPROVED' ? <ReportSection busy={busy} onReport={handleReport} /> : null}
    </aside>
  );
}
