import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';
import Message from '../../components/Message.jsx';
import { replaceById, removeById } from '../../utils/lists.js';
import CapacityLine from './CapacityLine.jsx';

const MAX_POSTER_BYTES = 2 * 1024 * 1024;

function canEdit(event) {
  return event.status === 'PENDING' || event.status === 'REJECTED';
}

function canDeleteOrCancel(event) {
  return canEdit(event) || event.status === 'APPROVED';
}

function countByStatus(events, status) {
  let count = 0;
  for (const event of events) {
    if (event.status === status) {
      count = count + 1;
    }
  }
  return count;
}

function Stat({ number, label }) {
  return (
    <div className="stat">
      <p className="stat-number">{number}</p>
      <p className="muted small">{label}</p>
    </div>
  );
}

export default function MyEvents() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ type: 'success', text: location.state ? location.state.message : '' });

  useEffect(function () {
    async function loadEvents() {
      try {
        const data = await apiRequest('/events/mine');
        setEvents(data.events);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
      setLoading(false);
    }
    loadEvents();
  }, []);

  async function runAction(event, action, successText) {
    setBusyId(event.id);
    setMessage({ type: 'info', text: '' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setBusyId(null);
  }

  function showChangedEvent(changedEvent) {
    setEvents(function (current) {
      return replaceById(current, changedEvent);
    });
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
    runAction(event, async function () {
      const data = await apiRequest('/events/' + event.id + '/image', { method: 'POST', formData: formData });
      showChangedEvent(data.event);
    }, 'Poster saved for "' + event.title + '"');
  }

  function handleRemovePoster(event) {
    runAction(event, async function () {
      const data = await apiRequest('/events/' + event.id + '/image', { method: 'DELETE' });
      showChangedEvent(data.event);
    }, 'Poster removed from "' + event.title + '"');
  }

  function handleDelete(event) {
    let question = 'Delete "' + event.title + '"? This cannot be undone.';
    if (event.status === 'APPROVED') {
      question = 'Cancel "' + event.title + '"? Registered students will be told.';
    }
    if (!window.confirm(question)) {
      return;
    }
    runAction(event, async function () {
      const data = await apiRequest('/events/' + event.id, { method: 'DELETE' });
      if (data.result === 'cancelled') {
        showChangedEvent(data.event);
        return;
      }
      setEvents(function (current) {
        return removeById(current, event.id);
      });
    }, 'Done: "' + event.title + '"');
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>My events</h1>
          <p className="page-intro">Create events, add posters and follow how many students registered.</p>
        </div>
        <Link className="button" to="/organizer/events/new">New event</Link>
      </div>
      <Message type={message.type} text={message.text} />
      {loading ? <p className="muted">Loading...</p> : (
        <div className="stats">
          <Stat number={countByStatus(events, 'PENDING')} label="Waiting for review" />
          <Stat number={countByStatus(events, 'APPROVED')} label="Approved" />
          <Stat number={countByStatus(events, 'REJECTED')} label="Rejected" />
        </div>
      )}
      {!loading && events.length === 0 ? (
        <p className="empty">You have no events yet. Click "New event" to create your first one.</p>
      ) : null}
      <div className="event-list">
        {events.map(function (event) {
          const busy = busyId === event.id;
          return (
            <EventCard key={event.id} event={event}>
              {event.status === 'APPROVED' ? <CapacityLine eventId={event.id} /> : null}
              {event.status === 'APPROVED' ? (
                <Link className="button-secondary button-small" to={'/organizer/events/' + event.id + '/reschedule'}>Reschedule</Link>
              ) : null}
              {canEdit(event) ? (
                <>
                  <Link className="button-secondary button-small" to={'/organizer/events/' + event.id + '/edit'}>Edit</Link>
                  <label className="button-secondary button-small file-button">
                    {event.imageUrl ? 'Change poster' : 'Add poster'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(inputEvent) => handlePosterChosen(event, inputEvent)}
                    />
                  </label>
                  {event.imageUrl ? (
                    <button type="button" className="button-secondary button-small" disabled={busy} onClick={() => handleRemovePoster(event)}>
                      Remove poster
                    </button>
                  ) : null}
                </>
              ) : null}
              {canDeleteOrCancel(event) ? (
                <button type="button" className="button-danger button-small" disabled={busy} onClick={() => handleDelete(event)}>
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
