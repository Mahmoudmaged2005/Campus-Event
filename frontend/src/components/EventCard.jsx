import StatusBadge from './StatusBadge.jsx';
import { showCairoDateTime, showCairoClock } from '../utils/cairoDates.js';

export default function EventCard({ event, children }) {
  return (
    <article className="event-card">
      {event.imageUrl ? (
        <img className="event-poster" src={event.imageUrl} alt={'Poster for ' + event.title} />
      ) : (
        <div className="event-poster event-poster-empty">No poster</div>
      )}
      <div className="event-body">
        <div className="event-title-row">
          <h3>{event.title}</h3>
          <StatusBadge status={event.status} />
        </div>
        <p className="event-when">
          {showCairoDateTime(event.startsAt)} to {showCairoClock(event.endsAt)} (Cairo time)
        </p>
        <p className="event-where">
          {event.location}
          {event.category ? ' · ' + event.category.name : ''}
          {event.capacity ? ' · ' + event.capacity + ' places' : ''}
          {event.seriesId ? ' · part of a series' : ''}
        </p>
        <p>{event.description}</p>
        {event.status === 'REJECTED' && event.rejectionReason ? (
          <p className="event-rejection">Rejected because: {event.rejectionReason}</p>
        ) : null}
        <div className="event-actions">{children}</div>
      </div>
    </article>
  );
}
