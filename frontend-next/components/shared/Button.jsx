import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  onClick,
  href,
  className = '',
  icon,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-full transition-all duration-200';

  const variants = {
    primary: 'bg-rh-teal-500 hover:bg-rh-teal-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105',
    secondary: 'bg-white text-gray-900 border-2 border-gray-200 hover:border-gray-300',
    outline: 'bg-transparent text-rh-teal-500 border-2 border-rh-teal-500 hover:bg-rh-teal-50'
  };

  const classes = `${baseClasses} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {icon && <span>{icon}</span>}
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={classes} {...props}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
