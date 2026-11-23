import { showCairoDateTime, showCairoClock } from '../../utils/cairoDates.js';

export default function SeriesOptions({ repeat, onChange, onPreview, dates }) {
  function updateRepeat(name, value) {
    onChange({ ...repeat, [name]: value });
  }

  return (
    <fieldset className="series">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={repeat.enabled}
          onChange={(e) => updateRepeat('enabled', e.target.checked)}
        />
        Repeat this event
      </label>

      {repeat.enabled ? (
        <>
          <div className="form-row">
            <label>
              Repeats
              <select value={repeat.frequency} onChange={(e) => updateRepeat('frequency', e.target.value)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>
            <label>
              Every
              <input type="number" min="1" max="12" value={repeat.interval} onChange={(e) => updateRepeat('interval', e.target.value)} />
            </label>
            <label>
              Number of events
              <input type="number" min="2" max="20" value={repeat.count} onChange={(e) => updateRepeat('count', e.target.value)} />
            </label>
            <label>
              If a date is booked
              <select value={repeat.onClash} onChange={(e) => updateRepeat('onClash', e.target.value)}>
                <option value="reject">Create nothing</option>
                <option value="skip">Skip that date</option>
              </select>
            </label>
          </div>
          <button type="button" className="button-secondary" onClick={onPreview}>Preview dates</button>
        </>
      ) : null}

      {repeat.enabled && dates ? (
        <ul className="series-dates">
          {dates.map(function (date) {
            return (
              <li key={date.startsAt} className={date.free ? 'date-free' : 'date-busy'}>
                {showCairoDateTime(date.startsAt)} to {showCairoClock(date.endsAt)}
                {date.free ? ' · free' : ' · booked by ' + date.clashes.map((clash) => clash.title).join(', ')}
              </li>
            );
          })}
        </ul>
      ) : null}
    </fieldset>
  );
}
