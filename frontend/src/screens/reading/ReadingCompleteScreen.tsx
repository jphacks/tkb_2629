import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { GlassSurface } from '../../components/atoms/GlassSurface';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function ReadingCompleteScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return <ScreenFrame activeRoute="reading" onNavigate={onNavigate}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>読了おめでとう</Text><Text style={styles.title}>一冊読み終えました</Text><Text style={styles.description}>あなたの読書の記録が増えました。</Text><View style={styles.book}><BookCover large title="星の旅" /><Text style={styles.mark}>✓</Text></View><Text style={styles.body}>「星の旅」を最後まで読みました。</Text><GlassSurface style={styles.stats}><Text style={styles.body}>読んだページ　180ページ</Text><Text style={styles.body}>読了日　2025年1月1日</Text></GlassSurface><ActionButton label="読書を続ける" onPress={() => onNavigate('home')} /></ScrollView></ScreenFrame>;
}

const styles = StyleSheet.create({ content: { alignItems: 'center', padding: 24, paddingBottom: 110 }, eyebrow: { color: '#C17AED', fontSize: 14, fontWeight: '700', marginTop: 8 }, title: { color: '#464646', fontSize: 27, fontWeight: '700', marginTop: 14, textAlign: 'center' }, description: { color: '#9CA3AF', fontSize: 14, marginTop: 8 }, book: { marginTop: 32, position: 'relative' }, mark: { alignItems: 'center', backgroundColor: '#C17AED', borderColor: '#FFFFFF', borderRadius: 22, borderWidth: 3, bottom: -8, color: '#FFFFFF', fontSize: 24, fontWeight: '700', height: 44, justifyContent: 'center', paddingTop: 3, position: 'absolute', right: -12, textAlign: 'center', width: 44 }, body: { color: '#777777', fontSize: 14, marginTop: 22, textAlign: 'center' }, stats: { backgroundColor: 'rgba(255, 255, 255, 0.48)', borderRadius: 16, gap: 8, marginVertical: 28, padding: 18, width: '100%' } });
