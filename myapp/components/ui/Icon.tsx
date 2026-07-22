type IconProps = {
  name: string;
  className?: string;
};

export function Icon({ name, className = "" }: IconProps) {
  return <i aria-hidden="true" className={`ti ${name} ${className}`.trim()} />;
}
