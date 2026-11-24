import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';
import Message from '../../components/Message.jsx';
import { showCairoDateTime } from '../../utils/cairoDates.js';
import StudentNav from './StudentNav.jsx';
import FollowCategories from './FollowCategories.jsx';

export default function SavedEvents() {
  const [savedEvents, setSavedEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  async function loadAll() {
    try {
      const saved = await apiRequest('/student/saved');
      const registered = await apiRequest('/student/registrations');
      const recommended = await apiRequest('/student/recommendations');
      const reminderData = await apiRequest('/student/reminders');
      setSavedEvents(saved.savedEvents);
      setRegistrations(registered.registrations);
      setRecommendations(recommended.recommendations);
      setReminders(reminderData.reminders);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  }

  useEffect(function () {
    loadAll();
  }, []);

  async function runAction(path, method, successText) {
    setMessage({ type: 'info', text: 'Working...' });
    try {
      await apiRequest(path, { method: method });
      setMessage({ type: 'success', text: successText });
      await loadAll();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  return (
    <section>
      <StudentNav />
      <h1>My events</h1>
      <Message type={message.type} text={message.text} />
      {loading ? <p>Loading...</p> : null}

      <h2>Registered</h2>
      {!loading && registrations.length === 0 ? <p>You are not registered for any event.</p> : null}
      <div className="event-list">
        {registrations.map(function (registration) {
          return (
            <EventCard key={registration.id} event={registration.event}>
              <button type="button" className="button-danger" onClick={() => runAction('/student/events/' + registration.eventId + '/registration', 'DELETE', 'Registration cancelled')}>
                Cancel registration
              </button>
            </EventCard>
          );
        })}
      </div>

      <h2>Saved</h2>
      {!loading && savedEvents.length === 0 ? <p>You have not saved any event. Save events from the calendar.</p> : null}
      <div className="event-list">
        {savedEvents.map(function (savedEvent) {
          return (
            <EventCard key={savedEvent.id} event={savedEvent.event}>
              <button type="button" className="button-secondary" onClick={() => runAction('/student/events/' + savedEvent.eventId + '/save', 'DELETE', 'Removed from saved events')}>
                Unsave
              </button>
            </EventCard>
          );
        })}
      </div>

      <h2>My reminders</h2>
      {!loading && reminders.length === 0 ? <p>No reminders yet. Add them from the calendar.</p> : null}
      <ul className="simple-list">
        {reminders.map(function (reminder) {
          return (
            <li key={reminder.id}>
              {reminder.event.title}: {showCairoDateTime(reminder.remindAt)}
              {reminder.sentAt ? ' (sent)' : ''}
              <button type="button" className="button-secondary" onClick={() => runAction('/student/reminders/' + reminder.id, 'DELETE', 'Reminder deleted')}>
                Delete
              </button>
            </li>
          );
        })}
      </ul>

      <h2>Categories I follow</h2>
      <p>You get recommendations and a weekly digest for the categories you follow.</p>
      <FollowCategories onChanged={loadAll} onError={(text) => setMessage({ type: 'error', text: text })} />

      <h2>Recommended for you</h2>
      {!loading && recommendations.length === 0 ? <p>Follow categories or save events to get recommendations.</p> : null}
      <div className="event-list">
        {recommendations.map(function (recommendation) {
          return (
            <EventCard key={recommendation.event.id} event={recommendation.event}>
              <span className="recommend-reason">{recommendation.reason}</span>
              <button type="button" onClick={() => runAction('/student/events/' + recommendation.event.id + '/save', 'POST', 'Event saved')}>
                Save
              </button>
            </EventCard>
          );
        })}
      </div>
    </section>
  );
}
