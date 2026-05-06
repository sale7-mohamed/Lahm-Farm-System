import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { Printer, X } from 'lucide-react';
import axios from '../../api/axiosConfig';
import { toast } from 'react-toastify';

const PrintModal = ({ show, handleClose, title, endpoint }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(false);
    const iframeRef = useRef(null);

    useEffect(() => {
        if (show && endpoint) {
            setLoading(true);
            //      (HTML)   
            //         Headers   
            axios.get(endpoint, { responseType: 'text' })
                .then(res => {
                    setHtmlContent(res.data);
                })
                .catch(err => {
                    console.error("Print fetch error:", err);
                    toast.error("فشل تحميل وثيقة الطباعة.");
                    handleClose();
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setHtmlContent('');
        }
    },[show, endpoint, handleClose]);

    const handlePrint = () => {
        if (iframeRef.current) {
            iframeRef.current.contentWindow.print();
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="xl" centered backdrop="static">
            <Modal.Header className="bg-light">
                <Modal.Title className="fs-5 fw-bold d-flex align-items-center gap-2">
                    <Printer size={20} className="text-primary" />
                    {title}
                </Modal.Title>
                <Button variant="link" className="text-danger p-0" onClick={handleClose}>
                    <X size={24} />
                </Button>
            </Modal.Header>
            <Modal.Body className="p-0 bg-secondary bg-opacity-10" style={{ height: '75vh', position: 'relative' }}>
                {loading ? (
                    <div className="d-flex flex-column justify-content-center align-items-center h-100">
                        <Spinner animation="border" variant="primary" />
                        <span className="mt-3 fw-bold text-muted">جاري تجهيز الوثيقة للطباعة...</span>
                    </div>
                ) : (
                    <iframe
                        ref={iframeRef}
                        srcDoc={htmlContent}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Print Document View"
                    />
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose} className="px-4">
                    إغلاق
                </Button>
                <Button variant="primary" onClick={handlePrint} disabled={loading} className="px-5 d-flex align-items-center gap-2 fw-bold">
                    <Printer size={18} />
                    طباعة الآن
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PrintModal;
