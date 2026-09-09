import { genresForBook, isRead } from '@/lib/book-features';
import type {
  BookGenre,
  BookMetadataMap,
  BookRecord,
  YearSummary,
} from '@/lib/types';

function yearFromDate(value: string | null) {
  const match = value?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function rankedCounts<T extends string>(values: T[], limit: number) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function buildYearSummaries(
  books: BookRecord[],
  metadata: BookMetadataMap = {},
): YearSummary[] {
  const years = new Map<number, BookRecord[]>();
  for (const book of books) {
    if (!isRead(book)) continue;
    const year = yearFromDate(book.dateRead);
    if (!year) continue;
    const group = years.get(year) ?? [];
    group.push(book);
    years.set(year, group);
  }

  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearBooks]) => {
      const rated = yearBooks.filter((book) => book.myRating !== null);
      const pageCounts = yearBooks
        .map((book) => book.pageCount ?? metadata[book.id]?.pageCount ?? null)
        .filter((pages): pages is number => pages !== null);
      const longestBook =
        [...yearBooks].sort(
          (a, b) =>
            (b.pageCount ?? metadata[b.id]?.pageCount ?? 0) -
            (a.pageCount ?? metadata[a.id]?.pageCount ?? 0),
        )[0] ?? null;
      const topGenres = rankedCounts<BookGenre>(
        yearBooks.flatMap((book) => genresForBook(book, metadata)),
        3,
      );

      return {
        year,
        booksRead: yearBooks.length,
        ratedCount: rated.length,
        averageRating:
          rated.length > 0
            ? rated.reduce((sum, book) => sum + (book.myRating ?? 0), 0) /
              rated.length
            : null,
        fiveStarCount: rated.filter((book) => book.myRating === 5).length,
        totalPages: pageCounts.reduce((sum, pages) => sum + pages, 0),
        pageCountCoverage: pageCounts.length,
        topAuthors: rankedCounts(
          yearBooks.map((book) => book.author),
          3,
        ),
        topGenres,
        longestBook,
        books: [...yearBooks].sort(
          (a, b) =>
            (b.dateRead ?? '').localeCompare(a.dateRead ?? '') ||
            a.title.localeCompare(b.title),
        ),
      };
    });
}

export function undatedReadCount(books: BookRecord[]) {
  return books.filter((book) => isRead(book) && !yearFromDate(book.dateRead))
    .length;
}
