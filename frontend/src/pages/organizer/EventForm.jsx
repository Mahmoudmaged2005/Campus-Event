import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Alternatives from './Alternatives.jsx';
import SeriesOptions from './SeriesOptions.jsx';
import { inputToIso, isoToInput, showCairoDateTime } from '../../utils/cairoDates.js';

const EMPTY_FORM = { title: '', description: '', location: '', startsAt: '', endsAt: '', capacity: '', categoryId: '' };
const DEFAULT_REPEAT = { enabled: false, frequency: 'WEEKLY', interval: '1', count: '4', onClash: 'reject' };

function eventToForm(event) {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: isoToInput(event.startsAt),
    endsAt: isoToInput(event.endsAt),
    capacity: event.capacity ? String(event.capacity) : '',
    categoryId: String(event.categoryId),
  };
}

function formToBody(form) {
  return {
    title: form.title,
    description: form.description,
    location: form.location,
    startsAt: inputToIso(form.startsAt),
    endsAt: inputToIso(form.endsAt),
    categoryId: Number(form.categoryId),
    capacity: form.capacity === '' ? null : Number(form.capacity),
  };
}

function placeAndTime(form) {
  return { location: form.location, startsAt: inputToIso(form.startsAt), endsAt: inputToIso(form.endsAt) };
}

function repeatToBody(repeat) {
  return { frequency: repeat.frequency, interval: Number(repeat.interval), count: Number(repeat.count) };
}

export default function EventForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [repeat, setRepeat] = useState(DEFAULT_REPEAT);
  const [clash, setClash] = useState(null);
  const [seriesDates, setSeriesDates] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(function () {
    async function loadPage() {
      try {
        const categoryData = await apiRequest('/events/categories');
        setCategories(categoryData.categories);
        if (editing) {
          const eventData = await apiRequest('/events/' + id);
          setForm(eventToForm(eventData.event));
          setStatus(eventData.event.status);
          if (eventData.event.status !== 'PENDING' && eventData.event.status !== 'REJECTED') {
            setLocked(true);
            setMessage({ type: 'info', text: 'This event is ' + eventData.event.status.toLowerCase() + ' and cannot be edited.' });
          }
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    }
    loadPage();
  }, [editing, id]);

  function updateField(name, value) {
    setForm({ ...form, [name]: value });
    setClash(null);
    setSeriesDates(null);
  }

  function showError(error) {
    if (error.data && error.data.clashes) {
      setClash({ clashes: error.data.clashes, alternatives: error.data.alternatives });
    }
    if (error.data && error.data.clashingDates) {
      setSeriesDates(error.data.clashingDates);
    }
    setMessage({ type: 'error', text: error.message });
  }

  async function handleCheck() {
    setClash(null);
    try {
      const body = placeAndTime(form);
      if (editing) {
        body.ignoreEventId = Number(id);
      }
      const result = await apiRequest('/events/check', { method: 'POST', body: body });
      if (result.free) {
        setMessage({ type: 'success', text: form.location + ' is free at that time.' });
        return;
      }
      setClash({ clashes: result.clashes, alternatives: result.alternatives });
      setMessage({ type: 'error', text: 'This place is already booked at that time.' });
    } catch (error) {
      showError(error);
    }
  }

  async function handleSeriesPreview() {
    try {
      const body = { ...placeAndTime(form), ...repeatToBody(repeat) };
      const result = await apiRequest('/events/series/preview', { method: 'POST', body: body });
      setSeriesDates(result.dates);
      setMessage({ type: 'info', text: result.freeCount + ' dates are free, ' + result.clashCount + ' are booked.' });
    } catch (error) {
      showError(error);
    }
  }

  async function saveChanges() {
    const data = await apiRequest('/events/' + id, { method: 'PATCH', body: formToBody(form) });
    setForm(eventToForm(data.event));
    setStatus(data.event.status);
    setMessage({ type: 'success', text: 'Changes saved. The event is waiting for approval.' });
  }

  async function createNewEvent() {
    const body = formToBody(form);
    if (repeat.enabled) {
      const seriesBody = { ...body, ...repeatToBody(repeat), onClash: repeat.onClash };
      const result = await apiRequest('/events/series', { method: 'POST', body: seriesBody });
      return result.created.length + ' events created, ' + result.skipped.length + ' dates skipped.';
    }
    await apiRequest('/events', { method: 'POST', body: body });
    return 'Event created. It is waiting for approval.';
  }

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    setSaving(true);
    setClash(null);
    try {
      if (editing) {
        await saveChanges();
      } else {
        const successText = await createNewEvent();
        navigate('/organizer', { state: { message: successText } });
      }
    } catch (error) {
      showError(error);
    }
    setSaving(false);
  }

  function pickSlot(slot) {
    setForm({ ...form, startsAt: isoToInput(slot.startsAt), endsAt: isoToInput(slot.endsAt) });
    setClash(null);
    setMessage({ type: 'info', text: 'Time changed to ' + showCairoDateTime(slot.startsAt) + '. You can save now.' });
  }

  function handleRepeatChange(newRepeat) {
    setRepeat(newRepeat);
    setSeriesDates(null);
  }

  function submitLabel() {
    if (saving) {
      return 'Saving...';
    }
    if (editing) {
      return 'Save changes';
    }
    if (repeat.enabled) {
      return 'Create series';
    }
    return 'Create event';
  }

  function pickPlace(place) {
    setForm({ ...form, location: place });
    setClash(null);
    setMessage({ type: 'info', text: 'Place changed to ' + place + '. You can save now.' });
  }

  return (
    <section className="card form-page">
      <div className="page-title-row">
        <div className="event-title-row">
          <h1>{editing ? 'Edit event' : 'New event'}</h1>
          {status ? <StatusBadge status={status} /> : null}
        </div>
        <Link to="/organizer">Back to my events</Link>
      </div>
      <Message type={message.type} text={message.text} />

      <form className="form" onSubmit={handleSubmit}>
        <fieldset disabled={locked}>
          <label>
            Title
            <input value={form.title} onChange={(e) => updateField('title', e.target.value)} required minLength={3} maxLength={120} />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} required maxLength={2000} rows={4} />
          </label>
          <label>
            Place
            <input value={form.location} onChange={(e) => updateField('location', e.target.value)} required minLength={2} maxLength={120} />
          </label>
          <div className="form-row">
            <label>
              Starts (Cairo time)
              <input type="datetime-local" value={form.startsAt} onChange={(e) => updateField('startsAt', e.target.value)} required />
            </label>
            <label>
              Ends (Cairo time)
              <input type="datetime-local" value={form.endsAt} onChange={(e) => updateField('endsAt', e.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Category
              <select value={form.categoryId} onChange={(e) => updateField('categoryId', e.target.value)} required>
                <option value="">Choose a category</option>
                {categories.map(function (category) {
                  return <option key={category.id} value={category.id}>{category.name}</option>;
                })}
              </select>
            </label>
            <label>
              Capacity (optional)
              <input type="number" min="1" max="5000" value={form.capacity} onChange={(e) => updateField('capacity', e.target.value)} />
            </label>
          </div>

          <button type="button" className="button-secondary" onClick={handleCheck}>Check place and time</button>

          {clash ? (
            <Alternatives
              clashes={clash.clashes}
              alternatives={clash.alternatives}
              onPickSlot={pickSlot}
              onPickPlace={pickPlace}
            />
          ) : null}

          {!editing ? (
            <SeriesOptions
              repeat={repeat}
              onChange={handleRepeatChange}
              onPreview={handleSeriesPreview}
              dates={seriesDates}
            />
          ) : null}

          <button type="submit" disabled={saving}>{submitLabel()}</button>
        </fieldset>
      </form>
    </section>
  );
}
