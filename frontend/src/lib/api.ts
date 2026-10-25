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

async function parseResponse<T>(response: Response, message: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const isJson = mediaType === 'application/json' || (
    mediaType.startsWith('application/') && mediaType.endsWith('+json')
  );
  const context = `${response.url || API_URL} / HTTP ${response.status} / ${contentType || 'Content-Typeなし'}`;
  if (__DEV__) {
    console.info(`[API] ${context}`);
  }

  if (!isJson) {
    throw new Error(`${message}：JSONではない応答です。API接続先を確認してください。\n${context}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new Error(`${message}：応答をJSONとして読み取れませんでした。\n${context}`);
  }

  if (!response.ok) {
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? payload.detail
      : undefined;
    throw new Error(typeof detail === 'string' ? detail : `${message} (${response.status})`);
  }
  return payload as T;
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

export async function getBooks(offset = 0): Promise<Book[]> {
  const response = await fetch(`${API_URL}/books?limit=100&offset=${offset}`);
  const payload = await parseResponse<{ items: Book[] }>(
    response,
    '本棚の取得に失敗しました',
  );
  return payload.items;
}

export async function getBook(bookId: number): Promise<Book> {
  const response = await fetch(`${API_URL}/books/${bookId}`);
  return parseResponse<Book>(response, '本の詳細の取得に失敗しました');
}
