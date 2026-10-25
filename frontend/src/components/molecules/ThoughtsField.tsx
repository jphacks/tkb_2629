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
      <FieldLabel>今の感想</FieldLabel>
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
  input: { height: 160, padding: 16 },
});
