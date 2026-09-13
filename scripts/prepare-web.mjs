import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ['index.html', 'workspace.html', 'outline.html', 'world.html', 'template.html']) {
  await cp(join(root, file), join(dist, file));
}
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });

console.log(`Prepared frontend assets in ${dist}`);
