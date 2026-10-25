import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ActionButton } from '../../components/molecules/ActionButton';
import { BackButton } from '../../components/molecules/BackButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import { BOOK_MEMO_LIMIT, getBookMemo, saveBookMemo } from '../../lib/api';
import { colors } from '../../theme/colors';
import type { Navigate } from '../types';

type MemoState =
  | { bookId: number; status: 'loading' }
  | { bookId: number; status: 'error'; message: string }
  | { bookId: number; status: 'ready'; saved: string };

export function BookMemoScreen({ bookId, onNavigate, onBack }: {
  bookId: number; onNavigate: Navigate; onBack?: () => void;
}) {
  const [state, setState] = useState<MemoState>({ bookId, status: 'loading' });
  const [content, setContent] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const epoch = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    const request = ++epoch.current;
    locked.current = false;
    setBusy(false);
    setError(null);
    setMessage(null);
    setConfirmDiscard(false);
    setContent('');
    setState({ bookId, status: 'loading' });
    getBookMemo(bookId).then((memo) => {
      if (request !== epoch.current) return;
      setContent(memo.content);
      setState({ bookId, status: 'ready', saved: memo.content });
    }).catch((reason: unknown) => {
      if (request === epoch.current) setState({
        bookId, status: 'error', message: reason instanceof Error ? reason.message : 'メモの取得に失敗しました',
      });
    });
    return () => { epoch.current += 1; };
  }, [bookId, version]);

  const ready = state.bookId === bookId && state.status === 'ready';
  const dirty = ready && state.saved !== content;
  const count = Array.from(content).length;
  const back = onBack ?? (() => onNavigate({ name: 'book-detail', bookId }));

  async function save() {
    if (locked.current || !ready) return;
    setMessage(null);
    if (count > BOOK_MEMO_LIMIT) {
      setError('メモは10,000文字以内で入力してください');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    setConfirmDiscard(false);
    const request = epoch.current;
    try {
      const memo = await saveBookMemo(bookId, content);
      if (request !== epoch.current) return;
      setContent(memo.content);
      setState({ bookId, status: 'ready', saved: memo.content });
      setMessage(memo.content ? 'メモを保存しました' : 'メモを削除しました');
    } catch (reason: unknown) {
      if (request === epoch.current) setError(reason instanceof Error ? reason.message : 'メモの保存に失敗しました');
    } finally {
      if (request === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本のメモ"
      showNavigation={!busy && !dirty}
      headerLeading={<BackButton disabled={busy} onPress={() => {
        if (locked.current) return;
        if (dirty) setConfirmDiscard(true);
        else back();
      }} />}
    >
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>{'この本について自由に残せる、自分だけのメモです\n公開したしおりには表示されません\n再読しても同じメモを使えます'}</Text>
          {(state.bookId !== bookId || state.status === 'loading') && <Text style={styles.description}>メモを読み込んでいます…</Text>}
          {state.bookId === bookId && state.status === 'error' && <>
            <Text accessibilityRole="alert" style={styles.error}>{state.message}</Text>
            <ActionButton label="読み込みを再試行" onPress={() => setVersion((value) => value + 1)} />
          </>}
          {ready && <>
            <ShadowInput accessibilityLabel="自分だけの本のメモ" multiline textAlignVertical="top"
              placeholder="気になることや、あとで読み返したいことなど"
              value={content} editable={!busy} style={styles.input}
              onChangeText={(value) => { setContent(value); setError(null); setMessage(null); setConfirmDiscard(false); }}
            />
            <Text style={[styles.counter, count > BOOK_MEMO_LIMIT && styles.error]}>{count.toLocaleString()} / 10,000文字</Text>
            <Text style={styles.description}>内容を空にして保存すると、メモを削除できます</Text>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {message && <Text accessibilityRole="alert" style={styles.description}>{message}</Text>}
            <ActionButton disabled={busy || !dirty} label={busy ? '保存中…' : 'メモを保存'} onPress={() => { void save(); }} />
            {confirmDiscard && <View style={styles.confirmation}>
              <Text accessibilityRole="alert" style={styles.description}>保存していない変更があります</Text>
              <ActionButton secondary label="編集を続ける" onPress={() => setConfirmDiscard(false)} />
              <ActionButton secondary label="保存せずに戻る" onPress={back} />
            </View>}
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 110, gap: 16 },
  description: { color: colors.text, fontSize: 14, lineHeight: 22 },
  input: { minHeight: 240, paddingTop: 16, paddingBottom: 16 },
  counter: { color: colors.textSecondary, fontSize: 12, textAlign: 'right' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 22 },
  confirmation: { gap: 12, borderColor: colors.navAccent, borderWidth: 1, borderRadius: 16, padding: 16 },
});
