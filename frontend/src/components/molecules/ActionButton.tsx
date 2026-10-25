import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type ActionButtonProps = { label: string; onPress?: () => void; secondary?: boolean };

export function ActionButton({ label, onPress, secondary = false }: ActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.secondary]}>
      {!secondary && <View pointerEvents="none" style={styles.gradient}>
        <View style={[styles.gradientStop, styles.gradientTop]} />
        <View style={[styles.gradientStop, styles.gradientUpperMiddle]} />
        <View style={[styles.gradientStop, styles.gradientMiddle]} />
        <View style={[styles.gradientStop, styles.gradientLowerMiddle]} />
        <View style={[styles.gradientStop, styles.gradientBottom]} />
      </View>}
      <Text style={[styles.text, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 12, height: 54, justifyContent: 'center', overflow: 'hidden' },
  secondary: { backgroundColor: colors.background, borderColor: colors.accent, borderWidth: 1 },
  gradient: { bottom: 0, flexDirection: 'column', left: 0, position: 'absolute', right: 0, top: 0 },
  gradientStop: { flex: 1 },
  gradientTop: { backgroundColor: '#FF8C8C' },
  gradientUpperMiddle: { backgroundColor: '#F384C9' },
  gradientMiddle: { backgroundColor: '#DE7ECD' },
  gradientLowerMiddle: { backgroundColor: '#D078D0' },
  gradientBottom: { backgroundColor: '#C17AED' },
  text: { color: colors.background, fontSize: 16, fontWeight: '700' },
  secondaryText: { color: colors.accent },
});
