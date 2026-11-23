import 'dotenv/config';
import { makeApp } from './app.js';
import { config } from './shared/config.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';

const moduleRoutes = [
  { path: '/api/auth', router: authRouter },
  { path: '/api/events', router: eventsRouter },
];

const app = makeApp(moduleRoutes);

app.listen(config.port, function () {
  console.log('Backend running on http://localhost:' + config.port);
});
