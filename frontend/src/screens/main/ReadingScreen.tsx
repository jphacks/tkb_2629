import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ReadingProgress } from '../../components/molecules/ReadingProgress';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function ReadingScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return (
    <ScreenFrame activeRoute="reading" onNavigate={onNavigate} title="今読んでる本" subtitle="読書の続きを記録しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.book}><BookCover large title="星の旅" /><View style={styles.copy}><Text style={styles.title}>星の旅</Text><Text style={styles.author}>著者名 ・ 出版社</Text><ReadingProgress currentPage={42} totalPages={180} /></View></View>
        <Text style={styles.section}>読書メモ</Text><View style={styles.note}><Text style={styles.noteText}>前回のしおりから読書を再開できます。</Text></View>
        <ActionButton label="しおりを追加" onPress={() => onNavigate('bookmark')} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  book: { alignItems: 'center', backgroundColor: '#FFF0F0', borderRadius: 20, flexDirection: 'row', gap: 20, marginTop: 8, padding: 20 },
  copy: { flex: 1 }, title: { color: '#464646', fontSize: 20, fontWeight: '700' }, author: { color: '#9CA3AF', fontSize: 13, marginTop: 8 }, section: { color: '#464646', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 28 }, note: { backgroundColor: '#FFFFFF', borderRadius: 14, elevation: 2, padding: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, noteText: { color: '#777777', fontSize: 14 },
});
