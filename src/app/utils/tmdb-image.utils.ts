const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

function getPlaceholderSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 342 513" width="342" height="513">
      <rect width="342" height="513" fill="#3a3d42"/>
      <rect x="111" y="196" width="120" height="120" rx="14" fill="none" stroke="#6f747b" stroke-width="8"/>
      <path d="M155 228v56l46-28z" fill="#6f747b"/>
    </svg>
  `.trim();
}

export function getPosterUrl(posterPath: string | undefined): string | null {
  if (!posterPath) {
    return null;
  }

  if (posterPath.startsWith('/')) {
    return `${TMDB_IMAGE_BASE_URL}${posterPath}`;
  }

  try {
    new URL(posterPath);
    return posterPath;
  } catch {
    return null;
  }
}

export function getPlaceholderUrl(): string {
  return `data:image/svg+xml;base64,${btoa(getPlaceholderSvg())}`;
}
