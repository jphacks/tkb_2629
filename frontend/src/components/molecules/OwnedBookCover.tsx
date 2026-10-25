import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTO_COVER, getEmotionComparison, type Book, type EmotionComparison } from '../../lib/api';
import { colors } from '../../theme/colors';
import { BookCover, type BookCoverProps } from './BookCover';

export function OwnedBookCover({ book, summary, ...size }: {
  book: Book; summary?: EmotionComparison | null;
} & Pick<BookCoverProps, 'compact' | 'large' | 'grid'>) {
  const style = book.cover_style ?? AUTO_COVER;
  const dynamic = style.color_mode === 'mine' || style.color_mode === 'others';
  const [result, setResult] = useState<{ bookId: number; summary: EmotionComparison } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    if (!dynamic || summary !== undefined) return;
    getEmotionComparison(book.id).then((value) => {
      if (active) setResult({ bookId: book.id, summary: value });
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '表紙の感情色を取得できません');
    });
    return () => { active = false; };
  }, [book.id, dynamic, summary, version]);
  const comparison = summary !== undefined ? summary : result?.bookId === book.id ? result.summary : null;
  const emotion = dynamic && comparison
    ? comparison[style.color_mode === 'mine' ? 'mine' : 'others'] : null;
  const color = dynamic ? emotion && emotion.review_count > 0 ? emotion.color_code : '#DEE0E8' : undefined;
  return (
    <View style={styles.container}>
      <BookCover {...size} title={book.title} author={book.author ?? '著者不明'}
        paletteIndex={style.color_mode === 'palette' ? style.palette : null}
        patternIndex={style.pattern} color={color} />
      {dynamic && !emotion && !error && <Text style={styles.hint}>感情色を読込中</Text>}
      {dynamic && emotion?.review_count === 0 && <Text style={styles.hint}>感情未記録</Text>}
      {dynamic && error && <Pressable accessibilityRole="button" accessibilityLabel={`「${book.title}」の表紙の感情色を再試行`}
        style={styles.retry} onPress={(event) => { event.stopPropagation(); setVersion((value) => value + 1); }}>
        <Text accessibilityRole="alert" style={styles.error}>{error}{'\n'}再試行</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexShrink: 0 },
  hint: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },
  retry: { minHeight: 44, justifyContent: 'center', maxWidth: 100 },
  error: { color: '#B42318', fontSize: 10 },
});
