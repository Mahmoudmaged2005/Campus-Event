import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Message from '../components/Message.jsx';

export default function RequireRole({ roles, children }) {
  const { user, checking } = useAuth();

  if (checking) {
    return <p>Loading...</p>;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return <Message type="error" text="You are not allowed to open this page." />;
  }
  return children;
}
