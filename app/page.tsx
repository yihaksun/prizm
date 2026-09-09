import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Database,
  Factory,
  Gauge,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  Radio,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const navItems = [
  { label: 'Overview', href: '#top', icon: LayoutDashboard, active: true },
  { label: 'AI Hub', href: '#assets', icon: LibraryBig },
  { label: 'Training Studio', href: '#lifecycle', icon: Workflow },
  { label: 'Deployments', href: '#lifecycle', icon: Boxes },
  { label: 'Observability', href: '#attention', icon: Activity },
];

const lifecycle = [
  { step: '01', name: 'Discover', ko: 'AI 자산 탐색', icon: Database, value: '328', unit: 'assets', note: '검증된 데이터 · 모델 · 코드' },
  { step: '02', name: 'Build', ko: '학습과 실험', icon: Workflow, value: '08', unit: 'running', note: '표준 Notebook 기반 실행' },
  { step: '03', name: 'Operate', ko: '배포와 확산', icon: Boxes, value: '64', unit: 'models', note: '생산 현장에서 운영 중' },
  { step: '04', name: 'Evolve', ko: '관찰과 개선', icon: Gauge, value: '99.8', unit: '%', note: '플랫폼 가용성' },
];

const projects = [
  { name: '차체 용접 품질 검사', domain: 'BODY · VISION INSPECTION', plant: '울산공장', model: 'WeldNet 2.4', updated: '12분 전', status: '운영 중', tone: 'live' },
  { name: '도장 표면 결함 탐지', domain: 'PAINT · DEFECT DETECTION', plant: '아산공장', model: 'SurfaceNet 1.8', updated: '38분 전', status: '학습 중', tone: 'training' },
  { name: '의장 부품 조립 검증', domain: 'ASSEMBLY · PART VERIFICATION', plant: '전주공장', model: 'AssemblyNet 3.1', updated: '어제', status: '검토 필요', tone: 'review' },
];

export default function Home() {
  return (
    <SidebarProvider style={{ '--sidebar-width': '248px' } as React.CSSProperties}>
      <Sidebar className="app-sidebar">
        <SidebarHeader className="sidebar-header">
          <a href="#top" className="wordmark" aria-label="PRIZM 홈">
            <img src="/prizm-wordmark.svg" alt="PRIZM" />
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
                <SidebarMenuButton render={<a href={item.href} />} isActive={item.active} className="primary-nav-item">
                  <item.icon /><span>{item.label}</span>{item.active && <i className="selected-mark" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          <div className="nav-section-label nav-section-spaced">My work</div>
          <SidebarMenu className="primary-nav">
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#projects" />} className="primary-nav-item">
                <Layers3 /><span>프로젝트</span><b className="nav-badge">3</b>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#attention" />} className="primary-nav-item">
                <ShieldCheck /><span>승인 및 검토</span><b className="nav-badge urgent">2</b>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#lifecycle" />} className="primary-nav-item">
                <ServerCog /><span>Runtime Catalog</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <div className="brand-manifesto">
            <span className="prizm-beam" />
            <p>One intelligence.<br />Every factory.</p>
            <small>Production-ready Intelligence<br />for Zero-loss Manufacturing</small>
          </div>
        </SidebarContent>

        <SidebarFooter className="sidebar-footer">
          <a href="#" className="help-link"><CircleHelp size={17} /><span>도움말 및 지원</span><ArrowUpRight size={14} /></a>
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

        <main className="dashboard">
          <section className="welcome-row">
            <div>
              <span className="page-overline">Wednesday · 09 September 2026</span>
              <h1>좋은 아침이에요.</h1>
              <p>오늘도 제조 AI의 흐름을 이어가세요.</p>
            </div>
            <div className="welcome-actions">
              <span className="demo-disclosure">시연용 데이터</span>
              <button type="button" className="secondary-action"><Command size={16} /> 빠른 실행</button>
              <button type="button" className="primary-action">새 학습 시작 <ArrowRight size={16} /></button>
            </div>
          </section>

          <section className="hero-console" aria-label="글로벌 제조 AI 현황">
            <img src="/prizm-network.png" alt="전 세계 제조 현장이 연결된 PRIZM 네트워크" className="hero-network" />
            <div className="hero-vignette" /><div className="hero-grid" /><span className="light-scan" />
            <div className="hero-copy">
              <span className="hero-live"><i /> Intelligence network · Live</span>
              <h2>From data<br />to every factory.</h2>
              <p>공장의 데이터를 연결하고, 검증된 지능을<br />전 세계 생산 현장으로 확산합니다.</p>
              <a href="#lifecycle" className="hero-link">AI 생애주기 보기 <ArrowRight size={17} /></a>
            </div>
            <div className="network-pulse">
              <span className="pulse-orbit"><Radio size={18} /></span>
              <span><small>PRIZM NETWORK</small><strong>12개 제조 거점 연결</strong></span>
            </div>
            <div className="hero-metrics">
              <div><span>운영 모델</span><strong>64</strong><small>production models</small></div>
              <div><span>오늘의 추론</span><strong>2.48<span>M</span></strong><small className="positive">↗ 12.6% from yesterday</small></div>
              <div><span>플랫폼 가용성</span><strong>99.8<span>%</span></strong><small><i className="online-dot" /> all systems operational</small></div>
            </div>
          </section>

          <section id="lifecycle" className="lifecycle-section">
            <div className="section-heading">
              <div><span className="section-overline">Connected lifecycle</span><h2>하나의 흐름으로 이어지는 제조 AI</h2></div>
              <a href="#assets">전체 서비스 <ArrowRight size={15} /></a>
            </div>
            <div className="lifecycle-rail" id="assets">
              {lifecycle.map((item, index) => (
                <a href="#projects" className="lifecycle-stage" key={item.name}>
                  <div className="stage-topline">
                    <span className="stage-number">{item.step}</span><span className="stage-node"><item.icon size={18} /></span>
                    {index < lifecycle.length - 1 && <span className="stage-connector"><i /></span>}
                  </div>
                  <div className="stage-title"><h3>{item.name}</h3><ArrowUpRight size={17} /></div>
                  <p>{item.ko}</p>
                  <div className="stage-metric"><strong>{item.value}</strong><span>{item.unit}</span></div>
                  <small>{item.note}</small>
                </a>
              ))}
            </div>
          </section>

          <div className="work-grid">
            <section className="work-panel project-panel" id="projects">
              <div className="panel-heading">
                <div><span className="section-overline">My work</span><h2>최근 프로젝트</h2></div>
                <a href="#">전체 프로젝트 <ArrowRight size={14} /></a>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>프로젝트</TableHead><TableHead>생산 거점</TableHead><TableHead>운영 모델</TableHead><TableHead>최근 활동</TableHead><TableHead>상태</TableHead></TableRow></TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.name}>
                      <TableCell><div className="project-cell"><span className="project-symbol"><Factory size={17} /></span><span><strong>{project.name}</strong><small>{project.domain}</small></span></div></TableCell>
                      <TableCell>{project.plant}</TableCell><TableCell><code>{project.model}</code></TableCell><TableCell>{project.updated}</TableCell>
                      <TableCell><span className={`status-pill ${project.tone}`}><i />{project.status}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <aside className="work-panel attention-panel" id="attention">
              <div className="panel-heading"><div><span className="section-overline">Action queue</span><h2>확인이 필요해요 <b>2</b></h2></div><Sparkles size={18} /></div>
              <a href="#" className="attention-item">
                <span className="attention-symbol warning"><Activity size={18} /></span>
                <span className="attention-copy"><strong>모델 성능 변화가 감지됐어요</strong><p>정확도가 운영 기준보다 2.3% 낮아졌습니다.</p><small><Factory size={12} /> 전주공장 · 의장 조립 검증</small></span><ArrowUpRight size={15} />
              </a>
              <a href="#" className="attention-item">
                <span className="attention-symbol ready"><ShieldCheck size={18} /></span>
                <span className="attention-copy"><strong>후보 모델 평가가 완료됐어요</strong><p>운영 배포 전 평가 결과를 검토하세요.</p><small><Clock3 size={12} /> 오늘 16:00까지</small></span><ArrowUpRight size={15} />
              </a>
              <div className="queue-footer"><span><i /> 2건의 결정이 다음 단계로 이어집니다</span><ChevronRight size={14} /></div>
            </aside>
          </div>

          <footer className="dashboard-footer"><span>PRIZM · Production-ready Intelligence for Zero-loss Manufacturing</span><span>HYUNDAI MOTOR COMPANY · 제조솔루션본부</span></footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
