import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
  Image,
  TextInput,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { RootStackParamList } from '../App';
import { AuthContext } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient, CancelledError } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
const LOGO = require('../../assets/bugema-official-logo.png');
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const schema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

function AnimatedGradient() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 8000, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 8000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const top = anim.interpolate({ inputRange: [0, 1], outputRange: ['-20%', '10%'] });
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: ['-10%', '20%'] });

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.orb, { top, left, backgroundColor: '#3B82F6' }]} />
      <Animated.View style={[styles.orb, { bottom: top, right: left, backgroundColor: '#8B5CF6' }]} />
      <Animated.View style={[styles.orb, { top: left, right: top, backgroundColor: '#EC4899', opacity: 0.4 }]} />
    </View>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const { signIn, refreshSuspensionStatus } = useContext(AuthContext);
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const queryClient = useQueryClient();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const { handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const identifier = watch('identifier') || '';
  const password = watch('password') || '';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (has) LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => setBiometricAvailable(types.length > 0));
    });
  }, []);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const onLogin = async (data: z.infer<typeof schema>) => {
    try {
      setError(null);
      const resp = await api.post('/auth/token/', { username: data.identifier, password: data.password });
      await signIn(resp.data.access);
      const isSuspended = await refreshSuspensionStatus();
      if (isSuspended) return;
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    } catch (e: any) {
      setError('Invalid credentials. Please try again.');
      triggerShake();
    }
  };

  const onBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock NoticeBoard',
        fallbackLabel: 'Use password',
      });
      if (result.success) {
        // In a real app, you'd decrypt stored credentials here
        setError('Biometric login requires saved credentials');
      }
    } catch {
      setError('Biometric authentication failed');
    }
  };

  const inputShake = { transform: [{ translateX: shakeAnim }] };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AnimatedGradient />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
            {/* Logo */}
            <Animated.View style={[styles.logoWrap, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoRing}>
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.brandTitle}>NoticeBoard</Text>
              <Text style={styles.brandSubtitle}>Bugema University</Text>
            </Animated.View>

            {/* Glass Card */}
            <Animated.View style={[styles.glassCard, inputShake, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.heading}>Welcome Back</Text>
              <Text style={styles.subheading}>Sign in to your university account</Text>

              {/* Identifier Input */}
              <View style={[styles.inputWrap, errors.identifier && styles.inputWrapError]}>
                <MaterialCommunityIcons name="account-circle-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email or Username"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={identifier}
                  onChangeText={(t) => { setValue('identifier', t, { shouldValidate: true }); setError(null); }}
                />
                {identifier.length > 0 && (
                  <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
                )}
              </View>
              {errors.identifier && <Text style={styles.inputError}>{errors.identifier.message}</Text>}

              {/* Password Input */}
              <View style={[styles.inputWrap, errors.password && styles.inputWrapError]}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#64748B"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(t) => { setValue('password', t, { shouldValidate: true }); setError(null); }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.inputError}>{errors.password.message}</Text>}

              {/* Remember & Forgot */}
              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <MaterialCommunityIcons name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* Error Banner */}
              {error && (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.signInBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSubmit(onLogin)}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#3B82F6', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                  <Text style={styles.signInText}>{isSubmitting ? 'Signing in...' : 'Sign In'}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Biometric */}
              {biometricAvailable && (
                <TouchableOpacity style={styles.bioBtn} onPress={onBiometricLogin}>
                  <MaterialCommunityIcons name="fingerprint" size={28} color="#CBD5E1" />
                  <Text style={styles.bioText}>Unlock with Biometrics</Text>
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register Link */}
              <View style={styles.registerRow}>
                <Text style={styles.registerLabel}>Don't have an account?</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.registerLink}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  orb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.35 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoRing: {
    width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', padding: 14,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  logo: { width: '100%', height: '100%' },
  brandTitle: { fontSize: 26, fontWeight: '900', color: '#F8FAFC', marginTop: 14, letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  glassCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 20,
  },
  heading: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#94A3B8', marginBottom: 24, fontWeight: '400' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 16, height: 56, marginBottom: 4,
  },
  inputWrapError: { borderColor: '#EF4444' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  inputError: { color: '#EF4444', fontSize: 12, marginBottom: 10, marginLeft: 4, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#64748B', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  rememberText: { color: '#CBD5E1', fontSize: 13, fontWeight: '500' },
  forgotText: { color: '#60A5FA', fontSize: 13, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 10,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1 },
  signInBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 18 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  signInText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bioBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 8 },
  bioText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(148,163,184,0.2)' },
  dividerText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  registerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
  registerLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  registerLink: { color: '#60A5FA', fontSize: 14, fontWeight: '800' },
});
