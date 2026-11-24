import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { showCairoDateTime } from '../../utils/cairoDates.js';
import AdminNav from './AdminNav.jsx';

export default function Flags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  async function loadFlags() {
    try {
      const data = await apiRequest('/admin/flags');
      setFlags(data.flags);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  }

  useEffect(function () {
    loadFlags();
  }, []);

  async function runAction(action, successText) {
    setMessage({ type: 'info', text: 'Working...' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await loadFlags();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  function handleResolve(flag) {
    let question = 'Resolve this flag on "' + flag.event.title + '"?';
    if (flag.event.status === 'APPROVED') {
      question = 'Resolve this flag? "' + flag.event.title + '" will be CANCELLED.';
    }
    if (!window.confirm(question)) {
      return;
    }
    runAction(function () {
      return apiRequest('/admin/flags/' + flag.id + '/resolve', { method: 'POST' });
    }, 'Flag resolved for "' + flag.event.title + '"');
  }

  function handleDismiss(flag) {
    runAction(function () {
      return apiRequest('/admin/flags/' + flag.id + '/dismiss', { method: 'POST' });
    }, 'Flag dismissed for "' + flag.event.title + '"');
  }

  return (
    <section>
      <AdminNav />
      <h1>Open flags</h1>
      <Message type={message.type} text={message.text} />
      {loading ? <p>Loading...</p> : null}
      {!loading && flags.length === 0 ? <p>There are no open flags.</p> : null}
      <div className="event-list">
        {flags.map(function (flag) {
          return (
            <article key={flag.id} className="card">
              <div className="event-title-row">
                <h3>{flag.event.title}</h3>
                <StatusBadge status={flag.event.status} />
              </div>
              <p>Reason: {flag.reason}</p>
              <p className="event-where">
                Reported by {flag.reporter.name} on {showCairoDateTime(flag.createdAt)} (Cairo time)
              </p>
              <div className="event-actions">
                <button type="button" className="button-danger" onClick={() => handleResolve(flag)}>Resolve</button>
                <button type="button" className="button-secondary" onClick={() => handleDismiss(flag)}>Dismiss</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
