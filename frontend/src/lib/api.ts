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

export type PageReview = {
  id: number;
  book_id: number;
  page_number: number;
  review_text: string;
  color_code: string;
  created_at: string;
  updated_at: string;
  iteration_number: number;
  analysis_status: 'pending' | 'completed' | 'failed';
  source: string | null;
};

export function reviewAnalysisLabel(review: PageReview): string {
  if (review.analysis_status === 'failed') return '感想は保存済み・AI解析に失敗しました';
  if (review.analysis_status === 'pending') return '感想は保存済み・解析待ち';
  if (review.source === 'mock') return 'AI未接続・仮の色';
  if (review.source === 'jev') return 'AIが決めた色';
  return '解析結果を確認できません';
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

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
    throw new ApiError(typeof detail === 'string' ? detail : `${message} (${response.status})`, response.status);
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

export async function getPageReview(bookId: number, page: number, iteration: number): Promise<PageReview | null> {
  const response = await fetch(`${API_URL}/books/${bookId}/pages/${page}/review?iteration=${iteration}`);
  try {
    return await parseResponse<PageReview>(response, 'しおりの取得に失敗しました');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function savePageReview(
  bookId: number,
  page: number,
  iteration: number,
  text: string,
): Promise<PageReview> {
  const response = await fetch(`${API_URL}/books/${bookId}/pages/${page}/review?iteration=${iteration}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_text: text.trim() }),
  });
  return parseResponse<PageReview>(response, 'しおりの保存に失敗しました');
}

export async function getBookReviews(bookId: number, iteration: number): Promise<PageReview[]> {
  const items: PageReview[] = [];
  let offset = 0;
  while (true) {
    const response = await fetch(`${API_URL}/books/${bookId}/reviews?iteration=${iteration}&limit=100&offset=${offset}`);
    const page = await parseResponse<PageReview[]>(response, 'しおり一覧の取得に失敗しました');
    items.push(...page);
    if (page.length < 100) return items;
    offset += page.length;
  }
}
