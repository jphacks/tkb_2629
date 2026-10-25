import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';
import type { Book } from '../../lib/api';

type ReadingCompleteScreenProps = {
  book: Book | null;
  iterationNumber: number | null;
  onNavigate: (route: ScreenKey) => void;
};

export function ReadingCompleteScreen({
  book,
  iterationNumber,
  onNavigate,
}: ReadingCompleteScreenProps) {
  return <ScreenFrame activeRoute="reading" onNavigate={onNavigate}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>読了おめでとう</Text><Text style={styles.title}>一冊読み終えました</Text><Text style={styles.description}>あなたの読書の記録が増えました。</Text><View style={styles.book}><BookCover author={book?.author ?? '著者名'} large title={book?.title ?? '星の旅'} /><Text style={styles.mark}>✓</Text></View><Text style={styles.body}>「{book?.title ?? '星の旅'}」を最後まで読みました。</Text><View style={styles.stats}><Text style={styles.body}>読んだページ　{book?.total_pages ?? 180}ページ</Text>{iterationNumber && <Text style={styles.body}>読書回　{iterationNumber}回目</Text>}<Text style={styles.body}>読了日　{book?.completed_at ? new Date(book.completed_at).toLocaleDateString('ja-JP') : '2025年1月1日'}</Text></View><ActionButton label="読書を続ける" onPress={() => onNavigate('home')} /></ScrollView></ScreenFrame>;
}

const styles = StyleSheet.create({ content: { alignItems: 'center', padding: 24, paddingBottom: 110 }, eyebrow: { color: '#C17AED', fontSize: 14, fontWeight: '700', marginTop: 8 }, title: { color: '#464646', fontSize: 27, fontWeight: '700', marginTop: 14, textAlign: 'center' }, description: { color: '#9CA3AF', fontSize: 14, marginTop: 8 }, book: { marginTop: 32, position: 'relative' }, mark: { alignItems: 'center', backgroundColor: '#C17AED', borderColor: '#FFFFFF', borderRadius: 22, borderWidth: 3, bottom: -8, color: '#FFFFFF', fontSize: 24, fontWeight: '700', height: 44, justifyContent: 'center', paddingTop: 3, position: 'absolute', right: -12, textAlign: 'center', width: 44 }, body: { color: '#777777', fontSize: 14, marginTop: 22, textAlign: 'center' }, stats: { backgroundColor: '#FFF0F0', borderRadius: 16, gap: 8, marginVertical: 28, padding: 18, width: '100%' } });
