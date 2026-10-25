import { colors } from "../../theme/colors";
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Bookmark } from '../../types/bookmark';

type BookmarkTimelineProps = {
  accessibilityLabel?: string;
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
  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
  const endPage = Math.max(0, currentPage, ...sorted.map((bookmark) => bookmark.page));
  const pages = [...new Set([0, endPage, ...sorted.map((bookmark) => bookmark.page)])].sort((a, b) => a - b);
  const gaps = pages.slice(1).map((page, index) => page - pages[index]!);
  const smallestGap = gaps.length > 0 ? Math.min(...gaps) : 1;
  // Expand the entire axis using one scale, keeping equal page gaps equal in pixels.
  const axisWidth = Math.max(viewportWidth - EDGE_PADDING * 2, endPage > 0 ? endPage * MIN_MARKER_DISTANCE / smallestGap : 0, 1);
  const endX = EDGE_PADDING + axisWidth;
  const pixelsPerPage = endPage > 0 ? axisWidth / endPage : 0;
  const minimumStep = pixelsPerPage > 0 ? Math.max(1, 56 / pixelsPerPage) : 1;
  const magnitude = 10 ** Math.floor(Math.log10(minimumStep));
  const step = [1, 2, 5, 10].map((value) => value * magnitude).find((value) => value >= minimumStep)!;
  const ticks = [];
  for (let page = step; page < endPage; page += step) {
    ticks.push({ page, x: endX - page * pixelsPerPage });
  }
  return {
    markers: sorted.map((bookmark) => ({ bookmark, x: endX - bookmark.page * pixelsPerPage })),
    ticks,
    endPage,
    endX,
    width: endX + EDGE_PADDING,
  };
}

export function BookmarkTimeline({
  accentColor = colors.accent, bookmarks, selectedBookmark, onSelect,
  tintColor = '#FFD6D6', currentPage, accessibilityLabel = '自分のしおりの数直線',
}: BookmarkTimelineProps) {
  const [viewportWidth, setViewportWidth] = useState(280);
  const layout = createTimelineLayout(bookmarks, currentPage, viewportWidth);
  return (
    <View onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.hint}>ページ数に比例した間隔で表示しています。左右にスクロールできます。</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={accessibilityLabel}>
        <View style={[styles.timeline, { width: layout.width }]}>
          <View style={[styles.line, { backgroundColor: tintColor, width: layout.endX - EDGE_PADDING }]} />
          <View style={[styles.tick, { left: EDGE_PADDING }]} />
          <View style={[styles.tick, { left: layout.endX }]} />
          {layout.ticks.map((tick) => (
            <View key={tick.page} pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={[styles.tick, { left: tick.x }]} />
              <Text style={[styles.endpoint, { left: tick.x - 32 }]}>{tick.page}</Text>
            </View>
          ))}
          <Text style={[styles.endpoint, { left: EDGE_PADDING - 32 }]}>{layout.endPage}ページ</Text>
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
  tick: { width: 1, height: 10, backgroundColor: colors.placeholder, position: 'absolute', top: 27 },
  line: { height: 3, left: EDGE_PADDING, position: 'absolute', top: 30 },
  marker: { alignItems: 'center', position: 'absolute', top: 8, width: 48, minHeight: 60 },
  dot: { borderColor: colors.background, borderRadius: 10, borderWidth: 3, height: 20, width: 20, marginTop: 13 },
  selectedDot: { borderColor: colors.text, borderWidth: 4 },
  page: { color: colors.placeholder, fontSize: 10, marginTop: 5 },
  endpoint: { position: 'absolute', top: 80, width: 64, fontSize: 12, textAlign: 'center' },
});
