import { Image, Pressable, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';

type FloatingActionButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
};

const addBookmarkSvgUri = Image.resolveAssetSource(require('../../assets/addBookmark.svg'))?.uri ?? '';

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
      <SvgUri height={38} uri={addBookmarkSvgUri} width={35} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 113, 113, 0.86)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderRadius: 30,
    bottom: 32,
    elevation: 6,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#B66E87',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    width: 58,
    zIndex: 5,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.4 },
});
