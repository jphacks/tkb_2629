import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type BookCoverProps = { title?: string; author?: string; large?: boolean };

export function BookCover({ title = '本のタイトル', author = '著者名', large = false }: BookCoverProps) {
  return (
    <View style={[styles.cover, large && styles.large]}>
      <Text style={styles.coverTitle}>{title}</Text>
      <Text style={styles.author}>{author}</Text>
      <View style={styles.sun} />
      <View style={styles.wave} />
      <Text style={styles.publisher}>出版社</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: '#E7B7F2', borderRadius: 4, height: 95, overflow: 'hidden', width: 66 },
  large: { height: 182, width: 126 },
  coverTitle: { color: '#5D3B6F', fontSize: 9, fontWeight: '700', margin: 8 },
  author: { color: '#6E4F7D', fontSize: 6, marginHorizontal: 8 },
  sun: { backgroundColor: '#F8DC84', borderRadius: 30, height: 30, position: 'absolute', right: 8, top: 42, width: 30 },
  wave: { backgroundColor: '#F39BA7', borderRadius: 60, bottom: -35, height: 80, left: -20, position: 'absolute', width: 130 },
  publisher: { bottom: 8, color: '#6E4F7D', fontSize: 6, position: 'absolute', right: 8 },
});
