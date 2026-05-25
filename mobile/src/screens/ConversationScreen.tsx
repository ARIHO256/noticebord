import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Clipboard,
  Vibration,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import GradientHeader from '../components/GradientHeader';
import BeautifulButton from '../components/BeautifulButton';
import {
  fetchConversationMessages,
  sendConversationMessage,
  markConversationAsRead,
  reactToMessage,
  unreactFromMessage,
  ConversationMessage,
} from '../api/messages';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import type { NoticeAttachment } from '../components/TweetCard';

const { width: SCREEN_W } = Dimensions.get('window');

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '👎'];

export default function ConversationScreen({ route, navigation }: any) {
  const { conversationId, title, noticeTitle } = route.params;
  const { theme } = useTheme();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ConversationMessage | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<NoticeAttachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const replyAnim = useRef(new Animated.Value(0)).current;
  const reactionAnim = useRef(new Animated.Value(0)).current;

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

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter((m) =>
      m.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      markConversationAsRead(conversationId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }).catch(() => {});
    }, [conversationId, queryClient])
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 300);
    }
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (payload: any) => sendConversationMessage(conversationId, payload),
    onSuccess: () => {
      setText('');
      setReplyingTo(null);
      replyAnim.setValue(0);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: any) => showError(err?.userMessage || 'Failed to send message'),
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, reaction }: { messageId: number; reaction: string }) =>
      reactToMessage(messageId, reaction),
    onSuccess: () => refetch(),
  });

  const handleSend = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    sendMutation.mutate({ content: value, replyToId: replyingTo?.id || null });
  }, [text, replyingTo, sendMutation]);

  const handlePickMedia = useCallback(async (type: 'image' | 'video') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' ? ['videos'] : ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      sendMutation.mutate({
        attachment: {
          uri: result.assets[0].uri,
          type,
          mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: result.assets[0].uri.split('/').pop(),
        },
      });
    }
  }, [sendMutation]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      Vibration.vibrate(50);
    } catch {
      showError('Could not start recording');
    }
  }, [showError]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      if (uri) {
        sendMutation.mutate({
          attachment: { uri, type: 'audio', mimeType: 'audio/m4a', name: 'voice.m4a' },
        });
      }
    } catch {
      showError('Could not send voice message');
    }
  }, [sendMutation, showError]);

  const onMessageLongPress = useCallback((msg: ConversationMessage) => {
    Vibration.vibrate(30);
    setSelectedMessage(msg);
    setShowActions(true);
  }, []);

  const onReactionPress = useCallback((emoji: string) => {
    if (selectedMessage) {
      reactMutation.mutate({ messageId: selectedMessage.id, reaction: emoji });
    }
    setShowReactions(false);
    setShowActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, reactMutation]);

  const copyMessage = useCallback(() => {
    if (selectedMessage?.content) {
      Clipboard.setString(selectedMessage.content);
      showSuccess('Copied to clipboard');
    }
    setShowActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, showSuccess]);

  const deleteMessage = useCallback(() => {
    if (selectedMessage?.is_mine) {
      Alert.alert('Delete Message', 'Delete for everyone?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // API call to delete would go here
            showSuccess('Message deleted');
            refetch();
          },
        },
      ]);
    }
    setShowActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, showSuccess, refetch]);

  const formatTime = useCallback((iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const swipeReply = useCallback((msg: ConversationMessage) => {
    setReplyingTo(msg);
    Animated.spring(replyAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, [replyAnim]);

  const renderMessage = useCallback(({ item, index }: { item: ConversationMessage; index: number }) => {
    const isMine = item.is_mine;
    const next = messages[index - 1];
    const prev = messages[index + 1];
    const isGrouped = prev && prev.sender?.id === item.sender?.id;
    const isLastInGroup = !next || next.sender?.id !== item.sender?.id;

    return (
      <PanGestureHandler
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.END && nativeEvent.translationX > 50) {
            swipeReply(item);
          }
        }}
      >
        <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
          {!isMine && (
            <View style={styles.avatarSlot}>
              {(!prev || prev.sender?.id !== item.sender?.id) ? (
                item.sender?.avatar_url ? (
                  <Image source={{ uri: item.sender.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
                      {(item.sender?.first_name || item.sender?.username || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )
              ) : null}
            </View>
          )}
          <Pressable
            onLongPress={() => onMessageLongPress(item)}
            style={({ pressed }) => [
              styles.bubble,
              isMine ? [styles.bubbleMine, { backgroundColor: theme.colors.primary }] : [styles.bubbleOther, { backgroundColor: theme.colors.card }],
              pressed && { opacity: 0.85 },
            ]}
          >
            {item.reply_to && (
              <View style={[styles.replyPreview, { borderLeftColor: isMine ? '#fff' : theme.colors.primary }]}>
                <Text style={{ color: isMine ? 'rgba(255,255,255,0.7)' : theme.colors.muted, fontSize: 12, fontWeight: '700' }}>
                  {item.reply_to.sender?.first_name || item.reply_to.sender?.username}
                </Text>
                <Text style={{ color: isMine ? 'rgba(255,255,255,0.9)' : theme.colors.text, fontSize: 13 }} numberOfLines={1}>
                  {item.reply_to.content || 'Attachment'}
                </Text>
              </View>
            )}
            {item.attachment_url && (
              <TouchableOpacity onPress={() => setPreviewAttachment({ id: item.id, url: item.attachment_url as string, file_type: (item.attachment_type || undefined) as string | undefined })}>
                {item.attachment_type === 'video' ? (
                  <View style={styles.attachmentBox}>
                    <MaterialCommunityIcons name="play-circle" size={40} color="#fff" />
                  </View>
                ) : item.attachment_type === 'audio' ? (
                  <View style={[styles.attachmentBox, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <MaterialCommunityIcons name="microphone" size={24} color={isMine ? '#fff' : theme.colors.primary} />
                    <Text style={{ color: isMine ? '#fff' : theme.colors.text, fontWeight: '600' }}>Voice message</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.attachment_url }} style={styles.msgImage} resizeMode="cover" />
                )}
              </TouchableOpacity>
            )}
            {item.content ? (
              <Text style={[styles.msgText, { color: isMine ? '#fff' : theme.colors.text }]}>{item.content}</Text>
            ) : null}
            <View style={styles.msgMeta}>
              <Text style={[styles.msgTime, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.colors.muted }]}>
                {formatTime(item.created_at)}
              </Text>
              {isMine && (
                <MaterialCommunityIcons
                  name={item.read_at ? 'check-all' : 'check'}
                  size={14}
                  color={item.read_at ? '#81D4FA' : 'rgba(255,255,255,0.7)'}
                />
              )}
            </View>
            {/* Reactions */}
            {item.reactions && item.reactions.length > 0 && (
              <View style={[styles.reactionBar, { backgroundColor: theme.colors.background }]}>
                {Array.from(new Set(item.reactions.map((r: any) => r.reaction))).map((emoji: any) => (
                  <Text key={emoji} style={styles.reactionEmoji}>{emoji}</Text>
                ))}
                <Text style={[styles.reactionCount, { color: theme.colors.muted }]}>{item.reactions.length}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </PanGestureHandler>
    );
  }, [messages, theme, formatTime, onMessageLongPress, swipeReply]);

  const chatBg = theme.mode === 'dark' ? '#0B141A' : '#ECE5DD';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: chatBg }}>
        <GradientHeader
          title={isSearching ? 'Search Messages' : title || 'Chat'}
          subtitle={isSearching ? '' : noticeTitle || `${messages.length} messages`}
          onBack={() => isSearching ? setIsSearching(false) : navigation.goBack()}
          rightAction={
            isSearching ? null : (
              <TouchableOpacity onPress={() => setIsSearching(true)}>
                <MaterialCommunityIcons name="magnify" size={24} color="#fff" />
              </TouchableOpacity>
            )
          }
        />

        {isSearching && (
          <View style={[styles.searchBar, { backgroundColor: theme.colors.card }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search in conversation..."
              placeholderTextColor={theme.colors.muted}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            inverted
            data={filteredMessages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
            onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null}
          />

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <View style={[styles.typingBar, { backgroundColor: theme.colors.card }]}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.muted, marginLeft: 8, fontSize: 13 }}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </Text>
            </View>
          )}

          {/* Reply banner */}
          {replyingTo && (
            <Animated.View style={[styles.replyBanner, { backgroundColor: theme.colors.card, transform: [{ scaleY: replyAnim }] }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: '700' }}>
                  Replying to {replyingTo.sender?.first_name || replyingTo.sender?.username}
                </Text>
                <Text style={{ color: theme.colors.text, fontSize: 13 }} numberOfLines={1}>
                  {replyingTo.content || 'Attachment'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setReplyingTo(null); replyAnim.setValue(0); }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Recording bar */}
          {isRecording && (
            <View style={[styles.recordingBar, { backgroundColor: '#F44336' }]}>
              <MaterialCommunityIcons name="microphone" size={20} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '700' }}>
                Recording... {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
              </Text>
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border || '#eee' }]}>
            <TouchableOpacity onPress={() => handlePickMedia('image')} style={styles.iconBtn}>
              <MaterialCommunityIcons name="image" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handlePickMedia('video')} style={styles.iconBtn}>
              <MaterialCommunityIcons name="video" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
            <View style={[styles.textInputWrap, { backgroundColor: theme.colors.background }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.muted}
                style={[styles.textInput, { color: theme.colors.text }]}
                multiline
                maxLength={2000}
              />
            </View>
            {text.trim() ? (
              <TouchableOpacity onPress={handleSend} style={[styles.sendBtn, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onLongPress={startRecording}
                onPressOut={stopRecording}
                delayLongPress={200}
                style={[styles.sendBtn, { backgroundColor: '#F44336' }]}
              >
                <MaterialCommunityIcons name="microphone" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Message Actions Modal */}
        {showActions && selectedMessage && (
          <Pressable style={styles.overlay} onPress={() => { setShowActions(false); setSelectedMessage(null); }}>
            <View style={[styles.actionsSheet, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Message</Text>
              {selectedMessage.content ? (
                <TouchableOpacity onPress={copyMessage} style={styles.actionRow}>
                  <MaterialCommunityIcons name="content-copy" size={20} color={theme.colors.primary} />
                  <Text style={[styles.actionText, { color: theme.colors.text }]}>Copy</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => { setShowActions(false); setShowReactions(true); }} style={styles.actionRow}>
                <MaterialCommunityIcons name="emoticon-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>React</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { swipeReply(selectedMessage); setShowActions(false); }} style={styles.actionRow}>
                <MaterialCommunityIcons name="reply" size={20} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Reply</Text>
              </TouchableOpacity>
              {selectedMessage.is_mine && (
                <TouchableOpacity onPress={deleteMessage} style={styles.actionRow}>
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#F44336" />
                  <Text style={[styles.actionText, { color: '#F44336' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        )}

        {/* Reaction Picker */}
        {showReactions && (
          <Pressable style={styles.overlay} onPress={() => { setShowReactions(false); setSelectedMessage(null); }}>
            <View style={[styles.reactionPicker, { backgroundColor: theme.colors.card }]}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => onReactionPress(emoji)} style={styles.reactionBtn}>
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        )}

        {/* Attachment Preview */}
        {previewAttachment && (
          <AttachmentPreviewModal
            attachment={previewAttachment}
            visible={!!previewAttachment}
            onClose={() => setPreviewAttachment(null)}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  msgRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  avatarSlot: { width: 32, marginRight: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '76%', padding: 10, borderRadius: 16, elevation: 1 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  replyPreview: { paddingLeft: 8, borderLeftWidth: 3, marginBottom: 6 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 10, marginRight: 4 },
  msgImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 4 },
  attachmentBox: { width: 220, height: 80, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  reactionBar: { flexDirection: 'row', alignItems: 'center', position: 'absolute', bottom: -10, right: 4, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  reactionEmoji: { fontSize: 12, marginRight: 2 },
  reactionCount: { fontSize: 10, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, margin: 12, borderRadius: 14 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  typingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  recordingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1 },
  iconBtn: { padding: 6, marginRight: 2 },
  textInputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  textInput: { fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionsSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 40 },
  actionTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  actionText: { fontSize: 16, marginLeft: 16, fontWeight: '600' },
  reactionPicker: { flexDirection: 'row', alignSelf: 'center', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 100, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  reactionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
});
