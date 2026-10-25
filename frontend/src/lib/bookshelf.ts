import { getBookReviews, getIterations, type Book, type PageReview } from './api';
import { loadAllBooks } from './readingBooks';

export type ShelfEntry = {
  book: Book;
  completedAt: string | null;
  reviews: PageReview[];
};

export async function loadCompletedShelf(isActive: () => boolean): Promise<ShelfEntry[] | null> {
  const books = await loadAllBooks(isActive);
  if (!books || !isActive()) return null;
  const entries: ShelfEntry[] = [];
  for (const book of books) {
    if (book.reading_status !== 'completed' && book.latest_iteration < 2) continue;
    const iterations = await getIterations(book.id);
    if (!isActive()) return null;
    const completed = iterations.filter((iteration) => iteration.status === 'completed');
    if (completed.length === 0) continue;
    const dates = completed.map((iteration) => iteration.completed_at)
      .filter((date): date is string => date !== null && Number.isFinite(Date.parse(date)))
      .sort((a, b) => Date.parse(b) - Date.parse(a));
    const reviews: PageReview[] = [];
    for (const iteration of iterations) {
      reviews.push(...await getBookReviews(book.id, iteration.iteration_number));
      if (!isActive()) return null;
    }
    entries.push({ book, completedAt: dates[0] ?? null, reviews });
  }
  return entries.sort((a, b) =>
    (b.completedAt ? Date.parse(b.completedAt) : -Infinity) -
    (a.completedAt ? Date.parse(a.completedAt) : -Infinity) || a.book.id - b.book.id);
}

const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase();

export function matchesKeyword(entry: ShelfEntry, query: string): boolean {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const fields = [entry.book.title, entry.book.author ?? '', ...entry.reviews.map((review) => review.review_text)]
    .map(normalize);
  return words.every((word) => fields.some((field) => field.includes(word)));
}

export function matchingReview(entry: ShelfEntry, query: string): PageReview | undefined {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;
  return entry.reviews.find((review) => words.some((word) => normalize(review.review_text).includes(word)));
}

export function reviewExcerpt(text: string, query: string): string {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const index = words.map((word) => normalize(text).indexOf(word)).find((position) => position >= 0) ?? 0;
  const start = Math.max(0, index - 16);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 70)}${text.length > start + 70 ? '…' : ''}`;
}

export function shelfMonth(date: string | null): string {
  if (!date) return '読了日不明';
  const value = new Date(date);
  return `${value.getFullYear()}年${value.getMonth() + 1}月`;
}
