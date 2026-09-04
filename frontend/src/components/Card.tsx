import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/40 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-700/90 hover:bg-[#131d35]' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/60">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
