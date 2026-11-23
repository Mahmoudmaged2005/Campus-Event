import 'dotenv/config';
import { makeApp } from './app.js';
import { config } from './shared/config.js';
import { authRouter } from './modules/auth/auth.routes.js';

const moduleRoutes = [
  { path: '/api/auth', router: authRouter },
];

const app = makeApp(moduleRoutes);

app.listen(config.port, function () {
  console.log('Backend running on http://localhost:' + config.port);
});
