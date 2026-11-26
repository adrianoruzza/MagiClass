import React from 'react';

interface AppIconProps {
  className?: string;
}

const AppIcon: React.FC<AppIconProps> = ({ className = "w-32 h-32" }) => {
  const clipId = React.useId();

  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Icona MagiClass"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="4" y="4" width="504" height="504" rx="74" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Sfondo corpo crema */}
        <rect x="0" y="0" width="512" height="512" fill="#f3ede1" />

        {/* Banda superiore nera con titolo */}
        <rect x="0" y="0" width="512" height="134" fill="#0c0c0c" />
        <text
          x="256"
          y="96"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="'Outfit', 'Noto Sans', 'Liberation Sans', 'DejaVu Sans', sans-serif"
          fontSize="80"
          fontWeight="600"
          letterSpacing="-1"
        >
          MagiClass
        </text>

        {/* Riga 1 sinistra: 3 cerchi terracotta + barra verde salvia */}
        <circle cx="84" cy="201" r="32" fill="#d87a56" />
        <circle cx="163" cy="201" r="32" fill="#d87a56" />
        <circle cx="242" cy="201" r="32" fill="#d87a56" />
        <rect x="52" y="246" width="222" height="20" rx="10" fill="#a9c1a6" />

        {/* Riga 1/2 destra: 1 cerchio bicolore terracotta/blu + 1 cerchio blu */}
        <circle cx="342" cy="233" r="32" fill="#5988b5" />
        <path d="M 310 233 A 32 32 0 0 1 374 233 Z" fill="#d87a56" />
        <circle cx="428" cy="233" r="32" fill="#5988b5" />

        {/* Riga 2: 2 cerchi bicolore rosso mattone/blu scuro + 3 cerchi blu */}
        <circle cx="84" cy="323" r="32" fill="#234d75" />
        <path d="M 52.25 319 A 32 32 0 0 1 115.75 319 Z" fill="#b5524c" />

        <circle cx="170" cy="323" r="32" fill="#234d75" />
        <path d="M 138.25 319 A 32 32 0 0 1 201.75 319 Z" fill="#b5524c" />

        <circle cx="256" cy="323" r="32" fill="#5685b2" />
        <circle cx="342" cy="323" r="32" fill="#5685b2" />
        <circle cx="428" cy="323" r="32" fill="#5685b2" />

        {/* Riga 3: 4 cerchi blu intenso */}
        <circle cx="84" cy="414" r="32" fill="#285987" />
        <circle cx="170" cy="414" r="32" fill="#285987" />
        <circle cx="256" cy="414" r="32" fill="#285987" />
        <circle cx="342" cy="414" r="32" fill="#285987" />

        {/* Angolo inferiore destro con monogramma AR */}
        <path d="M 512 378 A 134 134 0 0 0 378 512 L 512 512 Z" fill="#0c0c0c" />
        <path
          fill="#ffffff"
          fillRule="evenodd"
          d="M 442 444 L 449.5 444 L 454.5 481 L 447 481 L 445.8 473.5 L 432 473.5 L 427.4 481 L 419 481 Z M 443.4 453 L 435.6 467 L 444.8 467 Z"
        />
        <path
          fill="#ffffff"
          fillRule="evenodd"
          d="M 458.5 444 L 473 444 C 480.4 444 485 448.1 485 454.8 C 485 460.1 481.8 463.7 476.6 465 L 486.2 481 L 477.8 481 L 469.2 465.8 L 466 465.8 L 466 481 L 458.5 481 Z M 466 450.4 L 466 459.8 L 472.6 459.8 C 476.2 459.8 478 458 478 455 C 478 452 476.2 450.4 472.6 450.4 Z"
        />
      </g>

      <rect x="4" y="4" width="504" height="504" rx="74" stroke="#0c0c0c" strokeWidth="2.5" fill="none" />
    </svg>
  );
};

export default AppIcon;