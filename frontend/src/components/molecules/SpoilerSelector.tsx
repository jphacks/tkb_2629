import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { FieldLabel } from '../atoms/FieldLabel';

type SpoilerSelectorProps = {
  hasSpoiler: boolean;
  onChange: (hasSpoiler: boolean) => void;
};

export function SpoilerSelector({ hasSpoiler, onChange }: SpoilerSelectorProps) {
  return (
    <View style={styles.field}>
      <FieldLabel>ネタバレ設定</FieldLabel>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(false)}
          style={[styles.button, !hasSpoiler && styles.activeNoSpoiler]}
        >
          <Text style={[styles.buttonText, !hasSpoiler && styles.activeButtonText]}>ネタバレなし</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(true)}
          style={[styles.button, hasSpoiler && styles.activeSpoiler]}
        >
          <Text style={[styles.buttonText, hasSpoiler && styles.activeButtonText]}>ネタバレあり</Text>
        </Pressable>
      </View>
    </View>
  );
}

const activeButton = {
  backgroundColor: colors.accent,
  shadowColor: '#000000',
  shadowOffset: { height: 2, width: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 4,
};

const styles = StyleSheet.create({
  field: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    elevation: 2,
    flex: 1,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  activeSpoiler: activeButton,
  activeNoSpoiler: activeButton,
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  activeButtonText: { color: colors.background },
});
