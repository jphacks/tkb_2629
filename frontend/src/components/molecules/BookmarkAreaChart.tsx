import { colors } from "../../theme/colors";
import { gradients } from '../../theme/gradients';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookmarkCallout } from './BookmarkCallout';
import type { Bookmark } from '../../types/bookmark';

type ChartPoint = { x: number; y: number };
type BookmarkAreaChartProps = { accentColor?: string; bookmarks: Bookmark[]; maxCount: number; selectedBookmark?: Bookmark; onSelect: (id: string) => void; tintColor?: string };

export function BookmarkAreaChart({ accentColor = colors.navAccent, bookmarks, maxCount, selectedBookmark, onSelect, tintColor = gradients.button.start }: BookmarkAreaChartProps) {
  const points: ChartPoint[] = bookmarks.map((bookmark) => ({ x: 12 + bookmark.position * 2.76, y: 132 - (bookmark.count / maxCount) * 96 }));
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (!firstPoint || !lastPoint) return null;

  const selectedIndex = selectedBookmark ? bookmarks.findIndex((bookmark) => bookmark.id === selectedBookmark.id) : -1;
  const selectedPoint = selectedIndex >= 0 ? points[selectedIndex] : undefined;

  const linePath = createSmoothPath(points);
  const areaPath = `${linePath} L ${lastPoint.x} 140 L ${firstPoint.x} 140 Z`;

  return (
    <View style={styles.chart}>
      <Svg height="178" preserveAspectRatio="none" viewBox="0 0 300 178" width="100%">
        <Defs>
          <LinearGradient id="bookmarkAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={tintColor} stopOpacity="0.7" />
            <Stop offset="0.55" stopColor={accentColor} stopOpacity="0.45" />
            <Stop offset="1" stopColor={accentColor} stopOpacity="0.08" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#bookmarkAreaGradient)" />
        <Path d={linePath} fill="none" stroke={accentColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {bookmarks.map((bookmark, index) => {
          const point = points[index];
          return point ? <Circle key={bookmark.id} cx={point.x} cy={point.y} fill={colors.background} r="5" stroke={accentColor} strokeWidth="3" /> : null;
        })}
      </Svg>
      {bookmarks.map((bookmark, index) => {
        const point = points[index];
        if (!point) return null;
        return (
          <Pressable
            key={bookmark.id}
            accessibilityLabel={`${bookmark.page}ページ、${bookmark.count}件のしおり`}
            accessibilityRole="button"
            onPress={() => onSelect(bookmark.id)}
            style={[styles.point, { left: `${(point.x / 300) * 100}%`, top: point.y - 24 }]}
          />
        );
      })}
      <View style={styles.labels}><Text>1ページ</Text><Text>180ページ</Text></View>
      {selectedBookmark && selectedPoint && <BookmarkCallout accentColor={accentColor} bookmark={selectedBookmark} position={(selectedPoint.x / 300) * 100} tintColor={tintColor} />}
    </View>
  );
}

function createSmoothPath(points: ChartPoint[]) {
  const firstPoint = points[0];
  if (!firstPoint) return '';
  let path = `M ${firstPoint.x} ${firstPoint.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const midpointX = (previous.x + current.x) / 2;
    path += ` Q ${previous.x} ${previous.y} ${midpointX} ${(previous.y + current.y) / 2}`;
    path += ` Q ${current.x} ${current.y} ${current.x} ${current.y}`;
  }
  return path;
}

const styles = StyleSheet.create({
  chart: { height: 180, marginTop: 20, position: 'relative' ,paddingTop: 50 },
  point: { alignItems: 'center', height: 80, position: 'absolute', transform: [{ translateX: -24 }], width: 48, zIndex: 4 },
  labels: { bottom: 0, flexDirection: 'row', justifyContent: 'space-between', left: 0, position: 'absolute', right: 0 },
});
