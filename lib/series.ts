import { isRead } from './book-features.ts';
import type { BookMetadataMap, BookRecord } from '@/lib/types';

export interface SeriesInfo {
  name: string;
  key: string;
  position: number;
  endPosition: number;
}

const seriesSuffix =
  /\(([^()]+?)(?:,\s*|\s+)#\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\)\s*$/i;
const namedVolume =
  /^(.+?)(?:\s*[-,:]\s*)(?:livre|book|tome|volume|vol\.?)\s*([ivxlcdm]+|\d+(?:\.\d+)?)\b/i;

function romanNumber(value: string) {
  const digits: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  const upper = value.toUpperCase();
  for (let index = 0; index < upper.length; index += 1) {
    const current = digits[upper[index]] ?? 0;
    const next = digits[upper[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

function positionNumber(value: string) {
  return /^\d/.test(value) ? Number(value) : romanNumber(value);
}

function seriesKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function seriesForBook(
  book: BookRecord,
  metadata: BookMetadataMap = {},
): SeriesInfo | null {
  const details = metadata[book.id];
  const manualName = details?.seriesName?.trim();
  const manualPosition = details?.seriesPosition;
  if (
    manualName &&
    typeof manualPosition === 'number' &&
    Number.isFinite(manualPosition) &&
    manualPosition >= 0
  ) {
    return {
      name: manualName,
      key: seriesKey(manualName),
      position: manualPosition,
      endPosition: manualPosition,
    };
  }

  const suffixMatch = book.title.match(seriesSuffix);
  const volumeMatch = suffixMatch ? null : book.title.match(namedVolume);
  const match = suffixMatch ?? volumeMatch;
  if (!match) return null;
  const name = match[1].trim().replace(/,$/, '').trim();
  const position = positionNumber(match[2]);
  const endPosition = suffixMatch?.[3]
    ? positionNumber(suffixMatch[3])
    : position;
  if (!name || !Number.isFinite(position) || !Number.isFinite(endPosition)) {
    return null;
  }
  return {
    name,
    key: seriesKey(name),
    position,
    endPosition: Math.max(position, endPosition),
  };
}

export function seriesRecommendationStatus(
  candidate: BookRecord,
  books: BookRecord[],
  metadata: BookMetadataMap = {},
) {
  const series = seriesForBook(candidate, metadata);
  if (!series || series.position < 1) {
    return { eligible: true, series, highestFinished: null };
  }

  const finishedPositions = books
    .filter(isRead)
    .map((book) => seriesForBook(book, metadata))
    .filter((item): item is SeriesInfo =>
      Boolean(item && item.key === series.key),
    )
    .map((item) => item.endPosition);
  const highestFinished =
    finishedPositions.length > 0 ? Math.max(...finishedPositions) : 0;

  return {
    eligible:
      series.position > highestFinished &&
      series.position <= highestFinished + 1,
    series,
    highestFinished,
  };
}
