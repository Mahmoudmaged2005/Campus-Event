import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import Alternatives from './Alternatives.jsx';
import { inputToIso, isoToInput, showCairoDateTime, showCairoClock } from '../../utils/cairoDates.js';

function studentsText(count) {
  if (count === 1) {
    return '1 registered student';
  }
  return count + ' registered students';
}

export default function RescheduleEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [times, setTimes] = useState({ startsAt: '', endsAt: '' });
  const [clash, setClash] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(function () {
    async function loadEvent() {
      try {
        const data = await apiRequest('/events/' + id);
        setEvent(data.event);
        setTimes({ startsAt: isoToInput(data.event.startsAt), endsAt: isoToInput(data.event.endsAt) });
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    }
    loadEvent();
  }, [id]);

  function updateTime(name, value) {
    setTimes({ ...times, [name]: value });
    setClash(null);
  }

  function newTimesBody() {
    return { startsAt: inputToIso(times.startsAt), endsAt: inputToIso(times.endsAt) };
  }

  function showError(error) {
    if (error.data && error.data.clashes) {
      setClash({ clashes: error.data.clashes, alternatives: error.data.alternatives });
    }
    setMessage({ type: 'error', text: error.message });
  }

  async function handlePreview() {
    setClash(null);
    try {
      const result = await apiRequest('/events/' + id + '/reschedule/preview', { method: 'POST', body: newTimesBody() });
      if (!result.free) {
        setClash({ clashes: result.clashes, alternatives: result.alternatives });
        setMessage({ type: 'error', text: 'This place is already booked at the new time.' });
        return;
      }
      setMessage({ type: 'info', text: 'The place is free. ' + studentsText(result.affectedStudents) + ' will be told about the new time.' });
    } catch (error) {
      showError(error);
    }
  }

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    if (!window.confirm('Move "' + event.title + '" to the new time? Registered students will be told.')) {
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest('/events/' + id + '/reschedule', { method: 'POST', body: newTimesBody() });
      navigate('/organizer', { state: { message: 'Event moved. ' + studentsText(result.affectedStudents) + ' will be told.' } });
    } catch (error) {
      showError(error);
    }
    setSaving(false);
  }

  function pickSlot(slot) {
    setTimes({ startsAt: isoToInput(slot.startsAt), endsAt: isoToInput(slot.endsAt) });
    setClash(null);
    setMessage({ type: 'info', text: 'Time changed to ' + showCairoDateTime(slot.startsAt) + '. You can reschedule now.' });
  }

  return (
    <section className="card">
      <div className="page-title-row">
        <h1>Reschedule event</h1>
        <Link to="/organizer">Back to my events</Link>
      </div>
      <Message type={message.type} text={message.text} />
      {event ? (
        <p>
          {event.title} at {event.location}, now {showCairoDateTime(event.startsAt)} to {showCairoClock(event.endsAt)}
        </p>
      ) : null}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            New start (Cairo time)
            <input type="datetime-local" value={times.startsAt} onChange={(e) => updateTime('startsAt', e.target.value)} required />
          </label>
          <label>
            New end (Cairo time)
            <input type="datetime-local" value={times.endsAt} onChange={(e) => updateTime('endsAt', e.target.value)} required />
          </label>
        </div>

        <button type="button" className="button-secondary" onClick={handlePreview}>Check impact</button>

        {clash ? <Alternatives clashes={clash.clashes} alternatives={clash.alternatives} onPickSlot={pickSlot} /> : null}

        <button type="submit" disabled={saving || event === null}>{saving ? 'Saving...' : 'Reschedule'}</button>
      </form>
    </section>
  );
}
