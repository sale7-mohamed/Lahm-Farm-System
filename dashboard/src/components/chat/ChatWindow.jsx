import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button, Spinner, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import axios from '../../api/axiosConfig';
import { useAuth } from '../../hooks/useAuth';
import { useHasPermission } from '../../hooks/useHasPermission';
import { Send, Trash2, Paperclip, Smile, FileText, Users, Check, CheckCheck, ArrowRight, Lock, X, MoreHorizontal, ArrowDown } from 'lucide-react';
import { toast } from 'react-toastify';
import EmojiPicker from 'emoji-picker-react';
import { useClickAway } from 'react-use';

const ExpandableMessage = ({ text, isMine }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const toggleColorClass = isMine ? 'text-light' : 'text-primary';

  if (text.length <= 300 || expanded) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', wordBreak: 'break-word' }}>
        {text}
        {text.length > 300 && (
          <div className="mt-2">
            <span
              className={`${toggleColorClass} fw-bold cursor-pointer small text-decoration-underline`}
              onClick={() => setExpanded(false)}
            >
              عرض أقل
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', wordBreak: 'break-word' }}>
      {text.substring(0, 300)}...
      <div className="mt-1">
        <span
          className={`${toggleColorClass} fw-bold cursor-pointer small text-decoration-underline`}
          onClick={() => setExpanded(true)}
        >
          عرض كل الرسالة
        </span>
      </div>
    </div>
  );
};

const ChatWindow = ({ room, targetUser, canReply, onBack, isMobile }) => {
  const { user } = useAuth();
  const canDeleteAny = useHasPermission('management.can_delete_any_message');

  const [messages, setMessages] = useState([]);
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const[previewImage, setPreviewImage] = useState(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasJumpedToUnread, setHasJumpedToUnread] = useState(false);

  const ws = useRef(null);  const reconnectTimeoutRef = useRef(null);
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const menuRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const markAsReadIfFocused = useCallback(
    (currentMsgs) => {
      const msgs = Array.isArray(currentMsgs) ? currentMsgs : messagesRef.current;
      const hasUnread = msgs.some((m) => !m.is_read && m.author_id !== user.id);
      if (document.hasFocus() && hasUnread) {
        axios
          .post(`/management/chat/rooms/${room.id}/mark-as-read/`)
          .then(() => {
            window.dispatchEvent(new CustomEvent('chat-updated'));
            setMessages((prev) =>
              prev.map((m) => (m.author_id !== user.id ? { ...m, is_read: true } : m))
            );
          })
          .catch(() => {});
      }
    },
    [room.id, user.id]
  );

  useEffect(() => {
    const handleFocus = () => markAsReadIfFocused();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [markAsReadIfFocused]);

  useClickAway(menuRef, () => setActiveMessageMenu(null));
  useClickAway(emojiPickerRef, () => setShowEmojiPicker(false));

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setIsReady(false);
    axios
      .get(`/management/chat/rooms/${room.id}/messages/`)
      .then((response) => {
        if (isMounted) {
          const loadedMessages = response.data ||[];
          setMessages(loadedMessages);

          const unread = loadedMessages.find((m) => !m.is_read && m.author_id !== user.id);
          setFirstUnreadId(unread?.id || null);
          setHasJumpedToUnread(false);

          markAsReadIfFocused(loadedMessages);
          setLoading(false);

          setTimeout(() => {
            if (unread) {
              document.getElementById('unread-marker')?.scrollIntoView({ behavior: 'instant', block: 'center' });
            } else {
              messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            }
            setTimeout(() => {
              if (isMounted) setIsReady(true);
            }, 50);
          }, 50);
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('فشل تحميل الرسائل');
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [room.id, markAsReadIfFocused, user.id]);

  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('staff_access_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const encodedToken = encodeURIComponent(token);
    const websocket = new WebSocket(
      `${wsProtocol}//${window.location.host}/ws/chat/${room.id}/?token=${encodedToken}`
    );
    ws.current = websocket;

    websocket.onopen = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    websocket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const container = chatContainerRef.current;
        const wasAtBottom = container
          ? Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) <= 50
          : true;

        switch (data.type) {
          case 'read_receipt_notification':
            setMessages((prev) =>
              prev.map((msg) =>
                data.updated_message_ids.includes(msg.id) ? { ...msg, is_read: true } : msg
              )
            );
            break;

          case 'typing':
            setIsTyping(true);
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
            break;

          case 'message_deleted':
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === data.message_id
                  ? {
                      ...msg,
                      is_deleted: true,
                      content: user.is_superuser
                        ? `${msg.content}\n\n[🗑️ حُذفت للجميع]`
                        : '🚫 تم حذف هذه الرسالة للجميع',
                      attachment: null,
                    }
                  : msg
              )
            );
            break;

          case 'message_reaction':
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg
              )
            );
            break;

          default:
            setMessages((prev) => {
              if (prev.find((m) => m.id === data.id)) {
                return prev.map((m) => (m.id === data.id ? { ...m, ...data } : m));
              }
              return [...prev, data];
            });

            if (wasAtBottom || data.author_id === user.id) {
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }

            if (document.hasFocus() && data.author_id !== user.id) {
              axios
                .post(`/management/chat/rooms/${room.id}/mark-as-read/`)
                .then(() => {
                  window.dispatchEvent(new CustomEvent('chat-updated'));
                  setMessages((prev) =>
                    prev.map((m) => (m.author_id !== user.id ? { ...m, is_read: true } : m))
                  );
                })
                .catch(() => {});
            }
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = (event) => {
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      }
    };
  }, [room.id, user.id, user.is_superuser]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (ws.current) {
        const socket = ws.current;
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.addEventListener('open', () => socket.close(1000));
        } else if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000);
        }
      }
    };
  }, [connectWebSocket]);

  const handleScroll = (e) => {
    const container = e.target;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 150);
  };

  const handleFloatingScrollClick = () => {
    const marker = document.getElementById('unread-marker');

    if (firstUnreadId && marker && !hasJumpedToUnread) {
      marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHasJumpedToUnread(true);

      axios.post(`/management/chat/rooms/${room.id}/mark-as-read/`).then(() => {
        window.dispatchEvent(new CustomEvent('chat-updated'));
        setMessages((prev) =>
          prev.map((m) => (m.author_id !== user.id ? { ...m, is_read: true } : m))
        );
      }).catch(() => {});

    } else {

      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleTyping = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'typing', user_id: user.id }));
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' && !attachment) return;

    setSending(true);
    try {
      if (attachment) {
        const formData = new FormData();
        formData.append('content', newMessage);
        formData.append('attachment', attachment);
        const response = await axios.post(
          `/management/chat/rooms/${room.id}/messages/`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setMessages((prev) =>
          prev.find((m) => m.id === response.data.id) ? prev : [...prev, response.data]
        );
        setAttachment(null);
      } else if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: 'message',
            content: newMessage,
            author_id: user.id,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        const response = await axios.post(
          `/management/chat/rooms/${room.id}/messages/`,
          { content: newMessage }
        );
        setMessages((prev) =>
          prev.find((m) => m.id === response.data.id) ? prev : [...prev, response.data]
        );
      }
      setNewMessage('');
      setShowEmojiPicker(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast.error('فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId, deleteType) => {
    try {
      await axios.delete(`/management/chat/rooms/${room.id}/messages/${messageId}/delete_message/`, {
        data: { type: deleteType },
      });
      setActiveMessageMenu(null);
      if (deleteType === 'me') {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      toast.error('فشل الحذف');
    }
  };

  const handleReaction = async (msgId, emojiStr) => {
    try {
      await axios.post(`/management/chat/rooms/${room.id}/messages/${msgId}/react/`, {
        emoji: emojiStr,
      });
      setActiveMessageMenu(null);
    } catch {''}
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const groupedMessages = messages.reduce((groups, msg) => {
    const dateObj = new Date(msg.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateString = '';
    if (dateObj.toDateString() === today.toDateString()) {
      dateString = 'اليوم';
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      dateString = 'أمس';
    } else {
      dateString = dateObj.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    if (!groups[dateString]) groups[dateString] = [];
    groups[dateString].push(msg);
    return groups;
  }, {});

  let roomTitle = room.name;
  let roomSubtitle = '';
  let headerAvatar = <Users size={24} />;

  if (room.room_type === 'DIRECT') {
    const others = room.participants.filter((p) => p.id !== user.id);
    if (targetUser?.full_name) {
      roomTitle = targetUser.full_name;
      roomSubtitle = `${targetUser.department_name || 'بدون قسم'} • ${
        targetUser.role_name || 'موظف'
      }`;
      headerAvatar = targetUser.full_name.charAt(0);
    } else if (others.length === 1) {
      roomTitle = others[0].full_name;
      roomSubtitle = `${others[0].department_name || 'بدون قسم'} • ${
        others[0].role_name || 'موظف'
      }`;
      headerAvatar = others[0].full_name.charAt(0);
    } else if (others.length > 1 && user.is_superuser) {
      roomTitle = others.map((p) => p.full_name.split(' ')[0]).join(' ↔ ');
      roomSubtitle = 'محادثة خاصة (مراقبة)';
      headerAvatar = '👀';
    } else {
      roomTitle = 'ملاحظاتي الشخصية';
      headerAvatar = 'م';
    }
  } else {
    roomTitle = room.name || 'مجموعة عمل';
    roomSubtitle = `${room.participants.length} مشارك`;
  }

  return (
    <div className="d-flex flex-column h-100 position-relative w-100" style={{ overflow: 'hidden' }}>
      <div className="chat-header p-3 border-bottom bg-white d-flex align-items-center z-2 shadow-sm w-100">
        {isMobile && (
          <Button variant="link" className="p-0 text-dark me-3" onClick={onBack}>
            <ArrowRight size={24} />
          </Button>
        )}
        <div
          className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold me-3 flex-shrink-0"
          style={{ width: 45, height: 45, fontSize: '18px' }}
        >
          {headerAvatar}
        </div>
        <div className="overflow-hidden">
          <h6 className="mb-0 fw-bold text-dark text-truncate">{roomTitle}</h6>
          {isTyping ? (
            <small className="text-primary fw-bold">يكتب الآن...</small>
          ) : (
            <small className="text-muted fw-bold text-truncate d-block">{roomSubtitle}</small>
          )}
        </div>
      </div>

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-grow-1 p-3 d-flex flex-column w-100"
        style={{
          backgroundColor: '#e5ddd5',
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
           className="d-flex flex-column gap-3 w-100 flex-grow-1"
           style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}
        >
        {loading ? (
          <div className="text-center mt-5">
            <Spinner animation="border" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center m-auto bg-white p-3 rounded-4 shadow-sm opacity-75">
            <p className="text-muted mb-0 fw-bold">لا توجد رسائل سابقة. ابدأ المحادثة!</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([dateLabel, msgs], idx) => (
            <React.Fragment key={`date-${idx}`}>
              <div className="text-center my-3 position-sticky" style={{ top: '10px', zIndex: 10 }}>
                <span className="bg-white px-3 py-1 rounded-pill shadow text-muted small fw-bold border">
                  {dateLabel}
                </span>
              </div>

              {msgs.map((msg) => {
                const isMine = msg.author_id === user.id;
                const isDeleted = msg.is_deleted;
                const isFirstUnread = msg.id === firstUnreadId;
                const canDeleteForEveryone = (!isDeleted && isMine) || (user.is_superuser && canDeleteAny);

                const aggregatedReactions = {};
                if (msg.reactions) {
                  Object.values(msg.reactions).forEach((data) => {
                    const emoji = typeof data === 'object' ? data.emoji : data;
                    const name = typeof data === 'object' ? data.name : 'موظف';
                    if (!aggregatedReactions[emoji]) aggregatedReactions[emoji] = [];
                    aggregatedReactions[emoji].push(name);
                  });
                }

                return (
                  <React.Fragment key={`msg-${msg.id}`}>
                    {isFirstUnread && (
                      <div id="unread-marker" className="text-center my-2 position-relative w-100">
                        <hr className="text-danger opacity-25" />
                        <span className="position-absolute top-50 start-50 translate-middle bg-danger text-white px-3 py-1 rounded-pill small fw-bold shadow-sm">
                          👇 رسائل جديدة 👇
                        </span>
                      </div>
                    )}
                    <div className={`d-flex w-100 ${isMine ? 'justify-content-start' : 'justify-content-end'}`}>
                      <div
                        className={`p-2 px-3 shadow-sm position-relative ${
                          isMine ? 'bg-primary text-white' : 'bg-white text-dark'
                        }`}
                        style={{
                          maxWidth: isMobile ? '90%' : '75%',
                          borderRadius: '16px',
                          borderTopRightRadius: isMine ? '4px' : '16px',
                          borderTopLeftRadius: !isMine ? '4px' : '16px',
                        }}
                      >
                        {!isMine && room.room_type !== 'DIRECT' && (
                          <div className="fw-bold small mb-1" style={{ color: '#005c4b' }}>
                            {msg.author?.full_name}
                          </div>
                        )}

                        {msg.attachment && !isDeleted && (
                          <div className="mb-2">
                            {msg.attachment.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                              <img
                                src={msg.attachment}
                                className="img-fluid rounded shadow-sm border"
                                style={{
                                  maxHeight: 200,
                                  maxWidth: '100%',
                                  objectFit: 'cover',
                                  cursor: 'zoom-in',
                                }}
                                alt="مرفق"
                                onClick={() => setPreviewImage(msg.attachment)}
                              />
                            ) : (
                              <a
                                href={msg.attachment}
                                target="_blank"
                                rel="noreferrer"
                                className={`btn btn-sm ${
                                  isMine ? 'btn-light text-primary' : 'btn-primary text-white'
                                } d-flex align-items-center gap-1 fw-bold`}
                              >
                                <FileText size={16} /> عرض الملف
                              </a>
                            )}
                          </div>
                        )}

                        <div className={isDeleted ? 'fst-italic opacity-75' : ''}>
                          <ExpandableMessage text={msg.content} isMine={isMine} />
                        </div>

                        {Object.keys(aggregatedReactions).length > 0 && (
                          <div className="d-flex flex-wrap gap-1 mt-1 bg-light bg-opacity-25 rounded-pill p-1 w-fit">
                            {Object.entries(aggregatedReactions).map(([emoji, names]) => (
                              <OverlayTrigger
                                key={emoji}
                                placement="top"
                                overlay={<Tooltip>{names.join('، ')}</Tooltip>}
                              >
                                <span
                                  className={`bg-white rounded-pill px-2 border shadow-sm ${
                                    isMine ? 'text-dark' : ''
                                  }`}
                                  style={{ fontSize: '12px', cursor: 'pointer' }}
                                  onClick={() => handleReaction(msg.id, emoji)}
                                >
                                  {emoji} <span className="text-muted ms-1">{names.length}</span>
                                </span>
                              </OverlayTrigger>
                            ))}
                          </div>
                        )}

                        <div
                          className={`d-flex align-items-center justify-content-end gap-1 mt-1 ${
                            isMine ? 'text-white-50' : 'text-muted'
                          }`}
                          style={{ fontSize: '11px' }}
                        >
                          <span dir="ltr" className="fw-bold">
                            {formatTime(msg.timestamp)}
                          </span>
                          {isMine && !isDeleted &&
                            (msg.is_read ? (
                              <CheckCheck size={14} color={isMine ? '#fff' : '#4fc3f7'} />
                            ) : (
                              <Check size={14} />
                            ))}

                          <div className="position-relative ms-1">
                            <button
                              className="btn btn-sm p-0 border-0 shadow-none text-inherit opacity-75"
                              onClick={() =>
                                setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)
                              }
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {activeMessageMenu === msg.id && (
                              <div
                                ref={menuRef}
                                className="position-absolute bg-white border rounded shadow-lg p-2 z-3 d-flex flex-column gap-2"
                                style={{
                                  bottom: '100%',
                                  [isMine ? 'right' : 'left']: 0,
                                  minWidth: '220px',
                                  maxWidth: '85vw',
                                }}
                              >
                                {!isDeleted && (
                                  <div className="d-flex justify-content-between border-bottom pb-2 flex-wrap gap-1">
                                    {['👍', '❤️', '😂', '😮', '😢'].map((emj) => (
                                      <span
                                        key={emj}
                                        className="fs-5 cursor-pointer px-1 text-dark hover-scale transition-transform"
                                        onClick={() => handleReaction(msg.id, emj)}
                                      >
                                        {emj}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <button
                                  className="btn btn-sm btn-outline-secondary text-start w-100 fw-bold d-flex align-items-center"
                                  onClick={() => handleDelete(msg.id, 'me')}
                                >
                                  <Trash2 size={14} className="me-2 text-secondary" /> حذف لدي فقط
                                </button>

                                {canDeleteForEveryone && (
                                  <button
                                    className="btn btn-sm btn-outline-danger text-start w-100 fw-bold d-flex align-items-center"
                                    onClick={() => handleDelete(msg.id, 'everyone')}
                                  >
                                    <Trash2 size={14} className="me-2 text-danger" /> حذف لدى الجميع
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))
        )}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
        </div>
      </div>

      <div className="p-3 bg-white border-top position-relative z-3 shadow-sm w-100">
        {showScrollButton && (
          <button
            onClick={handleFloatingScrollClick}
            className="btn btn-white rounded-circle shadow-lg d-flex align-items-center justify-content-center position-absolute p-0"
            style={{
              top: '-60px',
              right: '20px',
              width: '45px',
              height: '45px',
              zIndex: 100,
              backgroundColor: 'white',
              border: '1px solid #dee2e6'
            }}
          >
            <ArrowDown size={24} className="text-primary" />
            {firstUnreadId && !hasJumpedToUnread && (
              <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-white rounded-circle" />
            )}
          </button>
        )}
        {!canReply ? (
          <div className="text-center py-2 px-3 text-danger fw-bold bg-danger bg-opacity-10 rounded-3 d-flex align-items-center justify-content-center gap-2">
            <Lock size={18} />
            غير مسموح لك بالرد في هذه المحادثة. (للقراءة فقط)
          </div>
        ) : (
          <>
            {attachment && (
              <div className="mb-3 p-3 bg-light border rounded d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  {attachment.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(attachment)}
                      alt="preview"
                      style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <div className="p-2 bg-white border rounded text-primary">
                      <FileText size={24} />
                    </div>
                  )}
                  <span className="small text-truncate fw-bold text-dark" style={{ maxWidth: '180px' }}>
                    {attachment.name}
                  </span>
                </div>
                <Button
                  variant="link"
                  className="p-0 text-danger bg-white rounded-circle shadow-sm p-1"
                  onClick={() => setAttachment(null)}
                >
                  <X size={18} />
                </Button>
              </div>
            )}

            <Form onSubmit={sendMessage} className="d-flex align-items-end gap-2 w-100">
              <div className="bg-light rounded-4 flex-grow-1 d-flex align-items-center px-2 border position-relative">
                <div ref={emojiPickerRef}>
                  <Button
                    variant="link"
                    className="text-muted p-2"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile size={24} />
                  </Button>
                  {showEmojiPicker && (
                    <div
                      className="position-absolute bottom-100 end-0 mb-3 shadow-lg rounded-4 overflow-hidden z-3"
                      style={{ maxWidth: '100vw' }}
                    >
                      <EmojiPicker
                        onEmojiClick={(e) => {
                          setNewMessage((p) => p + e.emoji);
                          inputRef.current?.focus();
                        }}
                        searchDisabled
                        skinTonesDisabled
                        width={isMobile ? 300 : 350}
                        height={400}
                      />
                    </div>
                  )}
                </div>

                <Form.Control
                  ref={inputRef}
                  as="textarea"
                  rows={1}
                  placeholder="اكتب رسالة..."
                  className="border-0 bg-transparent shadow-none py-3 custom-scrollbar fw-bold w-100"
                  style={{ resize: 'none', maxHeight: '120px' }}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                />

                <label className="text-muted p-2 mb-0 cursor-pointer transition-colors hover-text-primary">
                  <Paperclip size={22} />
                  <input type="file" hidden onChange={(e) => setAttachment(e.target.files[0])} />
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="rounded-circle p-0 d-flex align-items-center justify-content-center shadow flex-shrink-0"
                style={{ width: 50, height: 50 }}
                disabled={sending || (!newMessage.trim() && !attachment)}
              >
                {sending ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <Send size={22} style={{ transform: 'scaleX(-1)' }} className="me-1" />
                )}
              </Button>
            </Form>
          </>
        )}
      </div>

      <Modal
        show={!!previewImage}
        onHide={() => setPreviewImage(null)}
        centered
        size="lg"
        contentClassName="bg-transparent border-0"
      >
        <Modal.Body className="text-center p-0 position-relative">
          <Button
            variant="dark"
            className="position-absolute top-0 end-0 m-2 rounded-circle"
            onClick={() => setPreviewImage(null)}
            style={{ zIndex: 1050 }}
          >
            <X size={20} />
          </Button>
          <img
            src={previewImage}
            className="img-fluid rounded shadow"
            alt="Preview"
            style={{ maxHeight: '85vh', maxWidth: '100%', objectFit: 'contain' }}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ChatWindow;
