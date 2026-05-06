import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Row, Col, Table, Tab, Nav, Spinner, Form, Badge } from 'react-bootstrap';
import {
    FileText, Printer, Download, BarChart2, Users, Briefcase, Beef, Filter,
    TrendingUp, DollarSign, Activity, Truck, PieChart as PieIcon, ClipboardList
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Libraries for export
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

//        ( )
const toEnglish = (str) => {
    if (str === null || str === undefined) return '';
    const strVal = String(str);
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    let result = strVal;
    for (let i = 0; i < 10; i++) {
        result = result.replace(new RegExp(arabicNumbers[i], 'g'), englishNumbers[i]);
    }
    return result;
};

//      (  )
const COLUMN_DEFINITIONS = {
    customers:[
        { key: 'name', label: 'الاسم' },
        { key: 'phone', label: 'رقم الهاتف' },
        { key: 'email', label: 'البريد الإلكتروني' },
        { key: 'address', label: 'العنوان الرئيسي' },
        { key: 'joined_date', label: 'تاريخ الانضمام' },
        { key: 'is_phone_verified', label: 'الهاتف موثق؟' },
        { key: 'phone_verified_at', label: 'تاريخ التوثيق' },
        { key: 'status', label: 'الحالة' }
    ],
    employees: [
        { key: 'name', label: 'الاسم' },
        { key: 'phone', label: 'رقم الهاتف' },
        { key: 'department', label: 'القسم' },
        { key: 'role', label: 'الدور الوظيفي' },
        { key: 'salary', label: 'الراتب الأساسي' },
        { key: 'hire_date', label: 'تاريخ التعيين' },
        { key: 'status', label: 'الحالة' }
    ],
};

// ---      (  ) ---
const REPORT_CATEGORIES = [
    {
        id: 'livestock', name: 'الإنتاج والمواشي', icon: <Beef size={18}/>,
        reports: [
            { id: 'fcr_analysis', name: 'معدل التحويل (FCR)', cols: ['code', 'category', 'feed_consumed', 'weight_gain', 'fcr'] },
            { id: 'weight_gain', name: 'تحليل نمو الأوزان', type: 'chart' },
            { id: 'animal_profitability', name: 'ربحية الحيوان الواحد', cols: ['code', 'cost', 'revenue', 'profit'] },
            { id: 'mortality', name: 'الهالك والوفيات', cols: ['code', 'category', 'date', 'cost_loss', 'cause'] },
            { id: 'health_status', name: 'الحالة الصحية', cols: ['date', 'animal', 'type', 'description', 'cost'] },
        ]
    },
    {
        id: 'inventory', name: 'المخزون والتكاليف', icon: <Truck size={18}/>,
        reports: [
            { id: 'feed_forecast', name: 'توقعات نفاذ العلف', cols: ['item_name', 'current_stock', 'daily_consumption_kg', 'days_left', 'depletion_date'] },
            { id: 'stock_movement', name: 'حركة المخزون', cols: ['date', 'item', 'type', 'qty', 'user'] },
            { id: 'waste_loss', name: 'تقرير الهدر', cols: ['date', 'item', 'qty_lost', 'reason'] },
        ]
    },
    {
        id: 'sales', name: 'المبيعات والعملاء', icon: <TrendingUp size={18}/>,
        reports: [
            { id: 'sales_by_source', name: 'المبيعات حسب القناة', type: 'chart', chartType: 'pie' },
            { id: 'sales_by_category', name: 'المبيعات حسب الفئة', type: 'chart', chartType: 'bar' },
            { id: 'outstanding_payments', name: 'المدفوعات والديون', cols: ['order_id', 'customer', 'phone', 'total', 'paid', 'due'] },
            { id: 'top_customers', name: 'كبار العملاء', type: 'mixed' },
            { id: 'customers_list', name: 'قائمة العملاء الكاملة', cols: ['name', 'phone', 'email', 'address', 'joined_date', 'status'] },
        ]
    },
    {
        id: 'accounting', name: 'المالية والمحاسبة', icon: <DollarSign size={18}/>,
        reports: [
            { id: 'pnl_statement', name: 'قائمة الدخل (P&L)', type: 'summary' },
            { id: 'expenses_breakdown', name: 'توزيع المصروفات', type: 'chart', chartType: 'pie' },
            { id: 'supplier_ledger', name: 'كشف حساب موردين', cols: ['supplier__name', 'total_purchased'] },
        ]
    },
    {
        id: 'shares', name: 'المشاركة والأضاحي', icon: <Users size={18}/>,
        reports: [
            { id: 'shares_status', name: 'حالة المجموعات', cols: ['code', 'category', 'total_shares', 'sold_shares', 'status'] },
            { id: 'slaughter_distribution', name: 'توزيع الذبح', cols: ['order_id', 'customer', 'delivery_date', 'type'] },
        ]
    },
    {
        id: 'hr', name: 'الموارد البشرية', icon: <Briefcase size={18}/>,
        reports: [
            { id: 'employees_list', name: 'قائمة الموظفين', cols: ['name', 'phone', 'department', 'role', 'salary', 'status'] },
            { id: 'payroll_summary', name: 'ملخص الرواتب', cols: ['employee', 'month', 'net_salary', 'status'] },
            { id: 'audit_log', name: 'سجل الحركات (Audit)', cols: ['date', 'user', 'action'] },
        ]
    }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// ---    (  ) ---
const ExportButtons = ({ onExportExcel, onExportWord, onPrint }) => (
    <div className="d-flex gap-2 mb-3 no-print">
        <Button variant="outline-success" size="sm" onClick={onExportExcel} title="تصدير Excel">
            <Download size={16} className="me-1" /> Excel
        </Button>
        <Button variant="outline-primary" size="sm" onClick={onExportWord} title="تصدير Word">
            <FileText size={16} className="me-1" /> Word
        </Button>
        <Button variant="secondary" size="sm" onClick={onPrint} title="طباعة / حفظ كـ PDF">
            <Printer size={16} className="me-1" /> طباعة / PDF
        </Button>
    </div>
);

// ---    (  ) ---
const ColumnSelector = ({ reportType, selectedColumns, onColumnToggle }) => (
    <div className="mb-3 no-print p-3 border rounded bg-white">
        <div className="d-flex align-items-center mb-2">
            <Filter size={16} className="me-2 text-primary" />
            <h6 className="mb-0">اختر البيانات التي تود عرضها وطباعتها:</h6>
        </div>
        <div className="d-flex flex-wrap gap-3">
            {COLUMN_DEFINITIONS[reportType]?.map(col => (
                <Form.Check
                    key={col.key}
                    type="checkbox"
                    id={`col-${col.key}`}
                    label={col.label}
                    checked={selectedColumns.includes(col.key)}
                    onChange={() => onColumnToggle(reportType, col.key)}
                />
            ))}
        </div>
    </div>
);

const Reports = () => {

    const [activeTab, setActiveTab] = useState('customers');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedColumns, setSelectedColumns] = useState({
        customers: COLUMN_DEFINITIONS.customers.map(c => c.key),
        employees: COLUMN_DEFINITIONS.employees.map(c => c.key),
    });

    const [selectedCategory, setSelectedCategory] = useState('livestock');
    const [selectedReport, setSelectedReport] = useState(REPORT_CATEGORIES[0].reports[0].id);
    const [newReportsMode, setNewReportsMode] = useState(false); // true   false 

    const fetchReportData = useCallback(async (type) => {
        setLoading(true);
        setData(null);
        try {
            const params = { type: type };
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const response = await axios.get('/management/reports/advanced/', { params });
            setData(response.data);
        } catch (error) {
            toast.error("فشل تحميل التقرير.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    const fetchNewReport = useCallback(async () => {
        setLoading(true);
        setData(null);
        try {
            const params = { type: selectedReport, start_date: startDate, end_date: endDate };
            const response = await axios.get('/management/reports/advanced/', { params });
            setData(response.data);
        } catch (error) {
            console.error(error);
            toast.error("فشل تحميل البيانات.");
        } finally {
            setLoading(false);
        }
    }, [selectedReport, startDate, endDate]);

    useEffect(() => {
        if (!newReportsMode) {
            setData(null);
            let apiType = '';
            if (activeTab === 'customers') apiType = 'customers_list';
            else if (activeTab === 'employees') apiType = 'employees_list';
            else if (activeTab === 'customer_analytics') apiType = 'customer_analytics';
            else if (activeTab === 'livestock_analytics') apiType = 'livestock_analytics';

            if (apiType) fetchReportData(apiType);
        } else {
            fetchNewReport();
        }
    }, [activeTab, newReportsMode, fetchReportData, fetchNewReport]);

    // ---   (  ) ---
    const handleColumnToggle = (reportType, colKey) => {
        setSelectedColumns(prev => {
            const current = prev[reportType];
            if (current.includes(colKey)) {
                return { ...prev, [reportType]: current.filter(k => k !== colKey) };
            } else {
                return { ...prev, [reportType]: [...current, colKey] };
            }
        });
    };

    // ---   (  ) ---
    const getReportDateText = () => {
        const today = new Date().toLocaleDateString('en-GB');
        const start = startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'Start';
        const end = endDate ? new Date(endDate).toLocaleDateString('en-GB') : 'Now';
        return `Period: ${start} to ${end} | Generated: ${today}`;
    };

    // ---   (  ) ---
    const handlePrint = () => {
        window.print();
    };

    const getVisibleDataForExport = (rowsData, reportType) => {
        const visibleKeys = selectedColumns[reportType];
        const definitions = COLUMN_DEFINITIONS[reportType];

        const headers = definitions
            .filter(def => visibleKeys.includes(def.key))
            .map(def => def.label);

        const rows = rowsData.map(item => {
            return definitions
                .filter(def => visibleKeys.includes(def.key))
                .map(def => toEnglish(item[def.key]));
        });

        return { headers, rows };
    };

    const exportToExcel = (dataToExport, reportType, fileName) => {
        if (!dataToExport || dataToExport.length === 0) return;

        let dataArray = [];

        if (reportType === 'analytics') {
             const keys = Object.keys(dataToExport[0]);
             dataArray = [
                [fileName],
                [getReportDateText()],
                [],
                keys,
                ...dataToExport.map(item => Object.values(item).map(val => toEnglish(val)))
            ];
        } else {
            const { headers, rows } = getVisibleDataForExport(dataToExport, reportType);

            dataArray = [
                [fileName],
                [getReportDateText()],
                [`عدد السجلات: ${dataToExport.length}`],
                [],
                headers,
                ...rows
            ];
        }

        const worksheet = XLSX.utils.aoa_to_sheet(dataArray);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], {type: 'application/octet-stream'});
        saveAs(dataBlob, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const exportToWord = (elementId, fileName) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        const dateHeader = `<p style="text-align: center; font-weight: bold; margin-bottom: 20px; font-family: Arial;">${getReportDateText()}</p>`;

        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>${fileName}</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; direction: rtl; }
                td, th { border: 1px solid #000; padding: 5px; text-align: right; font-family: Arial; }
                h2 { text-align: center; font-family: Arial; }
            </style>
            </head><body>`;
        const footer = "</body></html>";

        const clone = element.cloneNode(true);
        const html = header + dateHeader + clone.innerHTML + footer;

        const blob = new Blob(['\ufeff', html], {
            type: 'application/msword'
        });
        saveAs(blob, `${fileName}.doc`);
    };

    const handleCategoryChange = (catId) => {
        setSelectedCategory(catId);
        const firstReport = REPORT_CATEGORIES.find(c => c.id === catId).reports[0];
        setSelectedReport(firstReport.id);
    };

    const currentReportDef = REPORT_CATEGORIES.find(c => c.id === selectedCategory)?.reports.find(r => r.id === selectedReport);

    // ---   (  ) ---
    const renderTable = () => {
        if (!data || !Array.isArray(data) || data.length === 0) return <div className="text-center p-4 text-muted">لا توجد بيانات للعرض.</div>;

        const cols = currentReportDef.cols || Object.keys(data[0]);

        return (
            <Table striped bordered hover responsive>
                <thead className="table-light">
                    <tr>
                        {cols.map(col => <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, idx) => (
                        <tr key={idx}>
                            {cols.map(col => (
                                <td key={col} style={{fontFamily: 'Arial'}}>
                                    {typeof row[col] === 'number' ? toEnglish(row[col]) : (row[col] || '-')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </Table>
        );
    };

    const renderChart = () => {
        if (!data) return null;

        if (currentReportDef.chartType === 'pie') {
            const chartData = Array.isArray(data) ? data :
                             (data.payment_methods || data.sales_source || data.governorate_stats || []);

            return (
                <div style={{ width: '100%', height: 400, direction: 'ltr' }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={120}
                                fill="#8884d8"
                                dataKey={chartData[0]?.count ? "count" : "value"}
                                nameKey={chartData[0]?.method ? "method" : (chartData[0]?.source ? "source" : "name")}
                                label
                            >
                                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            );
        } else {
            const chartData = Array.isArray(data) ? data : (data.popular_categories || []);
            const xKey = chartData[0]?.date ? "date" : "animal__category__name_ar";
            const yKey = chartData[0]?.avg_weight ? "avg_weight" : "count";

            return (
                <div style={{ width: '100%', height: 400, direction: 'ltr' }}>
                    <ResponsiveContainer>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={xKey} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey={yKey} fill="#82ca9d" name="القيمة" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }
    };

    const renderSummary = () => {
        if (!data) return null;
        return (
            <Row className="g-4">
                <Col md={4}><Card className="bg-success text-white text-center p-3"><h3>{toEnglish(data.total_revenue)}</h3><h6>إجمالي الإيرادات</h6></Card></Col>
                <Col md={4}><Card className="bg-danger text-white text-center p-3"><h3>{toEnglish(data.total_expenses)}</h3><h6>إجمالي المصروفات</h6></Card></Col>
                <Col md={4}><Card className="bg-primary text-white text-center p-3"><h3>{toEnglish(data.net_profit)}</h3><h6>صافي الربح</h6></Card></Col>
                <Col md={12}>
                    <h5 className="mt-4">التفاصيل:</h5>
                    <Table striped bordered>
                        <thead><tr><th>الحساب</th><th>النوع</th><th>المبلغ</th></tr></thead>
                        <tbody>
                            {data.details?.map((d, i) => (
                                <tr key={i}><td>{d.account}</td><td>{d.type}</td><td style={{fontFamily: 'Arial'}}>{toEnglish(d.amount)}</td></tr>
                            ))}
                        </tbody>
                    </Table>
                </Col>
            </Row>
        );
    };

    const handleExportNewExcel = () => {
        let exportData = Array.isArray(data) ? data : (data.details || []);
        if(currentReportDef.id === 'top_customers') exportData = data.top_customers;

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${currentReportDef.name}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const CustomersReport = () => {
        if (!data || !Array.isArray(data)) return null;

        const activeCols = COLUMN_DEFINITIONS.customers.filter(c => selectedColumns.customers.includes(c.key));

        return (
            <div id="printable-area">
                <ColumnSelector
                    reportType="customers"
                    selectedColumns={selectedColumns.customers}
                    onColumnToggle={handleColumnToggle}
                />

                <div className="d-flex justify-content-between align-items-center no-print mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <h4 className="mb-0">تقرير بيانات العملاء</h4>
                        <Badge bg="primary" pill className="fs-6">
                            {data.length} عميل
                        </Badge>
                    </div>

                    <ExportButtons
                        onExportExcel={() => exportToExcel(data, 'customers', 'Customers_Report')}
                        onExportWord={() => exportToWord('report-table-content', 'Customers_Report')}
                        onPrint={handlePrint}
                    />
                </div>

                <div id="report-table-content">
                    <h2 className="print-only-header text-center mb-2">
                        تقرير بيانات العملاء ({data.length})
                    </h2>
                    <p className="print-only-header text-center mb-4 small" style={{fontFamily: 'Arial'}}>{getReportDateText()}</p>

                    <Table bordered striped hover responsive>
                        <thead className="table-light">
                            <tr>
                                {activeCols.map(col => <th key={col.key}>{col.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}>
                                    {activeCols.map(col => (
                                        <td key={`${i}-${col.key}`} style={{fontFamily: 'Arial'}}>
                                            {col.key === 'status' ? (
                                                <span className={`badge bg-${item[col.key] === 'نشط' ? 'success' : 'danger'}`}>{item[col.key]}</span>
                                            ) : toEnglish(item[col.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        );
    };

    const EmployeesReport = () => {
        if (!data || !Array.isArray(data)) return null;

        const activeCols = COLUMN_DEFINITIONS.employees.filter(c => selectedColumns.employees.includes(c.key));

        return (
            <div id="printable-area">
                <ColumnSelector
                    reportType="employees"
                    selectedColumns={selectedColumns.employees}
                    onColumnToggle={handleColumnToggle}
                />

                <div className="d-flex justify-content-between align-items-center no-print mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <h4 className="mb-0">تقرير الموظفين والرواتب</h4>
                        <Badge bg="secondary" pill className="fs-6">
                            {data.length} موظف
                        </Badge>
                    </div>
                    <ExportButtons
                        onExportExcel={() => exportToExcel(data, 'employees', 'Employees_Report')}
                        onExportWord={() => exportToWord('report-table-content', 'Employees_Report')}
                        onPrint={handlePrint}
                    />
                </div>
                <div id="report-table-content">
                    <h2 className="print-only-header text-center mb-2">
                        تقرير الموظفين ({data.length})
                    </h2>
                    <p className="print-only-header text-center mb-4 small" style={{fontFamily: 'Arial'}}>{getReportDateText()}</p>
                    <Table bordered striped hover responsive>
                        <thead className="table-light">
                            <tr>
                                {activeCols.map(col => <th key={col.key}>{col.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}>
                                    {activeCols.map(col => (
                                        <td key={`${i}-${col.key}`} style={{fontFamily: 'Arial'}}>
                                            {col.key === 'status' ? (
                                                <span className={`badge bg-${item[col.key] === 'نشط' ? 'success' : 'secondary'}`}>{item[col.key]}</span>
                                            ) : toEnglish(item[col.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        );
    };

    const CustomerAnalytics = () => {
        if (!data || !data.governorate_stats || !data.top_customers) return null;
        const { governorate_stats, top_customers } = data;

        const COLORS = [
            '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
            '#8884d8', '#82ca9d', '#a4de6c', '#d0ed57',
            '#ffc658', '#8dd1e1'
        ];

        const prepareAnalyticsForExcel = () => {
            return top_customers.map(c => ({
                'العميل': c.user__full_name,
                'عدد الطلبات': toEnglish(c.orders_count),
                'إجمالي الشراء': toEnglish(c.total_spent)
            }));
        };

        return (
            <div id="printable-area">
                <div className="d-flex justify-content-between align-items-center no-print mb-3">
                    <h4>تحليلات العملاء</h4>
                    <ExportButtons
                        onExportExcel={() => exportToExcel(prepareAnalyticsForExcel(), 'analytics', 'Customer_Analytics')}
                        onExportWord={() => exportToWord('report-content-body', 'Customer_Analytics')}
                        onPrint={handlePrint}
                    />
                </div>

                <div id="report-content-body">
                    <p className="print-only-header text-center mb-4 small" style={{fontFamily: 'Arial'}}>{getReportDateText()}</p>
                    <Row className="mb-4">
                        <Col md={6}>
                            <Card className="h-100 shadow-sm">
                                <Card.Header>توزيع العملاء حسب المحافظة</Card.Header>
                                <Card.Body style={{ minHeight: '400px' }}>
                                    <div style={{ width: '100%', height: 350, direction: 'ltr' }}>
                                        {governorate_stats.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={governorate_stats}
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={100}
                                                        fill="#8884d8"
                                                        dataKey="count"
                                                        nameKey="governorate"
                                                        label={({name, value}) => `${name}: ${toEnglish(value)}`}
                                                        isAnimationActive={false}
                                                    >
                                                        {governorate_stats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => toEnglish(value)} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                                لا توجد بيانات كافية
                                            </div>
                                        )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={6}>
                            <Card className="h-100 shadow-sm">
                                <Card.Header>أكثر 10 عملاء شراءً</Card.Header>
                                <Card.Body>
                                    <Table size="sm" striped hover responsive>
                                        <thead><tr><th>العميل</th><th>عدد الطلبات</th><th>إجمالي المشتريات</th></tr></thead>
                                        <tbody>
                                            {top_customers.map((c, i) => (
                                                <tr key={i}>
                                                    <td>{c.user__full_name}</td>
                                                    <td style={{fontFamily: 'Arial'}}>{toEnglish(c.orders_count)}</td>
                                                    <td className="fw-bold text-success" style={{fontFamily: 'Arial'}}>{toEnglish(c.total_spent)} ج.م</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>
        );
    };

    const LivestockAnalytics = () => {
        if (!data || !data.fastest_selling || !data.popular_categories) return null;

        const { fastest_selling, popular_categories, payment_methods, sales_source, most_sold_weights } = data;
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

        const prepareLivestockExcel = () => {
            return popular_categories.map(item => ({
                'الفئة': item.animal__category__name_ar,
                'عدد المبيعات': toEnglish(item.count)
            }));
        };

        return (
            <div id="printable-area">
                <div className="d-flex justify-content-between align-items-center no-print mb-3">
                    <h4>تحليلات المواشي والمبيعات</h4>
                    <ExportButtons
                        onExportExcel={() => exportToExcel(prepareLivestockExcel(), 'analytics', 'Livestock_Analytics')}
                        onExportWord={() => exportToWord('report-content-body', 'Livestock_Analytics')}
                        onPrint={handlePrint}
                    />
                </div>

                <div id="report-content-body">
                    <p className="print-only-header text-center mb-4 small" style={{fontFamily: 'Arial'}}>{getReportDateText()}</p>
                    <Row className="g-4 mb-4">
                        <Col md={6}>
                            <Card className="shadow-sm h-100">
                                <Card.Header>أكثر الفئات مبيعاً (بالعدد)</Card.Header>
                                <Card.Body style={{ minHeight: '350px' }}>
                                    <div style={{ width: '100%', height: 300, direction: 'ltr' }}>
                                        <ResponsiveContainer>
                                            <BarChart
                                                data={popular_categories}
                                                layout="vertical"
                                                margin={{ left: 20, right: 30, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" tickFormatter={toEnglish} />
                                                <YAxis dataKey="animal__category__name_ar" type="category" width={100} />
                                                <Tooltip formatter={(value) => toEnglish(value)} />
                                                <Legend />
                                                <Bar dataKey="count" name="عدد المبيعات" fill="#82ca9d" isAnimationActive={false} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={6}>
                            <Card className="shadow-sm h-100">
                                <Card.Header>أسرع الفئات بيعاً (متوسط الأيام)</Card.Header>
                                <Card.Body>
                                    <Table size="sm" striped>
                                        <thead><tr><th>الفئة</th><th>متوسط أيام البيع</th><th>التقييم</th></tr></thead>
                                        <tbody>
                                            {fastest_selling.map((item, i) => (
                                                <tr key={i}>
                                                    <td>{item.category}</td>
                                                    <td className="fw-bold" style={{fontFamily: 'Arial'}}>{toEnglish(item.avg_days)} يوم</td>
                                                    <td>
                                                        {item.avg_days < 7 ? <span className="text-success fw-bold">سريع 🔥</span> :
                                                         item.avg_days < 30 ? <span className="text-primary">متوسط</span> :
                                                         <span className="text-danger">بطيء</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={4}>
                             <Card className="shadow-sm h-100">
                                <Card.Header>طرق الدفع المفضلة</Card.Header>
                                <Card.Body style={{ minHeight: '300px' }}>
                                    <div style={{ width: '100%', height: 250, direction: 'ltr' }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={payment_methods}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="count"
                                                    nameKey="method"
                                                    label={({name, value}) => `${name}: ${toEnglish(value)}`}
                                                    isAnimationActive={false}
                                                >
                                                    {payment_methods && payment_methods.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => toEnglish(value)} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={4}>
                             <Card className="shadow-sm h-100">
                                <Card.Header>مصدر الطلبات</Card.Header>
                                <Card.Body style={{ minHeight: '300px' }}>
                                    <div style={{ width: '100%', height: 250, direction: 'ltr' }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={sales_source}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    fill="#82ca9d"
                                                    dataKey="count"
                                                    nameKey="source"
                                                    label={({name, value}) => `${name}: ${toEnglish(value)}`}
                                                    isAnimationActive={false}
                                                >
                                                     {sales_source && sales_source.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => toEnglish(value)} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                         <Col md={4}>
                            <Card className="shadow-sm h-100">
                                <Card.Header>أكثر الأوزان مبيعاً</Card.Header>
                                <Card.Body>
                                    <Table size="sm" striped>
                                        <thead><tr><th>نطاق الوزن</th><th>عدد المبيعات</th></tr></thead>
                                        <tbody>
                                            {most_sold_weights && most_sold_weights.map((item, i) => (
                                                <tr key={i}>
                                                    <td style={{fontFamily: 'Arial'}}>{toEnglish(item.weight_range)}</td>
                                                    <td className="fw-bold" style={{fontFamily: 'Arial'}}>{toEnglish(item.count)}</td>
                                                </tr>
                                            ))}
                                            {!most_sold_weights || most_sold_weights.length === 0 && <tr><td colSpan="2">لا توجد بيانات</td></tr>}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>
        );
    };

    const ModeSwitch = () => (
        <div className="d-flex justify-content-center mb-4 no-print">
            <div className="btn-group" role="group">
                <Button
                    variant={!newReportsMode ? "primary" : "outline-primary"}
                    onClick={() => setNewReportsMode(false)}
                    className="px-4"
                >
                    التقارير الأساسية
                </Button>
                <Button
                    variant={newReportsMode ? "primary" : "outline-primary"}
                    onClick={() => setNewReportsMode(true)}
                    className="px-4"
                >
                    التقارير المتقدمة
                </Button>
            </div>
        </div>
    );

    return (
        <div>
            <h1 className="mb-4 no-print">مركز التقارير المتقدمة</h1>

            <ModeSwitch />

            {!newReportsMode ? (
                // ---   ( ) ---
                <>
                    <Card className="shadow-sm mb-4 no-print border-primary">
                        <Card.Body>
                            <Form className="row g-3 align-items-end">
                                <Col md={4}>
                                    <Form.Label>من تاريخ</Form.Label>
                                    <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </Col>
                                <Col md={4}>
                                    <Form.Label>إلى تاريخ</Form.Label>
                                    <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </Col>
                                <Col md={4}>
                                    <Button variant="primary" className="w-100" onClick={() => fetchReportData(
                                        activeTab === 'customers' ? 'customers_list' :
                                        activeTab === 'employees' ? 'employees_list' :
                                        activeTab === 'customer_analytics' ? 'customer_analytics' : 'livestock_analytics'
                                    )}>
                                        تطبيق الفلتر
                                    </Button>
                                </Col>
                            </Form>
                        </Card.Body>
                    </Card>

                    <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                        <Card className="shadow-sm mb-3 no-print">
                            <Card.Body className="p-2">
                                <Nav variant="pills" className="justify-content-center">
                                    <Nav.Item><Nav.Link eventKey="customers"><Users size={18} className="me-2"/>قائمة العملاء</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="employees"><Briefcase size={18} className="me-2"/>الموظفين والرواتب</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="customer_analytics"><BarChart2 size={18} className="me-2"/>تحليلات العملاء</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="livestock_analytics"><Beef size={18} className="me-2"/>تحليلات المواشي</Nav.Link></Nav.Item>
                                </Nav>
                            </Card.Body>
                        </Card>

                        <div className="report-content">
                            {loading ? (
                                <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
                            ) : (
                                <Tab.Content>
                                    <Tab.Pane eventKey="customers"><CustomersReport /></Tab.Pane>
                                    <Tab.Pane eventKey="employees"><EmployeesReport /></Tab.Pane>
                                    <Tab.Pane eventKey="customer_analytics"><CustomerAnalytics /></Tab.Pane>
                                    <Tab.Pane eventKey="livestock_analytics"><LivestockAnalytics /></Tab.Pane>
                                </Tab.Content>
                            )}
                        </div>
                    </Tab.Container>
                </>
            ) : (
                // ---   ( ) ---
                <div className="container-fluid">
                    <div className="d-flex justify-content-between align-items-center mb-4 no-print">
                        <h2 className="mb-0">التقارير المتقدمة</h2>
                        <div className="d-flex gap-2">
                            <Button variant="outline-success" size="sm" onClick={handleExportNewExcel} disabled={!data}>
                                <Download size={16} className="me-1"/> تصدير Excel
                            </Button>
                            <Button variant="secondary" size="sm" onClick={handlePrint}>
                                <Printer size={16} className="me-1"/> طباعة
                            </Button>
                        </div>
                    </div>

                    <Row>
                        {/*   () */}
                        <Col md={3} lg={2} className="mb-3 no-print">
                            <Card className="shadow-sm h-100">
                                <Card.Body className="p-2">
                                    <Nav variant="pills" className="flex-column gap-1">
                                        {REPORT_CATEGORIES.map(cat => (
                                            <Nav.Item key={cat.id}>
                                                <Nav.Link
                                                    active={selectedCategory === cat.id}
                                                    onClick={() => handleCategoryChange(cat.id)}
                                                    className="d-flex align-items-center gap-2"
                                                >
                                                    {cat.icon} {cat.name}
                                                </Nav.Link>
                                            </Nav.Item>
                                        ))}
                                    </Nav>
                                </Card.Body>
                            </Card>
                        </Col>

                        {}
                        <Col md={9} lg={10}>
                            <Card className="shadow-sm mb-3 no-print border-light">
                                <Card.Body className="py-2">
                                    <div className="d-flex flex-wrap gap-2 align-items-center">
                                        {}
                                        <Nav variant="tabs" className="flex-grow-1 border-bottom-0">
                                            {REPORT_CATEGORIES.find(c => c.id === selectedCategory).reports.map(rep => (
                                                <Nav.Item key={rep.id}>
                                                    <Nav.Link
                                                        active={selectedReport === rep.id}
                                                        onClick={() => setSelectedReport(rep.id)}
                                                        className="py-1 px-3 small"
                                                    >
                                                        {rep.name}
                                                    </Nav.Link>
                                                </Nav.Item>
                                            ))}
                                        </Nav>
                                        {}
                                        <div className="d-flex gap-2 align-items-center border-start ps-2">
                                            <Form.Control type="date" size="sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                            <span className="text-muted">-</span>
                                            <Form.Control type="date" size="sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                            <Button size="sm" onClick={fetchNewReport}><Filter size={14}/></Button>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>

                            <div id="printable-area" className="bg-white p-4 rounded shadow-sm" style={{minHeight: '500px'}}>
                                <div className="text-center mb-4">
                                    <h3 className="fw-bold text-primary">{currentReportDef.name}</h3>
                                    <p className="text-muted small">
                                        الفترة: {startDate || 'البداية'} إلى {endDate || 'الآن'} | تاريخ التقرير: {new Date().toLocaleDateString('en-GB')}
                                    </p>
                                </div>

                                {loading ? (
                                    <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                                ) : (
                                    <>
                                        {currentReportDef.type === 'chart' ? renderChart() :
                                         currentReportDef.type === 'summary' ? renderSummary() :
                                         currentReportDef.id === 'top_customers' ? <CustomerAnalyticsRender data={data} /> :
                                         renderTable()}
                                    </>
                                )}
                            </div>
                        </Col>
                    </Row>
                </div>
            )}

            <style>{`
                .print-only-header {
                    display: none;
                }

                @media print {
                    body * {
                        visibility: hidden;
                    }

                    html, body, #root, .app-container, .main-content, .page-content {
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }

                    .sidebar-container, .app-header, .no-print {
                        display: none !important;
                    }

                    #printable-area, #printable-area * {
                        visibility: visible !important;
                    }

                    #printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }

                    .print-only-header {
                        display: block !important;
                    }

                    .card {
                        border: 1px solid #000 !important;
                        box-shadow: none !important;
                        break-inside: avoid;
                    }

                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #000 !important;
                        color: #000 !important;
                    }

                    ::-webkit-scrollbar {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

//    (  )
const CustomerAnalyticsRender = ({ data }) => {
    if (!data?.top_customers) return null;
    return (
        <Row>
            <Col md={12}>
                <h5>أكثر 10 عملاء شراءً</h5>
                <Table striped bordered hover>
                    <thead><tr><th>العميل</th><th>عدد الطلبات</th><th>إجمالي المشتريات</th></tr></thead>
                    <tbody>
                        {data.top_customers.map((c, i) => (
                            <tr key={i}><td>{c.user__full_name}</td><td>{toEnglish(c.orders_count)}</td><td>{toEnglish(c.total_spent)}</td></tr>
                        ))}
                    </tbody>
                </Table>
            </Col>
        </Row>
    );
}

export default Reports;
