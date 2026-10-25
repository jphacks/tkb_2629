import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getPopularBooks, type GoogleBook, type PopularBook } from '../../lib/api';
import { colors } from '../../theme/colors';

const medalColors = ['#C99700', '#9CA3AF', '#B87333'];

export function PopularBooks({ onSelect }: { onSelect: (book: GoogleBook) => void }) {
  const [items, setItems] = useState<PopularBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPopularBooks().then((books) => {
      if (active) setItems(books);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '人気の本を読み込めませんでした。');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>みんなの本棚で人気の本</Text>
      {loading ? <Text style={styles.hint}>人気の本を読み込み中…</Text> : error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="人気の本を再読み込み" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}>
            <Text style={styles.label}>再読み込み</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.hint}>まだ人気の本はありません。気になる本を検索して本棚に追加してみましょう。</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
          {items.map(({ book, reader_count }, index) => (
            <Pressable
              key={book.google_books_id}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}位 ${book.title}、${reader_count}人の本棚`}
              onPress={() => onSelect(book)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.rank}>
                {index < 3 && <Ionicons name="medal" size={24} color={medalColors[index]} />}
                <Text style={styles.label}>{index + 1}位</Text>
              </View>
              <Text numberOfLines={3} style={styles.title}>{book.title}</Text>
              <Text numberOfLines={2} style={styles.hint}>{book.author ?? '著者情報なし'}</Text>
              <Text style={styles.label}>{reader_count}人の本棚</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  list: { gap: 12, paddingVertical: 4 },
  card: { backgroundColor: colors.backgroundSoft, borderRadius: 16, padding: 16, gap: 8, width: 180, minHeight: 44 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  pressed: { opacity: 0.72 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  error: { color: '#B42318', fontSize: 13 },
});
