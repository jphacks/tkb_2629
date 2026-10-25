import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '../../components/molecules/BookCover';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

const readingBooks = [
  { author: '著者名 ・ 出版社', currentPage: 42, title: '星の旅', totalPages: 180 },
  { author: '著者名 ・ 出版社', currentPage: 96, title: '海辺の手紙', totalPages: 240 },
  { author: '著者名 ・ 出版社', currentPage: 28, title: '夜の図書館', totalPages: 156 },
];

export function ReadingScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <ScreenFrame activeRoute="reading" onNavigate={onNavigate} title="今読んでる本" subtitle="読書の続きを記録しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.bookGrid}>
          {readingBooks.map((book) => (
            <GlassSurface
              accessibilityLabel={`${book.title}の読書カード`}
              key={book.title}
              onPress={() => onNavigate('book-detail')}
              style={styles.book}
            >
              <BookCover title={book.title} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.title}>{book.title}</Text>
                <Text numberOfLines={1} style={styles.author}>{book.author}</Text>
                <ReadingProgress currentPage={book.currentPage} totalPages={book.totalPages} />
              </View>
            </GlassSurface>
          ))}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  bookGrid: { gap: 12, marginTop: 8 },
  book: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 14, width: '100%' },
  copy: { flex: 1 },
  title: { color: '#464646', fontSize: 16, fontWeight: '700' },
  author: { color: '#9CA3AF', fontSize: 11, marginTop: 6 },
});
