import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function BookDetailScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const [bookmarkView, setBookmarkView] = useState<'mine' | 'others'>('mine');
  const [selectedBookmarkId, setSelectedBookmarkId] = useState('mine-1');
  const bookmarks = bookmarkView === 'mine' ? myBookmarks : otherBookmarks;
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId) ?? bookmarks[0];
  const bookmarkTotal = bookmarkView === 'mine' ? myBookmarks.length : otherBookmarks.reduce((total, bookmark) => total + bookmark.count, 0);
  const maxOtherBookmarkCount = Math.max(...otherBookmarks.map((bookmark) => bookmark.count));

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の詳細">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BookCover large title="星の旅" />
          <Text style={styles.title}>星の旅</Text>
          <Text style={styles.author}>著者名</Text>
          <Text style={styles.publisher}>出版社 ・ 2025年</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>あらすじ</Text>
          <Text style={styles.body}>本の紹介文がここに入ります。物語の概要や本の特徴を確認できます。</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>読書状況</Text>
          <Text style={styles.body}>42 / 180ページ ・ 23%読了</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.bookmarkHeader}>
            <View>
              <Text style={styles.heading}>しおり一覧</Text>
              <Text style={styles.bookmarkCount}>{bookmarkTotal}件のしおり</Text>
            </View>
            <View style={styles.segmentedControl}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: bookmarkView === 'mine' }}
                onPress={() => setBookmarkView('mine')}
                style={[styles.segment, bookmarkView === 'mine' && styles.activeSegment]}
              >
                <Text style={[styles.segmentText, bookmarkView === 'mine' && styles.activeSegmentText]}>自分のしおり</Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: bookmarkView === 'others' }}
                onPress={() => setBookmarkView('others')}
                style={[styles.segment, bookmarkView === 'others' && styles.activeSegment]}
              >
                <Text style={[styles.segmentText, bookmarkView === 'others' && styles.activeSegmentText]}>他の人のしおり</Text>
              </Pressable>
            </View>
          </View>

          {bookmarkView === 'mine' ? (
            <>
              <View style={styles.timeline}>
                <View style={styles.timelineLine} />
                {bookmarks.map((bookmark) => {
                  const isSelected = selectedBookmark?.id === bookmark.id;

                  return (
                    <Pressable
                      key={bookmark.id}
                      accessibilityLabel={`${bookmark.page}ページのしおり`}
                      accessibilityRole="button"
                      onPress={() => setSelectedBookmarkId(bookmark.id)}
                      style={[styles.marker, { left: `${bookmark.position}%` }]}
                    >
                      <View style={[styles.dot, isSelected && styles.selectedDot]} />
                      <Text style={styles.markerPage}>{bookmark.page}p</Text>
                    </Pressable>
                  );
                })}
                {selectedBookmark && <BookmarkCallout bookmark={selectedBookmark} position={selectedBookmark.position} />}
              </View>
              <View style={styles.timelineLabels}>
                <Text>1ページ</Text>
                <Text>180ページ</Text>
              </View>
            </>
          ) : (
            <View style={styles.chart}>
              {otherBookmarks.map((bookmark) => {
                const isSelected = selectedBookmark?.id === bookmark.id;
                const barHeight = (bookmark.count / maxOtherBookmarkCount) * 100;

                return (
                  <Pressable
                    key={bookmark.id}
                    accessibilityLabel={`${bookmark.page}ページ、${bookmark.count}件のしおり`}
                    accessibilityRole="button"
                    onPress={() => setSelectedBookmarkId(bookmark.id)}
                    style={styles.barColumn}
                  >
                    <Text style={[styles.barCount, isSelected && styles.selectedBarCount]}>{bookmark.count}</Text>
                    <View style={styles.barArea}>
                      <View style={[styles.bar, { height: `${barHeight}%` }, isSelected && styles.selectedBar]}>
                        <View style={[styles.gradientStop, styles.gradientTop]} />
                        <View style={[styles.gradientStop, styles.gradientUpperMiddle]} />
                        <View style={[styles.gradientStop, styles.gradientMiddle]} />
                        <View style={[styles.gradientStop, styles.gradientLowerMiddle]} />
                        <View style={[styles.gradientStop, styles.gradientBottom]} />
                      </View>
                    </View>
                    <Text style={styles.barPage}>{bookmark.page}p</Text>
                  </Pressable>
                );
              })}
              {selectedBookmark && <BookmarkCallout bookmark={selectedBookmark} position={selectedBookmark.position} />}
            </View>
          )}
        </View>

        <ActionButton label="本を編集する" onPress={() => onNavigate('book-edit')} secondary />
      </ScrollView>
    </ScreenFrame>
  );
}

type Bookmark = { id: string; page: number; position: number; count: number; title: string; note: string; date: string; author: string };

function BookmarkCallout({ bookmark, position }: { bookmark: Bookmark; position: number }) {
  return (
    <View style={[styles.callout, { left: `${Math.max(0, Math.min(68, position - 12))}%` }]}>
      <View style={styles.calloutPointer} />
      <Text style={styles.calloutTitle}>{bookmark.title}</Text>
      <Text style={styles.calloutMeta}>{bookmark.page}ページ ・ {bookmark.date}</Text>
      <Text style={styles.calloutBody}>{bookmark.note}</Text>
      <Text style={styles.calloutAuthor}>{bookmark.count}人が保存 ・ {bookmark.author}</Text>
    </View>
  );
}

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

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 110 }, hero: { alignItems: 'center', backgroundColor: '#FFF0F0', borderRadius: 20, marginTop: 8, padding: 24 }, title: { color: '#464646', fontSize: 24, fontWeight: '700', marginTop: 18 }, author: { color: '#777777', fontSize: 14, marginTop: 8 }, publisher: { color: '#9CA3AF', fontSize: 12, marginTop: 6 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, heading: { color: '#464646', fontSize: 16, fontWeight: '700', marginBottom: 4 }, body: { color: '#777777', fontSize: 14, lineHeight: 22 }, bookmarkHeader: { gap: 14 }, bookmarkCount: { color: '#9CA3AF', fontSize: 12 }, segmentedControl: { backgroundColor: '#FFF4F4', borderRadius: 10, flexDirection: 'row', padding: 3 }, segment: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: 8 }, activeSegment: { backgroundColor: '#FFFFFF', elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { height: 1, width: 0 } }, segmentText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' }, activeSegmentText: { color: '#FF7171' }, timeline: { height: 150, marginTop: 14, position: 'relative' }, timelineLine: { backgroundColor: '#FFD6D6', height: 3, left: 0, position: 'absolute', right: 0, top: 82 }, marker: { alignItems: 'center', position: 'absolute', top: 70, transform: [{ translateX: -18 }], width: 36, zIndex: 2 }, dot: { backgroundColor: '#FF7171', borderColor: '#FFFFFF', borderRadius: 10, borderWidth: 3, height: 20, shadowColor: '#FF7171', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { height: 1, width: 0 }, width: 20 }, selectedDot: { borderColor: '#464646', borderWidth: 4 }, markerPage: { color: '#9CA3AF', fontSize: 10, marginTop: 5 }, chart: { flexDirection: 'row', height: 178, marginTop: 14, position: 'relative' }, barColumn: { alignItems: 'center', flex: 1, justifyContent: 'flex-end', paddingBottom: 2 }, barCount: { color: '#C17AED', fontSize: 12, fontWeight: '700', marginBottom: 4 }, selectedBarCount: { color: '#FF7171' }, barArea: { alignItems: 'center', height: 126, justifyContent: 'flex-end', width: '100%' }, bar: { borderRadius: 8, overflow: 'hidden', width: 28 }, selectedBar: { borderColor: '#464646', borderWidth: 2 }, barPage: { color: '#9CA3AF', fontSize: 10, marginTop: 6 }, gradientStop: { flex: 1 }, gradientTop: { backgroundColor: '#FF8C8C' }, gradientUpperMiddle: { backgroundColor: '#F384C9' }, gradientMiddle: { backgroundColor: '#DE7ECD' }, gradientLowerMiddle: { backgroundColor: '#D078D0' }, gradientBottom: { backgroundColor: '#C17AED' }, callout: { backgroundColor: '#FFFFFF', borderColor: '#FFE0E0', borderRadius: 12, borderWidth: 1, elevation: 4, padding: 10, position: 'absolute', top: 0, width: 150, zIndex: 3 }, calloutPointer: { backgroundColor: '#FFFFFF', borderBottomColor: '#FFE0E0', borderBottomWidth: 1, borderRightColor: '#FFE0E0', borderRightWidth: 1, bottom: -6, height: 10, left: 24, position: 'absolute', transform: [{ rotate: '45deg' }], width: 10 }, calloutTitle: { color: '#464646', fontSize: 12, fontWeight: '700' }, calloutMeta: { color: '#FF7171', fontSize: 10, marginTop: 3 }, calloutBody: { color: '#777777', fontSize: 11, lineHeight: 16, marginTop: 5 }, calloutAuthor: { color: '#A1A1AA', fontSize: 10, marginTop: 6 }, timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
});
