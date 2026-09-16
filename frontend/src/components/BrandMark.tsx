type BrandMarkProps = {
  className?: string;
  size?: 'hero' | 'lg' | 'md';
};

const sizeClass = {
  hero: 'text-5xl sm:text-6xl md:text-7xl',
  lg: 'text-4xl sm:text-5xl',
  md: 'text-3xl',
} as const;

export function BrandMark({ className = '', size = 'hero' }: BrandMarkProps) {
  return (
    <p
      className={`font-heading font-semibold tracking-tight text-foreground ${sizeClass[size]} ${className}`}
    >
      EasyGen
    </p>
  );
}
