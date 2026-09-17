export function firstSentence(value: string | string[] | undefined | null) {
  const sentence = Array.isArray(value) ? value[0] : value;
  if (!sentence) return null;
  return (
    sentence
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

export function shortSynopsis(
  value: string | { value?: string } | undefined | null,
) {
  const raw = typeof value === 'string' ? value : value?.value;
  if (!raw) return null;
  const clean = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  if (clean.length <= 420) return clean;
  const excerpt = clean.slice(0, 420);
  const sentenceEnd = Math.max(
    excerpt.lastIndexOf('. '),
    excerpt.lastIndexOf('! '),
    excerpt.lastIndexOf('? '),
  );
  if (sentenceEnd >= 180) return excerpt.slice(0, sentenceEnd + 1);
  const wordEnd = excerpt.lastIndexOf(' ');
  return `${excerpt.slice(0, wordEnd > 0 ? wordEnd : 420)}…`;
}
