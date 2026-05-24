import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import HeaderBar from '../components/HeaderBar';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import AttachmentPicker from '../components/AttachmentPicker';
import MediaPreviewEditor from '../components/MediaPreviewEditor';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { spacing } from '../theme';
import type { RootStackParamList } from '../App';
import {
  fetchConversationMessages,
  sendConversationMessage,
  markConversationAsRead,
  ConversationMessage,
} from '../api/messages';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import type { NoticeAttachment } from '../components/TweetCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

type SelectedAttachment = {
  uri: string;
  type: 'image' | 'video';
  name?: string | null;
  mimeType?: string | null;
};

export default function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, title, noticeTitle } = route.params;
  const { theme } = useTheme();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<NoticeAttachment | null>(null);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
  const [mediaPreviewUri, setMediaPreviewUri] = useState<string | null>(null);
  const [mediaPreviewType, setMediaPreviewType] = useState<'image' | 'video' | null>(null);

  // Mark conversation as read when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const markRead = async () => {
        try {
          await markConversationAsRead(conversationId);
          // Invalidate conversations query to update badge
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        } catch (error) {
          // Silently handle errors
          console.debug('Failed to mark conversation as read:', error);
        }
      };
      markRead();
    }, [conversationId, queryClient])
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: ({ pageParam = 1 }) => fetchConversationMessages(conversationId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  const messages = useMemo(() => {
    if (!data?.pages) return [] as ConversationMessage[];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  const formatTime = useCallback((iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatAttachmentLabel = useCallback((attachmentType?: string | null) => {
    if (attachmentType === 'video') return 'Video';
    if (attachmentType === 'image') return 'Photo';
    return 'Attachment';
  }, []);

  const buildPreviewAttachment = useCallback(
    (url?: string | null, type?: string | null, name?: string | null): NoticeAttachment | null => {
      if (!url) return null;
      return {
        id: 0,
        url,
        file_type: type || undefined,
        original_name: name || undefined,
      };
    },
    [],
  );

  const getDisplayName = useCallback((user?: ConversationMessage['sender']) => {
    if (!user) return 'Unknown';
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || user.username || 'Unknown';
  }, []);

  const handleSend = useCallback(async () => {
    const value = text.trim();
    const attachment = selectedAttachment;
    const replyTarget = replyingTo;
    if (!value && !attachment) return;

    try {
      // Content moderation check
      const { moderateContent } = await import('../services/contentModeration');
      
      const imageUris = attachment && attachment.type === 'image' ? [attachment.uri] : [];
      const videoUris = attachment && attachment.type === 'video' ? [attachment.uri] : [];
      
      const moderationResult = await moderateContent({
        text: value,
        images: imageUris,
        videos: videoUris,
      });

      if (!moderationResult.isSafe) {
        Alert.alert(
          'Message Blocked',
          moderationResult.reason || 'Your message contains inappropriate content and cannot be sent. Please review our community guidelines.',
          [{ text: 'OK' }]
        );
        return;
      }

      setText('');
      setSelectedAttachment(null);
      setReplyingTo(null);

      await sendConversationMessage(conversationId, {
        content: value,
        attachment: attachment
          ? {
              uri: attachment.uri,
              type: attachment.type,
              mimeType: attachment.mimeType || undefined,
              name: attachment.name || undefined,
            }
          : undefined,
        replyToId: replyTarget?.id,
      });
      refetch();
      // Invalidate conversations cache to update badge when message is sent
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (attachment) {
        showSuccess(`${attachment.type === 'video' ? 'Video' : 'Photo'} sent!`);
      }
    } catch (error: any) {
      setText(value);
      setSelectedAttachment(attachment);
      setReplyingTo(replyTarget);
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.attachment ||
        error?.response?.data?.message ||
        'Unable to send message.';
      showError(detail);
    }
  }, [conversationId, queryClient, refetch, replyingTo, selectedAttachment, showError, showSuccess, text]);

  const setAttachmentFromAsset = useCallback((asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset?.uri) return;
    const type = asset.type === 'video' ? 'video' : 'image';
    // Show media preview editor
    setMediaPreviewUri(asset.uri);
    setMediaPreviewType(type);
  }, []);

  const handleAttachmentPress = useCallback(() => {
    setAttachmentPickerVisible(true);
  }, []);

  const openCamera = useCallback(async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos or videos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      setAttachmentFromAsset(result.assets[0]);
    }
  }, [setAttachmentFromAsset]);

  const openLibrary = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Allow media access to choose photos or videos from your library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      setAttachmentFromAsset(result.assets[0]);
    }
  }, [setAttachmentFromAsset]);

  const handleMediaPreviewConfirm = useCallback(
    (caption: string) => {
      if (!mediaPreviewUri || !mediaPreviewType) return;
      
      setSelectedAttachment({
        uri: mediaPreviewUri,
        type: mediaPreviewType,
        mimeType: mediaPreviewType === 'video' ? 'video/mp4' : 'image/jpeg',
        name: mediaPreviewUri.split('/').pop() || undefined,
      });
      
      // Clear media preview
      setMediaPreviewUri(null);
      setMediaPreviewType(null);
      
      // Add caption if provided
      if (caption.trim()) {
        setText(caption);
      }
    },
    [mediaPreviewUri, mediaPreviewType]
  );

  const handleMediaPreviewCancel = useCallback(() => {
    setMediaPreviewUri(null);
    setMediaPreviewType(null);
  }, []);

  const renderMessage = useCallback(
    ({ item, index }: { item: ConversationMessage; index: number }) => {
      const isMine = item.is_mine;
      const previous = messages[index + 1];
      const next = messages[index - 1];
      const previousSenderId = previous?.sender?.id;
      const nextSenderId = next?.sender?.id;
      const previousTime = previous ? new Date(previous.created_at).getTime() : null;
      const currentTime = new Date(item.created_at).getTime();
      const timeGap = previousTime ? Math.abs(previousTime - currentTime) : Number.MAX_SAFE_INTEGER;

      const showAvatar = !isMine && (!previous || previousSenderId !== item.sender.id || timeGap > 5 * 60 * 1000);
      const isGrouped = previous && previousSenderId === item.sender.id && timeGap <= 5 * 60 * 1000;
      const isLastInGroup = !next || nextSenderId !== item.sender.id || Math.abs(new Date(next.created_at).getTime() - currentTime) > 5 * 60 * 1000;

      const displayName = getDisplayName(item.sender);
      const reply = item.reply_to;
      const replySenderName = reply ? getDisplayName(reply.sender) : '';
      const replyLabel = reply ? reply.content?.trim() || formatAttachmentLabel(reply.attachment_type) : '';

      const attachmentType = item.attachment_type || (item.attachment_url ? 'image' : undefined);
      const hasImageAttachment = Boolean(item.attachment_url && (attachmentType === 'image' || !attachmentType));
      const hasVideoAttachment = Boolean(item.attachment_url && attachmentType === 'video');
      const showAttachment = Boolean(item.attachment_url);

      const textColor = '#000000';
      const timeColor = '#667781';

      const delivered =
        item.read_at ||
        item.readAt ||
        item.delivered_at ||
        item.deliveredAt ||
        item.is_delivered ||
        item.is_read;
      const read = item.read_at || item.readAt || item.is_read;
      const statusIcon =
        item.is_mine && (
          <MaterialCommunityIcons
            name={delivered ? 'check-all' : 'check'}
            size={14}
            color={read ? '#53BDEB' : delivered ? '#53BDEB' : '#667781'}
            style={{ marginLeft: 4 }}
          />
        );

      return (
        <View
          style={[
            styles.messageRow,
            isMine ? styles.messageRowMine : styles.messageRowTheirs,
            isGrouped && !isMine && styles.messageRowGrouped,
          ]}
        >
          {!isMine && (
            <View style={styles.avatarSlot}>
              {showAvatar ? (
                item.sender.avatar_url ? (
                  <Image source={{ uri: item.sender.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: '#E4E6EB' }]}>
                    <Text style={{ color: '#000000', fontWeight: '600', fontSize: 14 }}>
                      {(displayName || 'U').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )
              ) : null}
            </View>
          )}
          <View style={{ maxWidth: '75%', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
            {!isMine && showAvatar ? (
              <Text style={[styles.senderName, { color: '#667781' }]}>{displayName}</Text>
            ) : null}
            <Pressable
              onLongPress={() => setReplyingTo(item)}
              style={({ pressed }) => [
                styles.messageBubble,
                isMine ? styles.bubbleMine : styles.bubbleTheirs,
                isMine
                  ? {
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: isGrouped ? 4 : 12,
                      borderBottomLeftRadius: isLastInGroup ? 12 : 4,
                      borderBottomRightRadius: isGrouped ? 4 : 12,
                    }
                  : {
                      borderTopLeftRadius: isGrouped ? 4 : 12,
                      borderTopRightRadius: 12,
                      borderBottomLeftRadius: isGrouped ? 4 : 12,
                      borderBottomRightRadius: isLastInGroup ? 12 : 4,
                    },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              {reply ? (
                <Pressable
                  style={[styles.replyPreview, { borderLeftColor: isMine ? '#8BC34A' : '#53BDEB' }]}
                  onPress={() => {
                    const preview = buildPreviewAttachment(reply.attachment_url, reply.attachment_type, reply.attachment_name);
                    if (preview) setPreviewAttachment(preview);
                  }}
                  disabled={!reply.attachment_url}
                >
                  <Text style={[styles.replySender, { color: '#667781' }]} numberOfLines={1}>
                    {replySenderName}
                  </Text>
                  <Text style={[styles.replyText, { color: textColor }]} numberOfLines={2}>
                    {replyLabel}
                  </Text>
                </Pressable>
              ) : null}
              {showAttachment ? (
                <TouchableOpacity
                  onPress={() => {
                    const preview = buildPreviewAttachment(item.attachment_url, attachmentType, item.attachment_name);
                    if (preview) setPreviewAttachment(preview);
                  }}
                  onLongPress={() => setReplyingTo(item)}
                  activeOpacity={0.9}
                  style={styles.messageImageContainer}
                >
                  {hasVideoAttachment ? (
                    <>
                      <AttachmentMediaPlayer
                        uri={item.attachment_url || undefined}
                        style={styles.messageImage}
                        showControls={false}
                        contentFit="cover"
                      />
                      <View style={styles.videoBadge}>
                        <MaterialCommunityIcons name="play-circle-outline" size={26} color="#FFFFFF" />
                      </View>
                    </>
                  ) : hasImageAttachment ? (
                    <Image source={{ uri: item.attachment_url || undefined }} style={styles.messageImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.attachmentFallback}>
                      <MaterialCommunityIcons name="file-outline" size={28} color="#667781" />
                      <Text style={{ color: '#667781', marginTop: 4, fontWeight: '600' }}>
                        {formatAttachmentLabel(attachmentType)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : null}
              {item.content ? (
                <Text
                  style={[
                    styles.messageText,
                    {
                      color: textColor,
                      marginTop: reply || showAttachment ? spacing.xs : 0,
                    },
                  ]}
                >
                  {item.content}
                </Text>
              ) : null}
              <View style={styles.messageMetaRow}>
                <Text style={[styles.messageMeta, { color: timeColor }]}>
                  {formatTime(item.created_at)}
                </Text>
                {statusIcon}
              </View>
            </Pressable>
          </View>
          {isMine ? <View style={styles.avatarSlot} /> : null}
        </View>
      );
    },
    [
      buildPreviewAttachment,
      formatAttachmentLabel,
      formatTime,
      getDisplayName,
      messages,
      setPreviewAttachment,
      setReplyingTo,
    ],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const headerLeft = useMemo(
    () => (
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: spacing.md }}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
      </TouchableOpacity>
    ),
    [navigation, theme.colors.text]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#ECE5DD' }]}>
      <HeaderBar title={title || 'Conversation'} subtitle={noticeTitle || undefined} left={headerLeft} showProfileAvatar={false} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
      >
        <View style={{ flex: 1, backgroundColor: '#ECE5DD' }}>
          <FlatList
            style={[styles.list, { backgroundColor: '#ECE5DD' }]}
            data={messages}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={[styles.listContent, { paddingBottom: spacing.xl * 2 }]}
            onEndReachedThreshold={0.2}
            onEndReached={loadMore}
            ListFooterComponent={
              isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing.md }} /> : null
            }
            refreshing={isFetching}
            onRefresh={() => refetch()}
          />
          {replyingTo && (
            <View
              style={[
                styles.replyingToBanner,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyingToLabel, { color: theme.colors.muted }]}>
                  Replying to {getDisplayName(replyingTo.sender)}
                </Text>
                <Text style={[styles.replyingToText, { color: theme.colors.text }]} numberOfLines={2}>
                  {replyingTo.content?.trim() || formatAttachmentLabel(replyingTo.attachment_type)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                style={[styles.replyingToClose, { backgroundColor: theme.colors.surfaceMuted }]}
              >
                <MaterialCommunityIcons name="close" size={14} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          )}
          {selectedAttachment && (
            <View
              style={[
                styles.selectedAttachmentContainer,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {selectedAttachment.type === 'video' ? (
                <>
                  <AttachmentMediaPlayer
                    uri={selectedAttachment.uri}
                    style={styles.selectedAttachment}
                    contentFit="cover"
                    showControls={false}
                  />
                  <View style={styles.videoBadge}>
                    <MaterialCommunityIcons name="play-circle-outline" size={24} color="#FFFFFF" />
                  </View>
                </>
              ) : (
                <Image source={{ uri: selectedAttachment.uri }} style={styles.selectedAttachment} resizeMode="cover" />
              )}
              <TouchableOpacity
                onPress={() => setSelectedAttachment(null)}
                style={[styles.removeAttachmentButton, { backgroundColor: theme.colors.danger }]}
              >
                <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          <View
            style={[
              styles.composer,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow },
            ]}
          >
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.colors.surface }]}
              activeOpacity={0.7}
              onPress={handleAttachmentPress}
            >
              <MaterialCommunityIcons name="paperclip" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
            <View style={[styles.inputShell, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
              <TextInput
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, { color: theme.colors.text }]}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="center"
              />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              style={[
                styles.sendFab,
                { backgroundColor: (text.trim() || selectedAttachment) ? theme.colors.primary : theme.colors.surfaceMuted },
              ]}
              disabled={!text.trim() && !selectedAttachment}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="send"
                size={20}
                color={(text.trim() || selectedAttachment) ? theme.colors.primaryContrast : theme.colors.muted}
              />
            </TouchableOpacity>
          </View>
          <AttachmentPreviewModal
            visible={!!previewAttachment}
            attachment={previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        </View>
      </KeyboardAvoidingView>
      <AttachmentPicker
        visible={attachmentPickerVisible}
        onCamera={openCamera}
        onLibrary={openLibrary}
        onClose={() => setAttachmentPickerVisible(false)}
      />
      <MediaPreviewEditor
        visible={!!mediaPreviewUri && !!mediaPreviewType}
        uri={mediaPreviewUri || ''}
        type={mediaPreviewType || 'image'}
        onConfirm={handleMediaPreviewConfirm}
        onCancel={handleMediaPreviewCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageRowGrouped: {
    marginTop: -2,
  },
  avatarSlot: {
    width: 36,
    alignItems: 'flex-start',
    paddingBottom: 2,
  },
  messageBubble: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 3,
  },
  bubbleMine: {
    backgroundColor: '#DCF8C6',
  },
  bubbleTheirs: {
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#000000',
  },
  messageMeta: {
    fontSize: 11,
    marginTop: 3,
    marginLeft: 4,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -1 },
    shadowRadius: 3,
    elevation: 4,
    minHeight: 56,
  },
  inputShell: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.xs,
    minHeight: 40,
    maxHeight: 100,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? spacing.xs : spacing.xs,
    minHeight: 20,
  },
  sendFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    marginHorizontal: spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  senderName: {
    fontSize: 12,
    marginBottom: 3,
    marginLeft: 4,
    fontWeight: '600',
  },
  messageImageContainer: {
    width: 240,
    maxWidth: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    marginHorizontal: -12,
    marginTop: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  attachmentFallback: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F7',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    padding: 2,
  },
  replyPreview: {
    borderLeftWidth: 3.5,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    paddingRight: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
    marginHorizontal: -2,
    paddingHorizontal: spacing.sm,
  },
  replySender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
  },
  replyingToBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  replyingToLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyingToText: {
    fontSize: 14,
  },
  replyingToClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAttachmentContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    width: 120,
    height: 120,
  },
  selectedAttachment: {
    width: '100%',
    height: '100%',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
