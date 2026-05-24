import React, { useEffect, useState } from 'react';
import { Text, View, Switch, Button, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import { api } from '../api/client';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useTheme } from '../context/ThemeContext';
import FormTextInput from '../components/FormTextInput';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import OptionPicker from '../components/OptionPicker';
import {
  getAllowedCategoryLabels,
  getNoticeCategoryLabel,
  getNoticeCategoryValueFromLabel,
} from '../constants/notices';
import type { NoticeCategory } from '../constants/notices';

type Props = NativeStackScreenProps<RootStackParamList, 'EditNotice'>;

export default function EditNoticeScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<NoticeCategory>('campus_life');
  const [userMeta, setUserMeta] = useState({ isStaff: false, isFaculty: false, designation: '' });

  const canPostEducation = React.useMemo(() => {
    if (userMeta.isStaff) return true;
    if (!userMeta.isFaculty) return false;
    const normalized = userMeta.designation.toLowerCase();
    return ['registrar', 'administrator', 'admin', 'hod', 'head of department'].some((keyword) =>
      normalized.includes(keyword),
    );
  }, [userMeta.designation, userMeta.isFaculty, userMeta.isStaff]);

  const allowedCategories = React.useMemo<NoticeCategory[]>(() => {
    const base: NoticeCategory[] = ['campus_life', 'business'];
    if (canPostEducation) {
      base.push('education');
    }
    return base;
  }, [canPostEducation]);

  const categoryLabel = React.useMemo(() => getNoticeCategoryLabel(category), [category]);
  const categoryOptions = React.useMemo(() => getAllowedCategoryLabels(allowedCategories), [allowedCategories]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [profileResponse, noticeResponse] = await Promise.all([
          api.get('/users/profiles/me/'),
          api.get(`/notices/${id}/`),
        ]);
        if (!mounted) return;
        const profile = profileResponse.data;
        setUserMeta({
          isStaff: Boolean(profile.is_staff),
          isFaculty: Boolean(profile.is_faculty),
          designation: profile.designation || '',
        });
        const n = noticeResponse.data;
        setTitle(n.title);
        setDescription(n.description);
        setIsPinned(!!n.is_pinned);
        setCategory((n.category as NoticeCategory) || 'campus_life');
      } catch (error) {
        // silently ignore; individual UI inputs will reflect defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!allowedCategories.includes(category)) {
      setCategory(allowedCategories[0] ?? 'campus_life');
    }
  }, [allowedCategories, category]);

  const handleCategoryChange = (label: string) => {
    const value = getNoticeCategoryValueFromLabel(label);
    if (value && allowedCategories.includes(value)) {
      setCategory(value);
    } else if (allowedCategories.length) {
      setCategory(allowedCategories[0]);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await api.put(`/notices/${id}/`, {
        title,
        description,
        is_pinned: isPinned,
        category,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HeaderBar title="Edit Notice" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <FormTextInput
          label="Title"
          value={title}
          onChangeText={setTitle}
          trailing={<MaterialCommunityIcons name="text" size={18} color={theme.colors.muted} />}
        />
        <FormTextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          trailing={<MaterialCommunityIcons name="note-text-outline" size={18} color={theme.colors.muted} />}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: theme.colors.text }}>Pin notice</Text>
          <Switch value={isPinned} onValueChange={setIsPinned} thumbColor={isPinned ? theme.colors.primary : undefined} />
        </View>
        <OptionPicker
          label="Category"
          value={categoryLabel}
          options={categoryOptions}
          onChange={handleCategoryChange}
          placeholder="Select category"
          disabled={categoryOptions.length === 0}
        />
        <View style={{ marginTop: 16 }}>
          <Button title={saving ? 'Saving...' : 'Save'} onPress={onSave} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


