import { showCairoDateTime, showCairoClock } from '../../utils/cairoDates.js';

export default function Alternatives({ clashes, alternatives, onPickSlot, onPickPlace }) {
  return (
    <div className="alternatives">
      <h3>This place is already booked</h3>
      <ul>
        {clashes.map(function (clash) {
          return (
            <li key={clash.id}>
              {clash.title}: {showCairoDateTime(clash.startsAt)} to {showCairoClock(clash.endsAt)} ({clash.status.toLowerCase()})
            </li>
          );
        })}
      </ul>

      <h4>Free times at the same place</h4>
      {alternatives.slots.length === 0 ? <p>No free time found in the next days.</p> : null}
      <div className="choice-list">
        {alternatives.slots.map(function (slot) {
          return (
            <button type="button" className="button-secondary" key={slot.startsAt} onClick={() => onPickSlot(slot)}>
              {showCairoDateTime(slot.startsAt)} to {showCairoClock(slot.endsAt)}
            </button>
          );
        })}
      </div>

      <h4>Free places at the same time</h4>
      {alternatives.places.length === 0 ? <p>No other known place is free at that time.</p> : null}
      <div className="choice-list">
        {alternatives.places.map(function (place) {
          return (
            <button type="button" className="button-secondary" key={place} onClick={() => onPickPlace(place)}>
              {place}
            </button>
          );
        })}
      </div>
    </div>
  );
}
