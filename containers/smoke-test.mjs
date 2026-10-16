import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

const origin = 'http://localhost:4200';

async function get(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  return response;
}

// A detached Compose start can return before nginx is accepting connections.
for (let attempt = 0; ; attempt++) {
  try {
    await get('/');
    break;
  } catch (error) {
    if (attempt === 29) throw error;
    await setTimeout(1000);
  }
}

const response = await get('/');
assert.ok(response.headers.get('content-type')?.includes('text/html'));
assert.ok(response.headers.get('content-security-policy')?.includes("default-src 'self'"));
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.equal(response.headers.get('x-frame-options'), 'DENY');
assert.equal(response.headers.get('referrer-policy'), 'no-referrer');

const html = await response.text();
assert.equal(await (await get('/settings')).text(), html, 'SPA routes should serve index.html');

const stylesheet = html.match(/href="([^"]*styles[^"\s]*\.css)"/)?.[1];
assert.ok(stylesheet, 'index.html should reference the built stylesheet');
const css = await (await get(stylesheet)).text();
assert.ok(css.includes('.flex{display:flex}'), 'Tailwind utilities should be compiled');

const manifest = await (await get('/ngsw.json')).json();
assert.ok(manifest.hashTable['/index.html'], 'the service worker should cache index.html');
const worker = await get('/ngsw-worker.js');
assert.ok(worker.headers.get('content-type')?.includes('javascript'));

const mainScript = html.match(/src="([^"]*main[^"\s]*\.js)"/)?.[1];
assert.ok(mainScript, 'index.html should reference the application bundle');
const javascript = await (await get(mainScript)).text();
if (process.env.COMMIT_HASH) {
  assert.ok(
    javascript.includes(process.env.COMMIT_HASH),
    'the bundle should contain the commit hash',
  );
}

console.log('Production preview smoke check passed.');
