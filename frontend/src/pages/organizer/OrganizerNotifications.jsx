import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import { showCairoDateTime } from '../../utils/cairoDates.js';

export default function OrganizerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  async function loadNotifications() {
    try {
      const data = await apiRequest('/notifications');
      setNotifications(data.notifications);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  }

  useEffect(function () {
    loadNotifications();
  }, []);

  async function handleMarkRead(notification) {
    try {
      await apiRequest('/notifications/' + notification.id + '/read', { method: 'PATCH' });
      await loadNotifications();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  return (
    <section>
      <h1>Notifications</h1>
      <Message type={message.type} text={message.text} />
      {loading ? <p>Loading...</p> : null}
      {!loading && notifications.length === 0 ? <p>You have no notifications yet.</p> : null}
      <ul className="notification-list">
        {notifications.map(function (notification) {
          let className = 'notification';
          if (!notification.isRead) {
            className = 'notification notification-unread';
          }
          return (
            <li key={notification.id} className={className}>
              <p>{notification.message}</p>
              <p className="event-when">{showCairoDateTime(notification.createdAt)}</p>
              {notification.isRead ? null : (
                <button type="button" className="button-secondary" onClick={() => handleMarkRead(notification)}>
                  Mark as read
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
