import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ActionButton } from '../../components/molecules/ActionButton';
import { ShadowInput } from '../../components/atoms/ShadowInput';
import { ScreenFrame } from '../../components/organisms/ScreenFrame';
import type { Navigate } from '../types';

export function BookEditScreen({ bookId, onNavigate }: { bookId: number; onNavigate: Navigate }) {
  const [title, setTitle] = useState('星の旅'); const [author, setAuthor] = useState('著者名'); const [publisher, setPublisher] = useState('出版社');
  return <ScreenFrame activeRoute="bookshelf" onNavigate={onNavigate} title="本の編集"><ScrollView contentContainerStyle={styles.content}><Text style={styles.label}>書名</Text><ShadowInput onChangeText={setTitle} value={title} style={styles.input} /><Text style={styles.label}>著者名</Text><ShadowInput onChangeText={setAuthor} value={author} style={styles.input} /><Text style={styles.label}>出版社</Text><ShadowInput onChangeText={setPublisher} value={publisher} style={styles.input} /><ActionButton label="保存する" onPress={() => onNavigate({ name: 'book-detail', bookId })} /></ScrollView></ScreenFrame>;
}

const styles = StyleSheet.create({ content: { gap: 8, padding: 24, paddingBottom: 110 }, label: { color: '#464646', fontSize: 14, fontWeight: '600', marginTop: 8 }, input: { height: 54, width: '100%' } });
