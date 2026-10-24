import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../../theme/colors';

type ActionButtonProps = { label: string; onPress?: () => void; secondary?: boolean };

export function ActionButton({ label, onPress, secondary = false }: ActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.secondary]}>
      <Text style={[styles.text, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 12, height: 54, justifyContent: 'center' },
  secondary: { backgroundColor: colors.background, borderColor: colors.accent, borderWidth: 1 },
  text: { color: colors.background, fontSize: 16, fontWeight: '700' },
  secondaryText: { color: colors.accent },
});
