import { spawn } from 'node:child_process';
import { serveStatic } from '../tests/static-server.mjs';

// Optional browser suite; Chromium and puppeteer-core are test tools only.
const basePath = process.env.PAGES_BASE_PATH || '/pocket-arcade/';
const env = { ...process.env, PAGES_BASE_PATH: basePath };
async function run(command, args, environment = env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
await run('npm', ['run', 'build']);
const { server, url } = await serveStatic({ basePath });
console.log(`Testing only the static dist/ artifact at ${url}`);
try {
  await run(process.execPath, ['tests/browser.mjs'], { ...env, ARCADE_URL: url });
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
