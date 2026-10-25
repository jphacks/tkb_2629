import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type SettingsRowProps = { label: string; value?: string; icon?: string; onPress?: () => void; readOnly?: boolean };

export function SettingsRow({ label, value, icon, onPress, readOnly = false }: SettingsRowProps) {
  const unavailable = !onPress;
  if (readOnly) return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
  return (
    <Pressable
      accessibilityLabel={unavailable ? `${label}（準備中）` : label}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={styles.row}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, unavailable && styles.unavailableLabel]}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
      {unavailable ? <Text style={styles.badge}>準備中</Text> : <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomColor: '#F0EAF2', borderBottomWidth: 1, flexDirection: 'row', height: 58, paddingHorizontal: 16 },
  icon: { color: colors.navAccent, fontSize: 18, width: 30 },
  label: { color: colors.text, flex: 1, fontSize: 15 },
  unavailableLabel: { color: colors.placeholder },
  value: { color: colors.placeholder, fontSize: 13, marginRight: 10 },
  chevron: { color: colors.placeholder, fontSize: 24 },
  badge: { backgroundColor: '#F0EAF2', borderRadius: 10, color: colors.placeholder, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
});
