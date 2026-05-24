// @ts-nocheck
import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import { api } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import HeaderBar from '../components/HeaderBar';
import OfflineBanner from '../components/OfflineBanner';
import NoticeCard from '../components/NoticeCard';
import FacebookComposer from '../components/FacebookComposer';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { spacing } from '../theme';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import { getNoticeCategoryLabel, NOTICE_PRIORITY_VALUES, NOTICE_PRIORITY_LABELS } from '../constants/notices';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import { useTabBadges } from '../hooks/useTabBadges';

type NoticeViewMode = 'feed' | 'official' | 'most' | 'favorites' | 'suggested' | 'search';
type NoticeSection = 'for_you' | 'campus_life' | 'business' | 'education';

const OFFICIAL_CARD_WIDTH = 240;

type NoticeAttachment = {
  id: number;
  url: string;
  file_type?: string;
  original_name?: string | null;
};

type Notice = {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_by_username: string;
  created_by_full_name?: string;
  created_by_avatar?: string | null;
  created_by_friend_status?: string;
  created_by_friend_request_id?: number | null;
  created_by_designation?: string;
  created_at: string;
  department?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  is_pinned?: boolean;
  priority?: string | null;
  expires_at?: string | null;
  attachments?: NoticeAttachment[];
  category?: string | null;
};

const FEED_SECTIONS: { key: NoticeSection; label: string; icon: string }[] = [
  { key: 'for_you', label: 'For You', icon: 'account-heart-outline' },
  { key: 'campus_life', label: 'Campus Life', icon: 'account-group-outline' },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' },
  { key: 'education', label: 'Education', icon: 'school-outline' },
];

const VIEW_MODE_TITLES: Record<NoticeViewMode, string> = {
  feed: 'Bugema Notice Board',
  official: 'Official Notices',
  most: 'Most Liked',
  favorites: 'Favorites',
  suggested: 'Suggested',
  search: 'Search',
};

const VIEW_MODE_ENDPOINTS: Record<Exclude<NoticeViewMode, 'feed'>, string> = {
  official: '/notices/official/',
  most: '/notices/most-liked/',
  favorites: '/notices/favorites/',
  suggested: '/notices/suggested/',
  search: '/notices/',
};

type Props = {
  navigation: any;
  route: any;
};

export default function HomeScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { showError } = useToast();
  const net = useNetInfo();
  const { signOut } = useContext(AuthContext);
  const [items, setItems] = useState<Notice[]>([]);
  const [isFaculty, setIsFaculty] = useState<boolean>(false);
  const [isStaff, setIsStaff] = useState<boolean>(false);
  const [isSuperuser, setIsSuperuser] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<NoticeViewMode>('feed');
  const [section, setSection] = useState<NoticeSection>('for_you');
  const [query, setQuery] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [followedDepartments, setFollowedDepartments] = useState<string[]>([]);
  const [searchPriority, setSearchPriority] = useState<string | null>(null);
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const badges = useTabBadges();
  const [globalPreview, setGlobalPreview] = useState<NoticeAttachment | null>(null);
  const isOnline = net.isConnected !== false;
  const noticeRefetchInterval = isOnline ? 30000 : false;
  const officialRefetchInterval = isOnline ? 30000 : false;
  const navigateTo = useCallback(
    <K extends keyof RootStackParamList>(route: K, params?: RootStackParamList[K]) => {
      const parent = navigation && typeof navigation.getParent === 'function' ? navigation.getParent() : null;
      const target = parent ?? navigation;
      if (target?.navigate) {
        target.navigate(route as never, params as never);
      }
    },
    [navigation],
  );

  useEffect(() => {
    api.get('/users/profiles/me/').then((r) => {
      setIsFaculty(!!r.data.is_faculty);
      setIsStaff(!!r.data.is_staff);
      setIsSuperuser(!!r.data.is_superuser);
      setCurrentUser(r.data);
      const followed = r.data.followed_departments || [];
      setFollowedDepartments(followed);
      if (followed.length > 0) {
        setSelectedDepartments([r.data.department, ...followed].filter(Boolean));
      }
    });
    api.get('/users/profiles/preferences/').then((r) => {
      const followed = r.data.followed_departments || [];
      setFollowedDepartments(followed);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const requestedMode = route?.params?.mode as NoticeViewMode | undefined;
    if (requestedMode) {
      setViewMode(requestedMode);
    } else {
      setViewMode('feed');
    }
  }, [route?.params?.mode]);

  useEffect(() => {
    if (viewMode !== 'feed') {
      setSection('for_you');
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'search' && query) {
      setQuery('');
    }
  }, [query, viewMode]);

  const fetchPage = useCallback(
    async ({ pageParam = 1 }) => {
      let url: string;
      const params: Record<string, any> = {};
      if (viewMode === 'feed') {
        url = '/notices/';
        if (section !== 'for_you') {
          params.category = section;
        }
        if (selectedDepartments.length > 0) {
          params.department_list = selectedDepartments.join(',');
        }
      } else {
        url = VIEW_MODE_ENDPOINTS[viewMode] ?? '/notices/';
      }
      params.page = pageParam;
      if (query) {
        params.search = query;
      }
      if (searchPriority && viewMode === 'search') {
        params.priority = searchPriority;
      }
      const response = await api.get(url, {
        params,
      });
      const payload = response.data;
      let results: Notice[] = [];
      let nextPage: number | undefined;

      if (Array.isArray(payload)) {
        results = payload.filter((item): item is Notice => !!item && typeof item.id !== 'undefined');
      } else if (payload && Array.isArray(payload.results)) {
        results = payload.results.filter((item: Notice) => !!item && typeof item.id !== 'undefined');
        if (payload.next) {
          try {
            const parsed = new URL(payload.next, 'http://dummy');
            const nextParam = parsed.searchParams.get('page');
            if (nextParam) nextPage = Number(nextParam);
          } catch {
            nextPage = undefined;
          }
        }
      }

      return { results, nextPage };
    },
    [query, section, viewMode],
  );

  const {
    data,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notices', viewMode, section, query, selectedDepartments.join(','), searchPriority],
    queryFn: fetchPage,
    getNextPageParam: (lastPage: { results: Notice[]; nextPage?: number }) => lastPage.nextPage,
    enabled: isOnline && viewMode !== 'official', // Disable for official mode since we use officialNoticesQuery
    initialPageParam: 1,
    refetchInterval: noticeRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
  });

  const officialNoticesQuery = useQuery({
    queryKey: ['official-notices'],
    queryFn: async () => {
      const response = await api.get('/notices/official/');
      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload.filter((item): item is Notice => !!item && typeof item.id !== 'undefined');
      }
      if (payload && Array.isArray(payload.results)) {
        return payload.results.filter((item: Notice) => !!item && typeof item.id !== 'undefined');
      }
      return [] as Notice[];
    },
    enabled: isOnline && (viewMode === 'feed' || viewMode === 'official'),
    refetchInterval: officialRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
  });
  const { refetch: refetchOfficial } = officialNoticesQuery;
  useFocusEffect(
    useCallback(() => {
      refetch();
      if (viewMode === 'feed' || viewMode === 'official') {
        refetchOfficial();
      }
    }, [refetch, refetchOfficial, viewMode])
  );

  useEffect(() => {
    // For official mode, use official notices query data
    if (isOfficialMode && officialNoticesQuery.data) {
      const official = Array.isArray(officialNoticesQuery.data)
        ? officialNoticesQuery.data.filter((item): item is Notice => !!item && typeof item.id !== 'undefined')
        : [];
      official.sort((a, b) => {
        const pinnedDiff = Number(b.is_pinned ? 1 : 0) - Number(a.is_pinned ? 1 : 0);
        if (pinnedDiff !== 0) return pinnedDiff;
        const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.id ?? 0) - (a.id ?? 0);
      });
      setItems(official);
      return;
    }

    // For other modes, use regular data
    if (!data?.pages) {
      setItems([]);
      return;
    }
    const flattened = data.pages.flatMap((page) =>
      Array.isArray(page.results)
        ? page.results.filter((item): item is Notice => !!item && typeof item.id !== 'undefined')
        : [],
    );
    const mergedMap = new Map<number, Notice>();
    flattened.forEach((notice) => {
      if (notice && typeof notice.id !== 'undefined') {
        mergedMap.set(notice.id, notice);
      }
    });
    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => {
      const pinnedDiff = Number(b.is_pinned ? 1 : 0) - Number(a.is_pinned ? 1 : 0);
      if (pinnedDiff !== 0) return pinnedDiff;
      const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.id ?? 0) - (a.id ?? 0);
    });
    setItems(merged);
  }, [data, viewMode, section, query, isOfficialMode, officialNoticesQuery.data]);

  const themedContainer = useMemo(
    () => [styles.container, { backgroundColor: theme.colors.background }],
    [theme.colors.background],
  );

  const secondaryTextColor = theme.colors.muted;

  const officialNoticesList = useMemo(() => {
    const raw = Array.isArray(officialNoticesQuery.data)
      ? officialNoticesQuery.data.filter((item): item is Notice => !!item && typeof item.id !== 'undefined')
      : [];
    return raw
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime(),
      );
  }, [officialNoticesQuery.data]);

  const showOfficialNotices = viewMode === 'feed';
  const isOfficialMode = viewMode === 'official';
  const isInitialLoading = isOfficialMode 
    ? officialNoticesQuery.isLoading && !officialNoticesQuery.data
    : isFetching && !data;
  const renderSectionChip = useCallback(
    (option: (typeof FEED_SECTIONS)[number]) => {
      const active = section === option.key;
      return (
        <TouchableOpacity
          key={option.key}
          onPress={() => setSection(option.key)}
          style={[
            styles.filterChip,
            {
              backgroundColor: active ? theme.colors.primary : theme.colors.surface,
              borderColor: active ? theme.colors.primary : theme.colors.border,
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <MaterialCommunityIcons
              name={option.icon as any}
              size={16}
              color={active ? theme.colors.primaryContrast : theme.colors.text}
            />
            <Text
              style={{
                color: active ? theme.colors.primaryContrast : theme.colors.text,
                fontWeight: '600',
              }}
            >
              {option.label}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [section, theme.colors.border, theme.colors.primary, theme.colors.primaryContrast, theme.colors.surface, theme.colors.text],
  );

  const openAuthorProfile = useCallback(
    (notice: Notice) => {
      if (!notice?.created_by) return;
      navigateTo('UserProfile', {
        userId: notice.created_by,
        name: notice.created_by_full_name || notice.created_by_username,
      });
    },
    [navigateTo],
  );

  const renderNotice = useCallback(
    ({ item }: { item: Notice }) => {
      const goToDetail = () => navigateTo('NoticeDetail', { id: item.id });
      return (
        <NoticeCard
          notice={{
            ...item,
            created_at: item.created_at,
            attachments: item.attachments?.map((a) => ({
              id: a.id,
              url: a.file || a.url || '',
              file_type: (a.file_type || 'image') as 'image' | 'video' | 'audio' | 'document',
              original_name: a.original_name,
            })),
          }}
          onLike={() => {
            api.post(`/notices/${item.id}/${item.is_liked ? 'unlike' : 'like'}/`).then(() => refetch());
          }}
          onComment={goToDetail}
          onShare={() => {}}
          compact
        />
      );
    },
    [navigateTo, refetch],
  );

  const renderOfficialNotices = useMemo(() => {
    if (!showOfficialNotices) return null;
    const cardStyle = {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    };
    const renderEmptyOfficial = () => (
      <View style={[styles.trendingCard, cardStyle, { width: OFFICIAL_CARD_WIDTH, alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialCommunityIcons name="shield-check-outline" size={24} color={theme.colors.muted} />
        <Text style={{ color: theme.colors.muted, marginTop: spacing.xs, textAlign: 'center' }}>
          No official notices yet.
        </Text>
      </View>
    );
    return (
      <View style={styles.trendingSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <MaterialCommunityIcons name='shield-check' size={18} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Official Notices</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={OFFICIAL_CARD_WIDTH + spacing.sm}
          snapToAlignment="start"
          scrollEventThrottle={16}
          contentContainerStyle={styles.trendingScrollContent}
        >
          {(officialNoticesQuery.isLoading && officialNoticesList.length === 0
            ? Array.from({ length: 3 })
            : officialNoticesList.slice(0, 8)
          ).map((item, index) => {
            if (!item) {
              return (
                <View key={`official-skeleton-${index}`} style={[styles.trendingCard, cardStyle, { width: OFFICIAL_CARD_WIDTH }]}>
                  <View style={[styles.trendingHeader, { opacity: 0.4 }]}>
                    <View style={[styles.trendingAvatar, styles.avatarPlaceholder, { backgroundColor: theme.colors.border }]} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ height: 12, width: '70%', backgroundColor: theme.colors.border, borderRadius: 6 }} />
                      <View style={{ height: 10, width: '40%', backgroundColor: theme.colors.border, borderRadius: 6 }} />
                    </View>
                  </View>
                  <View style={{ height: 10 }} />
                  <View style={{ height: 12, width: '50%', backgroundColor: theme.colors.border, borderRadius: 6 }} />
                  <View style={{ height: 80, width: '100%', backgroundColor: theme.colors.surface, borderRadius: 14, marginTop: spacing.sm }} />
                </View>
              );
            }
            const attachment = item?.attachments && item.attachments.length > 0 ? item.attachments[0] : undefined;
            const categoryLabel = getNoticeCategoryLabel(item?.category);
            return (
              <TouchableOpacity
                key={`official-${item?.id ?? index}`}
                activeOpacity={0.85}
                onPress={() => item && navigateTo('NoticeDetail', { id: item.id })}
                style={[styles.trendingCard, cardStyle, { width: OFFICIAL_CARD_WIDTH }]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={(e) => {
                    e.stopPropagation();
                    item && openAuthorProfile(item);
                  }}
                  style={styles.trendingHeader}
                >
                  {item?.created_by_avatar ? (
                    <Image source={{ uri: item.created_by_avatar }} style={styles.trendingAvatar} />
                  ) : (
                    <View
                      style={[
                        styles.trendingAvatar,
                        styles.avatarPlaceholder,
                        { backgroundColor: theme.colors.border },
                      ]}
                    />
                  )}
                  <View style={styles.trendingAuthor}>
                    <Text style={[styles.trendingTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {item?.title ?? 'Untitled'}
                    </Text>
                    <Text style={{ color: secondaryTextColor, fontSize: 12 }} numberOfLines={1}>
                      {item?.created_by_full_name || item?.created_by_username || 'Unknown'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {categoryLabel ? (
                  <View
                    style={[
                      styles.categoryPill,
                      { backgroundColor: `${theme.colors.primary}1A`, marginTop: spacing.xs },
                    ]}
                  >
                    <Text style={[styles.categoryPillText, { color: theme.colors.primary }]}>
                      {categoryLabel}
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: secondaryTextColor, marginTop: spacing.sm }} numberOfLines={3}>
                  {item?.description ?? ''}
                </Text>
                {attachment &&
                  (() => {
                    switch (attachment.file_type) {
                      case 'image':
                        return (
                          <TouchableOpacity activeOpacity={0.9} onPress={() => setGlobalPreview(attachment)}>
                            <View style={styles.trendingMediaWrapper}>
                              <Image source={{ uri: attachment.url }} style={styles.trendingMedia} resizeMode="cover" />
                            </View>
                          </TouchableOpacity>
                        );
                      case 'video':
                      case 'audio':
                        return (
                          <TouchableOpacity activeOpacity={0.9} onPress={() => setGlobalPreview(attachment)}>
                            <View style={styles.trendingMediaWrapper}>
                              <AttachmentMediaPlayer
                                uri={attachment.url}
                                style={styles.trendingVideo}
                                showControls
                                contentFit="contain"
                              />
                            </View>
                          </TouchableOpacity>
                        );
                      default:
                        return (
                          <Pressable
                            style={styles.trendingDocument}
                            onPress={(event) => {
                              event?.stopPropagation?.();
                              if (attachment.url) {
                                Linking.openURL(attachment.url);
                              }
                            }}
                          >
                            <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.colors.primary} />
                            <Text style={{ color: theme.colors.primary, fontWeight: '600', marginLeft: spacing.xs }}>
                              {attachment.original_name || 'View attachment'}
                            </Text>
                          </Pressable>
                        );
                    }
                  })()}
              </TouchableOpacity>
            );
          })}
          {officialNoticesList.length === 0 && !officialNoticesQuery.isLoading ? renderEmptyOfficial() : null}
        </ScrollView>
      </View>
    );
  }, [
    navigateTo,
    openAuthorProfile,
    secondaryTextColor,
    showOfficialNotices,
    theme.colors.border,
    theme.colors.muted,
    theme.colors.surface,
    theme.colors.primary,
    theme.colors.text,
    officialNoticesList,
    officialNoticesQuery.isLoading,
  ]);

  const searchHeader = useMemo(() => {
    if (viewMode !== 'search') return null;
    return (
      <View style={styles.searchBarContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
          <TextInput
            placeholder="Search notices"
            placeholderTextColor={theme.colors.muted}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: theme.colors.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => refetch()}
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={{ padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setShowSearchFilters(!showSearchFilters)}
            style={{ padding: 4, marginLeft: spacing.xs }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons 
              name={showSearchFilters ? "filter" : "filter-outline"} 
              size={18} 
              color={showSearchFilters ? theme.colors.primary : theme.colors.muted} 
            />
          </TouchableOpacity>
        </View>
        {showSearchFilters && (
          <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
            <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: spacing.xs }}>Filter by Priority</Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => setSearchPriority(null)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: searchPriority === null ? theme.colors.primary : theme.colors.surface,
                    borderColor: searchPriority === null ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: searchPriority === null ? theme.colors.primaryContrast : theme.colors.text,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  All
                </Text>
              </TouchableOpacity>
              {NOTICE_PRIORITY_VALUES.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSearchPriority(p)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: searchPriority === p ? theme.colors.primary : theme.colors.surface,
                      borderColor: searchPriority === p ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: searchPriority === p ? theme.colors.primaryContrast : theme.colors.text,
                      fontWeight: '600',
                      fontSize: 12,
                    }}
                  >
                    {NOTICE_PRIORITY_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        <Text style={[styles.searchHint, { color: theme.colors.muted }]}>
          Search by title, description, department, or author.
        </Text>
      </View>
    );
  }, [query, refetch, searchPriority, showSearchFilters, theme.colors.border, theme.colors.muted, theme.colors.primary, theme.colors.primaryContrast, theme.colors.surface, theme.colors.text, viewMode]);

  const listHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        {net.isConnected === false ? <OfflineBanner /> : null}
        <View style={styles.headerInner}>
          {viewMode === 'feed' ? (
            <>
              {/* Facebook-style composer */}
              <FacebookComposer
                avatarUrl={currentUser?.avatar_url}
                placeholder="What's on your mind?"
                onPress={() => navigateTo('CreateNotice')}
                onPhotoSelected={(uri) => {
                  navigateTo('CreateNotice', { photoUri: uri });
                }}
                onVideoSelected={(uri) => {
                  navigateTo('CreateNotice', { videoUri: uri });
                }}
                onFeelingSelected={(feeling) => {
                  navigateTo('CreateNotice', { feeling });
                }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {FEED_SECTIONS.map(renderSectionChip)}
              </ScrollView>
              {followedDepartments.length > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={{ color: theme.colors.muted, fontSize: 12, marginBottom: spacing.xs, paddingHorizontal: spacing.lg }}>
                    Departments
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                  >
                    <TouchableOpacity
                      onPress={() => setSelectedDepartments([])}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selectedDepartments.length === 0 ? theme.colors.primary : theme.colors.surface,
                          borderColor: selectedDepartments.length === 0 ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selectedDepartments.length === 0 ? theme.colors.primaryContrast : theme.colors.text,
                          fontWeight: '600',
                        }}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {followedDepartments.map((dept) => (
                      <TouchableOpacity
                        key={dept}
                        onPress={() => {
                          if (selectedDepartments.includes(dept)) {
                            setSelectedDepartments(selectedDepartments.filter((d) => d !== dept));
                          } else {
                            setSelectedDepartments([...selectedDepartments, dept]);
                          }
                        }}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: selectedDepartments.includes(dept) ? theme.colors.primary : theme.colors.surface,
                            borderColor: selectedDepartments.includes(dept) ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: selectedDepartments.includes(dept) ? theme.colors.primaryContrast : theme.colors.text,
                            fontWeight: '600',
                          }}
                        >
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {renderOfficialNotices}
            </>
          ) : (
            <>
              {isOfficialMode ? null : (
                <>
                  <View style={styles.modeBanner}>
                    <Text style={{ color: theme.colors.muted, fontSize: 13, fontWeight: '600' }}>
                      {VIEW_MODE_TITLES[viewMode]}
                    </Text>
                  </View>
                  {searchHeader}
                </>
              )}
            </>
          )}
        </View>
      </View>
    );
  }, [net.isConnected, renderSectionChip, renderOfficialNotices, searchHeader, theme.colors.muted, viewMode, currentUser?.avatar_url, navigateTo]);

  const renderEmpty = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator />
          <Text style={[styles.emptyText, { color: secondaryTextColor, marginTop: spacing.sm }]}>
            Loading notices…
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name='bell-off-outline' size={48} color={secondaryTextColor} />
        <Text style={[styles.emptyText, { color: secondaryTextColor, marginTop: spacing.md, fontSize: 16, fontWeight: '600' }]}>
          No notices available
        </Text>
        <Text style={[styles.emptyText, { color: secondaryTextColor, marginTop: spacing.xs, fontSize: 14 }]}>
          Check back later for new announcements
        </Text>
      </View>
    );
  }, [isInitialLoading, secondaryTextColor]);

  const renderFooter = useCallback(() => {
    if (isOfficialMode) return null; // Official notices don't have pagination
    return isFetchingNextPage ? (
      <View style={styles.footerWrapper}>
        <View style={styles.footer}>
          <ActivityIndicator />
        </View>
      </View>
    ) : null;
  }, [isFetchingNextPage, isOfficialMode]);

  const canManageUsers = isStaff || isSuperuser;

  const headerLeft = useMemo(() => {
    const fallbackAvatar =
      'https://ui-avatars.com/api/?name=Bugema&background=4338CA&color=fff&size=64';
    const avatarUri = currentUser?.avatar_url || fallbackAvatar;
    return (
      <TouchableOpacity
        onPress={() => setProfileMenuVisible(true)}
        style={styles.headerAvatarButton}
        activeOpacity={0.85}
      >
        <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
      </TouchableOpacity>
    );
  }, [currentUser?.avatar_url]);

  const headerActions = useMemo(() => {
    return (
      <View style={styles.headerIconRow}>
        <TouchableOpacity 
          onPress={() => navigateTo('Notifications')} 
          activeOpacity={0.7}
          style={styles.headerIconButton}
        >
          <MaterialCommunityIcons name="bell-outline" size={24} color="#65676B" />
          {badges.notifications && (
            <View style={[styles.friendBadge, { backgroundColor: '#E41E3F' }]} />
          )}
        </TouchableOpacity>
        {canManageUsers && (
          <TouchableOpacity 
            onPress={() => navigateTo('AdminUserList')} 
            activeOpacity={0.7}
            style={styles.headerIconButton}
          >
            <MaterialCommunityIcons name="account-group-outline" size={24} color="#65676B" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={() => setProfileMenuVisible(true)} 
          activeOpacity={0.7}
          style={styles.headerIconButton}
        >
          <MaterialCommunityIcons name="menu" size={24} color="#65676B" />
        </TouchableOpacity>
      </View>
    );
  }, [badges.notifications, canManageUsers, navigateTo]);

  const headerTitle = viewMode === 'feed' ? undefined : VIEW_MODE_TITLES[viewMode];

  return (
    <>
      <SafeAreaView style={themedContainer}>
      <Modal
        transparent
        visible={profileMenuVisible}
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setProfileMenuVisible(false)}>
          <View
            style={[
              styles.profileMenu,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                navigateTo('Profile');
              }}
            >
              <MaterialCommunityIcons name="account-circle-outline" size={18} color={theme.colors.text} />
              <Text style={[styles.profileMenuText, { color: theme.colors.text }]}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                signOut();
              }}
            >
              <MaterialCommunityIcons name="logout" size={18} color="#ef4444" />
              <Text style={[styles.profileMenuText, { color: '#ef4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <HeaderBar 
        title={headerTitle} 
        left={viewMode === 'feed' ? undefined : headerLeft} 
        right={viewMode === 'feed' ? headerActions : undefined}
        showSearch={viewMode === 'feed'}
        onSearchPress={() => setViewMode('search')}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => null}
        renderItem={renderNotice}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              if (isOfficialMode) {
                refetchOfficial();
              } else {
                refetch();
              }
            }}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!isOfficialMode && hasNextPage) fetchNextPage();
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
      />
      </SafeAreaView>
      <AttachmentPreviewModal
        visible={!!globalPreview}
        attachment={globalPreview}
        onClose={() => setGlobalPreview(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: spacing.sm,
  },
  headerInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  searchBarContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  searchHint: {
    marginTop: spacing.xs,
    fontSize: 12,
  },
  filterRow: {
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trendingSection: {
    marginTop: spacing.md,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4E6EB',
    position: 'relative',
  },
  headerAvatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'flex-start',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  trendingScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  modeBanner: {
    paddingVertical: spacing.sm,
  },
  trendingCard: {
    width: OFFICIAL_CARD_WIDTH,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.sm,
  },
  trendingAuthor: {
    flex: 1,
  },
  trendingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  trendingMediaWrapper: {
    marginTop: spacing.sm,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trendingMedia: {
    width: '100%',
    height: 150,
  },
  trendingVideo: {
    width: '100%',
    height: 160,
  },
  trendingDocument: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeAuthorInfo: {
    flex: 1,
  },
  noticeAuthor: {
    fontWeight: '700',
    fontSize: 16,
  },
  noticeTimestamp: {
    fontSize: 12,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticePinned: {
    marginRight: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  noticeDescription: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeMediaWrapper: {
    marginTop: spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  noticeMedia: {
    width: '100%',
    height: 200,
  },
  noticeVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  noticeDocument: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  noticeMetricsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  noticeActionLabel: {
    marginLeft: 6,
    fontSize: 12,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.md,
  },
  footerWrapper: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
    backgroundColor: '#F0F2F5',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  headerActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    marginRight: spacing.sm,
  },
  headerActionPrimaryText: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 13,
  },
  headerActionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerActionOutlineText: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 13,
  },
  profileMenu: {
    width: 200,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  profileMenuText: {
    fontWeight: '600',
  },
});
