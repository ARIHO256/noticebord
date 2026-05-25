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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';
import BeautifulButton from '../components/BeautifulButton';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Kiswahili', flag: '🇹🇿' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const THEMES: { key: 'light' | 'dark' | 'system'; name: string; icon: string }[] = [
  { key: 'light', name: 'Light', icon: 'white-balance-sunny' },
  { key: 'dark', name: 'Dark', icon: 'weather-night' },
  { key: 'system', name: 'System', icon: 'theme-light-dark' },
];

const DIGESTS = [
  { key: 'never', name: 'Never' },
  { key: 'daily', name: 'Daily' },
  { key: 'weekly', name: 'Weekly' },
];

const NOTIF_CATEGORIES = [
  { key: 'notices', label: 'Notices', icon: 'file-document' },
  { key: 'events', label: 'Events', icon: 'calendar-star' },
  { key: 'messages', label: 'Messages', icon: 'message-text' },
  { key: 'groups', label: 'Group Chat', icon: 'account-group' },
  { key: 'assignments', label: 'Assignments', icon: 'book-open' },
  { key: 'emergency', label: 'Emergency', icon: 'alert-circle' },
];

export default function PreferencesScreen() {
  const { theme, mode, setMode } = useTheme();
  const { showSuccess, showError } = useToast();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState<any>({
    notifications_enabled: true,
    urgent_only: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    categories: {},
  });
  const [followedDepartments, setFollowedDepartments] = useState<string[]>([]);
  const [themePreference, setThemePreference] = useState(mode);
  const [language, setLanguage] = useState('en');
  const [digestFrequency, setDigestFrequency] = useState('never');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [privacyWhoCanMessage, setPrivacyWhoCanMessage] = useState('everyone');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await api.get('/users/profiles/preferences/');
      const data = response.data;
      if (data.notification_preferences) {
        setPrefs({ ...prefs, ...data.notification_preferences });
      }
      if (data.followed_departments) {
        setFollowedDepartments(data.followed_departments);
      }
      if (data.theme_preference) setThemePreference(data.theme_preference);
      if (data.language) setLanguage(data.language);
      if (data.digest_frequency) setDigestFrequency(data.digest_frequency);
      if (data.biometric_enabled !== undefined) setBiometricEnabled(data.biometric_enabled);
      if (data.push_enabled !== undefined) setPushEnabled(data.push_enabled);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await api.put('/users/profiles/preferences/', {
        notification_preferences: prefs,
        followed_departments: followedDepartments,
        theme_preference: themePreference,
        language,
        digest_frequency: digestFrequency,
        biometric_enabled: biometricEnabled,
        push_enabled: pushEnabled,
      });
      showSuccess('Preferences saved successfully');
    } catch (error: any) {
      showError(error?.userMessage || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const requestDataExport = async () => {
    try {
      await api.post('/audit/data-export/');
      Alert.alert('Data Export', 'Your data export request has been submitted. You will receive an email when it is ready.');
    } catch {
      showError('Failed to request data export');
    }
  };

  const requestAccountDeletion = async () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/audit/data-delete/');
              Alert.alert('Account Deletion', 'Your deletion request has been submitted and will be reviewed by administration.');
            } catch {
              showError('Failed to submit deletion request');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Preferences" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Appearance */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
          <Text style={[styles.sectionSub, { color: theme.colors.muted }]}>Choose your theme</Text>
          <View style={styles.themeRow}>
            {THEMES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => { setThemePreference(t.key); setMode(t.key as any); }}
                style={[styles.themeChip, themePreference === t.key && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
              >
                <MaterialCommunityIcons name={t.icon as any} size={20} color={themePreference === t.key ? '#fff' : theme.colors.text} />
                <Text style={{ color: themePreference === t.key ? '#fff' : theme.colors.text, fontWeight: '700', marginTop: 4, fontSize: 12 }}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ModernCard>

        {/* Language */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Language</Text>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => setLanguage(lang.code)}
              style={[styles.langRow, language === lang.code && { backgroundColor: theme.colors.primary + '10' }]}
            >
              <Text style={{ fontSize: 20 }}>{lang.flag}</Text>
              <Text style={[styles.langName, { color: theme.colors.text }]}>{lang.name}</Text>
              {language === lang.code && <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />}
            </TouchableOpacity>
          ))}
        </ModernCard>

        {/* Notifications */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notifications</Text>

          <ToggleRow
            label="Push Notifications"
            description="Receive push alerts on your device"
            value={pushEnabled}
            onChange={setPushEnabled}
          />
          <ToggleRow
            label="Quiet Hours"
            description="Mute notifications 10PM — 7AM"
            value={prefs.quiet_hours_enabled}
            onChange={(v: boolean) => setPrefs({ ...prefs, quiet_hours_enabled: v })}
          />

          <Text style={[styles.subSection, { color: theme.colors.text }]}>Notify me for</Text>
          {NOTIF_CATEGORIES.map((cat) => (
            <ToggleRow
              key={cat.key}
              label={cat.label}
              icon={cat.icon}
              value={prefs.categories?.[cat.key] !== false}
              onChange={(v: boolean) => setPrefs({ ...prefs, categories: { ...prefs.categories, [cat.key]: v } })}
            />
          ))}
        </ModernCard>

        {/* Email Digests */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Email Digests</Text>
          <Text style={[styles.sectionSub, { color: theme.colors.muted }]}>Get a summary of what you missed</Text>
          <View style={styles.digestRow}>
            {DIGESTS.map((d) => (
              <TouchableOpacity
                key={d.key}
                onPress={() => setDigestFrequency(d.key)}
                style={[styles.digestChip, digestFrequency === d.key && { backgroundColor: theme.colors.primary }]}
              >
                <Text style={{ color: digestFrequency === d.key ? '#fff' : theme.colors.text, fontWeight: '700', fontSize: 13 }}>{d.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ModernCard>

        {/* Security */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Security</Text>
          <ToggleRow
            label="Biometric Lock"
            description="Require Face ID / Fingerprint to open app"
            value={biometricEnabled}
            onChange={setBiometricEnabled}
            icon="fingerprint"
          />
        </ModernCard>

        {/* Privacy */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Privacy</Text>
          <Text style={[styles.sectionSub, { color: theme.colors.muted }]}>Who can send you direct messages</Text>
          {['everyone', 'friends_only', 'nobody'].map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setPrivacyWhoCanMessage(option)}
              style={[styles.privacyRow, privacyWhoCanMessage === option && { backgroundColor: theme.colors.primary + '10' }]}
            >
              <Text style={[styles.privacyText, { color: theme.colors.text }]}>
                {option.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
              {privacyWhoCanMessage === option && <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />}
            </TouchableOpacity>
          ))}
        </ModernCard>

        {/* Data & Privacy */}
        <ModernCard style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data & Privacy</Text>
          <TouchableOpacity onPress={requestDataExport} style={styles.dataRow}>
            <MaterialCommunityIcons name="download" size={20} color={theme.colors.primary} />
            <Text style={[styles.dataText, { color: theme.colors.text }]}>Request Data Export (GDPR)</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={requestAccountDeletion} style={styles.dataRow}>
            <MaterialCommunityIcons name="delete-forever" size={20} color="#F44336" />
            <Text style={[styles.dataText, { color: '#F44336' }]}>Request Account Deletion</Text>
          </TouchableOpacity>
        </ModernCard>

        {/* Save */}
        <BeautifulButton
          title={saving ? 'Saving...' : 'Save All Preferences'}
          variant="gradient"
          size="large"
          onPress={savePreferences}
          disabled={saving}
        />
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label, description, value, onChange, icon }: any) {
  const { theme } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {icon && <MaterialCommunityIcons name={icon} size={20} color={theme.colors.muted} style={{ marginRight: 10 }} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>{label}</Text>
          {description && <Text style={[styles.toggleDesc, { color: theme.colors.muted }]}>{description}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sectionSub: { fontSize: 13, marginBottom: 12 },
  subSection: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4 },
  langName: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)' },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  digestRow: { flexDirection: 'row', gap: 10 },
  digestChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  privacyText: { fontSize: 15, fontWeight: '600' },
  dataRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  dataText: { marginLeft: 12, fontSize: 15, fontWeight: '600' },
});
