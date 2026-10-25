import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ActionButton } from '../../components/molecules/ActionButton';
import { ReviewReactionBar } from '../../components/molecules/ReviewReactionBar';
import { getBook, getPublicReviews, reviewAnalysisLabel, type Book, type PublicReview, type ReviewPageRange } from '../../lib/api';
import { colors } from '../../theme/colors';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; book: Book; items: PublicReview[]; offset: number; hasMore: boolean };

export function publicReviewHiddenReason(book: Book, review: PublicReview): string | null {
  const page = book.reading_status === 'completed' ? book.total_pages
    : book.reading_status === 'reading' ? book.current_page : null;
  if (page === null || !Number.isInteger(page) || page < 0 || page > book.total_pages) {
    return review.contains_spoilers ? 'ネタバレあり・読書位置が不明' : '読書位置が不明';
  }
  if (review.page_number > page) {
    return review.contains_spoilers ? 'ネタバレあり・未読ページ' : '未読ページ';
  }
  return review.contains_spoilers ? 'ネタバレあり' : null;
}

export function PublicReviewList({ bookId, range, compact = false, bookmarkLayout = false }: {
  bookId: number; range?: ReviewPageRange; compact?: boolean; bookmarkLayout?: boolean;
}) {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [listPage, setListPage] = useState(0);

  useEffect(() => {
    const request = ++epoch.current;
    locked.current = false;
    setState({ status: 'loading' });
    setRevealed([]);
    setPanelOpen(false);
    setListPage(0);
    setLoadingMore(false);
    setMoreError(null);
    async function load() {
      try {
        const book = await getBook(bookId);
        if (epoch.current !== request) return;
        if (!book.google_books_id) {
          setState({ status: 'ready', book, items: [], offset: 0, hasMore: false });
          return;
        }
        const result = range
          ? await getPublicReviews(book.google_books_id, 0, range)
          : await getPublicReviews(book.google_books_id);
        if (epoch.current !== request) return;
        setState({ status: 'ready', book, items: result.items, offset: result.items.length, hasMore: result.items.length === result.limit });
      } catch (reason: unknown) {
        if (epoch.current === request) {
          setState({ status: 'error', message: reason instanceof Error ? reason.message : '公開感想の取得に失敗しました。' });
        }
      }
    }
    void load();
    return () => { epoch.current += 1; };
  }, [bookId, version, range?.start, range?.end]);

  function refresh() {
    epoch.current += 1;
    setState({ status: 'loading' });
    setRevealed([]);
    setVersion((value) => value + 1);
  }

  async function loadMore() {
    if (locked.current || state.status !== 'ready' || !state.hasMore || !state.book.google_books_id) return;
    locked.current = true;
    const request = epoch.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await getPublicReviews(state.book.google_books_id, state.offset, range);
      if (epoch.current !== request) return;
      setState((current) => {
        if (current.status !== 'ready') return current;
        const existing = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          items: [...current.items, ...result.items.filter((item) => !existing.has(item.id))],
          offset: result.offset + result.items.length,
          hasMore: result.items.length === result.limit,
        };
      });
    } catch (reason: unknown) {
      if (epoch.current === request) {
        setMoreError(reason instanceof Error ? reason.message : '公開感想の追加取得に失敗しました。');
      }
    } finally {
      if (epoch.current === request) {
        locked.current = false;
        setLoadingMore(false);
      }
    }
  }

  const cards = (preview: boolean) => state.status === 'ready' && state.items.slice(bookmarkLayout ? listPage * 5 : 0, bookmarkLayout ? listPage * 5 + 5 : preview ? 1 : undefined).map((review) => {
    const reason = publicReviewHiddenReason(state.book, review);
    const hidden = reason !== null && (preview || !revealed.includes(review.id));
    return (
      <GlassSurface key={review.id} style={[styles.card, bookmarkLayout && styles.bookmarkCard]}>
        {bookmarkLayout && <View style={[styles.bookmarkSwatch, { backgroundColor: hidden ? colors.borderMuted : review.color_code }]} />}
        <View style={bookmarkLayout ? styles.bookmarkText : styles.reviewContent}>
        <View style={styles.author}>
          {!bookmarkLayout && <View accessibilityRole="image" accessibilityLabel="本のデフォルトアイコン" style={styles.avatar}>
            <Ionicons accessible={false} name="book-outline" size={24} color={colors.navAccent} />
          </View>}
          <Text style={styles.name}>{review.public_display_name}</Text>
        </View>
        <Text style={styles.description}>{review.page_number}ページ · {review.iteration_number}回目の読書</Text>
        <Text style={review.contains_spoilers ? styles.spoilerLabel : styles.description}>{review.contains_spoilers ? 'ネタバレあり' : 'ネタバレなし'}</Text>
        {hidden ? (
          <>
            {!review.contains_spoilers && <Text style={styles.description}>{reason}</Text>}
            {!preview && <ActionButton label="この感想を表示する" secondary onPress={() => setRevealed((current) => [...current, review.id])} />}
          </>
        ) : (
          <>
            <View style={styles.emotion}>
              {!bookmarkLayout && <View accessibilityRole="image" accessibilityLabel="感想の色" style={[styles.swatch, { backgroundColor: review.color_code }]} />}
              {reviewAnalysisLabel(review) && <Text style={styles.description}>{reviewAnalysisLabel(review)}</Text>}
            </View>
            <Text numberOfLines={preview ? 3 : undefined} style={styles.body}>{review.review_text}</Text>
            {!preview && state.book.google_books_id && <ReviewReactionBar googleBooksId={state.book.google_books_id} reviewId={review.id} />}
            {!preview && reason !== null && <ActionButton label="この感想を隠す" secondary onPress={() => setRevealed((current) => current.filter((id) => id !== review.id))} />}
          </>
        )}
        </View>
      </GlassSurface>
    );
  });
  const pagination = (
    <>
      {moreError && <Text accessibilityRole="alert" style={styles.error}>{moreError}</Text>}
      {state.status === 'ready' && state.hasMore && <ActionButton label={loadingMore ? '読み込み中…' : moreError ? '追加の読み込みを再試行' : 'さらに読み込む'} disabled={loadingMore} onPress={() => { void loadMore(); }} />}
    </>
  );
  if (compact && state.status === 'ready' && state.items.length > 0) {
    return (
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="このページ範囲の感想一覧を開く" onPress={() => setPanelOpen(true)}>
          <Text style={styles.description}>最新の感想</Text>
          {cards(true)}
          <Text style={styles.description}>すべての感想を見る ›</Text>
        </Pressable>
        {panelOpen && <Modal visible transparent animationType="slide" onRequestClose={() => { setPanelOpen(false); setRevealed([]); }}>
          <View style={styles.overlay}>
            <View accessibilityViewIsModal style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.name}>{range?.start === range?.end ? `${range?.start}ページ` : `${range?.start}〜${range?.end}ページ`}のしおり</Text>
                <ActionButton label="閉じる" secondary onPress={() => { setPanelOpen(false); setRevealed([]); }} />
              </View>
              <ScrollView contentContainerStyle={styles.panelContent}>
                <Text style={styles.description}>自分を含む・更新順</Text>
                {cards(false)}
                {pagination}
              </ScrollView>
            </View>
          </View>
        </Modal>}
      </View>
    );
  }
  return (
      <View style={styles.content}>
        {state.status === 'loading' && <Text style={styles.description}>公開感想を読み込んでいます…</Text>}
        {state.status === 'error' && (
          <>
            <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
            <ActionButton label="読み込みを再試行" onPress={refresh} />
          </>
        )}
        {state.status === 'ready' && (
          <>
            {!compact && !bookmarkLayout && <ActionButton label="最新の情報に更新" onPress={refresh} secondary />}
            {!state.book.google_books_id ? (
              <Text style={styles.description}>手動登録の本は公開感想の一覧に対応していません。</Text>
            ) : state.items.length === 0 ? (
              <Text style={styles.description}>{range ? 'この範囲には公開感想がありません。' : '公開感想はまだありません。'}</Text>
            ) : null}
            {cards(false)}
            {bookmarkLayout && state.items.length > 0 && (
              <View style={styles.pageControls}>
                <Pressable accessibilityRole="button" disabled={listPage === 0} accessibilityState={{ disabled: listPage === 0 }} style={styles.pageButton} onPress={() => setListPage((page) => page - 1)}><Text>前へ</Text></Pressable>
                <Text accessibilityLiveRegion="polite">{listPage + 1}/{Math.max(1, Math.ceil(state.items.length / 5))}</Text>
                <Pressable accessibilityRole="button" disabled={(listPage + 1) * 5 >= state.items.length} accessibilityState={{ disabled: (listPage + 1) * 5 >= state.items.length }} style={styles.pageButton} onPress={() => setListPage((page) => page + 1)}><Text>次へ</Text></Pressable>
              </View>
            )}
            {pagination}
          </>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  reviewContent: { gap: 12 },
  bookmarkCard: { flexDirection: 'row', padding: 0, borderRadius: 0, backgroundColor: 'transparent', gap: 12, marginTop: 18 },
  bookmarkSwatch: { width: 14, minHeight: 48, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 },
  bookmarkText: { flex: 1, gap: 6 },
  pageControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageButton: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  panel: { height: '80%', backgroundColor: colors.backgroundSoft, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  panelHeader: { gap: 12, paddingBottom: 16 },
  panelContent: { gap: 16, paddingBottom: 40 },
  content: { gap: 16 },
  emotion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  spoilerLabel: { color: colors.text, fontSize: 14, lineHeight: 22, fontWeight: '700' },
  card: { padding: 18, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.48)', gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0EAF2', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16, lineHeight: 26 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
