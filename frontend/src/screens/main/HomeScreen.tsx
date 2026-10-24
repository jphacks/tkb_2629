import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookRow } from '../../components/molecules/BookRow';
import { FloatingActionButton } from '../../components/molecules/FloatingActionButton';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function HomeScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return (
    <ScreenFrame activeRoute="home" onNavigate={onNavigate} title="ホーム" subtitle="あなたの読書を、もっと身近に">
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}><Text style={styles.eyebrow}>今日の読書</Text><Text style={styles.heroTitle}>読書の続きをはじめよう</Text><Text style={styles.heroBody}>しおりを使って、前回のページから再開できます。</Text><ActionButton label="読書をはじめる" onPress={() => onNavigate('reading')} /></View>
          <Text style={styles.sectionTitle}>最近読んだ本</Text>
          <BookRow title="星の旅" status="12ページまで読了" onPress={() => onNavigate('book-detail')} />
          <BookRow title="静かな海" status="読書中" onPress={() => onNavigate('book-detail')} />
        </ScrollView>
        <FloatingActionButton onPress={() => onNavigate('bookmark')} />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { padding: 24, paddingBottom: 110 },
  hero: { backgroundColor: '#FFE2E2', borderRadius: 20, gap: 12, marginTop: 8, padding: 22 },
  eyebrow: { color: '#C17AED', fontSize: 13, fontWeight: '700' },
  heroTitle: { color: '#464646', fontSize: 22, fontWeight: '700' },
  heroBody: { color: '#777777', fontSize: 14, lineHeight: 21, marginBottom: 4 },
  sectionTitle: { color: '#464646', fontSize: 18, fontWeight: '700', marginBottom: 14, marginTop: 28 },
});
