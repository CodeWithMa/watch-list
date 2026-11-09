const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

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
