import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import OptionPicker from '../components/OptionPicker';
import FormTextInput from '../components/FormTextInput';
import { useTheme } from '../context/ThemeContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { RootStackParamList } from '../App';
import { spacing } from '../theme';
import {
  ACADEMIC_YEARS,
  COURSES_BY_DEPARTMENT,
  DEPARTMENTS_BY_SCHOOL,
  SCHOOLS,
} from '../constants/university';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

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

export default function RegisterScreen({ navigation }: Props) {
  const { theme, mode, setMode } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1],
  );

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      school: '',
      department: '',
      course: '',
      academic_year: ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1],
    },
  });

  useEffect(() => {
    register('first_name');
    register('last_name');
    register('email');
    register('password');
    register('school');
    register('department');
    register('course');
    register('academic_year');
  }, [register]);

  // Reset department and course when school changes
  useEffect(() => {
    if (selectedSchool) {
      // Clear department and course when school changes
      setSelectedDepartment('');
      setSelectedCourse('');
      setValue('department', '', { shouldValidate: true });
      setValue('course', '', { shouldValidate: true });
    }
  }, [selectedSchool, setValue]);

  // Reset course when department changes
  useEffect(() => {
    if (selectedDepartment) {
      setSelectedCourse('');
      setValue('course', '', { shouldValidate: true });
    }
  }, [selectedDepartment, setValue]);

  useEffect(() => {
    if (selectedAcademicYear) {
      setValue('academic_year', selectedAcademicYear, { shouldValidate: true });
    }
  }, [selectedAcademicYear, setValue]);

  const onRegister = async (data: z.infer<typeof schema>) => {
    try {
      setMessage(null);
      await api.post('/users/register/register/', { ...data, username: data.email });
      setMessage('Account created. You can login now.');
      setTimeout(() => navigation.replace('Login'), 800);
    } catch (e: any) {
      setMessage('Registration failed');
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
        >
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="alpha-b-circle" size={28} color={theme.colors.primary} />
            <TouchableOpacity
              onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              style={styles.modeToggle}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={mode === 'dark' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                size={18}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.heading, { color: theme.colors.text }]}>Create your account</Text>
          <Text style={[styles.subheading, { color: theme.colors.muted }]}>
            Select your school and department to receive relevant notifications and notices.
          </Text>
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow ?? '#000',
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Personal details</Text>
            <View style={styles.row}>
              <FormTextInput
                label="First name"
                containerStyle={styles.compactField}
                autoCapitalize="words"
                onChangeText={(t) => setValue('first_name', t, { shouldValidate: true })}
                error={errors.first_name?.message}
                trailing={<MaterialCommunityIcons name="account-outline" size={18} color={theme.colors.muted} />}
              />
              <FormTextInput
                label="Last name"
                containerStyle={styles.compactField}
                autoCapitalize="words"
                onChangeText={(t) => setValue('last_name', t, { shouldValidate: true })}
                error={errors.last_name?.message}
                trailing={<MaterialCommunityIcons name="account-outline" size={18} color={theme.colors.muted} />}
              />
            </View>
            <FormTextInput
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(t) => setValue('email', t, { shouldValidate: true })}
              error={errors.email?.message}
              trailing={<MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.muted} />}
            />
            <FormTextInput
              label="Password"
              secureTextEntry
              enablePasswordToggle
              onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
              error={errors.password?.message}
              trailing={<MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.muted} />}
            />
            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Academic details</Text>
            <Text style={[styles.requiredHint, { color: theme.colors.muted }]}>
              Required to receive notifications for your school and department
            </Text>
            <OptionPicker
              label="School *"
              value={selectedSchool}
              options={SCHOOLS}
              placeholder="Select your school"
              onChange={(value) => {
                setSelectedSchool(value);
                setValue('school', value, { shouldValidate: true });
              }}
              error={errors.school?.message}
            />
            <OptionPicker
              label="Department *"
              value={selectedDepartment}
              options={DEPARTMENTS_BY_SCHOOL[selectedSchool] || []}
              placeholder={selectedSchool ? "Select your department" : "Select a school first"}
              onChange={(value) => {
                setSelectedDepartment(value);
                setValue('department', value, { shouldValidate: true });
              }}
              disabled={!selectedSchool}
              error={errors.department?.message}
            />
            <OptionPicker
              label="Course *"
              value={selectedCourse}
              options={COURSES_BY_DEPARTMENT[selectedDepartment] || []}
              placeholder={selectedDepartment ? "Select your course" : "Select a department first"}
              onChange={(value) => {
                setSelectedCourse(value);
                setValue('course', value, { shouldValidate: true });
              }}
              disabled={!selectedDepartment}
              error={errors.course?.message}
            />
            <OptionPicker
              label="Academic Year *"
              value={selectedAcademicYear}
              options={ACADEMIC_YEARS}
              onChange={(value) => {
                setSelectedAcademicYear(value);
                setValue('academic_year', value, { shouldValidate: true });
              }}
              error={errors.academic_year?.message}
            />
            {message ? (
              <Text style={[styles.feedback, { color: message.includes('failed') ? '#b91c1c' : theme.colors.primary }]}>
                {message}
              </Text>
            ) : null}
            <PrimaryButton
              title={isSubmitting ? 'Creating...' : 'Create account'}
              onPress={handleSubmit(onRegister)}
            />
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.secondaryLabel, { color: theme.colors.muted }]}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')} activeOpacity={0.8}>
              <Text style={[styles.secondaryLink, { color: theme.colors.primary }]}>
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
    paddingBottom: 36,
    flexGrow: 1,
    gap: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeToggle: {
    padding: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.4)',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 15,
  },
  formCard: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  requiredHint: {
    fontSize: 13,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  compactField: {
    flex: 1,
  },
  feedback: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryLabel: {
    fontSize: 14,
  },
  secondaryLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
