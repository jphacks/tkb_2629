import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';

type ActionButtonProps = { label: string; onPress?: () => void; secondary?: boolean; disabled?: boolean; bookAdd?: boolean };

export function ActionButton({ label, onPress, secondary = false, disabled = false, bookAdd = false }: ActionButtonProps) {
  return (
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} style={[styles.button, bookAdd && { backgroundColor: colors.accent }, secondary && styles.secondary, disabled && { opacity: 0.5 }]}>
      {!secondary && (
        <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={styles.gradient} viewBox="0 0 100 100" width="100%">
          <Defs>
            <LinearGradient id="actionButtonGradient" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor={bookAdd ? '#FF8C8C' : colors.navAccent} />
              <Stop offset="1" stopColor={bookAdd ? colors.accent : colors.navAccent} />
            </LinearGradient>
            <LinearGradient id="actionGlassHighlight" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0.42" />
              <Stop offset="0.24" stopColor={colors.background} stopOpacity="0.14" />
              <Stop offset="0.55" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="0.08" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#actionButtonGradient)" height="100" rx="12" width="100" />
          <Rect fill="url(#actionGlassHighlight)" height="100" rx="12" width="100" />
          <Rect fill="none" height="99" rx="12" stroke={colors.background} strokeOpacity="0.36" strokeWidth="1" width="99" x="0.5" y="0.5" />
        </Svg>
      )}
      <Text style={[styles.text, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.navAccent, borderRadius: 12, height: 54, justifyContent: 'center', overflow: 'hidden' },
  secondary: { backgroundColor: colors.background, borderColor: colors.navAccent, borderWidth: 1 },
  gradient: { bottom: 0, flexDirection: 'column', left: 0, position: 'absolute', right: 0, top: 0 },
  gradientStop: { flex: 1 },
  gradientTop: { backgroundColor: '#FF8C8C' },
  gradientUpperMiddle: { backgroundColor: '#F384C9' },
  gradientMiddle: { backgroundColor: '#DE7ECD' },
  gradientLowerMiddle: { backgroundColor: '#D078D0' },
  gradientBottom: { backgroundColor: colors.navAccent },
  text: { color: colors.background, fontSize: 16, fontWeight: '700' },
  secondaryText: { color: colors.navAccent },
});
