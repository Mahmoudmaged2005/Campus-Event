import StatusBadge from './StatusBadge.jsx';
import { showCairoRange } from '../utils/cairoDates.js';

function hideBrokenPoster(errorEvent) {
  errorEvent.target.style.display = 'none';
}

export default function EventCard({ event, children }) {
  return (
    <article className="event-card">
      {event.imageUrl ? (
        <img className="event-poster" src={event.imageUrl} alt={'Poster for ' + event.title} onError={hideBrokenPoster} />
      ) : null}
      <div className="event-body">
        <div className="event-title-row">
          <h3>{event.title}</h3>
          <StatusBadge status={event.status} />
        </div>
        <p className="event-when">
          {showCairoRange(event.startsAt, event.endsAt)}
        </p>
        <p className="event-where">
          {event.location}
          {event.category ? ' · ' + event.category.name : ''}
          {event.capacity ? ' · ' + event.capacity + ' places' : ''}
          {event.seriesId ? ' · repeating event' : ''}
        </p>
        <p className="event-description">{event.description}</p>
        {event.status === 'REJECTED' && event.rejectionReason ? (
          <p className="event-rejection">Rejected because: {event.rejectionReason}</p>
        ) : null}
        {children ? <div className="event-actions">{children}</div> : null}
      </div>
    </article>
  );
}
