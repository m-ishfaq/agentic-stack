import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'packages', 'cli');

await fs.rm(path.join(cli, 'lib'), { recursive: true, force: true });
await fs.rm(path.join(cli, 'templates'), { recursive: true, force: true });
await fs.cp(path.join(root, 'packages', 'core', 'src'), path.join(cli, 'lib', 'core'), {
  recursive: true,
});
await fs.cp(path.join(root, 'templates'), path.join(cli, 'templates'), { recursive: true });

console.error('packaged core and templates into packages/cli');
