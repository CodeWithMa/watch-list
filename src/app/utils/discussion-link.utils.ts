export const DEFAULT_DISCUSSION_URL_TEMPLATE =
  'https://www.google.com/search?q=reddit%20{title}%20{episodeCode}';

const PLACEHOLDERS = ['title', 'season', 'episode', 'episodeCode'] as const;

export function validateDiscussionTemplate(template: string): string | null {
  const withoutPlaceholders = template.replace(/\{([^{}]+)\}/g, (match, name: string) =>
    PLACEHOLDERS.some((placeholder) => placeholder === name) ? 'example' : match,
  );
  if (/[{}]/.test(withoutPlaceholders)) {
    return 'Use only {title}, {season}, {episode}, and {episodeCode} placeholders.';
  }
  if (!/^https?:\/\//i.test(template)) {
    return 'Enter an absolute HTTP or HTTPS URL.';
  }
  // Keep the destination explicit; placeholders belong in the path, query, or fragment.
  if (/[{}]/.test(template.match(/^https?:\/\/([^/?#]*)/i)?.[1] ?? '')) {
    return 'Placeholders cannot be used in the URL host.';
  }
  try {
    const url = new URL(withoutPlaceholders);
    if (!url.hostname || url.username || url.password) {
      return 'Enter a URL with a host and without embedded credentials.';
    }
  } catch {
    return 'Enter a valid URL.';
  }
  return null;
}

export function buildDiscussionUrl(
  template: string,
  context: { title: string; season?: number; episode?: number },
): string | null {
  if (validateDiscussionTemplate(template)) return null;
  const season = context.season?.toString() ?? '';
  const episode = context.episode?.toString() ?? '';
  const values = {
    title: context.title,
    season,
    episode,
    episodeCode: season && episode ? `s${season.padStart(2, '0')}e${episode.padStart(2, '0')}` : '',
  };
  try {
    return template.replace(
      /\{(title|season|episode|episodeCode)\}/g,
      (_, name: keyof typeof values) => encodeURIComponent(values[name]),
    );
  } catch {
    // Malformed Unicode in an imported title must not prevent rendering history.
    return null;
  }
}
