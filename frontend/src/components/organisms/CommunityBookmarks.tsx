import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

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

  const bins = state.status === 'ready' && state.book.google_books_id
    ? reviewBins(state.book.total_pages, 10, state.distribution, true) : [];
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  const points = bins.map((bin, index) => ({ x: (index + 0.5) * 300 / bins.length, y: 90 - bin.count / maxCount * 68 }));
  let curve = 'M 0 90';
  let previous = { x: 0, y: 90 };
  for (const point of [...points, { x: 300, y: 90 }]) {
    const middle = (previous.x + point.x) / 2;
    curve += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
    previous = point;
  }
  const readPage = state.status !== 'ready' ? null
    : state.book.reading_status === 'completed' ? state.book.total_pages
    : state.book.reading_status === 'reading' && Number.isInteger(state.book.current_page) && state.book.current_page >= 0 && state.book.current_page <= state.book.total_pages
      ? state.book.current_page : null;

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
            <View style={styles.axis}>
              <Text style={styles.description}>{state.book.total_pages}ページ</Text>
              <Text style={styles.description}>0ページ</Text>
            </View>
            <View style={styles.chart}>
              <View pointerEvents="none" style={styles.curve}>
                <Svg accessible={false} width="100%" height="100%" viewBox="0 0 300 112" preserveAspectRatio="none">
                  <Defs><LinearGradient id="communityFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#ACA5BA" stopOpacity="0.45" /><Stop offset="1" stopColor="#ACA5BA" stopOpacity="0.04" /></LinearGradient></Defs>
                  <Path d={`${curve} L 300 100 L 0 100 Z`} fill="url(#communityFill)" />
                  <Path d={curve} stroke="#9B96A5" strokeWidth="2" fill="none" />
                </Svg>
              </View>
              {bins.map((bin, index) => {
                const isSelected = selected?.start === bin.start && selected.end === bin.end;
                const unread = readPage === null || bin.end > readPage;
                const percent = 100 - index * 10;
                const empty = bin.start > bin.end;
                return (
                  <Pressable key={percent} accessibilityRole="button" disabled={empty}
                    accessibilityLabel={empty ? `${percent}％、該当ページなし` : `${percent}％、${bin.start}〜${bin.end}ページ、公開しおり${bin.count}件${unread ? '、未読範囲を含む' : ''}`}
                    accessibilityState={{ selected: isSelected, disabled: empty }}
                    onPress={() => setSelected({ start: bin.start, end: bin.end })}
                    style={[styles.bin, unread && styles.unread, isSelected && styles.selected]}
                  >
                    <Text style={styles.count}>{bin.count}</Text>
                    <View style={styles.barSpace} />
                    <Text style={styles.range}>{`${percent}%`}</Text>
                  </Pressable>
                );
              })}
            </View>
            {state.distribution.total_count === 0 && <Text style={styles.description}>公開しおりはまだありません。</Text>}
            {selected ? (
              <>
                <Text style={styles.heading}><Text style={styles.selectedPages}><Text style={styles.pageNumber}>{selected.start}</Text>{selected.start !== selected.end && <>〜<Text style={styles.pageNumber}>{selected.end}</Text></>}ページ</Text>のしおり・<Text style={styles.pageNumber}>{state.distribution.items.filter((item) => item.page_number >= selected.start && item.page_number <= selected.end).reduce((sum, item) => sum + item.review_count, 0)}</Text>件</Text>
                <PublicReviewList key={`${version}:${selected.start}:${selected.end}`} bookId={bookId} range={selected} compact />
              </>
            ) : <Text style={styles.description}>範囲をタップして感想を見る</Text>}
          </>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, marginTop: 20 },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  selectedPages: { color: '#333333' },
  pageNumber: { fontSize: 20 },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  chart: { flexDirection: 'row', width: '100%' },
  curve: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  pageSearch: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchGroup: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#D8D2E2', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.5)' },
  pageEntry: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageInput: { flex: 1, minWidth: 40, minHeight: 54, borderWidth: 1, borderColor: '#C5C0CE', borderRadius: 10, padding: 8, color: colors.text, backgroundColor: colors.background, textAlign: 'center' },
  searchAction: { flex: 1 },
  bin: { flex: 1, minHeight: 112, alignItems: 'center', paddingVertical: 6, borderWidth: 2, borderColor: 'transparent', borderRadius: 6 },
  unread: { backgroundColor: 'rgba(210,207,218,0.15)' },
  selected: { borderColor: colors.navAccent },
  count: { fontSize: 12, color: colors.text },
  barSpace: { height: 64, width: '100%', justifyContent: 'flex-end', alignItems: 'center', marginVertical: 4 },
  range: { fontSize: 10, lineHeight: 17, textAlign: 'center', color: colors.textSecondary },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
