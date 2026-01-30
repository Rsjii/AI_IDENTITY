import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function MarketplaceScreen() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Marketplace</Text>
      <Text style={styles.subtitle}>Browse AI clones and subscriptions.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: '#111827', borderColor: '#1f2937', borderWidth: 1 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
});

