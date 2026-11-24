import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import RequireRole from './auth/RequireRole.jsx';
import Header from './components/Header.jsx';
import Message from './components/Message.jsx';
import Login from './pages/Login.jsx';
import MyEvents from './pages/organizer/MyEvents.jsx';
import EventForm from './pages/organizer/EventForm.jsx';
import RescheduleEvent from './pages/organizer/RescheduleEvent.jsx';
import ReviewQueue from './pages/admin/ReviewQueue.jsx';
import Flags from './pages/admin/Flags.jsx';
import Categories from './pages/admin/Categories.jsx';
import Calendar from './pages/student/Calendar.jsx';
import SavedEvents from './pages/student/SavedEvents.jsx';
import Notifications from './pages/student/Notifications.jsx';

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
  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  if (user.role === 'STUDENT') {
    return <Navigate to="/student" replace />;
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
          <Route
            path="/organizer/events/:id/reschedule"
            element={<RequireRole roles={['ORGANIZER']}><RescheduleEvent /></RequireRole>}
          />
          <Route
            path="/admin"
            element={<RequireRole roles={['ADMIN']}><ReviewQueue /></RequireRole>}
          />
          <Route
            path="/admin/flags"
            element={<RequireRole roles={['ADMIN']}><Flags /></RequireRole>}
          />
          <Route
            path="/admin/categories"
            element={<RequireRole roles={['ADMIN']}><Categories /></RequireRole>}
          />
          <Route
            path="/student"
            element={<RequireRole roles={['STUDENT']}><Calendar /></RequireRole>}
          />
          <Route
            path="/student/saved"
            element={<RequireRole roles={['STUDENT']}><SavedEvents /></RequireRole>}
          />
          <Route
            path="/student/notifications"
            element={<RequireRole roles={['STUDENT']}><Notifications /></RequireRole>}
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </>
  );
}
