import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import RequireRole from './auth/RequireRole.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Profile from './pages/Profile.jsx';
import MyEvents from './pages/organizer/MyEvents.jsx';
import EventForm from './pages/organizer/EventForm.jsx';
import RescheduleEvent from './pages/organizer/RescheduleEvent.jsx';
import OrganizerNotifications from './pages/organizer/OrganizerNotifications.jsx';
import ReviewQueue from './pages/admin/ReviewQueue.jsx';
import Flags from './pages/admin/Flags.jsx';
import Categories from './pages/admin/Categories.jsx';
import AuditLog from './pages/admin/AuditLog.jsx';
import Calendar from './pages/student/Calendar.jsx';
import SavedEvents from './pages/student/SavedEvents.jsx';
import Notifications from './pages/student/Notifications.jsx';

const HOME_BY_ROLE = {
  STUDENT: '/student',
  ORGANIZER: '/organizer',
  ADMIN: '/admin',
};

const EVERY_ROLE = ['STUDENT', 'ORGANIZER', 'ADMIN'];

function Home() {
  const { user, checking } = useAuth();
  if (checking) {
    return <p className="muted">Loading...</p>;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
}

function onlyFor(roles, page) {
  return <RequireRole roles={roles}>{page}</RequireRole>;
}

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="page">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/profile" element={onlyFor(EVERY_ROLE, <Profile />)} />
          <Route path="/organizer" element={onlyFor(['ORGANIZER'], <MyEvents />)} />
          <Route path="/organizer/events/new" element={onlyFor(['ORGANIZER'], <EventForm />)} />
          <Route path="/organizer/events/:id/edit" element={onlyFor(['ORGANIZER'], <EventForm />)} />
          <Route path="/organizer/events/:id/reschedule" element={onlyFor(['ORGANIZER'], <RescheduleEvent />)} />
          <Route path="/organizer/notifications" element={onlyFor(['ORGANIZER'], <OrganizerNotifications />)} />
          <Route path="/admin" element={onlyFor(['ADMIN'], <ReviewQueue />)} />
          <Route path="/admin/flags" element={onlyFor(['ADMIN'], <Flags />)} />
          <Route path="/admin/categories" element={onlyFor(['ADMIN'], <Categories />)} />
          <Route path="/admin/audit" element={onlyFor(['ADMIN'], <AuditLog />)} />
          <Route path="/student" element={onlyFor(['STUDENT'], <Calendar />)} />
          <Route path="/student/saved" element={onlyFor(['STUDENT'], <SavedEvents />)} />
          <Route path="/student/notifications" element={onlyFor(['STUDENT'], <Notifications />)} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
