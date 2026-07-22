import { Icon } from "./Icon";

type SectionHeaderProps = {
  title: string;
  description?: string;
  icon?: string;
};

export function SectionHeader({ title, description, icon }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2>
          {icon && <Icon name={icon} />}
          {title}
        </h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
