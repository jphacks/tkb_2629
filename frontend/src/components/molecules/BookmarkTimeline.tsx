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
  const axisWidth = Math.max(viewportWidth - EDGE_PADDING * 2, 1);
  const endX = EDGE_PADDING + axisWidth;
  const pixelsPerPage = endPage > 0 ? axisWidth / endPage : 0;
  const minimumStep = pixelsPerPage > 0 ? Math.max(1, 56 / pixelsPerPage) : 1;
  const magnitude = 10 ** Math.floor(Math.log10(minimumStep));
  const step = [1, 2, 5, 10].map((value) => value * magnitude).find((value) => value >= minimumStep)!;
  const ticks = [];
  for (let page = step; page < endPage; page += step) {
    ticks.push({ page, x: endX - page * pixelsPerPage });
  }
  const markers = sorted.map((bookmark) => ({ bookmark, x: endX - bookmark.page * pixelsPerPage }));
  const groups: { bookmarks: Bookmark[]; x: number; firstX: number; lastX: number }[] = [];
  for (const marker of markers) {
    const previous = groups[groups.length - 1];
    if (previous && previous.lastX - marker.x < MIN_MARKER_DISTANCE) {
      previous.bookmarks.push(marker.bookmark);
      previous.lastX = marker.x;
      previous.x = (previous.firstX + marker.x) / 2;
    } else {
      groups.push({ bookmarks: [marker.bookmark], x: marker.x, firstX: marker.x, lastX: marker.x });
    }
  }
  return {
    markers,
    groups,
    ticks,
    endPage,
    endX,
    width: endX + EDGE_PADDING,
  };
}

export function BookmarkTimeline({
  accentColor = colors.navAccent, bookmarks, selectedBookmark, onSelect,
  tintColor = colors.backgroundSoft, currentPage, accessibilityLabel = '自分のしおりの数直線',
}: BookmarkTimelineProps) {
  const [viewportWidth, setViewportWidth] = useState(280);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const layout = createTimelineLayout(bookmarks, currentPage, viewportWidth);
  const expanded = layout.groups.find((group) => group.bookmarks[0]!.id === expandedId);
  return (
    <View onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.hint}>{"近いページはまとめて表示しています\nタップしてしおりを選べます"}</Text>
      <View accessibilityLabel={accessibilityLabel}>
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
          {layout.groups.map(({ bookmarks: grouped, x }) => {
            const bookmark = grouped[0]!;
            const last = grouped[grouped.length - 1]!;
            const multiple = grouped.length > 1;
            return (
            <Pressable
              key={bookmark.id}
              accessibilityLabel={multiple ? `${bookmark.page}〜${last.page}ページのしおり${grouped.length}件を選ぶ` : `${bookmark.page}ページのしおりを開く`}
              accessibilityRole="button"
              accessibilityState={{ expanded: multiple ? expandedId === bookmark.id : undefined }}
              onPress={() => {
                if (multiple) setExpandedId(expandedId === bookmark.id ? null : bookmark.id);
                else { setExpandedId(null); onSelect(bookmark.id); }
              }}
              style={[styles.marker, { left: x - 24 }]}
            >
              <View style={[
                styles.dot,
                { backgroundColor: multiple ? tintColor : bookmark.color ?? accentColor },
                grouped.some((item) => selectedBookmark?.id === item.id) && styles.selectedDot,
                multiple && styles.groupDot,
              ]} />
              <Text style={styles.page}>{multiple ? `${grouped.length}件` : `${bookmark.page}p`}</Text>
            </Pressable>
          ); })}
        </View>
      </View>
      {expanded && <View>
        <View style={styles.detailsHeading}>
          <Text style={styles.hint}>{expanded.bookmarks[0]!.page}〜{expanded.bookmarks[expanded.bookmarks.length - 1]!.page}ページ</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="しおりの選択を閉じる" onPress={() => setExpandedId(null)} style={styles.close}><Text style={styles.page}>閉じる</Text></Pressable>
        </View>
        <ScrollView nestedScrollEnabled style={styles.details} accessibilityLabel="近いページのしおりを選択">
          {expanded.bookmarks.map((bookmark) => (
            <Pressable key={bookmark.id} accessibilityRole="button" accessibilityLabel={`${bookmark.page}ページのしおりを開く`}
              onPress={() => onSelect(bookmark.id)} style={styles.detail}>
              <View style={[styles.detailDot, { backgroundColor: bookmark.color ?? accentColor }]} />
              <Text style={styles.detailLabel}>{bookmark.page}ページ</Text>
              <Text numberOfLines={1} style={styles.excerpt}>{bookmark.note}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  groupDot: { width: 26, height: 26, borderRadius: 13, borderColor: colors.textSecondary },
  details: { maxHeight: 192 },
  detailsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 8 },
  detailDot: { width: 14, height: 14, borderRadius: 7 },
  detailLabel: { color: colors.text, fontSize: 14 },
  excerpt: { flex: 1, color: colors.textSecondary, fontSize: 12 },
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
