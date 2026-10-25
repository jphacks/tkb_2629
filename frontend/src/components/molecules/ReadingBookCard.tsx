import { colors } from "../../theme/colors";
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Book } from '../../lib/api';
import { GlassSurface } from '../atoms/GlassSurface';
import { BookCover } from './BookCover';
import { ReadingProgress } from './ReadingProgress';

type ReadingBookCardProps = {
  book: Book;
  onBookmark: () => void;
  onPress: () => void;
};

export function ReadingBookCard({ book, onBookmark, onPress }: ReadingBookCardProps) {
  const author = book.author ?? '著者不明';
  return (
    <GlassSurface
      accessibilityLabel={`${book.title}の詳細を開く`}
      onPress={onPress}
      style={styles.book}
    >
      <BookCover title={book.title} author={author} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{book.title}</Text>
        <Text numberOfLines={1} style={styles.author}>{author}</Text>
        <ReadingProgress currentPage={book.current_page} totalPages={book.total_pages} />
        <Pressable
          accessibilityLabel={`${book.title}にしおりを挟む`}
          accessibilityRole="button"
          onPress={onBookmark}
          style={({ pressed }) => [styles.bookmarkButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.navAccent} name="bookmark-outline" size={16} />
          <Text style={styles.bookmarkLabel}>しおりを挟む</Text>
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  book: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 14, width: '100%' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  author: { color: colors.placeholder, fontSize: 11, marginTop: 6 },
  bookmarkButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6 },
  bookmarkLabel: { color: colors.navAccent, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
