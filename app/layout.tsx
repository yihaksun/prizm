import type { Metadata } from 'next';
import './globals.css';
import './prizm-design-system.css';
import { PortalGradientBackground } from '@/components/portal-page-primitives';
export const metadata: Metadata = {title:'PRIZM | Manufacturing AI',description:'Production-ready Intelligence for Zero-loss Manufacturing. 현대자동차 제조 AI 포털.',icons:{icon:'/prizm-favicon.ico'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body><PortalGradientBackground className="portal-root-background">{children}</PortalGradientBackground></body></html>}
