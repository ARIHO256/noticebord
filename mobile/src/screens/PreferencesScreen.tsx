import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import HeaderBar from '../components/HeaderBar';
import { spacing } from '../theme';
import { DEPARTMENTS_BY_SCHOOL, SCHOOLS } from '../constants/university';
import Card from '../components/Card';

type Props = {
  navigation: any;
};

export default function PreferencesScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();
  const nav = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<any>({
    notifications_enabled: true,
    urgent_only: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    categories: {
      campus_life: true,
      business: true,
      education: true,
      general: true,
    },
  });
  const [followedDepartments, setFollowedDepartments] = useState<string[]>([]);
  const [expandedSchools, setExpandedSchools] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPreferences();
    // Initialize all schools as expanded by default
    const initialExpanded: Record<string, boolean> = {};
    SCHOOLS.forEach((school) => {
      initialExpanded[school] = true;
    });
    setExpandedSchools(initialExpanded);
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await api.get('/users/profiles/preferences/');
      if (response.data.notification_preferences) {
        setPreferences({ ...preferences, ...response.data.notification_preferences });
      }
      if (response.data.followed_departments) {
        setFollowedDepartments(response.data.followed_departments);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load preferences:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSchool = (school: string) => {
    setExpandedSchools((prev) => ({
      ...prev,
      [school]: !prev[school],
    }));
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await api.put('/users/profiles/preferences/', {
        notification_preferences: preferences,
        followed_departments: followedDepartments,
      });
      showSuccess('Preferences saved successfully', {
        action: {
          label: 'OK',
          onPress: () => {
            nav.goBack();
          },
        },
      });
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to save preferences');
      setSaving(false);
    }
  };

  const toggleDepartment = async (dept: string) => {
    try {
      if (followedDepartments.includes(dept)) {
        await api.post('/users/profiles/unfollow-department/', { department: dept });
        setFollowedDepartments(followedDepartments.filter((d) => d !== dept));
      } else {
        await api.post('/users/profiles/follow-department/', { department: dept });
        setFollowedDepartments([...followedDepartments, dept]);
      }
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to update department follow status');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Preferences" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HeaderBar title="Preferences" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Enable Notifications</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.muted }]}>
                Receive push notifications for new notices
              </Text>
            </View>
            <Switch
              value={preferences.notifications_enabled}
              onValueChange={(val) => setPreferences({ ...preferences, notifications_enabled: val })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Urgent Only</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.muted }]}>
                Only receive notifications for urgent notices
              </Text>
            </View>
            <Switch
              value={preferences.urgent_only}
              onValueChange={(val) => setPreferences({ ...preferences, urgent_only: val })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Quiet Hours</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.muted }]}>
                Disable notifications during quiet hours
              </Text>
            </View>
            <Switch
              value={preferences.quiet_hours_enabled}
              onValueChange={(val) => setPreferences({ ...preferences, quiet_hours_enabled: val })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>Notify for Categories</Text>
            {Object.entries(preferences.categories || {}).map(([category, enabled]: [string, any]) => (
              <View key={category} style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  {category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Switch
                  value={enabled}
                  onValueChange={(val) =>
                    setPreferences({
                      ...preferences,
                      categories: { ...preferences.categories, [category]: val },
                    })
                  }
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Follow Departments</Text>
          <Text style={[styles.settingDescription, { color: theme.colors.muted, marginBottom: spacing.md }]}>
            Follow additional departments to see their notices. Departments are organized by school.
          </Text>
          {SCHOOLS.map((school) => {
            const departments = DEPARTMENTS_BY_SCHOOL[school] || [];
            const isExpanded = expandedSchools[school] ?? true;
            
            return (
              <View key={school} style={{ marginBottom: spacing.md }}>
                <TouchableOpacity
                  onPress={() => toggleSchool(school)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.xs,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.schoolTitle, { color: theme.colors.text }]}>{school}</Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.muted, fontSize: 11 }]}>
                      {departments.length} {departments.length === 1 ? 'department' : 'departments'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={theme.colors.muted}
                  />
                </TouchableOpacity>
                
                {isExpanded && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, paddingLeft: spacing.sm }}>
                    {departments.map((dept) => (
                      <TouchableOpacity
                        key={dept}
                        onPress={() => toggleDepartment(dept)}
                        style={[
                          styles.departmentChip,
                          {
                            backgroundColor: followedDepartments.includes(dept)
                              ? theme.colors.primary
                              : theme.colors.surface,
                            borderColor: followedDepartments.includes(dept)
                              ? theme.colors.primary
                              : theme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: followedDepartments.includes(dept)
                              ? theme.colors.primaryContrast
                              : theme.colors.text,
                            fontWeight: '600',
                            fontSize: 12,
                          }}
                        >
                          {dept.replace('Department of ', '')}
                        </Text>
                        {followedDepartments.includes(dept) && (
                          <MaterialCommunityIcons
                            name="check"
                            size={16}
                            color={theme.colors.primaryContrast}
                            style={{ marginLeft: spacing.xs }}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        <TouchableOpacity
          onPress={savePreferences}
          disabled={saving}
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: saving ? 0.6 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primaryContrast} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color={theme.colors.primaryContrast} />
              <Text style={[styles.saveButtonText, { color: theme.colors.primaryContrast }]}>Save Preferences</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  schoolTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  departmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

