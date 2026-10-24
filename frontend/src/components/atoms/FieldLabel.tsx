import { StyleSheet, Text } from 'react-native';

import { colors } from '../../theme/colors';

type FieldLabelProps = {
  children: string;
};

export function FieldLabel({ children }: FieldLabelProps) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
