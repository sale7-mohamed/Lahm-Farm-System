// dashboard/src/pages/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { LogIn, Smartphone, Lock, AlertCircle } from 'lucide-react';
import logo from '../assets/logo.png';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'فشل تسجيل الدخول. تحقق من البيانات المدخلة.';
      setError(errorMessage);
      console.error('Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper d-flex min-vh-100 bg-white" style={{ direction: 'rtl' }}>
      {/* Right Side - Brand & Welcome (hidden on mobile) */}
      <div className="d-none d-lg-flex col-lg-6 bg-primary position-relative flex-column align-items-center justify-content-center overflow-hidden">
        <div
          className="position-absolute top-0 end-0 w-100 h-100 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at top right, #ffffff 0%, transparent 40%)' }}
        />
        <div
          className="position-absolute bottom-0 start-0 w-100 h-100 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at bottom left, #000000 0%, transparent 40%)' }}
        />
        <div className="position-relative z-1 text-center px-5 text-white">
          <img
            src={logo}
            alt="Lahm Logo"
            className="mb-5"
            style={{ height: '120px', filter: 'brightness(0) invert(1)' }}
          />
          <h1 className="fw-black display-5 mb-3">لوحة تحكم لَحِم</h1>
          <p className="fs-5 opacity-75 lh-lg">
            النجاح سببه هو فريق العمل.
          </p>
        </div>
      </div>

      {/* Left Side - Login Form */}
      <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center position-relative">
        <div
          className="d-lg-none position-absolute top-0 w-100"
          style={{
            height: '30vh',
            background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
            zIndex: 0,
            borderBottomLeftRadius: '30px',
            borderBottomRightRadius: '30px'
          }}
        />

        <div className="login-form-container w-100 px-4 position-relative z-1" style={{ maxWidth: '480px' }}>
          <div className="d-lg-none text-center mb-5 mt-4">
            <img src={logo} alt="Lahm Logo" style={{ height: '80px', filter: 'brightness(0) invert(1)' }} />
          </div>

          <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg border border-light">
            <div className="mb-5 text-center text-lg-start">
              <h2 className="fw-bold text-dark mb-2">تسجيل الدخول</h2>
              <p className="text-muted">مرحباً بك مجدداً، يرجى إدخال بيانات الدخول.</p>
            </div>

            {error && (
              <Alert variant="danger" className="border-0 rounded-3 d-flex align-items-center gap-2 py-3 px-4 mb-4">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="fw-bold">{error}</span>
              </Alert>
            )}

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-4">
                <Form.Label className="fw-bold text-secondary small text-uppercase tracking-wider">
                  رقم الموظف أو الهاتف
                </Form.Label>
                <div className="position-relative input-wrapper">
                  <Form.Control
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    size="lg"
                    className="bg-light border-0 ps-5 fs-6 py-3 fw-medium"
                    placeholder="أدخل رقمك هنا..."
                  />
                  <Smartphone
                    size={20}
                    className="text-muted position-absolute top-50 translate-middle-y ms-3"
                    style={{ right: 'auto', left: '15px' }}
                  />
                </div>
              </Form.Group>

              <Form.Group className="mb-5">
                <Form.Label className="fw-bold text-secondary small text-uppercase tracking-wider">
                  كلمة المرور
                </Form.Label>
                <div className="position-relative input-wrapper">
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    size="lg"
                    className="bg-light border-0 ps-5 fs-6 py-3 fw-medium"
                    placeholder="••••••••"
                  />
                  <Lock
                    size={20}
                    className="text-muted position-absolute top-50 translate-middle-y ms-3"
                    style={{ right: 'auto', left: '15px' }}
                  />
                </div>
              </Form.Group>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-100 py-3 rounded-3 fw-bold d-flex justify-content-center align-items-center gap-2 login-btn border-0 shadow-sm"
              >
                {loading ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>
                    <LogIn size={20} />
                    تسجيل الدخول
                  </>
                )}
              </Button>
            </Form>
          </div>

          <div className="text-center mt-4 pb-4">
            <small className="text-muted fw-bold">
              © {new Date().getFullYear()} شركة لَحِم لإدارة المزارع واللحوم
            </small>
          </div>
        </div>
      </div>

      <style>{`
        .input-wrapper .form-control:focus {
          background-color: #fff !important;
          box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.1) !important;
          border: 1px solid #0d6efd !important;
        }
        .login-btn {
          background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(13, 110, 253, 0.2) !important;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .fw-black {
          font-weight: 900;
        }
        .tracking-wider {
          letter-spacing: 0.05em;
        }
        /* Mobile optimizations */
        @media (max-width: 991px) {
          .login-form-container {
            max-width: 100% !important;
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
          }
          .form-control {
            font-size: 16px !important;
            padding: 0.9rem 1rem !important;
          }
          .btn {
            min-height: 52px;
          }
          input, button {
            touch-action: manipulation;
          }
        }
        @media (max-width: 576px) {
          .bg-white {
            padding: 1.5rem !important;
          }
          h2 {
            font-size: 1.6rem;
          }
        }
        @supports (-webkit-touch-callout: none) {
          input, textarea, select {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Login;

