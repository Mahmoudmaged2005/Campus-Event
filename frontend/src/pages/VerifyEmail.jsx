import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthHero from '../components/AuthHero.jsx';
import CodeForm from '../components/CodeForm.jsx';

export default function VerifyEmail() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state ? location.state.email : '';

  if (user) {
    return <Navigate to="/" replace />;
  }
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="auth-screen">
      <AuthHero />
      <section className="auth-page">
        <div className="card">
          <h1>Check your email</h1>
          <p className="page-intro">
            We sent a 6-digit code to <strong>{email}</strong>. Type it below to activate your account.
            The code works for 15 minutes.
          </p>
          <CodeForm email={email} onVerified={() => navigate('/')} />
        </div>
        <p className="auth-switch">
          Wrong email? <Link to="/register">Sign up again</Link>
        </p>
      </section>
    </div>
  );
}
