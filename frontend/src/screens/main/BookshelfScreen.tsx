import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookRow } from '../../components/molecules/BookRow';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function BookshelfScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return (
    <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本棚" subtitle="あなたの本を整理しましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}><Text style={styles.activeFilter}>すべて</Text><Text style={styles.filter}>読書中</Text><Text style={styles.filter}>読了</Text></View>
        <BookRow title="星の旅" status="読書中" onPress={() => onNavigate('book-detail')} />
        <BookRow title="静かな海" status="読了" onPress={() => onNavigate('book-detail')} />
        <BookRow title="春の記憶" status="未読" onPress={() => onNavigate('book-detail')} />
        <ActionButton label="本を追加する" onPress={() => onNavigate('add-book')} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 },
  filters: { flexDirection: 'row', gap: 10, marginBottom: 18, marginTop: 8 },
  activeFilter: { backgroundColor: '#FF7171', borderRadius: 16, color: '#FFFFFF', fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 8 },
  filter: { backgroundColor: '#FFF0F0', borderRadius: 16, color: '#777777', fontSize: 13, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 8 },
});
