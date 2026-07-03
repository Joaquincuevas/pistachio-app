import { motion } from 'framer-motion';

interface ProgressRingProps {
  /** Porcentaje 0-100. */
  value: number;
  size?: number;
  strokeWidth?: number;
}

/** Anillo de progreso animado (SVG) usado en el perfil. */
export function ProgressRing({ value, size = 148, strokeWidth = 11 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`${clamped}% de avance`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#ECECEA"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4A7C59"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-4xl text-text-primary">{clamped}%</span>
        <span className="text-xs text-text-secondary">avance</span>
      </div>
    </div>
  );
}
