import { useEffect, useState } from 'react';

import { getIterations } from './api';
import { loadAllBooks } from './readingBooks';
import { completedReadCount } from './readingStatus';

export type ReadingStatistics = {
  completed: number;
  reading: number;
  pages: number;
};

export async function loadReadingStatistics(isActive: () => boolean): Promise<ReadingStatistics | null> {
  const books = await loadAllBooks(isActive);
  if (!books || !isActive()) return null;
  const completed = completedReadCount(books);
  const ids = new Set<number>();
  let reading = 0;
  let pages = 0;
  for (const book of books) {
    if (!Number.isSafeInteger(book.id) || book.id < 1 || ids.has(book.id)) {
      throw new Error('読書の概要を確認できません\n再度読み込んでください');
    }
    ids.add(book.id);
    const iterations = await getIterations(book.id);
    if (!isActive()) return null;
    if (
      !Array.isArray(iterations) || iterations.length !== book.latest_iteration ||
      iterations.some((iteration, index) => (
        !iteration || iteration.iteration_number !== index + 1 ||
        iteration.status !== (index === iterations.length - 1 ? book.reading_status : 'completed') ||
        !Number.isSafeInteger(iteration.current_page) || iteration.current_page < 0
      ))
    ) {
      throw new Error('読書の記録を確認できません\n再度読み込んでください');
    }
    if (book.reading_status === 'reading') reading += 1;
    for (const iteration of iterations) {
      pages += iteration.current_page;
      if (!Number.isSafeInteger(pages)) {
        throw new Error('読んだページ数を確認できません\n再度読み込んでください');
      }
    }
  }
  return { completed, reading, pages };
}

export function useReadingStatistics() {
  const [statistics, setStatistics] = useState<ReadingStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setStatistics(null);
    setError(null);
    loadReadingStatistics(() => active).then((value) => {
      if (active && value) setStatistics(value);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '読書の概要の取得に失敗しました');
    });
    return () => { active = false; };
  }, [version]);
  return { statistics, error, retry: () => setVersion((value) => value + 1) };
}
