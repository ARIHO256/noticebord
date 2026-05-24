import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import HeaderBar from '../components/HeaderBar';
import PrimaryButton from '../components/PrimaryButton';
import FormTextInput from '../components/FormTextInput';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import OptionPicker from '../components/OptionPicker';
import MultiSelectPicker from '../components/MultiSelectPicker';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import { spacing } from '../theme';
import {
  getAllowedCategoryLabels,
  getNoticeCategoryLabel,
  getNoticeCategoryValueFromLabel,
  NOTICE_PRIORITY_VALUES,
  NOTICE_PRIORITY_LABELS,
  getNoticePriorityColor,
} from '../constants/notices';
import type { NoticeCategory, NoticePriority } from '../constants/notices';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SCHOOLS, DEPARTMENTS_BY_SCHOOL } from '../constants/university';
import { moderateContent } from '../services/contentModeration';

const FALLBACK_AVATAR = require('../../assets/bu-logo.png');

const FORM_CATEGORY_VALUES = ['campus_life', 'business', 'education'] as const;
const formSchema = z.object({
  title: z.string().trim().min(3, 'Title is required'),
  description: z.string().trim().min(10, 'Description is required'),
  department: z.string().optional(),
  category: z.enum(FORM_CATEGORY_VALUES),
  priority: z.enum(['urgent', 'important', 'normal']).optional(),
  expires_at: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type PendingAttachment = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video' | 'audio' | 'document';
  size?: number | null;
};

type UserMeta = {
  isFaculty: boolean;
  isStaff: boolean;
  designation: string;
};

const LEADERSHIP_KEYWORDS = ['registrar', 'administrator', 'admin', 'hod', 'head of department'];

// Cross-cutting official roles that can post to all schools or specific schools/departments
const CROSS_CUTTING_ROLES = [
  'Vice Chancellor',
  'VC',
  'Registrar',
  'Business Office',
  'Dean of Students',
  'Security',
  'Head of Security',
  'Chaplain',
];

const makeId = () => `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ensureMimeType = (attachment: PendingAttachment) => {
  if (attachment.mimeType) return attachment.mimeType;
  switch (attachment.kind) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
};

function CreateNoticeScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const { showSuccess, showError, showWarning } = useToast();
  const queryClient = useQueryClient();
  const [userMeta, setUserMeta] = useState<UserMeta>({ isFaculty: false, isStaff: false, designation: '' });
  const [ready, setReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [targetAllSchools, setTargetAllSchools] = useState<boolean>(false);
  const [targetAllStudentsAndStaff, setTargetAllStudentsAndStaff] = useState<boolean>(false);
  const initialDepartmentRef = useRef<string>('');

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      department: '',
      category: 'campus_life',
    },
  });

  const categoryValue = watch('category');

  const canPostEducation = useMemo(() => {
    if (userMeta.isStaff) return true;
    if (!userMeta.isFaculty) return false;
    const normalized = userMeta.designation.toLowerCase();
    return LEADERSHIP_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }, [userMeta.designation, userMeta.isFaculty, userMeta.isStaff]);

  const isHod = useMemo(() => {
    if (!userMeta.designation) return false;
    const normalized = userMeta.designation.toLowerCase();
    return LEADERSHIP_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }, [userMeta.designation]);

  const isCrossCuttingRole = useMemo(() => {
    if (!userMeta.designation) return false;
    return CROSS_CUTTING_ROLES.some((role) => 
      userMeta.designation.toLowerCase().includes(role.toLowerCase())
    );
  }, [userMeta.designation]);

  const isStudent = useMemo(
    () => !userMeta.isStaff && !userMeta.isFaculty,
    [userMeta.isFaculty, userMeta.isStaff],
  );

  const openExpiryPicker = useCallback(() => {
    if (Platform.OS === 'android') {
      const current = expiresAt || new Date();
      const minDate = new Date();

      const openTimePicker = (baseDate: Date) => {
        DateTimePickerAndroid.open({
          value: baseDate,
          mode: 'time',
          onChange: (timeEvent, selectedTime) => {
            if (!timeEvent || timeEvent.type === 'dismissed' || !selectedTime) {
              return;
            }
            const finalDate = new Date(baseDate);
            finalDate.setHours(selectedTime.getHours());
            finalDate.setMinutes(selectedTime.getMinutes());
            finalDate.setSeconds(0);
            finalDate.setMilliseconds(0);
            setExpiresAt(finalDate);
          },
        });
      };

      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: minDate,
        onChange: (dateEvent, selectedDate) => {
          if (!dateEvent || dateEvent.type === 'dismissed' || !selectedDate) {
            return;
          }
          openTimePicker(selectedDate);
        },
      });
      return;
    }

    setShowExpiryPicker(true);
  }, [expiresAt]);
  const isCasualUser = isStudent;

  const canEditDepartment = useMemo(
    () => userMeta.isStaff || isHod || isCrossCuttingRole,
    [isHod, userMeta.isStaff, isCrossCuttingRole],
  );

  const allowedCategoryValues = useMemo<NoticeCategory[]>(() => {
    const base: NoticeCategory[] = ['campus_life', 'business'];
    if (canPostEducation) {
      base.push('education');
    }
    return base;
  }, [canPostEducation]);

  const ensureStudentTitle = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) {
        return 'Student Post';
      }
      const firstLine = trimmed.split(/\r?\n/)[0] ?? trimmed;
      const normalized = firstLine.replace(/\s+/g, ' ').trim();
      const title = normalized.slice(0, 80);
      return title.length >= 3 ? title : `${title}...`.slice(0, 10) || 'Student Post';
    },
    [],
  );

  useEffect(() => {
    if (!allowedCategoryValues.includes(categoryValue as NoticeCategory)) {
      const fallback = allowedCategoryValues[0] ?? 'campus_life';
      setValue('category', fallback as FormValues['category'], { shouldValidate: true });
    }
  }, [allowedCategoryValues, categoryValue, setValue]);

  useEffect(() => {
    if (isCasualUser) {
      const preferred = allowedCategoryValues.includes('campus_life')
        ? 'campus_life'
        : allowedCategoryValues[0] ?? 'campus_life';
      setValue('category', preferred as FormValues['category'], { shouldValidate: true });
    }
  }, [allowedCategoryValues, isCasualUser, setValue]);

  const categoryLabel = useMemo(() => getNoticeCategoryLabel(categoryValue), [categoryValue]);
  const categoryOptionLabels = useMemo(
    () => getAllowedCategoryLabels(allowedCategoryValues),
    [allowedCategoryValues],
  );

  const handleCategoryChange = useCallback(
    (label: string) => {
      const slug = getNoticeCategoryValueFromLabel(label);
      const fallback = allowedCategoryValues[0] ?? 'campus_life';
      const nextValue = slug && allowedCategoryValues.includes(slug) ? slug : fallback;
      setValue('category', nextValue as FormValues['category'], { shouldValidate: true });
    },
    [allowedCategoryValues, setValue],
  );


  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.get('/users/profiles/me/');
        if (!mounted) return;
        const meta = {
          isFaculty: Boolean(response.data.is_faculty),
          isStaff: Boolean(response.data.is_staff),
          designation: response.data.designation || '',
        };
        setUserMeta(meta);
        setProfileAvatar(response.data.avatar_url || null);
        const userDepartment = response.data.department || '';
        const userSchool = response.data.school || '';
        initialDepartmentRef.current = userDepartment;
        setValue('department', userDepartment);
        // Set school: prefer user's school, otherwise find school by department, otherwise use first school
        if (userSchool && SCHOOLS.includes(userSchool)) {
          setSelectedSchool(userSchool);
        } else if (userDepartment) {
          // Try to find which school this department belongs to
          const foundSchool = SCHOOLS.find(school => 
            (DEPARTMENTS_BY_SCHOOL[school] || []).includes(userDepartment)
          );
          if (foundSchool) {
            setSelectedSchool(foundSchool);
          } else if (SCHOOLS.length > 0) {
            setSelectedSchool(SCHOOLS[0]);
          }
        } else if (SCHOOLS.length > 0) {
          setSelectedSchool(SCHOOLS[0]);
        }
        if (!meta.isStaff && !meta.isFaculty) {
          const defaultTitle = ensureStudentTitle('');
          setValue('title', defaultTitle as FormValues['title'], { shouldValidate: true });
        }
        setReady(true);
      } catch {
        if (!mounted) return;
        setProfileError('We could not load your profile. Please retry.');
      }
    })();
    // Handle route params for photo/video/feeling
    if (route?.params) {
      const { photoUri, videoUri, feeling } = route.params;
      if (photoUri) {
        const id = makeId();
        setAttachments([{
          id,
          uri: photoUri,
          name: `photo-${id}.jpg`,
          mimeType: 'image/jpeg',
          kind: 'image',
        }]);
      } else if (videoUri) {
        const id = makeId();
        setAttachments([{
          id,
          uri: videoUri,
          name: `video-${id}.mp4`,
          mimeType: 'video/mp4',
          kind: 'video',
        }]);
      }
      if (feeling) {
        const currentDesc = watch('description') || '';
        setValue('description', feeling + (currentDesc ? ' ' + currentDesc : ''));
      }
    }

    return () => {
      mounted = false;
    };
  }, [ensureStudentTitle, navigation, setValue, route?.params, watch]);

  const requestMediaPermission = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow media access to attach images or videos.');
      return false;
    }
    return true;
  }, []);

  const handleAddMedia = useCallback(async () => {
    if (!(await requestMediaPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 0,
    });
    if (result.canceled) return;
    const assets = result.assets ?? [];
    if (!assets.length) return;
    setAttachments((prev) => [
      ...prev,
      ...assets
        .map((asset) => {
          if (!asset.uri) return null;
          const id = makeId();
          const kind: PendingAttachment['kind'] =
            asset.type === 'video'
              ? 'video'
              : asset.type === 'image'
              ? 'image'
              : 'document';
          const fallbackMime =
            kind === 'video'
              ? 'video/mp4'
              : kind === 'image'
              ? 'image/jpeg'
              : 'application/octet-stream';
          const mimeType = asset.mimeType ?? fallbackMime;
          const inferredExt =
            kind === 'video' ? '.mp4' : kind === 'image' ? '.jpg' : '';
          const name =
            asset.fileName ??
            `media-${id}${inferredExt}`;
          return {
            id,
            uri: asset.uri,
            name,
            mimeType,
            kind,
            size: asset.fileSize ?? null,
          } as PendingAttachment;
        })
        .filter(Boolean) as PendingAttachment[],
    ]);
  }, [requestMediaPermission]);

  const handleAddDocuments = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    const canceled = 'canceled' in result ? result.canceled : (result as any).type === 'cancel';
    if (canceled) return;
    const rawAssets: DocumentPicker.DocumentPickerAsset[] =
      'assets' in result && Array.isArray(result.assets)
        ? result.assets
        : 'type' in result && result.type === 'success'
        ? [result as any]
        : [];
    if (!rawAssets.length) return;
    setAttachments((prev) => [
      ...prev,
      ...rawAssets
        .map((asset) => {
          const uri =
            'fileCopyUri' in asset && typeof (asset as any).fileCopyUri === 'string'
              ? (asset as any).fileCopyUri
              : asset.uri;
          if (!uri) return null;
          const id = makeId();
          const mimeType = asset.mimeType ?? 'application/octet-stream';
          let kind: PendingAttachment['kind'] = 'document';
          if (mimeType.startsWith('image/')) kind = 'image';
          else if (mimeType.startsWith('video/')) kind = 'video';
          else if (mimeType.startsWith('audio/')) kind = 'audio';
          return {
            id,
            uri,
            name: asset.name ?? `attachment-${id}`,
            mimeType,
            size: asset.size ?? null,
            kind,
          } as PendingAttachment;
        })
        .filter(Boolean) as PendingAttachment[],
    ]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== id));
  }, []);


  const mediaAttachments = useMemo(
    () => attachments.filter((file) => file.kind !== 'document'),
    [attachments],
  );

  const documentAttachments = useMemo(
    () => attachments.filter((file) => file.kind === 'document'),
    [attachments],
  );

  const uploadAttachments = useCallback(async (noticeId: number) => {
    if (!attachments.length) {
      return { failed: 0, total: 0, suspended: false };
    }
    let failed = 0;
    let suspended = false;
    let suspensionReason = '';
    for (const file of attachments) {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: ensureMimeType(file),
      } as any);
      try {
        const response = await api.post(`/notices/${noticeId}/attachments/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        // Check if notice was suspended due to this attachment
        if (response.data?.notice_suspended) {
          suspended = true;
          suspensionReason = response.data.suspension_reason || 'Your post violates the community guidelines';
        }
      } catch {
        failed += 1;
      }
    }
    return { failed, total: attachments.length, suspended, suspensionReason };
  }, [attachments]);

  const onCreate = useCallback(
    async (values: FormValues) => {
      setStatusMessage(null);
      try {
        // Content moderation check for text only (images will be analyzed after upload)
        const textToCheck = isStudent 
          ? values.description.trim() 
          : `${values.title.trim()} ${values.description.trim()}`;
        
        // Only check text content before posting
        // Images will be analyzed after the post is created
        if (textToCheck) {
          try {
            const { moderateText } = await import('../services/contentModeration');
            const textModerationResult = await moderateText(textToCheck);
            
            if (!textModerationResult.isSafe) {
              // Allow the post but it may be suspended after analysis
              console.warn('Text content flagged but allowing post creation:', textModerationResult.reason);
            }
          } catch (modError: any) {
            // If moderation check fails, log but continue with post creation
            console.warn('Moderation check failed, allowing post creation:', modError);
            // Don't block the post if moderation service is down
          }
        }

        const computedTitle = isStudent
          ? ensureStudentTitle(values.description)
          : values.title.trim();
        // Build department string for cross-cutting roles
        let departmentValue = '';
        if (isCrossCuttingRole) {
          if (targetAllStudentsAndStaff) {
            departmentValue = 'ALL_STUDENTS_AND_STAFF'; // Special value for all students and staff
          } else if (targetAllSchools) {
            departmentValue = 'ALL'; // Special value for all schools (students only)
          } else if (selectedSchools.length > 0 && selectedSchools.includes('All')) {
            // "All" schools selected via MultiSelectPicker
            departmentValue = 'ALL'; // Special value for all schools
          } else if (selectedDepartments.length > 0) {
            // Multiple departments selected
            departmentValue = selectedDepartments.join(',');
          } else if (selectedSchools.length > 0) {
            // Check if "All" is selected
            if (selectedSchools.includes('All')) {
              departmentValue = 'ALL'; // Special value for all schools
            } else {
              // Multiple schools selected - get all departments from those schools
              const allDepts: string[] = [];
              selectedSchools.forEach((school) => {
                const depts = DEPARTMENTS_BY_SCHOOL[school] || [];
                allDepts.push(...depts);
              });
              departmentValue = allDepts.join(',');
            }
          } else {
            // Fallback to single department if available
            departmentValue = canEditDepartment
              ? (values.department || '').trim()
              : initialDepartmentRef.current;
          }
        } else {
          // Regular users - single department
          departmentValue = canEditDepartment
            ? (values.department || '').trim()
            : initialDepartmentRef.current;
        }

        const payload: any = {
          title: computedTitle,
          description: values.description.trim(),
          is_active: true,
          department: departmentValue,
          category: values.category,
          is_pinned: isPinned,
          priority: priority,
        };
        
        // Add expires_at only if a date was selected
        if (expiresAt && expiresAt instanceof Date && !isNaN(expiresAt.getTime())) {
          payload.expires_at = expiresAt.toISOString();
        }
        const response = await api.post('/notices/', payload);
        const noticeId = response.data.id;
        const noticeData = response.data;
        
        // Check if notice was suspended immediately (from text analysis)
        if (noticeData.suspension_reason) {
          Alert.alert(
            'Post Suspended',
            `Your post has been suspended due to: ${noticeData.suspension_reason}`,
            [{ text: 'OK' }]
          );
        }
        
        const { failed, total, suspended, suspensionReason } = await uploadAttachments(noticeId);
        
        // Show immediate alert if post was suspended due to attachment violation
        if (suspended && suspensionReason) {
          Alert.alert(
            'Post Violates Community Guidelines',
            `Your post violates the community guidelines: ${suspensionReason}`,
            [{ text: 'OK' }]
          );
        }
        
        await queryClient.invalidateQueries({ queryKey: ['notices'] });
        await queryClient.invalidateQueries({ queryKey: ['trending-top'] });
        const currentDepartment = userMeta.isStaff ? (values.department || '') : initialDepartmentRef.current;
        const nextCategory =
          allowedCategoryValues.includes(values.category as NoticeCategory) && values.category
            ? values.category
            : (allowedCategoryValues[0] ?? 'campus_life');
        reset({
          title: (isStudent ? ensureStudentTitle('') : '') as FormValues['title'],
          description: '',
          department: canEditDepartment ? currentDepartment : initialDepartmentRef.current,
          category: nextCategory as FormValues['category'],
        });
        setAttachments([]);
        setIsPinned(false);
        setPriority('normal');
        setExpiresAt(null);
        setTargetAllSchools(false);
        setTargetAllStudentsAndStaff(false);
        setSelectedSchools([]);
        setSelectedDepartments([]);
        const successLabel = isCasualUser ? 'Post' : 'Notice';
        const baseMessage =
          failed === 0
            ? `${successLabel} created successfully.`
            : failed === total
            ? `${successLabel} created, but attachments failed to upload.`
            : `${successLabel} created, but some attachments failed to upload.`;
        setStatusMessage(baseMessage);
        
        if (failed === 0) {
          showSuccess(baseMessage, {
            action: {
              label: 'Go to home',
              onPress: () => navigation.navigate('Home'),
            },
          });
        } else {
          showWarning(baseMessage);
        }
      } catch (error: any) {
        console.error('Error creating notice:', error);
        const errorMessage = 
          error?.userMessage || 
          error?.response?.data?.detail || 
          error?.response?.data?.message ||
          error?.message ||
          `Failed to create ${isCasualUser ? 'post' : 'notice'}. Please try again.`;
        setStatusMessage(errorMessage);
        showError(errorMessage);
        
        // Log full error for debugging
        if (__DEV__) {
          console.error('Full error details:', {
            message: error?.message,
            response: error?.response?.data,
            status: error?.response?.status,
          });
        }
      }
    },
      [
      allowedCategoryValues,
      canEditDepartment,
      ensureStudentTitle,
      isCasualUser,
      isPinned,
      isStudent,
      navigation,
      queryClient,
      reset,
      uploadAttachments,
    ],
  );

  if (!ready && !profileError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Create Notice" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (profileError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Create Notice" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: '#dc2626', textAlign: 'center' }}>{profileError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const submitLabel = isCasualUser ? (isSubmitting ? 'Posting...' : 'Post') : (isSubmitting ? 'Creating...' : 'Create notice');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HeaderBar />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 0,
              borderWidth: 0,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              padding: spacing.md,
              gap: spacing.md,
            }}
          >
            {/* What's on your mind? - Description Field */}
            <Controller
              control={control}
              name="description"
              render={({ field: { value, onChange, onBlur } }) =>
                isCasualUser ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: 8,
                      padding: 16,
                      gap: 16,
                      backgroundColor: theme.colors.background,
                    }}
                  >
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Image
                        source={profileAvatar ? { uri: profileAvatar } : FALLBACK_AVATAR}
                        style={{ width: 46, height: 46, borderRadius: 23 }}
                      />
                      <TextInput
                        style={{
                          flex: 1,
                          minHeight: 100,
                          color: theme.colors.text,
                          fontSize: 16,
                          textAlignVertical: 'top',
                        }}
                        placeholder="What's on your mind?"
                        placeholderTextColor={theme.colors.muted}
                        multiline
                        value={value}
                        onChangeText={(text) => {
                          onChange(text);
                          const auto = ensureStudentTitle(text);
                          setValue('title', auto as FormValues['title'], { shouldValidate: true });
                        }}
                        onBlur={onBlur}
                      />
                    </View>
                    {errors.description?.message ? (
                      <Text style={{ color: '#dc2626', fontSize: 13 }}>{errors.description?.message}</Text>
                    ) : null}
                  </View>
                ) : (
                  <>
                    {!isStudent ? (
                      <Controller
                        control={control}
                        name="title"
                        render={({ field: { value, onChange, onBlur } }) => (
                          <FormTextInput
                            label="Title"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            error={errors.title?.message}
                            trailing={
                              <MaterialCommunityIcons name="text" size={18} color={theme.colors.muted} />
                            }
                          />
                        )}
                      />
                    ) : null}
                    <FormTextInput
                      label="What's on your mind?"
                      value={value}
                      onChangeText={(text) => {
                        onChange(text);
                        if (isStudent) {
                          const auto = ensureStudentTitle(text);
                          setValue('title', auto as FormValues['title'], { shouldValidate: true });
                        }
                      }}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      error={errors.description?.message}
                      trailing={
                        <MaterialCommunityIcons
                          name="note-text-outline"
                          size={18}
                          color={theme.colors.muted}
                        />
                      }
                      inputStyle={{ minHeight: 140 }}
                    />
                  </>
                )
              }
            />
            {/* Department Selection - Only if can edit */}
            {canEditDepartment ? (
              <>
                {isCrossCuttingRole ? (
                  <>
                    {/* All Students and Staff Option */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: spacing.md,
                        padding: spacing.md,
                        backgroundColor: theme.colors.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: targetAllStudentsAndStaff ? theme.colors.primary : theme.colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: '600', marginBottom: 4 }}>
                          All Students and Staff
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                          This notice will be visible to all students and staff across the entire university
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setTargetAllStudentsAndStaff(!targetAllStudentsAndStaff);
                          if (!targetAllStudentsAndStaff) {
                            setTargetAllSchools(false);
                            setSelectedSchools([]);
                            setSelectedDepartments([]);
                          }
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: targetAllStudentsAndStaff ? theme.colors.primary : theme.colors.border,
                          backgroundColor: targetAllStudentsAndStaff ? theme.colors.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {targetAllStudentsAndStaff && (
                          <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* All Schools Option (Students Only) */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: spacing.md,
                        padding: spacing.md,
                        backgroundColor: theme.colors.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: targetAllSchools ? theme.colors.primary : theme.colors.border,
                        opacity: targetAllStudentsAndStaff ? 0.5 : 1,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: '600', marginBottom: 4 }}>
                          All Schools (Students Only)
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                          This notice will be visible to all students across all schools
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          if (!targetAllStudentsAndStaff) {
                            setTargetAllSchools(!targetAllSchools);
                            if (!targetAllSchools) {
                              setSelectedSchools([]);
                              setSelectedDepartments([]);
                            }
                          }
                        }}
                        disabled={targetAllStudentsAndStaff}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: targetAllSchools ? theme.colors.primary : theme.colors.border,
                          backgroundColor: targetAllSchools ? theme.colors.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {targetAllSchools && (
                          <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>

                    {!targetAllSchools && !targetAllStudentsAndStaff && (
                      <>
                        {/* Multi-select Schools with "All" option */}
                        <MultiSelectPicker
                          label="Select Schools (Optional)"
                          options={['All', ...SCHOOLS]}
                          selected={selectedSchools}
                          onChange={(schools) => {
                            // Check if "All" is selected
                            const hasAll = schools.includes('All');
                            
                            if (hasAll) {
                              // If "All" is selected, select all schools and clear departments
                              setSelectedSchools(['All', ...SCHOOLS]);
                              setSelectedDepartments([]);
                            } else {
                              // Normal selection - filter out "All" if it exists
                              const actualSchools = schools.filter((school) => school !== 'All');
                              setSelectedSchools(actualSchools);
                              // Update departments based on selected schools
                              const allDepts: string[] = [];
                              actualSchools.forEach((school) => {
                                const depts = DEPARTMENTS_BY_SCHOOL[school] || [];
                                allDepts.push(...depts);
                              });
                              // Remove departments that are not in selected schools
                              setSelectedDepartments((prev) =>
                                prev.filter((dept) => allDepts.includes(dept))
                              );
                            }
                          }}
                          placeholder="Select schools to notify"
                        />

                        {/* Multi-select Departments - Only show if "All" is not selected and schools are selected */}
                        {selectedSchools.length > 0 && !selectedSchools.includes('All') && (
                          <MultiSelectPicker
                            label="Select Departments (Optional)"
                            options={(() => {
                              // Get departments only from selected schools (filter out "All")
                              const depts: string[] = [];
                              selectedSchools
                                .filter((school) => school !== 'All')
                                .forEach((school) => {
                                  const schoolDepts = DEPARTMENTS_BY_SCHOOL[school] || [];
                                  depts.push(...schoolDepts);
                                });
                              return depts;
                            })()}
                            selected={selectedDepartments}
                            onChange={setSelectedDepartments}
                            placeholder="Select specific departments to notify"
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <OptionPicker
                      label="School"
                      value={selectedSchool}
                      options={SCHOOLS}
                      onChange={(value) => {
                        setSelectedSchool(value);
                        const departments = DEPARTMENTS_BY_SCHOOL[value] || [];
                        if (departments.length > 0) {
                          setValue('department', departments[0], { shouldValidate: true });
                        } else {
                          setValue('department', '', { shouldValidate: true });
                        }
                      }}
                      error={errors.department?.message}
                    />
                    <Controller
                      control={control}
                      name="department"
                      render={({ field: { value, onChange } }) => (
                        <OptionPicker
                          label="Department"
                          value={value}
                          options={DEPARTMENTS_BY_SCHOOL[selectedSchool] || []}
                          onChange={(val) => {
                            onChange(val);
                            setValue('department', val, { shouldValidate: true });
                          }}
                          disabled={!selectedSchool}
                          placeholder="Select a school first"
                          error={errors.department?.message}
                        />
                      )}
                    />
                  </>
                )}
              </>
            ) : null}

            {/* Category - Only for staff/faculty */}
            {!isCasualUser ? (
              <Controller
                control={control}
                name="category"
                render={() => (
                  <OptionPicker
                    label="Category"
                    value={categoryLabel}
                    options={categoryOptionLabels}
                    onChange={handleCategoryChange}
                    placeholder="Select category"
                    disabled={categoryOptionLabels.length === 0}
                    error={errors.category?.message}
                  />
                )}
              />
            ) : null}

            {/* Notice Settings - Only for staff/faculty */}
            {!isCasualUser ? (
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: theme.colors.text }}>Pin this notice</Text>
                  <Switch
                    value={isPinned}
                    onValueChange={setIsPinned}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={isPinned ? theme.colors.primaryContrast : theme.colors.muted}
                  />
                </View>

                <View>
                  <Text style={{ color: theme.colors.text, marginBottom: 8 }}>Priority</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {NOTICE_PRIORITY_VALUES.map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setPriority(p)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: priority === p ? getNoticePriorityColor(p) : theme.colors.border,
                          backgroundColor: priority === p ? getNoticePriorityColor(p) + '15' : theme.colors.surface,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: priority === p ? getNoticePriorityColor(p) : theme.colors.text,
                            fontWeight: priority === p ? '700' : '500',
                            fontSize: 12,
                          }}
                        >
                          {NOTICE_PRIORITY_LABELS[p]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={{ color: theme.colors.text, marginBottom: 8 }}>Expiration Date (Optional)</Text>
                  <TouchableOpacity
                    onPress={openExpiryPicker}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: 12,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: theme.colors.surface,
                    }}
                  >
                    <Text style={{ color: expiresAt ? theme.colors.text : theme.colors.muted }}>
                      {expiresAt ? expiresAt.toLocaleDateString() : 'No expiration'}
                    </Text>
                    {expiresAt && (
                      <TouchableOpacity
                        onPress={() => {
                          setExpiresAt(null);
                          setShowExpiryPicker(false);
                        }}
                        style={{ padding: 4 }}
                      >
                        <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.muted} />
                      </TouchableOpacity>
                    )}
                    <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.muted} />
                  </TouchableOpacity>
                  {Platform.OS === 'ios' && showExpiryPicker && (
                    <Modal
                      visible={showExpiryPicker}
                      transparent
                      animationType="slide"
                      onRequestClose={() => setShowExpiryPicker(false)}
                    >
                      <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => setShowExpiryPicker(false)}
                      >
                        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                          <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                              Select Expiry Date
                            </Text>
                            <TouchableOpacity
                              onPress={() => setShowExpiryPicker(false)}
                              style={styles.modalCloseButton}
                            >
                              <Text style={[styles.modalCloseText, { color: theme.colors.primary }]}>
                                Done
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={expiresAt || new Date()}
                            mode="datetime"
                            display="spinner"
                            minimumDate={new Date()}
                            onChange={(event, selectedDate) => {
                              // Handle date selection on iOS
                              if (selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
                                setExpiresAt(selectedDate);
                              }
                            }}
                          />
                        </View>
                      </Pressable>
                    </Modal>
                  )}
                </View>
              </View>
            ) : null}

            {/* Attachments Section */}
            <View style={{ gap: 12 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                Add media or documents to provide additional context.
              </Text>
              {!isCasualUser ? (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={handleAddMedia}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: theme.colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialCommunityIcons
                        name="image-plus"
                        size={22}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                        Choose photos or videos
                      </Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                        Pick multiple items from your gallery.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.muted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddDocuments}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: theme.colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialCommunityIcons
                        name="file-upload-outline"
                        size={22}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                        Attach documents
                      </Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                        Upload PDFs, slides, or other files.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.muted}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                    Use the icons above to include photos or videos. Need to attach handouts? Use the shortcut below.
                  </Text>
                  <TouchableOpacity
                    onPress={handleAddDocuments}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                      gap: 10,
                    }}
                  >
                    <MaterialCommunityIcons name="file-upload-outline" size={18} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Attach documents</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {mediaAttachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {mediaAttachments.map((file) => {
                    const isImage = file.kind === 'image';
                    const isVideo = file.kind === 'video';
                    const isAudio = file.kind === 'audio';
                    return (
                      <View
                        key={file.id}
                        style={{
                          width: 180,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          borderRadius: 16,
                          overflow: 'hidden',
                          backgroundColor: theme.colors.background,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            height: isAudio ? 120 : 170,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          {isImage ? (
                            <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <AttachmentMediaPlayer
                              uri={file.uri}
                              style={{ width: '100%', height: '100%' }}
                              showControls
                              contentFit="cover"
                            />
                          )}
                          {isAudio ? (
                            <MaterialCommunityIcons
                              name="music"
                              size={28}
                              color={theme.colors.primary}
                              style={{ position: 'absolute' }}
                            />
                          ) : null}
                        </View>
                        <View style={{ padding: 12, gap: 6 }}>
                          <Text
                            numberOfLines={1}
                            style={{ color: theme.colors.text, fontWeight: '600' }}
                          >
                            {file.name}
                          </Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                              {file.kind.toUpperCase()}
                            </Text>
                            <TouchableOpacity onPress={() => removeAttachment(file.id)}>
                              <MaterialCommunityIcons
                                name="close"
                                size={18}
                                color={theme.colors.muted}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            {mediaAttachments.length === 0 && (
              <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                Attach up to 10 images or videos to enrich your {isCasualUser ? 'post' : 'notice'}.
              </Text>
            )}

            {documentAttachments.length ? (
              <View style={{ gap: 12 }}>
                {documentAttachments.map((file) => (
                  <View
                    key={file.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: theme.colors.background,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={22}
                        color={theme.colors.primary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: theme.colors.text, fontWeight: '600' }}>
                          {file.name}
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                          {file.mimeType || 'Unknown file'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeAttachment(file.id)}>
                      <MaterialCommunityIcons name="close" size={18} color={theme.colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              {statusMessage ? (
                <Text style={{ color: theme.colors.muted }}>{statusMessage}</Text>
              ) : null}
              <PrimaryButton
                title={submitLabel}
                onPress={handleSubmit(onCreate)}
                disabled={isSubmitting}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateNoticeScreen;
