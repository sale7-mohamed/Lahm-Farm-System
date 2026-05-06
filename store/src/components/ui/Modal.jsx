import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl, full
  footer,
  closeOnOutsideClick = true
}) => {
  const[isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      requestAnimationFrame(() => setIsVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  //     Esc
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full m-4 h-[calc(100vh-2rem)]'
  };

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop ( ) */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => closeOnOutsideClick && onClose()}
      ></div>

      {/* Modal Window */}
      <div
        className={`bg-white w-full rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] transform transition-all duration-300 ${sizeClasses[size]} ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h3 className="text-xl font-bold text-dark pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer (Optional) */}
        {footer && (
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl shrink-0 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  //  Portal       (      overflow: hidden)
  return createPortal(modalContent, document.body);
};

export default Modal;