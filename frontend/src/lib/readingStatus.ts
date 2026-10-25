import type { Book, ReadingIteration } from './api';

export function completedReadCount(books: Book[]): number {
  return books.reduce((total, book) => {
    if (
      !Number.isSafeInteger(book.latest_iteration) || book.latest_iteration < 1 ||
      !['reading', 'completed'].includes(book.reading_status)
    ) {
      throw new Error('読了冊数を確認できません\n再度読み込んでください');
    }
    const count = total + book.latest_iteration - (book.reading_status === 'reading' ? 1 : 0);
    if (!Number.isSafeInteger(count)) {
      throw new Error('読了冊数を確認できません\n再度読み込んでください');
    }
    return count;
  }, 0);
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

// One-line status of a book already on the user's shelf, shown on search results.
export function shelfStatusLabel(book: Book): string {
  const iteration = book.latest_iteration;
  const reading = book.reading_status === 'reading';
  if (iteration <= 1) {
    if (reading) {
      const started = formatDate(book.started_at);
      return started ? `${started} 追加・読書中` : '本棚に追加済み・読書中';
    }
    const completed = formatDate(book.completed_at);
    return completed ? `${completed} 読了` : '読了';
  }
  if (reading) return `${iteration}回目を読書中（これまで${iteration - 1}回読了）`;
  const completed = formatDate(book.completed_at);
  return completed ? `${iteration}回読了・最終 ${completed}` : `${iteration}回読了`;
}

export function iterationLabel(iteration: ReadingIteration): string {
  const started = formatDate(iteration.started_at) ?? '';
  if (iteration.status === 'completed') {
    return `${started}〜${formatDate(iteration.completed_at) ?? ''} 読了`;
  }
  return `${started}〜 読書中`;
}
