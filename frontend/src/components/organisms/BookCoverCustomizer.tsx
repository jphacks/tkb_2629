import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AUTO_COVER, saveBookCover, type Book, type CoverStyle, type EmotionComparison } from '../../lib/api';
import { colors } from '../../theme/colors';
import { ActionButton } from '../molecules/ActionButton';
import { coverPalettes, coverPatterns } from '../molecules/BookCover';
import { OwnedBookCover } from '../molecules/OwnedBookCover';

export function BookCoverCustomizer({ book, summary, emotionError, onRetryEmotions, onSaved, open, onOpenChange }: {
  book: Book; summary: EmotionComparison | null; emotionError: string | null;
  onRetryEmotions: () => void; onSaved: (style: CoverStyle) => void;
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const saved = book.cover_style ?? AUTO_COVER;
  const [draft, setDraft] = useState<CoverStyle>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    epoch.current += 1;
    locked.current = false;
    setBusy(false);
    setError(null);
    setMessage(null);
    return () => { epoch.current += 1; };
  }, [book.id]);

  useEffect(() => {
    if (open) {
      setDraft(book.cover_style ?? AUTO_COVER);
      setError(null);
      setMessage(null);
    }
  }, [open, book.id]);

  async function save() {
    if (locked.current) return;
    const emotion = draft.color_mode === 'mine' ? summary?.mine : draft.color_mode === 'others' ? summary?.others : null;
    if ((draft.color_mode === 'mine' || draft.color_mode === 'others') && (!emotion || emotion.review_count === 0)) {
      setError('感情の解析データがないため、この色は選べません');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    const request = epoch.current;
    try {
      const style = await saveBookCover(book.id, draft);
      if (request !== epoch.current) return;
      onSaved(style);
      setMessage('表紙を保存しました');
      onOpenChange(false);
    } catch (reason: unknown) {
      if (request === epoch.current) setError(reason instanceof Error ? reason.message : '表紙の保存に失敗しました');
    } finally {
      if (request === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  function choice(label: string, selected: boolean, onPress: () => void, disabled = false, swatch?: string) {
    return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected, disabled: disabled || busy }} disabled={disabled || busy}
      onPress={() => { onPress(); setError(null); }}
      style={[styles.choice, selected && styles.selected, (disabled || busy) && styles.disabled]}>
      {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>;
  }

  return (
    <View style={styles.container}>
      {message && <Text accessibilityRole="alert" style={styles.hint}>{message}</Text>}
      {open && <>
        <Text style={styles.heading}>表紙のプレビュー</Text>
        <OwnedBookCover large book={{ ...book, cover_style: draft }} summary={summary} />
        <Text style={styles.heading}>色</Text>
        <View style={styles.options}>
          {choice('色は自動', draft.color_mode === 'auto', () => setDraft({ ...draft, color_mode: 'auto', palette: null }))}
          {coverPalettes.map((palette, index) => choice(palette.name, draft.color_mode === 'palette' && draft.palette === index,
            () => setDraft({ ...draft, color_mode: 'palette', palette: index }), false, palette.base))}
          {choice('自分の感情', draft.color_mode === 'mine', () => setDraft({ ...draft, color_mode: 'mine', palette: null }),
            !summary?.mine.review_count, summary?.mine.review_count ? summary.mine.color_code : undefined)}
          {choice('みんなの感情', draft.color_mode === 'others', () => setDraft({ ...draft, color_mode: 'others', palette: null }),
            !summary?.others.review_count, summary?.others.review_count ? summary.others.color_code : undefined)}
        </View>
        <Text style={styles.hint}>感情色は解析結果に合わせて自動で変わります</Text>
        {!summary && !emotionError && <Text style={styles.hint}>感情色を読み込んでいます…</Text>}
        {summary?.mine.review_count === 0 && <Text style={styles.hint}>自分の感情：解析済みのしおりがありません</Text>}
        {summary?.others.review_count === 0 && <Text style={styles.hint}>みんなの感情：集計対象の公開しおりがありません</Text>}
        {emotionError && <>
          <Text accessibilityRole="alert" style={styles.error}>{emotionError}</Text>
          <ActionButton secondary label="感情色を再試行" onPress={onRetryEmotions} disabled={busy} />
        </>}
        <Text style={styles.heading}>模様</Text>
        <View style={styles.options}>
          {choice('模様は自動', draft.pattern === null, () => setDraft({ ...draft, pattern: null }))}
          {coverPatterns.map((name, index) => choice(name, draft.pattern === index, () => setDraft({ ...draft, pattern: index })))}
        </View>
        <Text style={styles.hint}>自分の画面だけに反映されます</Text>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <ActionButton secondary label="自動に戻す" disabled={busy} onPress={() => { setDraft(AUTO_COVER); setError(null); }} />
        <ActionButton label={busy ? '保存中…' : '表紙を保存'} disabled={busy} onPress={() => { void save(); }} />
        <ActionButton secondary label="キャンセル" disabled={busy} onPress={() => onOpenChange(false)} />
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  heading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.backgroundSoft, borderRadius: 12, paddingHorizontal: 12 },
  selected: { borderColor: colors.navAccent, backgroundColor: colors.backgroundSoft },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: 13 },
  swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.textSecondary },
  error: { color: '#B42318', fontSize: 13, lineHeight: 20 },
});
