import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthHero from '../components/AuthHero.jsx';
import Message from '../components/Message.jsx';

const EMPTY_MESSAGE = { type: 'info', text: '' };

function EmailStep({ email, onEmailChange, onCodeSent }) {
  const { forgotPassword } = useAuth();
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState('');

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    setSending(true);
    setErrorText('');
    try {
      await forgotPassword(email);
      onCodeSent();
    } catch (error) {
      setErrorText(error.message);
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Message type="error" text={errorText} />
      <label>
        Email
        <input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} required autoComplete="email" autoFocus />
      </label>
      <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send me a code'}</button>
    </form>
  );
}

function ResetStep({ email, onDone }) {
  const { forgotPassword, resetPassword } = useAuth();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(EMPTY_MESSAGE);

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    if (newPassword !== repeatPassword) {
      setMessage({ type: 'error', text: 'The two new passwords are not the same.' });
      return;
    }
    setBusy(true);
    setMessage(EMPTY_MESSAGE);
    try {
      const data = await resetPassword(email, code, newPassword);
      onDone(data.message);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setMessage(EMPTY_MESSAGE);
    try {
      await forgotPassword(email);
      setCode('');
      setMessage({ type: 'success', text: 'A new code is on its way. Check your inbox and spam folder.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setBusy(false);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Message type={message.type} text={message.text} />
      <label>
        6-digit code
        <input
          className="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
          autoFocus
        />
      </label>
      <label>
        New password
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
      </label>
      <label>
        New password again
        <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
      </label>
      <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Saving...' : 'Change my password'}</button>
      <p className="muted small">
        No email? <button type="button" className="link-button" disabled={busy} onClick={handleResend}>Send a new code</button>
      </p>
    </form>
  );
}

export default function ForgotPassword() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state && location.state.email ? location.state.email : '');
  const [codeSent, setCodeSent] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  function handleDone(successText) {
    navigate('/login', { state: { message: successText } });
  }

  return (
    <div className="auth-screen">
      <AuthHero />
      <section className="auth-page">
        <div className="card">
          <h1>Forgot your password?</h1>
          {codeSent ? (
            <>
              <p className="page-intro">
                If an account uses <strong>{email}</strong>, we sent it a 6-digit code.
                Type the code and choose a new password. The code works for 15 minutes.
              </p>
              <ResetStep email={email.trim().toLowerCase()} onDone={handleDone} />
            </>
          ) : (
            <>
              <p className="page-intro">Type your email and we send you a code to choose a new password.</p>
              <EmailStep email={email} onEmailChange={setEmail} onCodeSent={() => setCodeSent(true)} />
            </>
          )}
        </div>
        <p className="auth-switch">
          Remembered it? <Link to="/login">Back to log in</Link>
        </p>
      </section>
    </div>
  );
}
