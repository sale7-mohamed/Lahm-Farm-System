import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Beef, Warehouse, Users, Receipt, BarChart2,
    LogOut, Settings, ShoppingCart, Truck, BookUser,
    CheckSquare, ShoppingBag, Search, ShieldCheck, MessageSquare,
    ClipboardPlus, Handshake, Users2, Ship, Utensils, CalendarCheck,
    ClipboardList, ChevronDown, ChevronUp, Package, DollarSign, X,
    MapPin, Briefcase, PhoneCall, Folder, HeartHandshake, Share2,
    Megaphone, Building
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHasPermission } from '../../hooks/useHasPermission';
import { useChat } from '../../hooks/useChat';
import { useSidebarStats } from '../../hooks/useSidebarStats';
import { Badge, Collapse, Button } from 'react-bootstrap';
import axios from 'axios';
import logo from '../../assets/logo.png';

function Sidebar({ onClose }) {
    const { user: _user, logout: _logout } = useAuth();
    const hasAccess = useHasPermission();
    const { unreadCount } = useChat();
    const stats = useSidebarStats();

    const [openSections, setOpenSections] = useState({
        sales: true,
        operations: false,
        livestock: false,
        hr: false,
        finance: false,
        marketing: false
    });
    const [opSettings, setOpSettings] = useState({});

    useEffect(() => {
        axios.get('/core/public-operation-settings/')
            .then(res => setOpSettings(res.data))
            .catch(err => console.error('Failed to fetch operation settings:', err));
    }, []);

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const getVisibleItemsCount = (items) => {
        return items.filter(item =>
            item.module === null || hasAccess(item.module, 'VIEW_ONLY', item.to)
        ).length;
    };

    const sections = useMemo(() => ({
        sales: {
            title: 'المبيعات والطلبات',
            icon: <ShoppingCart size={18} className="flex-shrink-0" />,
            module: 'orders',
            items: [
                { to: "/on-farm-sale", icon: <ShoppingBag size={18} className="flex-shrink-0" />, text: "نقطة بيع", module: "orders" },
                { to: "/orders", icon: <Package size={18} className="flex-shrink-0" />, text: "إدارة الطلبات", module: "orders", notification: stats.pendingOrders },
                { to: "/business-orders", icon: <Briefcase size={18} className="flex-shrink-0" />, text: "طلبات الشركات", module: "orders" },
                { to: "/sales-ledger", icon: <ClipboardList size={18} className="flex-shrink-0" />, text: "سجل الطلبات", module: "orders" },
            ],
            visibleCount: 0
        },
        operations: {
            title: 'التشغيل واللوجستيات',
            icon: <Truck size={18} className="flex-shrink-0" />,
            module: 'operations',
            items: [
                { to: "/dispatcher", icon: <MapPin size={18} className="flex-shrink-0" />, text: "منسق الرحلات", module: "operations" },
                { to: "/fleet", icon: <Ship size={18} className="flex-shrink-0" />, text: "إدارة الأسطول", module: "operations" },
                {
                    to: "/farm-prep",
                    icon: <ClipboardPlus size={18} className="flex-shrink-0" />,
                    text: opSettings.enable_internal_slaughter ? "التنظيم والتحضير" : "جلب الماشية",
                    module: null
                },
                {
                    to: "/butcher-screen",
                    icon: <Utensils size={18} className="flex-shrink-0" />,
                    text: opSettings.enable_internal_slaughter ? "شاشة الجزار" : "متابعة المجزر",
                    module: null
                },
                ...(opSettings.enable_fridge_manager !== false ? [{
                    to: "/fridge-manager",
                    icon: <CheckSquare size={18} className="flex-shrink-0" />,
                    text: "إدارة الثلاجة",
                    module: null
                }] : []),
                { to: "/driver-app", icon: <Truck size={18} className="flex-shrink-0" />, text: "تطبيق السائق", module: null },
            ],
            visibleCount: 0
        },
        livestock: {
            title: 'المواشي والمخزون',
            icon: <Beef size={18} className="flex-shrink-0" />,
            module: 'livestock',
            items: [
                { to: "/livestock", icon: <Beef size={18} className="flex-shrink-0" />, text: "إدارة المواشي", module: "livestock" },
                { to: "/shared-purchases", icon: <Users2 size={18} className="flex-shrink-0" />, text: "مجموعات المشاركة", module: "livestock" },
                { to: "/requested-livestock", icon: <ClipboardPlus size={18} className="flex-shrink-0" />, text: "الماشية المطلوبة", module: "orders" },
                { to: "/adahi-manager", icon: <Megaphone size={18} className="flex-shrink-0" />, text: "إدارة الأضاحي", module: "orders" },
                { to: "/inventory", icon: <Warehouse size={18} className="flex-shrink-0" />, text: "المخزون", module: "inventory", notification: stats.lowStockItems },
                { to: "/suppliers", icon: <Building size={18} className="flex-shrink-0" />, text: "الموردون", module: "inventory" },
            ],
            visibleCount: 0
        },
        hr: {
            title: 'الموارد البشرية',
            icon: <Users size={18} className="flex-shrink-0" />,
            module: 'hr',
            items: [
                { to: "/employees", icon: <Users size={18} className="flex-shrink-0" />, text: "الموظفون", module: "hr" },
                { to: "/careers-manager", icon: <Briefcase size={18} className="flex-shrink-0" />, text: "إدارة التوظيف", module: "hr" },
                { to: "/payrolls", icon: <Receipt size={18} className="flex-shrink-0" />, text: "الرواتب", module: "hr" },
                { to: "/daily-attendance", icon: <CalendarCheck size={18} className="flex-shrink-0" />, text: "سجل الحضور", module: "hr" },
            ],
            visibleCount: 0
        },
        finance: {
            title: 'الإدارة والمالية',
            icon: <DollarSign size={18} className="flex-shrink-0" />,
            module: 'accounting',
            items: [
                { to: "/accounting", icon: <Receipt size={18} className="flex-shrink-0" />, text: "المصروفات", module: "accounting" },
                { to: "/journal-entries", icon: <BookUser size={18} className="flex-shrink-0" />, text: "قيود اليومية", module: "accounting" },
                { to: "/approvals", icon: <CheckSquare size={18} className="flex-shrink-0" />, text: "الموافقات", module: null, notification: stats.pendingApprovals },
                { to: "/document-archive", icon: <Folder size={18} className="flex-shrink-0" />, text: "أرشيف الوثائق", module: "management" },
                { to: "/reports", icon: <BarChart2 size={18} className="flex-shrink-0" />, text: "التقارير", module: "accounting" },
                { to: "/settings", icon: <Settings size={18} className="flex-shrink-0" />, text: "الإعدادات", module: "superuser" },
                { to: "/permissions-manager", icon: <ShieldCheck size={18} className="flex-shrink-0" />, text: "إدارة الصلاحيات", module: "management" },
            ],
            visibleCount: 0
        },
        marketing: {
            title: 'العملاء والتسويق',
            icon: <Megaphone size={18} className="flex-shrink-0" />,
            module: 'crm',
            items: [
                { to: "/customer-lookup", icon: <Search size={18} className="flex-shrink-0" />, text: "بحث عن عميل", module: "crm" },
                { to: "/customer-service", icon: <PhoneCall size={18} className="flex-shrink-0" />, text: "خدمة العملاء (CRM)", module: "crm" },
                { to: "/donations", icon: <HeartHandshake size={18} className="flex-shrink-0" />, text: "التبرعات (قريباً)", module: null },
                { to: "/social-media", icon: <Share2 size={18} className="flex-shrink-0" />, text: "سوشيال ميديا (قريباً)", module: null },
                { to: "/partnerships-applications", icon: <Handshake size={18} className="flex-shrink-0" />, text: "طلبات الشراكة", module: "management" },
                { to: "/sms-manager", icon: <MessageSquare size={18} className="flex-shrink-0" />, text: "رسائل SMS", module: "superuser" },
            ],
            visibleCount: 0
        }
    }), [opSettings, stats]);

    Object.keys(sections).forEach(key => {
        sections[key].visibleCount = getVisibleItemsCount(sections[key].items);
    });

    const mainLinks = [
        { to: "/dashboard", icon: <LayoutDashboard size={20} className="flex-shrink-0" />, text: "لوحة التحكم", module: "dashboard" },
        { to: "/chat", icon: <MessageSquare size={20} className="flex-shrink-0" />, text: "المحادثات", module: null, notification: unreadCount },
    ];

    return (
        <div className="d-flex flex-column h-100 text-white w-100 overflow-x-hidden">
            <div className="p-3 d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 mb-2">
                <img src={logo} alt="Lahm Logo" style={{ height: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                <Button
                    variant="link"
                    className="text-white p-0 mobile-close-btn d-lg-none"
                    onClick={onClose}
                >
                    <X size={28} />
                </Button>
            </div>

            <div className="flex-grow-1 overflow-auto p-2 custom-scrollbar w-100">
                <ul className="nav nav-pills flex-column mb-auto w-100">
                    {mainLinks.map(item => (
                        (item.module === null || hasAccess(item.module, 'VIEW_ONLY', item.to)) && (
                            <li className="nav-item mb-1 w-100" key={item.to}>
                                <NavLink
                                    to={item.to}
                                    end
                                    className={({ isActive }) => `nav-link text-white d-flex align-items-center gap-3 py-2 w-100 ${isActive ? 'active' : ''}`}
                                >
                                    {item.icon}
                                    <span className="flex-grow-1 text-truncate-safe">{item.text}</span>
                                    {item.notification > 0 && (
                                        <Badge pill bg="danger" className="ms-2 shadow-sm">
                                            {item.notification}
                                        </Badge>
                                    )}
                                </NavLink>
                            </li>
                        )
                    ))}

                    <li className="my-3 border-top border-secondary opacity-50 w-100"></li>

                    {Object.entries(sections).map(([key, section]) => {
                        if (!hasAccess(section.module, 'VIEW_ONLY')) return null;
                        if (section.visibleCount === 0) return null;
                        return (
                            <li key={key} className="nav-section mb-1 w-100">
                                <button
                                    className={`d-flex align-items-center justify-content-between w-100 px-3 py-2 bg-transparent border-0 text-white rounded hover-bg-dark ${openSections[key] ? 'text-primary' : ''}`}
                                    onClick={() => toggleSection(key)}
                                    style={{ transition: 'all 0.2s' }}
                                >
                                    <div className="d-flex align-items-center gap-2 overflow-hidden w-100">
                                        {section.icon}
                                        <span className="fw-semibold small text-truncate-safe">{section.title}</span>
                                    </div>
                                    <div className="flex-shrink-0 ms-1">
                                        {openSections[key] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                </button>

                                <Collapse in={openSections[key]}>
                                    <div>
                                        <ul className="nav flex-column pe-3 mt-1 border-end border-secondary border-opacity-25 me-2 w-100">
                                            {section.items.map(item => (
                                                (item.module === null || hasAccess(item.module, 'VIEW_ONLY', item.to)) && (
                                                    <li className="nav-item w-100" key={item.to}>
                                                        <NavLink
                                                            to={item.to}
                                                            end
                                                            className={({ isActive }) => `nav-link text-white-50 d-flex align-items-center gap-2 py-2 w-100 small ${isActive ? 'active text-white bg-primary bg-opacity-25' : ''}`}
                                                        >
                                                            {item.icon}
                                                            <span className="text-truncate-safe flex-grow-1">{item.text}</span>
                                                            {item.notification > 0 && (
                                                                <Badge pill bg="danger" className="ms-2 shadow-sm animate-pulse">
                                                                    {item.notification}
                                                                </Badge>
                                                            )}
                                                        </NavLink>
                                                    </li>
                                                )
                                            ))}
                                        </ul>
                                    </div>
                                </Collapse>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <style>{`
                .hover-bg-dark:hover {
                    background-color: rgba(255,255,255,0.05) !important;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                .text-truncate-safe {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        </div>
    );
}

export default Sidebar;

