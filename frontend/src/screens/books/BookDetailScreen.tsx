import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function BookDetailScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の詳細"><ScrollView contentContainerStyle={styles.content}><View style={styles.hero}><BookCover large title="星の旅" /><Text style={styles.title}>星の旅</Text><Text style={styles.author}>著者名</Text><Text style={styles.publisher}>出版社 ・ 2025年</Text></View><View style={styles.card}><Text style={styles.heading}>あらすじ</Text><Text style={styles.body}>本の紹介文がここに入ります。物語の概要や本の特徴を確認できます。</Text></View><View style={styles.card}><Text style={styles.heading}>読書状況</Text><Text style={styles.body}>42 / 180ページ ・ 23%読了</Text></View><ActionButton label="本を編集する" onPress={() => onNavigate('book-edit')} secondary /></ScrollView></ScreenFrame>;
}

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 110 }, hero: { alignItems: 'center', backgroundColor: '#FFF0F0', borderRadius: 20, marginTop: 8, padding: 24 }, title: { color: '#464646', fontSize: 24, fontWeight: '700', marginTop: 18 }, author: { color: '#777777', fontSize: 14, marginTop: 8 }, publisher: { color: '#9CA3AF', fontSize: 12, marginTop: 6 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, heading: { color: '#464646', fontSize: 16, fontWeight: '700', marginBottom: 10 }, body: { color: '#777777', fontSize: 14, lineHeight: 22 },
});
