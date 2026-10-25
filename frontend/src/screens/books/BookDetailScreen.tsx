import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import {
  completeReadingIteration,
  getBook,
  getPagePopularity,
  getReadingIterations,
  startReadingIteration,
  type Book,
  type PagePopularity,
  type ReadingIteration,
} from '../../lib/api';
import type { ScreenKey } from '../types';

type BookDetailScreenProps = {
  book: Book | null;
  onNavigate: (route: ScreenKey) => void;
  onOpenBookmark: (book: Book, iterationNumber: number) => void;
  onReadingCompleted: (book: Book, iterationNumber: number) => void;
};

export function BookDetailScreen({
  book: initialBook,
  onNavigate,
  onOpenBookmark,
  onReadingCompleted,
}: BookDetailScreenProps) {
  const [book, setBook] = useState(initialBook);
  const [iterations, setIterations] = useState<ReadingIteration[]>([]);
  const [selectedIteration, setSelectedIteration] = useState<number | null>(
    initialBook?.latest_iteration ?? null,
  );
  const [popularity, setPopularity] = useState<PagePopularity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!initialBook) {
      return;
    }
    try {
      const [nextBook, nextIterations, nextPopularity] = await Promise.all([
        getBook(initialBook.id),
        getReadingIterations(initialBook.id),
        getPagePopularity(initialBook.id),
      ]);
      setBook(nextBook);
      setIterations(nextIterations);
      setPopularity(nextPopularity);
      setSelectedIteration((current) => current ?? nextBook.latest_iteration);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '本の情報を取得できませんでした。');
    }
  }, [initialBook]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => iterations.find((item) => item.iteration_number === selectedIteration) ?? null,
    [iterations, selectedIteration],
  );
  const latest = iterations[iterations.length - 1] ?? null;
  const maxUsers = Math.max(1, ...popularity.map((item) => item.user_count));

  const startReread = async () => {
    if (!book) {
      return;
    }
    setBusy(true);
    try {
      const created = await startReadingIteration(book.id);
      await load();
      setSelectedIteration(created.iteration_number);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '再読を開始できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const completeReading = async () => {
    if (!book || !selected) {
      return;
    }
    setBusy(true);
    try {
      await completeReadingIteration(book.id, selected.iteration_number);
      const nextBook = await getBook(book.id);
      setBook(nextBook);
      onReadingCompleted(nextBook, selected.iteration_number);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '読了を記録できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の詳細">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BookCover
            large
            author={book?.author ?? '著者名'}
            title={book?.title ?? '星の旅'}
          />
          <Text style={styles.title}>{book?.title ?? '星の旅'}</Text>
          <Text style={styles.author}>{book?.author ?? '著者名'}</Text>
          <Text style={styles.publisher}>出版社 ・ 2025年</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>あらすじ</Text>
          <Text style={styles.body}>
            本の紹介文がここに入ります。物語の概要や本の特徴を確認できます。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>読書状況</Text>
          <Text style={styles.body}>
            {book ? `${book.current_page} / ${book.total_pages}ページ` : '42 / 180ページ ・ 23%読了'}
          </Text>
        </View>

        {book && (
          <>
            <View style={styles.card}>
              <Text style={styles.heading}>読書回</Text>
              <View style={styles.iterationRow}>
                {iterations.map((item) => (
                  <Pressable
                    key={item.iteration_number}
                    onPress={() => setSelectedIteration(item.iteration_number)}
                    style={[
                      styles.iterationChip,
                      item.iteration_number === selectedIteration && styles.iterationChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.iterationChipText,
                        item.iteration_number === selectedIteration && styles.iterationChipTextActive,
                      ]}
                    >
                      {item.iteration_number}回目
                    </Text>
                  </Pressable>
                ))}
              </View>
              {selected && (
                <Text style={styles.body}>
                  {selected.status === 'completed' ? '読了' : '読書中'} ・ {selected.current_page} / {book.total_pages}ページ
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>感想が多いページ</Text>
              <Text style={styles.caption}>各ユーザーの最新の読書回だけを集計しています。</Text>
              {popularity.length === 0 && <Text style={styles.body}>まだ感想はありません。</Text>}
              {popularity.map((point) => (
                <View key={point.page_number} style={styles.graphRow}>
                  <Text style={styles.pageLabel}>{point.page_number}p</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        { width: `${Math.max(8, (point.user_count / maxUsers) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.countLabel}>{point.user_count}人</Text>
                </View>
              ))}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
            {selected?.status === 'reading' && (
              <>
                <Pressable
                  disabled={busy}
                  onPress={() => onOpenBookmark(book, selected.iteration_number)}
                  style={[
                    styles.primaryButton,
                    busy && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>この回にしおりを追加</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={completeReading}
                  style={[styles.secondaryButton, busy && styles.disabledButton]}
                >
                  <Text style={styles.secondaryButtonText}>この回を読了にする</Text>
                </Pressable>
              </>
            )}
            {latest?.status === 'completed' && (
              <Pressable
                disabled={busy}
                onPress={startReread}
                style={[styles.primaryButton, busy && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{latest.iteration_number + 1}回目の読書を始める</Text>
              </Pressable>
            )}
          </>
        )}

        {!book && error && <Text style={styles.error}>{error}</Text>}
        <ActionButton
          label="本を編集する"
          onPress={() => onNavigate('book-edit')}
          secondary
        />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  hero: { alignItems: 'center', backgroundColor: '#FFF0F0', borderRadius: 20, marginTop: 8, padding: 24 },
  title: { color: '#464646', fontSize: 24, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  author: { color: '#777777', fontSize: 14, marginTop: 8 },
  publisher: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  heading: { color: '#464646', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  body: { color: '#777777', fontSize: 14, lineHeight: 22 },
  caption: { color: '#9CA3AF', fontSize: 12, marginBottom: 14 },
  iterationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iterationChip: { backgroundColor: '#FFF0F0', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  iterationChipActive: { backgroundColor: '#FF7171' },
  iterationChipText: { color: '#777777', fontSize: 13, fontWeight: '700' },
  iterationChipTextActive: { color: '#FFFFFF' },
  graphRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  pageLabel: { color: '#777777', fontSize: 12, width: 42 },
  barTrack: { backgroundColor: '#F3F4F6', borderRadius: 6, flex: 1, height: 12, overflow: 'hidden' },
  bar: { backgroundColor: '#C17AED', borderRadius: 6, height: 12 },
  countLabel: { color: '#777777', fontSize: 12, textAlign: 'right', width: 32 },
  primaryButton: { alignItems: 'center', backgroundColor: '#FF7171', borderRadius: 12, justifyContent: 'center', marginTop: 16, minHeight: 54, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { alignItems: 'center', borderColor: '#FF7171', borderRadius: 12, borderWidth: 1, justifyContent: 'center', marginTop: 12, minHeight: 54, paddingHorizontal: 18 },
  secondaryButtonText: { color: '#FF7171', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  error: { color: '#B42318', fontSize: 13, marginTop: 16 },
});
