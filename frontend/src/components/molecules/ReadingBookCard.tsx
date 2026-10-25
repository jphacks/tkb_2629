import { colors } from "../../theme/colors";
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg';

import { getBookmarkGradientSvg, type Book } from '../../lib/api';
import { gradients } from '../../theme/gradients';
import { GlassSurface } from '../atoms/GlassSurface';
import { BookmarkAddIcon } from '../atoms/BookmarkAddIcon';
import { OwnedBookCover } from './OwnedBookCover';
import { ReadingProgress } from './ReadingProgress';

type ReadingBookCardProps = {
  book: Book;
  onBookmark?: () => void;
  onPress: () => void;
};

export function ReadingBookCard({ book, onBookmark, onPress }: ReadingBookCardProps) {
  const author = book.author ?? '著者不明';
  const [gradientSvg, setGradientSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setGradientSvg(null);
    getBookmarkGradientSvg(book.id)
      .then((svg) => {
        if (active) setGradientSvg(svg);
      })
      .catch(() => {
        if (active) setGradientSvg(null);
      });
    return () => {
      active = false;
    };
  }, [book.id]);

  return (
    <GlassSurface
      accessibilityLabel={`${book.title}の詳細を開く`}
      onPress={onPress}
      style={styles.book}
    >
      {gradientSvg && (
        <View pointerEvents="none" style={styles.cardGradient}>
          <SvgXml height="100%" preserveAspectRatio="none" width="100%" xml={gradientSvg} />
        </View>
      )}
      <OwnedBookCover book={book} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{book.title}</Text>
        <Text numberOfLines={1} style={styles.author}>{author}</Text>
        <ReadingProgress currentPage={book.current_page} totalPages={book.total_pages}>
          {onBookmark && (
            <Pressable
              accessibilityLabel={`${book.title}にしおりを追加`}
              accessibilityRole="button"
              onPress={onBookmark}
              style={({ pressed }) => [styles.bookmarkButton, pressed && styles.pressed]}
            >
              <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={styles.bookmarkGradient} viewBox="0 0 100 100" width="100%">
                <Defs>
                  <LinearGradient id="readingBookBookmarkGradient" x1="0" x2="1" y1="0" y2="1">
                    <Stop offset="0" stopColor={gradients.button.start} />
                    <Stop offset="0.45" stopColor={gradients.button.middle} />
                    <Stop offset="1" stopColor={gradients.button.end} />
                  </LinearGradient>
                </Defs>
                <Rect fill="url(#readingBookBookmarkGradient)" height="100" rx="22" width="100" />
              </Svg>
              <BookmarkAddIcon height={28} width={26} />
            </Pressable>
          )}
        </ReadingProgress>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  book: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 14, width: '100%' },
  cardGradient: { bottom: 0, left: 0, opacity: 0.16, position: 'absolute', right: 0, top: 0 },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  author: { color: colors.placeholder, fontSize: 11, marginTop: 6 },
  bookmarkButton: { alignItems: 'center', backgroundColor: gradients.button.end, borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 22, borderWidth: 1, flexShrink: 0, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  bookmarkGradient: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
