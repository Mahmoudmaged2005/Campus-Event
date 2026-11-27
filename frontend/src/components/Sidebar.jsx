import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Logo from './Logo.jsx';
import { initialsOf } from '../utils/initials.js';

const LINKS_BY_ROLE = {
  STUDENT: [
    { to: '/student', label: 'Calendar' },
    { to: '/student/saved', label: 'My events' },
    { to: '/student/notifications', label: 'Notifications' },
  ],
  ORGANIZER: [
    { to: '/organizer', label: 'My events' },
    { to: '/organizer/events/new', label: 'New event' },
    { to: '/organizer/notifications', label: 'Notifications' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Review queue' },
    { to: '/admin/flags', label: 'Flags' },
    { to: '/admin/categories', label: 'Categories' },
    { to: '/admin/audit', label: 'Audit log' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const links = LINKS_BY_ROLE[user.role] || [];

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-brand">
        <Logo />
        <span>Campus Events</span>
      </Link>
      <nav className="sidebar-nav">
        {links.map(function (link) {
          return <NavLink key={link.to} to={link.to} end>{link.label}</NavLink>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <NavLink to="/profile" className="sidebar-profile">
          <span className="avatar">{initialsOf(user.name)}</span>
          <span className="sidebar-person">
            <strong>{user.name}</strong>
            <span>{user.role.toLowerCase()} · profile</span>
          </span>
        </NavLink>
        <button type="button" className="sidebar-logout" onClick={handleLogout}>Log out</button>
      </div>
    </aside>
  );
}
