import React from 'react';
import { Card, Container } from 'react-bootstrap';
import { HeartHandshake } from 'lucide-react';

const Donations = () => {
    return (
        <Container fluid className="py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">إدارة التبرعات</h1>
                    <p className="text-muted mb-0">توزيع الصدقات ولحوم التبرعات</p>
                </div>
            </div>

            <Card className="shadow-sm border-0 text-center py-5 mt-4">
                <Card.Body className="py-5">
                    <HeartHandshake size={72} className="text-muted mb-3 opacity-50" />
                    <h3 className="text-muted fw-bold">صفحة التبرعات (قريباً)</h3>
                    <p className="text-muted mb-0">
                        هذه الصفحة قيد التطوير. سيتم توفير أدوات إدارة التبرعات وتوزيعها للمحتاجين هنا لاحقاً.
                    </p>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default Donations;

