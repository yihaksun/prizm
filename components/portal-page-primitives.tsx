import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PortalPageFrame({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={joinClasses('portal-page-frame', className)} {...props}>{children}</main>;
}

export function PortalGradientBackground({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses('portal-gradient-background', className)} {...props}>{children}</div>;
}

export function PortalWorkspaceSurface({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <PortalGradientBackground
      className={joinClasses('app-shell code-assets-shell portal-workspace-surface', className)}
      {...props}
    >
      {children}
    </PortalGradientBackground>
  );
}

export function PortalPrismAtmosphere() {
  return <div className="model-prism-atmosphere portal-prism-atmosphere" aria-hidden="true" />;
}

export function PortalDetailFrame({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={joinClasses('portal-page-frame portal-detail-frame', className)} {...props}>{children}</main>;
}

export function PortalButton({
  variant = 'secondary',
  size = 'medium',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'icon';
  size?: 'small' | 'medium';
}) {
  return (
    <button
      className={joinClasses('portal-button', `is-${variant}`, `is-${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function PortalPageHeader({
  kicker,
  title,
  description,
  action,
  className,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={joinClasses('portal-page-header', className)}>
      <div className="portal-page-heading-copy">
        <span className="code-page-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="portal-page-heading-action">{action}</div>}
    </section>
  );
}

export function PortalFilterSurface({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={joinClasses('portal-filter-surface', className)} {...props}>{children}</section>;
}

export function PortalResultsSurface({
  title,
  description,
  tools,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  tools?: ReactNode;
}) {
  return (
    <section className={joinClasses('portal-results-surface', className)} {...props}>
      <header className="code-results-toolbar portal-results-header">
        <div><strong>{title}</strong>{description && <span>{description}</span>}</div>
        {tools && <div className="portal-results-tools">{tools}</div>}
      </header>
      {children}
    </section>
  );
}
