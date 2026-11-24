import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';
import Message from '../../components/Message.jsx';
import CapacityLine from './CapacityLine.jsx';

const MAX_POSTER_BYTES = 2 * 1024 * 1024;

function canEdit(event) {
  return event.status === 'PENDING' || event.status === 'REJECTED';
}

function canDeleteOrCancel(event) {
  return canEdit(event) || event.status === 'APPROVED';
}

export default function MyEvents() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: 'success', text: location.state ? location.state.message : '' });

  async function loadEvents() {
    try {
      const data = await apiRequest('/events/mine');
      setEvents(data.events);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  }

  useEffect(function () {
    loadEvents();
  }, []);

  async function runAction(action, successText) {
    setMessage({ type: 'info', text: 'Working...' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  function handlePosterChosen(event, inputEvent) {
    const file = inputEvent.target.files[0];
    inputEvent.target.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_POSTER_BYTES) {
      setMessage({ type: 'error', text: 'The image can be at most 2 MB' });
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    runAction(function () {
      return apiRequest('/events/' + event.id + '/image', { method: 'POST', formData: formData });
    }, 'Poster saved for "' + event.title + '"');
  }

  function handleRemovePoster(event) {
    runAction(function () {
      return apiRequest('/events/' + event.id + '/image', { method: 'DELETE' });
    }, 'Poster removed from "' + event.title + '"');
  }

  function handleDelete(event) {
    let question = 'Delete "' + event.title + '"? This cannot be undone.';
    if (event.status === 'APPROVED') {
      question = 'Cancel "' + event.title + '"? Students will see it as cancelled.';
    }
    if (!window.confirm(question)) {
      return;
    }
    runAction(function () {
      return apiRequest('/events/' + event.id, { method: 'DELETE' });
    }, 'Done: "' + event.title + '"');
  }

  return (
    <section>
      <div className="page-title-row">
        <h1>My events</h1>
        <Link className="button" to="/organizer/events/new">New event</Link>
      </div>
      <Message type={message.type} text={message.text} />
      {loading ? <p>Loading...</p> : null}
      {!loading && events.length === 0 ? <p>You have no events yet.</p> : null}
      <div className="event-list">
        {events.map(function (event) {
          return (
            <EventCard key={event.id} event={event}>
              {event.status === 'APPROVED' ? <CapacityLine eventId={event.id} /> : null}
              {canEdit(event) ? (
                <>
                  <Link className="button-secondary" to={'/organizer/events/' + event.id + '/edit'}>Edit</Link>
                  <label className="button-secondary file-button">
                    {event.imageUrl ? 'Change poster' : 'Add poster'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(inputEvent) => handlePosterChosen(event, inputEvent)}
                    />
                  </label>
                  {event.imageUrl ? (
                    <button type="button" className="button-secondary" onClick={() => handleRemovePoster(event)}>
                      Remove poster
                    </button>
                  ) : null}
                </>
              ) : null}
              {canDeleteOrCancel(event) ? (
                <button type="button" className="button-danger" onClick={() => handleDelete(event)}>
                  {event.status === 'APPROVED' ? 'Cancel event' : 'Delete'}
                </button>
              ) : null}
            </EventCard>
          );
        })}
      </div>
    </section>
  );
}
