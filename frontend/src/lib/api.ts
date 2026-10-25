import { authenticatedFetch } from "./auth";
import type { User } from "../types/user";
import { demoRequest } from "./demoApi";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type GoogleBook = {
  google_books_id: string;
  title: string;
  author: string | null;
  total_pages: number;
  isbn_13: string | null;
  thumbnail_url: string | null;
};

export type PopularBook = { book: GoogleBook; reader_count: number };

function isGoogleBook(value: unknown): value is GoogleBook {
  return typeof value === "object" && value !== null &&
    "google_books_id" in value && typeof value.google_books_id === "string" && !!value.google_books_id.trim() &&
    "title" in value && typeof value.title === "string" && !!value.title.trim() &&
    "author" in value && (value.author === null || typeof value.author === "string") &&
    "total_pages" in value && typeof value.total_pages === "number" && Number.isSafeInteger(value.total_pages) && value.total_pages > 0 &&
    "isbn_13" in value && (value.isbn_13 === null || typeof value.isbn_13 === "string") &&
    "thumbnail_url" in value && (value.thumbnail_url === null || typeof value.thumbnail_url === "string");
}

export type EmotionRecommendations = {
  items: GoogleBook[];
  status: "ready" | "needs_reviews" | "no_candidates";
  limit: number;
};

export async function getEmotionRecommendations(): Promise<EmotionRecommendations> {
  const response = await authenticatedFetch(`${API_URL}/catalog/books/recommendations?limit=5`);
  const payload = await parseResponse<EmotionRecommendations>(response, "おすすめの本の取得に失敗しました");
  if (
    !payload || payload.limit !== 5 || !Array.isArray(payload.items) || payload.items.length > 5 ||
    !["ready", "needs_reviews", "no_candidates"].includes(payload.status) ||
    (payload.status === "ready" ? payload.items.length === 0 : payload.items.length !== 0) ||
    !payload.items.every(isGoogleBook) ||
    new Set(payload.items.map((book) => book.google_books_id)).size !== payload.items.length
  ) {
    throw new Error("おすすめの本の応答形式が正しくありません");
  }
  return payload;
}

export async function getPopularBooks(): Promise<PopularBook[]> {
  const response = await authenticatedFetch(`${API_URL}/catalog/books/popular?limit=5`);
  const payload = await parseResponse<{ items: PopularBook[]; limit: number }>(
    response, "人気の本の取得に失敗しました",
  );
  if (
    !payload || payload.limit !== 5 || !Array.isArray(payload.items) || payload.items.length > 5 ||
    payload.items.some((item, index, items) => (
      !item || !Number.isSafeInteger(item.reader_count) || item.reader_count < 1 ||
      (index > 0 && item.reader_count > items[index - 1]!.reader_count) ||
      !isGoogleBook(item.book)
    )) ||
    new Set(payload.items.map((item) => item.book.google_books_id)).size !== payload.items.length
  ) {
    throw new Error("人気の本の応答形式が正しくありません");
  }
  return payload.items;
}

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
  last_read_at?: string | null;
  cover_style?: CoverStyle | null;
};

export type CoverStyle = {
  color_mode: "auto" | "palette" | "mine" | "others";
  palette: number | null;
  pattern: number | null;
};

export const AUTO_COVER: CoverStyle = { color_mode: "auto", palette: null, pattern: null };

export function isCoverStyle(value: unknown): value is CoverStyle {
  if (typeof value !== "object" || value === null ||
    !("color_mode" in value) || !("palette" in value) || !("pattern" in value)) return false;
  return typeof value.color_mode === "string" && ["auto", "palette", "mine", "others"].includes(value.color_mode) &&
    (value.color_mode === "palette"
      ? typeof value.palette === "number" && Number.isInteger(value.palette) && value.palette >= 0 && value.palette <= 7
      : value.palette === null) &&
    (value.pattern === null || typeof value.pattern === "number" && Number.isInteger(value.pattern) && value.pattern >= 0 && value.pattern <= 3);
}

function validateBookCover(book: Book): Book {
  if (book.cover_style != null && !isCoverStyle(book.cover_style)) {
    throw new Error("表紙の応答形式が正しくありません");
  }
  return book;
}

export async function saveBookCover(bookId: number, style: CoverStyle): Promise<CoverStyle> {
  if (!Number.isSafeInteger(bookId) || bookId < 1 || !isCoverStyle(style)) throw new Error("表紙の設定が正しくありません");
  const response = await authenticatedFetch(`${API_URL}/books/${bookId}/cover`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(style),
  });
  const result = await parseResponse<CoverStyle>(response, "表紙の保存に失敗しました");
  if (!isCoverStyle(result) || result.color_mode !== style.color_mode ||
    result.palette !== style.palette || result.pattern !== style.pattern) {
    throw new Error("表紙の応答形式が正しくありません");
  }
  return result;
}

export type BookMemo = { book_id: number; content: string };
export const BOOK_MEMO_LIMIT = 10_000;

async function requestBookMemo(bookId: number, content?: string): Promise<BookMemo> {
  if (!Number.isSafeInteger(bookId) || bookId < 1) throw new Error("本のIDが正しくありません");
  if (content !== undefined && Array.from(content).length > BOOK_MEMO_LIMIT) {
    throw new Error("メモは10,000文字以内で入力してください");
  }
  const response = await authenticatedFetch(`${API_URL}/books/${bookId}/memo`, content === undefined ? undefined : {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
  });
  const result = await parseResponse<BookMemo>(response, content === undefined
    ? "メモの取得に失敗しました" : "メモの保存に失敗しました");
  if (!result || result.book_id !== bookId || typeof result.content !== "string" ||
    Array.from(result.content).length > BOOK_MEMO_LIMIT ||
    (content !== undefined && result.content !== content)) {
    throw new Error("メモの応答形式が正しくありません");
  }
  return result;
}

export function getBookMemo(bookId: number): Promise<BookMemo> {
  return requestBookMemo(bookId);
}

export function saveBookMemo(bookId: number, content: string): Promise<BookMemo> {
  return requestBookMemo(bookId, content);
}

export type ReviewVisibility = "private" | "public";

export type PublicReview = {
  id: number;
  public_display_name: string;
  page_number: number;
  iteration_number: number;
  review_text: string;
  contains_spoilers: boolean;
  created_at: string;
  updated_at: string;
  color_code: string;
  analysis_status: "pending" | "completed" | "failed";
  source: "jev" | "mock" | null;
};

export type ReviewPageRange = { start: number; end: number };
export type ReactionKind = "empathy" | "insight" | "curious";
export type ReviewReactions = {
  review_id: number;
  counts: Record<ReactionKind, number>;
  my_reaction: ReactionKind | null;
};

async function requestReviewReactions(
  googleBooksId: string, reviewId: number, kind?: ReactionKind | null,
): Promise<ReviewReactions> {
  const changing = kind !== undefined;
  const response = await authenticatedFetch(
    `${API_URL}/catalog/books/${encodeURIComponent(googleBooksId)}/reviews/${reviewId}/${changing ? "reaction" : "reactions"}`,
    changing ? kind === null ? { method: "DELETE" } : {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    } : undefined,
  );
  const result = await parseResponse<ReviewReactions>(response, changing
    ? "リアクションの更新に失敗しました" : "リアクションの取得に失敗しました");
  const kinds: ReactionKind[] = ["empathy", "insight", "curious"];
  if (
    !result || result.review_id !== reviewId || !result.counts ||
    !kinds.every((value) => Number.isSafeInteger(result.counts[value]) && result.counts[value] >= 0) ||
    (result.my_reaction !== null && !kinds.includes(result.my_reaction)) ||
    (result.my_reaction !== null && result.counts[result.my_reaction] < 1) ||
    (changing && result.my_reaction !== kind)
  ) {
    throw new Error("リアクションの取得結果を確認できません\n再度読み込んでください");
  }
  return result;
}

export function getReviewReactions(googleBooksId: string, reviewId: number): Promise<ReviewReactions> {
  return requestReviewReactions(googleBooksId, reviewId);
}

export function setReviewReaction(
  googleBooksId: string, reviewId: number, kind: ReactionKind | null,
): Promise<ReviewReactions> {
  return requestReviewReactions(googleBooksId, reviewId, kind);
}

export type PublicReviewDistribution = {
  items: { page_number: number; review_count: number }[];
  total_count: number;
};

export async function getPublicReviewDistribution(googleBooksId: string): Promise<PublicReviewDistribution> {
  const response = await authenticatedFetch(
    `${API_URL}/catalog/books/${encodeURIComponent(googleBooksId)}/reviews/distribution`,
  );
  const result = await parseResponse<PublicReviewDistribution>(response, "しおりの分布の取得に失敗しました");
  if (
    !result || !Array.isArray(result.items) || !Number.isSafeInteger(result.total_count) || result.total_count < 0 ||
    !result.items.every((item, index, items) =>
      item && Number.isSafeInteger(item.page_number) && item.page_number > 0 &&
      Number.isSafeInteger(item.review_count) && item.review_count > 0 &&
      (index === 0 || item.page_number > items[index - 1]!.page_number)
    ) ||
    result.items.reduce((sum, item) => sum + item.review_count, 0) !== result.total_count
  ) {
    throw new Error("しおりの分布の取得結果を確認できません\n再度読み込んでください");
  }
  return result;
}

export type PublicReviews = {
  items: PublicReview[];
  limit: number;
  offset: number;
};

export async function getPublicReviews(googleBooksId: string, offset = 0, range?: ReviewPageRange): Promise<PublicReviews> {
  const params = new URLSearchParams({ limit: "20", offset: String(offset) });
  if (range) {
    params.set("page_start", String(range.start));
    params.set("page_end", String(range.end));
  }
  const response = await authenticatedFetch(
    `${API_URL}/catalog/books/${encodeURIComponent(googleBooksId)}/reviews?${params}`,
  );
  const result = await parseResponse<PublicReviews>(response, "公開感想の取得に失敗しました");
  if (
    !result || !Array.isArray(result.items) || result.limit !== 20 || result.offset !== offset ||
    !result.items.every((item) =>
      item && Number.isInteger(item.id) && item.id > 0 &&
      typeof item.public_display_name === "string" && item.public_display_name.trim().length > 0 &&
      Number.isInteger(item.page_number) && item.page_number > 0 &&
      Number.isInteger(item.iteration_number) && item.iteration_number > 0 &&
      typeof item.review_text === "string" && typeof item.contains_spoilers === "boolean" &&
      typeof item.color_code === "string" && /^#[0-9a-f]{6}$/i.test(item.color_code) &&
      ["pending", "completed", "failed"].includes(item.analysis_status) &&
      (item.source === null || item.source === "jev" || item.source === "mock") &&
      typeof item.created_at === "string" && typeof item.updated_at === "string"
    )
  ) {
    throw new Error("公開感想の取得結果を確認できません\n再度読み込んでください");
  }
  return result;
}

export type PublicProfile = {
  public_display_name: string | null;
};

export async function getPublicProfile(): Promise<PublicProfile> {
  const response = await authenticatedFetch(`${API_URL}/users/me/public-profile`);
  const result = await parseResponse<PublicProfile>(response, "名前の取得に失敗しました");
  if (!result || (result.public_display_name !== null && (
    typeof result.public_display_name !== "string" ||
    result.public_display_name.trim().length === 0 ||
    Array.from(result.public_display_name).length > 100
  ))) {
    throw new Error("名前の取得結果を確認できません\n再度読み込んでください");
  }
  return result;
}

export async function savePublicDisplayName(name: string): Promise<PublicProfile> {
  const response = await authenticatedFetch(`${API_URL}/users/me/public-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_display_name: name.trim() }),
  });
  const result = await parseResponse<PublicProfile>(response, "名前の保存に失敗しました");
  if (!result || result.public_display_name !== name.trim()) {
    throw new Error("名前の保存結果が一致しません\n再度確認してください");
  }
  return result;
}

export type PageReview = {
  id: number;
  book_id: number;
  page_number: number;
  review_text: string;
  color_code: string;
  created_at: string;
  updated_at: string;
  iteration_number: number;
  analysis_status: "pending" | "completed" | "failed";
  source: string | null;
  visibility: ReviewVisibility;
  contains_spoilers: boolean;
};

export type BookEmotions = {
  review_count: number;
  emotion_scores: Record<string, number>;
  color_code: string;
};

export type EmotionComparison = { mine: BookEmotions; others: BookEmotions };

export async function getEmotionComparison(bookId: number): Promise<EmotionComparison> {
  const response = await authenticatedFetch(`${API_URL}/books/${bookId}/emotions/comparison`);
  const result = await parseResponse<EmotionComparison>(response, "感情分析の取得に失敗しました");
  for (const summary of [result?.mine, result?.others]) {
    if (!summary || !Number.isSafeInteger(summary.review_count) || summary.review_count < 0 ||
      !/^#[0-9a-f]{6}$/i.test(summary.color_code) || !summary.emotion_scores ||
      (summary.review_count > 0 && ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'].some((key) => {
        const value = summary.emotion_scores[key];
        return typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1;
      }))) {
      throw new Error("感情分析の応答形式が正しくありません");
    }
  }
  return result;
}

export async function getBookEmotions(bookId: number): Promise<BookEmotions> {
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/emotions`,
  );
  return parseResponse<BookEmotions>(response, "感情分析の取得に失敗しました");
}

export function reviewAnalysisLabel(review: Pick<PageReview, "analysis_status" | "source">): string | undefined {
  if (review.analysis_status === "failed")
    return "感想は保存済み・色の取得に失敗しました";
  if (review.analysis_status === "pending") return "感想は保存済み・感想の色を準備中";
  if (review.source === "mock") return "感想の色（仮）";
  if (review.source === "jev") return undefined;
  return "感想の色を確認できません";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(
  response: Response,
  message: string,
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const isJson =
    mediaType === "application/json" ||
    (mediaType.startsWith("application/") && mediaType.endsWith("+json"));
  const context = `${response.url || API_URL} / HTTP ${response.status} / ${contentType || "Content-Typeなし"}`;
  if (__DEV__) {
    console.info(`[API] ${context}`);
  }

  if (!isJson) {
    const reason = response.status >= 500
      ? "APIサーバーでエラーが発生しました"
      : "JSONではない応答です\nAPI接続先を確認してください";
    throw new Error(
      `${message}：${reason}\n${context}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new Error(
      `${message}：応答をJSONとして読み取れませんでした\n\n${context}`,
    );
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? payload.detail
        : undefined;
    throw new ApiError(
      typeof detail === "string" ? detail : `${message} (${response.status})`,
      response.status,
    );
  }
  return payload as T;
}

export async function getUsers(): Promise<User[]> {
  const response = await authenticatedFetch(`${API_URL}/users`);
  return parseResponse<User[]>(response, "ユーザー一覧の取得に失敗しました");
}

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  const params = new URLSearchParams({ query, limit: "10" });
  const response = await authenticatedFetch(
    `${API_URL}/fetch?${params.toString()}`,
  );
  const payload = await parseResponse<{ items: GoogleBook[] }>(
    response,
    "書籍検索に失敗しました",
  );
  return payload.items;
}

export async function importGoogleBook(googleBooksId: string): Promise<Book> {
  const response = await authenticatedFetch(`${API_URL}/books/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ google_books_id: googleBooksId }),
  });
  return validateBookCover(await parseResponse<Book>(response, "本棚への追加に失敗しました"));
}

export async function getBooks(offset = 0): Promise<Book[]> {
  const response = await authenticatedFetch(
    `${API_URL}/books?limit=100&offset=${offset}`,
  );
  const payload = await parseResponse<{ items: Book[] }>(
    response,
    "本棚の取得に失敗しました",
  );
  return payload.items.map(validateBookCover);
}

export async function getBook(bookId: number): Promise<Book> {
  const response = await authenticatedFetch(`${API_URL}/books/${bookId}`);
  return validateBookCover(await parseResponse<Book>(response, "本の詳細の取得に失敗しました"));
}

export async function getContinueReadingBooks(): Promise<Book[]> {
  const response = await authenticatedFetch(`${API_URL}/books/continue-reading?limit=3`);
  const payload = await parseResponse<{ items: Book[]; limit: number; offset: number }>(
    response,
    "続きを読むの取得に失敗しました",
  );
  if (
    !payload || !Array.isArray(payload.items) || payload.limit !== 3 || payload.offset !== 0 ||
    payload.items.length > 3 || new Set(payload.items.map((book) => book?.id)).size !== payload.items.length ||
    payload.items.some((book) => (
      !book || !Number.isSafeInteger(book.id) || book.id < 1 ||
      typeof book.title !== "string" || !book.title.trim() ||
      (book.author !== null && typeof book.author !== "string") ||
      book.reading_status !== "reading" ||
      !Number.isSafeInteger(book.latest_iteration) || book.latest_iteration < 1 ||
      !Number.isSafeInteger(book.total_pages) || book.total_pages < 1 ||
      !Number.isSafeInteger(book.current_page) || book.current_page < 0 || book.current_page > book.total_pages ||
      (book.last_read_at !== null && (typeof book.last_read_at !== "string" || !Number.isFinite(Date.parse(book.last_read_at))))
    ))
  ) {
    throw new Error("続きを読むの応答形式が正しくありません");
  }
  return payload.items.map(validateBookCover);
}

export async function completeIteration(
  bookId: number,
  iteration: number,
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/iterations/${iteration}/complete`,
    { method: "POST" },
  );
  await parseResponse<unknown>(response, "読了の記録に失敗しました");
}

export async function startIteration(bookId: number): Promise<ReadingIteration> {
  const request = process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ? demoRequest : fetch;
  const response = await request(`${API_URL}/books/${bookId}/iterations`, { method: 'POST' });
  return parseResponse<ReadingIteration>(response, '再読の開始に失敗しました');
}

export type ReadingIteration = {
  iteration_number: number;
  status: string;
  current_page: number;
  started_at: string;
  completed_at: string | null;
};

export async function getIterations(
  bookId: number,
): Promise<ReadingIteration[]> {
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/iterations`,
  );
  return parseResponse<ReadingIteration[]>(
    response,
    "読書の記録の取得に失敗しました",
  );
}

export async function getPageReview(
  bookId: number,
  page: number,
  iteration: number,
): Promise<PageReview | null> {
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/pages/${page}/review?iteration=${iteration}`,
  );
  try {
    return await parseResponse<PageReview>(
      response,
      "しおりの取得に失敗しました",
    );
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
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/pages/${page}/review?iteration=${iteration}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_text: text.trim() }),
    },
  );
  return parseResponse<PageReview>(response, "しおりの保存に失敗しました");
}

export async function setReviewVisibility(
  bookId: number,
  page: number,
  iteration: number,
  visibility: ReviewVisibility,
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/pages/${page}/review/visibility?iteration=${iteration}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    },
  );
  const result = await parseResponse<{ visibility: ReviewVisibility }>(
    response, "公開設定の保存に失敗しました",
  );
  if (result.visibility !== visibility) {
    throw new Error("公開設定の保存結果が一致しません\n再試行してください");
  }

}

export async function setReviewSpoilers(
  bookId: number,
  page: number,
  iteration: number,
  containsSpoilers: boolean,
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/books/${bookId}/pages/${page}/review/spoilers?iteration=${iteration}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contains_spoilers: containsSpoilers }),
    },
  );
  const result = await parseResponse<{ contains_spoilers: boolean }>(
    response, "ネタバレ設定の保存に失敗しました",
  );
  if (result.contains_spoilers !== containsSpoilers) {
    throw new Error("ネタバレ設定の保存結果が一致しません\n再試行してください");
  }
}

export async function getBookReviews(
  bookId: number,
  iteration: number,
): Promise<PageReview[]> {
  const items: PageReview[] = [];
  let offset = 0;
  while (true) {
    const response = await authenticatedFetch(
      `${API_URL}/books/${bookId}/reviews?iteration=${iteration}&limit=100&offset=${offset}`,
    );
    const page = await parseResponse<PageReview[]>(
      response,
      "しおり一覧の取得に失敗しました",
    );
    items.push(...page);
    if (page.length < 100) return items;
    offset += page.length;
  }
}
