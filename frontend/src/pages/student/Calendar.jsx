import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import listPlugin from '@fullcalendar/react/list';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import StudentNav from './StudentNav.jsx';
import EventDetails from './EventDetails.jsx';

function eventColor(event) {
  if (event.status === 'CANCELLED') {
    return '#9ca3af';
  }
  if (event.isRegistered) {
    return '#15803d';
  }
  if (event.isSaved) {
    return '#2563eb';
  }
  return '#7c3aed';
}

function toCalendarEvents(events) {
  const calendarEvents = [];
  for (const event of events) {
    let title = event.title;
    if (event.status === 'CANCELLED') {
      title = 'Cancelled: ' + event.title;
    }
    calendarEvents.push({
      id: String(event.id),
      title: title,
      start: event.startsAt,
      end: event.endsAt,
      color: eventColor(event),
    });
  }
  return calendarEvents;
}

function findEventById(events, eventId) {
  for (const event of events) {
    if (event.id === eventId) {
      return event;
    }
  }
  return null;
}

function CategoryFilter({ categories, categoryId, onChange }) {
  return (
    <label className="calendar-filter">
      Category
      <select value={categoryId} onChange={(changeEvent) => onChange(changeEvent.target.value)}>
        <option value="">All categories</option>
        {categories.map(function (category) {
          return <option key={category.id} value={category.id}>{category.name}</option>;
        })}
      </select>
    </label>
  );
}

export default function Calendar() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  async function loadCategories() {
    try {
      const data = await apiRequest('/student/categories');
      setCategories(data.categories);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  async function loadEvents() {
    const query = new URLSearchParams({ from: fromText, to: toText });
    if (categoryId !== '') {
      query.set('categoryId', categoryId);
    }
    try {
      const data = await apiRequest('/student/events?' + query.toString());
      setEvents(data.events);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  useEffect(function () {
    loadCategories();
  }, []);

  useEffect(function () {
    if (fromText !== '') {
      loadEvents();
    }
  }, [fromText, toText, categoryId]);

  function handleDatesSet(info) {
    setFromText(info.start.toISOString());
    setToText(info.end.toISOString());
  }

  async function runAction(action, successText) {
    setMessage({ type: 'info', text: 'Working...' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await loadEvents();
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    }
  }

  function showError(text) {
    setMessage({ type: 'error', text: text });
  }

  const selectedEvent = findEventById(events, selectedId);

  return (
    <section>
      <StudentNav />
      <div className="page-title-row">
        <h1>Events calendar</h1>
        <CategoryFilter categories={categories} categoryId={categoryId} onChange={setCategoryId} />
      </div>
      <p className="calendar-legend">
        <span className="legend-registered">Registered</span>
        <span className="legend-saved">Saved</span>
        <span className="legend-other">Other events</span>
        <span className="legend-cancelled">Cancelled</span>
        All times are Cairo time. Click an event to see it.
      </p>
      <Message type={message.type} text={message.text} />
      <div className="calendar-box">
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin, classicThemePlugin]}
          initialView="dayGridMonth"
          timeZone="Africa/Cairo"
          headerToolbar={{ start: 'prev,next today', center: 'title', end: 'dayGridMonth,listMonth' }}
          events={toCalendarEvents(events)}
          datesSet={handleDatesSet}
          eventClick={(info) => setSelectedId(Number(info.event.id))}
        />
      </div>
      {selectedEvent ? <EventDetails event={selectedEvent} runAction={runAction} onError={showError} /> : null}
    </section>
  );
}
