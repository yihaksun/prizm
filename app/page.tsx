import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Factory,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  Play,
  Search,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react';
import Image from 'next/image';
import { PrizmHero } from '@/components/prizm-hero';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const navItems = [
  { label: 'Overview', href: '#top', icon: LayoutDashboard, active: true },
  { label: 'AI Catalog', href: '#assets', icon: LibraryBig },
  { label: 'Pipelines', href: '#lifecycle', icon: Workflow },
  { label: 'Deployments', href: '#projects', icon: Boxes },
  { label: 'Observability', href: '#attention', icon: Activity },
];

const flowStages = [
  { index: '01', code: 'DATA', label: '데이터 준비', value: '328', unit: 'ASSETS', meta: '+26 TODAY' },
  { index: '02', code: 'TRAIN', label: '학습 실행', value: '08', unit: 'RUNNING', meta: '2 QUEUED' },
  { index: '03', code: 'VALIDATE', label: '검증 대기', value: '03', unit: 'REVIEWS', meta: '1 DUE' },
  { index: '04', code: 'PRODUCTION', label: '운영 배포', value: '64', unit: 'MODELS', meta: '+2 THIS WEEK' },
  { index: '05', code: 'WATCH', label: '성능 관찰', value: '02', unit: 'SIGNALS', meta: '1 ACTION' },
];

const plants = [
  { code: 'USN', name: '울산공장', data: 'READY', training: '03 RUN', deploy: '28 LIVE', health: '99.9', updated: '08:42', tone: 'stable', signal: [4, 6, 5, 7, 8, 6, 9, 8, 10, 9, 11, 10] },
  { code: 'ASN', name: '아산공장', data: 'READY', training: '04 RUN', deploy: '21 LIVE', health: '99.7', updated: '08:41', tone: 'stable', signal: [5, 4, 6, 6, 8, 7, 7, 9, 8, 9, 10, 9] },
  { code: 'JJN', name: '전주공장', data: 'CHECK', training: '01 RUN', deploy: '15 LIVE', health: '98.4', updated: '08:40', tone: 'watch', signal: [8, 7, 7, 6, 8, 5, 6, 4, 3, 5, 4, 3] },
  { code: 'NYG', name: '남양연구소', data: 'READY', training: '12 READY', deploy: 'STAGING', health: '99.8', updated: '08:39', tone: 'stable', signal: [3, 5, 4, 6, 5, 7, 8, 8, 9, 8, 10, 11] },
];

const runs = [
  { id: 'RUN-2418', name: '차체 용접 품질 검사', plant: '울산 · 차체', model: 'WeldNet 2.4', progress: 72, eta: '18 MIN' },
  { id: 'RUN-2417', name: '도장 표면 결함 탐지', plant: '아산 · 도장', model: 'SurfaceNet 1.8', progress: 46, eta: '43 MIN' },
  { id: 'RUN-2416', name: '프레스 패널 형상 예측', plant: '울산 · 프레스', model: 'FormNet 1.2', progress: 91, eta: '06 MIN' },
];

const changes = [
  { time: '08:42', kind: 'MODEL', title: 'WeldNet 2.4 운영 승격', context: '울산 · 차체 3라인', evidence: '18K 판정 · 오류 0.21%', impact: '영향 없음', tone: 'live' },
  { time: '08:31', kind: 'DRIFT', title: 'AssemblyNet 기준 이탈', context: '전주 · 의장 조립', evidence: '기준 대비 −2.3%', impact: '검토 필요', tone: 'warn' },
  { time: '08:06', kind: 'DATA', title: 'Paint-Q3 데이터 검증 완료', context: '아산 · 도장 2라인', evidence: '18.2K samples · 7/7', impact: '학습 가능', tone: 'ready' },
];

export default function Home() {
  return (
    <SidebarProvider style={{ '--sidebar-width': '248px' } as React.CSSProperties}>
      <Sidebar className="app-sidebar">
        <SidebarHeader className="sidebar-header">
          <a href="#top" className="wordmark" aria-label="PRIZM 홈">
            <Image src="/prizm-logo-dark.svg" alt="PRIZM" width={920} height={300} priority />
          </a>
        </SidebarHeader>

        <SidebarContent>
          <button className="workspace-switcher" type="button">
            <span className="workspace-symbol"><Factory size={18} /></span>
            <span><strong>제조솔루션본부</strong><small>Enterprise workspace</small></span>
            <ChevronDown size={15} />
          </button>

          <div className="nav-section-label">Platform</div>
          <SidebarMenu className="primary-nav">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton render={<a href={item.href} aria-label={item.label} />} isActive={item.active} className="primary-nav-item">
                  <item.icon /><span>{item.label}</span>{item.active && <i className="selected-mark" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          <div className="nav-section-label nav-section-spaced">My work</div>
          <SidebarMenu className="primary-nav">
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#projects" aria-label="프로젝트" />} className="primary-nav-item">
                <Layers3 /><span>프로젝트</span><b className="nav-badge">3</b>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#attention" aria-label="승인 및 검토" />} className="primary-nav-item">
                <ShieldCheck /><span>승인 및 검토</span><b className="nav-badge urgent">2</b>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#lifecycle" aria-label="Runtime Catalog" />} className="primary-nav-item">
                <ServerCog /><span>Runtime Catalog</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <div className="environment-card">
            <div><span className="environment-dot" />PRODUCTION</div>
            <strong>KR · GLOBAL NETWORK</strong>
            <small>Platform version 2.8.4</small>
          </div>
        </SidebarContent>

        <SidebarFooter className="sidebar-footer">
          <a href="#top" className="help-link"><CircleHelp size={17} /><span>도움말 및 지원</span><ArrowUpRight size={14} /></a>
          <div className="hyundai-lockup"><strong>HYUNDAI</strong><span>MOTOR COMPANY</span></div>
        </SidebarFooter>
      </Sidebar>

      <div className="app-shell" id="top">
        <header className="topbar">
          <div className="topbar-path">
            <SidebarTrigger aria-label="메뉴 열기 또는 닫기" /><span>PRIZM</span><ChevronRight size={13} /><strong>Overview</strong>
          </div>
          <button className="command-search" type="button">
            <Search size={16} /><span>프로젝트, 자산, 모델 검색</span><kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <span className="system-health"><i /> 시스템 정상</span>
            <button type="button" className="icon-button" aria-label="알림"><Bell size={18} /><i /></button>
            <span className="topbar-divider" />
            <button className="profile" type="button">
              <span className="avatar">ML</span><span><strong>MLOps 엔지니어</strong><small>Manufacturing AI</small></span><ChevronDown size={14} />
            </button>
          </div>
        </header>

        <PrizmHero />

        <main className="dashboard" id="operations">
          <section className="operations-heading">
            <div>
              <span className="page-index">9월 9일 수요일 · 주간조 · 08:42 KST</span>
              <h1>제조 AI 운용 현황</h1>
              <p>12개 생산 거점의 흐름과 오늘 판단할 항목을 한 화면에 모았습니다.</p>
            </div>
            <div className="heading-actions">
              <span className="demo-disclosure">시연용 데이터</span>
              <button type="button" className="quiet-action"><Command size={15} /> 빠른 실행</button>
              <button type="button" className="run-action"><Play size={14} fill="currentColor" /> 학습 실행</button>
            </div>
          </section>

          <section className="operations-ledger" aria-label="제조 AI 실시간 운영판">
            <header className="ledger-toolbar">
              <div className="live-label"><span /> LIVE OPERATIONS</div>
              <div className="context-controls">
                <button type="button"><Factory size={14} /> 전체 거점 <ChevronDown size={13} /></button>
                <button type="button">PRODUCTION <ChevronDown size={13} /></button>
                <button type="button">최근 24시간 <ChevronDown size={13} /></button>
                <span className="last-sync">LAST SYNC 08:42:18 KST</span>
              </div>
            </header>

            <div className="ledger-body">
              <div className="network-readout">
                <div className="network-status-strip">
                  <div><span>생산 거점</span><strong>12 / 12</strong><small>연결</small></div>
                  <div><span>운영 모델</span><strong>64</strong><small>63 정상 · 1 관찰</small></div>
                  <div><span>추론 처리</span><strong>2.48M</strong><small>최근 24시간</small></div>
                  <div><span>서비스 가용성</span><strong>99.8%</strong><small>SLO 99.5%</small></div>
                </div>

                <div className="change-ledger">
                  <header><div><span>지난 접속 이후</span><strong>3건의 변경</strong></div><time>06:30 → 08:42</time></header>
                  {changes.map((change) => (
                    <a href="#projects" className="change-row" key={`${change.time}-${change.title}`}>
                      <time>{change.time}</time>
                      <span className={`change-kind ${change.tone}`}>{change.kind}</span>
                      <span className="change-title"><strong>{change.title}</strong><small>{change.context}</small></span>
                      <span className="change-evidence"><small>근거</small><strong>{change.evidence}</strong></span>
                      <span className={`change-impact ${change.tone}`}>{change.impact}</span>
                      <ArrowRight size={14} />
                    </a>
                  ))}
                </div>

                <div className="flowline" id="lifecycle">
                  {flowStages.map((stage, index) => (
                    <a href="#projects" className="flow-stage" key={stage.code}>
                      <div className="flow-name"><strong>{stage.code}</strong><span>{stage.label}</span></div>
                      <div className="flow-value"><strong>{stage.value}</strong><span>{stage.unit}</span></div>
                      <small>{stage.meta}</small>
                      {index === 0 && <i className="flow-current" />}
                    </a>
                  ))}
                </div>
              </div>

              <aside className="decision-rail" id="attention">
                <header>
                  <div><span>판단 대기</span><strong>2건</strong></div>
                  <small>담당자 확인이 필요한 업무</small>
                </header>
                <a href="#projects" className="decision-item decision-warning">
                  <div className="decision-code"><strong>성능 변화 · 우선</strong><time>11:30까지</time></div>
                  <h3>AssemblyNet 기준 이탈</h3>
                  <p>기준 대비 −2.3% · 전주 의장 · 품질AI팀</p>
                  <span className="decision-link">원인 및 조치 검토 <ArrowRight size={14} /></span>
                </a>
                <a href="#projects" className="decision-item">
                  <div className="decision-code"><strong>배포 승인</strong><time>16:00까지</time></div>
                  <h3>SurfaceNet 배포 승인</h3>
                  <p>검증 7/7 통과 · 아산 도장 · MLOps</p>
                  <span className="decision-link">비교 결과 검토 <ArrowRight size={14} /></span>
                </a>
                <a href="#projects" className="decision-footer">전체 승인함 열기 <ArrowRight size={14} /></a>
              </aside>
            </div>
          </section>

          <section className="plant-section" id="assets">
            <div className="section-titlebar">
              <div><span>거점 운영</span><h2>거점별 운영 매트릭스</h2></div>
              <div className="section-tools"><span>4 OF 12 SITES</span><button type="button"><SlidersHorizontal size={14} /> 필터</button><a href="#assets">전체 거점 <ArrowRight size={14} /></a></div>
            </div>
            <div className="plant-matrix-wrap">
              <table className="plant-matrix">
                <thead><tr><th>생산 거점</th><th>DATA</th><th>TRAIN</th><th>DEPLOY</th><th>HEALTH</th><th>24H SIGNAL</th><th>UPDATED</th><th aria-label="상세" /></tr></thead>
                <tbody>
                  {plants.map((plant) => (
                    <tr key={plant.code} className={plant.tone === 'watch' ? 'watch-row' : ''}>
                      <td><span className="plant-code">{plant.code}</span><strong>{plant.name}</strong></td>
                      <td><span className={`matrix-state ${plant.data === 'CHECK' ? 'check' : ''}`}>{plant.data}</span></td>
                      <td>{plant.training}</td><td>{plant.deploy}</td>
                      <td><strong className="health-value">{plant.health}</strong><span className="health-unit">%</span></td>
                      <td><div className="signal-bars" aria-label={`${plant.name} 최근 24시간 신호`}>{plant.signal.map((level, index) => <i key={index} style={{ '--signal-level': level } as React.CSSProperties} />)}</div></td>
                      <td>{plant.updated}</td><td><ArrowUpRight size={15} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="run-board pipeline-section" id="projects">
              <div className="section-titlebar compact-titlebar">
                <div><span>파이프라인 실행</span><h2>실행 중인 파이프라인</h2></div>
                <a href="#lifecycle">전체 파이프라인 <ArrowRight size={14} /></a>
              </div>
              <div className="run-list">
                {runs.map((run) => (
                  <a href="#lifecycle" className="run-row" key={run.id}>
                    <span className="run-id">{run.id}</span>
                    <span className="run-name"><strong>{run.name}</strong><small>{run.plant} · {run.model}</small></span>
                    <span className="run-progress"><i style={{ width: `${run.progress}%` }} /><em>{run.progress}%</em></span>
                    <span className="run-eta">ETA {run.eta}</span>
                    <ArrowUpRight size={15} />
                  </a>
                ))}
              </div>
          </section>

          <footer className="dashboard-footer"><span>PRIZM v2.8.4 · PRODUCTION</span><span>HYUNDAI MOTOR COMPANY · 제조솔루션본부</span></footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
