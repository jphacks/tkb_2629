import { colors } from "../../theme/colors";
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '../atoms/GlassSurface';
type ReadingProgressProps = {
  color?: string;
  currentPage: number;
  totalPages: number;
};

export function ReadingProgress({ color = colors.navAccent, currentPage, totalPages }: ReadingProgressProps) {
  const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <View>
      <Text style={styles.progress}>{currentPage} / {totalPages}ページ</Text>
      <GlassSurface intensity={16} style={styles.track}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(100, Math.max(0, percentage))}%` }]} />
      </GlassSurface>
      <Text style={[styles.percent, { color }]}>{percentage}% 読了</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { color: colors.text, fontSize: 14, marginTop: 4 },
  track: { borderRadius: 6, height: 9, marginTop: 9, overflow: 'hidden', padding: 1 },
  fill: { backgroundColor: colors.navAccent, borderRadius: 4, height: '100%' },
  percent: { color: colors.navAccent, fontSize: 12, marginTop: 6 },
});
