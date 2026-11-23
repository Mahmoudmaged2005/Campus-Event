import 'dotenv/config';
import { makeApp } from './app.js';
import { config } from './shared/config.js';

const moduleRoutes = [];

const app = makeApp(moduleRoutes);

app.listen(config.port, function () {
  console.log('Backend running on http://localhost:' + config.port);
});
