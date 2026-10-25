import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '../../components/molecules/BookCover';
import { BrandHeader } from '../../components/molecules/BrandHeader';
import { colors } from '../../theme/colors';
import { demoBook, demoBookmarks, demoChoices, demoOtherBookmark, type DemoBookmark } from './demoData';

export function DemoScreen() {
  const [opened, setOpened] = useState(false);
  const [source, setSource] = useState<'mine' | 'others'>('mine');
  const [selectedPage, setSelectedPage] = useState(24);
  const [draft, setDraft] = useState<DemoBookmark | null>(null);
  const [added, setAdded] = useState<DemoBookmark | null>(null);
  const [message, setMessage] = useState('');
  const bookmarks = [...demoBookmarks[source], ...(added ? [source === 'mine' ? added : demoOtherBookmark] : [])]
    .sort((left, right) => left.page - right.page);
  const selected = bookmarks.find((bookmark) => bookmark.page === selectedPage)!;

  function reset() {
    setOpened(false);
    setSource('mine');
    setSelectedPage(24);
    setDraft(null);
    setAdded(null);
    setMessage('');
  }

  function addBookmark() {
    if (!draft) return;
    setAdded(draft);
    setSource('mine');
    setSelectedPage(draft.page);
    setMessage(`120ページの栞を${draft.emotion}の色で${added ? '更新' : '追加'}しました`);
    setDraft(null);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader />
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>採点者向け体験デモ · ログイン不要</Text>
        <Text style={styles.body}>架空の本・感想・感情色を使ったサンプルです{'\n'}実際のAI解析や他の利用者との通信は行いません{'\n'}操作は保存されず、再読み込みすると最初に戻ります</Text>
      </View>
      {!opened ? <>
        <Text accessibilityRole="header" style={styles.heading}>読んだときの気持ちを、色の栞に</Text>
        <Text style={styles.body}>同じ本でも、心が動く場所や感じ方は人それぞれ{'\n'}栞を開いて、自分とみんなの違いを体験してください</Text>
        <View style={styles.steps}>
          <Text style={styles.body}>1　サンプルの本を開く</Text>
          <Text style={styles.body}>2　感想を選んで色の栞を追加する</Text>
          <Text style={styles.body}>3　「みんなの栞」に切り替えて比べる</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="サンプルの本を開く" onPress={() => setOpened(true)} style={styles.book}>
          <BookCover title={demoBook.title} author={demoBook.author} large />
          <View style={styles.bookCopy}>
            <Text style={styles.title}>{demoBook.title}</Text>
            <Text style={styles.body}>{demoBook.author}</Text>
            <Text style={styles.body}>{demoBook.totalPages}ページ · 体験用の架空の本</Text>
            <Text style={styles.link}>本を開いて体験する →</Text>
          </View>
        </Pressable>
      </> : <>
        <Pressable accessibilityRole="button" onPress={reset} style={styles.reset}>
          <Text style={styles.link}>← デモの最初に戻る</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.heading}>{demoBook.title}</Text>
        <Text style={styles.body}>読書の途中で残した感想が、色の栞として並びます</Text>
        <View style={styles.composer}>
          <Text accessibilityRole="header" style={styles.title}>120ページに栞を追加してみる</Text>
          <Text style={styles.body}>手紙の返事が届いた場面で、あなたならどう感じますか</Text>
          <Text style={styles.caption}>感想を選ぶと、デモ用に決めた色をプレビューします{'\n'}AI解析ではありません。同じページへの追加は上書きします</Text>
          {demoChoices.map((choice) => (
            <Pressable key={choice.emotion} accessibilityRole="radio"
              accessibilityLabel={`${choice.emotion}の感想を選ぶ`}
              accessibilityState={{ checked: draft === choice }}
              onPress={() => { setDraft(choice); setMessage(''); }}
              style={[styles.choice, draft === choice && styles.selectedMarker]}>
              <Text style={styles.body}>{choice.content}</Text>
            </Pressable>
          ))}
          {draft && <View accessibilityLiveRegion="polite" style={styles.preview}>
            <View style={[styles.ribbon, { backgroundColor: draft.color }]} />
            <Text style={styles.body}>プレビュー · {draft.emotion}{'\n'}色は体験用の固定値</Text>
          </View>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draft }}
            disabled={!draft} onPress={addBookmark} style={[styles.addButton, !draft && styles.disabled]}>
            <Text style={styles.tabText}>{added ? '選んだ感想で栞を更新' : '選んだ感想で栞を追加'}</Text>
          </Pressable>
          {message !== '' && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
        </View>
        <View style={styles.tabs}>
          {(['mine', 'others'] as const).map((value) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: source === value }}
              onPress={() => setSource(value)} style={[styles.tab, source === value && styles.selectedTab]}>
              <Text style={styles.tabText}>{value === 'mine' ? '自分の栞' : 'みんなの栞'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.body}>{source === 'mine' ? '自分の気持ちを振り返る' : '同じページでも、別の感じ方がある'}</Text>
        <View style={styles.timeline}>
          {bookmarks.map((bookmark) => (
            <Pressable key={bookmark.page} accessibilityRole="button"
              accessibilityLabel={`${bookmark.page}ページの${bookmark.emotion}の栞を開く`}
              accessibilityState={{ selected: selectedPage === bookmark.page }}
              onPress={() => setSelectedPage(bookmark.page)}
              style={[styles.marker, selectedPage === bookmark.page && styles.selectedMarker]}>
              <View style={[styles.ribbon, { backgroundColor: bookmark.color }]} />
              <Text style={styles.page}>{bookmark.page}ページ</Text>
              <Text style={styles.body}>{bookmark.emotion}</Text>
            </Pressable>
          ))}
        </View>
        <View accessibilityLiveRegion="polite" style={styles.review}>
          <View style={[styles.emotionStripe, { backgroundColor: selected.color }]} />
          <Text style={styles.title}>{selected.page}ページ · {selected.emotion}</Text>
          <Text style={styles.reviewBody}>{selected.content}</Text>
          <Text style={styles.caption}>{source === 'mine' ? '自分の感想のサンプル' : '別の読者の感想を想定したサンプル'} · 色は体験用の固定値</Text>
        </View>
        <Text style={styles.body}>同じページを選んだままタブを切り替えると、感じ方の違いを比べられます</Text>
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundSoft },
  content: { alignSelf: 'center', gap: 20, maxWidth: 640, padding: 20, paddingTop: 48, paddingBottom: 48, width: '100%' },
  notice: { backgroundColor: '#FFFFFF', borderColor: colors.navAccent, borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  noticeTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 23, fontWeight: '700', lineHeight: 34 },
  body: { color: colors.text, fontSize: 14, lineHeight: 23 },
  steps: { gap: 10 },
  book: { backgroundColor: '#FFFFFF', borderRadius: 18, flexDirection: 'row', gap: 16, padding: 16 },
  bookCopy: { flex: 1, gap: 10 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 25 },
  link: { color: '#75439B', fontSize: 14, fontWeight: '700', lineHeight: 23 },
  reset: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  tabs: { flexDirection: 'row', gap: 10 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: '#E4D9EC', backgroundColor: '#FFFFFF' },
  selectedTab: { borderColor: colors.navAccent, backgroundColor: '#EFE0FA' },
  tabText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  composer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 12 },
  choice: { minHeight: 48, padding: 12, borderWidth: 2, borderColor: '#E4D9EC', borderRadius: 12 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.navAccent, padding: 12, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  timeline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  marker: { flexGrow: 1, flexBasis: '40%', alignItems: 'center', gap: 8, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent', borderRadius: 12 },
  selectedMarker: { borderColor: colors.navAccent, backgroundColor: '#FFFFFF' },
  ribbon: { width: 32, height: 56, borderBottomLeftRadius: 12, borderBottomRightRadius: 3 },
  page: { color: colors.text, fontSize: 12, fontWeight: '700' },
  review: { borderRadius: 16, backgroundColor: '#FFFFFF', padding: 20, gap: 14, overflow: 'hidden' },
  emotionStripe: { height: 8, borderRadius: 4 },
  reviewBody: { color: colors.text, fontSize: 16, lineHeight: 28 },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 20 },
});
