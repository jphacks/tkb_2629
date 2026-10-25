import { Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { BookmarkAddIcon } from '../atoms/BookmarkAddIcon';

type FloatingActionButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
};

export function FloatingActionButton({ onPress, disabled = false }: FloatingActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel="しおりを追加"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={styles.gradient} viewBox="0 0 100 100" width="100%">
        <Defs>
          <LinearGradient id="floatingActionGradient" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor="#FF8C8C" />
            <Stop offset="0.45" stopColor="#DE7ECD" />
            <Stop offset="1" stopColor={colors.navAccent} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#floatingActionGradient)" height="100" rx="30" width="100" />
      </Svg>
      <BookmarkAddIcon height={38} width={35} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.navAccent,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderRadius: 30,
    bottom: 32,
    elevation: 6,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    right: 24,
    shadowColor: colors.navAccent,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    width: 58,
    zIndex: 5,
  },
  gradient: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.4 },
});
