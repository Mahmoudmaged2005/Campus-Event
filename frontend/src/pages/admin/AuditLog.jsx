import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import { showCairoDateTime } from '../../utils/cairoDates.js';

const ACTIONS = [
  { value: 'event.approved', label: 'Event approved' },
  { value: 'event.rejected', label: 'Event rejected' },
  { value: 'events.completed', label: 'Past events completed' },
  { value: 'flag.created', label: 'Event reported' },
  { value: 'flag.resolved', label: 'Report resolved' },
  { value: 'flag.dismissed', label: 'Report dismissed' },
  { value: 'category.created', label: 'Category added' },
  { value: 'category.updated', label: 'Category changed' },
  { value: 'registration.created', label: 'Student registered' },
  { value: 'registration.cancelled', label: 'Registration cancelled' },
  { value: 'students.notified', label: 'Students notified' },
  { value: 'organizer.notified', label: 'Organizer notified' },
];

function actionLabel(action) {
  for (const choice of ACTIONS) {
    if (choice.value === action) {
      return choice.label;
    }
  }
  return action;
}

function whoDidIt(entry) {
  if (entry.actor === null) {
    return 'System';
  }
  return entry.actor.name + ' (' + entry.actor.role.toLowerCase() + ')';
}

function detailsText(details) {
  if (!details) {
    return '';
  }
  const parts = [];
  for (const key of Object.keys(details)) {
    parts.push(key + ': ' + JSON.stringify(details[key]));
  }
  return parts.join(' · ');
}

function auditPath(action, beforeId) {
  const query = new URLSearchParams();
  if (action !== '') {
    query.set('action', action);
  }
  if (beforeId) {
    query.set('beforeId', beforeId);
  }
  return '/admin/audit-log?' + query.toString();
}

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [entries, setEntries] = useState([]);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(function () {
    async function loadFirstPage() {
      setLoading(true);
      try {
        const data = await apiRequest(auditPath(action, null));
        setEntries(data.entries);
        setNextBeforeId(data.nextBeforeId);
      } catch (error) {
        setErrorText(error.message);
      }
      setLoading(false);
    }
    loadFirstPage();
  }, [action]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const data = await apiRequest(auditPath(action, nextBeforeId));
      setEntries(function (current) {
        return [...current, ...data.entries];
      });
      setNextBeforeId(data.nextBeforeId);
    } catch (error) {
      setErrorText(error.message);
    }
    setLoadingMore(false);
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Audit log</h1>
          <p className="page-intro">Every important action in the app, newest first. Times are Cairo time.</p>
        </div>
        <label className="row">
          Show
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.map(function (choice) {
              return <option key={choice.value} value={choice.value}>{choice.label}</option>;
            })}
          </select>
        </label>
      </div>
      <Message type="error" text={errorText} />
      {loading ? <p className="muted">Loading...</p> : null}
      {!loading && entries.length === 0 ? <p className="empty">Nothing recorded for this action yet.</p> : null}
      {!loading && entries.length > 0 ? (
        <div className="table-box">
          <table className="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What happened</th>
                <th>On</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(function (entry) {
                return (
                  <tr key={entry.id}>
                    <td className="nowrap">{showCairoDateTime(entry.createdAt)}</td>
                    <td>{whoDidIt(entry)}</td>
                    <td><span className="badge badge-info">{actionLabel(entry.action)}</span></td>
                    <td className="nowrap">{entry.entityType}{entry.entityId ? ' #' + entry.entityId : ''}</td>
                    <td className="audit-details">{detailsText(entry.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {nextBeforeId && !loading ? (
        <div className="load-more">
          <button type="button" className="button-secondary" disabled={loadingMore} onClick={handleLoadMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
