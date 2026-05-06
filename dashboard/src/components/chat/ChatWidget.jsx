import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Badge, Card, Offcanvas } from 'react-bootstrap';
import { MessageSquare, X, Maximize2, Minimize2 } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import ChatInterface from './ChatInterface';

const ChatWidget = () => {
    const { isChatOpen, toggleChat, unreadCount } = useChat();
    const [isExpanded, setIsExpanded] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const widgetRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile && isExpanded) {
                setIsExpanded(false);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [isExpanded]);

    const handleMouseDown = (e) => {
        if (isMobile || !isChatOpen) return;

        setIsDragging(true);
        const rect = widgetRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !isChatOpen || isMobile) return;

        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        const maxX = window.innerWidth - (isExpanded ? 800 : 400);
        const maxY = window.innerHeight - (isExpanded ? 600 : 400);

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        });
    }, [isDragging, isChatOpen, isMobile, isExpanded, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleToggleExpand = () => {
        setIsExpanded(!isExpanded);
        if (isExpanded) {
            setPosition({ x: 20, y: 20 });
        }
    };

    const MobileChat = () => (
        <Offcanvas
            show={isChatOpen}
            onHide={toggleChat}
            placement="bottom"
            className="h-75"
            style={{ borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}
        >
            <Offcanvas.Header closeButton className="border-bottom">
                <Offcanvas.Title className="d-flex align-items-center">
                    <MessageSquare size={20} className="me-2" />
                    المحادثات
                    {unreadCount > 0 && (
                        <Badge pill bg="danger" className="ms-2">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="p-0">
                <ChatInterface />
            </Offcanvas.Body>
        </Offcanvas>
    );

    const DesktopChat = () => {
        if (!isChatOpen) return null;

        return (
            <Card
                ref={widgetRef}
                className="shadow-lg position-fixed border-0"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    width: isExpanded ? '800px' : '400px',
                    height: isExpanded ? '600px' : '500px',
                    zIndex: 1049,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : 'default',
                    transition: isDragging ? 'none' : 'all 0.3s ease'
                }}
            >
                <Card.Header
                    className="d-flex justify-content-between align-items-center p-3 bg-primary text-white"
                    onMouseDown={handleMouseDown}
                    style={{ cursor: 'move' }}
                >
                    <div className="d-flex align-items-center">
                        <MessageSquare size={20} className="me-2" />
                        <h6 className="mb-0">المحادثات</h6>
                        {unreadCount > 0 && (
                            <Badge pill bg="light" text="dark" className="ms-2">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Badge>
                        )}
                    </div>
                    <div className="d-flex gap-2">
                        <Button
                            variant="link"
                            className="p-0 text-white"
                            onClick={handleToggleExpand}
                        >
                            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </Button>
                        <Button
                            variant="link"
                            className="p-0 text-white"
                            onClick={toggleChat}
                        >
                            <X size={20} />
                        </Button>
                    </div>
                </Card.Header>
                <Card.Body className="p-0 flex-grow-1">
                    <ChatInterface />
                </Card.Body>
            </Card>
        );
    };

    return (
        <>
            {/* Floating Button */}
            <Button
                variant="primary"
                className="rounded-circle position-fixed d-flex align-items-center justify-content-center shadow-lg"
                style={{
                    bottom: '20px',
                    left: '20px',
                    width: isMobile ? '56px' : '64px',
                    height: isMobile ? '56px' : '64px',
                    zIndex: 1050,
                    transition: 'all 0.3s ease'
                }}
                onClick={toggleChat}
            >
                <MessageSquare size={isMobile ? 24 : 28} />
                {!isChatOpen && unreadCount > 0 && (
                    <Badge
                        pill
                        bg="danger"
                        className="position-absolute top-0 start-100 translate-middle"
                        style={{
                            fontSize: '10px',
                            minWidth: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                )}
            </Button>

            {/* Chat Window */}
            {isMobile ? <MobileChat /> : <DesktopChat />}

            {/* CSS Styles */}
            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }

                .btn-primary:hover {
                    animation: bounce 0.5s ease;
                }

                /* Smooth transitions */
                .card {
                    transition: all 0.3s ease;
                }

                /* Better touch targets */
                button, .btn {
                    min-height: 44px;
                }

                @media (max-width: 768px) {
                    .offcanvas-bottom {
                        border-top-left-radius: 20px;
                        border-top-right-radius: 20px;
                    }

                    .offcanvas-header {
                        padding: 1rem 1.5rem;
                    }
                }
            `}</style>
        </>
    );
};

export default ChatWidget;
