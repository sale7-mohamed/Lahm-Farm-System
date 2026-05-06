import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axiosConfig';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { MessageSquare, Bell } from 'lucide-react';
import { ChatContext } from './ChatContext';

const MAX_RECONNECT_ATTEMPTS = 5;
const MAX_TOKEN_LENGTH = 2048;
const NORMAL_CLOSE_CODES = [1000, 1001];
const CONNECTION_DELAY_MS = 500;
const TOKEN_REFRESH_DELAY_MS = 1000;
const UNREAD_FETCH_DELAY_MS = 800;

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const wsTokenRef = useRef(null);
  const currentTokenRef = useRef(null);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const connectionAttempts = useRef(0);
  const isMounted = useRef(true);
  const initialFetchTimer = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (initialFetchTimer.current) clearTimeout(initialFetchTimer.current);
    };
  }, []);

  const isValidToken = useCallback((token) => {
    if (!token || typeof token !== 'string') return false;
    const trimmed = token.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) return false;
    try {
      const parts = trimmed.split('.');
      if (parts.length !== 3) return false;
      const base64UrlRegex = /^[A-Za-z0-9\-._~+/]+=*$/;
      return base64UrlRegex.test(parts[0]) && base64UrlRegex.test(parts[1]) && base64UrlRegex.test(parts[2]);
    } catch {
      return false;
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get('/management/chat/rooms/');
      const roomsData = res.data.results || res.data || [];
      const totalUnread = roomsData.reduce((sum, r) => sum + (r.unread_count || 0), 0);
      if (isMounted.current) {
        setUnreadCount(totalUnread);
      }
    } catch {
      // Fail silently – UI will retry on next event
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    if (initialFetchTimer.current) clearTimeout(initialFetchTimer.current);
    initialFetchTimer.current = setTimeout(() => {
      fetchUnreadCount();
    }, 500);

    const handleChatUpdate = () => {
      setTimeout(() => {
        fetchUnreadCount();
      }, UNREAD_FETCH_DELAY_MS);
    };

    const handleFocus = () => {
      fetchUnreadCount();
    };

    window.addEventListener('chat-updated', handleChatUpdate);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (initialFetchTimer.current) {
        clearTimeout(initialFetchTimer.current);
        initialFetchTimer.current = null;
      }
      window.removeEventListener('chat-updated', handleChatUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, fetchUnreadCount]);

  const cleanupWebSocket = useCallback((code = 1000, reason = 'Cleanup') => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (ws.current) {
      const socket = ws.current;
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener('open', () => socket.close(code, reason));
      } else if (socket.readyState === WebSocket.OPEN) {
        socket.close(code, reason);
      }
      ws.current = null;
    }
    connectionAttempts.current = 0;
  },[]);

  const initializeWebSocket = useCallback(
    (token) => {
      if (!isMounted.current || !user?.id || !isValidToken(token)) return;
      if (connectionAttempts.current >= MAX_RECONNECT_ATTEMPTS) return;

      if (ws.current) {
        const state = ws.current.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
      }

      cleanupWebSocket(1001, 'Reconnecting');

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/notifications/?token=${encodeURIComponent(token)}`;

      try {
        connectionAttempts.current++;
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          if (!isMounted.current) return;
          connectionAttempts.current = 0;
        };

        ws.current.onmessage = (event) => {
          if (!isMounted.current) return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'force_refresh_permissions') {
              window.dispatchEvent(new CustomEvent('needs-profile-refresh'));
              return;
            }

            if (
              data.type === 'send_notification' ||
              data.type === 'general_notification' ||
              data.type === 'chat_notification'
            ) {
              window.dispatchEvent(
                new CustomEvent('app-notification-received', { detail: data.payload })
              );
            }

            if (data.type === 'chat_notification' && data.payload && typeof data.payload === 'object') {
              const message = data.payload;
              setUnreadCount((prev) => prev + 1);
              window.dispatchEvent(new CustomEvent('chat-updated'));

              const author = message.author_name || 'مستخدم';
              const preview = message.message_preview || 'رسالة جديدة';

              toast.info(
                <div
                  onClick={() => {
                    window.location.href = '/chat';
                  }}
                  style={{ cursor: 'pointer' }}
                  className="p-2"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      window.location.href = '/chat';
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <MessageSquare size={18} />
                    <strong>{author}</strong>
                  </div>
                  <p className="mb-0 small text-truncate" style={{ maxWidth: '250px' }}>
                    {preview}
                  </p>
                </div>,
                {
                  autoClose: 5000,
                  closeButton: true,
                  position: 'bottom-left',
                  toastId: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  hideProgressBar: true,
                }
              );
            } else if (data.type === 'send_notification' || data.type === 'general_notification') {
              const payload = data.payload || {};
              toast.info(
                <div className="p-2">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <Bell size={18} className="text-primary" />
                    <strong className="text-primary">{payload.title || 'إشعار جديد'}</strong>
                  </div>
                  <p className="mb-0 small text-truncate" style={{ maxWidth: '250px' }}>
                    {payload.message}
                  </p>
                </div>,
                {
                  autoClose: 6000,
                  closeButton: true,
                  position: 'bottom-left',
                  toastId: `general-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  hideProgressBar: true,
                }
              );
            }
          } catch (error) {
            console.error('WebSocket message parsing error:', error);
          }
        };

        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.current.onclose = (event) => {
          if (!isMounted.current) return;
          if (NORMAL_CLOSE_CODES.includes(event.code)) return;

          const shouldReconnect =
            event.code !== 1000 && event.code !== 1001 && user?.id && wsTokenRef.current;
          if (!shouldReconnect) return;

          const baseDelay = 1000;
          const maxDelay = 30000;
          const delay = Math.min(baseDelay * Math.pow(2, connectionAttempts.current), maxDelay);

          reconnectTimeout.current = setTimeout(() => {
            if (isMounted.current && user?.id && wsTokenRef.current) {
              initializeWebSocket(wsTokenRef.current);
            }
          }, delay);
        };
      } catch (error) {
        console.error('WebSocket initialization error:', error);
        cleanupWebSocket();
      }
    },
    [user?.id, isValidToken, cleanupWebSocket]
  );

  const handleTokenRefresh = useCallback(
    (newToken) => {
      if (!isValidToken(newToken)) return false;
      wsTokenRef.current = newToken;

      if (currentTokenRef.current !== newToken) {
        currentTokenRef.current = newToken;
        if (ws.current && ws.current.readyState === WebSocket.OPEN && user?.id) {
          const previousState = ws.current.readyState;
          cleanupWebSocket(1001, 'Token refreshed');
          if (previousState === WebSocket.OPEN) {
            setTimeout(() => {
              if (isMounted.current && user?.id) {
                initializeWebSocket(wsTokenRef.current);
              }
            }, TOKEN_REFRESH_DELAY_MS);
          }
        }
        return true;
      }
      return false;
    },
    [user?.id, cleanupWebSocket, initializeWebSocket, isValidToken]
  );

  useEffect(() => {
    const initialToken = localStorage.getItem('staff_access_token');
    if (isValidToken(initialToken)) {
      wsTokenRef.current = initialToken;
      currentTokenRef.current = initialToken;
    }

    const handleTokenRefreshEvent = (event) => {
      if (event?.detail) handleTokenRefresh(event.detail);
    };

    const handleForceLogout = () => {
      cleanupWebSocket();
      setUnreadCount(0);
      setIsChatOpen(false);
      wsTokenRef.current = null;
      currentTokenRef.current = null;
    };

    const handleStorageChange = (e) => {
      if (e.key === 'staff_access_token') {
        if (e.newValue) handleTokenRefresh(e.newValue);
        else handleForceLogout();
      }
    };

    window.addEventListener('auth-token-refreshed', handleTokenRefreshEvent);
    window.addEventListener('force-logout', handleForceLogout);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('auth-token-refreshed', handleTokenRefreshEvent);
      window.removeEventListener('force-logout', handleForceLogout);
      window.removeEventListener('storage', handleStorageChange);
      cleanupWebSocket();
    };
  }, [cleanupWebSocket, isValidToken, handleTokenRefresh]);

  useEffect(() => {
    if (!user?.id) {
      cleanupWebSocket();
      return;
    }

    const token = wsTokenRef.current;
    if (!isValidToken(token)) {
      cleanupWebSocket();
      return;
    }

    const connectionTimer = setTimeout(() => {
      if (isMounted.current && user?.id && token === wsTokenRef.current) {
        initializeWebSocket(token);
      }
    }, CONNECTION_DELAY_MS);

    return () => {
      clearTimeout(connectionTimer);
      if (!isMounted.current) cleanupWebSocket();
    };
  }, [user?.id, initializeWebSocket, isValidToken, cleanupWebSocket]);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  }, []);

  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const openChat = useCallback(() => {
    setIsChatOpen(true);
    setUnreadCount(0);
  }, []);

  const value = {
    unreadCount,
    setUnreadCount,
    isChatOpen,
    setIsChatOpen,
    toggleChat,
    closeChat,
    openChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export default ChatProvider;

