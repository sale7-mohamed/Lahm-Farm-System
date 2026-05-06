import React from 'react';

const Spinner = ({ size = 'md', color = 'primary', className = '' }) => {

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  //   (Ring Colors)
  const colorClasses = {
    primary: 'bg-primary',     //  ( )
    white: 'bg-white',         //  (   )
    accent: 'bg-accent',       // / ( )
    danger: 'bg-red-500',      //  (  )
  };

  const currentColor = colorClasses[color] || colorClasses.primary;
  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`relative inline-flex items-center justify-center ${currentSize} ${className}`}>
      {/*   ( ) */}
      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${currentColor}`}></span>

      {/*   ( ) */}
      <span className={`relative inline-flex rounded-full h-3/4 w-3/4 ${currentColor}`}></span>
    </div>
  );
};

export default Spinner;