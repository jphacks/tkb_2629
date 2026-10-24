import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { BookCover } from './BookCover';

type BookRowProps = { title?: string; status?: string; onPress?: () => void };

export function BookRow({ title = '本のタイトル', status = '読書中', onPress }: BookRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <BookCover title={title} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>著者名 ・ 出版社</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 16, flexDirection: 'row', marginBottom: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { height: 1, width: 0 } },
  copy: { flex: 1, marginLeft: 16 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.placeholder, fontSize: 13, marginTop: 7 },
  status: { color: colors.navAccent, fontSize: 12, marginTop: 8 },
  chevron: { color: colors.placeholder, fontSize: 28 },
});
