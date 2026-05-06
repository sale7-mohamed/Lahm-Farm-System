import React, { useState, useEffect, useRef } from 'react';
import { CallContext } from './CallContext';

export const CallProvider = ({ children }) => {
    const [isCallActive, setIsCallActive] = useState(() => sessionStorage.getItem('cs_isCallActive') === 'true');
    const [callStartTime, setCallStartTime] = useState(() => {
        const saved = sessionStorage.getItem('cs_callStartTime');
        return saved ? new Date(saved) : null;
    });

    const initialCallData = {
        customer_phone: '',
        customer_name: '',
        reason: 'inquiry',
        status: 'resolved',
        notes: ''
    };

    const[callData, setCallData] = useState(() => {
        const saved = sessionStorage.getItem('cs_callData');
        return saved ? JSON.parse(saved) : initialCallData;
    });

    const[timerDisplay, setTimerDisplay] = useState('00:00');
    const timerRef = useRef(null);

    useEffect(() => {
        sessionStorage.setItem('cs_isCallActive', isCallActive);
        if (callStartTime) {
            sessionStorage.setItem('cs_callStartTime', callStartTime.toISOString());
        } else {
            sessionStorage.removeItem('cs_callStartTime');
        }
        sessionStorage.setItem('cs_callData', JSON.stringify(callData));
    }, [isCallActive, callStartTime, callData]);

    useEffect(() => {
        if (isCallActive && callStartTime) {
            timerRef.current = setInterval(() => {
                const now = new Date();
                const diff = Math.floor((now - callStartTime) / 1000);
                const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
                const seconds = String(diff % 60).padStart(2, '0');
                setTimerDisplay(`${minutes}:${seconds}`);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isCallActive, callStartTime]);

    const startCall = (phone = '', name = '') => {
        const now = new Date();
        setIsCallActive(true);
        setCallStartTime(now);
        setTimerDisplay('00:00');
        setCallData(prev => ({
            ...prev,
            customer_phone: phone || prev.customer_phone,
            customer_name: name || prev.customer_name
        }));
    };

    const endCall = () => {
        setIsCallActive(false);
        setCallStartTime(null);
        setTimerDisplay('00:00');
        setCallData(initialCallData);
        clearInterval(timerRef.current);
    };

    return (
        <CallContext.Provider value={{
            isCallActive,
            callStartTime,
            callData,
            setCallData,
            timerDisplay,
            startCall,
            endCall
        }}>
            {children}
        </CallContext.Provider>
    );
};
