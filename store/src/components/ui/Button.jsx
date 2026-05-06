import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  icon: Icon,
  ...props
}, ref) => {

  // 1.   (Base Styles)
  // - touch-manipulation:   
  // - active:scale:   
  // - focus-visible:   (Accessibility)
  const baseStyle = `
    relative inline-flex items-center justify-center
    font-bold rounded-xl transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
    active:scale-[0.98] touch-manipulation gap-2 select-none
  `;

  // 2.    (Variants)
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg focus-visible:ring-primary",
    secondary: "bg-gray-100 text-dark hover:bg-gray-200 border border-transparent focus-visible:ring-gray-400",
    outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-white focus-visible:ring-primary",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm focus-visible:ring-red-500",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-dark border-transparent shadow-none",
    link: "bg-transparent text-primary hover:underline p-0 h-auto shadow-none active:scale-100"
  };

  // 3.  (Sizes)

  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[32px]",
    md: "px-5 py-2.5 text-sm min-h-[44px]",
    lg: "px-8 py-3.5 text-base min-h-[52px]",
    icon: "p-2 aspect-square",
  };

  // 4.  
  const classes = `
    ${baseStyle}
    ${variants[variant] || variants.primary}
    ${sizes[size] || sizes.md}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* 5.   (Loading State) */}
      {isLoading && (
        <Loader2
          size={size === 'lg' ? 20 : 16}
          className="animate-spin absolute"
        />
      )}

      {/* 6.  (       ) */}
      <span className={`flex items-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {Icon && <Icon size={size === 'lg' ? 20 : 18} />}
        {children}
      </span>
    </button>
  );
});

//    (  Debugging)
Button.displayName = 'Button';

export default Button;