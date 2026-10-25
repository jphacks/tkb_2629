import { StyleSheet, Text } from 'react-native';

import { colors } from '../../theme/colors';

type FieldLabelProps = {
  children: string;
  color?: string;
};

export function FieldLabel({ children, color = colors.text }: FieldLabelProps) {
  return <Text style={[styles.label, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
