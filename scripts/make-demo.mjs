// Renders scripts/demo.html frame by frame with headless Chrome, then builds
// docs/demo.gif with ffmpeg. Needs Chrome and ffmpeg on the machine.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, '.tmp', 'demo');
const frames = Number(process.env.FRAMES ?? 112);
const fps = Number(process.env.FPS ?? 12);
const out = path.join(root, 'docs', 'demo.gif');

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((candidate) => candidate && existsSync(candidate));

if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH.');
  process.exit(1);
}

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const htmlUrl = pathToFileURL(path.join(root, 'scripts', 'demo.html')).href;

await fs.rm(work, { recursive: true, force: true });
await fs.mkdir(work, { recursive: true });

const shots = Array.from({ length: frames }, (_, index) => index);
const failures = [];

async function shoot(index) {
  const file = path.join(work, `frame-${String(index).padStart(3, '0')}.png`);
  const profile = path.join(work, `profile-${index}`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--force-device-scale-factor=1',
        '--window-size=960,540',
        `--user-data-dir=${profile}`,
        '--virtual-time-budget=600',
        `--screenshot=${file}`,
        `${htmlUrl}?f=${index}`,
      ],
      { stdio: 'ignore' },
    );
    child.on('error', reject);
    child.on('exit', resolve);
  });
  if (code !== 0) failures.push(index);
  await fs.rm(profile, { recursive: true, force: true });
}

async function worker() {
  while (shots.length > 0) {
    const index = shots.shift();
    await shoot(index);
  }
}

await Promise.all(Array.from({ length: 4 }, worker));
if (failures.length > 0) {
  console.error(`Chrome failed for ${failures.length} frames.`);
  process.exit(1);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}

const input = path.join(work, 'frame-%03d.png');
const palette = path.join(work, 'palette.png');

await run([
  '-y',
  '-framerate',
  String(fps),
  '-i',
  input,
  '-vf',
  'scale=880:-1:flags=lanczos,palettegen=max_colors=160:stats_mode=diff',
  palette,
]);

await run([
  '-y',
  '-framerate',
  String(fps),
  '-i',
  input,
  '-i',
  palette,
  '-lavfi',
  'scale=880:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
  '-loop',
  '0',
  out,
]);

const stats = await fs.stat(out);
await fs.rm(work, { recursive: true, force: true });
console.log(`Wrote ${path.relative(root, out)} (${Math.round(stats.size / 1024)} KB, ${frames} frames)`);
