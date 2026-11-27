import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import Message from '../components/Message.jsx';
import CodeForm from '../components/CodeForm.jsx';
import Toast from '../components/Toast.jsx';
import { initialsOf } from '../utils/initials.js';
import { listenForOutsideClick } from '../utils/outsideClick.js';

const EMPTY_MESSAGE = { type: 'info', text: '' };

function AccountEditForm({ user, onSave, onClose }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const emailChanged = email.trim().toLowerCase() !== user.email;

  useEffect(function () {
    return listenForOutsideClick('account-card', onClose);
  }, [onClose]);

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    const changes = { name: name };
    if (emailChanged) {
      changes.email = email;
      changes.currentPassword = currentPassword;
    }
    setSaving(true);
    setErrorText('');
    try {
      await onSave(changes, emailChanged);
    } catch (error) {
      setErrorText(error.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Message type="error" text={errorText} />
      <label>
        Full name
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoFocus />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {emailChanged ? (
        <label>
          Current password (needed to change your email)
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
        </label>
      ) : null}
      <div className="row">
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function AccountCard({ user, updateProfile }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(EMPTY_MESSAGE);

  function clearMessage() {
    setMessage(EMPTY_MESSAGE);
  }

  function closeEditing() {
    setEditing(false);
  }

  async function handleSave(changes, emailChanged) {
    await updateProfile(changes);
    setEditing(false);
    if (emailChanged) {
      setMessage({ type: 'success', text: 'Saved. We sent a code to your new email, type it below.' });
    } else {
      setMessage({ type: 'success', text: 'Your details are saved.' });
    }
  }

  function startEditing() {
    setMessage(EMPTY_MESSAGE);
    setEditing(true);
  }

  return (
    <div id="account-card" className="card stack">
      <div className="profile-card">
        <span className="avatar avatar-large">{initialsOf(user.name)}</span>
        <div>
          <h2 className="card-title">{user.name}</h2>
          <p className="muted">{user.email}</p>
        </div>
        <div className="profile-card-end">
          <span className="badge badge-info">{user.role.toLowerCase()}</span>
          {editing ? null : (
            <button type="button" className="button-secondary button-small" onClick={startEditing}>Edit</button>
          )}
        </div>
      </div>
      <Toast message={message} onClose={clearMessage} />
      {editing ? <AccountEditForm user={user} onSave={handleSave} onClose={closeEditing} /> : null}
    </div>
  );
}

function PasswordEditForm({ onSave, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(function () {
    return listenForOutsideClick('password-card', onClose);
  }, [onClose]);

  async function handleSubmit(formEvent) {
    formEvent.preventDefault();
    if (newPassword !== repeatPassword) {
      setErrorText('The two new passwords are not the same.');
      return;
    }
    setSaving(true);
    setErrorText('');
    try {
      await onSave({ currentPassword: currentPassword, newPassword: newPassword });
    } catch (error) {
      setErrorText(error.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <Message type="error" text={errorText} />
      <label>
        Current password
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" autoFocus />
      </label>
      <div className="form-row">
        <label>
          New password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
        <label>
          New password again
          <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
      </div>
      <div className="row">
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Change password'}</button>
        <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function PasswordCard({ updateProfile }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(EMPTY_MESSAGE);

  function clearMessage() {
    setMessage(EMPTY_MESSAGE);
  }

  function closeEditing() {
    setEditing(false);
  }

  async function handleSave(changes) {
    await updateProfile(changes);
    setEditing(false);
    setMessage({ type: 'success', text: 'Password changed. Your other logins were signed out.' });
  }

  function startEditing() {
    setMessage(EMPTY_MESSAGE);
    setEditing(true);
  }

  return (
    <div id="password-card" className="card stack">
      <div className="profile-card">
        <div>
          <h2 className="card-title">Password</h2>
          <p className="muted">••••••••</p>
        </div>
        <div className="profile-card-end">
          {editing ? null : (
            <button type="button" className="button-secondary button-small" onClick={startEditing}>Change password</button>
          )}
        </div>
      </div>
      <Toast message={message} onClose={clearMessage} />
      {editing ? <PasswordEditForm onSave={handleSave} onClose={closeEditing} /> : null}
    </div>
  );
}

export default function Profile() {
  const { user, updateProfile } = useAuth();

  return (
    <section className="profile-page">
      <div className="page-title-row">
        <div>
          <h1>Profile</h1>
          <p className="page-intro">Your account details. Click Edit to change them.</p>
        </div>
      </div>
      <AccountCard user={user} updateProfile={updateProfile} />
      {user.emailVerified ? null : (
        <div className="card verify-box">
          <h2 className="card-title">Verify your new email</h2>
          <p className="muted">We sent a 6-digit code to <strong>{user.email}</strong>. You need it to log in next time.</p>
          <CodeForm email={user.email} onVerified={() => {}} />
        </div>
      )}
      <PasswordCard updateProfile={updateProfile} />
    </section>
  );
}
