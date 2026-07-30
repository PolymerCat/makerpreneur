type CardProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Card({ children, className = "", style }: CardProps) {
  return <section className={`card ${className}`.trim()} style={style}>{children}</section>;
}
