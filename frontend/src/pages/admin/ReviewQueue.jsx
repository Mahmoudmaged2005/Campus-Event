import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';
import Message from '../../components/Message.jsx';
import AdminNav from './AdminNav.jsx';
import TrustInfo from './TrustInfo.jsx';

export default function ReviewQueue() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState('');

  async function loadQueue() {
    try {
      const data = await apiRequest('/admin/review-queue');
      setEvents(data.events);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  }

  useEffect(function () {
    loadQueue();
  }, []);

  async function runAction(action, successText) {
    setMessage({ type: 'info', text: 'Working...' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      setRejectingId(null);
      setReason('');
      await loadQueue();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  function handleApprove(event) {
    runAction(function () {
      return apiRequest('/admin/events/' + event.id + '/approve', { method: 'POST' });
    }, 'Approved "' + event.title + '"');
  }

  function startReject(event) {
    setRejectingId(event.id);
    setReason('');
  }

  function handleReject(formEvent, event) {
    formEvent.preventDefault();
    runAction(function () {
      return apiRequest('/admin/events/' + event.id + '/reject', { method: 'POST', body: { reason: reason } });
    }, 'Rejected "' + event.title + '"');
  }

  return (
    <section>
      <AdminNav />
      <h1>Review queue</h1>
      <Message type={message.type} text={message.text} />
      {loading ? <p>Loading...</p> : null}
      {!loading && events.length === 0 ? <p>No events are waiting for review.</p> : null}
      <div className="event-list">
        {events.map(function (event) {
          return (
            <EventCard key={event.id} event={event}>
              <div>
                <p className="event-where">By {event.organizer.name} ({event.organizer.email})</p>
                <TrustInfo trust={event.organizerTrust} />
                {rejectingId === event.id ? (
                  <form className="form" onSubmit={(formEvent) => handleReject(formEvent, event)}>
                    <label>
                      Reason for rejecting
                      <textarea value={reason} onChange={(inputEvent) => setReason(inputEvent.target.value)} required />
                    </label>
                    <div className="event-actions">
                      <button type="submit" className="button-danger">Send rejection</button>
                      <button type="button" className="button-secondary" onClick={() => setRejectingId(null)}>
                        Back
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="event-actions">
                    <button type="button" className="button" onClick={() => handleApprove(event)}>Approve</button>
                    <button type="button" className="button-danger" onClick={() => startReject(event)}>Reject</button>
                  </div>
                )}
              </div>
            </EventCard>
          );
        })}
      </div>
    </section>
  );
}
