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
import { replaceById } from '../../utils/lists.js';
import EventDetails from './EventDetails.jsx';
import FollowCategories from './FollowCategories.jsx';

const PLUGINS = [dayGridPlugin, listPlugin, classicThemePlugin];
const TOOLBAR = { start: 'prev,next today', center: 'title', end: 'dayGridMonth,listMonth' };
const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false };

const COLORS = {
  registered: '#18794e',
  saved: '#1f5fae',
  other: '#6d4cc2',
  cancelled: '#9aa3ae',
};

const LEGEND = [
  { label: 'Registered', color: COLORS.registered },
  { label: 'Saved', color: COLORS.saved },
  { label: 'Other events', color: COLORS.other },
  { label: 'Cancelled', color: COLORS.cancelled },
];

function eventColor(event) {
  if (event.status === 'CANCELLED') {
    return COLORS.cancelled;
  }
  if (event.isRegistered) {
    return COLORS.registered;
  }
  if (event.isSaved) {
    return COLORS.saved;
  }
  return COLORS.other;
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

function Legend() {
  return (
    <div className="calendar-legend">
      {LEGEND.map(function (item) {
        return (
          <span key={item.label} className="legend-item">
            <span className="legend-dot" style={{ background: item.color }} />
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

const VIEWS = [
  { value: 'all', label: 'All events' },
  { value: 'recommended', label: 'Recommended for you' },
];

function ViewSwitch({ view, onChange }) {
  return (
    <div className="view-switch">
      {VIEWS.map(function (choice) {
        return (
          <button
            key={choice.value}
            type="button"
            className={view === choice.value ? 'view-option view-option-on' : 'view-option'}
            onClick={() => onChange(choice.value)}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function Interests({ onChanged, onError }) {
  return (
    <div className="interests card">
      <div>
        <h3>Your interests</h3>
        <p className="muted small">
          Choose the categories you like and you see only their events.
          With no category chosen, you see only the events you saved or registered for.
        </p>
      </div>
      <FollowCategories onChanged={onChanged} onError={onError} />
    </div>
  );
}

export default function Calendar() {
  const [view, setView] = useState('all');
  const [reloadCount, setReloadCount] = useState(0);
  const [range, setRange] = useState(null);
  const [events, setEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [errorText, setErrorText] = useState('');

  function showEvents(newEvents) {
    setEvents(newEvents);
    setCalendarEvents(toCalendarEvents(newEvents));
  }

  useEffect(function () {
    if (range === null) {
      return;
    }
    async function loadEvents() {
      const query = new URLSearchParams({ from: range.from, to: range.to });
      if (view === 'recommended') {
        query.set('recommended', 'true');
      }
      try {
        const data = await apiRequest('/student/events?' + query.toString());
        showEvents(data.events);
      } catch (error) {
        setErrorText(error.message);
      }
    }
    loadEvents();
  }, [range, view, reloadCount]);

  function handleDatesSet(info) {
    setRange({ from: info.start.toISOString(), to: info.end.toISOString() });
  }

  function changeEvent(eventId, changes) {
    showEvents(replaceById(events, { id: eventId, ...changes }));
  }

  function reloadEvents() {
    setReloadCount(reloadCount + 1);
  }

  const selectedEvent = findEventById(events, selectedId);

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Events calendar</h1>
          <p className="page-intro">All times are Cairo time. Click an event to see its details.</p>
        </div>
        <ViewSwitch view={view} onChange={setView} />
      </div>
      {view === 'recommended' ? <Interests onChanged={reloadEvents} onError={setErrorText} /> : null}
      <Legend />
      <Message type="error" text={errorText} />
      <div className="calendar-layout">
        <div className="calendar-box">
          <FullCalendar
            plugins={PLUGINS}
            initialView="dayGridMonth"
            timeZone="Africa/Cairo"
            headerToolbar={TOOLBAR}
            eventTimeFormat={TIME_FORMAT}
            eventDisplay="block"
            dayMaxEvents={3}
            events={calendarEvents}
            datesSet={handleDatesSet}
            eventClick={(info) => setSelectedId(Number(info.event.id))}
          />
        </div>
        {selectedEvent ? (
          <EventDetails key={selectedEvent.id} event={selectedEvent} onEventChanged={changeEvent} />
        ) : (
          <aside className="details-panel">
            <h3>No event selected</h3>
            <p className="muted">Click an event in the calendar to see its details, save it or register.</p>
          </aside>
        )}
      </div>
    </section>
  );
}
