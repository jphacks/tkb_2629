import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BookmarkTimeline } from '../molecules/BookmarkTimeline';

import { ActionButton } from '../molecules/ActionButton';
import { getBook, getPublicReviewDistribution, type Book, type PublicReviewDistribution, type ReviewPageRange } from '../../lib/api';
import { reviewBins } from '../../lib/reviewDistribution';
import { PublicReviewList } from './PublicReviewList';
import { colors } from '../../theme/colors';

type DistributionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; book: Book; distribution: PublicReviewDistribution };

export function CommunityBookmarks({ bookId, initialPage }: { bookId: number; initialPage?: number }) {
  const [state, setState] = useState<DistributionState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<ReviewPageRange | null>(initialPage ? { start: initialPage, end: initialPage } : null);
  const [pageInput, setPageInput] = useState(initialPage ? String(initialPage) : '');
  const [pageError, setPageError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    async function load() {
      try {
        const book = await getBook(bookId);
        if (!active) return;
        if (!book.google_books_id) {
          setState({ status: 'ready', book, distribution: { items: [], total_count: 0 } });
          return;
        }
        const distribution = await getPublicReviewDistribution(book.google_books_id);
        reviewBins(book.total_pages, 1, distribution);
        if (active) setState({ status: 'ready', book, distribution });
      } catch (reason: unknown) {
        if (active) setState({ status: 'error', message: reason instanceof Error ? reason.message : 'しおりの分布の取得に失敗しました。' });
      }
    }
    void load();
    return () => { active = false; };
  }, [bookId, version]);

  function refresh() {
    setState({ status: 'loading' });
    setVersion((value) => value + 1);
  }

  const bookmarks = state.status === 'ready' ? state.distribution.items.map((point) => ({
    id: String(point.page_number), page: point.page_number, position: 0,
    count: point.review_count, title: `${point.page_number}ページ`, note: '', date: '', author: '',
  })) : [];

  return (
    <View style={styles.content}>
      {state.status === 'loading' && <Text style={styles.description}>しおりの分布を読み込んでいます…</Text>}
      {state.status === 'error' && (
        <>
          <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
          <ActionButton label="分布の読み込みを再試行" onPress={refresh} />
        </>
      )}
      {state.status === 'ready' && (
        !state.book.google_books_id ? <Text style={styles.description}>手動登録の本はみんなのしおりに対応していません。</Text> : (
          <>
            <Text style={styles.heading}><Text style={styles.pageNumber}>{state.distribution.total_count}</Text>件の公開しおり</Text>
            <View style={styles.searchGroup}>
            <View style={styles.pageSearch}>
              <View style={styles.pageEntry}>
                <TextInput accessibilityLabel="感想を探すページ番号" value={pageInput} onChangeText={(value) => { setPageInput(value); setPageError(null); }} keyboardType="number-pad" placeholder="ページ番号" style={styles.pageInput} />
              </View>
              <Text style={styles.description}>ページの</Text>
              <View style={styles.searchAction}>
                <ActionButton label="感想を読む" secondary onPress={() => {
                  const value = Number(pageInput);
                  if (!/^\d+$/.test(pageInput) || !Number.isSafeInteger(value) || value < 1 || value > state.book.total_pages) {
                    setPageError(`1〜${state.book.total_pages}の整数を入力してください。`);
                    return;
                  }
                  setPageError(null);
                  setSelected({ start: value, end: value });
                }} />
              </View>
            </View>
            {pageError && <Text accessibilityRole="alert" style={styles.error}>{pageError}</Text>}
            </View>
            <BookmarkTimeline currentPage={state.book.total_pages} bookmarks={bookmarks}
              accessibilityLabel="みんなのしおりの数直線"
              selectedBookmark={selected?.start === selected?.end ? bookmarks.find((item) => item.page === selected?.start) : undefined}
              onSelect={(id) => { const page = Number(id); setPageInput(id); setSelected({ start: page, end: page }); }} />
            {state.distribution.total_count === 0 && <Text style={styles.description}>公開しおりはまだありません。</Text>}
            {selected && (
              <ActionButton label="全ページのしおりを表示" secondary onPress={() => { setSelected(null); setPageInput(''); }} />
            )}
            <PublicReviewList key={`${version}:${selected?.start ?? 'all'}:${selected?.end ?? 'all'}`}
              bookId={bookId} range={selected ?? undefined} bookmarkLayout />
          </>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, marginTop: 20 },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pageNumber: { fontSize: 20 },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  pageSearch: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchGroup: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#D8D2E2', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.5)' },
  pageEntry: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageInput: { flex: 1, minWidth: 40, minHeight: 54, borderWidth: 1, borderColor: '#C5C0CE', borderRadius: 10, padding: 8, color: colors.text, backgroundColor: colors.background, textAlign: 'center' },
  searchAction: { flex: 1 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
