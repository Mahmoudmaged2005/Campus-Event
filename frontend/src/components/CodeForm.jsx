import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import Message from './Message.jsx';

const EMPTY_MESSAGE = { type: 'info', text: '' };

export default function CodeForm({ email, onVerified }) {
  const { verifyEmail, resendCode } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(EMPTY_MESSAGE);

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setMessage(EMPTY_MESSAGE);
    try {
      await verifyEmail(email, code);
      onVerified();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setMessage(EMPTY_MESSAGE);
    try {
      await resendCode(email);
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
          minLength={6}
          maxLength={6}
        />
      </label>
      <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking...' : 'Verify email'}</button>
      <p className="muted small">
        No email? <button type="button" className="link-button" disabled={busy} onClick={handleResend}>Send a new code</button>
      </p>
    </form>
  );
}
