// SVG icon components ported from the MS Works design system (icons.jsx)

type IconProps = { size?: number; color?: string };

export function IcPerson({ size = 64, color = '#9aa3a0' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="23" r="12" fill={color} />
      <path d="M11 55c0-11.6 9.4-21 21-21s21 9.4 21 21" fill={color} />
    </svg>
  );
}

export function IcWarningTri({ size = 28, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3.2 22 20.5H2L12 3.2Z" fill={color} />
      <rect x="11" y="9.5" width="2" height="5.6" rx="1" fill="#D32F2F" />
      <circle cx="12" cy="17.4" r="1.25" fill="#D32F2F" />
    </svg>
  );
}

export function IcWarningTriColor({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3.2 22 20.5H2L12 3.2Z" fill="#fff" fillOpacity="0.18" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="11" y="9.5" width="2" height="5.6" rx="1" fill="#fff" />
      <circle cx="12" cy="17.4" r="1.25" fill="#fff" />
    </svg>
  );
}

export function IcVibrate({ size = 22, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="8.5" y="5" width="7" height="14" rx="1.6" stroke={color} strokeWidth="1.8" />
      <path d="M4.5 8.5v7M2 10.5v3M19.5 8.5v7M22 10.5v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IcSound({ size = 22, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z" fill={color} />
      <path d="M15.5 9c1.2 1 1.2 5 0 6M18 7c2.3 1.8 2.3 8.2 0 10" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IcPhoneEnd({ size = 30, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 9.2c-3.1 0-6 .7-8.4 2.1-.7.4-1.1 1.2-1 2l.3 2c.1.9.9 1.5 1.8 1.4l2.6-.3c.8-.1 1.4-.7 1.5-1.5l.2-1.6c1-.3 2-.4 3-.4s2 .1 3 .4l.2 1.6c.1.8.7 1.4 1.5 1.5l2.6.3c.9.1 1.7-.5 1.8-1.4l.3-2c.1-.8-.3-1.6-1-2C18 9.9 15.1 9.2 12 9.2Z"
        fill={color}
        transform="rotate(135 12 12)"
      />
    </svg>
  );
}

export function IcPhoneUp({ size = 30, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8Z"
        fill={color}
      />
    </svg>
  );
}

export function IcMic({ size = 24, color = '#3a3f3e' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill={color} />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IcMicOff({ size = 24, color = '#3a3f3e' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill={color} opacity="0.35" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
      <line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IcKeypad({ size = 24, color = '#3a3f3e' }: IconProps) {
  const dots: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) dots.push([4.5 + c * 7.5, 4.5 + r * 7.5]);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.7" fill={color} />)}
    </svg>
  );
}

export function IcSpeaker({ size = 24, color = '#3a3f3e' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 9h3.5L12 5.5v13L7.5 15H4V9Z" fill={color} />
      <path d="M16 8.5c1.6 1.4 1.6 5.6 0 7M18.7 6c3 2.3 3 9.7 0 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IcShield({ size = 44, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5 20 5v6c0 5-3.4 8.6-8 10.5C7.4 19.6 4 16 4 11V5l8-2.5Z" fill={color} />
      <path d="M8.5 11.8 11 14.3l4.5-5" stroke="#2E9E5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function IcQuestion({ size = 42, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9.3 9.2c.1-1.6 1.3-2.6 2.8-2.6 1.6 0 2.8 1 2.8 2.5 0 1.3-.8 1.9-1.7 2.5-.8.5-1.1 1-1.1 1.9v.3" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="17.2" r="1.2" fill={color} />
    </svg>
  );
}

export function IcAddPerson({ size = 24, color = '#3a3f3e' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.6" fill={color} />
      <path d="M2.5 19c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" fill={color} />
      <path d="M19 8v6M16 11h6" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IcVideo({ size = 24, color = '#3a3f3e' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="12" height="10" rx="2.5" fill={color} />
      <path d="M15 11l5-3v8l-5-3v-2Z" fill={color} />
    </svg>
  );
}

export function IcRecording({ size = 24, color = '#3a3f3e' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill={color} />
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function IcClose({ size = 20, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
