import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const base = 'inline-flex items-center font-medium rounded-full border transition-colors';
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variants = {
    default: 'bg-slate-800/80 text-slate-300 border-slate-700',
    critical: 'bg-red-950/80 text-red-400 border-red-800/60 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
    high: 'bg-amber-950/80 text-amber-400 border-amber-800/60 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    medium: 'bg-yellow-950/60 text-yellow-300 border-yellow-800/50',
    low: 'bg-slate-800/80 text-slate-400 border-slate-700',
    success: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
    warning: 'bg-orange-950/80 text-orange-400 border-orange-800/60',
    info: 'bg-blue-950/80 text-blue-400 border-blue-800/60 shadow-[0_0_8px_rgba(59,130,246,0.2)]',
    purple: 'bg-purple-950/80 text-purple-300 border-purple-800/60 shadow-[0_0_8px_rgba(168,85,247,0.2)]',
  };

  return (
    <span className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
