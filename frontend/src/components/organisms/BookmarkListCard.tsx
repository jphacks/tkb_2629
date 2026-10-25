import { colors } from "../../theme/colors";
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookmarkAreaChart } from '../molecules/BookmarkAreaChart';
import { SegmentedTabs } from '../molecules/SegmentedTabs';
import { BookmarkTimeline } from '../molecules/BookmarkTimeline';
import { GlassSurface } from '../atoms/GlassSurface';
import { reviewAnalysisLabel, type PageReview } from '../../lib/api';
import type { Bookmark } from '../../types/bookmark';

const myBookmarks: Bookmark[] = [
  { id: 'mine-1', page: 42, position: 23, count: 1, title: '旅のはじまり', note: '主人公が星空を見上げる場面。', date: '6月12日', author: 'あなた' },
  { id: 'mine-2', page: 96, position: 53, count: 1, title: '心に残った言葉', note: '「遠くても、見上げれば同じ空」が印象的。', date: '6月15日', author: 'あなた' },
  { id: 'mine-3', page: 142, position: 79, count: 1, title: '次に読むところ', note: '大きな決断をする直前で一度休憩。', date: '6月18日', author: 'あなた' },
];

const otherBookmarks: Bookmark[] = [
  { id: 'other-1', page: 28, position: 15, count: 4, title: 'お気に入りの場面', note: '二人が初めて出会うシーン。', date: '6月10日', author: 'みさきさん' },
  { id: 'other-2', page: 74, position: 41, count: 8, title: '共感したところ', note: '旅に出る理由が語られるページ。', date: '6月14日', author: 'ゆうたさん' },
  { id: 'other-3', page: 125, position: 69, count: 5, title: 'ここから面白い', note: '物語が一気に動き出します。', date: '6月17日', author: 'あかりさん' },
];

export const allBookmarks = [...myBookmarks, ...otherBookmarks];

export function BookmarkListCard({
  accentColor = colors.accent, tintColor = '#FFF4F4', reviews, currentPage, onOpen,
}: {
  accentColor?: string; tintColor?: string; reviews: PageReview[];
  currentPage: number; onOpen: (page: number) => void;
}) {
  const ownBookmarks: Bookmark[] = [...reviews].sort((a, b) => a.page_number - b.page_number).map((review) => ({
    id: String(review.id),
    page: review.page_number,
    position: currentPage > 0 ? (review.page_number / currentPage) * 100 : 0,
    count: 1,
    title: `${review.page_number}ページ`,
    note: review.review_text,
    date: new Date(review.updated_at).toLocaleDateString('ja-JP'),
    author: 'あなた',
    color: review.color_code,
    analysisLabel: reviewAnalysisLabel(review),
  }));
  const [view, setView] = useState<'mine' | 'others'>('mine');
  const [selectedId, setSelectedId] = useState('');
  const [listPage, setListPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(ownBookmarks.length / 5));
  const visiblePage = Math.min(listPage, pageCount - 1);
  const visibleBookmarks = ownBookmarks.slice(visiblePage * 5, visiblePage * 5 + 5);
  const bookmarks = view === 'mine' ? ownBookmarks : otherBookmarks;
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedId) ?? bookmarks[0];
  const total = view === 'mine' ? ownBookmarks.length : otherBookmarks.reduce((sum, bookmark) => sum + bookmark.count, 0);
  const maxCount = Math.max(...otherBookmarks.map((bookmark) => bookmark.count));

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>しおり一覧</Text>
          <Text style={styles.count}>{total}件のしおり</Text>
        </View>
        <SegmentedTabs
          activeColor={accentColor}
          options={[
            { label: '自分のしおり', value: 'mine' },
            { label: '他の人のしおり', value: 'others' },
          ]}
          value={view}
          tintColor={tintColor}
          onChange={(value) => setView(value as 'mine' | 'others')}
        />
      </View>
      {view === 'mine' ? (
        <>
          {ownBookmarks.length === 0 && <Text style={styles.count}>まだしおりがありません。</Text>}
          <BookmarkTimeline currentPage={currentPage} accentColor={accentColor} bookmarks={bookmarks} selectedBookmark={selectedBookmark} onSelect={(id) => {
            const bookmark = ownBookmarks.find((item) => item.id === id);
            if (bookmark) {
              setSelectedId(id);
              onOpen(bookmark.page);
            }
          }} tintColor={tintColor} />
          {visibleBookmarks.map((bookmark) => (
            <Pressable key={bookmark.id} accessibilityRole="button" accessibilityLabel={`${bookmark.page}ページの感想を開く`} onPress={() => onOpen(bookmark.page)} style={styles.review}>
              <View style={[styles.swatch, { backgroundColor: bookmark.color }]} />
              <View style={styles.reviewText}>
                <Text style={styles.heading}>{bookmark.page}ページ</Text>
                <Text>{bookmark.note}</Text>
                <Text style={styles.count}>{bookmark.analysisLabel}</Text>
              </View>
            </Pressable>
          ))}
          {ownBookmarks.length > 0 && (
            <View style={styles.pagination}>
              <Pressable accessibilityRole="button" disabled={visiblePage === 0} accessibilityState={{ disabled: visiblePage === 0 }} onPress={() => setListPage(visiblePage - 1)} style={styles.pageButton}>
                <Text style={visiblePage === 0 ? styles.count : styles.heading}>前へ</Text>
              </Pressable>
              <Text accessibilityLiveRegion="polite">{`${visiblePage + 1}/${pageCount}`}</Text>
              <Pressable accessibilityRole="button" disabled={visiblePage === pageCount - 1} accessibilityState={{ disabled: visiblePage === pageCount - 1 }} onPress={() => setListPage(visiblePage + 1)} style={styles.pageButton}>
                <Text style={visiblePage === pageCount - 1 ? styles.count : styles.heading}>次へ</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.count}>他の人のしおりはサンプルです。</Text>
          <BookmarkAreaChart accentColor={accentColor} bookmarks={otherBookmarks} maxCount={maxCount} selectedBookmark={selectedBookmark} onSelect={setSelectedId} tintColor={tintColor} />
        </>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  header: { gap: 14 },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  count: { color: colors.placeholder, fontSize: 12 },
  review: { flexDirection: 'row', gap: 12, marginTop: 18 },
  swatch: { width: 14, minHeight: 48, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 },
  reviewText: { flex: 1, gap: 6 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  pageButton: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
});
