import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import { fetchGroup, fetchGroupMessages, sendGroupMessage } from '../api/groups';
import GradientHeader from '../components/GradientHeader';

export default function GroupChatScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { id } = route.params;
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data: group } = useQuery({ queryKey: ['group', id], queryFn: () => fetchGroup(id) });
  const { data: messages, refetch } = useQuery({
    queryKey: ['group-messages', id],
    queryFn: () => fetchGroupMessages(id),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendGroupMessage(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', id] });
      setText('');
    },
  });

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [messages]);

  const { data: currentUser } = useCurrentUserProfile();
  const renderMessage = ({ item }: { item: any }) => {
    const isMe = currentUser ? item.sender?.id === currentUser.id : false;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.senderName}>{item.sender?.first_name || item.sender?.username}</Text>}
          {item.attachment_url && (
            <Image source={{ uri: item.attachment_url }} style={styles.attachment} />
          )}
          <Text style={[styles.msgText, isMe ? { color: '#FFF' } : { color: theme.colors.text }]}>{item.content}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <GradientHeader
        title={group?.name || 'Group'}
        subtitle={`${group?.member_count || 0} members`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        ref={flatListRef}
        data={[...(messages?.results || messages || [])].reverse()}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={[styles.inputBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border || '#eee' }]}>
          <TouchableOpacity style={styles.attachBtn}>
            <MaterialCommunityIcons name="paperclip" size={24} color={theme.colors.muted} />
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.background }]}
            multiline
          />
          <TouchableOpacity
            onPress={() => text.trim() && sendMutation.mutate(text.trim())}
            style={[styles.sendBtn, { backgroundColor: '#25D366' }]}
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: { flexDirection: 'row', marginBottom: 10 },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleMe: { backgroundColor: '#1877F2', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#F0F2F5', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 12, fontWeight: '700', color: '#1877F2', marginBottom: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, alignSelf: 'flex-end' },
  attachment: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  attachBtn: { padding: 8 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
