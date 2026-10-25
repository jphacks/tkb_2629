import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getReviewReactions, setReviewReaction, type ReactionKind, type ReviewReactions } from '../../lib/api';
import { colors } from '../../theme/colors';

const reactions = [
  { kind: 'empathy', label: '共感した', icon: 'heart-outline', selectedIcon: 'heart', color: colors.navAccent, background: colors.backgroundSoft },
  { kind: 'insight', label: 'なるほど', icon: 'bulb-outline', selectedIcon: 'bulb', color: colors.navAccent, background: colors.backgroundSoft },
  { kind: 'curious', label: '気になる', icon: 'eye-outline', selectedIcon: 'eye', color: colors.navAccent, background: colors.backgroundSoft },
] as const;

type State = {
  key: string;
  summary: ReviewReactions | null;
  busy: boolean;
  error: string | null;
};

export function ReviewReactionBar({ googleBooksId, reviewId }: { googleBooksId: string; reviewId: number }) {
  const key = `${googleBooksId}:${reviewId}`;
  const [state, setState] = useState<State>({ key, summary: null, busy: true, error: null });
  const [version, setVersion] = useState(0);
  const epoch = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    const request = ++epoch.current;
    locked.current = true;
    setState({ key, summary: null, busy: true, error: null });
    async function load() {
      try {
        const summary = await getReviewReactions(googleBooksId, reviewId);
        if (request === epoch.current) setState({ key, summary, busy: false, error: null });
      } catch (reason: unknown) {
        if (request === epoch.current) setState({
          key, summary: null, busy: false,
          error: reason instanceof Error ? reason.message : 'リアクションの取得に失敗しました',
        });
      } finally {
        if (request === epoch.current) locked.current = false;
      }
    }
    void load();
    return () => { epoch.current += 1; };
  }, [googleBooksId, reviewId, key, version]);

  async function react(kind: ReactionKind) {
    if (locked.current || state.key !== key || !state.summary || state.error) return;
    locked.current = true;
    const request = epoch.current;
    setState((current) => ({ ...current, busy: true }));
    try {
      const summary = await setReviewReaction(
        googleBooksId, reviewId, state.summary.my_reaction === kind ? null : kind,
      );
      if (request === epoch.current) setState({ key, summary, busy: false, error: null });
    } catch (reason: unknown) {
      if (request === epoch.current) setState((current) => ({
        ...current, busy: false,
        error: reason instanceof Error ? reason.message : 'リアクションの更新に失敗しました',
      }));
    } finally {
      if (request === epoch.current) locked.current = false;
    }
  }

  const current = state.key === key ? state : null;
  return (
    <View style={styles.content}>
      <View style={styles.row}>
        {reactions.map((reaction) => {
          const selected = current?.summary?.my_reaction === reaction.kind;
          const count = current?.summary?.counts[reaction.kind];
          const disabled = !current?.summary || current.busy || current.error !== null;
          return (
            <Pressable
              key={reaction.kind}
              accessibilityRole="button"
              accessibilityLabel={`${reaction.label}、${count === undefined ? '件数読み込み前' : `${count}件`}`}
              accessibilityHint={selected ? 'もう一度押すと取り消します' : 'このリアクションを付けます'}
              accessibilityState={{ selected, disabled, busy: current?.busy ?? true }}
              disabled={disabled}
              onPress={() => { void react(reaction.kind); }}
              style={[styles.button, selected && { borderColor: reaction.color, backgroundColor: reaction.background }, disabled && styles.disabled]}
            >
              <Ionicons accessible={false} name={selected ? reaction.selectedIcon : reaction.icon} size={20} color={reaction.color} />
              <Text style={[styles.label, selected && { color: reaction.color }]}>{reaction.label}</Text>
              <Text style={styles.count}>{count === undefined ? '…' : count}</Text>
            </Pressable>
          );
        })}
      </View>
      {(!current || current.busy) && <Text accessibilityLiveRegion="polite" style={styles.status}>{current?.summary ? '送信中…' : 'リアクションを読み込み中…'}</Text>}
      {current?.error && (
        <View style={styles.content}>
          <Text accessibilityRole="alert" style={styles.error}>{current.error}</Text>
          <Pressable accessibilityRole="button" onPress={() => {
            if (locked.current) return;
            locked.current = true;
            setState({ key, summary: null, busy: true, error: null });
            setVersion((value) => value + 1);
          }} style={styles.retry}>
            <Text style={styles.retryText}>リアクションを再読み込み</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: '#DDD5E0', backgroundColor: 'rgba(255,255,255,0.75)' },
  disabled: { opacity: 0.6 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  count: { color: colors.text, fontSize: 16, fontWeight: '700' },
  status: { color: colors.textSecondary, fontSize: 12 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 20 },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  retryText: { color: colors.text, fontSize: 13, textDecorationLine: 'underline' },
});
