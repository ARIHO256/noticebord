import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Domine_700Bold } from '@expo-google-fonts/domine';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from './api/client';
import { getUnreadMessageCount } from './api/messages';
import {
  useTabBadges,
  fetchNoticesCount,
  fetchOfficialNoticesCount,
  fetchFriendRequestCount,
  markNoticesViewed,
  markOfficialNoticesViewed,
  markMessagesViewed,
  markFriendRequestsViewed,
} from './hooks/useTabBadges';

// Auth & Core
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { registerForPushNotificationsAsync } from './push/registerPush';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Notice Screens
import HomeScreen from './screens/HomeScreen';
import NoticeDetailScreen from './screens/NoticeDetailScreen';
import CreateNoticeScreen from './screens/CreateNoticeScreen';
import EditNoticeScreen from './screens/EditNoticeScreen';

// Profile & Social
import ProfileScreen from './screens/ProfileScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import FacultyListScreen from './screens/FacultyListScreen';
import StudentListScreen from './screens/StudentListScreen';

// Messaging
import InboxScreen from './screens/InboxScreen';
import ConversationScreen from './screens/ConversationScreen';

// Notifications & Admin
import NotificationsScreen from './screens/NotificationsScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';
import AdminUserListScreen from './screens/AdminUserListScreen';
import AdminUserEditScreen from './screens/AdminUserEditScreen';
import AdminUserCreateScreen from './screens/AdminUserCreateScreen';
import AnalyticsDashboardScreen from './screens/AnalyticsDashboardScreen';
import ViolationsScreen from './screens/ViolationsScreen';
import SuspendedUserScreen from './screens/SuspendedUserScreen';
import PreferencesScreen from './screens/PreferencesScreen';

// NEW: Discover & Events
import DiscoverScreen from './screens/DiscoverScreen';
import EventsScreen from './screens/EventsScreen';
import EventDetailScreen from './screens/EventDetailScreen';

// NEW: Groups
import GroupsScreen from './screens/GroupsScreen';
import GroupChatScreen from './screens/GroupChatScreen';

// NEW: Campus
import CampusServicesScreen from './screens/CampusServicesScreen';
import StaffDirectoryScreen from './screens/StaffDirectoryScreen';
import LostFoundScreen from './screens/LostFoundScreen';
import EmergencyContactsScreen from './screens/EmergencyContactsScreen';
import VenueBookingScreen from './screens/VenueBookingScreen';
import ShuttleScheduleScreen from './screens/ShuttleScheduleScreen';
import CafeteriaMenuScreen from './screens/CafeteriaMenuScreen';

// NEW: Academic
import AcademicHubScreen from './screens/AcademicHubScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  SuspendedUser: undefined;
  NoticeDetail: { id: number };
  EditNotice: { id: number };
  CreateNotice: { photoUri?: string; videoUri?: string; feeling?: string } | undefined;
  Profile: undefined;
  FacultyList: undefined;
  StudentList: undefined;
  AdminUserList: undefined;
  AdminUserEdit: { id: number };
  AdminUserCreate: undefined;
  UserProfile: { userId: number; name?: string };
  Conversation: { conversationId: number; title?: string; noticeTitle?: string | null };
  Friends: undefined;
  Preferences: undefined;
  Analytics: undefined;
  AdminDashboard: undefined;
  Violations: undefined;
  Notifications: undefined;
  // NEW
  Discover: undefined;
  Events: undefined;
  EventDetail: { id: number };
  Groups: undefined;
  GroupChat: { id: number };
  CampusServices: undefined;
  StaffDirectory: undefined;
  LostFound: undefined;
  EmergencyContacts: undefined;
  VenueBooking: undefined;
  ShuttleSchedule: undefined;
  CafeteriaMenu: undefined;
  AcademicHub: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Router() {
  const { token, ready, isSuspended, checkingSuspension, refreshSuspensionStatus } = useContext(AuthContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (token && ready) {
      refreshSuspensionStatus().then((suspended) => {
        if (!suspended) {
          registerForPushNotificationsAsync();
        }
      });
    }
  }, [token, ready, refreshSuspensionStatus]);

  useEffect(() => {
    if (!token) return;
    const REALTIME_INTERVAL_MS = 30000;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }), 2000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['friend-requests'] }), 4000);
    }, REALTIME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [queryClient, token]);

  if (!ready || (token && checkingSuspension)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (token && isSuspended) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="SuspendedUser">
        <Stack.Screen name="SuspendedUser" component={SuspendedUserScreen} />
      </Stack.Navigator>
    );
  }

  const ThemedTabs = () => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [isSuperuser, setIsSuperuser] = useState(false);
    const badges = useTabBadges();

    useEffect(() => {
      const controller = new AbortController();
      api
        .get('/users/profiles/me/', { signal: controller.signal })
        .then((r) => setIsSuperuser(!!r.data.is_superuser || !!r.data.is_staff))
        .catch(() => setIsSuperuser(false));
      return () => controller.abort();
    }, []);

    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            marginTop: 6,
            letterSpacing: 0.3,
          },
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopColor: 'rgba(0, 0, 0, 0.05)',
            borderTopWidth: 1,
            height: 68 + insets.bottom,
            paddingBottom: 6 + insets.bottom,
            paddingTop: 8,
            elevation: 15,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
          },
          tabBarActiveTintColor: '#25D366',
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarIcon: ({ color, size, focused }) => {
            const map: Record<string, string> = {
              HomeTab: focused ? 'home' : 'home-outline',
              OfficialNoticesTab: focused ? 'file-document-multiple' : 'file-document-multiple-outline',
              DiscoverTab: focused ? 'compass' : 'compass-outline',
              NotificationsTab: focused ? 'bell' : 'bell-outline',
              InboxTab: focused ? 'message-text' : 'message-outline',
              FriendsTab: focused ? 'account-multiple' : 'account-multiple-outline',
              AdminTab: focused ? 'shield-account' : 'shield-account-outline',
            };
            const name = map[route.name] || 'dots-circle';
            const iconSize = focused ? 26 : 24;

            let badge: number | null = null;
            if (route.name === 'InboxTab') badge = badges.messages;
            else if (route.name === 'HomeTab') badge = badges.home;
            else if (route.name === 'OfficialNoticesTab') badge = badges.official;
            else if (route.name === 'FriendsTab') badge = badges.friends;
            else if (route.name === 'NotificationsTab') badge = badges.notifications;

            return (
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', paddingTop: focused ? 2 : 0 }}>
                <View style={{
                  width: focused ? 48 : 40,
                  height: focused ? 32 : 28,
                  borderRadius: 12,
                  backgroundColor: focused ? 'rgba(37, 211, 102, 0.15)' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <MaterialCommunityIcons name={name as any} color={color} size={iconSize} />
                </View>
                {badge ? (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -6,
                    backgroundColor: '#FF3B30',
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    paddingHorizontal: 5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: theme.colors.card,
                    elevation: 5,
                  }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} initialParams={{ mode: 'feed' }} listeners={{ tabPress: async () => { try { const count = await fetchNoticesCount(); markNoticesViewed(count); } catch {} } }} />
        <Tab.Screen name="OfficialNoticesTab" component={HomeScreen} options={{ title: 'Official' }} initialParams={{ mode: 'official' }} listeners={{ tabPress: async () => { try { const count = await fetchOfficialNoticesCount(); markOfficialNoticesViewed(count); } catch {} } }} />
        <Tab.Screen name="DiscoverTab" component={DiscoverScreen} options={{ title: 'Discover' }} />
        <Tab.Screen name="NotificationsTab" component={NotificationsScreen} options={{ title: 'Alerts' }} listeners={{ tabPress: async () => { try { queryClient.invalidateQueries({ queryKey: ['notifications'] }); } catch {} } }} />
        <Tab.Screen name="InboxTab" component={InboxScreen} options={{ title: 'Messages' }} listeners={{ tabPress: async () => { try { const count = await getUnreadMessageCount(); markMessagesViewed(count); } catch {} } }} />
        <Tab.Screen name="FriendsTab" component={FriendsScreen} options={{ title: 'Friends' }} listeners={{ tabPress: async () => { try { const count = await fetchFriendRequestCount(); markFriendRequestsViewed(count); } catch {} } }} />
        {isSuperuser && (
          <Tab.Screen name="AdminTab" component={AdminDashboardScreen} options={{ title: 'Admin' }} />
        )}
      </Tab.Navigator>
    );
  };

  return (
    <Stack.Navigator initialRouteName={token ? 'Home' : 'Login'} screenOptions={{ headerShown: false }}>
      {!token ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={ThemedTabs} />
          <Stack.Screen name="SuspendedUser" component={SuspendedUserScreen} />
          <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} />
          <Stack.Screen name="EditNotice" component={EditNoticeScreen} />
          <Stack.Screen name="CreateNotice" component={CreateNoticeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="FacultyList" component={FacultyListScreen} />
          <Stack.Screen name="StudentList" component={StudentListScreen} />
          <Stack.Screen name="AdminUserList" component={AdminUserListScreen} />
          <Stack.Screen name="AdminUserEdit" component={AdminUserEditScreen} />
          <Stack.Screen name="AdminUserCreate" component={AdminUserCreateScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="Friends" component={FriendsScreen} />
          <Stack.Screen name="Preferences" component={PreferencesScreen} />
          <Stack.Screen name="Analytics" component={AnalyticsDashboardScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="Violations" component={ViolationsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          {/* NEW SCREENS */}
          <Stack.Screen name="Discover" component={DiscoverScreen} />
          <Stack.Screen name="Events" component={EventsScreen} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
          <Stack.Screen name="Groups" component={GroupsScreen} />
          <Stack.Screen name="GroupChat" component={GroupChatScreen} />
          <Stack.Screen name="CampusServices" component={CampusServicesScreen} />
          <Stack.Screen name="StaffDirectory" component={StaffDirectoryScreen} />
          <Stack.Screen name="LostFound" component={LostFoundScreen} />
          <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
          <Stack.Screen name="VenueBooking" component={VenueBookingScreen} />
          <Stack.Screen name="ShuttleSchedule" component={ShuttleScheduleScreen} />
          <Stack.Screen name="CafeteriaMenu" component={CafeteriaMenuScreen} />
          <Stack.Screen name="AcademicHub" component={AcademicHubScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Domine_700Bold, Inter_400Regular, Inter_600SemiBold });
  if (!fontsLoaded) return null;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 24,
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
    },
  });
  const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'rq-cache' });
  persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 });
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <SafeAreaProvider>
              <NavigationContainer>
                <StatusBar style="auto" />
                <Router />
              </NavigationContainer>
            </SafeAreaProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
