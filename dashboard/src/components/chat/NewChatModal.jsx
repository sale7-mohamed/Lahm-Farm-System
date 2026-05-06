import React, { useState, useMemo } from 'react';
import axios from '../../api/axiosConfig';
import { toast } from 'react-toastify';
import {
  Modal,
  Button,
  Form,
  Badge,
  InputGroup,
  ListGroup,
  Card
} from 'react-bootstrap';
import {
  X,
  Search,
  UserPlus,
  Users,
  Check,
  Hash
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NewChatModal = ({ show, handleClose, onChatCreated, employees }) => {
    const { user } = useAuth();
    const [selectedParticipants, setSelectedParticipants] = useState([]);
    const [roomName, setRoomName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSelectParticipant = (participant) => {
        if (selectedParticipants.some(p => p.id === participant.id)) {
            setSelectedParticipants(prev => prev.filter(p => p.id !== participant.id));
        } else {
            setSelectedParticipants(prev => [...prev, participant]);
        }
    };

    const handleRemoveParticipant = (participantId) => {
        setSelectedParticipants(prev => prev.filter(p => p.id !== participantId));
    };

    const handleCreate = async () => {
        if (selectedParticipants.length === 0) {
            toast.warn('يرجى اختيار موظف واحد على الأقل.');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/management/chat/rooms/', {
                name: roomName,
                participants_ids: selectedParticipants.map(p => p.id)
            });
            toast.success('تم إنشاء المحادثة بنجاح!');
            onChatCreated(response.data);
            handleClose();
            resetForm();
        } catch (error) {
            console.error('فشل إنشاء المحادثة:', error);
            toast.error('فشل إنشاء المحادثة.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedParticipants([]);
        setRoomName('');
        setSearchTerm('');
    };

    const handleCloseModal = () => {
        resetForm();
        handleClose();
    };

    const availableEmployees = useMemo(() => {
        return employees.filter(emp =>
            emp.id !== user.id &&
            emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, user.id, searchTerm]);

    const EmployeeCard = ({ employee, isSelected }) => (
        <Card className="border-0 shadow-sm mb-2">
            <Card.Body className="p-3">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <div className="position-relative me-3">
                            <div className="avatar-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                <Users size={20} />
                            </div>
                            {employee.is_online && (
                                <div className="position-absolute bottom-0 end-0 bg-success rounded-circle" style={{ width: '12px', height: '12px', border: '2px solid white' }} />
                            )}
                        </div>
                        <div>
                            <div className="fw-bold">{employee.full_name}</div>
                            <small className="text-muted">{employee.role?.name || 'موظف'}</small>
                        </div>
                    </div>
                    <Button
                        variant={isSelected ? "primary" : "outline-primary"}
                        size="sm"
                        onClick={() => handleSelectParticipant(employee)}
                        style={{ minHeight: '36px', minWidth: '36px' }}
                    >
                        {isSelected ? <Check size={16} /> : <UserPlus size={16} />}
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );

    return (
        <Modal
            show={show}
            onHide={handleCloseModal}
            centered
            size="lg"
            backdrop="static"
        >
            <Modal.Header closeButton className="border-bottom-0">
                <Modal.Title className="text-center w-100">
                    <UserPlus size={24} className="me-2" />
                    بدء محادثة جديدة
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Room Name */}
                <Form.Group className="mb-4">
                    <Form.Label>
                        <Hash size={16} className="me-2 text-muted" />
                        اسم المجموعة (اختياري)
                    </Form.Label>
                    <Form.Control
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="أدخل اسم للمحادثة الجماعية"
                        style={{ fontSize: '16px' }}
                    />
                    <Form.Text className="text-muted">
                        اتركه فارغاً لاستخدام أسماء المشاركين تلقائياً
                    </Form.Text>
                </Form.Group>

                {/* Selected Participants */}
                {selectedParticipants.length > 0 && (
                    <div className="mb-4">
                        <Form.Label>المشاركون المختارون ({selectedParticipants.length})</Form.Label>
                        <div className="d-flex flex-wrap gap-2 p-3 bg-light rounded">
                            {selectedParticipants.map(participant => (
                                <Badge
                                    key={participant.id}
                                    pill
                                    bg="primary"
                                    className="d-flex align-items-center p-2"
                                    style={{ fontSize: '14px' }}
                                >
                                    <Users size={14} className="me-2" />
                                    {participant.full_name}
                                    <X
                                        size={14}
                                        className="ms-2"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleRemoveParticipant(participant.id)}
                                    />
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search and Employee List */}
                <Form.Group className="mb-3">
                    <Form.Label>اختر المشاركين</Form.Label>
                    <InputGroup className="mb-3">
                        <InputGroup.Text>
                            <Search size={16} />
                        </InputGroup.Text>
                        <Form.Control
                            type="text"
                            placeholder="ابحث عن موظف..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ fontSize: '16px' }}
                        />
                    </InputGroup>

                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {availableEmployees.length === 0 ? (
                            <div className="text-center py-4 text-muted">
                                <Users size={48} className="mb-3 opacity-50" />
                                <p>لم يتم العثور على موظفين</p>
                            </div>
                        ) : (
                            <ListGroup variant="flush">
                                {availableEmployees.map(employee => {
                                    const isSelected = selectedParticipants.some(p => p.id === employee.id);
                                    return (
                                        <ListGroup.Item
                                            key={employee.id}
                                            className="border-0 p-0 mb-2"
                                        >
                                            <EmployeeCard
                                                employee={employee}
                                                isSelected={isSelected}
                                            />
                                        </ListGroup.Item>
                                    );
                                })}
                            </ListGroup>
                        )}
                    </div>
                </Form.Group>

                {/* Summary */}
                {selectedParticipants.length > 0 && (
                    <div className="alert alert-info">
                        <div className="d-flex justify-content-between align-items-center">
                            <span>سيتم إنشاء محادثة مع {selectedParticipants.length} مشارك</span>
                            <span className="fw-bold">
                                {roomName || 'محادثة جماعية'}
                            </span>
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer className="border-top-0">
                <Button
                    variant="outline-secondary"
                    onClick={handleCloseModal}
                    style={{ minHeight: '44px' }}
                >
                    إلغاء
                </Button>
                <Button
                    variant="primary"
                    onClick={handleCreate}
                    disabled={selectedParticipants.length === 0 || loading}
                    style={{ minHeight: '44px' }}
                >
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            جاري الإنشاء...
                        </>
                    ) : (
                        'إنشاء المحادثة'
                    )}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default NewChatModal;
