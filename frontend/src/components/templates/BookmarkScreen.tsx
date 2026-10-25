import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getBook, getPageReview, reviewAnalysisLabel, savePageReview, setReviewVisibility, type Book, type PageReview, type ReviewVisibility } from '../../lib/api';
import { colors } from '../../theme/colors';
import { ActionButton } from '../molecules/ActionButton';
import { BackButton } from '../molecules/BackButton';
import { BookmarkCard } from '../organisms/BookmarkCard';
import { BookmarkRibbon } from '../organisms/BookmarkRibbon';
import { ScreenFrame } from '../organisms/ScreenFrame';
import type { Navigate } from '../../screens/types';

type BookmarkScreenProps = { bookId?: number; iteration?: number; initialPage?: number; onNavigate: Navigate; onBack?: () => void };

export function BookmarkScreen({ bookId, iteration, initialPage, onNavigate, onBack }: BookmarkScreenProps) {
  if (bookId === undefined || iteration === undefined) {
    return (
      <ScreenFrame activeRoute="bookmark" onNavigate={onNavigate} title="しおりを追加">
        <View style={styles.messageState}>
          <Text style={styles.message}>「今読んでる本」で本を選び、しおりボタンから記録してください。</Text>
          <ActionButton label="今読んでる本を開く" onPress={() => onNavigate('reading')} />
        </View>
      </ScreenFrame>
    );
  }
  return <SelectedBookmarkScreen key={`${bookId}:${iteration}:${initialPage ?? ''}`} bookId={bookId} iteration={iteration} initialPage={initialPage} onNavigate={onNavigate} onBack={onBack} />;
}

type BookState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; book: Book };

function SelectedBookmarkScreen({ bookId, iteration, initialPage, onNavigate, onBack }: BookmarkScreenProps & { bookId: number; iteration: number }) {
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
  const contentHeight = useRef(720);
  const [visibility, setVisibility] = useState<ReviewVisibility>('private');
  const savedDraft = useRef<PageReview | null>(null);

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
    setVisibility('private');
    savedDraft.current = null;
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
          setVisibility(review?.visibility ?? 'private');
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
      let saved = savedDraft.current ?? existing;
      if (!saved || saved.review_text !== text) {
        saved = await savePageReview(bookId, Number(page), iteration, text);
        savedDraft.current = saved;
      }
      if (saved.visibility !== visibility) {
        try {
          await setReviewVisibility(bookId, Number(page), iteration, visibility);
        } catch (reason) {
          const detail = reason instanceof Error ? reason.message : '公開設定の保存に失敗しました。';
          throw new Error(`感想本文は保存済みですが、公開設定を保存できませんでした。設定を確認してもう一度保存してください。\n${detail}`);
        }
        saved = { ...saved, visibility };
        savedDraft.current = saved;
      }
      if (!mounted.current) {
        return;
      }
      setResult(saved);
      setThoughts(saved.review_text);
      Animated.timing(translateY, { duration: 320, toValue: -Math.max(720, contentHeight.current + 104), useNativeDriver: true }).start(() => {
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
    setVisibility('private');
    savedDraft.current = null;
    setResult(null);
    setCompleted(false);
    setError(null);
    setBusy(false);
    locked.current = false;
    translateY.setValue(0);
  }

  if (!book) {
    return (
      <ScreenFrame activeRoute="bookmark" onNavigate={onNavigate} title="しおりを追加"
        headerLeading={<BackButton onPress={onBack ?? (() => onNavigate('reading'))} />}
      >
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
    <ScreenFrame activeRoute="bookmark" onNavigate={onNavigate} title={completed ? undefined : 'しおりを追加'} showNavigation={!busy || completed}
      headerLeading={!completed && <BackButton onPress={onBack ?? (() => onNavigate('reading'))} disabled={busy} />}
    >
      <View style={styles.content} onLayout={(event) => { contentHeight.current = event.nativeEvent.layout.height; }}>
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
              visibility={visibility}
              onVisibilityChange={setVisibility}
              error={error}
              color={result?.color_code ?? existing?.color_code}
              analysisLabel={result ? reviewAnalysisLabel(result) : existing ? reviewAnalysisLabel(existing) : undefined}
              onPageChange={(value) => {
                setPage(value);
                setLoaded(false);
                setExisting(null);
                setThoughts('');
                setVisibility('private');
                savedDraft.current = null;
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
          <ScrollView contentContainerStyle={styles.successState}>
            <Ionicons color={result.color_code} name="checkmark-circle" size={56} />
            <Text style={styles.successTitle}>しおりを{existing ? '更新' : '追加'}しました</Text>
            <Text style={styles.message}>「{book.title}」 {result.page_number}ページ・{iteration}回目</Text>
            <Text style={styles.message}>{reviewAnalysisLabel(result)}</Text>
            <View style={styles.successActions}>
              <ActionButton label="本の詳細へ" onPress={() => onNavigate({ name: 'book-detail', bookId })} />
              <ActionButton label="続けて他のページの感想も書く" secondary onPress={choosePage} />
            </View>
          </ScrollView>
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: colors.backgroundSoft, flex: 1, padding: 24, position: 'relative' },
  messageState: { gap: 16, padding: 24 },
  readOnlyHeader: { marginHorizontal: 24, marginTop: 8, gap: 4 },
  message: { color: colors.text, fontSize: 14, lineHeight: 22 },
  successState: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 48 },
  successActions: { width: '100%', maxWidth: 420, gap: 20, marginTop: 16 },
  successTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 14 },
});
