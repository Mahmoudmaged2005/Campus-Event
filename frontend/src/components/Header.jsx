import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="header">
      <Link to="/" className="header-title">Campus Events</Link>
      {user && user.role === 'ORGANIZER' ? (
        <nav className="header-links">
          <Link to="/organizer">My events</Link>
          <Link to="/organizer/events/new">New event</Link>
        </nav>
      ) : null}
      {user ? (
        <div className="header-user">
          <span>{user.name} ({user.role.toLowerCase()})</span>
          <button type="button" className="button-secondary" onClick={handleLogout}>Log out</button>
        </div>
      ) : null}
    </header>
  );
}
