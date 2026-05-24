import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../api/client';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useNotificationsWebSocket(token: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (!token || ws.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsUrl}/ws/notifications/?token=${token}`);

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        
        if (data.type === 'unread_count') {
          setUnreadCount(data.count);
        } else if (data.type === 'notification') {
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        // ignore invalid JSON
      }
    };

    socket.onclose = () => {
      setConnected(false);
      ws.current = null;
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    ws.current = socket;
  }, [token]);

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((message: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const markAsRead = useCallback((ids?: string[]) => {
    send({ action: 'mark_read', ids });
  }, [send]);

  const ping = useCallback(() => {
    send({ action: 'ping' });
  }, [send]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [connected, ping]);

  return { connected, unreadCount, lastMessage, markAsRead, send };
}

export function useConversationWebSocket(token: string | null, conversationId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);

  const connect = useCallback(() => {
    if (!token || !conversationId || ws.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsUrl}/ws/conversations/${conversationId}/?token=${token}`);

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
          setLastMessage(data.message);
        } else if (data.type === 'typing') {
          setTypingUser(data.username);
          setTimeout(() => setTypingUser(null), 3000);
        }
      } catch {
        // ignore
      }
    };

    socket.onclose = () => {
      setConnected(false);
      ws.current = null;
      setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };

    ws.current = socket;
  }, [token, conversationId]);

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((message: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const sendTyping = useCallback(() => {
    send({ action: 'typing' });
  }, [send]);

  const markMessageRead = useCallback((messageId: string) => {
    send({ action: 'message_read', message_id: messageId });
  }, [send]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, typingUser, lastMessage, sendTyping, markMessageRead };
}
