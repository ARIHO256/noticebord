import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { RootStackParamList } from '../App';
import { useTheme } from '../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '../theme';
import HeaderBar from '../components/HeaderBar';
import Card from '../components/Card';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  FriendStatus,
  sendFriendRequest,
} from '../api/friends';

type Props = NativeStackScreenProps<RootStackParamList, 'NoticeDetail'>;

type NoticeAttachment = {
  id: number;
  url: string;
  file_type: 'image' | 'video' | 'audio' | 'document' | string;
  original_name?: string | null;
};

type NoticeComment = {
  id: number;
  username: string;
  user_full_name?: string | null;
  user_avatar?: string | null;
  text: string;
  created_at?: string;
  parent_id?: number | null;
  parent_username?: string | null;
  likes_count?: number;
  is_liked?: boolean;
  replies_count?: number;
  views_count?: number;
  replies?: NoticeComment[];
};

type CommentTreeResult = {
  data: NoticeComment[];
  changed: boolean;
};

const normalizeComment = (comment: NoticeComment): NoticeComment => ({
  ...comment,
  replies: comment.replies ? comment.replies.map(normalizeComment) : [],
  likes_count: comment.likes_count ?? 0,
  is_liked: Boolean(comment.is_liked),
});

const insertComment = (tree: NoticeComment[], incoming: NoticeComment): CommentTreeResult => {
  const normalized = normalizeComment(incoming);
  if (!incoming.parent_id) {
    return {
      changed: true,
      data: [normalized, ...tree],
    };
  }
  let changed = false;
  const nextTree = tree.map((node) => {
    if (node.id === incoming.parent_id) {
      changed = true;
      const replies = node.replies ? [normalized, ...node.replies] : [normalized];
      return { ...node, replies };
    }
    if (node.replies && node.replies.length > 0) {
      const { data, changed: childChanged } = insertComment(node.replies, incoming);
      if (childChanged) {
        changed = true;
        return { ...node, replies: data };
      }
    }
    return node;
  });
  return { data: changed ? nextTree : tree, changed };
};

const updateCommentTree = (
  tree: NoticeComment[],
  commentId: number,
  updater: (comment: NoticeComment) => NoticeComment,
): CommentTreeResult => {
  let changed = false;
  const nextTree = tree.map((node) => {
    if (node.id === commentId) {
      changed = true;
      return updater(node);
    }
    if (node.replies && node.replies.length > 0) {
      const { data, changed: childChanged } = updateCommentTree(node.replies, commentId, updater);
      if (childChanged) {
        changed = true;
        return { ...node, replies: data };
      }
    }
    return node;
  });
  return { data: changed ? nextTree : tree, changed };
};

type NoticeDetail = {
  id: number;
  title: string;
  description: string;
  created_by: number;
  department?: string | null;
  is_pinned?: boolean;
  scheduled_at?: string | null;
  created_by_username: string;
  created_by_full_name?: string | null;
  created_by_avatar?: string | null;
  created_by_friend_status?: FriendStatus;
  created_by_friend_request_id?: number | null;
  created_by_friend_status?: FriendStatus;
  created_by_friend_request_id?: number | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  views_count?: number;
  likes_count?: number;
  favorites_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  attachments?: NoticeAttachment[];
};

type Profile = {
  id: number;
  is_staff: boolean;
  is_superuser?: boolean;
  username: string;
} & Record<string, any>;

export default function NoticeDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commentInputRef = useRef<TextInput | null>(null);
  const [item, setItem] = useState<NoticeDetail | null>(null);
  const [comments, setComments] = useState<NoticeComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [replyingTo, setReplyingTo] = useState<NoticeComment | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [authorFriendStatus, setAuthorFriendStatus] = useState<FriendStatus>('unknown');
  const [authorFriendRequestId, setAuthorFriendRequestId] = useState<number | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [authorProfile, setAuthorProfile] = useState<{ is_active?: boolean } | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [noticeResp, commentResp] = await Promise.all([
          api.get<NoticeDetail>(`/notices/${id}/`),
          api.get<NoticeComment[]>(`/notices/${id}/comments/`, {
            params: { max_depth: 3 },
          }),
        ]);
        setItem(noticeResp.data);
        const incoming = Array.isArray(commentResp.data) ? commentResp.data : [];
        setComments(incoming.map(normalizeComment));
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
    api.get<Profile>('/users/profiles/me/').then((r) => setMe(r.data));
  }, [id, load]);

  // Fetch author profile to check suspension status (for admin actions)
  useEffect(() => {
    if (item && isAdminOrStaff) {
      api.get(`/users/profiles/${item.created_by}/`)
        .then((r) => setAuthorProfile(r.data))
        .catch(() => setAuthorProfile(null));
    }
  }, [item, isAdminOrStaff]);

  const handleLikeToggle = useCallback(async () => {
    if (!item) return;
    const liked = Boolean(item.is_liked);
    setItem((prev) =>
      prev
        ? {
            ...prev,
            is_liked: !liked,
            likes_count: Math.max(0, (prev.likes_count ?? 0) + (liked ? -1 : 1)),
          }
        : prev,
    );
    try {
      await api.post(`/notices/${id}/${liked ? 'unlike' : 'like'}/`);
    } catch (err) {
      setItem((prev) =>
        prev
          ? {
              ...prev,
              is_liked: liked,
              likes_count: Math.max(0, (prev.likes_count ?? 0) + (liked ? 1 : -1)),
            }
          : prev,
      );
    }
  }, [id, item]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!item) return;
    const favorited = Boolean(item.is_favorited);
    setItem((prev) =>
      prev
        ? {
            ...prev,
            is_favorited: !favorited,
            favorites_count: Math.max(0, (prev.favorites_count ?? 0) + (favorited ? -1 : 1)),
          }
        : prev,
    );
    try {
      await api.post(`/notices/${id}/${favorited ? 'unfavorite' : 'favorite'}/`);
    } catch (err) {
      setItem((prev) =>
        prev
          ? {
              ...prev,
              is_favorited: favorited,
              favorites_count: Math.max(0, (prev.favorites_count ?? 0) + (favorited ? 1 : -1)),
            }
          : prev,
      );
    }
  }, [id, item]);

  const handleCommentSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !item || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      // Content moderation check - check for violations
      const { moderateText } = await import('../services/contentModeration');
      const moderationResult = await moderateText(trimmed);
      
      // Block if content violates guidelines (profanity, threats, harassment, hate speech)
      if (!moderationResult.isSafe) {
        const categories = moderationResult.categories || [];
        const isViolation = categories.some(cat => 
          ['profanity', 'threatening', 'sexual_harassment', 'hate_speech'].includes(cat)
        );
        
        if (isViolation) {
          Alert.alert(
            'Comment Blocked',
            moderationResult.reason || 'Your comment violates community guidelines and cannot be posted.',
            [{ text: 'OK' }]
          );
          setCommentSubmitting(false);
          return;
        }
      }

      const payload: Record<string, any> = { text: trimmed };
      if (replyingTo) {
        payload.parent = replyingTo.id;
      }
      const response = await api.post<NoticeComment>(`/notices/${id}/comments/`, payload);
      setComments((prev) => {
        const { data, changed } = insertComment(prev, response.data);
        return changed ? data : prev;
      });
      setItem((prev) =>
        prev
          ? { ...prev, comments_count: (prev.comments_count ?? 0) + 1 }
          : prev,
      );
      setText('');
      setReplyingTo(null);
      setTimeout(() => {
        commentInputRef.current?.blur();
      }, 100);
    } catch (err) {
      Alert.alert('Error', 'Unable to post comment. Please try again.');
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentSubmitting, id, item, replyingTo, text]);

  const handleCommentLikeToggle = useCallback(
    async (comment: NoticeComment) => {
      const endpoint = comment.is_liked ? 'unlike' : 'like';
      setComments((prev) => {
        const { data } = updateCommentTree(prev, comment.id, (node) => ({
          ...node,
          is_liked: !node.is_liked,
          likes_count: Math.max(0, (node.likes_count ?? 0) + (node.is_liked ? -1 : 1)),
        }));
        return data;
      });
      try {
        await api.post(`/notices/${id}/comments/${comment.id}/${endpoint}/`);
      } catch (err) {
        setComments((prev) => {
          const { data } = updateCommentTree(prev, comment.id, (node) => ({
            ...node,
            is_liked: !node.is_liked,
            likes_count: Math.max(0, (node.likes_count ?? 0) + (node.is_liked ? -1 : 1)),
          }));
          return data;
        });
      }
    },
    [id],
  );

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  }, []);

  const handleStartReply = useCallback(
    (comment: NoticeComment) => {
      setReplyingTo(comment);
      focusComposer();
    },
    [focusComposer],
  );

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  useEffect(() => {
    if (item) {
      setAuthorFriendStatus(item.created_by_friend_status || 'unknown');
      setAuthorFriendRequestId(item.created_by_friend_request_id ?? null);
    }
  }, [item]);

  const handleShare = useCallback(async () => {
    if (!item) return;
    const message = `${item.title}\n\n${item.description}${
      item.department ? `\n\nDepartment: ${item.department}` : ''
    }`;
    try {
      await Share.share({ message });
    } catch (err) {
      // no-op
    }
  }, [item]);

  const handleMessageAuthor = useCallback(async () => {
    if (!item) return;
    setMessageLoading(true);
    try {
      const response = await api.post('/messages/conversations/', { notice_id: item.id });
      const conversation = response.data as { id: number };
      navigation.navigate('Conversation', {
        conversationId: conversation.id,
        title: item.created_by_full_name || item.created_by_username,
        noticeTitle: item.title,
      });
    } catch (err) {
      Alert.alert('Messaging unavailable', 'Unable to open a conversation right now. Please try again once you are friends.');
    } finally {
      setMessageLoading(false);
    }
  }, [item, navigation]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!item) return;
    try {
      const request = await sendFriendRequest(item.created_by);
      setAuthorFriendStatus('outgoing');
      setAuthorFriendRequestId(request.id);
      Alert.alert('Request sent', 'Friend request sent successfully.');
    } catch (error: any) {
      const detail = error?.userMessage || error?.response?.data?.detail || 'Unable to send a friend request.';
      Alert.alert('Error', detail);
    }
  }, [item]);

  const handleCancelFriendRequest = useCallback(async () => {
    if (!authorFriendRequestId) return;
    try {
      await cancelFriendRequest(authorFriendRequestId);
      setAuthorFriendStatus('none');
      setAuthorFriendRequestId(null);
    } catch {
      Alert.alert('Error', 'Unable to cancel this request.');
    }
  }, [authorFriendRequestId]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!authorFriendRequestId) return;
    try {
      await acceptFriendRequest(authorFriendRequestId);
      setAuthorFriendStatus('friends');
      setAuthorFriendRequestId(null);
      load();
    } catch {
      Alert.alert('Error', 'Unable to accept this request.');
    }
  }, [authorFriendRequestId, load]);

  const handleDeclineFriendRequest = useCallback(async () => {
    if (!authorFriendRequestId) return;
    try {
      await declineFriendRequest(authorFriendRequestId);
      setAuthorFriendStatus('none');
      setAuthorFriendRequestId(null);
    } catch {
      Alert.alert('Error', 'Unable to decline this request.');
    }
  }, [authorFriendRequestId]);

  const handleAttachmentRemove = useCallback(
    async (attachmentId: number) => {
      if (!item) return;
      Alert.alert('Remove attachment', 'Are you sure you want to remove this attachment?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/notices/${id}/attachments/${attachmentId}/`);
              setItem((prev) =>
                prev
                  ? {
                      ...prev,
                      attachments: (prev.attachments || []).filter((att) => att.id !== attachmentId),
                    }
                  : prev,
              );
            } catch (err) {
              Alert.alert('Error', 'Could not remove attachment.');
            }
          },
        },
      ]);
    },
    [id, item],
  );

  const handleReport = useCallback(async () => {
    try {
      await api.post(`/notices/${id}/report/`, { reason: 'Inappropriate' });
      Alert.alert('Thank you', 'We have received your report.');
    } catch (err) {
      Alert.alert('Error', 'Unable to submit report right now.');
    }
  }, [id]);

  const handlePinToggle = useCallback(async () => {
    if (!item) return;
    try {
      if (item.is_pinned) {
        await api.post(`/notices/${id}/unpin/`);
      } else {
        await api.post(`/notices/${id}/pin/`);
      }
      setItem((prev) => (prev ? { ...prev, is_pinned: !prev.is_pinned } : prev));
    } catch (err) {
      Alert.alert('Error', 'Unable to update pin status.');
    }
  }, [id, item]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete notice', 'This action cannot be undone. Delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/notices/${id}/`);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete notice.');
          }
        },
      },
    ]);
  }, [id, navigation]);

  const handleSuspendUser = useCallback(() => {
    if (!item) return;
    const authorName = item.created_by_full_name || item.created_by_username;
    Alert.alert(
      'Suspend User Account',
      `Are you sure you want to suspend ${authorName}'s account? They will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/users/profiles/${item.created_by}/suspend/`);
              Alert.alert('Success', 'User account has been suspended.');
              // Optionally refresh the notice to show updated status
              load(true);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to suspend user account.');
            }
          },
        },
      ]
    );
  }, [item, load]);

  const handleUnsuspendUser = useCallback(() => {
    if (!item) return;
    const authorName = item.created_by_full_name || item.created_by_username;
    Alert.alert(
      'Unsuspend User Account',
      `Are you sure you want to unsuspend ${authorName}'s account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsuspend',
          onPress: async () => {
            try {
              await api.post(`/users/profiles/${item.created_by}/unsuspend/`);
              Alert.alert('Success', 'User account has been unsuspended.');
              load(true);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to unsuspend user account.');
            }
          },
        },
      ]
    );
  }, [item, load]);

  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const toggleReplies = (commentId: number) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const renderCommentNode = (comment: NoticeComment, depth = 0, parentComment?: NoticeComment): React.ReactNode => {
    const repliesCount = comment.replies?.length ?? 0;
    const isExpanded = expandedComments[comment.id];
    const replies =
      comment.replies && comment.replies.length > 0 && isExpanded
        ? comment.replies.map((child) => renderCommentNode(child, depth + 1, comment))
        : null;
    const displayName = comment.user_full_name || comment.username;
    const handle = comment.username;
    const timestamp = comment.created_at ? formatCommentTime(comment.created_at) : '';
    const avatarUri = comment.user_avatar;
    const isReply = depth > 0 && parentComment;

    return (
      <TouchableOpacity
        key={`${comment.id}-${depth}`}
        activeOpacity={0.95}
        style={[styles.twitterCommentCard, { borderBottomColor: theme.colors.border }]}
      >
        <View style={styles.twitterCommentContent}>
          {/* Avatar */}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('UserProfile', {
                userId: comment.id,
                name: displayName,
              })
            }
            style={styles.commentAvatarWrapper}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.twitterCommentAvatar} />
            ) : (
              <View style={[styles.twitterCommentAvatar, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.commentAvatarInitial, { color: theme.colors.text }]}>
                  {displayName?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Comment Content */}
          <View style={styles.commentContentWrapper}>
            {/* Header: Name, Verified Badge, Handle, Time */}
            <View style={styles.commentHeaderRow}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('UserProfile', {
                    userId: comment.id,
                    name: displayName,
                  })
                }
                style={styles.commentNameRow}
              >
                <Text style={[styles.twitterCommentName, { color: theme.colors.text }]}>{displayName}</Text>
                <MaterialCommunityIcons name="check-circle" size={14} color={theme.colors.primary} style={{ marginLeft: 4 }} />
                <Text style={[styles.twitterCommentHandle, { color: theme.colors.muted }]}>@{handle}</Text>
                <Text style={[styles.twitterCommentTime, { color: theme.colors.muted }]}>· {timestamp}</Text>
              </TouchableOpacity>
              <View style={styles.commentRightActions}>
                <TouchableOpacity style={styles.commentActionIcon}>
                  <MaterialCommunityIcons name="bell-off" size={18} color={theme.colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentActionIcon}>
                  <MaterialCommunityIcons name="dots-horizontal" size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Replying to context */}
            {isReply && parentComment && (
              <Text style={[styles.replyingToText, { color: theme.colors.muted }]}>
                Replying to <Text style={{ color: theme.colors.primary }}>@{parentComment.username}</Text>
              </Text>
            )}

            {/* Comment Text */}
            <Text style={[styles.twitterCommentText, { color: theme.colors.text }]}>{comment.text}</Text>

            {/* Interaction Icons Row */}
            <View style={styles.twitterCommentActions}>
              <TouchableOpacity
                style={styles.twitterActionButton}
                onPress={() => handleStartReply(comment)}
              >
                <MaterialCommunityIcons name="comment-outline" size={18} color={theme.colors.muted} />
                {(comment.replies_count ?? 0) > 0 && (
                  <Text style={[styles.actionCount, { color: theme.colors.muted }]}>
                    {comment.replies_count}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.twitterActionButton}>
                <MaterialCommunityIcons name="repeat" size={18} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.twitterActionButton}
                onPress={() => handleCommentLikeToggle(comment)}
              >
                <MaterialCommunityIcons
                  name={comment.is_liked ? 'heart' : 'heart-outline'}
                  size={18}
                  color={comment.is_liked ? '#F91880' : theme.colors.muted}
                />
                {(comment.likes_count ?? 0) > 0 && (
                  <Text
                    style={[
                      styles.actionCount,
                      { color: comment.is_liked ? '#F91880' : theme.colors.muted },
                    ]}
                  >
                    {comment.likes_count}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.twitterActionButton}>
                <MaterialCommunityIcons name="chart-bar" size={18} color={theme.colors.muted} />
                {(comment.views_count ?? 0) > 0 && (
                  <Text style={[styles.actionCount, { color: theme.colors.muted }]}>
                    {comment.views_count}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.twitterActionButton}>
                <MaterialCommunityIcons name="bookmark-outline" size={18} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.twitterActionButton} onPress={handleShare}>
                <MaterialCommunityIcons name="share-variant" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Replies */}
        {repliesCount > 0 && (
          <TouchableOpacity
            style={styles.showRepliesButton}
            onPress={() => toggleReplies(comment.id)}
          >
            <Text style={[styles.showRepliesText, { color: theme.colors.primary }]}>
              {isExpanded ? 'Hide replies' : `Show ${repliesCount} repl${repliesCount === 1 ? 'y' : 'ies'}`}
            </Text>
          </TouchableOpacity>
        )}
        {replies ? <View style={styles.commentRepliesContainer}>{replies}</View> : null}
      </TouchableOpacity>
    );
  };

  const isOwner = !!(me && item && me.id === item.created_by);
  const isAdminOrStaff = !!(me && (me.is_staff || me.is_superuser));
  const attachments = item?.attachments || [];
  const hasAttachments = attachments.length > 0;
  const extraAttachments = attachments.length > 1 ? attachments.slice(1) : [];
  const goToAuthorProfile = useCallback(() => {
    if (!item) return;
    navigation.navigate('UserProfile', {
      userId: item.created_by,
      name: item.created_by_full_name || item.created_by_username,
    });
  }, [item, navigation]);

  const formatPostTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm} · ${day} ${month} ${year}`;
  };

  const formatCommentTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if ((!item || loading) && !refreshing) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: theme.colors.text }}>Notice not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
      >
        {/* Twitter-style Header */}
        <View style={[styles.twitterHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Post</Text>
          <TouchableOpacity onPress={() => load(true)} style={styles.headerButton}>
            <MaterialCommunityIcons name="refresh" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.colors.primary}
            />
          }
        >
        <Card>
          {/* Post Author Header */}
          <TouchableOpacity style={styles.headerRow} activeOpacity={0.85} onPress={goToAuthorProfile}>
            {item.created_by_avatar ? (
              <Image source={{ uri: item.created_by_avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={[styles.avatarInitial, { color: theme.colors.text }]}>
                  {(item.created_by_full_name || item.created_by_username || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={[styles.authorName, { color: theme.colors.text }]}>
                  {item.created_by_full_name || item.created_by_username}
                </Text>
                <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.primary} style={{ marginLeft: 4 }} />
                <Text style={[styles.authorHandle, { color: theme.colors.muted }]}>
                  @{item.created_by_username}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Post Content */}
          <Text style={[styles.postText, { color: theme.colors.text }]}>{item.description}</Text>

          {/* Post Timestamp and Views */}
          <View style={styles.postMetaRow}>
            <Text style={[styles.postTime, { color: theme.colors.muted }]}>
              {formatPostTime(item.created_at)}
            </Text>
            <Text style={[styles.postViews, { color: theme.colors.text }]}>
              <Text style={{ fontWeight: '700' }}>{item.views_count ?? 0}</Text> Views
            </Text>
          </View>

          {/* Engagement Metrics */}
          <View style={[styles.engagementRow, { borderTopColor: theme.colors.border, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.engagementMetric}>
              <Text style={[styles.engagementNumber, { color: theme.colors.text }]}>
                {item.comments_count ?? 0}
              </Text>
              <Text style={[styles.engagementLabel, { color: theme.colors.muted }]}>Reposts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.engagementMetric}>
              <Text style={[styles.engagementNumber, { color: theme.colors.text }]}>
                {item.likes_count ?? 0}
              </Text>
              <Text style={[styles.engagementLabel, { color: theme.colors.muted }]}>Likes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.engagementMetric}>
              <Text style={[styles.engagementNumber, { color: theme.colors.text }]}>
                {item.favorites_count ?? 0}
              </Text>
              <Text style={[styles.engagementLabel, { color: theme.colors.muted }]}>Bookmarks</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons Row */}
          <View style={[styles.actionButtonsRow, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.actionIconButton} onPress={focusComposer}>
              <MaterialCommunityIcons name="comment-outline" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton}>
              <MaterialCommunityIcons name="repeat" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton} onPress={handleLikeToggle}>
              <MaterialCommunityIcons
                name={item.is_liked ? 'heart' : 'heart-outline'}
                size={20}
                color={item.is_liked ? '#F91880' : theme.colors.muted}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton} onPress={handleFavoriteToggle}>
              <MaterialCommunityIcons
                name={item.is_favorited ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={item.is_favorited ? theme.colors.primary : theme.colors.muted}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton} onPress={handleShare}>
              <MaterialCommunityIcons name="share-variant" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {hasAttachments ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachmentStrip}
            >
          {(item.attachments ?? []).map((attachment) => {
                const baseWrapper = (
                  <View key={attachment.id} style={styles.attachmentWrapper}>
                    {(() => {
                      switch (attachment.file_type) {
                        case 'image':
                          return (
                            <Image
                              source={{ uri: attachment.url }}
                              style={styles.attachmentImage}
                              resizeMode="cover"
                            />
                          );
                        case 'video':
                        case 'audio':
                          return (
                            <AttachmentMediaPlayer
                              uri={attachment.url}
                              style={styles.attachmentVideo}
                              showControls
                              contentFit="contain"
                            />
                          );
                        default:
                          return (
                            <TouchableOpacity
                              style={styles.attachmentDocument}
                              activeOpacity={0.8}
                              onPress={() => Linking.openURL(attachment.url)}
                            >
                              <MaterialCommunityIcons
                                name="file-document-outline"
                                size={20}
                                color={theme.colors.primary}
                              />
                              <Text
                                style={{
                                  color: theme.colors.primary,
                                  fontWeight: '600',
                                  marginLeft: spacing.sm,
                                }}
                              >
                                {attachment.original_name || 'Open attachment'}
                              </Text>
                            </TouchableOpacity>
                          );
                      }
                    })()}
                    {isOwner ? (
                      <TouchableOpacity
                        style={styles.attachmentRemove}
                        onPress={() => handleAttachmentRemove(attachment.id)}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
                return baseWrapper;
              })}
            </ScrollView>
          ) : null}

          {!isOwner && authorFriendStatus !== 'friends' ? (
            <View style={styles.friendActionRow}>
              {authorFriendStatus === 'incoming' ? (
                <>
                  <TouchableOpacity
                    style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleAcceptFriendRequest}
                  >
                    <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
                    onPress={handleDeclineFriendRequest}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Decline</Text>
                  </TouchableOpacity>
                </>
              ) : authorFriendStatus === 'outgoing' ? (
                <>
                  <View style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Request sent</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
                    onPress={handleCancelFriendRequest}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSendFriendRequest}
                >
                  <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Add Friend</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </Card>

        {/* Comments Section */}
        <View style={[styles.commentsSection, { backgroundColor: theme.colors.background }]}>
          {/* Most Relevant Replies Header */}
          <View style={[styles.repliesHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.repliesHeaderText, { color: theme.colors.text }]}>Most relevant replies</Text>
            <TouchableOpacity>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {comments.length === 0 ? (
            <View style={styles.emptyCommentsContainer}>
              <Text style={[styles.emptyCommentsText, { color: theme.colors.muted }]}>
                No replies yet. Be the first to reply!
              </Text>
            </View>
          ) : (
            comments.map((comment) => renderCommentNode(comment, 0))
          )}
        </View>

        {isOwner ? (
          <Card>
            <View style={styles.ownerActions}>
              <Button title={item.is_pinned ? 'Unpin notice' : 'Pin notice'} onPress={handlePinToggle} />
              <View style={styles.ownerActionsSpacer} />
              <Button title="Edit notice" onPress={() => navigation.navigate('EditNotice', { id })} />
              <View style={styles.ownerActionsSpacer} />
              <Button title="Delete notice" color="#e11d48" onPress={handleDelete} />
            </View>
          </Card>
        ) : null}

        {/* Admin/Staff Actions - Show for suspended posts or when admin/staff viewing any post */}
        {isAdminOrStaff && !isOwner && item ? (
          <Card>
            <View style={styles.adminActions}>
              <Text style={[styles.adminActionsTitle, { color: theme.colors.text }]}>Admin Actions</Text>
              <View style={styles.ownerActionsSpacer} />
              <Button 
                title="Delete Post" 
                color="#e11d48" 
                onPress={handleDelete}
              />
              <View style={styles.ownerActionsSpacer} />
              {authorProfile?.is_active === false ? (
                <Button 
                  title="Unsuspend User Account" 
                  color="#10B981" 
                  onPress={handleUnsuspendUser}
                />
              ) : (
                <Button 
                  title="Suspend User Account" 
                  color="#F59E0B" 
                  onPress={handleSuspendUser}
                />
              )}
              {!item.is_active && (
                <>
                  <View style={styles.ownerActionsSpacer} />
                  <View style={[styles.suspendedBanner, { backgroundColor: '#DC262620', borderColor: '#DC2626' }]}>
                    <MaterialCommunityIcons name="alert-circle" size={20} color="#DC2626" />
                    <Text style={[styles.suspendedBannerText, { color: '#DC2626' }]}>
                      This post is suspended
                    </Text>
                  </View>
                  {item.suspension_reason && (
                    <View style={styles.suspensionReasonContainer}>
                      <Text style={[styles.suspensionReasonLabel, { color: theme.colors.muted }]}>
                        Reason:
                      </Text>
                      <Text style={[styles.suspensionReasonText, { color: theme.colors.text }]}>
                        {item.suspension_reason}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </Card>
        ) : null}
        </ScrollView>

        {/* Bottom Reply Input (Twitter style) */}
        <View style={[styles.bottomReplyContainer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          {replyingTo && (
            <View style={[styles.replyingToBanner, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.replyingToBannerText, { color: theme.colors.text }]}>
                Replying to <Text style={{ color: theme.colors.primary }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <MaterialCommunityIcons name="close" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.replyInputRow}>
            {me?.avatar_url ? (
              <Image source={{ uri: me.avatar_url }} style={styles.replyInputAvatar} />
            ) : (
              <View style={[styles.replyInputAvatar, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.replyInputAvatarText, { color: theme.colors.text }]}>
                  {(me?.username || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <TextInput
              ref={commentInputRef}
              placeholder="Post your reply"
              value={text}
              onChangeText={setText}
              style={[styles.replyInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <TouchableOpacity
              onPress={handleCommentSubmit}
              disabled={commentSubmitting || text.trim().length === 0}
              style={[
                styles.replySendButton,
                {
                  backgroundColor: text.trim().length > 0 ? theme.colors.primary : theme.colors.surfaceMuted,
                  opacity: commentSubmitting || text.trim().length === 0 ? 0.5 : 1,
                },
              ]}
            >
              {commentSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color={text.trim().length > 0 ? '#FFFFFF' : theme.colors.muted} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: typeof import('../theme').lightTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: 100, // Space for bottom reply input
    },
    twitterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      height: 56,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: spacing.md,
    },
    avatarFallback: {
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    authorInfo: {
      flex: 1,
    },
    authorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    authorName: {
      fontWeight: '700',
      fontSize: 16,
      color: theme.colors.text,
    },
    authorHandle: {
      fontSize: 14,
      marginLeft: spacing.xs,
    },
    timeMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      flex: 1,
      color: theme.colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: spacing.xs,
    },
    metaChipText: {
      color: theme.colors.text,
      fontSize: 12,
    },
    description: {
      fontSize: 16,
      lineHeight: 22,
      color: theme.colors.text,
    },
    postText: {
      fontSize: 20,
      lineHeight: 28,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    postMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    postTime: {
      fontSize: 15,
    },
    postViews: {
      fontSize: 15,
    },
    engagementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    engagementMetric: {
      alignItems: 'center',
    },
    engagementNumber: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 2,
    },
    engagementLabel: {
      fontSize: 13,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    actionIconButton: {
      padding: spacing.sm,
    },
    attachmentStrip: {
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    attachmentWrapper: {
      position: 'relative',
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    attachmentImage: {
      width: 240,
      height: 160,
      borderRadius: 12,
    },
    attachmentVideo: {
      width: 240,
      height: 180,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    attachmentDocument: {
      width: 240,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    attachmentRemove: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 12,
      padding: 4,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    statText: {
      color: theme.colors.muted,
      fontSize: 13,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    friendActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    friendPrimaryButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
    },
    friendSecondaryButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
      borderWidth: 1,
    },
    commentsSection: {
      flex: 1,
    },
    repliesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    repliesHeaderText: {
      fontSize: 20,
      fontWeight: '700',
    },
    emptyCommentsContainer: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyCommentsText: {
      fontSize: 15,
    },
    twitterCommentCard: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    twitterCommentContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    commentAvatarWrapper: {
      marginRight: spacing.md,
    },
    twitterCommentAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    commentContentWrapper: {
      flex: 1,
    },
    commentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    commentNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      flex: 1,
    },
    twitterCommentName: {
      fontSize: 15,
      fontWeight: '700',
    },
    twitterCommentHandle: {
      fontSize: 15,
      marginLeft: spacing.xs,
    },
    twitterCommentTime: {
      fontSize: 15,
      marginLeft: spacing.xs,
    },
    commentRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    commentActionIcon: {
      padding: spacing.xs,
    },
    replyingToText: {
      fontSize: 15,
      marginBottom: spacing.xs,
    },
    twitterCommentText: {
      fontSize: 15,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    twitterCommentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      maxWidth: 400,
    },
    twitterActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    actionCount: {
      fontSize: 13,
    },
    showRepliesButton: {
      marginTop: spacing.sm,
      marginLeft: 48 + spacing.md,
    },
    showRepliesText: {
      fontSize: 15,
      fontWeight: '600',
    },
    commentThreadRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    commentAvatarColumn: {
      alignItems: 'center',
      width: 36,
    },
    commentAvatarImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    commentAvatarFallback: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.border,
    },
    commentAvatarInitial: {
      fontWeight: '700',
      color: theme.colors.text,
    },
    commentConnector: {
      flex: 1,
      width: 1,
      backgroundColor: theme.colors.border,
      marginTop: spacing.xs,
    },
    commentBubbleCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 18,
      padding: spacing.md,
      gap: spacing.xs,
    },
    commentBubbleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    commentAuthor: {
      fontWeight: '700',
      fontSize: 14,
    },
    commentHandle: {
      fontSize: 12,
    },
    commentTimestamp: {
      fontSize: 12,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
    },
    commentActionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    commentActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs / 2,
    },
    commentActionLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    commentRepliesContainer: {
      marginTop: spacing.xs,
      paddingLeft: 48 + spacing.md,
    },
    bottomReplyContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: spacing.md,
    },
    replyingToBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    replyingToBannerText: {
      fontSize: 13,
    },
    replyInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    replyInputAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    replyInputAvatarText: {
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 32,
    },
    replyInput: {
      flex: 1,
      borderRadius: 20,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 36,
      maxHeight: 100,
      fontSize: 15,
    },
    replySendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: spacing.md,
    },
    replyBannerText: {
      color: theme.colors.text,
      fontSize: 13,
      flex: 1,
    },
    replyBannerAction: {
      color: theme.colors.primary,
      fontWeight: '600',
      marginLeft: spacing.md,
    },
    commentComposer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      minHeight: 44,
      maxHeight: 120,
    },
    commentActions: {
      marginTop: spacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    ownerActions: {
      gap: spacing.sm,
    },
    ownerActionsSpacer: {
      height: spacing.sm,
    },
    adminActions: {
      gap: spacing.sm,
    },
    adminActionsTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    suspendedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.sm,
    },
    suspendedBannerText: {
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    suspensionReasonContainer: {
      marginTop: spacing.sm,
      padding: spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      gap: spacing.xs,
    },
    suspensionReasonLabel: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    suspensionReasonText: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
