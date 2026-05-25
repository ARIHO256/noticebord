import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import BeautifulButton from './BeautifulButton';

interface Props {
  enabled: boolean;
  onUnlock: () => void;
}

export default function BiometricLock({ enabled, onUnlock }: Props) {
  const { theme } = useTheme();
  const [locked, setLocked] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("biometric");

  useEffect(() => {
    if (!enabled) return;

    const checkBiometric = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return;
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("Fingerprint");
      }
    };
    checkBiometric();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background") {
        setLocked(true);
      }
    });

    return () => subscription.remove();
  }, [enabled]);

  useEffect(() => {
    if (enabled && locked) {
      authenticate();
    }
  }, [locked, enabled]);

  const authenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock with ${biometricType}`,
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        onUnlock();
      }
    } catch {
      // Fallback: allow unlock
      setLocked(false);
      onUnlock();
    }
  };

  if (!enabled || !locked) return null;

  return (
    <Modal visible={locked} animationType="fade" transparent={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>App Locked</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Use {biometricType} to unlock
        </Text>
        <BeautifulButton
          title={`Unlock with ${biometricType}`}
          variant="gradient"
          size="large"
          onPress={authenticate}
          style={{ marginTop: 32, width: 260 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(24, 119, 242, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lockIcon: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center' },
});
