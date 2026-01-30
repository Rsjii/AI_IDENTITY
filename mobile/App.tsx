import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Selflyx Mobile</Text>
        <Text style={styles.subtitle}>Marketplace, chat, and voice coming soon.</Text>
      </View>
      <View style={styles.stack}>
        <MarketplaceScreen />
        <ChatScreen />
        <ProfileScreen />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  stack: {
    width: '100%',
    padding: 24,
    gap: 12,
  },
});

