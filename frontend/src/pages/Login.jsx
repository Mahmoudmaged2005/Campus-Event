import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Message from '../components/Message.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
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
      await login(email, password);
      navigate('/');
    } catch (error) {
      setErrorText(error.message);
    }
    setSending(false);
  }

  return (
    <section className="card narrow">
      <h1>Log in</h1>
      <Message type="error" text={errorText} />
      <form onSubmit={handleSubmit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={sending}>{sending ? 'Logging in...' : 'Log in'}</button>
      </form>
    </section>
  );
}
