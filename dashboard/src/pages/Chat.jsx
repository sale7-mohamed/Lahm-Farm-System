import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Spinner, Badge, Accordion, Tab, Nav, Form, ListGroup, Table } from 'react-bootstrap';
import {
  Users, MessageSquare, Building, Settings, Lock, UserCheck, CheckCircle, Globe, PlusCircle, ShieldCheck
} from 'lucide-react';
import axios from '../api/axiosConfig';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { toast } from 'react-toastify';
import ChatWindow from '../components/chat/ChatWindow';

const ChatPermissionsModal = ({ show, handleClose }) => {
    const [departments, setDepartments] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedSourceEmp, setSelectedSourceEmp] = useState('');
    const [tempAllowedUsers, setTempAllowedUsers] = useState([]);

    const [globalEmp, setGlobalEmp] = useState('');
    const [savingGlobal, setSavingGlobal] = useState(false);

    useEffect(() => {
        if (show) {
            setLoading(true);
            Promise.all([
                axios.get('/management/departments/chat-permissions/'),
                axios.get('/management/employees/')
            ]).then(([deptRes, empRes]) => {
                setDepartments(deptRes.data);
                setAllEmployees(empRes.data.results || empRes.data || []);
            }).catch(() => toast.error("فشل جلب البيانات"))
              .finally(() => setLoading(false));
        }
    }, [show]);

    const handleToggleDeptPermission = (sourceDeptId, targetDeptId) => {
        setDepartments(prev => prev.map(dept => {
            if (dept.id === sourceDeptId) {
                const current = new Set(dept.can_communicate_with);
                if (current.has(targetDeptId)) current.delete(targetDeptId);
                else current.add(targetDeptId);
                return { ...dept, can_communicate_with: Array.from(current) };
            }
            return dept;
        }));
    };

    const handleAllowAllToDept = (targetDeptId) => {
        if(window.confirm("هل تريد السماح لجميع الأقسام ببدء محادثة مع هذا القسم؟")) {
            setDepartments(prev => prev.map(dept => {
                if (dept.id !== targetDeptId) {
                    const current = new Set(dept.can_communicate_with);
                    current.add(targetDeptId);
                    return { ...dept, can_communicate_with: Array.from(current) };
                }
                return dept;
            }));
            toast.success("تم تحديد السماح للجميع بنجاح. لا تنس حفظ التعديلات.");
        }
    };

    const handleSourceEmpChange = (e) => {
        const empId = parseInt(e.target.value);
        setSelectedSourceEmp(empId);
        const emp = allEmployees.find(x => x.id === empId);
        setTempAllowedUsers(emp?.allowed_chat_users || []);
    };

    const handleToggleEmpPermission = (targetEmpId) => {
        setTempAllowedUsers(prev =>
            prev.includes(targetEmpId) ? prev.filter(id => id !== targetEmpId) : [...prev, targetEmpId]
        );
    };

    const handleSelectAllEmployees = () => {
        const allIds = allEmployees.filter(e => e.id !== parseInt(selectedSourceEmp)).map(e => e.id);
        setTempAllowedUsers(allIds);
        toast.success("تم تحديد جميع الموظفين");
    };

    const handleMakeGlobal = async () => {
        if(!window.confirm("هل أنت متأكد من منح جميع الموظفين صلاحية مراسلة هذا الشخص المفتوحة؟")) return;
        setSavingGlobal(true);
        try {
            const targetId = parseInt(globalEmp);
            const promises = [];

            for (const emp of allEmployees) {
                if (emp.id === targetId) continue;
                const currentAllowed = emp.allowed_chat_users || [];
                if (!currentAllowed.includes(targetId)) {
                    promises.push(
                        axios.patch(`/management/employees/${emp.id}/`, {
                            allowed_chat_users: [...currentAllowed, targetId]
                        })
                    );
                }
            }

            await Promise.all(promises);
            toast.success("تم التحديث بنجاح! الآن يمكن للجميع مراسلة هذا الموظف.");
            setGlobalEmp('');
            handleClose(true);
        } catch  {
            toast.error("حدث خطأ أثناء التحديث الجماعي");
        } finally {
            setSavingGlobal(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.post('/management/departments/chat-permissions/', { permissions: departments });
            if (selectedSourceEmp) {
                await axios.patch(`/management/employees/${selectedSourceEmp}/`, {
                    allowed_chat_users: tempAllowedUsers
                });
            }
            toast.success("تم تحديث صلاحيات التواصل بنجاح");
            handleClose(true);
        } catch {
            toast.error("فشل حفظ الصلاحيات");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={() => handleClose(false)} size="lg" centered>
            <Modal.Header closeButton className="bg-dark text-white">
                <Modal.Title className="fs-5 d-flex align-items-center gap-2">
                    <Lock size={20} /> إعدادات صلاحيات التواصل
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">
                <Tab.Container defaultActiveKey="departments">
                    <Nav variant="tabs" className="px-3 pt-3 bg-light">
                        <Nav.Item>
                            <Nav.Link eventKey="departments" className="fw-bold text-dark">صلاحيات الأقسام</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="individuals" className="fw-bold text-dark">استثناءات الأفراد</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="global" className="fw-bold text-success">متاح للجميع 🌟</Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Tab.Content className="p-3">
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <>
                                <Tab.Pane eventKey="departments">
                                    <div className="alert alert-info small mb-3">
                                        حدد الأقسام التي يُسمح لكل قسم بإرسال رسائل إليها.
                                    </div>
                                    <div className="table-responsive border rounded">
                                        <table className="table table-bordered text-center align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th className="text-start">القسم الأساسي</th>
                                                    <th>يُسمح له بإرسال رسائل إلى:</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {departments.map(dept => (
                                                    <tr key={dept.id}>
                                                        <td className="text-start fw-bold text-primary bg-light" style={{width: '30%'}}>
                                                            <div className="d-flex flex-column gap-2">
                                                                <div><Building size={16} className="me-2"/>{dept.name}</div>
                                                                <Button
                                                                    variant="outline-primary"
                                                                    size="sm"
                                                                    style={{fontSize: '11px', padding: '2px 5px'}}
                                                                    onClick={() => handleAllowAllToDept(dept.id)}
                                                                    className="w-fit"
                                                                >
                                                                    متاح لاستقبال رسائل من الجميع
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="d-flex flex-wrap gap-2 justify-content-start p-3">
                                                            {departments.map(targetDept => {
                                                                if (dept.id === targetDept.id) return null;
                                                                const isAllowed = dept.can_communicate_with.includes(targetDept.id);
                                                                return (
                                                                    <div
                                                                        key={targetDept.id}
                                                                        className={`p-2 border rounded cursor-pointer transition-all user-select-none ${isAllowed ? 'border-success bg-success bg-opacity-10 text-success fw-bold' : 'border-secondary bg-light text-muted'}`}
                                                                        onClick={() => handleToggleDeptPermission(dept.id, targetDept.id)}
                                                                    >
                                                                        <Form.Check type="checkbox" label={targetDept.name} checked={isAllowed} onChange={() => {}} className="d-inline-block m-0" />
                                                                    </div>
                                                                );
                                                            })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Tab.Pane>

                                <Tab.Pane eventKey="individuals">
                                    <div className="alert alert-warning small mb-3">
                                        هنا يمكنك اختيار موظف محدد ومنحه صلاحية استثنائية لمحادثة موظفين آخرين.
                                    </div>
                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-bold">1. اختر الموظف (المرسل):</Form.Label>
                                        <Form.Select value={selectedSourceEmp} onChange={handleSourceEmpChange}>
                                            <option value="">-- اختر موظف --</option>
                                            {allEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.department_name})</option>)}
                                        </Form.Select>
                                    </Form.Group>

                                    {selectedSourceEmp && (
                                        <div>
                                            <div className="d-flex justify-content-between align-items-end mb-2">
                                                <Form.Label className="fw-bold mb-0">2. يُسمح له بالتواصل حصرياً مع (المستلمين):</Form.Label>
                                                <Button variant="outline-success" size="sm" onClick={handleSelectAllEmployees}>
                                                    <CheckCircle size={14} className="me-1"/> تحديد الجميع
                                                </Button>
                                            </div>
                                            <div className="d-flex flex-wrap gap-2 p-3 border rounded bg-light" style={{maxHeight: '300px', overflowY: 'auto'}}>
                                                {allEmployees.filter(e => e.id !== parseInt(selectedSourceEmp)).map(emp => {
                                                    const isAllowed = tempAllowedUsers.includes(emp.id);
                                                    return (
                                                        <div
                                                            key={emp.id}
                                                            className={`p-2 border rounded cursor-pointer transition-all user-select-none ${isAllowed ? 'border-primary bg-primary bg-opacity-10 text-primary fw-bold' : 'bg-white text-muted'}`}
                                                            onClick={() => handleToggleEmpPermission(emp.id)}
                                                        >
                                                            <Form.Check type="checkbox" label={`${emp.full_name} (${emp.department_name})`} checked={isAllowed} onChange={() => {}} className="m-0" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </Tab.Pane>

                                <Tab.Pane eventKey="global">
                                    <div className="alert alert-success small mb-4">
                                        <Globe size={18} className="me-2" />
                                        <strong>التواصل المفتوح:</strong> اختر موظفاً (مثل الـ HR) ليتمكن <strong>جميع</strong> موظفي الشركة من إرسال رسائل إليه مباشرة دون قيود.
                                    </div>
                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-bold">اختر الموظف ليصبح متاحاً للجميع:</Form.Label>
                                        <Form.Select value={globalEmp} onChange={e => setGlobalEmp(e.target.value)}>
                                            <option value="">-- اختر موظف --</option>
                                            {allEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.department_name})</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                    <div className="text-center">
                                        <Button
                                            variant="success"
                                            size="lg"
                                            disabled={!globalEmp || savingGlobal}
                                            onClick={handleMakeGlobal}
                                            className="px-5 shadow-sm"
                                        >
                                            {savingGlobal ? <Spinner size="sm" /> : 'تفعيل السماح للجميع بمراسلته'}
                                        </Button>
                                    </div>
                                </Tab.Pane>
                            </>
                        )}
                    </Tab.Content>
                </Tab.Container>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => handleClose(false)}>إغلاق</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
                    {saving ? <Spinner size="sm"/> : 'حفظ التعديلات'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const CreateGroupModal = ({ show, handleClose, allDepartments, user, onCreated }) => {
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [writers, setWriters] = useState([]);
    const [creating, setCreating] = useState(false);

    const toggleUser = (empId) => {
        setSelectedUsers(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
    };

    const toggleWriter = (empId) => {
        setWriters(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
    };

    const toggleDepartment = (dept) => {
        const empIds = dept.employees.filter(e => e.id !== user.id).map(e => e.id);
        const allSelected = empIds.every(id => selectedUsers.includes(id));

        if (allSelected) {
            setSelectedUsers(prev => prev.filter(id => !empIds.includes(id)));
            setWriters(prev => prev.filter(id => !empIds.includes(id)));
        } else {
            setSelectedUsers(prev => [...new Set([...prev, ...empIds])]);
        }
    };

    const handleCreate = async () => {
        if (!groupName.trim()) return toast.warn("يرجى إدخال اسم المجموعة");
        if (selectedUsers.length === 0) return toast.warn("يرجى اختيار عضو واحد على الأقل");

        setCreating(true);
        try {
            await axios.post('/management/chat/rooms/', {
                name: groupName,
                room_type: 'GROUP',
                participants_ids: selectedUsers,
                allowed_writers_ids: isReadOnly ? writers : []
            });
            toast.success("تم إنشاء المجموعة بنجاح");
            onCreated();
            handleClose();
            setGroupName('');
            setSelectedUsers([]);
            setIsReadOnly(false);
            setWriters([]);
        } catch {
            toast.error("فشل إنشاء المجموعة");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered>
            <Modal.Header closeButton className="bg-primary text-white">
                <Modal.Title className="fs-5 d-flex align-items-center gap-2">
                    <Users size={20} /> إنشاء مجموعة دردشة جديدة
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">اسم المجموعة *</Form.Label>
                    <Form.Control type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="مثال: إعلانات الشركة، فريق المبيعات..." />
                </Form.Group>

                <div className="bg-light p-3 rounded border mb-4">
                    <Form.Check
                        type="switch"
                        id="readonly-switch"
                        label="مجموعة للقراءة فقط (قناة إعلانات)"
                        checked={isReadOnly}
                        onChange={(e) => setIsReadOnly(e.target.checked)}
                        className="fw-bold text-danger"
                    />
                    <small className="text-muted">إذا تم التفعيل، فلن يتمكن الأعضاء من إرسال رسائل إلا من تحدده كمشرف أدناه.</small>
                </div>

                <h6 className="fw-bold mb-3">تحديد المشاركين:</h6>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }} className="pe-2 mb-3">
                    <Accordion alwaysOpen>
                        {allDepartments.map((dept, idx) => {
                            const validEmps = dept.employees.filter(e => e.id !== user.id);
                            if (validEmps.length === 0) return null;
                            const allSelected = validEmps.every(e => selectedUsers.includes(e.id));

                            return (
                                <Accordion.Item eventKey={String(idx)} key={dept.id}>
                                    <Accordion.Header>
                                        <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                                            <span>{dept.name}</span>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body className="p-0">
                                        <div className="p-2 border-bottom bg-light">
                                            <Form.Check type="checkbox" label="تحديد كل موظفي القسم" checked={allSelected} onChange={() => toggleDepartment(dept)} className="fw-bold text-primary"/>
                                        </div>
                                        <ListGroup variant="flush">
                                            {validEmps.map(emp => (
                                                <ListGroup.Item key={emp.id} className="border-0 d-flex justify-content-between align-items-center">
                                                    <Form.Check
                                                        type="checkbox"
                                                        label={`${emp.full_name} (${emp.role_name || 'موظف'})`}
                                                        checked={selectedUsers.includes(emp.id)}
                                                        onChange={() => toggleUser(emp.id)}
                                                    />
                                                    {isReadOnly && selectedUsers.includes(emp.id) && (
                                                        <Form.Check
                                                            type="checkbox"
                                                            label="مشرف (يكتب)"
                                                            checked={writers.includes(emp.id)}
                                                            onChange={() => toggleWriter(emp.id)}
                                                            className="small text-success fw-bold"
                                                        />
                                                    )}
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
                                    </Accordion.Body>
                                </Accordion.Item>
                            );
                        })}
                    </Accordion>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                <Button variant="primary" onClick={handleCreate} disabled={creating}>
                    {creating ? <Spinner size="sm" /> : 'إنشاء المجموعة'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const AdminChatMonitorModal = ({ show, handleClose, openRoomInMonitor }) => {
    const [allRooms, setAllRooms] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [deletedMessages, setDeletedMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (show) {
            setLoading(true);
            Promise.all([
                axios.get('/management/chat/rooms/all-system-rooms/'),
                axios.get('/management/employees/?limit=500'),
                axios.get('/management/chat/rooms/deleted-messages/')
            ]).then(([roomsRes, empsRes, delRes]) => {
                setAllRooms(roomsRes.data || []);
                setEmployees(empsRes.data.results || empsRes.data || []);
                setDeletedMessages(delRes.data || []);
            }).catch(() => toast.error("فشل تحميل بيانات المراقبة"))
              .finally(() => setLoading(false));
        }
    }, [show]);

    const toggleChatBlock = async (empId) => {
        try {
            const res = await axios.post(`/management/employees/${empId}/toggle-chat-block/`);
            setEmployees(prev => prev.map(e => e.id === empId ? { ...e, is_chat_blocked: res.data.is_chat_blocked } : e));
            toast.success(res.data.detail);
        } catch {
            toast.error("فشل تحديث حالة الحظر");
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered scrollable>
            <Modal.Header closeButton className="bg-danger text-white">
                <Modal.Title className="fs-5 d-flex align-items-center gap-2">
                    <ShieldCheck size={20} /> الإشراف ومراقبة النظام
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0 bg-light">
                <Tab.Container defaultActiveKey="monitor">
                    <Nav variant="pills" className="bg-white border-bottom p-2 d-flex flex-wrap">
                        <Nav.Item className="flex-fill text-center">
                            <Nav.Link eventKey="monitor" className="fw-bold">مراقبة المحادثات</Nav.Link>
                        </Nav.Item>
                        <Nav.Item className="flex-fill text-center">
                            <Nav.Link eventKey="bans" className="fw-bold text-danger">حظر الموظفين</Nav.Link>
                        </Nav.Item>
                        <Nav.Item className="flex-fill text-center">
                            <Nav.Link eventKey="deleted" className="fw-bold text-warning">الرسائل المحذوفة</Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Tab.Content className="p-3">
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <>
                                <Tab.Pane eventKey="monitor">
                                    <div className="alert alert-info small mb-3">
                                        تظهر هنا <strong>جميع</strong> المحادثات التي تمت في النظام (سواء مجموعات أو فردية بين الموظفين). اضغط على المحادثة لمراقبتها ورؤية الرسائل المحذوفة.
                                    </div>
                                    <div className="list-group">
                                        {allRooms.map(room => {
                                            let displayName = room.name;
                                            if (room.room_type === 'DIRECT') {
                                                if (room.participants.length === 1) {
                                                    displayName = `ملاحظات شخصية - ${room.participants[0].full_name.split(' ')[0]}`;
                                                } else {
                                                    displayName = room.participants.map(p => p.full_name.split(' ')[0]).join(' ↔ ');
                                                }
                                            }
                                            return (
                                                <button
                                                    key={room.id}
                                                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                                    onClick={() => {
                                                        openRoomInMonitor(room);
                                                        handleClose();
                                                    }}
                                                >
                                                    <div>
                                                        <strong className="text-primary">{displayName}</strong>
                                                        <div className="small text-muted">{room.room_type === 'DIRECT' ? 'محادثة خاصة' : 'مجموعة'}</div>
                                                    </div>
                                                    <span className="badge bg-secondary rounded-pill">{room.messages_count || 0} رسالة</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </Tab.Pane>
                                <Tab.Pane eventKey="bans">
                                    <div className="alert alert-warning small mb-3">
                                        الموظف المحظور يمكنه قراءة الرسائل التي تصله فقط، لكن لا يمكنه إرسال أي رسالة في أي محادثة أو مجموعة.
                                    </div>
                                    <div className="table-responsive bg-white rounded border">
                                        <Table hover className="mb-0 align-middle text-center">
                                            <thead className="table-light">
                                                <tr>
                                                    <th className="text-start">الموظف</th>
                                                    <th>حالة الشات</th>
                                                    <th>إجراء</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employees.map(emp => (
                                                    <tr key={emp.id}>
                                                        <td className="text-start">
                                                            <strong>{emp.full_name}</strong>
                                                            <div className="small text-muted">{emp.role_name}</div>
                                                        </td>
                                                        <td>
                                                            {emp.is_chat_blocked ? (
                                                                <Badge bg="danger"><Lock size={12} className="me-1"/>موقوف</Badge>
                                                            ) : (
                                                                <Badge bg="success"><MessageSquare size={12} className="me-1"/>مسموح</Badge>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <Button
                                                                variant={emp.is_chat_blocked ? "outline-success" : "outline-danger"}
                                                                size="sm"
                                                                onClick={() => toggleChatBlock(emp.id)}
                                                            >
                                                                {emp.is_chat_blocked ? 'السماح بالشات' : 'إيقاف الشات'}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Tab.Pane>

                                <Tab.Pane eventKey="deleted">
                                    <div className="alert alert-warning small mb-3">
                                        سجل بجميع الرسائل التي تم حذفها "للجميع"، وتاريخ الحذف ومن قام به.
                                    </div>
                                    <div className="table-responsive bg-white rounded border" style={{maxHeight: '400px'}}>
                                        <Table hover className="mb-0 align-middle text-center" size="sm">
                                            <thead className="table-light sticky-top">
                                                <tr>
                                                    <th>صاحب الرسالة</th>
                                                    <th>المحادثة/الغرفة</th>
                                                    <th>محتوى الرسالة</th>
                                                    <th>وقت الحذف</th>
                                                    <th>حُذفت بواسطة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deletedMessages.map((msg, idx) => (
                                                    <tr key={idx}>
                                                        <td className="fw-bold text-primary">{msg.author_name}</td>
                                                        <td>{msg.room_name}</td>
                                                        <td className="text-muted text-truncate" style={{maxWidth: '200px'}} title={msg.content}>
                                                            {msg.content || 'ملف مرفق 📁'}
                                                        </td>
                                                        <td dir="ltr" className="small">{new Date(msg.deleted_at).toLocaleString('ar-EG', { numberingSystem: 'latn' })}</td>
                                                        <td><Badge bg="danger">{msg.deleted_by}</Badge></td>
                                                    </tr>
                                                ))}
                                                {deletedMessages.length === 0 && (
                                                    <tr><td colSpan="5" className="text-muted py-3">لا توجد رسائل محذوفة</td></tr>
                                                )}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Tab.Pane>
                            </>
                        )}
                    </Tab.Content>
                </Tab.Container>
            </Modal.Body>
        </Modal>
    );
};

const Chat = () => {
  const { user } = useAuth();
  const { setUnreadCount } = useChat();
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileList, setShowMobileList] = useState(true);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [showAdminMonitorModal, setShowAdminMonitorModal] = useState(false);
  const [monitorMode, setMonitorMode] = useState(false);

  const [myAllowedDepts, setMyAllowedDepts] = useState([]);
  const [myAllowedUsers, setMyAllowedUsers] = useState([]);
  const [allDepartmentsRaw, setAllDepartmentsRaw] = useState([]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setShowMobileList(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = useCallback(async () => {
      try {
          const deptsRes = await axios.get('/management/employees/chat-departments/');
          const allDepts = deptsRes.data || [];
          setAllDepartmentsRaw(allDepts);

          const roomsRes = await axios.get('/management/chat/rooms/');
          const activeRooms = roomsRes.data.results || roomsRes.data || [];

          setRooms(activeRooms);

          const totalUnread = activeRooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);
          setUnreadCount(totalUnread);

          let allowedDepts = [];
          let allowedUsers = [];

          const myDeptId = typeof user.department === 'object' ? user.department?.id : user.department;
          const myDeptObj = allDepts.find(d => d.id === myDeptId);

          if (myDeptObj) {
              allowedDepts = myDeptObj.can_communicate_with || [];
          }

          const myUserRecord = myDeptObj?.employees?.find(e => e.id === user.id);
          if (myUserRecord) {
              allowedUsers = myUserRecord.allowed_chat_users || [];
          }

          setMyAllowedDepts(allowedDepts);
          setMyAllowedUsers(allowedUsers);

          const filteredDepts = allDepts.map(dept => {
              const isAllowedDept = user.is_superuser || allowedDepts.includes(dept.id) || myDeptId === dept.id;

              const filteredEmps = dept.employees.filter(emp => {
                  if (emp.id === user.id) return false;
                  const isAllowedUser = allowedUsers.includes(emp.id);
                  return isAllowedDept || isAllowedUser;
              });

              return { ...dept, employees: filteredEmps };
          }).filter(dept => dept.employees.length > 0);

          setDepartments(filteredDepts);

      } catch (err) {
          console.error('Fetch chat data error:', err);
          toast.error('فشل تحميل بيانات المحادثة');
      } finally {
          setLoadingData(false);
      }
  }, [user.id, user.is_superuser, user.department, setUnreadCount]);

  useEffect(() => {
      fetchData();
  }, [fetchData]);

  useEffect(() => {
      const handleChatUpdate = () => {
          setTimeout(() => {
              fetchData();
          }, 800);
      };
      window.addEventListener('chat-updated', handleChatUpdate);
      return () => window.removeEventListener('chat-updated', handleChatUpdate);
  }, [fetchData]);

  const canReplyToCurrentRoom = () => {
      if (user.is_chat_blocked) return false;
      if (monitorMode) return false;
      if (user.is_superuser) return true;
      if (!selectedRoom) return false;

      if (selectedRoom.room_type === 'GROUP' && selectedRoom.allowed_writers?.length > 0) {
          return selectedRoom.allowed_writers.includes(user.id);
      }

      if (targetUser) {
          const targetDeptId = typeof targetUser.department === 'object' ? targetUser.department?.id : targetUser.department;
          const myDeptId = typeof user.department === 'object' ? user.department?.id : user.department;

          const isDeptAllowed = myAllowedDepts.includes(targetDeptId) || myDeptId === targetDeptId;
          const isUserAllowed = myAllowedUsers.includes(targetUser.id);

          return isDeptAllowed || isUserAllowed;
      }

      return true;
  };

  const openRoom = async (empOrRoom, isGroup = false) => {
      setMonitorMode(false);
      if (isGroup) {
          setTargetUser(null);
          setSelectedRoom(empOrRoom);
          setActiveTab('chats');
          if (isMobile) setShowMobileList(false);
      } else {
          setTargetUser(empOrRoom);
          const existingRoom = rooms.find(r => r.room_type === 'DIRECT' && r.participants.some(p => p.id === empOrRoom.id));

          if (existingRoom) {
              setSelectedRoom(existingRoom);
              setActiveTab('chats');
              if (isMobile) setShowMobileList(false);
          } else {
              try {
                  const res = await axios.post('/management/chat/rooms/', {
                      name: '',
                      room_type: 'DIRECT',
                      participants_ids: [empOrRoom.id]
                  });
                  setSelectedRoom(res.data);
                  fetchData();
                  setActiveTab('chats');
                  if (isMobile) setShowMobileList(false);
              } catch  {
                  toast.error("فشل فتح المحادثة.");
              }
          }
      }
  };

  const openRoomInMonitor = (room) => {
      setTargetUser(null);
      setSelectedRoom(room);
      setActiveTab('chats');
      setMonitorMode(true);
      if (isMobile) setShowMobileList(false);
  };

  return (
    <div className="container-fluid py-3 px-2 px-md-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
                <h4 className="fw-bold mb-0 text-dark">نظام المراسلة الداخلية</h4>
                <small className="text-muted">تواصل مع فريق العمل بأمان</small>
            </div>
            <div className="d-flex gap-2">
                {user.is_superuser && (
                    <Button variant="danger" size="sm" onClick={() => setShowAdminMonitorModal(true)}>
                        <ShieldCheck size={16} className="me-1"/> مراقبة النظام
                    </Button>
                )}
                {user.is_superuser && (
                    <Button variant="outline-primary" size="sm" onClick={() => setShowCreateGroupModal(true)}>
                        <Users size={16} className="me-1"/> إنشاء مجموعة
                    </Button>
                )}
                {user.is_superuser && (
                    <Button variant="dark" size="sm" onClick={() => setShowPermissionsModal(true)}>
                        <Settings size={16} className="me-1"/> إعدادات
                    </Button>
                )}
            </div>
        </div>

        <div className="chat-layout shadow-sm bg-white rounded-4 border overflow-hidden d-flex flex-row" style={{ height: 'calc(100vh - 120px)' }}>

            <div className={`chat-main flex-grow-1 d-flex flex-column ${showMobileList && isMobile ? 'd-none' : ''}`} style={{ backgroundColor: '#e5ddd5', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
                {selectedRoom ? (
                    <ChatWindow
                        room={selectedRoom}
                        targetUser={targetUser}
                        canReply={canReplyToCurrentRoom()}
                        onBack={() => {
                            setShowMobileList(true);
                            setSelectedRoom(null);
                            setMonitorMode(false);
                        }}
                        isMobile={isMobile}
                    />
                ) : (
                    <div className="m-auto text-center text-muted p-5 bg-white bg-opacity-75 rounded-4 shadow-sm border" style={{ maxWidth: '400px' }}>
                        <div className="bg-light rounded-circle d-inline-flex p-4 mb-3 border">
                            <MessageSquare size={48} className="text-primary opacity-50" />
                        </div>
                        <h4 className="text-dark fw-bold">نظام المراسلة الداخلية</h4>
                        <p>اختر محادثة من القائمة للاستعراض، أو ابحث في دليل الموظفين لبدء محادثة جديدة.</p>
                    </div>
                )}
            </div>

            <div className={`chat-sidebar border-start d-flex flex-column ${!showMobileList && isMobile ? 'd-none' : ''}`} style={{ width: isMobile ? '100%' : '320px', backgroundColor: '#fcfcfc' }}>
                <div className="p-0 bg-white border-bottom shadow-sm z-1">
                    <Nav variant="pills" className="d-flex w-100 text-center" style={{ cursor: 'pointer' }}>
                        <Nav.Item className="flex-fill">
                            <div
                                className={`p-3 fw-bold ${activeTab === 'chats' ? 'text-primary border-bottom border-primary border-3 bg-primary bg-opacity-10' : 'text-muted'}`}
                                onClick={() => setActiveTab('chats')}
                            >
                                <MessageSquare size={18} className="me-2"/> محادثاتي
                            </div>
                        </Nav.Item>
                        <Nav.Item className="flex-fill">
                            <div
                                className={`p-3 fw-bold ${activeTab === 'contacts' ? 'text-primary border-bottom border-primary border-3 bg-primary bg-opacity-10' : 'text-muted'}`}
                                onClick={() => setActiveTab('contacts')}
                            >
                                <Users size={18} className="me-2"/> دليل الموظفين
                            </div>
                        </Nav.Item>
                    </Nav>
                </div>

                <div className="flex-grow-1 overflow-auto custom-scrollbar p-2">
                    {loadingData ? (
                        <div className="text-center mt-5"><Spinner animation="border" variant="primary"/></div>
                    ) : activeTab === 'chats' ? (
                        <div className="list-group list-group-flush rounded">
                            {rooms.length === 0 ? (
                                <div className="text-center text-muted p-4 mt-3 border border-dashed rounded bg-white">
                                    <MessageSquare size={32} className="mb-2 opacity-50"/>
                                    <p className="mb-0">صندوق الوارد فارغ. يمكنك بدء محادثة من (دليل الموظفين).</p>
                                </div>
                            ) : (
                                rooms.map(room => {
                                    const isGroup = room.room_type !== 'DIRECT';
                                    let otherUser = null;
                                    let displayName = room.name;
                                    let avatarChar = 'G';

                                    if (!isGroup) {
                                        const others = room.participants.filter(p => p.id !== user.id);
                                        if (others.length === 1) {
                                            otherUser = others[0];
                                            displayName = otherUser.full_name;
                                            avatarChar = otherUser.full_name.charAt(0);
                                        } else if (others.length > 1 && user.is_superuser) {
                                            displayName = others.map(p => p.full_name.split(' ')[0]).join(' ↔ ');
                                            avatarChar = '👀';
                                        } else {
                                            displayName = "ملاحظاتي الشخصية";
                                            avatarChar = "م";
                                        }
                                    } else {
                                        displayName = room.name || 'مجموعة عمل';
                                    }

                                    const unreadCountLocal = room.unread_count || 0;
                                    const hasUnread = unreadCountLocal > 0;

                                    const lastMessage = room.latest_message ? (room.latest_message.content || 'ملف مرفق 📁') : 'ابدأ المحادثة الآن...';

                                    let msgTime = '';
                                    if (room.latest_message) {
                                        const d = new Date(room.latest_message.timestamp);
                                        msgTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    }

                                    const isActive = selectedRoom?.id === room.id;

                                    return (
                                        <button
                                            key={`room-${room.id}`}
                                            className={`list-group-item list-group-item-action border-0 d-flex align-items-center gap-3 p-3 mb-1 rounded transition-colors ${isActive ? 'bg-primary bg-opacity-10 border-start border-primary border-4 shadow-sm' : 'bg-white shadow-sm border border-light'}`}
                                            onClick={() => {
                                                if (isGroup || !otherUser) {
                                                    openRoom(room, true);
                                                } else {
                                                    openRoom(otherUser, false);
                                                }
                                            }}
                                        >
                                            <div className="position-relative">
                                                <div className={`${isGroup ? 'bg-info' : 'bg-secondary'} bg-opacity-25 text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold`} style={{width: 45, height: 45, fontSize: '18px'}}>
                                                    {isGroup ? <Users size={20} className="text-info" /> : avatarChar}
                                                </div>
                                                {hasUnread && (
                                                    <span className="position-absolute top-0 start-100 translate-middle p-1 bg-success border border-light rounded-circle">
                                                        <span className="visually-hidden">New alerts</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-start overflow-hidden w-100">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '15px' }}>{displayName}</div>
                                                    <small dir="ltr" className={hasUnread ? "text-success fw-bold" : "text-muted"} style={{ fontSize: '11px' }}>{msgTime}</small>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <small className={`text-truncate d-block ${hasUnread ? 'fw-bold text-dark' : 'text-muted'}`} style={{ maxWidth: '80%' }}>
                                                        {isGroup && room.latest_message ? <span className="text-primary">{room.latest_message.author?.full_name}: </span> : null}
                                                        {lastMessage}
                                                    </small>
                                                    {hasUnread && <Badge bg="success" pill>{unreadCountLocal}</Badge>}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    ) : (
                        <Accordion flush defaultActiveKey={departments.map((_, i) => i.toString())} alwaysOpen>
                            {departments.length === 0 && (
                                <div className="text-center text-muted p-4 mt-3 border border-dashed rounded bg-white">
                                    <Lock size={32} className="mb-2 opacity-50"/>
                                    <p className="mb-0">ليس لديك صلاحية لبدء محادثة مع أي قسم آخر.</p>
                                </div>
                            )}
                            {departments.map((dept, index) => (
                                <Accordion.Item eventKey={index.toString()} key={`dept-${dept.id}`} className="border-0 bg-transparent mb-2">
                                    <Accordion.Header className="dept-header shadow-sm rounded bg-white">
                                        <Building size={16} className="me-2 text-secondary"/>
                                        <strong className="text-dark">{dept.name}</strong>
                                        <Badge bg="light" text="dark" className="ms-auto border">{dept.employees.length}</Badge>
                                    </Accordion.Header>
                                    <Accordion.Body className="p-0 pt-1">
                                        <div className="list-group list-group-flush rounded">
                                            {dept.employees.map(emp => {
                                                return (
                                                    <button
                                                        key={`emp-${emp.id}`}
                                                        className={`list-group-item list-group-item-action border-0 d-flex align-items-center gap-3 p-2 transition-colors hover-bg-light`}
                                                        onClick={() => openRoom(emp)}
                                                    >
                                                        <div className="bg-secondary bg-opacity-25 text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{width: 35, height: 35, fontSize: '14px'}}>
                                                            {emp.full_name.charAt(0)}
                                                        </div>
                                                        <div className="text-start overflow-hidden w-100">
                                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }}>{emp.full_name}</div>
                                                            <div className="text-muted small text-truncate">{emp.role_name || 'موظف'}</div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    )}
                </div>
            </div>
        </div>

        <ChatPermissionsModal
            show={showPermissionsModal}
            handleClose={(refresh) => {
                setShowPermissionsModal(false);
                if (refresh === true) fetchData();
            }}
        />

        <CreateGroupModal
            show={showCreateGroupModal}
            handleClose={() => setShowCreateGroupModal(false)}
            allDepartments={allDepartmentsRaw}
            user={user}
            onCreated={fetchData}
        />

        <AdminChatMonitorModal
            show={showAdminMonitorModal}
            handleClose={() => setShowAdminMonitorModal(false)}
            openRoomInMonitor={openRoomInMonitor}
        />

        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            .accordion-button:not(.collapsed) { background-color: #f8f9fa; color: #0d6efd; box-shadow: none; }
            .accordion-button:focus { box-shadow: none; border-color: transparent; }
            .hover-bg-light:hover { background-color: #f8f9fa !important; }
        `}</style>
    </div>
  );
};

export default Chat;
