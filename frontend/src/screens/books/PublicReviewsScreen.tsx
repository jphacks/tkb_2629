import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ActionButton } from '../../components/molecules/ActionButton';
import { BackButton } from '../../components/molecules/BackButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { getBook, getPublicReviews, type Book, type PublicReview } from '../../lib/api';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; book: Book; items: PublicReview[]; offset: number; hasMore: boolean };

export function publicReviewHiddenReason(book: Book, review: PublicReview): string | null {
  const page = book.reading_status === 'completed' ? book.total_pages
    : book.reading_status === 'reading' ? book.current_page : null;
  if (page === null || !Number.isInteger(page) || page < 0) {
    return review.contains_spoilers ? 'ネタバレあり・読書位置が不明' : '読書位置が不明';
  }
  if (review.page_number > page) {
    return review.contains_spoilers ? 'ネタバレあり・未読ページ' : '未読ページ';
  }
  return review.contains_spoilers ? 'ネタバレあり' : null;
}

export function PublicReviewsScreen({ bookId, onNavigate, onBack }: {
  bookId: number; onNavigate: Navigate; onBack?: () => void;
}) {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    const request = ++epoch.current;
    locked.current = false;
    setState({ status: 'loading' });
    setRevealed([]);
    setLoadingMore(false);
    setMoreError(null);
    async function load() {
      try {
        const book = await getBook(bookId);
        if (epoch.current !== request) return;
        if (!book.google_books_id) {
          setState({ status: 'ready', book, items: [], offset: 0, hasMore: false });
          return;
        }
        const result = await getPublicReviews(book.google_books_id);
        if (epoch.current !== request) return;
        setState({ status: 'ready', book, items: result.items, offset: result.items.length, hasMore: result.items.length === result.limit });
      } catch (reason: unknown) {
        if (epoch.current === request) {
          setState({ status: 'error', message: reason instanceof Error ? reason.message : '公開感想の取得に失敗しました。' });
        }
      }
    }
    void load();
    return () => { epoch.current += 1; };
  }, [bookId, version]);

  function refresh() {
    epoch.current += 1;
    setState({ status: 'loading' });
    setRevealed([]);
    setVersion((value) => value + 1);
  }

  async function loadMore() {
    if (locked.current || state.status !== 'ready' || !state.hasMore || !state.book.google_books_id) return;
    locked.current = true;
    const request = epoch.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await getPublicReviews(state.book.google_books_id, state.offset);
      if (epoch.current !== request) return;
      setState((current) => {
        if (current.status !== 'ready') return current;
        const existing = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          items: [...current.items, ...result.items.filter((item) => !existing.has(item.id))],
          offset: result.offset + result.items.length,
          hasMore: result.items.length === result.limit,
        };
      });
    } catch (reason: unknown) {
      if (epoch.current === request) {
        setMoreError(reason instanceof Error ? reason.message : '公開感想の追加取得に失敗しました。');
      }
    } finally {
      if (epoch.current === request) {
        locked.current = false;
        setLoadingMore(false);
      }
    }
  }

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="みんなの公開感想"
      headerLeading={<BackButton onPress={onBack ?? (() => onNavigate({ name: 'book-detail', bookId }))} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' && <Text style={styles.description}>公開感想を読み込んでいます…</Text>}
        {state.status === 'error' && (
          <>
            <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
            <ActionButton label="読み込みを再試行" onPress={refresh} />
          </>
        )}
        {state.status === 'ready' && (
          <>
            <Text style={styles.bookTitle}>{state.book.title}</Text>
            <Text style={styles.description}>同じGoogle Books IDの本への公開感想です。自分の投稿・過去の読書回も含み、更新が新しい順に表示します。</Text>
            <Text style={styles.description}>ネタバレあり・未読ページ・読書位置が不明な感想の本文は隠します。再読中は今回の読書位置で判定します。表示名が同じでも、同じ投稿者とは限りません。</Text>
            <ActionButton label="最新の情報に更新" onPress={refresh} secondary />
            {!state.book.google_books_id ? (
              <Text style={styles.description}>手動登録の本は公開感想の一覧に対応していません。</Text>
            ) : state.items.length === 0 ? (
              <Text style={styles.description}>公開感想はまだありません。公開用表示名が未設定の投稿者の感想も表示されません。</Text>
            ) : state.items.map((review) => {
              const reason = publicReviewHiddenReason(state.book, review);
              const hidden = reason !== null && !revealed.includes(review.id);
              return (
                <GlassSurface key={review.id} style={styles.card}>
                  <View style={styles.author}>
                    <View accessibilityRole="image" accessibilityLabel="本のデフォルトアイコン" style={styles.avatar}>
                      <Ionicons accessible={false} name="book-outline" size={24} color={colors.navAccent} />
                    </View>
                    <Text style={styles.name}>{review.public_display_name}</Text>
                  </View>
                  <Text style={styles.description}>{review.page_number}ページ · {review.iteration_number}回目の読書</Text>
                  <Text style={styles.description}>{review.contains_spoilers ? 'ネタバレあり' : 'ネタバレなし'}</Text>
                  {hidden ? (
                    <>
                      <Text style={styles.description}>{reason}のため本文を隠しています。</Text>
                      <ActionButton label="この感想を表示する" secondary onPress={() => setRevealed((current) => [...current, review.id])} />
                    </>
                  ) : (
                    <>
                      <Text style={styles.body}>{review.review_text}</Text>
                      {reason !== null && (
                        <ActionButton label="この感想を隠す" secondary onPress={() => setRevealed((current) => current.filter((id) => id !== review.id))} />
                      )}
                    </>
                  )}
                </GlassSurface>
              );
            })}
            {moreError && <Text accessibilityRole="alert" style={styles.error}>{moreError}</Text>}
            {state.hasMore && (
              <ActionButton label={loadingMore ? '読み込み中…' : moreError ? '追加の読み込みを再試行' : 'さらに読み込む'} disabled={loadingMore} onPress={() => { void loadMore(); }} />
            )}
            <Text style={styles.description}>投稿の変更により一覧の位置が変わる場合があります。最新の公開設定を確認するには更新してください。</Text>
          </>
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110, gap: 16 },
  bookTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  card: { padding: 18, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.48)', gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0EAF2', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16, lineHeight: 26 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
});
