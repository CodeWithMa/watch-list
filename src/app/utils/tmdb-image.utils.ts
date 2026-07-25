const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

function getPlaceholderSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 342 513" width="342" height="513">
      <rect width="342" height="513" fill="#2d2d2d"/>
      <rect x="85.5" y="128.25" width="171" height="256.5" fill="#3d3d3d" rx="8"/>
      <path d="M171 200c-28 0-50 22-50 50s22 50 50 50 50-22 50-50-22-50-50-50z" fill="#555"/>
      <path d="M171 275c-14 0-25 11-25 25s11 25 25 25 25-11 25-25-11-25-25-25z" fill="#555"/>
      <path d="M171 350c-30 0-55 25-55 55h110c0-30-25-55-55-55z" fill="#555"/>
    </svg>
  `.trim();
}

export function getPosterUrl(posterPath: string | undefined): string | null {
  if (!posterPath) {
    return null;
  }
  return `${TMDB_IMAGE_BASE_URL}${posterPath}`;
}

export function getPosterPreviewUrl(posterPath: string | undefined): string | null {
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
