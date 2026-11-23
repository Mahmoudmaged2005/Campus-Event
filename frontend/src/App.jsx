import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import RequireRole from './auth/RequireRole.jsx';
import Header from './components/Header.jsx';
import Message from './components/Message.jsx';
import Login from './pages/Login.jsx';
import MyEvents from './pages/organizer/MyEvents.jsx';
import EventForm from './pages/organizer/EventForm.jsx';

function Home() {
  const { user, checking } = useAuth();
  if (checking) {
    return <p>Loading...</p>;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'ORGANIZER') {
    return <Navigate to="/organizer" replace />;
  }
  return <Message type="info" text={'The ' + user.role.toLowerCase() + ' pages are not ready yet.'} />;
}

export default function App() {
  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/organizer"
            element={<RequireRole roles={['ORGANIZER']}><MyEvents /></RequireRole>}
          />
          <Route
            path="/organizer/events/new"
            element={<RequireRole roles={['ORGANIZER']}><EventForm /></RequireRole>}
          />
          <Route
            path="/organizer/events/:id/edit"
            element={<RequireRole roles={['ORGANIZER']}><EventForm /></RequireRole>}
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </>
  );
}
