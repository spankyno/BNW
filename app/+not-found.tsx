import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "No encontrado" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Esta pantalla no existe.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F8F7F4",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2C2C2E",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#C0825A",
  },
});
