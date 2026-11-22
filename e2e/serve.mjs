// Serves the production build for the browser tests, with the same SPA
// fallback as containers/nginx.conf.
import { join, normalize } from 'node:path';

const root = join(import.meta.dirname, '../dist/watch-list/browser');
const port = Number(process.argv[2] ?? 4300);

if (!(await Bun.file(join(root, 'index.html')).exists())) {
  throw new Error(`No production build in ${root}. Run "bun run build" first.`);
}

Bun.serve({
  port,
  hostname: 'localhost',
  async fetch(request) {
    const path = normalize(decodeURIComponent(new URL(request.url).pathname));
    const file = Bun.file(join(root, path));
    const isFile = path !== '/' && (await file.exists());
    return new Response(isFile ? file : Bun.file(join(root, 'index.html')));
  },
});

console.log(`Serving ${root} on http://localhost:${port}`);
