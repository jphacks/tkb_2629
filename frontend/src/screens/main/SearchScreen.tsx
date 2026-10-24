import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookRow } from '../../components/molecules/BookRow';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function SearchScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const [query, setQuery] = useState('');
  return (
    <ScreenFrame activeRoute="search" onNavigate={onNavigate} title="本を探す" subtitle="読みたい本を見つけましょう">
      <ScrollView contentContainerStyle={styles.content}>
        <ShadowInput onChangeText={setQuery} placeholder="本のタイトルや著者名を検索" style={styles.search} value={query} />
        <View style={styles.filters}><Text style={styles.active}>すべて</Text><Text style={styles.filter}>小説</Text><Text style={styles.filter}>ビジネス</Text><Text style={styles.filter}>その他</Text></View>
        <View style={styles.resultHeader}><Text style={styles.result}>検索結果</Text><Text style={styles.count}>3件</Text></View>
        <BookRow title="星の旅" onPress={() => onNavigate('book-detail')} /><BookRow title="静かな海" onPress={() => onNavigate('book-detail')} /><BookRow title="春の記憶" onPress={() => onNavigate('book-detail')} />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 110 }, search: { height: 52, marginTop: 8, width: '100%' }, filters: { flexDirection: 'row', gap: 8, marginBottom: 24, marginTop: 24 }, active: { backgroundColor: '#FF7171', borderRadius: 16, color: '#FFFFFF', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8 }, filter: { backgroundColor: '#FFF0F0', borderRadius: 16, color: '#777777', fontSize: 12, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8 }, resultHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, result: { color: '#464646', fontSize: 16, fontWeight: '700' }, count: { color: '#9CA3AF', fontSize: 13 },
});
