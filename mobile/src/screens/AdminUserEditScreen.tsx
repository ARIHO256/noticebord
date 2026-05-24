import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View, TouchableOpacity } from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { Theme, spacing } from '../theme';
import FormTextInput from '../components/FormTextInput';
import ScreenContainer from '../components/ScreenContainer';
import Card from '../components/Card';
import SectionHeading from '../components/SectionHeading';
import { openConversation } from '../api/messages';

type UserDetail = {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  is_faculty?: boolean;
  is_active?: boolean;
  push_enabled?: boolean;
  school?: string | null;
  course?: string | null;
  academic_year?: string | null;
};

type Props = {
  route: { params: { id: number } };
  navigation: any;
};

export default function AdminUserEditScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();

  const loadUser = async () => {
      try {
        const response = await api.get(`/users/profiles/${id}/`);
          setUser(response.data);
      } catch (err) {
      setError('Failed to load user');
      }
    };

  useEffect(() => {
    loadUser();
  }, [id]);

  const handleSuspend = async () => {
    if (!user) return;
    Alert.alert(
      'Suspend User',
      `Are you sure you want to suspend ${user.first_name || user.username}? They will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post(`/users/profiles/${id}/suspend/`);
              await loadUser();
              showSuccess('User has been suspended');
            } catch (error: any) {
              showError(error?.userMessage || 'Failed to suspend user');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnsuspend = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await api.post(`/users/profiles/${id}/unsuspend/`);
      await loadUser();
      showSuccess('User has been unsuspended');
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to unsuspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user.first_name || user.username}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.delete(`/users/profiles/${id}/`);
              showSuccess('User has been deleted', {
                action: {
                  label: 'OK',
                  onPress: () => navigation.goBack(),
                },
              });
            } catch (error: any) {
              showError(error?.userMessage || 'Failed to delete user');
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMessage = useCallback(async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const conversation = await openConversation({ recipient_id: user.id });
      const title =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Conversation';
      navigation.navigate('Conversation', { conversationId: conversation.id, title });
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to open conversation');
    } finally {
      setActionLoading(false);
    }
  }, [navigation, showError, user]);

  const onUpdate = async () => {
    if (!user) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/users/profiles/${id}/`, {
        first_name: user.first_name,
        last_name: user.last_name,
        designation: user.designation,
        department: user.department,
        phone: user.phone,
        is_faculty: user.is_faculty,
        push_enabled: user.push_enabled,
      });
      showSuccess('User updated successfully', {
        action: {
          label: 'OK',
          onPress: () => navigation.goBack(),
        },
      });
    } catch (err) {
      setError('Failed to update user');
      showError('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <ScreenContainer title="Edit User">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </ScreenContainer>
    );
  }

  const isSuspended = user.is_active === false;
  const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  return (
    <ScreenContainer title={userName} padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {isSuspended && (
          <Card style={{ backgroundColor: '#dc262620', borderColor: '#dc2626', borderWidth: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MaterialCommunityIcons name="alert-circle" size={24} color="#dc2626" />
              <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>
                This user is currently suspended
              </Text>
            </View>
          </Card>
        )}

        <Card style={{ gap: spacing.sm }}>
          <SectionHeading title="Admin actions" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <PrimaryButton
              title="Message"
              onPress={handleMessage}
              style={{ flex: 1 }}
              disabled={actionLoading}
              leftIcon={<MaterialCommunityIcons name="message-text" size={18} color="#fff" />}
            />
            {isSuspended ? (
              <PrimaryButton
                title="Unsuspend"
                onPress={handleUnsuspend}
                style={{ flex: 1 }}
                disabled={actionLoading}
                leftIcon={<MaterialCommunityIcons name="account-check" size={18} color="#fff" />}
              />
            ) : (
              <PrimaryButton
                title="Suspend"
                onPress={handleSuspend}
                style={{ flex: 1 }}
                disabled={actionLoading}
                variant="danger"
                leftIcon={<MaterialCommunityIcons name="account-lock" size={18} color="#fff" />}
              />
            )}
          </View>
          <PrimaryButton
            title="Delete account"
            onPress={handleDelete}
            disabled={actionLoading}
            variant="danger"
            leftIcon={<MaterialCommunityIcons name="delete" size={18} color="#fff" />}
          />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <SectionHeading title="Account info" />
          <StaticField label="Email" value={user.email || 'No email'} />
          <StaticField label="Status" value={isSuspended ? 'Suspended' : 'Active'} />
          <StaticField label="School" value={user.school || 'Not set'} />
          <StaticField label="Course" value={user.course || 'Not set'} />
          <StaticField label="Academic year" value={user.academic_year || 'Not set'} />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <SectionHeading title="Edit permissions" />
          <FormTextInput
            label="First name"
            value={user.first_name || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, first_name: t } : prev))}
          />

          <FormTextInput
            label="Last name"
            value={user.last_name || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, last_name: t } : prev))}
          />

          <FormTextInput
            label="Designation"
            value={user.designation || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, designation: t } : prev))}
          />

          <FormTextInput
            label="Department"
            value={user.department || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, department: t } : prev))}
          />

          <FormTextInput
            label="Phone"
            value={user.phone || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, phone: t } : prev))}
            keyboardType="phone-pad"
          />

          <View style={styles.switchRow(theme)}>
            <Text style={styles.switchLabel(theme)}>Faculty member</Text>
            <Switch
              value={!!user.is_faculty}
              onValueChange={(v) => setUser((prev) => (prev ? { ...prev, is_faculty: v } : prev))}
            />
          </View>

          <View style={styles.switchRow(theme)}>
            <Text style={styles.switchLabel(theme)}>Push enabled</Text>
            <Switch
              value={!!user.push_enabled}
              onValueChange={(v) => setUser((prev) => (prev ? { ...prev, push_enabled: v } : prev))}
            />
          </View>

          {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : null}
          <PrimaryButton title={saving ? 'Saving…' : 'Save changes'} onPress={onUpdate} />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <SectionHeading title="User Actions" />
          <View style={{ gap: spacing.sm }}>
            {isSuspended ? (
              <TouchableOpacity
                onPress={handleUnsuspend}
                disabled={actionLoading}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  borderRadius: 8,
                  backgroundColor: theme.colors.primary + '20',
                  borderWidth: 1,
                  borderColor: theme.colors.primary,
                }}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-check" size={20} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 15 }}>
                      Unsuspend User
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSuspend}
                disabled={actionLoading}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  borderRadius: 8,
                  backgroundColor: '#dc262620',
                  borderWidth: 1,
                  borderColor: '#dc2626',
                }}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-off" size={20} color="#dc2626" />
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>Suspend User</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleDelete}
              disabled={actionLoading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.md,
                borderRadius: 8,
                backgroundColor: '#dc262620',
                borderWidth: 1,
                borderColor: '#dc2626',
              }}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <>
                  <MaterialCommunityIcons name="delete" size={20} color="#dc2626" />
                  <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>Delete User</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = {
  readonly: (theme: Theme): ViewStyle => ({
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  }),
  switchRow: (theme: Theme): ViewStyle => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  }),
  switchLabel: (theme: Theme): TextStyle => ({
    color: theme.colors.text,
    fontSize: 15,
  }),
};

const StaticField = ({ label, value }: { label: string; value: string }) => {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: theme.colors.muted, fontSize: 12, textTransform: 'uppercase' }}>{label}</Text>
      <View style={styles.readonly(theme)}>
        <Text style={{ color: theme.colors.text }}>{value}</Text>
      </View>
    </View>
  );
};
