import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookStack } from '../../components/molecules/BookStack';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { MyThoughtCard } from '../../components/molecules/MyThoughtCard';
import { ActionButton } from '../../components/molecules/ActionButton';
import { myBookmarks } from '../../components/organisms/BookmarkListCard';
import { getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { loadAllBooks, loadReadingBooks } from '../../lib/readingBooks';
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
  const myThought = myBookmarks[0];
  const emotionColor = myThought?.color ?? '#8C8C8C';
  const emotionTint = getEmotionTint(emotionColor);
  const [opening, setOpening] = useState(false);

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
          message: reason instanceof Error ? reason.message : '読了冊数の取得に失敗しました。',
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [version]);

  // One reading book: open its bookmark input directly. Otherwise let the user choose on 今読んでいる本.
  async function openBookmark() {
    if (opening) return;
    setOpening(true);
    try {
      const books = await loadReadingBooks();
      const [book] = books ?? [];
      if (books?.length === 1 && book) {
        onNavigate({ name: 'bookmark', bookId: book.id, iteration: book.latest_iteration });
        return;
      }
    } catch {
      // The reading screen shows the error and a retry button.
    }
    setOpening(false);
    onNavigate('reading');
  }

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
          {myThought && (
            <MyThoughtCard
              emotionColor={emotionColor}
              emotionTint={emotionTint}
              note={myThought.note}
              onPress={() => onNavigate({ name: 'book-detail', bookId: 1 })}
            />
          )}
        </ScrollView>
        <FloatingActionButton onPress={openBookmark} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 100 },
  message: { color: colors.textSecondary, padding: 20 },
  feedback: { padding: 20, gap: 12 },
  previewChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.borderMuted },
  previewSelected: { backgroundColor: '#F0EAF2', borderColor: colors.navAccent },
  previewText: { color: colors.text, fontSize: 13 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
