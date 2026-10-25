import { colors } from "../../theme/colors";
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BackButton } from '../../components/molecules/BackButton';
import { OwnedBookCover } from '../../components/molecules/OwnedBookCover';
import { BookCoverCustomizer } from '../../components/organisms/BookCoverCustomizer';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { EmotionAnalysisCard, getEmotionTint } from '../../components/organisms/EmotionAnalysisCard';
import { BookmarkListCard } from '../../components/organisms/BookmarkListCard';
import { CommunityBookmarks } from '../../components/organisms/CommunityBookmarks';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { ApiError, completeIteration, startIteration, getBook, getEmotionComparison, getBookReviews, getIterations, type Book, type EmotionComparison, type PageReview, type ReadingIteration } from '../../lib/api';
import { formatDate, iterationLabel } from '../../lib/readingStatus';
import type { Navigate } from '../types';

type BookDetailScreenProps = {
  bookId: number;
  onNavigate: Navigate;
  onBack?: () => void;
};

type BookDetailState =
  | { bookId: number; status: 'loading' }
  | { bookId: number; status: 'success'; book: Book }
  | { bookId: number; status: 'error'; message: string };

export function BookDetailScreen({ bookId, onNavigate, onBack }: BookDetailScreenProps) {
  const [state, setState] = useState<BookDetailState>({ bookId, status: 'loading' });
  const [coverOpen, setCoverOpen] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [reviews, setReviews] = useState<PageReview[] | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [emotions, setEmotions] = useState<EmotionComparison | null>(null);
  const [emotionError, setEmotionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [iterations, setIterations] = useState<ReadingIteration[] | null>(null);
  const [iterationError, setIterationError] = useState<string | null>(null);
  const [iterationVersion, setIterationVersion] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startLocked = useRef(false);
  const activeBook = useRef<number | null>(null);

  useEffect(() => {
    activeBook.current = bookId;
    setCoverOpen(false);
    startLocked.current = false;
    setStarting(false);
    setStartError(null);
    return () => { activeBook.current = null; };
  }, [bookId]);

  useEffect(() => {
    setCompleting(false);
    setCompleteError(null);
  }, [bookId]);
  useEffect(() => {
    let active = true;
    setState({ bookId, status: 'loading' });
    getBook(bookId)
      .then((book) => {
        if (active) {
          setState({ bookId, status: 'success', book });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setState({
            bookId,
            status: 'error',
            message: reason instanceof Error ? reason.message : '本の詳細の取得に失敗しました',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [bookId, requestVersion]);

  const book = state.bookId === bookId && state.status === 'success' ? state.book : null;
  useEffect(() => {
    let active = true;
    setReviews(null);
    setReviewError(null);
    if (!book) return;
    getBookReviews(bookId, book.latest_iteration).then((items) => {
      if (active) setReviews(items);
    }).catch((reason: unknown) => {
      if (active) setReviewError(reason instanceof Error ? reason.message : 'しおり一覧の取得に失敗しました');
    });
    return () => { active = false; };
  }, [book, bookId, reviewVersion]);
  useEffect(() => {
    let active = true;
    setEmotions(null);
    setEmotionError(null);
    if (!book) return;
    getEmotionComparison(bookId).then((summary) => {
      if (active) setEmotions(summary);
    }).catch((reason: unknown) => {
      if (active) setEmotionError(reason instanceof Error ? reason.message : '感情分析の取得に失敗しました');
    });
    return () => { active = false; };
  }, [book, bookId, reviewVersion]);
  useEffect(() => {
    let active = true;
    setIterations(null);
    setIterationError(null);
    if (!book) return;
    getIterations(bookId).then((items) => {
      if (active) setIterations(items);
    }).catch((reason: unknown) => {
      if (active) setIterationError(reason instanceof Error ? reason.message : '読書の記録の取得に失敗しました');
    });
    return () => { active = false; };
  }, [book, bookId, iterationVersion]);
  const emotionColor = emotions?.mine.color_code ?? '#8C8C8C';
  const emotionTint = getEmotionTint(emotionColor);
  const isReading = book?.reading_status === 'reading';

  async function complete(target: Book) {
    setCompleting(true);
    setCompleteError(null);
    try {
      await completeIteration(bookId, target.latest_iteration);
    } catch (reason: unknown) {
      // 409: already completed elsewhere, so just reload the latest state.
      if (!(reason instanceof ApiError && reason.status === 409)) {
        setCompleting(false);
        setCompleteError(reason instanceof Error ? reason.message : '読了の記録に失敗しました');
        return;
      }
    }
    setCompleting(false);
    setRequestVersion((version) => version + 1);
  }

  function confirmComplete(target: Book) {
    if (completing) return;
    Alert.alert(
      '読了にしますか？',
      `「${target.title}」を読了にします\nこの読書回のしおりは追加・編集できなくなります`,
      [
        { style: 'cancel', text: 'キャンセル' },
        { onPress: () => { void complete(target); }, text: '読了にする' },
      ],
    );
  }

  async function startRereading(target: Book) {
    if (startLocked.current || activeBook.current !== target.id) return;
    startLocked.current = true;
    setStarting(true);
    setStartError(null);
    try {
      await startIteration(target.id);
      if (activeBook.current !== target.id) return;
      setState({ bookId: target.id, status: 'loading' });
      setRequestVersion((version) => version + 1);
    } catch (reason: unknown) {
      if (activeBook.current === target.id) {
        setStartError(reason instanceof Error ? reason.message : '再読の開始に失敗しました');
      }
    } finally {
      if (activeBook.current === target.id) {
        startLocked.current = false;
        setStarting(false);
      }
    }
  }

  function confirmRereading(target: Book) {
    if (startLocked.current) return;
    Alert.alert(
      'もう一度読みますか？',
      `「${target.title}」の${target.latest_iteration + 1}回目の読書を始めます\n過去のしおりは残ります`,
      [
        { style: 'cancel', text: 'キャンセル' },
        { text: 'もう一度読む', onPress: () => { void startRereading(target); } },
      ],
    );
  }

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の詳細"
      headerLeading={onBack && <BackButton onPress={onBack} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {(state.bookId !== bookId || state.status === 'loading') && (
          <Text style={styles.message}>本の詳細を読み込んでいます…</Text>
        )}
        {state.bookId === bookId && state.status === 'error' && (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={styles.message}>{state.message}</Text>
            <ActionButton label="再試行" onPress={() => {
              setState({ bookId, status: 'loading' });
              setRequestVersion((version) => version + 1);
            }} />
          </View>
        )}
        {book && (
          <>
            <GlassSurface style={styles.hero}>
              <Pressable accessibilityLabel="本のメモを開く" accessibilityRole="button" onPress={() => onNavigate({ name: 'book-memo', bookId })} style={styles.editButton}>
                <Ionicons color={colors.navAccent} name="pencil" size={22} />
              </Pressable>
              <Pressable accessibilityLabel="表紙をカスタマイズ" accessibilityRole="button"
                accessibilityState={{ expanded: coverOpen }} onPress={() => setCoverOpen(true)}
                style={styles.coverButton}>
                <Ionicons color={colors.navAccent} name="color-palette" size={25} />
              </Pressable>
              <OwnedBookCover large book={book} />
              <View style={styles.info}>
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.author}>{book.author ?? '著者不明'}</Text>
                <Text style={styles.status}>{book.latest_iteration}回目・{isReading ? '読書中' : '読了'}</Text>
              </View>
            </GlassSurface>
            <BookCoverCustomizer key={book.id} book={book} summary={emotions} emotionError={emotionError}
              open={coverOpen} onOpenChange={setCoverOpen}
              onRetryEmotions={() => setReviewVersion((value) => value + 1)}
              onSaved={(style) => setState((current) => current.bookId === bookId && current.status === 'success'
                ? { ...current, book: { ...current.book, cover_style: style } } : current)} />
            {book.reading_status === 'completed' && (
              <GlassSurface style={styles.card}>
                <ActionButton
                  label={starting ? '再読を開始しています…' : 'もう一度読む'}
                  onPress={starting ? undefined : () => confirmRereading(book)}
                />
                {startError && <Text accessibilityRole="alert" style={styles.message}>{startError}</Text>}
              </GlassSurface>
            )}
            {isReading && (
              <GlassSurface style={styles.card}>
                <ReadingProgress color={emotionColor} currentPage={book.current_page} totalPages={book.total_pages} />
                <View style={styles.completeAction}>
                  <ActionButton
                    label={completing ? '読了にしています…' : '読了にする'}
                    onPress={completing ? undefined : () => confirmComplete(book)}
                    secondary
                  />
                </View>
                {completeError && <Text accessibilityRole="alert" style={styles.message}>{completeError}</Text>}
              </GlassSurface>
            )}
            {iterationError && (
              <View style={styles.error}>
                <Text accessibilityRole="alert" style={styles.message}>{iterationError}</Text>
                <ActionButton label="読書の記録を再試行" onPress={() => setIterationVersion((version) => version + 1)} />
              </View>
            )}
            {iterations && iterations.length > 0 && (
              <GlassSurface style={styles.card}>
                <Text style={styles.historyTitle}>読書の記録</Text>
                {formatDate(iterations[0]?.started_at) && (
                  <Text style={styles.historyRow}>{formatDate(iterations[0]?.started_at)} 本棚に追加</Text>
                )}
                {iterations.map((iteration) => (
                  <Text key={iteration.iteration_number} style={styles.historyRow}>
                    {iteration.iteration_number}回目　{iterationLabel(iteration)}
                  </Text>
                ))}
              </GlassSurface>
            )}
              <BookmarkListCard
                key={`${bookId}:${book.latest_iteration}`}
                reviews={reviews ?? []}
                ownFallback={!reviews ? reviewError ? (
                  <View style={styles.error}>
                    <Text accessibilityRole="alert" style={styles.message}>{reviewError}</Text>
                    <ActionButton label="しおり一覧を再試行" onPress={() => setReviewVersion((version) => version + 1)} />
                  </View>
                ) : <Text style={styles.message}>しおりを読み込んでいます…</Text> : undefined}
                community={(page) => <CommunityBookmarks key={`${bookId}:${page ?? 'all'}`} bookId={bookId} initialPage={page} />}
                currentPage={book.current_page}
                onOpen={(page) => onNavigate({ name: 'bookmark', bookId, iteration: book.latest_iteration, page })}
                accentColor={colors.navAccent}
                tintColor={colors.backgroundSoft}
              />
            {!emotions && !emotionError && <Text style={styles.message}>感情分析を読み込んでいます…</Text>}
            {emotionError && (
              <View style={styles.error}>
                <Text accessibilityRole="alert" style={styles.message}>{emotionError}</Text>
                <ActionButton label="感情分析を再試行" onPress={() => setReviewVersion((version) => version + 1)} />
              </View>
            )}
            {emotions && <EmotionAnalysisCard summary={emotions} />}
          </>
        )}
      </ScrollView>
      {book && isReading && (
        <FloatingActionButton onPress={() => onNavigate({
          name: 'bookmark',
          bookId,
          iteration: book.latest_iteration,
        })} />
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  hero: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 20, flexDirection: 'row', marginTop: 8, padding: 18, position: 'relative' },
  info: { flex: 1, marginLeft: 18, paddingRight: 48, justifyContent: 'center' },
  editButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 22, elevation: 2, height: 44, justifyContent: 'center', position: 'absolute', right: 14, top: 14, width: 44 },
  coverButton: { alignItems: 'center', backgroundColor: colors.backgroundSoft, borderColor: colors.navAccent, borderWidth: 1, borderRadius: 22, height: 44, justifyContent: 'center', position: 'absolute', right: 14, top: 66, width: 44 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700'},
  author: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  status: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  message: { color: colors.placeholder, fontSize: 14, marginTop: 16 },
  error: { gap: 16 },
  completeAction: { marginTop: 16 },
  historyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  historyRow: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
});
