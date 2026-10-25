import { colors } from "../../theme/colors";
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '../atoms/GlassSurface';
type ReadingProgressProps = {
  color?: string;
  currentPage: number;
  totalPages: number;
  children?: ReactNode;
};

export function ReadingProgress({ color = colors.navAccent, currentPage, totalPages, children }: ReadingProgressProps) {
  const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <View>
      <View style={styles.heading}>
        <Text style={styles.progress}>
          {currentPage} / {totalPages} ページ<Text style={[styles.percent, { color }]}>（{percentage}% 読了）</Text>
        </Text>
        {children && <View style={styles.action}>{children}</View>}
      </View>
      <GlassSurface intensity={16} style={styles.track}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(100, Math.max(0, percentage))}%` }]} />
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', flexDirection: 'row', marginTop: 4 },
  action: { alignItems: 'flex-end', flex: 1, minWidth: 44 },
  progress: { color: colors.text, fontSize: 14, flexShrink: 1 },
  track: { borderRadius: 6, height: 9, marginTop: 9, overflow: 'hidden', padding: 1 },
  fill: { backgroundColor: colors.navAccent, borderRadius: 4, height: '100%' },
  percent: { color: colors.navAccent, fontSize: 12 },
});
