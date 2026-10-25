import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '../../components/molecules/BookCover';
import { ActionButton } from '../../components/molecules/ActionButton';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { loadCompletedShelf, matchesKeyword, matchingReview, reviewExcerpt, shelfMonth, type ShelfEntry } from '../../lib/bookshelf';
import { formatDate } from '../../lib/readingStatus';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

export function BookshelfScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [entries, setEntries] = useState<ShelfEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setEntries([]);
    loadCompletedShelf(() => active).then((items) => {
      if (active && items) setEntries(items);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '本棚の取得に失敗しました。');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [requestVersion]);

  const groups = new Map<string, ShelfEntry[]>();
  for (const entry of entries.filter((item) => matchesKeyword(item, query))) {
    const month = shelfMonth(entry.completedAt);
    const group = groups.get(month) ?? [];
    group.push(entry);
    groups.set(month, group);
  }

  return (
    <ScreenFrame
      activeRoute="bookshelf"
      headerAction={(
        <Pressable accessibilityLabel="本を追加" accessibilityRole="button"
          onPress={() => onNavigate('search')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="add" size={22} />
        </Pressable>
      )}
      onNavigate={onNavigate}
      title="本棚"
      subtitle="読み終えた本を振り返りましょう"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ShadowInput
          accessibilityLabel="本棚のキーワード検索"
          placeholder="キーワードで検索"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <Text style={styles.hint}>書名・著者・自分の感想から検索（空白区切りで絞り込み）</Text>
        {loading && <Text style={styles.message}>本棚と過去の感想を読み込んでいます…</Text>}
        {error && (
          <View>
            <Text accessibilityRole="alert" style={styles.message}>{error}</Text>
            <ActionButton label="再試行" onPress={() => setRequestVersion((version) => version + 1)} />
          </View>
        )}
        {!loading && !error && entries.length === 0 && (
          <View>
            <Text style={styles.message}>読み終えた本はまだありません。</Text>
            <ActionButton label="今読んでる本へ" onPress={() => onNavigate('reading')} />
          </View>
        )}
        {!loading && !error && entries.length > 0 && groups.size === 0 && (
          <Text style={styles.message}>キーワードに一致する本はありません。</Text>
        )}
        {Array.from(groups, ([month, items]) => (
          <View key={month}>
            <Text style={styles.month}>{month}</Text>
            <View style={styles.grid}>
              {items.map((entry) => {
                const { book } = entry;
                const review = matchingReview(entry, query);
                return (
                  <Pressable key={book.id} accessibilityLabel={`${book.title}の詳細を見る`}
                    onPress={() => onNavigate({ name: 'book-detail', bookId: book.id })} style={styles.book}
                  >
                    <BookCover grid title={book.title} author={book.author ?? '著者不明'} />
                    <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.caption}>{formatDate(entry.completedAt) ?? '読了日不明'} 読了</Text>
                    {book.reading_status === 'reading' && (
                      <Text style={styles.rereading}>{book.latest_iteration}回目を読書中</Text>
                    )}
                    {book.reading_status === 'completed' && book.latest_iteration > 1 && (
                      <Text style={styles.caption}>これまで{book.latest_iteration}回読了</Text>
                    )}
                    {review && (
                      <Text style={styles.excerpt}>
                        {review.iteration_number}回目・p.{review.page_number}：{reviewExcerpt(review.review_text, query)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  addButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.72)', borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', marginTop: 2, width: 40 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  search: { height: 52 },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 20 },
  month: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 30 },
  book: { alignItems: 'center', width: '46%', marginBottom: 10 },
  bookTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center', width: '100%' },
  caption: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  rereading: { color: colors.navAccent, fontSize: 12, fontWeight: '700', marginTop: 6 },
  excerpt: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 8 },
  message: { color: colors.textSecondary, fontSize: 14, marginBottom: 18 },
});
