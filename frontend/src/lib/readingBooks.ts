import { useEffect, useState } from 'react';
import { getBooks, type Book } from './api';
import { completedReadCount } from './readingStatus';

const PAGE_SIZE = 100;

// Returns null when isActive() turns false (e.g. the screen unmounted) mid-pagination.
export async function loadAllBooks(isActive: () => boolean = () => true): Promise<Book[] | null> {
  const books: Book[] = [];
  let offset = 0;
  while (isActive()) {
    const page = await getBooks(offset);
    if (!isActive()) return null;
    books.push(...page);
    if (page.length < PAGE_SIZE) return books;
    offset += page.length;
  }
  return null;
}

export async function loadReadingBooks(isActive: () => boolean = () => true): Promise<Book[] | null> {
  const books = await loadAllBooks(isActive);
  return books && books.filter((book) => book.reading_status === 'reading');
}

// Use the same completed-reading count as the home screen.
export function useCompletedBookCount() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setCount(null);
    setError(null);
    loadAllBooks(() => active).then((books) => {
      if (active && books) {
        setCount(completedReadCount(books));
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '読了冊数の取得に失敗しました。');
    });
    return () => { active = false; };
  }, [version]);
  return { count, error, retry: () => setVersion((value) => value + 1) };
}
