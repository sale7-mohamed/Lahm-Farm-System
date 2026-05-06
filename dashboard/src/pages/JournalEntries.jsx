// src/pages/JournalEntries.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Table, Badge, Card, Row, Col, Accordion, Button } from 'react-bootstrap';
import { FileText, Calendar, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';

function JournalEntries() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEntry, setExpandedEntry] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/accounting/journal-entries/');
            setEntries(res.data.results || []);
        } catch {
            toast.error("فشل تحميل قيود اليومية.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleEntryDetails = (entryId) => {
        setExpandedEntry(expandedEntry === entryId ? null : entryId);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">قيود اليومية</h1>
                    <p className="text-muted mb-0">عرض ومتابعة القيود المحاسبية</p>
                </div>
                <div className="d-flex align-items-center">
                    <Badge bg="light" text="dark" className="me-2">
                        {entries.length} قيود
                    </Badge>
                    <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        {loading ? 'جاري التحديث...' : 'تحديث'}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">جاري التحميل...</span>
                    </div>
                    <p className="mt-2">جاري تحميل قيود اليومية...</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="text-center py-5">
                    <div className="mb-3">
                        <FileText size={64} className="text-muted" />
                    </div>
                    <h4 className="text-muted mb-3">لا توجد قيود يومية</h4>
                    <p className="text-muted">لم يتم إضافة أي قيود يومية بعد</p>
                </div>
            ) : (
                <div className="row g-3">
                    {entries.map(entry => {
                        const isExpanded = expandedEntry === entry.id;

                        return (
                            <div key={entry.id} className="col-12">
                                <Card className="shadow-sm hover-shadow border-start" style={{
                                    borderLeftWidth: '4px',
                                    borderLeftColor: entry.is_balanced ? '#198754' : '#dc3545'
                                }}>
                                    <Card.Body className="p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center mb-1">
                                                    <Badge
                                                        bg={entry.is_balanced ? "success" : "danger"}
                                                        className="me-2"
                                                    >
                                                        {entry.is_balanced ?
                                                            <CheckCircle size={14} className="me-1" /> :
                                                            <XCircle size={14} className="me-1" />
                                                        }
                                                        {entry.is_balanced ? 'متزن' : 'غير متزن'}
                                                    </Badge>
                                                    <span className="text-muted small">
                                                        #{entry.id}
                                                    </span>
                                                </div>
                                                <h6 className="mb-1 text-primary">
                                                    {entry.description || 'بدون وصف'}
                                                </h6>
                                            </div>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="p-0 text-decoration-none"
                                                onClick={() => toggleEntryDetails(entry.id)}
                                            >
                                                {isExpanded ?
                                                    <ChevronUp size={20} /> :
                                                    <ChevronDown size={20} />
                                                }
                                            </Button>
                                        </div>

                                        <Row className="g-2 mb-2">
                                            <Col xs={6} md={3}>
                                                <div className="d-flex align-items-center">
                                                    <Calendar size={16} className="me-2 text-muted" />
                                                    <div>
                                                        <small className="text-muted d-block">التاريخ</small>
                                                        <strong>{formatDate(entry.date)}</strong>
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={3}>
                                                <div>
                                                    <small className="text-muted d-block">المدين</small>
                                                    <strong className="text-danger">
                                                        {entry.total_debits || '0.00'} ج.م
                                                    </strong>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={3}>
                                                <div>
                                                    <small className="text-muted d-block">الدائن</small>
                                                    <strong className="text-success">
                                                        {entry.total_credits || '0.00'} ج.م
                                                    </strong>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={3}>
                                                <div>
                                                    <small className="text-muted d-block">الفرق</small>
                                                    <strong className={entry.is_balanced ? 'text-success' : 'text-danger'}>
                                                        {Math.abs(entry.total_debits - entry.total_credits).toFixed(2)} ج.م
                                                    </strong>
                                                </div>
                                            </Col>
                                        </Row>

                                        {isExpanded && entry.lines && entry.lines.length > 0 && (
                                            <div className="mt-3 pt-3 border-top">
                                                <h6 className="mb-3 d-flex align-items-center">
                                                    <Eye size={18} className="me-2" />
                                                    تفاصيل القيد
                                                </h6>

                                                <div className="table-responsive">
                                                    <Table size="sm" className="mb-0">
                                                        <thead className="bg-light">
                                                            <tr>
                                                                <th>الحساب</th>
                                                                <th className="text-center">النوع</th>
                                                                <th className="text-end">المبلغ</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {entry.lines.map(line => (
                                                                <tr key={line.id}>
                                                                    <td>
                                                                        <div className="d-flex flex-column">
                                                                            <strong>{line.account_name}</strong>
                                                                            {line.account_code && (
                                                                                <small className="text-muted">
                                                                                    كود: {line.account_code}
                                                                                </small>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-center">
                                                                        <Badge bg={
                                                                            line.entry_type === 'debit' ? 'danger' :
                                                                            line.entry_type === 'credit' ? 'success' : 'secondary'
                                                                        }>
                                                                            {line.entry_type === 'debit' ? 'مدين' :
                                                                             line.entry_type === 'credit' ? 'دائن' : line.entry_type}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="text-end">
                                                                        <strong className={
                                                                            line.entry_type === 'debit' ? 'text-danger' : 'text-success'
                                                                        }>
                                                                            {line.amount} ج.م
                                                                        </strong>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="table-light">
                                                            <tr>
                                                                <td colSpan="2" className="text-end">
                                                                    <strong>المجموع:</strong>
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex flex-column">
                                                                        <span className="text-danger">
                                                                            <strong>مدين: {entry.total_debits} ج.م</strong>
                                                                        </span>
                                                                        <span className="text-success">
                                                                            <strong>دائن: {entry.total_credits} ج.م</strong>
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </Table>
                                                </div>

                                                {entry.reference_number && (
                                                    <div className="mt-3">
                                                        <small className="text-muted">رقم المرجع: </small>
                                                        <span className="badge bg-info">
                                                            {entry.reference_number}
                                                        </span>
                                                    </div>
                                                )}

                                                {entry.notes && (
                                                    <div className="mt-3">
                                                        <small className="text-muted d-block">ملاحظات:</small>
                                                        <p className="mb-0 p-2 bg-light rounded">
                                                            {entry.notes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <small className="text-muted">
                                                {entry.created_by && `تم الإنشاء بواسطة: ${entry.created_by}`}
                                            </small>
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => toggleEntryDetails(entry.id)}
                                            >
                                                {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            )}

            {}
            {!loading && entries.length > 0 && (
                <div className="row mt-4">
                    <div className="col-12">
                        <Card className="bg-light">
                            <Card.Body>
                                <Row className="g-3">
                                    <Col xs={6} md={3}>
                                        <div className="text-center">
                                            <h4 className="text-primary mb-1">{entries.length}</h4>
                                            <small className="text-muted">إجمالي القيود</small>
                                        </div>
                                    </Col>
                                    <Col xs={6} md={3}>
                                        <div className="text-center">
                                            <h4 className="text-success mb-1">
                                                {entries.filter(e => e.is_balanced).length}
                                            </h4>
                                            <small className="text-muted">قيود متزنة</small>
                                        </div>
                                    </Col>
                                    <Col xs={6} md={3}>
                                        <div className="text-center">
                                            <h4 className="text-danger mb-1">
                                                {entries.filter(e => !e.is_balanced).length}
                                            </h4>
                                            <small className="text-muted">قيود غير متزنة</small>
                                        </div>
                                    </Col>
                                    <Col xs={6} md={3}>
                                        <div className="text-center">
                                            <h4 className="text-info mb-1">
                                                {entries.reduce((sum, entry) => sum + parseFloat(entry.total_debits || 0), 0).toFixed(2)}
                                            </h4>
                                            <small className="text-muted">إجمالي المدين</small>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}

export default JournalEntries;