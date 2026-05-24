import React, { useContext, useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import FormTextInput from '../components/FormTextInput';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
const LOGO = require('../../assets/bugema-official-logo.png');

const schema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required')
    .refine(
      (val) => {
        // allow either email format or username (non-empty)
        const emailRegex = /\S+@\S+\.\S+/;
        return !!val && (emailRegex.test(val) || val.length >= 1);
      },
      { message: 'Enter your email or username' },
    ),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginScreen({ navigation }: Props) {
  const { signIn, refreshSuspensionStatus } = useContext(AuthContext);
  const { theme, setMode, mode } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const logoScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const { handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const queryClient = useQueryClient();
  const { width } = Dimensions.get('window');

  useEffect(() => {
    // Animate logo entrance
    Animated.timing(logoScale, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Animate card entrance
    Animated.timing(cardOpacity, {
      toValue: 1,
      duration: 800,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const onLogin = async (data: z.infer<typeof schema>) => {
    try {
      setError(null);
      const resp = await api.post('/auth/token/', { username: data.identifier, password: data.password });
      await signIn(resp.data.access);
      
      // Check suspension status - if suspended, Router will conditionally render SuspendedUserScreen
      const isSuspended = await refreshSuspensionStatus();
      if (isSuspended) {
        return; // Router will handle navigation to SuspendedUserScreen
      }
      
      // Prefetch data for better UX when navigating to Home
      // Note: Do NOT call navigation.replace('Home') - let conditional rendering handle navigation
      type NoticesPage = { results: any[]; nextPage?: number };
      const fetchNoticesPage = async ({ pageParam = 1 }: { pageParam?: number }): Promise<NoticesPage> => {
        const response = await api.get('/notices/', { params: { page: pageParam } });
        const payload = response.data;
        let items: any[] = [];
        let nextPage: number | undefined;
        if (Array.isArray(payload)) {
          items = payload;
        } else if (payload && Array.isArray(payload.results)) {
          items = payload.results;
          if (payload.next) {
            try {
              const parsed = new URL(payload.next, 'https://dummy');
              const nextParam = parsed.searchParams.get('page');
              if (nextParam) nextPage = Number(nextParam);
            } catch {
              nextPage = undefined;
            }
          }
        }
        const results = items.filter((item) => item && typeof item.id !== 'undefined');
        return { results, nextPage };
      };

      try {
        await queryClient.fetchInfiniteQuery({
          queryKey: ['notices', 'all', ''],
          queryFn: fetchNoticesPage,
          initialPageParam: 1,
          getNextPageParam: (lastPage: NoticesPage) => lastPage.nextPage ?? undefined,
        });
      } catch (err) {
        if (__DEV__ && !(err instanceof CancelledError)) {
          console.warn('Failed to prefetch notices', err);
        }
      }

      try {
        await queryClient.fetchQuery({
          queryKey: ['trending-top'],
          queryFn: async () => {
            const response = await api.get('/notices/trending/');
            const payload = response.data;
            if (Array.isArray(payload)) {
              return payload.filter((item) => item && typeof item.id !== 'undefined');
            }
            if (payload && Array.isArray(payload.results)) {
              return payload.results.filter((item: any) => item && typeof item.id !== 'undefined');
            }
            return [];
          },
        });
      } catch (err) {
        if (__DEV__ && !(err instanceof CancelledError)) {
          console.warn('Failed to prefetch trending notices', err);
        }
      }

      // Invalidate queries to refresh data when Home screen loads
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: ['trending-top'] });
      
      // Navigation will happen automatically through conditional rendering
      // when token changes in AuthContext
    } catch (e: any) {
      setError('Invalid credentials');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          scrollEnabled={false}
        >
          {/* Gradient Background */}
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primary + '40']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          />

          {/* Header with Logo and Theme Toggle */}
          <View style={styles.headerRow}>
            <Animated.View style={[{ transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoContainer}>
                <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
              </View>
            </Animated.View>
            <TouchableOpacity
              onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              style={[styles.modeToggle, { borderColor: theme.colors.border }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={mode === 'dark' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                size={18}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Welcome Text */}
          <Animated.View style={[{ opacity: cardOpacity }]}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subheading, { color: theme.colors.muted }]}>
              Sign in to connect with your university
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[{ opacity: cardOpacity }]}>
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: theme.colors.card,
                  shadowColor: theme.colors.shadow ?? '#000',
                },
              ]}
            >
              <FormTextInput
                label="Email or Username"
                placeholder="you@university.ac.ug or username"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(t) => setValue('identifier', t, { shouldValidate: true })}
                error={errors.identifier?.message}
                trailing={<MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.muted} />}
              />

              <FormTextInput
                label="Password"
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
                error={errors.password?.message}
                trailing={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={18}
                      color={theme.colors.muted}
                    />
                  </TouchableOpacity>
                }
              />

              {/* Forgot Password Link */}
              <TouchableOpacity style={styles.forgotPasswordLink}>
                <Text style={[styles.forgotPasswordText, { color: theme.colors.primary }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              {/* Error Banner */}
              {error ? (
                <View style={[styles.errorBanner, { borderColor: theme.colors.danger }]}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.danger} />
                  <Text style={[styles.errorText, { color: theme.colors.danger }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Login Button */}
              <PrimaryButton
                title={isSubmitting ? 'Signing in...' : 'Sign In'}
                onPress={handleSubmit(onLogin)}
                disabled={isSubmitting}
              />
            </View>
          </Animated.View>

          {/* Footer - Sign Up Link */}
          <View style={styles.footerRow}>
            <Text style={[styles.secondaryLabel, { color: theme.colors.muted }]}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
              <Text style={[styles.secondaryLink, { color: theme.colors.primary }]}>
                Create one
              </Text>
            </TouchableOpacity>
          </View>

          {/* Help/Support Link */}
          <TouchableOpacity style={styles.helpLink}>
            <MaterialCommunityIcons name="help-circle-outline" size={16} color={theme.colors.muted} />
            <Text style={[styles.helpText, { color: theme.colors.muted }]}>
              Need help? Contact support
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
    flexGrow: 1,
    justifyContent: 'center',
    gap: 24,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    opacity: 0.08,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    elevation: 8,
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  modeToggle: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  formCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    elevation: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    gap: 16,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  secondaryLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
    marginTop: 8,
  },
  helpText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
