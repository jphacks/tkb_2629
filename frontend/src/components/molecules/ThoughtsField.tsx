import { StyleSheet, View } from 'react-native';

import { FieldLabel } from '../atoms/FieldLabel';
import { ShadowInput } from '../atoms/ShadowInput';

type ThoughtsFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
};

export function ThoughtsField({ value, onChangeText, editable = true }: ThoughtsFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.heading}>
        <FieldLabel>今の感想</FieldLabel>
        <FieldLabel>{`（${Array.from(value.trim()).length} / 140文字）`}</FieldLabel>
      </View>
      <ShadowInput
        accessibilityLabel="今の感想"
        editable={editable}
        multiline
        onChangeText={onChangeText}
        placeholder="感想を入力してください..."
        style={styles.input}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  input: { height: 160, padding: 16 },
});
