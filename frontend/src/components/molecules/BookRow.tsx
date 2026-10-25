import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { GlassSurface } from '../atoms/GlassSurface';
import { BookCover } from './BookCover';

type BookRowProps = {
  title?: string;
  author?: string | null;
  status?: string;
  onPress?: () => void;
};

export function BookRow({
  title = '本のタイトル',
  author = '著者名',
  status = '読書中',
  onPress,
}: BookRowProps) {
  return (
    <GlassSurface onPress={onPress} style={styles.row}>
      <BookCover title={title} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{author ?? '著者不明'}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, flexDirection: 'row', marginBottom: 12, padding: 16, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { height: 1, width: 0 } },
  copy: { flex: 1, marginLeft: 16 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.placeholder, fontSize: 13, marginTop: 7 },
  status: { color: colors.navAccent, fontSize: 12, marginTop: 8 },
  chevron: { color: colors.placeholder, fontSize: 28 },
});
