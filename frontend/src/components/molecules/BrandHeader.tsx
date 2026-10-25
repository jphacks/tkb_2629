import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme/colors";

export function BrandHeader() {
  return (
    <View style={styles.brand}>
      <View style={styles.symbol}>
        <Text style={styles.symbolText}>V</Text>
      </View>
      <View>
        <Text style={styles.name}>Re:Read</Text>
        <Text style={styles.tagline}>読書を記録する</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", flexDirection: "row", gap: 12 },
  symbol: {
    alignItems: "center",
    backgroundColor: colors.navAccent,
    borderRadius: 44,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  symbolText: { color: colors.background, fontSize: 48, fontWeight: "800" },
  name: { color: colors.text, fontSize: 26, fontWeight: "700" },
  tagline: { color: colors.placeholder, fontSize: 14, marginTop: 4 },
});
