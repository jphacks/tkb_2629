import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '../atoms/GlassSurface';
import { BookCover } from './BookCover';
import { ReadingProgress } from './ReadingProgress';

export type ReadingBook = {
  author: string;
  currentPage: number;
  title: string;
  totalPages: number;
};

export const readingBooks: ReadingBook[] = [
  { author: '著者名 ・ 出版社', currentPage: 42, title: '星の旅', totalPages: 180 },
  { author: '著者名 ・ 出版社', currentPage: 96, title: '海辺の手紙', totalPages: 240 },
  { author: '著者名 ・ 出版社', currentPage: 28, title: '夜の図書館', totalPages: 156 },
];

type ReadingBookCardProps = {
  book: ReadingBook;
  onPress: () => void;
};

export function ReadingBookCard({ book, onPress }: ReadingBookCardProps) {
  return (
    <GlassSurface
      accessibilityLabel={`${book.title}の読書カード`}
      onPress={onPress}
      style={styles.book}
    >
      <BookCover title={book.title} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{book.title}</Text>
        <Text numberOfLines={1} style={styles.author}>{book.author}</Text>
        <ReadingProgress currentPage={book.currentPage} totalPages={book.totalPages} />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  book: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 14, width: '100%' },
  copy: { flex: 1 },
  title: { color: '#464646', fontSize: 16, fontWeight: '700' },
  author: { color: '#9CA3AF', fontSize: 11, marginTop: 6 },
});
