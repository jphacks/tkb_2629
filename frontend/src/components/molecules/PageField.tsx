import { StyleSheet, Text, View } from 'react-native';

import { FieldLabel } from '../atoms/FieldLabel';
import { ShadowInput } from '../atoms/ShadowInput';
import { colors } from '../../theme/colors';

type PageFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
};

export function PageField({ value, onChangeText, editable = true }: PageFieldProps) {
  return (
    <View style={styles.field}>
      <FieldLabel>今のページ数</FieldLabel>
      <View style={styles.row}>
        <ShadowInput
          accessibilityLabel="今のページ数"
          editable={editable}
          keyboardType="number-pad"
          onChangeText={onChangeText}
          placeholder="例: 42"
          style={styles.input}
          value={value}
        />
        <Text style={styles.unit}>ページ</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  input: { height: 55, width: 118 },
  unit: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
