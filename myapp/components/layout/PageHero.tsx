import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: string;
  primaryAction?: {
    href: string;
    label: string;
  };
};

export function PageHero({ title, description, primaryAction }: PageHeroProps) {
  return (
    <header className="page-hero">
      <div>
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
