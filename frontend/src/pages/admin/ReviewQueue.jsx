import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import EventCard from '../../components/EventCard.jsx';
import Message from '../../components/Message.jsx';
import { removeById } from '../../utils/lists.js';
import TrustInfo from './TrustInfo.jsx';

function RejectForm({ busy, onSend, onBack }) {
  const [reason, setReason] = useState('');

  function handleSubmit(formEvent) {
    formEvent.preventDefault();
    onSend(reason);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Reason for rejecting (the organizer sees it)
        <textarea value={reason} onChange={(inputEvent) => setReason(inputEvent.target.value)} required minLength={5} maxLength={500} />
      </label>
      <div className="row">
        <button type="submit" className="button-danger button-small" disabled={busy}>Send rejection</button>
        <button type="button" className="button-secondary button-small" onClick={onBack}>Back</button>
      </div>
    </form>
  );
}

export default function ReviewQueue() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  useEffect(function () {
    async function loadQueue() {
      try {
        const data = await apiRequest('/admin/review-queue');
        setEvents(data.events);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
      setLoading(false);
    }
    loadQueue();
  }, []);

  async function reviewEvent(event, path, body, successText) {
    setBusyId(event.id);
    setMessage({ type: 'info', text: '' });
    try {
      await apiRequest('/admin/events/' + event.id + path, { method: 'POST', body: body });
      setEvents(function (current) {
        return removeById(current, event.id);
      });
      setRejectingId(null);
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setBusyId(null);
  }

  function handleApprove(event) {
    reviewEvent(event, '/approve', undefined, 'Approved "' + event.title + '". The organizer gets an email.');
  }

  function handleReject(event, reason) {
    reviewEvent(event, '/reject', { reason: reason }, 'Rejected "' + event.title + '". The organizer gets an email.');
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Review queue</h1>
          <p className="page-intro">Events waiting for approval, oldest first.</p>
        </div>
        {!loading ? <span className="badge badge-info">{events.length} waiting</span> : null}
      </div>
      <Message type={message.type} text={message.text} />
      {loading ? <p className="muted">Loading...</p> : null}
      {!loading && events.length === 0 ? <p className="empty">No events are waiting for review.</p> : null}
      <div className="event-list">
        {events.map(function (event) {
          return (
            <EventCard key={event.id} event={event}>
              <div className="stack-tight">
                <p className="trust-line">By {event.organizer.name} ({event.organizer.email})</p>
                <TrustInfo trust={event.organizerTrust} />
                {rejectingId === event.id ? (
                  <RejectForm
                    busy={busyId === event.id}
                    onSend={(reason) => handleReject(event, reason)}
                    onBack={() => setRejectingId(null)}
                  />
                ) : (
                  <div className="row">
                    <button type="button" className="button-small" disabled={busyId === event.id} onClick={() => handleApprove(event)}>
                      Approve
                    </button>
                    <button type="button" className="button-danger button-small" disabled={busyId === event.id} onClick={() => setRejectingId(event.id)}>
                      Reject
                    </button>
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
