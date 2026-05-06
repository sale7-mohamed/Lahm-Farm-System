import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Form, Tab, Nav, Table, Badge, Spinner, Row, Col, Modal, InputGroup } from 'react-bootstrap';
import {
  Send, Settings, List, BellRing, Smartphone, Beef, Sparkles, Tag, Package,
  RotateCcw, Mail, Calendar, CheckCircle, XCircle, Save, AlertTriangle, Globe, Search,
  Users, RefreshCw
} from 'lucide-react';

const formatEgyptianPhone = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('201') && cleaned.length === 12) return '0' + cleaned.substring(2);
    if (cleaned.startsWith('00201') && cleaned.length === 14) return '0' + cleaned.substring(4);
    if (cleaned.startsWith('01') && cleaned.length === 11) return cleaned;
    return phone;
};

const extractProviderInfo = (responseStr) => {
    if (!responseStr) return { provider: 'غير محدد', text: '' };

    let provider = 'النظام';
    let text = responseStr;

    const match = responseStr.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
        provider = match[1];
        text = match[2];
    } else {
        const lowerStr = responseStr.toLowerCase();
        if (lowerStr.includes('whysms')) provider = 'WhySMS';
        else if (lowerStr.includes('arpuplus') || lowerStr.includes('arpu')) provider = 'ArpuPlus';
        else if (lowerStr.includes('we')) provider = 'WE Business';
    }

    const pLower = provider.toLowerCase();
    if(pLower.includes('why')) provider = 'WhySMS';
    else if(pLower.includes('arpu')) provider = 'ArpuPlus';
    else if(pLower.includes('we')) provider = 'WE Business';

    let readableText = text;
    try {
        if (text.includes('{')) {
            const msgMatch = text.match(/['"]message['"]\s*:\s*['"]([^'"]+)['"]/i);
            const descMatch = text.match(/['"]status_description['"]\s*:\s*['"]([^'"]+)['"]/i);

            if (msgMatch && msgMatch[1]) {
                readableText = msgMatch[1];
            } else if (descMatch && descMatch[1]) {
                readableText = descMatch[1];
            } else {
                readableText = "عملية مسجلة";
            }

            const lowerReadable = readableText.toLowerCase();
            if (lowerReadable.includes('successfully delivered') || lowerReadable.includes('success')) {
                readableText = "تم إرسال الرسالة للمزود بنجاح";
            } else if (lowerReadable.includes('insufficient balance')) {
                readableText = "الرصيد غير كافٍ";
            } else if (lowerReadable.includes('invalid')) {
                readableText = "رقم غير صحيح أو خطأ بالبيانات";
            }
        }
    } catch {
        readableText = text;
    }

    return { provider, text: readableText };
};

const getProviderBadgeColor = (providerName) => {
    const name = providerName.toLowerCase();
    if (name.includes('why')) return 'primary';
    if (name.includes('arpu')) return 'warning';
    if (name.includes('we')) return 'success';
    return 'secondary';
};

const formatDateTimeEn = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).toUpperCase().replace(',', '');
};

const LiveProviderStatus = ({ providerName }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!providerName) return;
    setLoading(true);
    axios.get(`/messaging/provider-info/?provider=${providerName}`)
      .then(res => setInfo(res.data))
      .catch(() => setInfo({ type: 'error', message: 'فشل الاتصال بالمزود' }))
      .finally(() => setLoading(false));
  }, [providerName]);

  if (loading) return (
    <div className="text-center p-2">
      <Spinner size="sm" variant="primary" /> <span className="small text-muted">جاري فحص السيرفر...</span>
    </div>
  );
  if (!info) return null;

  if (info.type === 'error') {
    return (
      <div className="bg-danger bg-opacity-10 p-3 mt-2 rounded border border-danger d-flex align-items-center gap-2">
        <AlertTriangle size={20} className="text-danger" />
        <span className="text-danger fw-bold">{info.message}</span>
      </div>
    );
  }

  if (info.type?.includes('Arpu') || info.type?.includes('WE')) {
    return (
      <div className="bg-white p-3 mt-2 rounded border border-success shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="text-success fw-bold d-flex align-items-center gap-1">
            <CheckCircle size={16} /> متصل بـ {info.type}
          </span>
          {info.account_type && (
            <Badge bg={info.account_type === 'Prepaid' ? 'primary' : 'warning'} text={info.account_type === 'Prepaid' ? 'white' : 'dark'}>
              {info.account_type}
            </Badge>
          )}
        </div>
        <div className="bg-light p-2 rounded text-center">
          <small className="text-muted d-block">الرصيد المتاح حالياً</small>
          <h4 className="text-dark mb-0 fw-black" dir="ltr">
            {info.credit || 0} <span className="fs-6 text-muted">{info.currency || 'رسالة'}</span>
          </h4>
        </div>
      </div>
    );
  }

  if (info.type?.includes('WhySMS')) {
    return (
      <div className="bg-white p-3 mt-2 rounded border border-info shadow-sm">
        <span className="text-info fw-bold d-flex align-items-center gap-1">
          <CheckCircle size={16} /> متصل بـ {info.type}
        </span>
        <p className="small text-muted mt-2 mb-0 bg-light p-2 rounded">
          لا يدعم الاستعلام عن الرصيد، ولكن تم جلب <strong>{info.logs?.length || 0}</strong> سجل رسالة بنجاح.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-3 mt-2 rounded border border-secondary shadow-sm">
      <span className="text-secondary fw-bold d-flex align-items-center gap-1">
        <CheckCircle size={16} /> {info.type}
      </span>
      <p className="small text-muted mt-2 mb-0 bg-light p-2 rounded">{info.message}</p>
    </div>
  );
};

const TemplateCard = ({ template, onToggleActive, onSaveContent }) => {
  const [localContent, setLocalContent] = useState(template.content);
  const isChanged = localContent !== template.content;

  useEffect(() => {
    setLocalContent(template.content);
  }, [template.content]);

  return (
    <Col xs={12}>
      <Card className="mb-3 border-light shadow-sm">
        <Card.Header className="bg-light border-bottom py-2 d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0 text-primary">{template.key}</h6>
          <Form.Check
            type="switch"
            checked={template.is_active}
            label="مفعل"
            onChange={(e) => onToggleActive(template.id, e.target.checked)}
          />
        </Card.Header>
        <Card.Body className="p-3">
          <Form.Control
            as="textarea"
            rows={2}
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            className="mb-2 bg-white"
          />
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <small className="text-muted">
              المتغيرات: <span dir="ltr" className="fw-bold">{"{name}, {id}, {total}, {code}"}</span>
            </small>
            <Button
              variant={isChanged ? "primary" : "outline-secondary"}
              size="sm"
              disabled={!isChanged}
              onClick={() => onSaveContent(template.id, localContent)}
              className="fw-bold"
            >
              <Save size={16} className="me-1" />
              حفظ التعديل
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
};

const FilterAndStatsHeader = ({
  stats, typeName, searchTerm, setSearchTerm,
  startDate, setStartDate, endDate, setEndDate,
  showProviderFilter = false, providerFilter, setProviderFilter
}) => (
  <div className="mb-4 bg-white p-3 rounded-3 border shadow-sm">
    <Row className="g-2 align-items-center mb-3">
      <Col md={showProviderFilter ? 3 : 4}>
        <InputGroup>
          <InputGroup.Text><Search size={16} /></InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="ابحث بالرقم أو النص..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </Col>

      {showProviderFilter && (
        <Col md={2}>
          <Form.Select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
            <option value="all">كل المزودين</option>
            <option value="whysms">WhySMS</option>
            <option value="arpu">ArpuPlus</option>
            <option value="we">WE Business</option>
          </Form.Select>
        </Col>
      )}

      <Col md={showProviderFilter ? 3 : 3}>
        <div className="d-flex align-items-center gap-2">
          <Calendar size={18} className="text-muted flex-shrink-0" />
          <Form.Control
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            size="sm"
          />
        </div>
      </Col>
      <Col md={showProviderFilter ? 2 : 3}>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted">إلى</span>
          <Form.Control
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            size="sm"
          />
        </div>
      </Col>
      <Col md={2}>
        <Button
          variant="outline-danger"
          size="sm"
          className="w-100"
          onClick={() => {
            setSearchTerm('');
            setStartDate('');
            setEndDate('');
            if(showProviderFilter) setProviderFilter('all');
          }}
        >
          مسح الفلتر
        </Button>
      </Col>
    </Row>

    <Row className="g-2 text-center">
      <Col xs={4}>
        <div className="bg-primary bg-opacity-10 p-2 rounded border border-primary">
          <small className="d-block text-primary fw-bold">إجمالي {typeName}</small>
          <strong className="fs-5 text-primary">{stats.total}</strong>
        </div>
      </Col>
      <Col xs={4}>
        <div className="bg-success bg-opacity-10 p-2 rounded border border-success">
          <small className="d-block text-success fw-bold d-flex justify-content-center align-items-center gap-1">
            <CheckCircle size={14} /> ناجح
          </small>
          <strong className="fs-5 text-success">{stats.success}</strong>
        </div>
      </Col>
      <Col xs={4}>
        <div className="bg-danger bg-opacity-10 p-2 rounded border border-danger">
          <small className="d-block text-danger fw-bold d-flex justify-content-center align-items-center gap-1">
            <XCircle size={14} /> فشل
          </small>
          <strong className="fs-5 text-danger">{stats.failed}</strong>
        </div>
      </Col>
    </Row>
  </div>
);

const SMSManager = () => {
  const [activeTab, setActiveTab] = useState('push');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [msgTypeFilter, setMsgTypeFilter] = useState('all');
  const [viewGroupedRecipients, setViewGroupedRecipients] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState('');

  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushCategory, setPushCategory] = useState('general');
  const [pushTargetType, setPushTargetType] = useState('all');
  const [pushTargetPhone, setPushTargetPhone] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  const [manualPhones, setManualPhones] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [viewFullMsg, setViewFullMsg] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const [selectedAudience, setSelectedAudience] = useState('all');
  const [fetchingAudience, setFetchingAudience] = useState(false);
  const [newCustomersDays, setNewCustomersDays] = useState(30);

  const [templates, setTemplates] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [pushLogs, setPushLogs] = useState([]);
  const [activeProvider, setActiveProvider] = useState('');

  const [showExternalLogs, setShowExternalLogs] = useState(false);
  const [externalLogsData, setExternalLogsData] = useState([]);
  const [loadingExternal, setLoadingExternal] = useState(false);

  const getValidPhones = (rawInput) => {
    return rawInput
      .split(/[\n,]+/)
      .map(p => p.replace(/\D/g, '').trim())
      .filter(p => /^01[0-9]{9}$/.test(p) || /^201[0-9]{9}$/.test(p));
  };

  const fetchExternalWhySMSLogs = async () => {
    setLoadingExternal(true);
    setShowExternalLogs(true);
    try {
        const res = await axios.get('/messaging/external-logs/');
        const logsData = res.data?.logs || res.data?.data || [];
        setExternalLogsData(Array.isArray(logsData) ? logsData : []);
    } catch {
        toast.error("فشل الاتصال بسيرفر WhySMS");
        setExternalLogsData([]);
    } finally {
        setLoadingExternal(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [tplRes, smsRes, pushRes, configRes] = await Promise.all([
        axios.get('/messaging/templates/'),
        axios.get('/messaging/logs/'),
        axios.get('/management/all-notifications/'),
        axios.get('/messaging/config/').catch(() => ({ data: {} }))
      ]);

      setTemplates(tplRes.data.results || tplRes.data || []);

      const allMessageLogs = smsRes.data.results || smsRes.data || [];
      const manualGroups = {};
      const systemSmsLogs = [];
      const finalEmailLogs = [];

      allMessageLogs.forEach(log => {
        if (log.message_type === 'EMAIL') {
          finalEmailLogs.push(log);
        } else if (log.message_type === 'MANUAL') {
          if (!manualGroups[log.content]) {
            manualGroups[log.content] = {
              ...log,
              is_grouped: true,
              recipients_list: [log]
            };
          } else {
            manualGroups[log.content].recipients_list.push(log);
          }
        } else {
          systemSmsLogs.push(log);
        }
      });

      const groupedManualLogs = Object.values(manualGroups);
      const finalSmsLogs = [...systemSmsLogs, ...groupedManualLogs];
      finalSmsLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setSmsLogs(finalSmsLogs);
      setEmailLogs(finalEmailLogs);
      setPushLogs(pushRes.data.results || pushRes.data || []);

      const provider = configRes.data?.provider || configRes.data?.sms_provider || '';
      setActiveProvider(provider);
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل البيانات');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterLogs = (logs, isSMS = false) => {
    return logs.filter((log) => {
      const logDate = new Date(log.created_at);
      const matchesSearch = log.recipient?.includes(searchTerm) || log.content?.includes(searchTerm) || log.subject?.includes(searchTerm);

      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && logDate >= new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && logDate <= end;
      }

      let matchesProvider = true;
      let matchesType = true;

      if (isSMS) {
        if (providerFilter !== 'all') {
          const { provider } = extractProviderInfo(log.provider_response);
          matchesProvider = provider.toLowerCase().includes(providerFilter.toLowerCase());
        }
        if (msgTypeFilter !== 'all') {
          matchesType = log.message_type === msgTypeFilter;
        }
      }

      return matchesSearch && matchesDate && matchesProvider && matchesType;
    });
  };

  const filteredSms = filterLogs(smsLogs, true);
  const filteredEmails = filterLogs(emailLogs, false);

  const getStats = (filteredList) => ({
    total: filteredList.length,
    success: filteredList.filter((l) => l.status === 'sent').length,
    failed: filteredList.filter((l) => l.status !== 'sent').length,
  });

  const smsStats = getStats(filteredSms);
  const emailStats = getStats(filteredEmails);

  const handleRestoreDefaults = async () => {
    if (!window.confirm('هل أنت متأكد من استعادة نصوص القوالب الافتراضية؟')) return;
    try {
      await axios.post('/messaging/templates/init_defaults/');
      toast.success('تم استعادة القوالب الافتراضية بنجاح.');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('فشل استعادة القوالب.');
    }
  };

  const handleFetchAudience = async () => {
    setFetchingAudience(true);
    try {
      const res = await axios.post('/messaging/send/fetch_audience_phones/', {
        audience: selectedAudience,
        days: newCustomersDays
      });
      const newPhones = (res.data.phones || []).map(p => p.replace('+', ''));

      if (newPhones.length === 0) {
        toast.info('لا يوجد عملاء يطابقون هذا الفلتر.');
        return;
      }

      const currentPhones = manualPhones.split(/[\n,]+/).map(p => p.trim()).filter(p => p);
      const mergedSet = new Set([...currentPhones, ...newPhones]);
      setManualPhones(Array.from(mergedSet).join('\n'));
      toast.success(`تم استيراد ${newPhones.length} رقم بنجاح (بدون تكرار).`);
    } catch (err) {
      toast.error('فشل جلب أرقام العملاء.');
    } finally {
      setFetchingAudience(false);
    }
  };

  const handleSendPush = async (e) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim())
      return toast.warn('يرجى إدخال عنوان ونص الإشعار');

    if (pushTargetType === 'single' && !pushTargetPhone.trim()) {
      return toast.warn('يرجى إدخال رقم هاتف العميل');
    }

    const confirmMsg =
      pushTargetType === 'all'
        ? `هل أنت متأكد من إرسال هذا الإشعار لجميع العملاء المسجلين؟`
        : `هل أنت متأكد من إرسال الإشعار لرقم: ${pushTargetPhone}؟`;

    if (!window.confirm(confirmMsg)) return;

    setIsPushing(true);
    try {
      const url =
        pushTargetType === 'all'
          ? '/messaging/send/push_global/'
          : '/messaging/send/push_single/';
      const payload = {
        title: pushTitle,
        message: pushMessage,
        category: pushCategory,
        phone: pushTargetType === 'single' ? pushTargetPhone : undefined,
      };

      const res = await axios.post(url, payload);
      toast.success(res.data.detail);
      setPushTitle('');
      setPushMessage('');
      setPushTargetPhone('');
      setTimeout(() => fetchData(), 1500);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'فشل إرسال الإشعار');
    } finally {
      setIsPushing(false);
    }
  };

  const handleSendManual = async (e) => {
    e.preventDefault();

    const rawPhones = getValidPhones(manualPhones);

    if (rawPhones.length === 0) {
      return toast.warn('يرجى إدخال أرقام هواتف صحيحة (11 رقم تبدأ بـ 01 أو 12 رقم تبدأ بـ 201).');
    }

    if (manualMessage.trim().length < 5) {
      return toast.warn('يجب أن تتكون الرسالة من 5 حروف على الأقل.');
    }

    setIsSending(true);
    try {
      const res = await axios.post('/messaging/send/bulk_send/', {
        phones: rawPhones,
        message: manualMessage.trim(),
      });

      if (res.data.success) {
        toast.success(res.data.detail);
      } else {
        toast.warning(res.data.detail || 'حدث خطأ غير متوقع');
      }
      setManualPhones('');
      setManualMessage('');
      fetchData();
    } catch (error) {
      console.error('SMS Send Error:', error);
      toast.error(error.response?.data?.detail || 'فشل الإرسال، راجع سجل الرسائل لمعرفة السبب.');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleTemplateActive = async (id, isActive) => {
    try {
      await axios.patch(`/messaging/templates/${id}/`, { is_active: isActive });
      toast.success('تم تحديث حالة القالب');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleSaveTemplateContent = async (id, content) => {
    try {
      await axios.patch(`/messaging/templates/${id}/`, { content });
      toast.success('تم حفظ القالب');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('فشل الحفظ');
    }
  };

  const getPreviewIcon = () => {
    if (
      pushTitle.includes('عرض') ||
      pushTitle.includes('خصم') ||
      pushTitle.includes('🎉')
    )
      return <Tag size={24} className="text-white" />;
    if (
      pushTitle.includes('عيد') ||
      pushTitle.includes('رمضان') ||
      pushTitle.includes('🌙')
    )
      return <Sparkles size={24} className="text-white" />;
    switch (pushCategory) {
      case 'order':
        return <Package size={24} className="text-white" />;
      case 'livestock':
        return <Beef size={24} className="text-white" />;
      default:
        return <BellRing size={24} className="text-white" />;
    }
  };

  const getPreviewColor = () => {
    if (
      pushTitle.includes('عرض') ||
      pushTitle.includes('خصم') ||
      pushTitle.includes('🎉')
    )
      return 'bg-danger';
    if (
      pushTitle.includes('عيد') ||
      pushTitle.includes('رمضان') ||
      pushTitle.includes('🌙')
    )
      return 'bg-warning';
    switch (pushCategory) {
      case 'order':
        return 'bg-primary';
      case 'livestock':
        return 'bg-success';
      default:
        return 'bg-info';
    }
  };

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 fw-bold mb-1">مدير التواصل والإشعارات</h1>
      <p className="text-muted mb-4">
        إرسال الإشعارات وتتبع رسائل الـ SMS والإيميلات للعملاء
      </p>

      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white p-0 border-bottom-0">
            <Nav
              variant="tabs"
              className="px-3 pt-3 flex-nowrap overflow-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              <Nav.Item>
                <Nav.Link eventKey="push" className="fw-bold px-4 py-3 d-flex gap-2">
                  <BellRing size={18} /> إشعارات للموقع
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="send" className="fw-bold px-4 py-3 d-flex gap-2">
                  <Smartphone size={18} /> إرسال SMS
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="templates" className="fw-bold px-4 py-3 d-flex gap-2">
                  <Settings size={18} /> القوالب
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="sms_logs" className="fw-bold px-4 py-3 d-flex gap-2">
                  <List size={18} /> سجل SMS
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="email_logs" className="fw-bold px-4 py-3 d-flex gap-2">
                  <Mail size={18} /> سجل الإيميلات
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="push_logs" className="fw-bold px-4 py-3 d-flex gap-2">
                  <BellRing size={18} /> سجل الإشعارات
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>
          <Card.Body className="bg-light p-4">
            <Tab.Content>
              <Tab.Pane eventKey="push">
                <Row className="g-4">
                  <Col lg={7}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body className="p-4">
                        <Form onSubmit={handleSendPush}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small">
                              إرسال الإشعار إلى
                            </Form.Label>
                            <Form.Select
                              value={pushTargetType}
                              onChange={(e) => setPushTargetType(e.target.value)}
                            >
                              <option value="all">الجميع (كل العملاء المسجلين)</option>
                              <option value="single">عميل محدد (رقم هاتف)</option>
                            </Form.Select>
                          </Form.Group>

                          {pushTargetType === 'single' && (
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-bold small">
                                رقم هاتف العميل *
                              </Form.Label>
                              <Form.Control
                                type="tel"
                                dir="ltr"
                                placeholder="مثال: 010xxxxxxxx"
                                value={pushTargetPhone}
                                onChange={(e) =>
                                  setPushTargetPhone(e.target.value.replace(/\D/g, ''))
                                }
                                required
                              />
                            </Form.Group>
                          )}

                          <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small">عنوان الإشعار</Form.Label>
                            <Form.Control
                              type="text"
                              value={pushTitle}
                              onChange={(e) => setPushTitle(e.target.value)}
                              required
                            />
                          </Form.Group>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small">نص الإشعار</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={pushMessage}
                              onChange={(e) => setPushMessage(e.target.value)}
                              required
                            />
                          </Form.Group>
                          <Form.Group className="mb-4">
                            <Form.Label className="fw-bold small">
                              تصنيف الإشعار (يحدد الأيقونة للعميل)
                            </Form.Label>
                            <Form.Select
                              value={pushCategory}
                              onChange={(e) => setPushCategory(e.target.value)}
                            >
                              <option value="general">إعلان عام</option>
                              <option value="livestock">عروض مواشي</option>
                              <option value="order">طلبات</option>
                            </Form.Select>
                          </Form.Group>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={isPushing}
                            className="w-100 py-3 fw-bold"
                          >
                            {isPushing ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <BellRing size={18} className="me-2" /> إرسال الإشعار
                              </>
                            )}
                          </Button>
                        </Form>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col lg={5}>
                    <Card className="border-0 shadow-sm h-100 bg-white">
                      <Card.Body className="p-4 d-flex flex-column justify-content-center">
                        <h6 className="fw-bold mb-4 text-muted text-center">المعاينة</h6>
                        <div className="p-4 rounded-4 border shadow-sm mx-auto w-100">
                          <div className="d-flex gap-3 align-items-center">
                            <div
                              className={`flex-shrink-0 rounded-3 d-flex align-items-center justify-content-center shadow-sm ${getPreviewColor()}`}
                              style={{ width: '56px', height: '56px' }}
                            >
                              {getPreviewIcon()}
                            </div>
                            <div>
                              <h6 className="fw-bolder text-dark mb-1">
                                {pushTitle || 'العنوان هنا'}
                              </h6>
                              <p className="text-muted small mb-0">
                                {pushMessage || 'نص الإشعار...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              <Tab.Pane eventKey="send">
                <Row className="justify-content-center">
                  <Col md={8}>
                    <Card className="border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <LiveProviderStatus providerName={activeProvider} />
                        <hr />

                        <div className="bg-light p-3 rounded border mb-3">
                          <Form.Label className="fw-bold small d-flex align-items-center gap-2">
                            <Users size={16} className="text-primary"/>
                            استيراد أرقام العملاء من النظام
                          </Form.Label>
                          <div className="d-flex gap-2 flex-wrap align-items-center">
                            <Form.Select
                              value={selectedAudience}
                              onChange={(e) => setSelectedAudience(e.target.value)}
                              size="sm"
                              className="fw-bold flex-grow-1 w-auto"
                            >
                              <option value="all">كل العملاء بالسيستم</option>
                              <option value="has_orders">العملاء الذين لديهم طلبات (مؤكدة أو سابقة)</option>
                              <option value="verified">الحسابات المفعلة (أكدوا أرقامهم)</option>
                              <option value="unverified">الحسابات غير المفعلة</option>
                              <option value="new">العملاء الجدد فقط</option>
                            </Form.Select>

                            {selectedAudience === 'new' && (
                              <div className="d-flex align-items-center gap-2">
                                <span className="small fw-bold text-muted text-nowrap">آخر</span>
                                <Form.Control
                                  type="number"
                                  size="sm"
                                  value={newCustomersDays}
                                  onChange={(e) => setNewCustomersDays(e.target.value)}
                                  style={{ width: '70px' }}
                                  min="1"
                                />
                                <span className="small fw-bold text-muted text-nowrap">يوم</span>
                              </div>
                            )}

                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleFetchAudience}
                              disabled={fetchingAudience}
                              className="text-nowrap"
                            >
                              {fetchingAudience ? <Spinner size="sm"/> : 'إدراج الأرقام'}
                            </Button>
                          </div>
                        </div>

                        <Form onSubmit={handleSendManual}>
                          <Form.Group className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <Form.Label className="fw-bold small m-0">
                                أرقام الهواتف
                              </Form.Label>
                              <Badge bg="info" className="text-dark">
                                أرقام صالحة:{' '}
                                {getValidPhones(manualPhones).length}
                              </Badge>
                            </div>
                            <Form.Control
                              as="textarea"
                              rows={5}
                              value={manualPhones}
                              onChange={(e) =>
                                setManualPhones(e.target.value.replace(/[^0-9\n,]/g, ''))
                              }
                              placeholder="مثال:&#10;201234567890&#10;01234567890"
                              dir="ltr"
                              className="font-monospace"
                            />
                            <Form.Text className="text-muted small d-block mt-2 p-2 bg-light rounded border">
                              <strong className="text-primary d-block mb-1">
                                💡 الصيغ المدعومة للأرقام المصرية:
                              </strong>
                              <div className="d-flex flex-wrap gap-3">
                                <span>
                                  ✔️ بالصيغة المحلية:{' '}
                                  <span dir="ltr" className="fw-bold">
                                    01xxxxxxxxx
                                  </span>
                                </span>
                                <span>
                                  ✔️ بكود الدولة:{' '}
                                  <span dir="ltr" className="fw-bold">
                                    201xxxxxxxxx
                                  </span>
                                </span>
                              </div>
                              <div className="text-danger mt-2 fw-bold">
                                * افصل بين الأرقام بفاصلة (,) أو سطر جديد (Enter).
                              </div>
                            </Form.Text>
                          </Form.Group>

                          <Form.Group className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <Form.Label className="fw-bold small m-0">
                                نص الرسالة (SMS)
                              </Form.Label>
                              <Badge bg={manualMessage.length < 5 ? 'danger' : 'success'}>
                                عدد الحروف: {manualMessage.length} (الحد الأدنى 5)
                              </Badge>
                            </div>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              value={manualMessage}
                              onChange={(e) => setManualMessage(e.target.value)}
                              placeholder="اكتب رسالتك هنا..."
                              isInvalid={
                                manualMessage.length > 0 && manualMessage.length < 5
                              }
                            />
                          </Form.Group>

                          <Button
                            type="submit"
                            variant="dark"
                            disabled={
                              isSending ||
                              manualMessage.trim().length < 5 ||
                              getValidPhones(manualPhones).length === 0
                            }
                            className="w-100 py-3 fw-bold"
                          >
                            {isSending ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <Send size={18} className="me-2" /> إرسال الرسائل النصية
                              </>
                            )}
                          </Button>
                        </Form>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              <Tab.Pane eventKey="templates">
                <div className="d-flex justify-content-end mb-3">
                  <Button variant="outline-danger" size="sm" onClick={handleRestoreDefaults}>
                    <RotateCcw size={16} className="me-1" /> استعادة النصوص الافتراضية
                  </Button>
                </div>
                <Row className="g-3">
                  {templates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      onToggleActive={handleToggleTemplateActive}
                      onSaveContent={handleSaveTemplateContent}
                    />
                  ))}
                </Row>
              </Tab.Pane>

              <Tab.Pane eventKey="sms_logs">
                <FilterAndStatsHeader
                    stats={smsStats}
                    typeName="الرسائل"
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    showProviderFilter={true}
                    providerFilter={providerFilter}
                    setProviderFilter={setProviderFilter}
                />

                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold small text-muted">نوع الرسالة:</span>
                        <Form.Select
                            size="sm"
                            value={msgTypeFilter}
                            onChange={e => setMsgTypeFilter(e.target.value)}
                            className="w-auto fw-bold"
                        >
                            <option value="all">الكل</option>
                            <option value="AUTOMATED">تلقائي (تحديثات طلبات)</option>
                            <option value="OTP">أكواد التحقق (OTP)</option>
                            <option value="MANUAL">يدوي (حملات إعلانية)</option>
                        </Form.Select>
                    </div>
                    <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm" onClick={fetchData} className="fw-bold">
                            <RefreshCw size={16} className="me-1" /> تحديث السجل
                        </Button>
                        <Button variant="outline-info" size="sm" onClick={fetchExternalWhySMSLogs} className="fw-bold">
                            <Globe size={16} className="me-1" /> سجل WhySMS
                        </Button>
                    </div>
                </div>

                <div className="table-responsive bg-white rounded border shadow-sm" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <Table hover className="mb-0 align-middle">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th>التاريخ والوقت</th>
                                <th>رقم الهاتف</th>
                                <th>المزود / النوع</th>
                                <th>نص الرسالة</th>
                                <th>الحالة والسبب</th>
                                <th>بواسطة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSms.map((log) => {
                                const { provider, text } = extractProviderInfo(log.provider_response);

                                return (
                                    <tr key={log.id} className={log.status === 'failed' ? 'table-danger border-danger' : ''}>
                                        <td className="small text-muted text-center" dir="ltr">
                                            {log.created_at_formatted || formatDateTimeEn(log.created_at)}
                                        </td>
                                        <td dir="ltr" className="fw-bold text-center text-dark font-monospace">
                                            {log.is_grouped ? (
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="fw-bold"
                                                    onClick={() => setViewGroupedRecipients(log)}
                                                >
                                                    عرض ({log.recipients_list?.length}) رقم
                                                </Button>
                                            ) : (
                                                formatEgyptianPhone(log.recipient)
                                            )}
                                        </td>
                                        <td>
                                            <div className="d-flex flex-column gap-1 align-items-start">
                                                <Badge bg={getProviderBadgeColor(provider)} text={getProviderBadgeColor(provider) === 'warning' ? 'dark' : 'light'}>
                                                    {provider}
                                                </Badge>
                                                <Badge bg={log.message_type === 'MANUAL' ? 'dark' : 'info'}>{log.message_type}</Badge>
                                            </div>
                                        </td>
                                        <td onClick={() => setViewFullMsg(log.content)} style={{cursor: 'pointer'}}>
                                            <div className="text-truncate small p-2 bg-light rounded border border-primary border-opacity-25 hover-bg-light" style={{ maxWidth: '250px' }} title="اضغط لعرض الرسالة كاملة">
                                                {log.content}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-column align-items-start gap-1">
                                                <Badge bg={log.status === 'sent' ? 'success' : 'danger'} className="d-flex align-items-center gap-1">
                                                    {log.status === 'sent' ? <CheckCircle size={12}/> : <XCircle size={12}/>}
                                                    {log.status === 'sent' ? 'نجح' : 'فشل'}
                                                </Badge>
                                                {text && (
                                                    <div className={`small fw-bold p-1 rounded ${log.status === 'sent' ? 'text-success bg-success bg-opacity-10' : 'text-danger bg-danger bg-opacity-10'}`} style={{ fontSize: '10px', maxWidth: '200px', whiteSpace: 'normal' }}>
                                                        {text}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="small text-muted fw-bold">
                                            {log.sent_by_name || 'آلي (النظام)'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredSms.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center text-muted py-5">
                                        <List size={48} className="mb-3 opacity-25" />
                                        <h6>لا توجد رسائل مسجلة تطابق بحثك</h6>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>

                <Modal show={showExternalLogs} onHide={() => setShowExternalLogs(false)} size="xl" centered>
                  <Modal.Header closeButton className="bg-info text-white">
                    <Modal.Title className="fs-5 d-flex align-items-center gap-2">
                      <Globe size={20} /> السجل المباشر من سيرفر WhySMS
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body className="bg-light">
                    {loadingExternal ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" variant="info" />
                        <p className="mt-2 text-muted">جاري الاتصال بسيرفرات WhySMS...</p>
                      </div>
                    ) : externalLogsData.length === 0 ? (
                      <div className="text-center text-muted py-4">لا توجد رسائل مسجلة في السيرفر الخارجي.</div>
                    ) : (
                      <div className="table-responsive bg-white rounded border">
                        <Table hover size="sm" className="mb-0 align-middle">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>رقم الرسالة (UID)</th>
                              <th>تاريخ الإنشاء</th>
                              <th>المستلم</th>
                              <th>نص الرسالة</th>
                              <th>النوع / الشبكة</th>
                              <th>الحالة الخارجية</th>
                            </tr>
                          </thead>
                          <tbody>
                            {externalLogsData.map((log, idx) => (
                              <tr key={idx}>
                                <td className="text-muted small font-monospace">{log.uid}</td>
                                <td dir="ltr" className="small text-center">{log.created_at_formatted || formatDateTimeEn(log.created_at)}</td>
                                <td dir="ltr" className="fw-bold text-dark text-center font-monospace">{formatEgyptianPhone(log.recipient)}</td>
                                <td className="text-truncate" style={{ maxWidth: '200px' }} title={log.message}>{log.message}</td>
                                <td>
                                  <Badge bg="secondary">{log.type}</Badge>
                                  {log.network && <Badge bg="light" text="dark" className="border ms-1">{log.network}</Badge>}
                                </td>
                                <td>
                                  <Badge bg={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'warning'}>
                                    {log.status}
                                  </Badge>
                                  {log.status_message && (
                                    <div className="text-danger small mt-1" style={{ fontSize: '10px' }}>{log.status_message}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowExternalLogs(false)}>إغلاق</Button>
                  </Modal.Footer>
                </Modal>
              </Tab.Pane>

              <Tab.Pane eventKey="email_logs">
                <FilterAndStatsHeader
                  stats={emailStats}
                  typeName="الإيميلات"
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  showProviderFilter={false}
                />
                <div className="d-flex justify-content-start mb-2">
                  <Button variant="outline-primary" size="sm" onClick={fetchData} className="fw-bold">
                    <RefreshCw size={16} className="me-1" /> تحديث السجل
                  </Button>
                </div>
                <div
                  className="table-responsive bg-white rounded border shadow-sm"
                  style={{ maxHeight: '500px', overflowY: 'auto' }}
                >
                  <Table hover className="mb-0 align-middle">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>التاريخ</th>
                        <th>البريد الإلكتروني (المستلم)</th>
                        <th>النوع</th>
                        <th>موضوع / نص الإيميل</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmails.map((log) => (
                        <tr key={log.id}>
                          <td className="small text-center" dir="ltr">
                            {log.created_at_formatted || formatDateTimeEn(log.created_at)}
                          </td>
                          <td dir="ltr" className="fw-bold text-start text-primary font-monospace">
                            {log.recipient}
                          </td>
                          <td>
                            <Badge bg="info">إيميل</Badge>
                          </td>
                          <td
                            className="text-truncate small"
                            style={{ maxWidth: '300px' }}
                            title={log.content}
                          >
                            {log.content}
                          </td>
                          <td>
                            <Badge bg={log.status === 'sent' ? 'success' : 'danger'}>
                              {log.status === 'sent' ? 'تم الإرسال' : 'فشل'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {filteredEmails.length === 0 && (
                        <tr>
                          <td colSpan="5" className="text-center text-muted py-4">
                            لا توجد إيميلات مسجلة تطابق بحثك
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="push_logs">
                <div className="mb-3">
                  <Form.Control
                    type="text"
                    placeholder="ابحث بعنوان الإشعار، أو اسم/رقم العميل..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div
                  className="table-responsive bg-white rounded border shadow-sm"
                  style={{ maxHeight: '500px', overflowY: 'auto' }}
                >
                  <Table hover className="mb-0 align-middle">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>التاريخ</th>
                        <th>المستلم (العميل)</th>
                        <th>التصنيف</th>
                        <th>العنوان</th>
                        <th>النص</th>
                        <th>مقروء؟</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pushLogs
                        .filter(
                          (log) =>
                            log.title?.includes(searchTerm) ||
                            log.message?.includes(searchTerm) ||
                            String(log.user_name)?.includes(searchTerm) ||
                            String(log.user_phone)?.includes(searchTerm)
                        )
                        .map((log) => (
                          <tr key={log.id}>
                            <td
                              className="small text-center"
                              dir="ltr"
                            >
                              {log.created_at_formatted || formatDateTimeEn(log.created_at)}
                            </td>
                            <td>
                              {log.is_global ? (
                                <Badge bg="primary" className="fs-6 px-3">
                                  الجميع (إشعار عام)
                                </Badge>
                              ) : log.user_name ? (
                                <div>
                                  <div className="fw-bold">{log.user_name}</div>
                                  <div
                                    className="text-muted small font-monospace"
                                    dir="ltr"
                                    style={{ textAlign: 'right' }}
                                  >
                                    {formatEgyptianPhone(log.user_phone)}
                                  </div>
                                </div>
                              ) : log.user_id ? (
                                <span className="text-muted small">
                                  العميل #{log.user_id}
                                </span>
                              ) : (
                                <Badge bg="primary">الجميع</Badge>
                              )}
                            </td>
                            <td>
                              <Badge bg="info">{log.category}</Badge>
                            </td>
                            <td className="fw-bold">{log.title}</td>
                            <td
                              className="text-truncate small"
                              style={{ maxWidth: '300px' }}
                              title={log.message}
                            >
                              {log.message}
                            </td>
                            <td>
                              {log.is_read ? (
                                <Badge bg="success">نعم</Badge>
                              ) : (
                                <Badge bg="warning">لا</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>

      <Modal show={!!viewFullMsg} onHide={() => setViewFullMsg(null)} centered size="lg">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fs-5">نص الرسالة</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="bg-light p-4 rounded border border-gray-200" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '15px', color: '#333' }}>
            {viewFullMsg}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setViewFullMsg(null)}>إغلاق</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!viewGroupedRecipients} onHide={() => setViewGroupedRecipients(null)} centered scrollable>
        <Modal.Header closeButton className="bg-light">
            <Modal.Title className="fs-6 fw-bold">الأرقام المرسل إليها هذه الرسالة</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form.Control
                type="text"
                placeholder="ابحث برقم الهاتف هنا..."
                value={recipientSearch}
                onChange={e => setRecipientSearch(e.target.value)}
                className="mb-3"
                dir="ltr"
            />
            <div className="list-group">
                {viewGroupedRecipients?.recipients_list
                    ?.filter(r => r.recipient.includes(recipientSearch))
                    .map((r, idx) => {
                        const { provider, text } = extractProviderInfo(r.provider_response);
                        return (
                            <div key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                                <div className="d-flex flex-column gap-1">
                                    <span dir="ltr" className="fw-bold font-monospace text-dark text-start">
                                        {formatEgyptianPhone(r.recipient)}
                                    </span>
                                    <span className="small text-muted" style={{ fontSize: '10px' }}>
                                        المزود: {provider}
                                    </span>
                                </div>
                                <div className="d-flex flex-column align-items-end gap-1">
                                    <Badge bg={r.status === 'sent' ? 'success' : 'danger'}>
                                        {r.status === 'sent' ? 'نجح' : 'فشل'}
                                    </Badge>
                                    {r.status === 'failed' && (
                                        <span className="text-danger fw-bold" style={{ fontSize: '10px', maxWidth: '120px', whiteSpace: 'normal', textAlign: 'left' }}>
                                            {text}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setViewGroupedRecipients(null)}>إغلاق</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SMSManager;

