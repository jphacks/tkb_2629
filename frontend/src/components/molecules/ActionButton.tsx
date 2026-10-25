import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';

type ActionButtonProps = { label: string; onPress?: () => void; secondary?: boolean };

export function ActionButton({ label, onPress, secondary = false }: ActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.secondary]}>
      {!secondary && (
        <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={styles.gradient} viewBox="0 0 100 100" width="100%">
          <Defs>
            <LinearGradient id="actionButtonGradient" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor="#FF8C8C" />
              <Stop offset="0.45" stopColor="#DE7ECD" />
              <Stop offset="1" stopColor="#C17AED" />
            </LinearGradient>
            <LinearGradient id="actionGlassHighlight" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
              <Stop offset="0.24" stopColor="#FFFFFF" stopOpacity="0.14" />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#actionButtonGradient)" height="100" rx="12" width="100" />
          <Rect fill="url(#actionGlassHighlight)" height="100" rx="12" width="100" />
          <Rect fill="none" height="99" rx="12" stroke="#FFFFFF" strokeOpacity="0.36" strokeWidth="1" width="99" x="0.5" y="0.5" />
        </Svg>
      )}
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
