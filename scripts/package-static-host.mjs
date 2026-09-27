// Make a host-ready folder while keeping the GitHub Pages build untouched.
import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await new Promise((resolveDone, reject) => {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'build'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PAGES_BASE_PATH: './' },
  });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolveDone() : reject(new Error(`Build exited ${code}`)));
});

const output = join(root, 'release', 'pocket-arcade-static-host');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'dist'), output, { recursive: true });
await cp(join(root, 'hosting', '_headers'), join(output, '_headers'));
console.log(`Static-host handoff: ${output}`);
