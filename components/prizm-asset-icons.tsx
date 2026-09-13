import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Frame({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>{children}</svg>;
}

const line = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function PrizmDataIcon(props: IconProps) {
  return <Frame {...props}><path {...line} d="M4.2 6.3h12.9v10.9H4.2z"/><path {...line} d="m7.3 14 2.8-3 2.2 2.1 1.8-1.7 3 3.1"/><path {...line} d="M7 3.8h12.8v11"/><circle cx="8.2" cy="9.1" r="1" fill="currentColor"/></Frame>;
}

export function PrizmCodeIcon(props: IconProps) {
  return <Frame {...props}><path {...line} d="M5 3.8h11.2l2.8 2.8v13.6H5z"/><path {...line} d="M16.2 3.8v3h2.7"/><path {...line} d="M8 10.1h8M8 13.1h5.1M8 16.1h7"/><rect x="7.2" y="9.3" width="1.6" height="1.6" fill="currentColor"/></Frame>;
}

export function PrizmModelIcon(props: IconProps) {
  return <Frame {...props}><path {...line} d="m12 3.8 7 4.1v8.2l-7 4.1-7-4.1V7.9z"/><path {...line} d="m5.2 7.9 6.8 4 6.8-4M12 11.9v8.2"/><path d="m12 3.8 6.8 4.1-6.8 4-6.8-4z" fill="currentColor" opacity=".12"/></Frame>;
}

export function PrizmPipelineIcon(props: IconProps) {
  return <Frame {...props}><circle {...line} cx="5" cy="12" r="2.1"/><circle {...line} cx="18.7" cy="6.7" r="2.1"/><circle {...line} cx="18.7" cy="17.3" r="2.1"/><path {...line} d="M7.1 12h3.2c2.2 0 2.5-5.3 6.3-5.3M10.3 12c2.2 0 2.5 5.3 6.3 5.3"/></Frame>;
}

export function PrizmEvaluationIcon(props: IconProps) {
  return <Frame {...props}><path {...line} d="M4.2 5.2h6.5v13.6H4.2zM13.3 5.2h6.5v13.6h-6.5z"/><path {...line} d="m5.9 13.2 1.5 1.5 2.1-3M15.2 9.3h2.7M15.2 12.2h2.7"/></Frame>;
}

export function PrizmDeploymentIcon(props: IconProps) {
  return <Frame {...props}><circle cx="12" cy="5" r="2.2" {...line}/><circle cx="5" cy="18.2" r="2.2" {...line}/><circle cx="19" cy="18.2" r="2.2" {...line}/><path {...line} d="M12 7.2v4.1M12 11.3 5.8 16M12 11.3l6.2 4.7"/></Frame>;
}
