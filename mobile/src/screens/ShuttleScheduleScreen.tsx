import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ROUTES = [
  {
    name: 'Main Campus ↔ City Center',
    color: '#4CAF50',
    times: {
      Mon: ['07:00', '09:00', '12:00', '14:00', '17:00', '19:00'],
      Tue: ['07:00', '09:00', '12:00', '14:00', '17:00', '19:00'],
      Wed: ['07:00', '09:00', '12:00', '14:00', '17:00', '19:00'],
      Thu: ['07:00', '09:00', '12:00', '14:00', '17:00', '19:00'],
      Fri: ['07:00', '09:00', '12:00', '14:00', '17:00', '19:00'],
      Sat: ['08:00', '12:00', '16:00'],
    },
  },
  {
    name: 'Main Campus ↔ Kikoni',
    color: '#2196F3',
    times: {
      Mon: ['07:30', '10:00', '13:00', '15:30', '18:00'],
      Tue: ['07:30', '10:00', '13:00', '15:30', '18:00'],
      Wed: ['07:30', '10:00', '13:00', '15:30', '18:00'],
      Thu: ['07:30', '10:00', '13:00', '15:30', '18:00'],
      Fri: ['07:30', '10:00', '13:00', '15:30', '18:00'],
      Sat: ['09:00', '14:00'],
    },
  },
  {
    name: 'Main Campus ↔ Wandegeya',
    color: '#FF9800',
    times: {
      Mon: ['08:00', '11:00', '14:00', '17:30'],
      Tue: ['08:00', '11:00', '14:00', '17:30'],
      Wed: ['08:00', '11:00', '14:00', '17:30'],
      Thu: ['08:00', '11:00', '14:00', '17:30'],
      Fri: ['08:00', '11:00', '14:00', '17:30'],
      Sat: ['10:00', '15:00'],
    },
  },
];

export default function ShuttleScheduleScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [selectedDay, setSelectedDay] = useState('Mon');

  const getNextDeparture = (times: string[]) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const time of times) {
      const [h, m] = time.split(':').map(Number);
      const mins = h * 60 + m;
      if (mins > currentMinutes) return time;
    }
    return times[0]; // Next day first departure
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Shuttle Schedule" onBack={() => navigation.goBack()} gradient={['#9C27B0', '#E91E63']} />
      
      {/* Day Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {DAYS.map((day) => (
          <TouchableOpacity
            key={day}
            onPress={() => setSelectedDay(day)}
            style={[styles.dayChip, selectedDay === day && { backgroundColor: '#9C27B0' }]}
          >
            <Text style={[styles.dayText, { color: selectedDay === day ? '#fff' : theme.colors.text }]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {ROUTES.map((route) => {
          const times = route.times[selectedDay as keyof typeof route.times] || [];
          const next = getNextDeparture(times);
          return (
            <ModernCard key={route.name} style={{ marginBottom: 16 }}>
              <View style={styles.routeHeader}>
                <View style={[styles.routeDot, { backgroundColor: route.color }]} />
                <Text style={[styles.routeName, { color: theme.colors.text }]}>{route.name}</Text>
              </View>
              
              <View style={styles.nextBadge}>
                <MaterialCommunityIcons name="bus-clock" size={16} color={route.color} />
                <Text style={[styles.nextText, { color: route.color }]}>Next: {next}</Text>
              </View>

              <View style={styles.timesGrid}>
                {times.map((time) => (
                  <View
                    key={time}
                    style={[styles.timeChip, time === next && { borderColor: route.color, borderWidth: 1.5, backgroundColor: route.color + '12' }]}
                  >
                    <Text style={[styles.timeText, { color: theme.colors.text }]}>{time}</Text>
                  </View>
                ))}
              </View>
            </ModernCard>
          );
        })}

        <ModernCard style={{ borderColor: '#9C27B020', borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MaterialCommunityIcons name="information" size={22} color="#9C27B0" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Service Notes</Text>
              <Text style={[styles.infoBody, { color: theme.colors.muted }]}>
                Shuttles run every 30-60 minutes depending on the route. No service on Sundays and public holidays.
              </Text>
            </View>
          </View>
        </ModernCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  dayChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)' },
  dayText: { fontWeight: '700', fontSize: 13 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeName: { fontSize: 16, fontWeight: '800', flex: 1 },
  nextBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  nextText: { fontSize: 14, fontWeight: '700' },
  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.04)' },
  timeText: { fontSize: 13, fontWeight: '700' },
  infoTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 20 },
});
