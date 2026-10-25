import type { User } from '../types/user';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export type GoogleBook = {
  google_books_id: string;
  title: string;
  author: string | null;
  total_pages: number;
  isbn_13: string | null;
  thumbnail_url: string | null;
};

export type Book = {
  id: number;
  title: string;
  author: string | null;
  total_pages: number;
  created_at: string;
  google_books_id: string | null;
  isbn_13: string | null;
  thumbnail_url: string | null;
  latest_iteration: number;
  reading_status: string;
  current_page: number;
  started_at: string | null;
  completed_at: string | null;
};

export type ReadingIteration = {
  iteration_number: number;
  status: string;
  current_page: number;
  started_at: string;
  completed_at: string | null;
};

export type PagePopularity = {
  page_number: number;
  user_count: number;
};

export type PageReview = {
  id: number;
  book_id: number;
  page_number: number;
  review_text: string;
  color_code: string;
  created_at: string;
  updated_at: string;
  iteration_number: number;
};

async function parseResponse<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `${message} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`);
  return parseResponse<User[]>(response, 'ユーザー一覧の取得に失敗しました');
}

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  const params = new URLSearchParams({ query, limit: '10' });
  const response = await fetch(`${API_URL}/fetch?${params.toString()}`);
  const payload = await parseResponse<{ items: GoogleBook[] }>(
    response,
    '書籍検索に失敗しました',
  );
  return payload.items;
}

export async function importGoogleBook(googleBooksId: string): Promise<Book> {
  const response = await fetch(`${API_URL}/books/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_books_id: googleBooksId }),
  });
  return parseResponse<Book>(response, '本棚への追加に失敗しました');
}

export async function getBooks(): Promise<Book[]> {
  const response = await fetch(`${API_URL}/books?limit=100&offset=0`);
  const payload = await parseResponse<{ items: Book[] }>(
    response,
    '本棚の取得に失敗しました',
  );
  return payload.items;
}

export async function getBook(bookId: number): Promise<Book> {
  const response = await fetch(`${API_URL}/books/${bookId}`);
  return parseResponse<Book>(response, '本の取得に失敗しました');
}

export async function getReadingIterations(bookId: number): Promise<ReadingIteration[]> {
  const response = await fetch(`${API_URL}/books/${bookId}/iterations`);
  return parseResponse<ReadingIteration[]>(response, '読書回の取得に失敗しました');
}

export async function startReadingIteration(bookId: number): Promise<ReadingIteration> {
  const response = await fetch(`${API_URL}/books/${bookId}/iterations`, { method: 'POST' });
  return parseResponse<ReadingIteration>(response, '再読の開始に失敗しました');
}

export async function completeReadingIteration(
  bookId: number,
  iterationNumber: number,
): Promise<ReadingIteration> {
  const response = await fetch(
    `${API_URL}/books/${bookId}/iterations/${iterationNumber}/complete`,
    { method: 'POST' },
  );
  return parseResponse<ReadingIteration>(response, '読了の記録に失敗しました');
}

export async function getPagePopularity(bookId: number): Promise<PagePopularity[]> {
  const response = await fetch(`${API_URL}/books/${bookId}/page-popularity`);
  const payload = await parseResponse<{ items: PagePopularity[] }>(
    response,
    'ページ別の感想数の取得に失敗しました',
  );
  return payload.items;
}

export async function savePageReview(
  bookId: number,
  iterationNumber: number,
  pageNumber: number,
  reviewText: string,
): Promise<PageReview> {
  const params = new URLSearchParams({ iteration: String(iterationNumber) });
  const response = await fetch(
    `${API_URL}/books/${bookId}/pages/${pageNumber}/review?${params.toString()}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_text: reviewText }),
    },
  );
  return parseResponse<PageReview>(response, 'しおりの追加に失敗しました');
}
