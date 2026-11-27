import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { removeById } from '../../utils/lists.js';
import { showCairoDateTime } from '../../utils/cairoDates.js';

function withoutEvent(flags, eventId) {
  const result = [];
  for (const flag of flags) {
    if (flag.event.id !== eventId) {
      result.push(flag);
    }
  }
  return result;
}

export default function Flags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  useEffect(function () {
    async function loadFlags() {
      try {
        const data = await apiRequest('/admin/flags');
        setFlags(data.flags);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
      setLoading(false);
    }
    loadFlags();
  }, []);

  async function runAction(flag, action, successText) {
    setBusyId(flag.id);
    setMessage({ type: 'info', text: '' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setBusyId(null);
  }

  function handleResolve(flag) {
    let question = 'Resolve this flag on "' + flag.event.title + '"?';
    if (flag.event.status === 'APPROVED') {
      question = 'Resolve this flag? "' + flag.event.title + '" will be CANCELLED.';
    }
    if (!window.confirm(question)) {
      return;
    }
    runAction(flag, async function () {
      await apiRequest('/admin/flags/' + flag.id + '/resolve', { method: 'POST' });
      setFlags(function (current) {
        return withoutEvent(current, flag.event.id);
      });
    }, 'Resolved the flags on "' + flag.event.title + '"');
  }

  function handleDismiss(flag) {
    runAction(flag, async function () {
      await apiRequest('/admin/flags/' + flag.id + '/dismiss', { method: 'POST' });
      setFlags(function (current) {
        return removeById(current, flag.id);
      });
    }, 'Dismissed the flag on "' + flag.event.title + '"');
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Open flags</h1>
          <p className="page-intro">Events that students reported. Resolving cancels an approved event.</p>
        </div>
        {!loading ? <span className="badge badge-info">{flags.length} open</span> : null}
      </div>
      <Message type={message.type} text={message.text} />
      {loading ? <p className="muted">Loading...</p> : null}
      {!loading && flags.length === 0 ? <p className="empty">There are no open flags.</p> : null}
      <div className="event-list">
        {flags.map(function (flag) {
          return (
            <article key={flag.id} className="card stack-tight">
              <div className="event-title-row">
                <h3>{flag.event.title}</h3>
                <StatusBadge status={flag.event.status} />
              </div>
              <p><strong>Reason:</strong> {flag.reason}</p>
              <p className="muted small">
                Reported by {flag.reporter.name} on {showCairoDateTime(flag.createdAt)}
              </p>
              <div className="event-actions">
                <button type="button" className="button-danger button-small" disabled={busyId === flag.id} onClick={() => handleResolve(flag)}>
                  Resolve
                </button>
                <button type="button" className="button-secondary button-small" disabled={busyId === flag.id} onClick={() => handleDismiss(flag)}>
                  Dismiss
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
