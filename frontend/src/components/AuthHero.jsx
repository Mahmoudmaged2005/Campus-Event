import Logo from './Logo.jsx';

export default function AuthHero() {
  return (
    <div className="auth-hero">
      <span className="auth-logo">
        <Logo />
      </span>
      <h2>Campus Events</h2>
      <p>Every event on campus, in one calendar.</p>
    </div>
  );
}
