import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import HeaderBar from '../components/HeaderBar';
import PrimaryButton from '../components/PrimaryButton';
import FormTextInput from '../components/FormTextInput';
import OptionPicker from '../components/OptionPicker';
import Card from '../components/Card';
import SectionHeading from '../components/SectionHeading';
import { SCHOOLS, DEPARTMENTS_BY_SCHOOL } from '../constants/university';
import { spacing } from '../theme';

// Designation options matching backend UserDesignation choices
const DESIGNATION_OPTIONS = [
  { label: 'Vice Chancellor', value: 'vice_chancellor' },
  { label: 'Registrar', value: 'registrar' },
  { label: 'Business Office', value: 'business_office' },
  { label: 'Head of Security', value: 'security' },
  { label: 'Chaplain', value: 'other' }, // Chaplain uses 'other' designation
  { label: 'Dean of School', value: 'dean', requiresSchool: true },
  { label: 'Dean of Students', value: 'dean', requiresSchool: false },
  { label: 'Head of Department (HOD)', value: 'hod' },
  { label: 'Lecturer', value: 'lecturer' },
  { label: 'Other', value: 'other' },
];

const formSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  designation: z.string().min(1, 'Designation is required'),
  department: z.string().optional(),
  school: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AdminUserCreateScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { showSuccess, showError } = useToast();
  const [creating, setCreating] = useState(false);
  const [isFaculty, setIsFaculty] = useState(false);
  const [isStaff, setIsStaff] = useState(true);
  const [isSuperuser, setIsSuperuser] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      designation: '',
      department: '',
      school: '',
      phone: '',
    },
  });

  const selectedDesignation = watch('designation');
  const selectedSchool = watch('school');
  const [selectedDesignationLabel, setSelectedDesignationLabel] = useState<string>('');

  // Determine if department selection is required (for HOD)
  const requiresDepartment = useMemo(() => {
    return selectedDesignation === 'hod';
  }, [selectedDesignation]);

  // Determine if school selection is required (for Dean of School)
  const requiresSchool = useMemo(() => {
    return selectedDesignation === 'dean' && selectedDesignationLabel === 'Dean of School';
  }, [selectedDesignation, selectedDesignationLabel]);

  // Get available departments based on selected school
  const availableDepartments = useMemo(() => {
    if (selectedSchool && DEPARTMENTS_BY_SCHOOL[selectedSchool]) {
      return DEPARTMENTS_BY_SCHOOL[selectedSchool];
    }
    // If no school selected, return all departments flattened
    return Object.values(DEPARTMENTS_BY_SCHOOL).flat();
  }, [selectedSchool]);

  // Auto-set is_faculty based on designation
  React.useEffect(() => {
    const facultyDesignations = ['dean', 'hod', 'lecturer'];
    if (selectedDesignation && facultyDesignations.includes(selectedDesignation)) {
      setIsFaculty(true);
    } else {
      setIsFaculty(false);
    }

    // Treat all admin/academic designations as staff
    const staffDesignations = ['vice_chancellor', 'registrar', 'business_office', 'security', 'dean', 'hod', 'lecturer', 'other'];
    if (selectedDesignation && staffDesignations.includes(selectedDesignation)) {
      setIsStaff(true);
    }
  }, [selectedDesignation]);

  // Reset department when school changes (for Dean)
  React.useEffect(() => {
    if (requiresSchool && selectedSchool) {
      setValue('department', '', { shouldValidate: false });
    }
  }, [selectedSchool, requiresSchool, setValue]);

  // Reset school when designation changes away from Dean
  React.useEffect(() => {
    if (!requiresSchool) {
      setValue('school', '', { shouldValidate: false });
    }
  }, [requiresSchool, setValue]);

  // Reset department when designation changes away from HOD
  React.useEffect(() => {
    if (!requiresDepartment) {
      setValue('department', '', { shouldValidate: false });
    }
  }, [requiresDepartment, setValue]);

  const onSubmit = async (data: FormValues) => {
    // Validate required fields based on designation
    if (requiresDepartment && !data.department) {
      showError('Please select a department for Head of Department');
      return;
    }

    if (requiresSchool && !data.school) {
      showError('Please select a school for Dean');
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        designation: data.designation,
        is_faculty: isFaculty,
        is_staff: isStaff || isSuperuser,
        is_superuser: isSuperuser,
      };

      if (data.department) {
        payload.department = data.department.trim();
      }

      if (data.school) {
        payload.school = data.school.trim();
      }

      if (data.phone) {
        payload.phone = data.phone.trim();
      }

      await api.post('/users/register/register-staff/', payload);

      showSuccess('User created successfully', {
        action: {
          label: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.userMessage ||
        'Failed to create user. Please try again.';
      showError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HeaderBar title="Create User" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            <SectionHeading title="Account Information" />
            <View style={{ gap: spacing.md }}>
              <Controller
                control={control}
                name="username"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextInput
                    label="Username"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    error={errors.username?.message}
                    trailing={<MaterialCommunityIcons name="account" size={18} color={theme.colors.muted} />}
                  />
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextInput
                    label="Email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email?.message}
                    trailing={<MaterialCommunityIcons name="email" size={18} color={theme.colors.muted} />}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextInput
                    label="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    enablePasswordToggle
                    error={errors.password?.message}
                    trailing={<MaterialCommunityIcons name="lock" size={18} color={theme.colors.muted} />}
                  />
                )}
              />
            </View>
          </Card>

          <Card>
            <SectionHeading title="Personal Information" />
            <View style={{ gap: spacing.md }}>
              <Controller
                control={control}
                name="first_name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextInput
                    label="First Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={errors.first_name?.message}
                    trailing={<MaterialCommunityIcons name="account-outline" size={18} color={theme.colors.muted} />}
                  />
                )}
              />

              <Controller
                control={control}
                name="last_name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextInput
                    label="Last Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={errors.last_name?.message}
                    trailing={<MaterialCommunityIcons name="account-outline" size={18} color={theme.colors.muted} />}
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextInput
                    label="Phone (Optional)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
                    error={errors.phone?.message}
                    trailing={<MaterialCommunityIcons name="phone" size={18} color={theme.colors.muted} />}
                  />
                )}
              />
            </View>
          </Card>

          <Card>
            <SectionHeading title="Role & Assignment" />
            <View style={{ gap: spacing.md }}>
              <Controller
                control={control}
                name="designation"
                render={({ field: { value, onChange } }) => (
                  <OptionPicker
                    label="Designation"
                    value={selectedDesignationLabel}
                    options={DESIGNATION_OPTIONS.map((opt) => opt.label)}
                    onChange={(label) => {
                      const option = DESIGNATION_OPTIONS.find((opt) => opt.label === label);
                      if (option) {
                        onChange(option.value);
                        setValue('designation', option.value, { shouldValidate: true });
                        setSelectedDesignationLabel(label);
                      }
                    }}
                    placeholder="Select designation"
                    error={errors.designation?.message}
                  />
                )}
              />

              {requiresSchool && (
                <Controller
                  control={control}
                  name="school"
                  render={({ field: { value, onChange } }) => (
                    <OptionPicker
                      label="School *"
                      value={value}
                      options={SCHOOLS}
                      onChange={(val) => {
                        onChange(val);
                        setValue('school', val, { shouldValidate: true });
                      }}
                      placeholder="Select school"
                      error={errors.school?.message}
                    />
                  )}
                />
              )}

              {requiresDepartment && (
                <Controller
                  control={control}
                  name="department"
                  render={({ field: { value, onChange } }) => (
                    <OptionPicker
                      label="Department *"
                      value={value}
                      options={availableDepartments}
                      onChange={(val) => {
                        onChange(val);
                        setValue('department', val, { shouldValidate: true });
                      }}
                      placeholder="Select department"
                      disabled={requiresSchool && !selectedSchool}
                      error={errors.department?.message}
                    />
                  )}
                />
              )}

              {!requiresDepartment && !requiresSchool && selectedDesignation && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 15 }}>
                      Faculty Member
                    </Text>
                    <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 2 }}>
                      Automatically set based on designation
                    </Text>
                  </View>
                  <Switch
                    value={isFaculty}
                    onValueChange={setIsFaculty}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    disabled={true}
                  />
                </View>
              )}

              <View
                style={{
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 10,
                  padding: spacing.md,
                  backgroundColor: theme.colors.card,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                  Permissions
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Staff account</Text>
                    <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                      Grants staff privileges (required for admin roles)
                    </Text>
                  </View>
                  <Switch
                    value={isStaff}
                    onValueChange={(v) => {
                      setIsStaff(v);
                      if (!v && isSuperuser) {
                        setIsSuperuser(false);
                      }
                    }}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Superuser (VC / IT)</Text>
                    <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                      Full control; automatically marks as staff
                    </Text>
                  </View>
                  <Switch
                    value={isSuperuser}
                    onValueChange={(v) => {
                      setIsSuperuser(v);
                      if (v) setIsStaff(true);
                    }}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  />
                </View>
              </View>
            </View>
          </Card>

          <PrimaryButton
            title={creating ? 'Creating User...' : 'Create User'}
            onPress={handleSubmit(onSubmit)}
            disabled={creating}
          />

          {creating && (
            <View style={{ alignItems: 'center', padding: spacing.md }}>
              <ActivityIndicator />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
