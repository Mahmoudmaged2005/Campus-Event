import { NavLink } from 'react-router-dom';

export default function StudentNav() {
  return (
    <nav className="header-links admin-nav">
      <NavLink to="/student" end>Calendar</NavLink>
      <NavLink to="/student/saved">My events</NavLink>
      <NavLink to="/student/notifications">Notifications</NavLink>
    </nav>
  );
}
