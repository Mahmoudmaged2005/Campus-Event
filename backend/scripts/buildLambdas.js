import { build } from 'esbuild';

const MODULES = ['auth', 'events', 'admin', 'student', 'notifications'];
const REQUIRE_FOR_OLD_PACKAGES = "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);";

for (const moduleName of MODULES) {
  await build({
    entryPoints: ['src/modules/' + moduleName + '/lambda.js'],
    outfile: 'dist/' + moduleName + '/index.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: REQUIRE_FOR_OLD_PACKAGES },
    logLevel: 'warning',
  });
  console.log('Built dist/' + moduleName + '/index.mjs');
}
