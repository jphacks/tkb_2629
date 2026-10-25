import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { getBook, getPageReview, reviewAnalysisLabel, savePageReview, type Book, type PageReview } from '../../lib/api';
import { colors } from '../../theme/colors';
import { ActionButton } from '../molecules/ActionButton';
import { BookmarkCard } from '../organisms/BookmarkCard';
import { BookmarkRibbon } from '../organisms/BookmarkRibbon';
import { BottomNavigation } from '../organisms/BottomNavigation';
import { ScreenFrame } from '../organisms/ScreenFrame';
import type { Navigate } from '../../screens/types';

type BookmarkScreenProps = { bookId?: number; iteration?: number; initialPage?: number; onNavigate: Navigate };

export function BookmarkScreen({ bookId, iteration, initialPage, onNavigate }: BookmarkScreenProps) {
  if (bookId === undefined || iteration === undefined) {
    return (
      <ScreenFrame activeRoute="bookmark" onNavigate={onNavigate} title="しおりを追加">
        <View style={styles.messageState}>
          <Text style={styles.message}>本棚で本を選び、詳細のしおりボタンから記録してください。</Text>
          <ActionButton label="本棚で本を選ぶ" onPress={() => onNavigate('bookshelf')} />
        </View>
      </ScreenFrame>
    );
  }
  return <SelectedBookmarkScreen key={`${bookId}:${iteration}:${initialPage ?? ''}`} bookId={bookId} iteration={iteration} initialPage={initialPage} onNavigate={onNavigate} />;
}

type BookState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; book: Book };

function SelectedBookmarkScreen({ bookId, iteration, initialPage, onNavigate }: BookmarkScreenProps & { bookId: number; iteration: number }) {
  const [bookState, setBookState] = useState<BookState>({ status: 'loading' });
  const [requestVersion, setRequestVersion] = useState(0);
  const [pageVersion, setPageVersion] = useState(0);
  const [page, setPage] = useState(initialPage === undefined ? '' : String(initialPage));
  const [thoughts, setThoughts] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState<PageReview | null>(null);
  const [result, setResult] = useState<PageReview | null>(null);
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      translateY.stopAnimation();
    };
  }, [translateY]);

  useEffect(() => {
    let active = true;
    setBookState({ status: 'loading' });
    getBook(bookId).then((book) => {
      if (active) {
        setBookState({ status: 'success', book });
      }
    }).catch((reason: unknown) => {
      if (active) {
        setBookState({
          status: 'error',
          message: reason instanceof Error ? reason.message : '本の取得に失敗しました。',
        });
      }
    });
    return () => {
      active = false;
    };
  }, [bookId, requestVersion]);

  const book = bookState.status === 'success' ? bookState.book : null;
  const canEdit = book?.reading_status === 'reading' && book.latest_iteration === iteration;

  useEffect(() => {
    if (!book) {
      return;
    }
    let active = true;
    setLoaded(false);
    setExisting(null);
    setThoughts('');
    setError(null);
    if (!page.trim()) return;
    const pageNumber = Number(page.trim());
    if (!/^\d+$/.test(page.trim()) || !Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > book.total_pages) {
      setError(`ページは1〜${book.total_pages}の整数を入力してください。`);
      return;
    }
    const timer = setTimeout(() => {
      getPageReview(bookId, pageNumber, iteration).then((review) => {
        if (active) {
          setExisting(review);
          setThoughts(review?.review_text ?? '');
          setLoaded(true);
        }
      }).catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'しおりの取得に失敗しました。');
        }
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [book, bookId, iteration, page, pageVersion, canEdit]);

  async function save() {
    if (locked.current || !loaded || !canEdit) {
      return;
    }
    const text = thoughts.trim();
    if (Array.from(text).length < 1 || Array.from(text).length > 140) {
      setError('感想は前後の空白を除いて1〜140文字で入力してください。');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const saved = await savePageReview(bookId, Number(page), iteration, text);
      if (!mounted.current) {
        return;
      }
      setResult(saved);
      setThoughts(saved.review_text);
      Animated.timing(translateY, { duration: 600, toValue: -720, useNativeDriver: true }).start(() => {
        if (mounted.current) {
          setCompleted(true);
        }
      });
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : 'しおりの保存に失敗しました。');
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        setBusy(false);
      }
      locked.current = false;
    }
  }

  function choosePage() {
    setPage('');
    setLoaded(false);
    setExisting(null);
    setThoughts('');
    setResult(null);
    setCompleted(false);
    setError(null);
    setBusy(false);
    locked.current = false;
    translateY.setValue(0);
  }

  if (!book) {
    return (
      <ScreenFrame activeRoute="bookmark" onNavigate={onNavigate} title="しおりを追加">
        <View style={styles.messageState}>
          {bookState.status === 'loading' && <Text style={styles.message}>本を読み込んでいます…</Text>}
          {bookState.status === 'error' && (
            <>
              <Text accessibilityRole="alert" style={styles.message}>{bookState.message}</Text>
              <ActionButton label="再試行" onPress={() => setRequestVersion((version) => version + 1)} />
            </>
          )}
          <ActionButton label="本の詳細へ" secondary onPress={() => onNavigate({ name: 'book-detail', bookId })} />
        </View>
      </ScreenFrame>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {!completed && (
          <>
            {canEdit && <BookmarkRibbon translateY={translateY} color={result?.color_code ?? existing?.color_code} />}
            <BookmarkCard
              translateY={translateY}
              title={book.title}
              page={page}
              thoughts={thoughts}
              loaded={loaded}
              updating={existing !== null}
              busy={busy}
              readOnly={!canEdit}
              error={error}
              color={result?.color_code ?? existing?.color_code}
              analysisLabel={result ? reviewAnalysisLabel(result) : existing ? reviewAnalysisLabel(existing) : undefined}
              onPageChange={(value) => {
                setPage(value);
                setLoaded(false);
                setExisting(null);
                setThoughts('');
                setError(null);
              }}
              onThoughtsChange={(value) => { setThoughts(value); setError(null); }}
              onRetry={() => setPageVersion((version) => version + 1)}
              onSubmit={save}
            />
            {!canEdit && (
              <View style={styles.readOnlyHeader}>
                <Text style={styles.message}>閲覧専用（編集不可）</Text>
                <ActionButton label="本の詳細へ" secondary onPress={() => onNavigate({ name: 'book-detail', bookId })} />
              </View>
            )}
          </>
        )}
        {completed && result && (
          <View style={styles.successState}>
            <Ionicons color={result.color_code} name="checkmark-circle" size={56} />
            <Text style={styles.successTitle}>しおりを{existing ? '更新' : '追加'}しました</Text>
            <Text style={styles.message}>「{book.title}」 {result.page_number}ページ・{iteration}回目</Text>
            <Text style={styles.message}>{reviewAnalysisLabel(result)}</Text>
            <ActionButton label="本の詳細へ" onPress={() => onNavigate({ name: 'book-detail', bookId })} />
            <ActionButton label="別のページに記録する" secondary onPress={choosePage} />
          </View>
        )}
        {(!busy || completed) && <BottomNavigation activeRoute="bookmark" onNavigate={onNavigate} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F7F4FF', flex: 1 },
  screen: { backgroundColor: '#F7F4FF', flex: 1 },
  messageState: { padding: 24, gap: 16 },
  readOnlyHeader: { marginHorizontal: 24, marginTop: 8, gap: 4 },
  message: { color: colors.text, fontSize: 14, lineHeight: 22 },
  successState: { gap: 16, left: 24, position: 'absolute', right: 24, top: 160 },
  successTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
