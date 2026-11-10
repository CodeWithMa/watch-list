import {
  buildDiscussionUrl,
  DEFAULT_DISCUSSION_URL_TEMPLATE,
  validateDiscussionTemplate,
} from './discussion-link.utils';

describe('discussion links', () => {
  it('generates the default search with a padded episode code', () => {
    expect(
      buildDiscussionUrl(DEFAULT_DISCUSSION_URL_TEMPLATE, {
        title: 'Dexter Resurrection',
        season: 2,
        episode: 1,
      }),
    ).toBe('https://www.google.com/search?q=reddit%20Dexter%20Resurrection%20s02e01');
  });

  it('replaces every placeholder once without recursively expanding title contents', () => {
    const template =
      'https://example.com/{title}?s={season}&e={episode}&code={episodeCode}&q={title}';
    const url = buildDiscussionUrl(template, {
      title: '{episode} & #日本語/?%+',
      season: 12,
      episode: 123,
    });
    expect(url).toBe(
      `https://example.com/${encodeURIComponent('{episode} & #日本語/?%+')}?s=12&e=123&code=s12e123&q=${encodeURIComponent('{episode} & #日本語/?%+')}`,
    );
  });

  it.each([{}, { season: 2 }, { episode: 1 }])(
    'does not invent an episode code for incomplete history: %j',
    (entry) => {
      const url = buildDiscussionUrl('https://example.com/?q={title}%20{episodeCode}', {
        title: 'Movie',
        ...entry,
      });
      expect(url).toBe('https://example.com/?q=Movie%20');
    },
  );

  it('supports other search engines, paths, fragments, and HTTP', () => {
    expect(
      buildDiscussionUrl('http://example.com/{title}#s{season}e{episode}', {
        title: 'A/B',
        season: 2,
        episode: 1,
      }),
    ).toBe('http://example.com/A%2FB#s2e1');
    expect(validateDiscussionTemplate('https://duckduckgo.com/?q=reddit%20{title}')).toBeNull();
    expect(validateDiscussionTemplate('https://www.bing.com/search?q={title}')).toBeNull();
  });

  it.each([
    '',
    'not a url',
    '/search?q={title}',
    'https:example.com',
    'https://',
    'javascript:alert(1)',
    'file:///tmp/search',
    'data:text/html,hello',
    'https://example.com/{unknown}',
    'https://example.com/{title',
    'https://example.com/{{title}}',
    'https://{title}.com/search',
    'https://user:password@example.com/search',
    'https://[invalid]/',
  ])('rejects invalid or unsafe templates: %s', (template) => {
    expect(validateDiscussionTemplate(template)).not.toBeNull();
    expect(buildDiscussionUrl(template, { title: 'Movie' })).toBeNull();
  });

  it('does not crash on malformed Unicode in imported titles', () => {
    expect(buildDiscussionUrl(DEFAULT_DISCUSSION_URL_TEMPLATE, { title: '\uD800' })).toBeNull();
  });
});
