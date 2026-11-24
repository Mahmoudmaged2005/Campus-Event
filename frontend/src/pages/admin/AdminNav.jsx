import { NavLink } from 'react-router-dom';

export default function AdminNav() {
  return (
    <nav className="header-links admin-nav">
      <NavLink to="/admin" end>Review queue</NavLink>
      <NavLink to="/admin/flags">Flags</NavLink>
      <NavLink to="/admin/categories">Categories</NavLink>
    </nav>
  );
}
