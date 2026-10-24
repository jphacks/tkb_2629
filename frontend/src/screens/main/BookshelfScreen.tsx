import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { colors } from '../../theme/colors';
import type { ScreenKey } from '../types';

export function BookshelfScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const books = ['星の旅', '静かな海', '春の記憶','JPHACKS攻略本'];

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本棚" subtitle="あなたの本を整理しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}><Text style={styles.activeFilter}>すべて</Text><Text style={styles.filter}>読書中</Text><Text style={styles.filter}>読了</Text></View>
        <View style={styles.grid}>
          {books.map((title) => (
            <Pressable key={title} onPress={() => onNavigate('book-detail')} style={styles.book}>
              <BookCover grid title={title} />
              <Text numberOfLines={1} style={styles.bookTitle}>{title}</Text>
            </Pressable>
          ))}
        </View>
        <ActionButton label="本を追加する" onPress={() => onNavigate('add-book')} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  filters: { flexDirection: 'row', gap: 10, marginBottom: 18, marginTop: 8 },
  activeFilter: { backgroundColor: '#FF7171', borderRadius: 16, color: '#FFFFFF', fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 8 },
  filter: { backgroundColor: '#FFF0F0', borderRadius: 16, color: '#777777', fontSize: 13, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 26, marginBottom: 30 },
  book: { alignItems: 'center', width: '31%' },
  bookTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center', width: '100%' },
});
