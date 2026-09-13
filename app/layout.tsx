import type { Metadata } from 'next';
import './globals.css';
import './prizm-design-system.css';
export const metadata: Metadata = {title:'PRIZM | Manufacturing AI',description:'Production-ready Intelligence for Zero-loss Manufacturing. 현대자동차 제조 AI 포털.',icons:{icon:'/prizm-favicon.ico'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
