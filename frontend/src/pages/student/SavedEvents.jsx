import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';
import Message from '../../components/Message.jsx';
import { removeById } from '../../utils/lists.js';
import { showCairoDateTime } from '../../utils/cairoDates.js';

function Stat({ number, label }) {
  return (
    <div className="stat">
      <p className="stat-number">{number}</p>
      <p className="muted small">{label}</p>
    </div>
  );
}

export default function SavedEvents() {
  const [registrations, setRegistrations] = useState([]);
  const [savedEvents, setSavedEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState({ type: 'info', text: '' });

  useEffect(function () {
    async function loadAll() {
      try {
        const answers = await Promise.all([
          apiRequest('/student/registrations'),
          apiRequest('/student/saved'),
          apiRequest('/student/reminders'),
        ]);
        setRegistrations(answers[0].registrations);
        setSavedEvents(answers[1].savedEvents);
        setReminders(answers[2].reminders);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
      setLoading(false);
    }
    loadAll();
  }, []);

  async function runAction(key, action, successText) {
    setBusyKey(key);
    setMessage({ type: 'info', text: '' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setBusyKey('');
  }

  function cancelRegistration(registration) {
    runAction('registration-' + registration.id, async function () {
      await apiRequest('/student/events/' + registration.eventId + '/registration', { method: 'DELETE' });
      setRegistrations(function (current) {
        return removeById(current, registration.id);
      });
    }, 'Registration cancelled for "' + registration.event.title + '"');
  }

  function unsave(savedEvent) {
    runAction('saved-' + savedEvent.id, async function () {
      await apiRequest('/student/events/' + savedEvent.eventId + '/save', { method: 'DELETE' });
      setSavedEvents(function (current) {
        return removeById(current, savedEvent.id);
      });
    }, 'Removed "' + savedEvent.event.title + '" from saved events');
  }

  function deleteReminder(reminder) {
    runAction('reminder-' + reminder.id, async function () {
      await apiRequest('/student/reminders/' + reminder.id, { method: 'DELETE' });
      setReminders(function (current) {
        return removeById(current, reminder.id);
      });
    }, 'Reminder deleted');
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>My events</h1>
          <p className="page-intro">Your registrations, saved events and reminders.</p>
        </div>
        <Link className="button-secondary" to="/student">Browse the calendar</Link>
      </div>
      <Message type={message.type} text={message.text} />
      {loading ? <p className="muted">Loading...</p> : (
        <div className="stats">
          <Stat number={registrations.length} label="Registered" />
          <Stat number={savedEvents.length} label="Saved" />
          <Stat number={reminders.length} label="Reminders" />
        </div>
      )}

      <h2>Registered</h2>
      {!loading && registrations.length === 0 ? <p className="empty">You are not registered for any event yet.</p> : null}
      <div className="event-list">
        {registrations.map(function (registration) {
          return (
            <EventCard key={registration.id} event={registration.event}>
              <button
                type="button"
                className="button-danger button-small"
                disabled={busyKey === 'registration-' + registration.id}
                onClick={() => cancelRegistration(registration)}
              >
                Cancel registration
              </button>
            </EventCard>
          );
        })}
      </div>

      <h2>Saved</h2>
      {!loading && savedEvents.length === 0 ? <p className="empty">You have not saved any event. Save events from the calendar.</p> : null}
      <div className="event-list">
        {savedEvents.map(function (savedEvent) {
          return (
            <EventCard key={savedEvent.id} event={savedEvent.event}>
              <button
                type="button"
                className="button-secondary button-small"
                disabled={busyKey === 'saved-' + savedEvent.id}
                onClick={() => unsave(savedEvent)}
              >
                Unsave
              </button>
            </EventCard>
          );
        })}
      </div>

      <h2>Reminders</h2>
      {!loading && reminders.length === 0 ? <p className="empty">No reminders yet. Add them from an event in the calendar.</p> : null}
      {reminders.length > 0 ? (
        <ul className="plain-list">
          {reminders.map(function (reminder) {
            return (
              <li key={reminder.id}>
                <div>
                  <p><strong>{reminder.event.title}</strong></p>
                  <p className="muted small">
                    Reminder at {showCairoDateTime(reminder.remindAt)}
                    {reminder.sentAt ? ' · sent' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="button-secondary button-small"
                  disabled={busyKey === 'reminder-' + reminder.id}
                  onClick={() => deleteReminder(reminder)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
