import { colors } from "../../theme/colors";
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import type { Book } from '../../lib/api';
import { GlassSurface } from '../atoms/GlassSurface';
import { BookCover } from './BookCover';
import { ReadingProgress } from './ReadingProgress';

type ReadingBookCardProps = {
  book: Book;
  onBookmark: () => void;
  onPress: () => void;
};

const addBookmarkSvgUri = Image.resolveAssetSource(require('../../assets/addBookmark.svg'))?.uri ?? '';

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
        <ReadingProgress currentPage={book.current_page} totalPages={book.total_pages}>
          <Pressable
            accessibilityLabel={`${book.title}にしおりを追加`}
            accessibilityRole="button"
            onPress={onBookmark}
            style={({ pressed }) => [styles.bookmarkButton, pressed && styles.pressed]}
          >
            <SvgUri height={28} uri={addBookmarkSvgUri} width={26} />
          </Pressable>
        </ReadingProgress>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  book: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 14, width: '100%' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  author: { color: colors.placeholder, fontSize: 11, marginTop: 6 },
  bookmarkButton: { alignItems: 'center', backgroundColor: colors.navAccent, borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 22, borderWidth: 1, flexShrink: 0, height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
