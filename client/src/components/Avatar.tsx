import { cn } from '../lib/utils';

interface AvatarProps {
  seed: string;
  name?: string | null;
  size?: number;
  className?: string;
}

export function avatarUrl(seed: string, size = 64): string {
  const cleanSeed = (seed || 'guest').trim().toLowerCase();
  const params = new URLSearchParams({
    seed: cleanSeed,
    size: String(size),
    radius: '50',
    backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,a6e3a1,fed7aa',
  });
  return `https://api.dicebear.com/7.x/thumbs/svg?${params.toString()}`;
}

export function Avatar({ seed, name, size = 32, className }: AvatarProps) {
  const url = avatarUrl(seed, size * 2);
  return (
    <img
      src={url}
      alt={name || seed}
      width={size}
      height={size}
      className={cn(
        'rounded-full ring-1 ring-bg-ring/70 bg-bg-soft object-cover shrink-0',
        className,
      )}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}
