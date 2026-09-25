import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'on-light' | 'on-dark' | 'navbar';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'on-light',
  showText = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  // Strictly 2 Themes: On Dark (dark surfaces) vs On Light (navbar, hero & footer)
    const isOnDark = variant === 'on-dark';
    // "Mero" = bold primary (white on dark backgrounds)
    const meroColor = isOnDark ? 'text-white font-black' : 'text-danger-600 font-black';
    // "Deutsch" = charcoal on light, crisp WHITE in dark mode (Hero/Footer/navbar)
    const deutschColor = isOnDark ? 'text-white font-black' : 'text-ink-900 font-black dark:text-white';

  const icon = (
    <div className={`relative flex-shrink-0 ${iconSizes[size]}`}>
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        <rect x="32" y="32" width="448" height="448" rx="112" fill="#2563EB" />
        <path d="M104 150 C104 136.745 114.745 126 128 126 H144 V386 H128 C114.745 386 104 375.255 104 362 V150 Z" fill="#0F172A" />
        <rect x="144" y="126" width="16" height="260" fill="#EF4444" />
        <rect x="160" y="126" width="16" height="260" fill="#F59E0B" />
        <path d="M216 360 V220 L272 312 L328 220 V360" stroke="#FFFFFF" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M280 146 H336 C374.66 146 406 177.34 406 216 V226 C406 264.66 374.66 296 336 296 H280" stroke="#93C5FD" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="388" cy="126" r="24" fill="#DC2626" />
        <circle cx="388" cy="126" r="10" fill="#FFFFFF" />
      </svg>
    </div>
  );

  const wordmark = (
    <div className="flex flex-col justify-center w-fit">
      <div className={`tracking-tight whitespace-nowrap leading-none ${textSizes[size]}`}>
        <span className={meroColor}>Mero</span>
        <span className={deutschColor}>Deutsch</span>
      </div>

      {/* Underline locked to text width */}
      <div className="w-full h-[3px] rounded-full flex overflow-hidden mt-1">
        <div className="w-1/4 bg-danger-600 h-full" />
        <div className="w-1/4 bg-accent-600 h-full" />
        <div className="w-1/4 bg-danger-500 h-full" />
        <div className="w-1/4 bg-warning-400 h-full" />
      </div>
    </div>
  );

  const content = showText ? (
    <div className={`inline-flex items-center gap-2.5 select-none w-fit ${className}`}>
      {icon}
      {wordmark}
    </div>
  ) : (
    <div className={`inline-flex items-center ${className}`}>
      {icon}
    </div>
  );

  return <React.Fragment>{content}</React.Fragment>;
};
