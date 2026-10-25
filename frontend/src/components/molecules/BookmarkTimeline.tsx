import { colors } from "../../theme/colors";
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Bookmark } from '../../types/bookmark';

type BookmarkTimelineProps = {
  accentColor?: string;
  bookmarks: Bookmark[];
  selectedBookmark?: Bookmark;
  onSelect: (id: string) => void;
  tintColor?: string;
  currentPage: number;
};

const MIN_MARKER_DISTANCE = 56;
const EDGE_PADDING = 32;

export function createTimelineLayout(bookmarks: Bookmark[], currentPage: number, viewportWidth: number) {
  const axisWidth = Math.max(0, viewportWidth - EDGE_PADDING * 2);
  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
  let previousPage = 0;
  let previousX = 0;
  const markers = sorted.map((bookmark) => {
    const proportionalGap = currentPage > 0 ? ((bookmark.page - previousPage) / currentPage) * axisWidth : 0;
    const x = previousX + Math.max(MIN_MARKER_DISTANCE, proportionalGap);
    previousPage = bookmark.page;
    previousX = x;
    return { bookmark, x: x + EDGE_PADDING };
  });
  const trailingGap = currentPage > 0 ? ((currentPage - previousPage) / currentPage) * axisWidth : 0;
  const endX = Math.max(axisWidth, previousX + Math.max(0, trailingGap)) + EDGE_PADDING;
  return {
    markers: markers.map((marker) => ({ ...marker, x: endX + EDGE_PADDING - marker.x })),
    endX,
    width: endX + EDGE_PADDING,
  };
}

export function BookmarkTimeline({
  accentColor = colors.accent, bookmarks, selectedBookmark, onSelect,
  tintColor = '#FFD6D6', currentPage,
}: BookmarkTimelineProps) {
  const [viewportWidth, setViewportWidth] = useState(280);
  const layout = createTimelineLayout(bookmarks, currentPage, viewportWidth);
  return (
    <View onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.hint}>近いページの間隔を広げています。左右にスクロールできます。</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="自分のしおりの数直線">
        <View style={[styles.timeline, { width: layout.width }]}>
          <View style={[styles.line, { backgroundColor: tintColor, width: layout.endX - EDGE_PADDING }]} />
          <Text style={[styles.endpoint, { left: EDGE_PADDING - 32 }]}>{currentPage}ページ</Text>
          <Text style={[styles.endpoint, { left: layout.endX - 32 }]}>0ページ</Text>
          {layout.markers.map(({ bookmark, x }) => (
            <Pressable
              key={bookmark.id}
              accessibilityLabel={`${bookmark.page}ページのしおりを開く`}
              accessibilityRole="button"
              onPress={() => onSelect(bookmark.id)}
              style={[styles.marker, { left: x - 24 }]}
            >
              <View style={[
                styles.dot,
                { backgroundColor: bookmark.color ?? accentColor },
                selectedBookmark?.id === bookmark.id && styles.selectedDot,
              ]} />
              <Text style={styles.page}>{bookmark.page}p</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { height: 112, marginTop: 12, position: 'relative' },
  hint: { color: colors.placeholder, fontSize: 12, marginTop: 14 },
  line: { height: 3, left: EDGE_PADDING, position: 'absolute', top: 30 },
  marker: { alignItems: 'center', position: 'absolute', top: 8, width: 48, minHeight: 60 },
  dot: { borderColor: colors.background, borderRadius: 10, borderWidth: 3, height: 20, width: 20, marginTop: 13 },
  selectedDot: { borderColor: colors.text, borderWidth: 4 },
  page: { color: colors.placeholder, fontSize: 10, marginTop: 5 },
  endpoint: { position: 'absolute', top: 80, width: 64, fontSize: 12, textAlign: 'center' },
});
