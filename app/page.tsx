'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  CheckSquare,
  CircleHelp,
  Command,
  Cpu,
  Database,
  Factory,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  Play,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PrizmHero } from '@/components/prizm-hero';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

type NavGroup = { label: string; icon: LucideIcon; badge?: number; active?: boolean; href?: string; children?: { label: string; href: string }[] };

const myWorkGroups: NavGroup[] = [
  { label: '나의 작업', icon: CheckSquare, badge: 2, children: [{ label: '할 일', href: '/work/tasks' }, { label: '작업 이력', href: '/work/history' }] },
  { label: '즐겨찾기', icon: Star, children: [{ label: '즐겨찾는 과제', href: '#flow' }, { label: '즐겨찾는 자산', href: '#assets' }] },
];

const platformGroups: NavGroup[] = [
  { label: '대시보드', icon: LayoutDashboard, active: true, children: [{ label: '홈', href: '/' }, { label: '오늘의 작업', href: '#attention' }, { label: '거점 운영', href: '#sites' }, { label: '파이프라인 현황', href: '#execute' }, { label: '성과 근거', href: '#evidence' }, { label: '재무 기여', href: '#contribution' }] },
  { label: '과제관리', icon: Layers3, href: '/projects' },
  { label: '데이터관리', icon: Database, children: [{ label: '이미지 카탈로그', href: '/image-catalog/review' }, { label: '데이터 연결 매뉴얼', href: '#assets' }] },
  { label: '자산관리', icon: LibraryBig, children: [{ label: '모델 자산', href: '/assets/models' }, { label: '코드 자산', href: '/assets/code' }, { label: '데이터 자산', href: '/assets/data' }, { label: '파이프라인 구성', href: '/assets/pipelines' }, { label: '파이프라인 개발 매뉴얼', href: '#flow' }, { label: 'SDK 매뉴얼', href: '#flow' }] },
  { label: '실행관리', icon: Workflow, children: [{ label: '실험 대시보드', href: '/assets/code?pipeline=1' }] },
  { label: '평가관리', icon: ShieldCheck, children: [{ label: '모델 평가', href: '/evaluation/models' }, { label: '자동 평가 기준 관리', href: '#evidence' }] },
  { label: '배포관리', icon: Rocket, children: [{ label: '배포 현황', href: '#sites' }, { label: '배포 요청', href: '#attention' }, { label: '단계 승격', href: '#attention' }, { label: '거점 확산', href: '#sites' }, { label: '버전·롤백', href: '#history' }] },
  { label: '모니터링', icon: Activity, badge: 1, children: [{ label: '모델 성능', href: '/monitoring/models' }, { label: '데이터 드리프트', href: '/monitoring/models' }, { label: '서비스 상태', href: '#sites' }, { label: '알림·이벤트', href: '#history' }, { label: '이슈·조치', href: '#attention' }] },
  { label: '자원관리', icon: Cpu, children: [{ label: '실행 자원 관리', href: '/resources/compute' }, { label: '실행 환경 관리', href: '/resources/environments' }] },
  { label: '관리자', icon: Settings2, children: [{ label: '사용자·조직', href: '#top' }, { label: '역할·권한', href: '#top' }, { label: '정책·승인', href: '#top' }, { label: '환경·자원', href: '#top' }, { label: '연동·감사', href: '#top' }] },
];

const flowStages = [
  { code: 'INGEST', label: '수집', value: '328', unit: 'ASSETS', meta: '+26 TODAY' },
  { code: 'CURATE', label: '정제', value: '42', unit: 'READY', meta: '3 CHECK' },
  { code: 'EXPERIMENT', label: '실험', value: '18', unit: 'ACTIVE', meta: '6 OWNERS' },
  { code: 'TRAIN', label: '학습', value: '08', unit: 'RUNNING', meta: '2 QUEUED' },
  { code: 'EVALUATE', label: '평가', value: '03', unit: 'GATES', meta: '1 DUE' },
  { code: 'REGISTER', label: '등록', value: '76', unit: 'MODELS', meta: '12 CANDIDATE' },
  { code: 'DEPLOY', label: '배포', value: '556', unit: 'LIVE', meta: '+7 THIS WEEK' },
  { code: 'OBSERVE', label: '관찰', value: '02', unit: 'SIGNALS', meta: '1 ACTION' },
];

const contributionKpis = [
  { code: 'TOTAL VALUE', label: '누적 재무 기여', value: '184.6억 원', detail: '2026 YTD · 검증 완료 기준', tone: 'total' },
  { code: 'INFRA', label: '인프라 투자 절감', value: '72.4억 원', detail: '중앙 GPU·Runtime 공동 활용', meta: '39.2%' },
  { code: 'LABOR', label: '운영 인건비 절감', value: '58.7억 원', detail: '자동화 12.8만 시간 환산', meta: '31.8%' },
  { code: 'LOSS', label: '품질·비가동 손실 회피', value: '53.5억 원', detail: '이상 조기탐지·안전한 롤백', meta: '29.0%' },
];

const evidenceRows = [
  { model: 'WeldNet 2.4', site: '울산 · 차체 3라인', baseline: '수동검사 100%', current: '18%', impact: '₩21.8억', evidence: '표본 42K · 438h/월' },
  { model: 'SurfaceNet 1.8', site: '아산 · 도장 2라인', baseline: '검출률 91.2%', current: '97.8%', impact: '₩13.6억', evidence: 'Gate 7/7 · 재검사 −31%' },
  { model: 'AssemblyNet 3.1', site: '전주 · 의장', baseline: '비가동 14.2h', current: '8.1h', impact: '₩8.4억', evidence: '12주 검증 · −43.0%' },
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
  const [activeDashboardHref, setActiveDashboardHref] = useState('/');

  useEffect(() => {
    const sectionIds = ['attention', 'sites', 'execute', 'evidence', 'contribution'];
    let animationFrame = 0;
    const syncDashboardNavigation = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        const marker = window.scrollY + Math.min(window.innerHeight * 0.34, 320);
        let nextHref = '/';
        for (const id of sectionIds) {
          const section = document.getElementById(id);
          if (section && marker >= section.offsetTop) nextHref = `#${id}`;
        }
        setActiveDashboardHref((current) => current === nextHref ? current : nextHref);
      });
    };

    syncDashboardNavigation();
    window.addEventListener('scroll', syncDashboardNavigation, { passive: true });
    window.addEventListener('resize', syncDashboardNavigation);
    window.addEventListener('hashchange', syncDashboardNavigation);
    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', syncDashboardNavigation);
      window.removeEventListener('resize', syncDashboardNavigation);
      window.removeEventListener('hashchange', syncDashboardNavigation);
    };
  }, []);

  return (
    <SidebarProvider style={{ '--sidebar-width': '248px' } as React.CSSProperties}>
      <Sidebar className="app-sidebar">
        <SidebarHeader className="sidebar-header">
          <a href="/" className="wordmark" aria-label="PRIZM 홈">
            <Image src="/prizm-logo-dark-rainbow.svg" alt="PRIZM" width={920} height={300} priority />
          </a>
        </SidebarHeader>

        <SidebarContent>
          <button className="workspace-switcher" type="button">
            <span className="workspace-symbol"><Factory size={18} /></span>
              <span><strong>제조솔루션본부</strong><small>Manufacturing Solution Div.</small></span>
            <ChevronDown size={15} />
          </button>

          <nav className="sidebar-nav" aria-label="주요 메뉴">
            <div className="nav-section-label">My work</div>
            <div className="nav-accordion nav-accordion-compact">
              {myWorkGroups.map((group) => (
                <details className="nav-disclosure" key={group.label} name="my-work-navigation">
                  <summary>
                    <group.icon /><span>{group.label}</span>{group.badge && <b className="nav-badge urgent">{group.badge}</b>}<ChevronDown className="nav-chevron" />
                  </summary>
                  <div className="nav-submenu">
                    {group.children?.map((child) => child.href.startsWith('/')
                      ? <Link href={child.href} key={child.label}>{child.label}</Link>
                      : <a className="is-unavailable" href={child.href} title="화면 준비 중" key={child.label}>{child.label}</a>)}
                  </div>
                </details>
              ))}
            </div>

            <div className="nav-section-label nav-section-spaced">Platform</div>
            <div className="nav-accordion">
              {platformGroups.map((group) => group.href ? <Link className="nav-direct" href={group.href} key={group.label}><group.icon /><span>{group.label}</span></Link> : (
                <details className={group.active ? 'nav-disclosure is-active' : 'nav-disclosure'} key={group.label} name="platform-navigation" open={group.active}>
                  <summary>
                    <group.icon /><span>{group.label}</span>{group.badge && <b className="nav-badge urgent">{group.badge}</b>}<ChevronDown className="nav-chevron" />
                  </summary>
                  <div className="nav-submenu">
                    {group.children?.map((child) => { const unavailable = group.label !== '대시보드' && child.href.startsWith('#'); const current = group.active && child.href === activeDashboardHref; const classes = [current ? 'is-current' : '', unavailable ? 'is-unavailable' : ''].filter(Boolean).join(' '); return <Link className={classes} href={child.href} onClick={() => { if (group.active) setActiveDashboardHref(child.href); }} title={unavailable ? '화면 준비 중' : undefined} key={child.label}>{child.label}</Link>; })}
                  </div>
                </details>
              ))}
            </div>
          </nav>

        </SidebarContent>

        <SidebarFooter className="sidebar-footer">
          <a href="#top" className="help-link"><CircleHelp size={17} /><span>도움말 및 지원</span><ArrowUpRight size={14} /></a>
          <div className="sidebar-brand-footer">
            <div className="sidebar-brand-meta"><Image src="/eforest-wordmark.svg" alt="E-FOREST" width={58} height={7} style={{ width: '58px', height: 'auto' }} /><i /><span>PRIZM v2.8.4</span></div>
            <small className="sidebar-copyright"><span className="copyright-symbol">©</span><span>2026 HYUNDAI MOTOR COMPANY</span></small>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="app-shell home-app-shell" id="top">
        <header className="topbar">
          <div className="topbar-path">
            <SidebarTrigger aria-label="메뉴 열기 또는 닫기" /><strong>홈</strong>
          </div>
          <button className="command-search" type="button">
            <Search size={16} /><span>과제, 자산, 모델 검색</span><kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <span className="system-health"><i /> 시스템 정상</span>
            <button type="button" className="icon-button" aria-label="알림"><Bell size={18} /><i /></button>
            <span className="topbar-divider" />
            <button className="profile" type="button">
              <span className="avatar">HS</span><span><strong>이학선 책임매니저</strong><small>제조AI기술개발팀</small></span><ChevronDown size={14} />
            </button>
          </div>
        </header>

        <PrizmHero />

        <main className="dashboard" id="operations">
          <section className="operations-commandbar" aria-label="운영 조회 및 실행">
            <div className="context-controls">
              <button type="button"><Factory size={14} /> 전체 거점 <ChevronDown size={13} /></button>
              <button type="button">PRODUCTION <ChevronDown size={13} /></button>
              <button type="button">최근 24시간 <ChevronDown size={13} /></button>
            </div>
            <div className="commandbar-actions">
              <span className="demo-disclosure">시연용 데이터</span>
              <button type="button" className="quiet-action"><Command size={14} /> 빠른 실행</button>
              <button type="button" className="run-action"><Play size={13} fill="currentColor" /> 학습 실행</button>
            </div>
          </section>

          <section className="dashboard-section attention-section" id="attention" aria-labelledby="attention-title">
            <div className="section-titlebar">
              <div>
                <span>01 / 오늘의 작업</span>
                <h2 id="attention-title">확인이 필요한 작업 <em className="section-count">2</em></h2>
                <p>오늘 마감 2건 · 성능 검토 1건 · 배포 승인 1건</p>
              </div>
              <Link href="/work/tasks">전체 작업 보기 <ArrowRight size={14} /></Link>
            </div>
            <div className="attention-panel">
              <div className="decision-list">
                <Link href="/work/tasks?task=TASK-260912-017" className="decision-item decision-warning decision-with-evidence">
                  <div className="decision-code"><strong>모델 성능 이상 · 우선</strong><time>13:12까지</time></div>
                  <div className="decision-copy">
                    <h3>Weld Detector 원인 확인</h3>
                    <p>울산 차체 2라인 · 야간 조도 구간</p>
                    <div className="decision-metric-pair" aria-label="현재 검출률과 운영 기준 비교">
                      <span><small>현재 검출률</small><strong>88.6%</strong></span>
                      <i />
                      <span><small>운영 기준</small><strong>92.0%</strong></span>
                    </div>
                  </div>
                  <figure className="decision-evidence-preview">
                    <Image src="/weld-inspection-defect-thumb.jpg" alt="미세 크랙 미검출 사례" fill sizes="160px" priority />
                    <span>AI 미검출</span>
                  </figure>
                  <span className="decision-link">원인 및 조치 검토 <ArrowRight size={14} /></span>
                </Link>
                <a href="#execute" className="decision-item">
                  <div className="decision-code"><strong>배포 승인</strong><time>16:00까지</time></div>
                  <h3>SurfaceNet 배포 승인</h3>
                  <p>검증 7/7 통과 · 아산 도장 · MLOps</p>
                  <span className="decision-link">비교 결과 검토 <ArrowRight size={14} /></span>
                </a>
              </div>
            </div>
          </section>

          <section className="operations-ledger" aria-label="최근 운영 변경 및 생애주기">
            <div className="change-ledger" id="history">
              <header><div><span>최근 변경</span><strong>지난 접속 이후 3건</strong></div><time>06:30 → 08:42</time></header>
              {changes.map((change) => (
                <a href="#flow" className="change-row" key={`${change.time}-${change.title}`}>
                  <time>{change.time}</time>
                  <span className={`change-kind ${change.tone}`}>{change.kind}</span>
                  <span className="change-title"><strong>{change.title}</strong><small>{change.context}</small></span>
                  <span className="change-evidence"><small>근거</small><strong>{change.evidence}</strong></span>
                  <span className={`change-impact ${change.tone}`}>{change.impact}</span>
                  <ArrowRight size={14} />
                </a>
              ))}
            </div>

            <div className="flow-summary" id="flow">
              <header className="flow-summary-heading"><div><span>생애주기 현황</span><strong>8단계</strong></div><small>실시간 집계</small></header>
              <div className="flowline">
                {flowStages.map((stage, index) => (
                  <a href="#execute" className="flow-stage" key={stage.code}>
                    <div className="flow-name"><strong>{stage.code}</strong><span>{stage.label}</span></div>
                    <div className="flow-value"><strong>{stage.value}</strong><span>{stage.unit}</span></div>
                    <small>{stage.meta}</small>
                    {index === 0 && <i className="flow-current" />}
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="dashboard-section plant-section" id="sites">
            <div className="section-titlebar">
              <div><span>02 / 거점 운영</span><h2>거점별 운영 매트릭스</h2><p>연결된 12개 생산 거점의 데이터와 모델 상태</p></div>
              <div className="section-tools"><span>4 / 12 거점</span><button type="button"><SlidersHorizontal size={14} /> 필터</button><a href="#assets">전체 거점 <ArrowRight size={14} /></a></div>
            </div>
            <div className="plant-matrix-wrap" id="assets">
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

          <section className="dashboard-section run-board pipeline-section" id="execute">
              <div className="section-titlebar">
                <div><span>03 / 파이프라인 현황</span><h2>실행 중인 파이프라인</h2><p>현재 교대에 동작 중인 학습 및 평가 작업</p></div>
                <a href="#flow">전체 파이프라인 <ArrowRight size={14} /></a>
              </div>
              <div className="run-list">
                {runs.map((run) => (
                  <a href="#flow" className="run-row" key={run.id}>
                    <span className="run-id">{run.id}</span>
                    <span className="run-name"><strong>{run.name}</strong><small>{run.plant} · {run.model}</small></span>
                    <span className="run-progress"><i style={{ width: `${run.progress}%` }} /><em>{run.progress}%</em></span>
                    <span className="run-eta">ETA {run.eta}</span>
                    <ArrowUpRight size={15} />
                  </a>
                ))}
              </div>
          </section>

          <section className="dashboard-section evidence-section" id="evidence" aria-labelledby="evidence-title">
            <div className="section-titlebar">
              <div><span>04 / 성과 근거</span><h2 id="evidence-title">Zero-Loss 성과 원장</h2><p>운영 데이터로 검증된 품질·비가동 개선 효과</p></div>
              <div className="section-tools"><span>검증 완료 3건</span><a href="#contribution">전체 기여 근거 <ArrowRight size={14} /></a></div>
            </div>
            <div className="evidence-table-wrap">
              <table className="evidence-table">
                <thead><tr><th>적용 모델</th><th>거점·라인</th><th>기존 기준</th><th>현재</th><th>연간 기여</th><th>검증 근거</th><th aria-label="상세" /></tr></thead>
                <tbody>
                  {evidenceRows.map((row) => (
                    <tr key={row.model}>
                      <td><strong>{row.model}</strong></td><td>{row.site}</td><td>{row.baseline}</td><td>{row.current}</td><td><strong>{row.impact}</strong></td><td>{row.evidence}</td><td><ArrowUpRight size={15} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dashboard-section contribution-section" id="contribution" aria-labelledby="contribution-title">
            <div className="section-titlebar">
              <div><span>05 / 재무 기여</span><h2 id="contribution-title">재무 기여</h2><p>PRIZM이 만든 2026년 누적 가치 · 검증 완료 기준</p></div>
              <div className="contribution-context"><span>시연용 데이터</span><button type="button">산정 기준 보기 <ArrowRight size={13} /></button></div>
            </div>
            <div className="contribution-ledger">
              <div className="contribution-grid">
                {contributionKpis.map((kpi) => (
                  <article className={kpi.tone === 'total' ? 'contribution-kpi is-total' : 'contribution-kpi'} key={kpi.code}>
                    <div><span>{kpi.code}</span>{kpi.meta && <em>{kpi.meta}</em>}</div>
                    <strong>{kpi.value}</strong>
                    <h3>{kpi.label}</h3>
                    <p>{kpi.detail}</p>
                  </article>
                ))}
              </div>
              <div className="contribution-mix" aria-label="기여 금액 구성"><i className="infra" /><i className="labor" /><i className="loss" /></div>
            </div>
          </section>

          <footer className="dashboard-footer"><span>PRIZM v2.8.4 · PRODUCTION</span><span>HYUNDAI MOTOR COMPANY · 제조솔루션본부</span></footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
