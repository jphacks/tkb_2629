import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getEmotionRecommendations, type EmotionRecommendations as Recommendations, type GoogleBook } from '../../lib/api';
import { colors } from '../../theme/colors';

export function EmotionRecommendations({ onSelect }: { onSelect: (book: GoogleBook) => void }) {
  const [result, setResult] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getEmotionRecommendations().then((value) => {
      if (active) setResult(value);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'おすすめの本を読み込めませんでした。');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>あなたの感情に近い本</Text>
      {loading ? <Text style={styles.hint}>おすすめの本を読み込み中…</Text> : error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="おすすめの本を再読み込み" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}>
            <Text style={styles.title}>再読み込み</Text>
          </Pressable>
        </View>
      ) : result?.status === 'needs_reviews' ? (
        <Text style={styles.hint}>感想を残すと、読書中の感情に近い本が見つかります。まずはジャンルや人気の本から探してみましょう。</Text>
      ) : result?.status === 'no_candidates' ? (
        <Text style={styles.hint}>まだ感情の近い本が見つかりません。ジャンルや人気の本から探してみましょう。</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
          {result?.items.map((book) => (
            <Pressable
              key={book.google_books_id}
              accessibilityRole="button"
              accessibilityLabel={`おすすめの本 ${book.title}`}
              onPress={() => onSelect(book)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text numberOfLines={3} style={styles.title}>{book.title}</Text>
              <Text numberOfLines={2} style={styles.hint}>{book.author ?? '著者情報なし'}</Text>
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
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  list: { gap: 12, paddingVertical: 4 },
  card: { backgroundColor: colors.backgroundSoft, borderRadius: 16, padding: 16, gap: 8, width: 180, minHeight: 44 },
  pressed: { opacity: 0.72 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  error: { color: '#B42318', fontSize: 13 },
});
