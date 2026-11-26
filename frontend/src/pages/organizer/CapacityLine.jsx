import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';

export default function CapacityLine({ eventId }) {
  const [text, setText] = useState('');

  useEffect(function () {
    async function loadCapacity() {
      try {
        const result = await apiRequest('/events/' + eventId + '/capacity');
        if (result.capacity === null) {
          setText(result.adviceText);
          return;
        }
        setText(result.registeredCount + ' of ' + result.capacity + ' places taken. ' + result.adviceText);
      } catch (error) {
        setText('Could not load registrations: ' + error.message);
      }
    }
    loadCapacity();
  }, [eventId]);

  if (text === '') {
    return null;
  }
  return <p className="event-where">{text}</p>;
}
