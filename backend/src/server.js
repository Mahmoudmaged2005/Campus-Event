import 'dotenv/config';
import { makeApp } from './app.js';
import { config } from './shared/config.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { studentRouter } from './modules/student/student.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';

const moduleRoutes = [
  { path: '/api/auth', router: authRouter },
  { path: '/api/events', router: eventsRouter },
  { path: '/api/admin', router: adminRouter },
  { path: '/api/student', router: studentRouter },
  { path: '/api/notifications', router: notificationsRouter },
];

const app = makeApp(moduleRoutes);

app.listen(config.port, function () {
  console.log('Backend running on http://localhost:' + config.port);
});
