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
