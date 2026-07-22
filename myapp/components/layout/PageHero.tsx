import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  primaryAction?: {
    href: string;
    label: string;
  };
};

export function PageHero({ eyebrow, title, description, icon, primaryAction }: PageHeroProps) {
  return (
    <header className="page-hero">
      <div className="hero-icon">
        <Icon name={icon} />
      </div>
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {primaryAction && (
        <ButtonLink href={primaryAction.href} icon="ti-arrow-right" variant="primary">
          {primaryAction.label}
        </ButtonLink>
      )}
    </header>
  );
}
