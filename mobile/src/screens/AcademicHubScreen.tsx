import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchAcademicCalendar, fetchExams, fetchAssignments, fetchMyGPA } from '../api/academic';
import GradientHeader from '../components/GradientHeader';
import ModernCard from '../components/ModernCard';

const tabs = [
  { key: 'calendar', label: 'Calendar', icon: 'calendar-month' },
  { key: 'exams', label: 'Exams', icon: 'clipboard-text' },
  { key: 'assignments', label: 'Assignments', icon: 'book-open' },
  { key: 'grades', label: 'Grades', icon: 'chart-line' },
];

export default function AcademicHubScreen() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('calendar');

  const { data: calendar } = useQuery({ queryKey: ['academic-calendar'], queryFn: fetchAcademicCalendar });
  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const { data: assignments } = useQuery({ queryKey: ['assignments'], queryFn: fetchAssignments });
  const { data: gpa } = useQuery({ queryKey: ['my-gpa'], queryFn: fetchMyGPA });

  const renderCalendar = () => (
    <View style={{ gap: 12 }}>
      {(calendar?.results || calendar || []).slice(0, 20).map((item: any) => (
        <ModernCard key={item.id} style={{ borderLeftWidth: 4, borderLeftColor: item.is_important ? '#F44336' : '#1877F2' }}>
          <Text style={[styles.itemTitle, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.itemDate, { color: theme.colors.muted }]}>
            {new Date(item.start_date).toLocaleDateString()}
            {item.end_date ? ` - ${new Date(item.end_date).toLocaleDateString()}` : ''}
          </Text>
          <Text style={{ color: theme.colors.muted, marginTop: 4 }}>{item.category}</Text>
        </ModernCard>
      ))}
    </View>
  );

  const renderExams = () => (
    <View style={{ gap: 12 }}>
      {(exams?.results || exams || []).slice(0, 20).map((item: any) => (
        <ModernCard key={item.id}>
          <View style={styles.examHeader}>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>{item.course?.code} - {item.course?.name}</Text>
            <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
              <Text style={{ color: '#1565C0', fontWeight: '800', fontSize: 11 }}>{item.exam_type}</Text>
            </View>
          </View>
          <Text style={[styles.itemDate, { color: theme.colors.muted }]}>
            {new Date(item.date).toLocaleDateString()} · {item.start_time} - {item.end_time}
          </Text>
          <Text style={{ color: theme.colors.muted, marginTop: 4 }}>Venue: {item.venue || 'TBA'}</Text>
        </ModernCard>
      ))}
    </View>
  );

  const renderAssignments = () => (
    <View style={{ gap: 12 }}>
      {(assignments?.results || assignments || []).slice(0, 20).map((item: any) => (
        <ModernCard key={item.id}>
          <Text style={[styles.itemTitle, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.itemDate, { color: '#F44336', fontWeight: '700' }]}>
            Due: {new Date(item.due_date).toLocaleString()}
          </Text>
          {item.course ? <Text style={{ color: theme.colors.muted, marginTop: 4 }}>{item.course.code}</Text> : null}
        </ModernCard>
      ))}
    </View>
  );

  const renderGrades = () => (
    <View style={{ gap: 12 }}>
      <ModernCard style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ color: theme.colors.muted, fontSize: 14 }}>Current GPA</Text>
        <Text style={{ color: '#1877F2', fontSize: 48, fontWeight: '900', marginVertical: 8 }}>{gpa?.gpa || '0.00'}</Text>
        <Text style={{ color: theme.colors.muted, fontSize: 13 }}>{gpa?.total_credits || 0} Credits Earned</Text>
      </ModernCard>
    </View>
  );

  const tabContent: Record<string, React.ReactNode> = {
    calendar: renderCalendar(),
    exams: renderExams(),
    assignments: renderAssignments(),
    grades: renderGrades(),
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader title="Academic Hub" subtitle="Your academic journey" gradient={['#673AB7', '#2196F3']} />
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)} style={[styles.tab, activeTab === t.key && { backgroundColor: '#673AB7' }]}>
            <MaterialCommunityIcons name={t.icon as any} size={20} color={activeTab === t.key ? '#FFF' : theme.colors.muted} />
            <Text style={{ color: activeTab === t.key ? '#FFF' : theme.colors.muted, fontSize: 11, fontWeight: '700', marginTop: 4 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {tabContent[activeTab]}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.03)' },
  itemTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  itemDate: { fontSize: 13 },
  examHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
});
