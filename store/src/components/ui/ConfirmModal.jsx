// src/components/ui/ConfirmModal.jsx
import React from 'react';
import Modal from './Modal';
import { AlertTriangle, Trash2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    icon = 'trash' // 'trash' or 'alert' or 'cancel'
}) => {
    const { t } = useTranslation();

    const finalConfirmText = confirmText || t('common.yes_sure');
    const finalCancelText = cancelText || t('common.go_back');

    const renderIcon = () => {
        switch (icon) {
            case 'cancel': return <XCircle size={32} />;
            case 'alert': return <AlertTriangle size={32} />;
            case 'trash':
            default: return <Trash2 size={32} />;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            closeOnOutsideClick={false}
        >
            <div className="text-center py-2 animate-fade-in-up">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 border-4 border-white shadow-sm">
                    {renderIcon()}
                </div>

                <p className="text-gray-600 mb-8 leading-relaxed font-medium">
                    {message}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 hover:text-dark transition-all"
                    >
                        {finalCancelText}
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className="flex-1 py-3.5 rounded-xl text-white font-bold bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95"
                    >
                        {finalConfirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
