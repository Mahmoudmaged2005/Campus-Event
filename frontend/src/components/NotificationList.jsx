import { useEffect, useState } from 'react';
import { apiRequest } from '../api/api.js';
import Message from './Message.jsx';
import { replaceById } from '../utils/lists.js';
import { showCairoDateTime } from '../utils/cairoDates.js';

function countUnread(notifications) {
  let unread = 0;
  for (const notification of notifications) {
    if (!notification.isRead) {
      unread = unread + 1;
    }
  }
  return unread;
}

export default function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [errorText, setErrorText] = useState('');

  useEffect(function () {
    async function loadNotifications() {
      try {
        const data = await apiRequest('/notifications');
        setNotifications(data.notifications);
      } catch (error) {
        setErrorText(error.message);
      }
      setLoading(false);
    }
    loadNotifications();
  }, []);

  async function handleMarkRead(notification) {
    setBusyId(notification.id);
    setErrorText('');
    try {
      const data = await apiRequest('/notifications/' + notification.id + '/read', { method: 'PATCH' });
      setNotifications(function (current) {
        return replaceById(current, data.notification);
      });
    } catch (error) {
      setErrorText(error.message);
    }
    setBusyId(null);
  }

  const unread = countUnread(notifications);

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Notifications</h1>
          <p className="page-intro">
            {unread === 0 ? 'You are all caught up.' : 'You have ' + unread + ' unread.'} Every notification is also sent to your email.
          </p>
        </div>
      </div>
      <Message type="error" text={errorText} />
      {loading ? <p className="muted">Loading...</p> : null}
      {!loading && notifications.length === 0 ? <p className="empty">You have no notifications yet.</p> : null}
      {notifications.length > 0 ? (
        <ul className="notification-list">
          {notifications.map(function (notification) {
            return (
              <li key={notification.id} className={notification.isRead ? 'notification' : 'notification notification-unread'}>
                <span className="notification-dot" />
                <div className="notification-body">
                  <p className="notification-text">{notification.message}</p>
                  <p className="muted small">{showCairoDateTime(notification.createdAt)}</p>
                </div>
                {notification.isRead ? null : (
                  <button
                    type="button"
                    className="button-secondary button-small"
                    disabled={busyId === notification.id}
                    onClick={() => handleMarkRead(notification)}
                  >
                    Mark as read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
