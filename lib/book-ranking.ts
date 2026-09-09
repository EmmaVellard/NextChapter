import { isRead } from '@/lib/book-features';
import type { BookRecord } from '@/lib/types';

export function readingYear(book: BookRecord) {
  const match = book.dateRead?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function rankReadBooks(
  books: BookRecord[],
  rankingOrder: string[] = [],
) {
  const ranked = books
    .filter((book) => isRead(book) && book.myRating !== null)
    .sort(
      (a, b) =>
        (b.myRating ?? 0) - (a.myRating ?? 0) ||
        (b.averageRating ?? 0) - (a.averageRating ?? 0) ||
        (b.dateRead ?? '').localeCompare(a.dateRead ?? '') ||
        a.title.localeCompare(b.title),
    );
  if (rankingOrder.length === 0) return ranked;
  const positions = new Map(
    rankingOrder.map((bookId, index) => [bookId, index]),
  );
  return ranked.sort((a, b) => {
    const aPosition = positions.get(a.id);
    const bPosition = positions.get(b.id);
    if (aPosition !== undefined && bPosition !== undefined) {
      return aPosition - bPosition;
    }
    if (aPosition !== undefined) return -1;
    if (bPosition !== undefined) return 1;
    return 0;
  });
}
