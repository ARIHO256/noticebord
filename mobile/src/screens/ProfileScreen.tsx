import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/client';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import FormTextInput from '../components/FormTextInput';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import Card from '../components/Card';
import ScreenContainer from '../components/ScreenContainer';
import SectionHeading from '../components/SectionHeading';
import { spacing } from '../theme';
import { AuthContext } from '../context/AuthContext';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';

type Profile = {
  id: number;
  username: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  is_faculty?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  department?: string | null;
  designation?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  school?: string | null;
  course?: string | null;
  academic_year?: string | null;
};

export default function ProfileScreen() {
  const { theme, setMode, mode } = useTheme();
  const { signOut } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const profileQuery = useCurrentUserProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profileLoading = profileQuery.isLoading && !profileQuery.data;
  const profileErrorMessage =
    profileQuery.error && (profileQuery.error as any)?.userMessage
      ? (profileQuery.error as any).userMessage
      : profileQuery.error && (profileQuery.error as any)?.message
      ? (profileQuery.error as any).message
      : null;

  useEffect(() => {
    if (profileQuery.data) {
      setProfile(profileQuery.data as Profile);
    }
  }, [profileQuery.data]);

  const onSave = async () => {
    if (!profile) return;
    const { id, ...rest } = profile;
    const resp = await api.put(`/users/profiles/${id}/`, rest);
    const updated = resp.data;
    setProfile(updated);
    queryClient.setQueryData(['current-user-profile'], updated);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const onPickAvatar = async () => {
    if (!profile) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', { uri: res.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const resp = await api.put(`/users/profiles/${profile.id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const updated = resp.data;
      setProfile(updated);
      queryClient.setQueryData(['current-user-profile'], updated);
    } catch (e) {
      Alert.alert('Upload failed', 'Could not upload avatar');
    } finally {
      setUploading(false);
    }
  };

  if (profileLoading && !profile) {
    return (
      <ScreenContainer title="My Profile" padded={false}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.stateText, { color: theme.colors.muted }]}>Loading profile…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer title="My Profile" padded={false}>
        <View style={styles.centeredState}>
          <Text style={[styles.stateText, { color: theme.colors.text, textAlign: 'center' }]}>
            {error || profileErrorMessage || 'Profile unavailable.'}
          </Text>
          <PrimaryButton title="Retry" onPress={() => profileQuery.refetch()} style={styles.retryButton} />
        </View>
      </ScreenContainer>
    );
  }

  const avatarUri = profile.avatar_url || 'https://via.placeholder.com/160x160.png?text=%20';

  return (
    <ScreenContainer
      title="My Profile"
      right={
        <TouchableOpacity
          onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          style={styles.modeToggle}
          activeOpacity={0.85}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 12 }}>
            {mode === 'dark' ? 'Light mode' : 'Dark mode'}
          </Text>
        </TouchableOpacity>
      }
      padded={false}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={profileQuery.isRefetching}
            onRefresh={() => profileQuery.refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <Card style={styles.heroCard}>
          <TouchableOpacity onPress={() => setPreviewVisible(true)} activeOpacity={0.9}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </TouchableOpacity>
          <Text style={[styles.heroName, { color: theme.colors.text }]}>
            {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username}
          </Text>
          <Text style={{ color: theme.colors.muted }}>{profile.email}</Text>
          <TouchableOpacity onPress={onPickAvatar} disabled={uploading} style={styles.changePhotoButton}>
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
              {uploading ? 'Uploading avatar…' : 'Change photo'}
            </Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <SectionHeading title="Account overview" />
          <InfoRow label="Username" value={profile.username} />
          <InfoRow label="School" value={profile.school || 'Not set'} />
          <InfoRow label="Course" value={profile.course || 'Not set'} />
          <InfoRow label="Academic year" value={profile.academic_year || 'Not set'} />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <SectionHeading title="Edit details" />
          <View style={styles.row}>
            <FormTextInput
              label="First name"
              value={profile.first_name ?? ''}
              onChangeText={(t) => setProfile({ ...profile, first_name: t })}
              containerStyle={styles.half}
            />
            <FormTextInput
              label="Last name"
              value={profile.last_name ?? ''}
              onChangeText={(t) => setProfile({ ...profile, last_name: t })}
              containerStyle={styles.half}
            />
          </View>
          <View style={styles.row}>
            <FormTextInput
              label="Department"
              value={profile.department ?? ''}
              onChangeText={(t) => setProfile({ ...profile, department: t })}
              containerStyle={styles.half}
            />
            <FormTextInput
              label="Designation"
              value={profile.designation ?? ''}
              onChangeText={(t) => setProfile({ ...profile, designation: t })}
              containerStyle={styles.half}
            />
          </View>
          <FormTextInput
            label="Phone"
            value={profile.phone ?? ''}
            onChangeText={(t) => setProfile({ ...profile, phone: t })}
            keyboardType="phone-pad"
          />
          <PrimaryButton title="Save changes" onPress={onSave} />
        </Card>
        
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeading title="Settings" />
          <TouchableOpacity
            onPress={() => navigation.navigate('Preferences')}
            style={styles.menuItem}
          >
            <MaterialCommunityIcons name="cog-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Preferences</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.muted} />
          </TouchableOpacity>
          {profile?.is_staff && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Analytics')}
              style={styles.menuItem}
            >
              <MaterialCommunityIcons name="chart-line" size={24} color={theme.colors.primary} />
              <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Analytics Dashboard</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </Card>

        {(profile?.is_staff || profile?.is_superuser) && (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeading title="User Management" />
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminUserList')}
              style={styles.menuItem}
            >
              <MaterialCommunityIcons name="account-group" size={24} color={theme.colors.primary} />
              <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Manage Users</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminUserCreate')}
              style={styles.menuItem}
            >
              <MaterialCommunityIcons name="account-plus" size={24} color={theme.colors.primary} />
              <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Create New User</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
          </Card>
        )}
        
        <PrimaryButton title="Logout" onPress={signOut} style={{ marginTop: spacing.lg }} />
      </ScrollView>
      <ImagePreviewModal
        visible={previewVisible}
        uri={avatarUri}
        onClose={() => setPreviewVisible(false)}
        footer={
          <TouchableOpacity
            onPress={() => {
              setPreviewVisible(false);
              onPickAvatar();
            }}
            style={styles.previewChangeButton}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Change photo</Text>
          </TouchableOpacity>
        }
      />
    </ScreenContainer>
  );
}


const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: spacing.md,
  },
  changePhotoButton: {
    borderWidth: 1,
    borderColor: '#4338CA',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  previewChangeButton: {
    borderWidth: 1,
    borderColor: '#fff',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  modeToggle: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  retryButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    minWidth: 160,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  const { theme } = useTheme();
  return (
    <View style={infoStyles.container}>
      <Text style={[infoStyles.label, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: theme.colors.text }]}>{value || '—'}</Text>
    </View>
  );
};

const infoStyles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
});
