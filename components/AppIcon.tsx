import React from 'react';

interface AppIconProps {
  className?: string;
}

const AppIcon: React.FC<AppIconProps> = ({ className = 'w-32 h-32' }) => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const iconSrc = `${baseUrl}app-icon.png`;

  return (
    <img
      src={iconSrc}
      alt="MagiClass"
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

export default AppIcon;