import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  accentColor = '#FF7171', tintColor = '#FFF4F4', reviews, totalPages = 180,
}: { accentColor?: string; tintColor?: string; reviews: PageReview[]; totalPages?: number }) {
  const ownBookmarks: Bookmark[] = reviews.map((review) => ({
    id: String(review.id),
    page: review.page_number,
    position: totalPages > 1 ? ((review.page_number - 1) / (totalPages - 1)) * 100 : 0,
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
          <BookmarkTimeline totalPages={totalPages} accentColor={accentColor} bookmarks={bookmarks} selectedBookmark={selectedBookmark} onSelect={setSelectedId} tintColor={tintColor} />
          {ownBookmarks.map((bookmark) => (
            <View key={bookmark.id} style={styles.review}>
              <View style={[styles.swatch, { backgroundColor: bookmark.color }]} />
              <View style={styles.reviewText}>
                <Text style={styles.heading}>{bookmark.page}ページ</Text>
                <Text>{bookmark.note}</Text>
                <Text style={styles.count}>{bookmark.analysisLabel}</Text>
              </View>
            </View>
          ))}
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
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  header: { gap: 14 },
  heading: { color: '#464646', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  count: { color: '#9CA3AF', fontSize: 12 },
  review: { flexDirection: 'row', gap: 12, marginTop: 18 },
  swatch: { width: 14, minHeight: 48, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 },
  reviewText: { flex: 1, gap: 6 },
});
