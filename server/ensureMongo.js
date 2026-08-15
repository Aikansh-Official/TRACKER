import { spawn } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

const host = '127.0.0.1';
const port = 27017;
const localRoot = process.env.TRACKER_MONGO_HOME
  || path.join(process.env.LOCALAPPDATA || process.cwd(), 'MongoDBServer');

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function isListening() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function existingFile(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

async function findMongod() {
  if (process.env.MONGOD_PATH && await existingFile(process.env.MONGOD_PATH)) return process.env.MONGOD_PATH;
  if (process.platform !== 'win32') return 'mongod';

  const serverRoot = path.join(localRoot, 'MongoDB', 'Server');
  try {
    const versions = (await readdir(serverRoot)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = path.join(serverRoot, version, 'bin', 'mongod.exe');
      if (await existingFile(candidate)) return candidate;
    }
  } catch {}

  const programFilesCandidate = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
  try {
    const versions = (await readdir(programFilesCandidate)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = path.join(programFilesCandidate, version, 'bin', 'mongod.exe');
      if (await existingFile(candidate)) return candidate;
    }
  } catch {}
  return null;
}

if (await isListening()) {
  console.log('MongoDB already listening on 127.0.0.1:27017');
  process.exit(0);
}

const mongod = await findMongod();
if (!mongod) {
  console.error('MongoDB Community Server is missing. Install it or set MONGOD_PATH, then run TRACKER again.');
  process.exit(1);
}

const dataPath = path.join(localRoot, 'data');
const logDirectory = path.join(localRoot, 'logs');
const logPath = path.join(logDirectory, 'mongod.log');
await mkdir(dataPath, { recursive: true });
await mkdir(logDirectory, { recursive: true });

const child = spawn(mongod, [
  '--dbpath', dataPath,
  '--bind_ip', host,
  '--port', String(port),
  '--logpath', logPath,
  '--logappend'
], { detached: true, stdio: 'ignore', windowsHide: true });
child.unref();

for (let attempt = 0; attempt < 20; attempt += 1) {
  if (await isListening()) {
    console.log(`MongoDB started on ${host}:${port}`);
    process.exit(0);
  }
  await sleep(400);
}

console.error(`MongoDB did not start. Check ${logPath}`);
process.exit(1);
