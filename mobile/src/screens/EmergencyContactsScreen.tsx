import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchEmergencyContacts, fetchEmergencyAlerts, acknowledgeEmergencyAlert } from '../api/campus';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';
import BeautifulButton from '../components/BeautifulButton';

export default function EmergencyContactsScreen() {
  const { theme } = useTheme();

  const { data: contacts } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: fetchEmergencyContacts,
  });

  const { data: alerts } = useQuery({
    queryKey: ['emergency-alerts'],
    queryFn: fetchEmergencyAlerts,
  });

  const renderAlert = ({ item }: { item: any }) => (
    <ModernCard style={[styles.alertCard, { borderLeftWidth: 6, borderLeftColor: item.alert_level === 'critical' ? '#F44336' : '#FF9800' }]}>
      <View style={styles.alertHeader}>
        <MaterialCommunityIcons name="alert-circle" size={24} color="#F44336" />
        <Text style={[styles.alertTitle, { color: theme.colors.text }]}>{item.title}</Text>
      </View>
      <Text style={[styles.alertMessage, { color: theme.colors.muted }]}>{item.message}</Text>
      {!item.is_acknowledged && (
        <BeautifulButton
          title="I am Safe"
          variant="danger"
          size="small"
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
          onPress={() => acknowledgeEmergencyAlert(item.id)}
        />
      )}
    </ModernCard>
  );

  const renderContact = ({ item }: { item: any }) => (
    <ModernCard style={styles.contactCard}>
      <View style={styles.contactRow}>
        <View style={[styles.iconCircle, { backgroundColor: '#F4433618' }]}>
          <MaterialCommunityIcons name="phone" size={24} color="#F44336" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.contactName, { color: theme.colors.text }]}>{item.name}</Text>
          <Text style={[styles.contactType, { color: theme.colors.muted }]}>{item.contact_type}</Text>
          {item.is_available_24_7 && (
            <Text style={{ color: '#4CAF50', fontSize: 11, fontWeight: '800', marginTop: 2 }}>24/7 Available</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={styles.callBtn}>
          <MaterialCommunityIcons name="phone-outgoing" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
    </ModernCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Emergency" gradient={['#F44336', '#FF9800']} />
      <FlatList
        data={[
          ...(alerts?.results || alerts || []).map((a: any) => ({ ...a, _type: 'alert' })),
          ...(contacts?.results || contacts || []).map((c: any) => ({ ...c, _type: 'contact' })),
        ]}
        keyExtractor={(item) => `${item._type}-${item.id}`}
        renderItem={({ item }) => (item._type === 'alert' ? renderAlert({ item }) : renderContact({ item }))}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {(alerts?.results || alerts || []).length > 0 ? 'Active Alerts' : 'Emergency Contacts'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 14 },
  alertCard: { marginBottom: 14, backgroundColor: '#FFF8E1' },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertTitle: { fontSize: 16, fontWeight: '800', marginLeft: 10 },
  alertMessage: { fontSize: 14, lineHeight: 22 },
  contactCard: { marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: 16, fontWeight: '800' },
  contactType: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  callBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F44336', alignItems: 'center', justifyContent: 'center' },
});
