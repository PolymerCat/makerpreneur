type CardProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
};

export function Card({ children, className = "", style, onClick }: CardProps) {
  return (
    <section className={`card ${className}`.trim()} style={style} onClick={onClick}>
      {children}
    </section>
  );
}
