import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type Props = {
  items: string[];
  error: string | null;
  loading: boolean;
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
};

export function SearchHistory({ items, error, loading, onSelect, onRemove, onClear }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>検索履歴</Text>
        {(items.length > 0 || error) && <Pressable accessibilityRole="button" accessibilityLabel="検索履歴をすべて削除" onPress={onClear} style={styles.clear}>
          <Text style={styles.label}>すべて削除</Text>
        </Pressable>}
      </View>
      {loading && <Text style={styles.label}>履歴を読み込み中…</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!loading && !error && items.length === 0 && <Text style={styles.label}>検索したキーワードがここに表示されます</Text>}
      {items.map((query) => <View key={query} style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${query}を再検索`} onPress={() => onSelect(query)} style={styles.term}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text numberOfLines={2} style={styles.query}>{query}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${query}を検索履歴から削除`} onPress={() => onRemove(query)} style={styles.delete}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 12, gap: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  label: { color: colors.textSecondary, fontSize: 12 },
  clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  term: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  query: { flex: 1, color: colors.text, fontSize: 14 },
  delete: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#B42318', fontSize: 13 },
});
