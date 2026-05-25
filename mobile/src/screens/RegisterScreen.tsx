import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import {
  ACADEMIC_YEARS,
  COURSES_BY_DEPARTMENT,
  DEPARTMENTS_BY_SCHOOL,
  SCHOOLS,
} from '../constants/university';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
const LOGO = require('../../assets/bugema-official-logo.png');

const STEPS = ['Account', 'Academic', 'Review'];

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  school: z.string().min(1, 'Select a school'),
  department: z.string().min(1, 'Select a department'),
  course: z.string().min(1, 'Select a course'),
  academic_year: z.string().min(1, 'Select an academic year'),
});

function AnimatedGradient() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 10000, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 10000, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const top = anim.interpolate({ inputRange: [0, 1], outputRange: ['-20%', '10%'] });
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: ['-10%', '20%'] });
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.orb, { top, left, backgroundColor: '#10B981' }]} />
      <Animated.View style={[styles.orb, { bottom: top, right: left, backgroundColor: '#3B82F6' }]} />
      <Animated.View style={[styles.orb, { top: left, right: top, backgroundColor: '#F59E0B', opacity: 0.3 }]} />
    </View>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (p: string) => {
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };
  const strength = getStrength(password);
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981'];


  if (!password) return null;
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <View style={styles.strengthTrack}>
        <View style={[styles.strengthFill, { width: `${Math.round((strength / 5) * 100)}%`, backgroundColor: colors[Math.max(0, strength - 1)] }]} />
      </View>
      <Text style={[styles.strengthLabel, { color: colors[Math.max(0, strength - 1)] }]}>{labels[Math.max(0, strength - 1)]}</Text>
    </View>
  );
}

export default function RegisterScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const {
    setValue,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', email: '', password: '',
      school: '', department: '', course: '', academic_year: ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1],
    },
  });

  const values = watch();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const animateTransition = useCallback((nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const nextStep = async () => {
    setMessage(null);
    const fields = step === 0
      ? ['first_name', 'last_name', 'email', 'password']
      : ['school', 'department', 'course', 'academic_year'];
    const valid = await trigger(fields as any);
    if (valid) animateTransition(step + 1);
  };

  const prevStep = () => animateTransition(step - 1);

  const onRegister = async (data: z.infer<typeof schema>) => {
    try {
      setLoading(true);
      setMessage(null);
      await api.post('/users/register/register/', { ...data, username: data.email });
      setMessage('success');
      setTimeout(() => navigation.replace('Login'), 1200);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.email?.[0] || 'Registration failed. Please try again.';
      setMessage(msg);
      setLoading(false);
    }
  };

  const departments = DEPARTMENTS_BY_SCHOOL[values.school] || [];
  const courses = COURSES_BY_DEPARTMENT[values.department] || [];

  const renderPicker = (label: string, value: string, options: string[], onChange: (v: string) => void, placeholder: string, disabled?: boolean) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={[styles.pickerWrap, disabled && { opacity: 0.5 }, !value && styles.pickerWrapEmpty]}>
        <MaterialCommunityIcons name="menu-down" size={20} color="#94A3B8" />
        <Text style={[styles.pickerText, !value && { color: '#64748B' }]}>{value || placeholder}</Text>
      </View>
      {!disabled && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
          {options.map((opt) => (
            <TouchableOpacity key={opt} onPress={() => onChange(opt)} style={[styles.pickerChip, value === opt && styles.pickerChipActive]}>
              <Text style={[styles.pickerChipText, value === opt && styles.pickerChipTextActive]} numberOfLines={1}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {errors[label.toLowerCase().replace(' ', '_') as keyof typeof errors] && (
        <Text style={styles.inputError}>{errors[label.toLowerCase().replace(' ', '_') as keyof typeof errors]?.message}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AnimatedGradient />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => step > 0 ? prevStep() : navigation.replace('Login')} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={22} color="#CBD5E1" />
              </TouchableOpacity>
              <View style={styles.stepper}>
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                      {i < step ? <MaterialCommunityIcons name="check" size={12} color="#fff" /> : <Text style={styles.stepNum}>{i + 1}</Text>}
                    </View>
                    {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
                  </React.Fragment>
                ))}
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Logo & Title */}
            <View style={styles.logoWrap}>
              <View style={styles.logoRing}>
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.brandTitle}>NoticeBoard</Text>
              <Text style={styles.brandSubtitle}>Create your account</Text>
            </View>

            {/* Glass Card */}
            <Animated.View style={[styles.glassCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              {message === 'success' ? (
                <View style={styles.successWrap}>
                  <View style={styles.successCircle}>
                    <MaterialCommunityIcons name="check" size={40} color="#10B981" />
                  </View>
                  <Text style={styles.successTitle}>Account Created!</Text>
                  <Text style={styles.successBody}>Welcome to Bugema University NoticeBoard. Redirecting to login...</Text>
                </View>
              ) : (
                <>
                  {step === 0 && (
                    <>
                      <Text style={styles.stepTitle}>Personal Details</Text>
                      <View style={styles.row}>
                        <View style={[styles.inputWrap, styles.half, errors.first_name && styles.inputWrapError]}>
                          <MaterialCommunityIcons name="account-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                          <TextInput style={styles.input} placeholder="First name" placeholderTextColor="#64748B" autoCapitalize="words" value={values.first_name} onChangeText={(t) => setValue('first_name', t, { shouldValidate: true })} />
                        </View>
                        <View style={[styles.inputWrap, styles.half, errors.last_name && styles.inputWrapError]}>
                          <MaterialCommunityIcons name="account-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                          <TextInput style={styles.input} placeholder="Last name" placeholderTextColor="#64748B" autoCapitalize="words" value={values.last_name} onChangeText={(t) => setValue('last_name', t, { shouldValidate: true })} />
                        </View>
                      </View>
                      {(errors.first_name || errors.last_name) && <Text style={styles.inputError}>{errors.first_name?.message || errors.last_name?.message}</Text>}

                      <View style={[styles.inputWrap, errors.email && styles.inputWrapError]}>
                        <MaterialCommunityIcons name="email-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="University email" placeholderTextColor="#64748B" autoCapitalize="none" keyboardType="email-address" value={values.email} onChangeText={(t) => setValue('email', t, { shouldValidate: true })} />
                      </View>
                      {errors.email && <Text style={styles.inputError}>{errors.email.message}</Text>}

                      <View style={[styles.inputWrap, errors.password && styles.inputWrapError]}>
                        <MaterialCommunityIcons name="lock-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Create password" placeholderTextColor="#64748B" secureTextEntry value={values.password} onChangeText={(t) => setValue('password', t, { shouldValidate: true })} />
                      </View>
                      {errors.password && <Text style={styles.inputError}>{errors.password.message}</Text>}
                      <PasswordStrength password={values.password} />

                      <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                        <LinearGradient colors={['#3B82F6', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                          <Text style={styles.btnText}>Continue</Text>
                          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Text style={styles.stepTitle}>Academic Details</Text>
                      {renderPicker('School', values.school, SCHOOLS, (v) => {
                        setValue('school', v, { shouldValidate: true });
                        setValue('department', '', { shouldValidate: true });
                        setValue('course', '', { shouldValidate: true });
                      }, 'Select your school')}

                      {renderPicker('Department', values.department, departments, (v) => {
                        setValue('department', v, { shouldValidate: true });
                        setValue('course', '', { shouldValidate: true });
                      }, values.school ? 'Select your department' : 'Select a school first', !values.school)}

                      {renderPicker('Course', values.course, courses, (v) => setValue('course', v, { shouldValidate: true }), values.department ? 'Select your course' : 'Select a department first', !values.department)}

                      {renderPicker('Academic Year', values.academic_year, ACADEMIC_YEARS, (v) => setValue('academic_year', v, { shouldValidate: true }), 'Select year')}

                      <View style={styles.rowBetween}>
                        <TouchableOpacity style={styles.ghostBtn} onPress={prevStep}>
                          <Text style={styles.ghostBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
                          <LinearGradient colors={['#3B82F6', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                            <Text style={styles.btnText}>Review</Text>
                            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <Text style={styles.stepTitle}>Review Details</Text>
                      <View style={styles.reviewCard}>
                        <ReviewRow icon="account" label="Name" value={`${values.first_name} ${values.last_name}`} />
                        <ReviewRow icon="email" label="Email" value={values.email} />
                        <ReviewRow icon="school" label="School" value={values.school} />
                        <ReviewRow icon="domain" label="Department" value={values.department} />
                        <ReviewRow icon="book-open-variant" label="Course" value={values.course} />
                        <ReviewRow icon="calendar" label="Year" value={values.academic_year} />
                      </View>

                      {message && (
                        <View style={styles.errorBanner}>
                          <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
                          <Text style={styles.errorText}>{message}</Text>
                        </View>
                      )}

                      <View style={styles.rowBetween}>
                        <TouchableOpacity style={styles.ghostBtn} onPress={prevStep}>
                          <Text style={styles.ghostBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit(onRegister)} disabled={loading}>
                          <LinearGradient colors={['#10B981', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                            <Text style={styles.btnText}>{loading ? 'Creating...' : 'Create Account'}</Text>
                            {!loading && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}
            </Animated.View>

            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.replace('Login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ReviewRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <MaterialCommunityIcons name={icon as any} size={18} color="#94A3B8" />
        <Text style={styles.reviewLabel}>{label}</Text>
      </View>
      <Text style={styles.reviewValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },
  orb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  stepNum: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  stepLine: { width: 24, height: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  stepLineActive: { backgroundColor: '#3B82F6' },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoRing: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  logo: { width: '100%', height: '100%' },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginTop: 10 },
  brandSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  glassCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 20,
  },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 18 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 14, height: 52, marginBottom: 4,
  },
  inputWrapError: { borderColor: '#EF4444' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#F1F5F9', fontSize: 14, fontWeight: '500' },
  inputError: { color: '#FCA5A5', fontSize: 12, marginBottom: 8, marginLeft: 4, fontWeight: '500' },
  strengthTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
  strengthFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'right' },
  primaryBtn: { borderRadius: 14, overflow: 'hidden', flex: 1 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ghostBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginRight: 10 },
  ghostBtnText: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pickerLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  pickerWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)', paddingHorizontal: 14, height: 46, marginBottom: 8 },
  pickerWrapEmpty: { borderColor: 'rgba(148,163,184,0.1)', borderStyle: 'dashed' },
  pickerText: { color: '#F1F5F9', fontSize: 14, fontWeight: '500', marginLeft: 8, flex: 1 },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pickerChipActive: { backgroundColor: '#3B82F620', borderColor: '#3B82F6' },
  pickerChipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  pickerChipTextActive: { color: '#60A5FA' },
  reviewCard: { backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 16, padding: 16, gap: 12, marginBottom: 16 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  reviewValue: { color: '#F1F5F9', fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 8 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1 },
  successWrap: { alignItems: 'center', paddingVertical: 24 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 2, borderColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  successBody: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  footerLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  footerLink: { color: '#60A5FA', fontSize: 14, fontWeight: '800' },
});
