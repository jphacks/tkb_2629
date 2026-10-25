import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookStack } from '../../components/molecules/BookStack';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { ReadingBookCard } from '../../components/molecules/ReadingBookCard';
import { ActionButton } from '../../components/molecules/ActionButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getContinueReadingBooks, type Book } from '../../lib/api';
import { loadAllBooks } from '../../lib/readingBooks';
import { completedReadCount } from '../../lib/readingStatus';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

export function HomeScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [readCount, setReadCount] = useState<
    { status: 'loading' } | { status: 'ready'; count: number } | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const displayingPreview = __DEV__ && previewCount !== null;
  const [recent, setRecent] = useState<
    { status: 'loading' } | { status: 'ready'; books: Book[] } | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [recentVersion, setRecentVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setReadCount({ status: 'loading' });
    async function load() {
      try {
        const books = await loadAllBooks(() => active);
        if (active && books) setReadCount({ status: 'ready', count: completedReadCount(books) });
      } catch (reason: unknown) {
        if (active) setReadCount({
          status: 'error',
          message: reason instanceof Error ? reason.message : '読了冊数の取得に失敗しました',
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [version]);

  useEffect(() => {
    let active = true;
    setRecent({ status: 'loading' });
    getContinueReadingBooks()
      .then((books) => {
        if (active) setRecent({ status: 'ready', books });
      })
      .catch((reason: unknown) => {
        if (active) setRecent({
          status: 'error',
          message: reason instanceof Error ? reason.message : '読書中の本の取得に失敗しました',
        });
      });
    return () => { active = false; };
  }, [recentVersion]);

  return (
    <ScreenFrame activeRoute="home" onNavigate={onNavigate} title="ホーム" subtitle="あなたの読書を、もっと身近に">
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content}>
          {__DEV__ && <View style={styles.feedback}>
            <Text style={styles.message}>開発用・タワーの表示確認</Text>
            <View style={styles.previewChoices}>
              {[0, 1, 10, 100, 1000].map((count) => <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityLabel={`${count}冊のタワーを確認`}
                accessibilityState={{ selected: previewCount === count }}
                onPress={() => setPreviewCount(count)}
                style={[styles.previewButton, previewCount === count && styles.previewSelected]}
              ><Text style={styles.previewText}>{count}冊</Text></Pressable>)}
            </View>
            {displayingPreview && <>
              <Text accessibilityLiveRegion="polite" style={styles.previewText}>表示確認中・実データは変更されません</Text>
              <ActionButton label="実際の冊数に戻す" secondary onPress={() => setPreviewCount(null)} />
            </>}
          </View>}
          {readCount.status === 'loading' && <Text style={styles.message}>読了冊数を読み込み中…</Text>}
          {readCount.status === 'error' && <View style={styles.feedback}>
            <Text accessibilityRole="alert" style={styles.error}>{readCount.message}</Text>
            <ActionButton label="読了冊数を再読み込み" onPress={() => setVersion((value) => value + 1)} secondary />
          </View>}
          {displayingPreview ? <BookStack count={previewCount} /> : readCount.status === 'ready' && <BookStack count={readCount.count} />}
          <View style={styles.recent}>
            <Text accessibilityRole="header" style={styles.heading}>続きを読む</Text>
            <Text style={styles.description}>最近しおりを保存した本から表示しています</Text>
            {recent.status === 'loading' && <Text style={styles.description}>読書中の本を読み込み中…</Text>}
            {recent.status === 'error' && <>
              <Text accessibilityRole="alert" style={styles.error}>{recent.message}</Text>
              <ActionButton label="続きを読むを再読み込み" onPress={() => setRecentVersion((value) => value + 1)} secondary />
            </>}
            {recent.status === 'ready' && recent.books.length === 0 && <>
              <Text style={styles.description}>{"読書中の本はありません\n本を追加して、読書を始めましょう"}</Text>
              <ActionButton label="本を探す" onPress={() => onNavigate('search')} />
            </>}
            {recent.status === 'ready' && recent.books.map((book) => (
              <ReadingBookCard
                book={book}
                key={book.id}
                onPress={() => onNavigate({ name: 'book-detail', bookId: book.id })}
                onBookmark={() => onNavigate({ name: 'bookmark', bookId: book.id, iteration: book.latest_iteration })}
              />
            ))}
            <ActionButton label="今読んでいる本をすべて見る" onPress={() => onNavigate('reading')} secondary />
          </View>
        </ScrollView>
        <FloatingActionButton onPress={() => onNavigate('bookmark-book-select')} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 100 },
  message: { color: colors.textSecondary, padding: 20 },
  feedback: { padding: 20, gap: 12 },
  recent: { padding: 24, gap: 12 },
  heading: { color: colors.text, fontSize: 20, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  previewChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.borderMuted },
  previewSelected: { backgroundColor: '#F0EAF2', borderColor: colors.navAccent },
  previewText: { color: colors.text, fontSize: 13 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
