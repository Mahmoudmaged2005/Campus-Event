import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthHero from '../components/AuthHero.jsx';
import Message from '../components/Message.jsx';
import RoleChoice from '../components/RoleChoice.jsx';

const ROLES = [
  { value: 'STUDENT', label: 'Student', hint: 'Find events, register, get reminders' },
  { value: 'ORGANIZER', label: 'Organizer', hint: 'Create events for your club or department' },
];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('STUDENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [sending, setSending] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    setErrorText('');
    setSending(true);
    try {
      await register(name, email, password, role);
      navigate('/verify-email', { state: { email: email.trim().toLowerCase() } });
    } catch (error) {
      setErrorText(error.message);
      setSending(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthHero />
      <section className="auth-page">
        <div className="card">
          <h1>Create an account</h1>
          <p className="page-intro">We email you a code to check that your email is real.</p>
          <Message type="error" text={errorText} />
          <form onSubmit={handleSubmit} className="form">
            <RoleChoice roles={ROLES} value={role} onChange={setRole} />
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
              <span className="muted small">At least 8 characters.</span>
            </label>
            <button type="submit" disabled={sending}>{sending ? 'Creating account...' : 'Create account'}</button>
          </form>
        </div>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </div>
  );
}
