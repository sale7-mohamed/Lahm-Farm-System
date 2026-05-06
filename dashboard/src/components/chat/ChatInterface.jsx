import React, { useState, useEffect, useCallback } from 'react';
import axios from '../../api/axiosConfig';
import { toast } from 'react-toastify';
import {
  Row,
  Col,
  ListGroup,
  Spinner,
  Button,
  Card,
  Badge,
  InputGroup,
  Form,
  Offcanvas,
  Navbar,
  Container
} from 'react-bootstrap';
import {
  PlusCircle,
  Users,
  MessageSquare,
  Search,
  X,
  Menu,
  ChevronLeft,
  UserPlus
} from 'lucide-react';
import ChatWindow from './ChatWindow';
import NewChatModal from './NewChatModal';
import { useAuth } from '../../hooks/useAuth';

const ChatInterface = () => {
    const [rooms, setRooms] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [roomsRes, employeesRes] = await Promise.all([
                axios.get('/management/chat/rooms/'),
                axios.get('/management/employees/')
            ]);
            setRooms(roomsRes.data.results || []);
            setEmployees(employeesRes.data.results || []);
        } catch (error) {
            console.error('فشل تحميل بيانات الشات:', error);
            toast.error('فشل تحميل بيانات الشات.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) {
                setShowSidebar(false);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleChatCreated = (newRoom) => {
        setRooms(prev => [newRoom, ...prev]);
        setSelectedRoom(newRoom);
        if (isMobile) {
            setShowSidebar(false);
        }
    };

    const handleSelectRoom = (room) => {
        setSelectedRoom(room);
        if (isMobile) {
            setShowSidebar(false);
        }
    };

    const getRoomDisplayName = (room) => {
        if (room.name) return room.name;
        if (room.participants.length <= 2) {
            const otherUser = room.participants.find(p => p.id !== user.id);
            return otherUser ? otherUser.full_name : 'محادثة شخصية';
        }
        return `مجموعة (${room.participants.length})`;
    };

    const getRoomPreview = (room) => {
        const message = room.latest_message?.content;
        if (!message) return '...';
        return message.length > 30 ? `${message.substring(0, 30)}...` : message;
    };

    const filteredRooms = rooms.filter(room => {
        if (!searchTerm) return true;

        const roomName = getRoomDisplayName(room).toLowerCase();
        const participantsNames = room.participants
            .map(p => p.full_name.toLowerCase())
            .join(' ');

        return roomName.includes(searchTerm.toLowerCase()) ||
               participantsNames.includes(searchTerm.toLowerCase());
    });

    const MobileHeader = () => (
        <Navbar className="bg-white border-bottom d-md-none p-2" fixed="top">
            <Container fluid>
                <div className="d-flex justify-content-between align-items-center w-100">
                    {selectedRoom ? (
                        <>
                            <Button
                                variant="link"
                                className="p-0"
                                onClick={() => setShowSidebar(true)}
                                style={{ minHeight: '44px', minWidth: '44px' }}
                            >
                                <ChevronLeft size={24} />
                            </Button>
                            <div className="text-center flex-grow-1 mx-2">
                                <div className="fw-bold text-truncate">{getRoomDisplayName(selectedRoom)}</div>
                                <small className="text-muted">
                                    {selectedRoom.participants.length} مشارك
                                </small>
                            </div>
                            <Button
                                variant="link"
                                className="p-0"
                                onClick={() => setShowSidebar(false)}
                                style={{ minHeight: '44px', minWidth: '44px' }}
                            >
                                <Menu size={24} />
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="fw-bold">المحادثات</div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowNewChatModal(true)}
                                style={{ minHeight: '44px' }}
                            >
                                <UserPlus size={16} />
                            </Button>
                        </>
                    )}
                </div>
            </Container>
        </Navbar>
    );

    const SidebarContent = () => (
        <>
            <div className="p-3 border-bottom">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">المحادثات</h5>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowNewChatModal(true)}
                        style={{ minHeight: '44px' }}
                    >
                        <PlusCircle size={16} className="me-1" /> جديد
                    </Button>
                </div>

                <InputGroup>
                    <InputGroup.Text>
                        <Search size={16} />
                    </InputGroup.Text>
                    <Form.Control
                        placeholder="ابحث في المحادثات..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ fontSize: '16px' }}
                    />
                </InputGroup>
            </div>

            {loading ? (
                <div className="text-center p-5 flex-grow-1">
                    <Spinner animation="border" />
                    <p className="mt-2">جاري تحميل المحادثات...</p>
                </div>
            ) : filteredRooms.length === 0 ? (
                <div className="text-center p-5 flex-grow-1">
                    <MessageSquare size={48} className="text-muted mb-3" />
                    <p className="text-muted">لا توجد محادثات</p>
                    {searchTerm && (
                        <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setSearchTerm('')}
                        >
                            عرض الكل
                        </Button>
                    )}
                </div>
            ) : (
                <div style={{ overflowY: 'auto', height: 'calc(100vh - 180px)' }}>
                    <ListGroup variant="flush">
                        {filteredRooms.map(room => (
                            <ListGroup.Item
                                key={room.id}
                                action
                                active={selectedRoom?.id === room.id}
                                onClick={() => handleSelectRoom(room)}
                                className="py-3"
                                style={{
                                    borderLeft: selectedRoom?.id === room.id ? '4px solid #0d6efd' : '4px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1 me-2">
                                        <div className="fw-bold text-truncate mb-1">
                                            {getRoomDisplayName(room)}
                                        </div>
                                        <div className="d-flex align-items-center">
                                            <small className="text-muted text-truncate me-2">
                                                {getRoomPreview(room)}
                                            </small>
                                            {room.unread_count > 0 && (
                                                <Badge pill bg="danger" className="me-1">
                                                    {room.unread_count > 9 ? '9+' : room.unread_count}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <small className="text-muted d-block">
                                            {room.latest_message?.created_at &&
                                                new Date(room.latest_message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </small>
                                        <small className="text-muted">
                                            {room.participants.length} <Users size={12} />
                                        </small>
                                    </div>
                                </div>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                </div>
            )}
        </>
    );

    return (
        <div className="h-100">
            {/* Mobile Header */}
            <MobileHeader />

            {/* Desktop Layout */}
            <Row className="g-0 h-100 d-none d-md-flex">
                <Col md={4} className="border-end d-flex flex-column h-100 bg-white">
                    <SidebarContent />
                </Col>
                <Col md={8} className="d-flex flex-column h-100">
                    {selectedRoom ? (
                        <ChatWindow
                            room={selectedRoom}
                            key={selectedRoom.id}
                            onBack={() => setSelectedRoom(null)}
                        />
                    ) : (
                        <div className="d-flex h-100 flex-column justify-content-center align-items-center text-muted bg-light">
                            <MessageSquare size={64} className="mb-3 opacity-50" />
                            <h5 className="mb-2">مرحباً بك في المحادثات</h5>
                            <p className="text-center mb-4">اختر محادثة لعرضها أو ابدأ محادثة جديدة</p>
                            <Button
                                variant="primary"
                                onClick={() => setShowNewChatModal(true)}
                            >
                                <PlusCircle size={18} className="me-2" />
                                بدء محادثة جديدة
                            </Button>
                        </div>
                    )}
                </Col>
            </Row>

            {/* Mobile Layout */}
            <div className="d-md-none" style={{ height: 'calc(100vh - 56px)', paddingTop: '56px' }}>
                {/* Sidebar for Mobile */}
                <Offcanvas
                    show={showSidebar}
                    onHide={() => setShowSidebar(false)}
                    placement="start"
                    className="w-100"
                    style={{ maxWidth: '400px' }}
                >
                    <Offcanvas.Header closeButton>
                        <Offcanvas.Title>المحادثات</Offcanvas.Title>
                    </Offcanvas.Header>
                    <Offcanvas.Body className="p-0">
                        <SidebarContent />
                    </Offcanvas.Body>
                </Offcanvas>

                {/* Chat Content for Mobile */}
                <div className="h-100">
                    {selectedRoom ? (
                        <ChatWindow
                            room={selectedRoom}
                            key={selectedRoom.id}
                            onBack={() => setSelectedRoom(null)}
                            isMobile={true}
                        />
                    ) : (
                        <div className="d-flex h-100 flex-column justify-content-center align-items-center text-muted p-4">
                            <MessageSquare size={64} className="mb-3 opacity-50" />
                            <h5 className="mb-2">لا توجد محادثة مختارة</h5>
                            <p className="text-center mb-4">
                                اختر محادثة من القائمة أو ابدأ محادثة جديدة
                            </p>
                            <Button
                                variant="primary"
                                onClick={() => setShowNewChatModal(true)}
                                className="mb-3"
                                style={{ minHeight: '44px' }}
                            >
                                <PlusCircle size={18} className="me-2" />
                                محادثة جديدة
                            </Button>
                            <Button
                                variant="outline-primary"
                                onClick={() => setShowSidebar(true)}
                                style={{ minHeight: '44px' }}
                            >
                                عرض جميع المحادثات
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* New Chat Modal */}
            <NewChatModal
                show={showNewChatModal}
                handleClose={() => setShowNewChatModal(false)}
                onChatCreated={handleChatCreated}
                employees={employees}
            />

            {/* CSS Styles */}
            <style>{`
                .list-group-item.active {
                    background-color: #e7f1ff;
                    border-color: #dee2e6;
                    color: #0a58ca;
                }

                @media (max-width: 768px) {
                    .offcanvas-body {
                        padding: 0;
                    }
                }

                /* Better touch targets */
                button, .btn, .list-group-item {
                    min-height: 44px;
                }

                /* Smooth transitions */
                .list-group-item {
                    transition: all 0.2s ease;
                }

                /* Hide scrollbar but keep functionality */
                .list-group {
                    scrollbar-width: thin;
                    scrollbar-color: #dee2e6 transparent;
                }

                .list-group::-webkit-scrollbar {
                    width: 4px;
                }

                .list-group::-webkit-scrollbar-track {
                    background: transparent;
                }

                .list-group::-webkit-scrollbar-thumb {
                    background-color: #dee2e6;
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
};

export default ChatInterface;
