import React from "react";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function ModalScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Modal" }} />
      <View style={styles.container} testID="modal-screen">
        <Text style={styles.title} testID="modal-title">
          Modal
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F7F4",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2C2C2E",
  },
});
