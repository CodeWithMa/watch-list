import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('src/index.html', 'utf8');
const nginxConf = readFileSync('containers/nginx.conf', 'utf8');

const metaPolicy = indexHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
const headerPolicy = nginxConf.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1];
const inlineScripts = [
  ...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
].map(([, body]) => body);

const directives = (policy = '') =>
  new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources];
      }),
  );

describe('Content-Security-Policy', () => {
  it('is defined in both the index.html meta fallback and the nginx header', () => {
    expect(metaPolicy).toBeDefined();
    expect(headerPolicy).toBeDefined();
  });

  it('matches between GitHub Pages (meta) and the container (header), except frame-ancestors', () => {
    const header = directives(headerPolicy);
    expect(header.get('frame-ancestors')).toEqual(["'none'"]);
    header.delete('frame-ancestors');
    expect(directives(metaPolicy)).toEqual(header);
  });

  it('allows exactly the hashes of the inline scripts in index.html', () => {
    const hashes = inlineScripts.map(
      (body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
    );
    const allowed = directives(metaPolicy)
      .get('script-src')
      ?.filter((source) => source.startsWith("'sha256-"));
    expect(allowed).toEqual(hashes);
  });
});
