import type { Book, BookEmotions, CoverStyle, PageReview, PublicReview, ReadingIteration, ReactionKind, ReviewReactions } from './api';
import { demoBook, demoBookmarks } from '../screens/demo/demoData';

export const demoUser = { id: 1, name: '体験ユーザー', email: 'demo@example.invalid' };
const date = '2026-10-01T00:00:00Z';
const books: Book[] = [
  { id: 1, title: demoBook.title, author: demoBook.author, total_pages: 200,
    created_at: date, google_books_id: 'demo-library', isbn_13: null, thumbnail_url: null,
    latest_iteration: 1, reading_status: 'reading', current_page: 96, started_at: date,
    completed_at: null, last_read_at: date, cover_style: null },
  { id: 2, title: '星を拾う帰り道', author: 'Re:Read デモ作品', total_pages: 160,
    created_at: date, google_books_id: 'demo-stars', isbn_13: null, thumbnail_url: null,
    latest_iteration: 1, reading_status: 'completed', current_page: 160, started_at: date,
    completed_at: date, last_read_at: date, cover_style: null },
];
const iterations = new Map<number, ReadingIteration[]>(books.map(book => [book.id, [{
  iteration_number: 1, status: book.reading_status, current_page: book.current_page,
  started_at: date, completed_at: book.completed_at,
}]]));
let nextReviewId = 10;
const reviews: PageReview[] = demoBookmarks.mine.filter(item => item.page <= 96).map((item, index) => ({
  id: index + 1, book_id: 1, page_number: item.page, review_text: item.content,
  color_code: item.color, created_at: date, updated_at: date, iteration_number: 1,
  analysis_status: 'completed', source: 'mock', visibility: 'private', contains_spoilers: false,
}));
const publicReviews: PublicReview[] = demoBookmarks.others.map((item, index) => ({
  id: index + 100, public_display_name: `サンプル読者${index + 1}`, page_number: item.page,
  iteration_number: 1, review_text: item.content, color_code: item.color, contains_spoilers: false,
  created_at: date, updated_at: date, analysis_status: 'completed', source: 'mock',
}));
const memos = new Map<number, string>();
const reactions = new Map<number, ReactionKind>();
let displayName = '体験ユーザー';

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
function summary(items: readonly { color_code: string }[], others = false): BookEmotions {
  return {
    review_count: items.length,
    emotion_scores: others
      ? { joy: 0.1, trust: 0.4, fear: 0.02, surprise: 0.2, sadness: 0.05, disgust: 0.01, anger: 0.02, anticipation: 0.2 }
      : { joy: 0.3, trust: 0.15, fear: 0.05, surprise: 0.1, sadness: 0.2, disgust: 0.02, anger: 0.03, anticipation: 0.15 },
    color_code: items.at(-1)?.color_code ?? '#808080',
  };
}

export async function demoRequest(input: string, init: RequestInit = {}): Promise<Response> {
  if (process.env.EXPO_PUBLIC_DEMO_MODE !== 'true') throw new Error('デモAPIはデモモードでのみ利用できます');
  const url = new URL(input);
  const path = url.pathname;
  const method = init.method ?? 'GET';
  const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : {};
  const field = (name: string): unknown => typeof body === 'object' && body !== null && name in body
    ? Reflect.get(body, name) : undefined;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? 100);
  const catalog = books.map(book => ({
    google_books_id: book.google_books_id!, title: book.title, author: book.author,
    total_pages: book.total_pages, isbn_13: null, thumbnail_url: null,
  }));

  if (path === '/books' && method === 'GET') return response({ items: books.slice(offset, offset + limit) });
  if (path === '/books/continue-reading' && method === 'GET') {
    return response({ items: books.filter(book => book.reading_status === 'reading').slice(0, 3), limit: 3, offset: 0 });
  }
  if (path === '/fetch' && method === 'GET') {
    const query = url.searchParams.get('query')?.trim() ?? '';
    return response({ items: catalog.filter(book => !query || book.title.includes(query) || book.author?.includes(query)) });
  }
  if (path === '/catalog/books/popular' && method === 'GET') return response({ items: catalog.map(book => ({ book, reader_count: 3 })), limit: 5 });
  if (path === '/catalog/books/recommendations' && method === 'GET') return response({ items: [], status: 'no_candidates', limit: 5 });
  if (path === '/books/import' && method === 'POST') {
    const book = books.find(item => item.google_books_id === field('google_books_id'));
    return book ? response(book) : response({ detail: '体験デモではサンプルの本のみ利用できます' }, 400);
  }
  if (path === '/users/me/public-profile') {
    if (method === 'PUT') {
      const name = field('public_display_name');
      if (typeof name !== 'string' || !name.trim() || Array.from(name.trim()).length > 100) return response({ detail: '名前は1〜100文字で入力してください' }, 422);
      displayName = name.trim();
    }
    if (method === 'GET' || method === 'PUT') return response({ public_display_name: displayName });
  }
  const publicMatch = path.match(/^\/catalog\/books\/([^/]+)\/reviews(?:\/(distribution|\d+\/reactions?))?$/);
  if (publicMatch) {
    const book = books.find(item => item.google_books_id === decodeURIComponent(publicMatch[1]!));
    if (!book) return response({ detail: '本が見つかりません' }, 404);
    const items = book.id === 1 ? publicReviews : [];
    if (publicMatch[2] === 'distribution' && method === 'GET') {
      return response({ items: items.map(item => ({ page_number: item.page_number, review_count: 1 })), total_count: items.length });
    }
    if (publicMatch[2] && publicMatch[2] !== 'distribution') {
      const id = Number(publicMatch[2].split('/')[0]);
      if (!items.some(item => item.id === id)) return response({ detail: '栞が見つかりません' }, 404);
      if (method === 'PUT') {
        const kind = field('kind');
        if (kind !== 'empathy' && kind !== 'insight' && kind !== 'curious') return response({ detail: 'リアクションが不正です' }, 422);
        reactions.set(id, kind);
      } else if (method === 'DELETE') reactions.delete(id);
      const kind = reactions.get(id) ?? null;
      const result: ReviewReactions = { review_id: id, my_reaction: kind, counts: {
        empathy: kind === 'empathy' ? 1 : 0, insight: kind === 'insight' ? 1 : 0, curious: kind === 'curious' ? 1 : 0,
      } };
      return response(result);
    }
    if (!publicMatch[2] && method === 'GET') {
      const start = Number(url.searchParams.get('page_start') ?? 1);
      const end = Number(url.searchParams.get('page_end') ?? book.total_pages);
      return response({ items: items.filter(item => item.page_number >= start && item.page_number <= end).slice(offset, offset + limit), limit, offset });
    }
  }
  const match = path.match(/^\/books\/(\d+)(.*)$/);
  if (match) {
    const id = Number(match[1]);
    const book = books.find(item => item.id === id);
    if (!book) return response({ detail: '本が見つかりません' }, 404);
    const tail = match[2];
    const iteration = Number(url.searchParams.get('iteration') ?? book.latest_iteration);
    const history = iterations.get(id)!;
    const current = history.find(item => item.iteration_number === iteration);
    const ownReviews = reviews.filter(item => item.book_id === id && item.iteration_number === iteration);
    if (tail === '' && method === 'GET') return response(book);
    if (tail === '/iterations' && method === 'GET') return response(history);
    if (tail === '/iterations' && method === 'POST') {
      if (book.reading_status === 'reading') return response({ detail: 'すでに読書中です' }, 409);
      const next: ReadingIteration = { iteration_number: ++book.latest_iteration, status: 'reading', current_page: 0, started_at: date, completed_at: null };
      history.push(next);
      Object.assign(book, { reading_status: 'reading', current_page: 0, started_at: date, completed_at: null });
      return response(next);
    }
    const complete = tail?.match(/^\/iterations\/(\d+)\/complete$/);
    if (complete && method === 'POST') {
      const target = history.find(item => item.iteration_number === Number(complete[1]));
      if (!target || target.status !== 'reading') return response({ detail: '読了済みです' }, 409);
      Object.assign(target, { status: 'completed', current_page: book.total_pages, completed_at: date });
      Object.assign(book, { reading_status: 'completed', current_page: book.total_pages, completed_at: date });
      return response({ message: '読了を記録しました' });
    }
    if (tail === '/memo' && (method === 'GET' || method === 'PUT')) {
      if (method === 'PUT') {
        const content = field('content');
        if (typeof content !== 'string' || Array.from(content).length > 10000) return response({ detail: 'メモは10,000文字以内で入力してください' }, 422);
        memos.set(id, content);
      }
      return response({ book_id: id, content: memos.get(id) ?? '' });
    }
    if (tail === '/cover' && method === 'PUT') {
      const mode = field('color_mode'), palette = field('palette'), pattern = field('pattern');
      if ((mode !== 'auto' && mode !== 'palette' && mode !== 'mine' && mode !== 'others') ||
        !(pattern === null || typeof pattern === 'number' && Number.isInteger(pattern) && pattern >= 0 && pattern <= 3) ||
        (mode === 'palette' ? !(typeof palette === 'number' && Number.isInteger(palette) && palette >= 0 && palette <= 7) : palette !== null)) {
        return response({ detail: '表紙の設定が不正です' }, 422);
      }
      const style: CoverStyle = { color_mode: mode, palette: typeof palette === 'number' ? palette : null, pattern };
      book.cover_style = style;
      return response(style);
    }
    if (tail === '/reviews' && method === 'GET') return response(ownReviews.slice(offset, offset + limit));
    if (tail === '/emotions' && method === 'GET') return response(summary(ownReviews));
    if (tail === '/emotions/comparison' && method === 'GET') return response({
      mine: summary(ownReviews), others: summary(id === 1 ? publicReviews : [], true),
    });
    const pageMatch = tail?.match(/^\/pages\/(\d+)\/review(?:\/(visibility|spoilers))?$/);
    if (pageMatch) {
      const page = Number(pageMatch[1]);
      if (!current || page < 1 || page > book.total_pages) return response({ detail: 'ページまたは読書回が不正です' }, 422);
      let review = ownReviews.find(item => item.page_number === page);
      if (!pageMatch[2] && method === 'GET') return review ? response(review) : response({ detail: '栞がありません' }, 404);
      if (current.status !== 'reading') return response({ detail: '読了した回は編集できません' }, 409);
      if (!pageMatch[2] && method === 'PUT') {
        const text = field('review_text');
        if (typeof text !== 'string' || !text.trim() || Array.from(text.trim()).length > 140) return response({ detail: '感想は1〜140文字で入力してください' }, 422);
        if (!review) {
          review = { id: nextReviewId++, book_id: id, page_number: page, iteration_number: iteration,
            review_text: '', color_code: '#C17AED', created_at: date, updated_at: date,
            analysis_status: 'completed', source: 'mock', visibility: 'private', contains_spoilers: true };
          reviews.push(review);
        }
        Object.assign(review, { review_text: text.trim(), color_code: '#C17AED', source: 'mock' });
        current.current_page = Math.max(current.current_page, page);
        book.current_page = current.current_page;
        book.last_read_at = date;
        return response(review);
      }
      if (review && method === 'PATCH' && pageMatch[2] === 'visibility') {
        const visibility = field('visibility');
        if (visibility !== 'private' && visibility !== 'public') return response({ detail: '公開設定が不正です' }, 422);
        review.visibility = visibility;
        return response({ visibility });
      }
      if (review && method === 'PATCH' && pageMatch[2] === 'spoilers') {
        const containsSpoilers = field('contains_spoilers');
        if (typeof containsSpoilers !== 'boolean') return response({ detail: 'ネタバレ設定が不正です' }, 422);
        review.contains_spoilers = containsSpoilers;
        return response({ contains_spoilers: containsSpoilers });
      }
    }
  }
  return response({ detail: `体験デモではこの操作に対応していません（${method} ${path}）` }, 501);
}
