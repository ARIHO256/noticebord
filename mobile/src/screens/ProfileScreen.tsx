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
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import { useQueryClient } from '@tanstack/react-query';
import BeautifulButton from '../components/BeautifulButton';
import ModernCard from '../components/ModernCard';
import type { RootStackParamList } from '../App';

const DESIGNATION_ICONS: Record<string, string> = {
  vice_chancellor: 'crown',
  registrar: 'file-document',
  dean: 'school',
  hod: 'account-tie',
  lecturer: 'teach',
  student: 'account',
  security: 'shield',
  business_office: 'cash-register',
  other: 'account',
};

export default function ProfileScreen() {
  const { theme, setMode, mode } = useTheme();
  const { signOut } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profileQuery = useCurrentUserProfile();

  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profileQuery.data) setProfile(profileQuery.data);
  }, [profileQuery.data]);

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
      setProfile(resp.data);
      queryClient.setQueryData(['current-user-profile'], resp.data);
    } catch {
      Alert.alert('Upload failed', 'Could not upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const onPickCover = async () => {
    if (!profile) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('cover_photo', { uri: res.assets[0].uri, name: 'cover.jpg', type: 'image/jpeg' } as any);
      const resp = await api.put(`/users/profiles/${profile.id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(resp.data);
      queryClient.setQueryData(['current-user-profile'], resp.data);
    } catch {
      Alert.alert('Upload failed', 'Could not upload cover photo');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { id, avatar_url, cover_photo_url, ...payload } = profile;
      const resp = await api.put(`/users/profiles/${id}/`, payload);
      setProfile(resp.data);
      queryClient.setQueryData(['current-user-profile'], resp.data);
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setProfile((p: any) => ({ ...p, [field]: value }));
  };

  if (profileQuery.isLoading && !profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.muted }}>Profile unavailable</Text>
      </View>
    );
  }

  const designationIcon = DESIGNATION_ICONS[profile.designation] || 'account';
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={profileQuery.isRefetching} onRefresh={() => profileQuery.refetch()} />}
      >
        {/* Cover Photo */}
        <View style={styles.coverWrap}>
          <Image
            source={{ uri: profile.cover_photo_url || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800' }}
            style={styles.coverImage}
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.coverGradient} />
          <TouchableOpacity onPress={onPickCover} style={styles.coverEditBtn}>
            <MaterialCommunityIcons name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Avatar & Name */}
        <View style={styles.headerSection}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: profile.avatar_url || '' }} style={styles.avatar} />
            <TouchableOpacity onPress={onPickAvatar} style={styles.avatarEdit}>
              <MaterialCommunityIcons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: theme.colors.primary + '18' }]}>
              <MaterialCommunityIcons name={designationIcon as any} size={14} color={theme.colors.primary} />
              <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                {(profile.designation || 'Member').replace(/_/g, ' ')}
              </Text>
            </View>
            {profile.is_staff && (
              <View style={[styles.badge, { backgroundColor: '#4CAF5018' }]}>
                <MaterialCommunityIcons name="shield-check" size={14} color="#4CAF50" />
                <Text style={[styles.badgeText, { color: '#4CAF50' }]}>Staff</Text>
              </View>
            )}
          </View>
          {profile.bio ? <Text style={[styles.bio, { color: theme.colors.muted }]}>{profile.bio}</Text> : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => setEditing(!editing)} style={[styles.actionBtn, { backgroundColor: theme.colors.card }]}>
            <MaterialCommunityIcons name={editing ? 'check' : 'pencil'} size={18} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>{editing ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Preferences')} style={[styles.actionBtn, { backgroundColor: theme.colors.card }]}>
            <MaterialCommunityIcons name="cog" size={18} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Info Cards */}
        <ModernCard style={{ margin: 16, marginTop: 8 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Academic Info</Text>
          <InfoRow icon="school" label="School" value={profile.school || 'Not set'} />
          <InfoRow icon="domain" label="Department" value={profile.department || 'Not set'} />
          <InfoRow icon="book-open-variant" label="Course" value={profile.course || 'Not set'} />
          <InfoRow icon="calendar" label="Year" value={profile.academic_year || 'Not set'} />
        </ModernCard>

        {/* Contact & Social */}
        <ModernCard style={{ margin: 16, marginTop: 0 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Contact</Text>
          <InfoRow icon="email" label="Email" value={profile.email} />
          <InfoRow icon="phone" label="Phone" value={profile.phone || 'Not set'} />
          {profile.campus ? <InfoRow icon="map-marker" label="Campus" value={profile.campus} /> : null}
        </ModernCard>

        {/* Edit Form */}
        {editing && (
          <ModernCard style={{ margin: 16, marginTop: 0 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Edit Profile</Text>
            <EditField label="First Name" value={profile.first_name || ''} onChange={(v) => handleFieldChange('first_name', v)} />
            <EditField label="Last Name" value={profile.last_name || ''} onChange={(v) => handleFieldChange('last_name', v)} />
            <EditField label="Bio" value={profile.bio || ''} onChange={(v) => handleFieldChange('bio', v)} multiline />
            <EditField label="Phone" value={profile.phone || ''} onChange={(v) => handleFieldChange('phone', v)} />
            <EditField label="LinkedIn URL" value={profile.linkedin_url || ''} onChange={(v) => handleFieldChange('linkedin_url', v)} />
            <EditField label="Twitter URL" value={profile.twitter_url || ''} onChange={(v) => handleFieldChange('twitter_url', v)} />
            <BeautifulButton title={saving ? 'Saving...' : 'Save Changes'} onPress={onSave} variant="gradient" disabled={saving} />
          </ModernCard>
        )}

        {/* Stats */}
        <ModernCard style={{ margin: 16, marginTop: 0 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Stats</Text>
          <View style={styles.statsRow}>
            <StatItem icon="file-document" label="Notices" value={profile.notice_count || 0} />
            <StatItem icon="message-text" label="Messages" value={profile.message_count || 0} />
            <StatItem icon="account-group" label="Friends" value={profile.friend_count || 0} />
          </View>
        </ModernCard>

        {/* Danger Zone */}
        <ModernCard style={{ margin: 16, marginTop: 0, borderColor: '#F4433618', borderWidth: 1 }}>
          <BeautifulButton title="Sign Out" variant="danger" onPress={() => {
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]);
          }} />
        </ModernCard>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={18} color={theme.colors.muted} />
      <Text style={[styles.infoLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function EditField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: 4, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[styles.editInput, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border || '#eee' }]}
        placeholderTextColor={theme.colors.muted}
      />
    </View>
  );
}

function StatItem({ icon, label, value }: { icon: string; label: string; value: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <MaterialCommunityIcons name={icon as any} size={24} color={theme.colors.primary} />
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>{value}</Text>
      <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const TextInput = ({ ...props }) => <TextInputNative {...props} />;
import { TextInput as TextInputNative } from 'react-native';

const styles = StyleSheet.create({
  coverWrap: { height: 180, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverGradient: { ...StyleSheet.absoluteFillObject },
  coverEditBtn: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginTop: -50, paddingHorizontal: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff' },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: '#1877F2', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 24, fontWeight: '900', marginTop: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  bio: { fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22, paddingHorizontal: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 16, paddingHorizontal: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  actionText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { width: 100, fontSize: 13, marginLeft: 10 },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  editInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 },
});
