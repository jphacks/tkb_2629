import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { BookCover } from '../../components/molecules/BookCover';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { ScreenKey } from '../types';

export function AddBookScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  const [query, setQuery] = useState('');
  return <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の新規追加" subtitle="本を検索して本棚に追加します"><ScrollView contentContainerStyle={styles.content}><ShadowInput onChangeText={setQuery} placeholder="本のタイトルを検索" value={query} style={styles.search} /><Text style={styles.method}>検索方法　　バーコードを読み取る</Text><View style={styles.result}><Text style={styles.success}>✓ データ取得済み</Text><View style={styles.book}><BookCover title="星の旅" /><View><Text style={styles.title}>星の旅</Text><Text style={styles.body}>著者名</Text><Text style={styles.body}>出版社</Text></View></View><ActionButton label="本棚に追加" onPress={() => onNavigate('bookshelf')} /></View></ScrollView></ScreenFrame>;
}

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 110 }, search: { height: 52, marginTop: 8, width: '100%' }, method: { color: '#777777', fontSize: 13, marginTop: 22 }, result: { backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 2, marginTop: 28, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } }, success: { color: '#C17AED', fontSize: 13, fontWeight: '700' }, book: { alignItems: 'center', flexDirection: 'row', gap: 18, marginVertical: 26 }, title: { color: '#464646', fontSize: 18, fontWeight: '700' }, body: { color: '#9CA3AF', fontSize: 13, marginTop: 7 } });
