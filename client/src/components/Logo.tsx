export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ll-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#13141f" />
      <path
        d="M22 14v28a8 8 0 1 1-4-7V14h4zm26 0v22a8 8 0 1 1-4-7V14h4z"
        fill="url(#ll-grad)"
      />
    </svg>
  );
}
