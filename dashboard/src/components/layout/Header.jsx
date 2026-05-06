import React, { useState, useCallback, useEffect } from 'react';
import { Dropdown, Spinner, Button } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import axios from '../../api/axiosConfig';
import { User, TrendingDown, TrendingUp, Landmark, Menu, Clock, Building, Briefcase, LogIn } from 'lucide-react';
import logo from '../../assets/logo.png';

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionTime, setSessionTime] = useState('');
  const [exactLoginTime, setExactLoginTime] = useState('');

  useEffect(() => {
    let loginTimeStr = localStorage.getItem('login_time_tracker');
    if (!loginTimeStr) {
      loginTimeStr = new Date().toISOString();
      localStorage.setItem('login_time_tracker', loginTimeStr);
    }
    const loginDate = new Date(loginTimeStr);

    setExactLoginTime(loginDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }));

    const updateTimer = () => {
      const now = new Date();
      const diffMs = now - loginDate;
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      if (diffHrs > 0) {
        setSessionTime(`${diffHrs} ساعة و ${diffMins} دقيقة`);
      } else {
        setSessionTime(`${diffMins} دقيقة`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPayroll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await axios.get('/management/payrolls/my-latest/');
      setPayroll(response.data);
    } catch (error) {
      console.error('Could not fetch latest payroll:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const baseSalary = payroll?.entries?.find((e) => e.entry_type === 'base_salary')?.amount ?? 0;
  const allowances = payroll?.entries?.filter((e) => e.entry_type === 'allowance')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) ?? 0;
  const deductions = payroll?.entries?.filter((e) => ['deduction', 'advance'].includes(e.entry_type))
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) ?? 0;

  return (
    <header className="app-header">
      <div className="d-flex align-items-center">
        <Button
          variant="link"
          className="d-lg-none p-0 me-3 text-dark"
          onClick={onToggleSidebar}
          style={{ textDecoration: 'none' }}
          aria-label="Toggle sidebar"
        >
          <Menu size={28} />
        </Button>
        <div className="d-lg-none d-flex align-items-center">
          <img src={logo} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
        </div>
      </div>

      <div className="d-none d-md-flex flex-column justify-content-center flex-grow-1 ms-4">
        <h5 className="mb-0 fw-bold text-truncate" style={{ maxWidth: '250px' }}>
          مرحباً، {user?.full_name?.split(' ')[0]}
        </h5>
        <small className="text-muted d-flex align-items-center gap-2 mt-1" style={{ fontSize: '0.8rem' }}>
          <LogIn size={12} className="text-primary" />
          تم الدخول: <strong className="text-dark">{exactLoginTime}</strong>
          <span className="text-muted mx-1">|</span>
          <Clock size={12} className="text-primary" />
          مدة الجلسة: <strong className="text-dark">{sessionTime}</strong>
        </small>
      </div>

      <Dropdown onToggle={(isOpen) => isOpen && fetchPayroll()} align="end">
        <Dropdown.Toggle
          variant="light"
          id="user-dropdown"
          className="d-flex align-items-center gap-2 border-0 bg-transparent p-0"
          aria-label="User menu"
        >
          <div className="bg-primary bg-opacity-10 p-2 rounded-circle transition-all hover-scale">
            <User size={22} className="text-primary" />
          </div>
        </Dropdown.Toggle>

        <Dropdown.Menu className="shadow-lg border-0 rounded-4 mt-3" style={{ width: '320px' }}>
          <div className="p-3 bg-light border-bottom text-center">
            <div
              className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-2 fs-4 shadow-sm"
              style={{ width: '60px', height: '60px' }}
            >
              {user?.full_name?.charAt(0) ?? ''}
            </div>
            <p className="mb-1 fw-bold text-dark fs-5">{user?.full_name}</p>
            <div className="d-flex flex-column gap-1 text-muted small px-3">
              <div className="d-flex align-items-center justify-content-center gap-1">
                <Building size={14} /> {user?.department_name || 'بدون قسم'}
              </div>
              <div className="d-flex align-items-center justify-content-center gap-1">
                <Briefcase size={14} /> {user?.role_name || user?.role?.name || 'موظف'}
              </div>
            </div>
          </div>

          <div className="px-3 pb-2 pt-2 border-bottom text-center text-muted small">
            <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                <LogIn size={14} className="text-primary" /> وقت الدخول: <strong>{exactLoginTime}</strong>
            </div>
            <div className="d-flex align-items-center justify-content-center gap-1">
                <Clock size={14} className="text-primary" /> مدة الجلسة: <strong>{sessionTime}</strong>
            </div>
          </div>

          <Dropdown.Header className="fw-bold mt-2">ملخص راتب الشهر الجاري</Dropdown.Header>

          <div className="px-3 pb-2">
            {loading ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" variant="primary" />
              </div>
            ) : payroll?.id ? (
              <div className="small">
                <div className="d-flex justify-content-between mb-2">
                  <span><Landmark size={14} className="me-1 text-muted" /> الأساسي:</span>
                  <span className="fw-bold">{parseFloat(baseSalary).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between mb-2 text-success">
                  <span><TrendingUp size={14} className="me-1" /> إضافات:</span>
                  <span className="fw-bold">+{allowances.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between mb-3 text-danger">
                  <span><TrendingDown size={14} className="me-1" /> خصومات (سلف/خصم):</span>
                  <span className="fw-bold">-{deductions.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between border-top pt-2 fw-bold bg-primary bg-opacity-10 p-2 rounded">
                  <span>الصافي المستحق:</span>
                  <span className="text-primary fs-6">{parseFloat(payroll.net_salary || 0).toFixed(2)} ج.م</span>
                </div>
              </div>
            ) : (
              <div className="text-muted small text-center py-2 bg-light rounded border border-dashed">
                لم يتم إصدار مسير رواتب لك هذا الشهر بعد.
              </div>
            )}
          </div>

          <div className="px-3 pb-2 pt-2 border-top">
            <Button variant="danger" className="w-100 fw-bold rounded-3" onClick={logout}>
              تسجيل الخروج
            </Button>
          </div>
        </Dropdown.Menu>
      </Dropdown>
    </header>
  );
};

export default Header;
