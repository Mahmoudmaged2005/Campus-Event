import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthHero from '../components/AuthHero.jsx';
import Message from '../components/Message.jsx';
import RoleChoice from '../components/RoleChoice.jsx';

const TRIES_BEFORE_HELP = 3;

const ROLES = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'ORGANIZER', label: 'Organizer' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('STUDENT');
  const [failedTries, setFailedTries] = useState(0);
  const successText = location.state && location.state.message ? location.state.message : '';
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
      await login(email, password, role);
      navigate('/');
    } catch (error) {
      if (error.data && error.data.needsVerification) {
        navigate('/verify-email', { state: { email: error.data.email } });
        return;
      }
      if (error.status === 401) {
        setFailedTries(failedTries + 1);
      }
      setErrorText(error.message);
      setSending(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthHero />
      <section className="auth-page">
        <div className="card">
          <h1>Log in</h1>
          <p className="page-intro">Choose how you use Campus Events.</p>
          <Message type="success" text={errorText ? '' : successText} />
          <Message type="error" text={errorText} />
          {failedTries >= TRIES_BEFORE_HELP ? (
            <p className="forgot-hint">
              Having trouble? <Link to="/forgot-password" state={{ email: email }}>Forgot your password?</Link>
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="form">
            <RoleChoice roles={ROLES} value={role} onChange={setRole} />
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </label>
            <button type="submit" disabled={sending}>{sending ? 'Logging in...' : 'Log in'}</button>
          </form>
        </div>
        <p className="auth-switch">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </section>
    </div>
  );
}
