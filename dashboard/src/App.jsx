import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { useHasPermission } from './hooks/useHasPermission';
import PushNotificationBanner from './components/layout/PushNotificationBanner';
import Layout from './components/layout/Layout';
import Login from './pages/Login';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Employees = React.lazy(() => import('./pages/Employees'));
const Livestock = React.lazy(() => import('./pages/Livestock'));
const Orders = React.lazy(() => import('./pages/Orders'));
const Accounting = React.lazy(() => import('./pages/Accounting'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Payrolls = React.lazy(() => import('./pages/Payrolls'));
const JournalEntries = React.lazy(() => import('./pages/JournalEntries'));
const Approvals = React.lazy(() => import('./pages/Approvals'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Reports = React.lazy(() => import('./pages/Reports'));
const OnFarmSale = React.lazy(() => import('./pages/OnFarmSale'));
const CustomerLookup = React.lazy(() => import('./pages/CustomerLookup'));
const SalesLedger = React.lazy(() => import('./pages/SalesLedger'));
const PermissionsManager = React.lazy(() => import('./pages/PermissionsManager'));
const Chat = React.lazy(() => import('./pages/Chat'));
const RequestedLivestock = React.lazy(() => import('./pages/RequestedLivestock'));
const PartnershipApplications = React.lazy(() => import('./pages/PartnershipApplications'));
const SharedPurchases = React.lazy(() => import('./pages/SharedPurchases'));
const DailyAttendance = React.lazy(() => import('./pages/DailyAttendance'));
const SMSManager = React.lazy(() => import('./pages/SMSManager'));
const AdahiManager = React.lazy(() => import('./pages/AdahiManager'));
const FleetManagement = React.lazy(() => import('./pages/FleetManagement'));
const Dispatcher = React.lazy(() => import('./pages/Dispatcher'));
const ButcherScreen = React.lazy(() => import('./pages/ButcherScreen'));
const DriverApp = React.lazy(() => import('./pages/DriverApp'));
const FarmPrep = React.lazy(() => import('./pages/FarmPrep'));
const FridgeManager = React.lazy(() => import('./pages/FridgeManager'));
const BusinessOrders = React.lazy(() => import('./pages/BusinessOrders'));
const CareersManager = React.lazy(() => import('./pages/CareersManager'));
const CustomerService = React.lazy(() => import('./pages/CustomerService'));
const DocumentArchive = React.lazy(() => import('./pages/DocumentArchive'));
const Donations = React.lazy(() => import('./pages/Donations'));
const SocialMedia = React.lazy(() => import('./pages/SocialMedia'));

const HomeRedirect = () => {
    const checkAccess = useHasPermission();
    const { user } = useAuth();

    if (user?.is_superuser) return <Navigate to="/dashboard" replace />;

    if (checkAccess('orders', 'CAN_EDIT', '/on-farm-sale')) return <Navigate to="/on-farm-sale" replace />;
    if (checkAccess('inventory', 'VIEW_ONLY', '/inventory')) return <Navigate to="/inventory" replace />;
    if (checkAccess('hr', 'VIEW_ONLY', '/employees')) return <Navigate to="/employees" replace />;
    if (checkAccess('livestock', 'VIEW_ONLY', '/livestock')) return <Navigate to="/livestock" replace />;
    if (checkAccess('accounting', 'VIEW_ONLY', '/accounting')) return <Navigate to="/accounting" replace />;

    return <Navigate to="/dashboard" replace />;
};

const PrivateRoute = ({ children, moduleName, requiredLevel = 'VIEW_ONLY' }) => {
    const { user, loading } = useAuth();
    const checkAccess = useHasPermission();
    const location = useLocation();

    if (loading) {
        return <PageLoader />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (moduleName && !checkAccess(moduleName, requiredLevel, location.pathname)) {
        toast.error("عفواً، ليس لديك صلاحية لدخول هذه الصفحة.");
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

const PageLoader = () => (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
        </div>
    </div>
);

const ProtectedLayout = () => (
    <PrivateRoute>
        <Layout />
    </PrivateRoute>
);

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedLayout />}>
                            <Route index element={<HomeRedirect />} />

                            <Route path="dashboard" element={<Dashboard />} />
                            <Route path="chat" element={<Chat />} />
                            <Route path="donations" element={<Donations />} />
                            <Route path="social-media" element={<SocialMedia />} />

                            <Route path="employees" element={<PrivateRoute moduleName="hr"><Employees /></PrivateRoute>} />
                            <Route path="payrolls" element={<PrivateRoute moduleName="hr"><Payrolls /></PrivateRoute>} />
                            <Route path="daily-attendance" element={<PrivateRoute moduleName="hr"><DailyAttendance /></PrivateRoute>} />
                            <Route path="careers-manager" element={<PrivateRoute moduleName="hr"><CareersManager /></PrivateRoute>} />

                            <Route path="livestock" element={<PrivateRoute moduleName="livestock"><Livestock /></PrivateRoute>} />
                            <Route path="shared-purchases" element={<PrivateRoute moduleName="livestock"><SharedPurchases /></PrivateRoute>} />

                            <Route path="accounting" element={<PrivateRoute moduleName="accounting"><Accounting /></PrivateRoute>} />
                            <Route path="journal-entries" element={<PrivateRoute moduleName="accounting"><JournalEntries /></PrivateRoute>} />
                            <Route path="reports" element={<PrivateRoute moduleName="accounting"><Reports /></PrivateRoute>} />

                            <Route path="orders" element={<PrivateRoute moduleName="orders"><Orders /></PrivateRoute>} />
                            <Route path="on-farm-sale" element={<PrivateRoute moduleName="orders"><OnFarmSale /></PrivateRoute>} />
                            <Route path="customer-lookup" element={<PrivateRoute moduleName="orders"><CustomerLookup /></PrivateRoute>} />
                            <Route path="requested-livestock" element={<PrivateRoute moduleName="orders"><RequestedLivestock /></PrivateRoute>} />
                            <Route path="sales-ledger" element={<PrivateRoute moduleName="orders"><SalesLedger /></PrivateRoute>} />
                            <Route path="fleet" element={<PrivateRoute moduleName="orders"><FleetManagement /></PrivateRoute>} />
                            <Route path="dispatcher" element={<PrivateRoute moduleName="orders"><Dispatcher /></PrivateRoute>} />
                            <Route path="driver-app" element={<PrivateRoute moduleName="orders"><DriverApp /></PrivateRoute>} />
                            <Route path="farm-prep" element={<PrivateRoute moduleName="orders"><FarmPrep /></PrivateRoute>} />
                            <Route path="adahi-manager" element={<PrivateRoute moduleName="orders"><AdahiManager /></PrivateRoute>} />
                            <Route path="business-orders" element={<PrivateRoute moduleName="orders"><BusinessOrders /></PrivateRoute>} />
                            <Route path="customer-service" element={<PrivateRoute moduleName="orders"><CustomerService /></PrivateRoute>} />
                            <Route path="butcher-screen" element={<PrivateRoute moduleName="orders"><ButcherScreen /></PrivateRoute>} />

                            <Route path="inventory" element={<PrivateRoute moduleName="inventory"><Inventory /></PrivateRoute>} />
                            <Route path="suppliers" element={<PrivateRoute moduleName="inventory"><Suppliers /></PrivateRoute>} />
                            <Route path="partnerships-applications" element={<PrivateRoute moduleName="inventory"><PartnershipApplications /></PrivateRoute>} />
                            <Route path="fridge-manager" element={<PrivateRoute moduleName="inventory"><FridgeManager /></PrivateRoute>} />

                            <Route path="settings" element={<PrivateRoute moduleName="settings"><Settings /></PrivateRoute>} />
                            <Route path="approvals" element={<PrivateRoute><Approvals /></PrivateRoute>} />
                            <Route path="permissions-manager" element={<PrivateRoute moduleName="settings"><PermissionsManager /></PrivateRoute>} />
                            <Route path="document-archive" element={<PrivateRoute moduleName="settings"><DocumentArchive /></PrivateRoute>} />
                            <Route path="sms-manager" element={<PrivateRoute moduleName="settings"><SMSManager /></PrivateRoute>} />

                            <Route path="*" element={<Navigate to="/" />} />
                        </Route>
                    </Routes>
                </Suspense>
                <PushNotificationBanner />
                <ToastContainer position="bottom-left" theme="colored" rtl />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;

