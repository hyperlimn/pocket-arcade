// Build a separate USB/IT handoff without changing the Pages artifact or source.
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = resolve(root, 'release');
const folder = join(release, 'pocket-arcade-offline');

await new Promise((resolveDone, reject) => {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'build'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PAGES_BASE_PATH: './' },
  });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolveDone() : reject(new Error(`Build exited ${code}`)));
});

await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
await cp(join(root, 'dist'), join(folder, 'site'), { recursive: true });
await cp(join(root, 'portable', 'README.md'), join(folder, 'README.md'));
await cp(join(root, 'portable', 'launch.py'), join(folder, 'launch.py'));

async function list(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? list(path) : [path];
  }));
  return files.flat().sort();
}

// Small dependency-free ZIP writer. Stored entries are already minified build
// files; the archive can be extracted by ChromeOS Files, Windows, or macOS.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

const locals = [];
const central = [];
let offset = 0;
const files = await list(folder);
for (const path of files) {
  const name = Buffer.from(`pocket-arcade-offline/${relative(folder, path).replaceAll('\\', '/')}`);
  const body = await readFile(path);
  const checksum = crc32(body);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, body);

  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(20, 4);
  record.writeUInt16LE(20, 6);
  record.writeUInt16LE(0x800, 8);
  record.writeUInt32LE(checksum, 16);
  record.writeUInt32LE(body.length, 20);
  record.writeUInt32LE(body.length, 24);
  record.writeUInt16LE(name.length, 28);
  record.writeUInt32LE(offset, 42);
  central.push(record, name);
  offset += local.length + name.length + body.length;
}
const directorySize = central.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directorySize, 12);
end.writeUInt32LE(offset, 16);
const archive = join(release, 'pocket-arcade-offline.zip');
await writeFile(archive, Buffer.concat([...locals, ...central, end]));
console.log(`Portable edition: ${files.length} files in ${folder} and ${archive}`);
