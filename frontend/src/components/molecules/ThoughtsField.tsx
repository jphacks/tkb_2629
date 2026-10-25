import { StyleSheet, View } from 'react-native';

import { FieldLabel } from '../atoms/FieldLabel';
import { ShadowInput } from '../atoms/ShadowInput';

type ThoughtsFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  fillAvailableSpace?: boolean;
};

export function ThoughtsField({ value, onChangeText, editable = true, fillAvailableSpace = false }: ThoughtsFieldProps) {
  return (
    <View style={[styles.field, fillAvailableSpace && styles.flexibleField]}>
      <View style={styles.heading}>
        <FieldLabel>今の感想</FieldLabel>
        <FieldLabel>{`（${Array.from(value.trim()).length} / 140文字）`}</FieldLabel>
      </View>
      <ShadowInput
        accessibilityLabel="今の感想"
        editable={editable}
        multiline
        scrollEnabled={!fillAvailableSpace}
        onChangeText={onChangeText}
        placeholder="感想を入力してください..."
        surfaceStyle={fillAvailableSpace ? styles.flexibleSurface : undefined}
        style={[styles.input, fillAvailableSpace && styles.flexibleInput]}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  flexibleField: { flex: 1, minHeight: 64 },
  flexibleSurface: { flex: 1, minHeight: 40 },
  flexibleInput: { flex: 1, height: undefined, minHeight: 40 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  input: { height: 160, padding: 16 },
});
