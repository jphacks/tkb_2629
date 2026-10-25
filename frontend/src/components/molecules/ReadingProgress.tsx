import { StyleSheet, Text, View } from 'react-native';

type ReadingProgressProps = {
  currentPage: number;
  totalPages: number;
};

export function ReadingProgress({ currentPage, totalPages }: ReadingProgressProps) {
  const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <View>
      <Text style={styles.progress}>{currentPage} / {totalPages}ページ</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, percentage))}%` }]} />
      </View>
      <Text style={styles.percent}>{percentage}% 読了</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { color: '#464646', fontSize: 14, marginTop: 4 },
  track: { backgroundColor: '#FFFFFF', borderRadius: 4, height: 7, marginTop: 9, overflow: 'hidden' },
  fill: { backgroundColor: '#C17AED', borderRadius: 4, height: '100%' },
  percent: { color: '#C17AED', fontSize: 12, marginTop: 6 },
});
