import { getBooks, type Book } from './api';

const PAGE_SIZE = 100;

// Returns null when isActive() turns false (e.g. the screen unmounted) mid-pagination.
export async function loadReadingBooks(isActive: () => boolean = () => true): Promise<Book[] | null> {
  const books: Book[] = [];
  let offset = 0;
  while (isActive()) {
    const page = await getBooks(offset);
    if (!isActive()) return null;
    books.push(...page.filter((book) => book.reading_status === 'reading'));
    if (page.length < PAGE_SIZE) return books;
    offset += page.length;
  }
  return null;
}
