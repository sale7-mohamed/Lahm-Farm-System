import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import '../../App.css';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 991;
            setIsMobile(mobile);
            if (!mobile) {
                setIsSidebarOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isMobile) {
            setIsSidebarOpen(false);
        }
    }, [location.pathname, isMobile]);

    useEffect(() => {
        if (isMobile && isSidebarOpen) {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }
        return () => document.body.classList.remove('sidebar-open');
    }, [isMobile, isSidebarOpen]);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="app-container">
            <div
                className={`sidebar-overlay ${isSidebarOpen && isMobile ? 'active' : ''}`}
                onClick={closeSidebar}
                aria-hidden="true"
            />

            <aside className={`sidebar-container ${isSidebarOpen ? 'open' : ''} ${isMobile ? 'mobile' : ''}`}>
                <Sidebar onClose={closeSidebar} isMobile={isMobile} />
            </aside>

            <div className="main-content">
                <Header onToggleSidebar={toggleSidebar} />
                <main className="page-content">
                    <div className="container-fluid py-2">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;

