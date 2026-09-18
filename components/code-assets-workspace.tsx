'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Box,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  Factory,
  FileCode2,
  GitBranch,
  GitFork,
  Grid2X2,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  List,
  ListChecks,
  LockKeyhole,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  PencilLine,
  Play,
  Plus,
  Power,
  Quote,
  RotateCcw,
  Rocket,
  Search,
  Share2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TerminalSquare,
  Upload,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VisionMlopsDemo, type DemoStage } from '@/components/vision-mlops-demo';
import { PortalWorkspaceTabs, type PortalTabId } from '@/components/portal-workspace-tabs';
import { PortalButton, PortalDetailFrame, PortalFilterSurface, PortalPageFrame, PortalPageHeader, PortalPrismAtmosphere, PortalWorkspaceSurface } from '@/components/portal-page-primitives';
import { AssetSdkDialog } from '@/components/asset-sdk-dialog';
import { LiveRunDetail } from '@/components/live-run-detail';
import { createRun, isFinishedRun, listRuns, PrizmApiError, type Run, type RunParameters } from '@/lib/prizm-api';

type NavGroup = {
  label: string;
  icon: LucideIcon;
  badge?: number;
  active?: boolean;
  href?: string;
  children?: { label: string; href: string; current?: boolean }[];
};

type CodeAsset = {
  id: string;
  title: string;
  description: string;
  role: '학습' | '평가' | '추론' | '전처리' | '분석';
  plant: string;
  process: string;
  project: string;
  dataType: string;
  framework: string;
  owner: string;
  version: string;
  updated: string;
  verified: '재현 확인' | '사전 점검' | '운영 승인' | '미검증';
  reuse: number;
  executable: boolean;
  restricted?: boolean;
  favorite?: boolean;
  preview: 'curve' | 'matrix' | 'series' | 'scatter' | 'bars' | 'heatmap';
  previewMetric: string;
  previewLabel: string;
  previewImage?: string;
};

type WorkspaceScreen = 'catalog' | 'detail' | 'pipeline' | 'run';
type WorkspaceTask = 'data' | 'detail' | 'run';

type RunRecord = {
  id: string;
  assetId: string;
  project: string;
  title: string;
  version: string;
  data: string;
  environment: string;
  resource: string;
  status: '요청 접수' | '자원 준비' | '실행 중' | '완료' | '실패';
  mode: '즉시 실행' | '예약 실행';
  requestedAt: string;
  progress: number;
  source: 'mock' | 'live';
  live?: Run;
};

type RunParameterName = keyof RunParameters;

const runParameterNames: RunParameterName[] = ['epochs', 'batch_size', 'image_size', 'seed'];

function liveRunStatus(run: Run): RunRecord['status'] {
  if (run.status === 'QUEUED') return '요청 접수';
  if (run.status === 'SUCCEEDED') return '완료';
  if (run.status === 'FAILED') return '실패';
  return run.stage === 'PREPARING' || run.stage === 'DATA' ? '자원 준비' : '실행 중';
}

function formatRunRequestedAt(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toRunRecord(run: Run, assets: CodeAsset[]): RunRecord {
  const asset = assets.find((item) => item.id === run.assetId);
  return {
    id: run.id,
    assetId: run.assetId,
    project: asset?.project ?? '용접 품질 고도화',
    title: asset?.title ?? run.codeKey,
    version: run.assetVersion,
    data: 'demo.door_defect · v1',
    environment: run.environment,
    resource: run.resource,
    status: liveRunStatus(run),
    mode: '즉시 실행',
    requestedAt: formatRunRequestedAt(run.requestedAt),
    progress: run.progress,
    source: 'live',
    live: run,
  };
}

type ScheduleRecord = {
  id: string;
  project: string;
  title: string;
  version: string;
  pattern: string;
  nextRun: string;
  active: boolean;
};

function getVersionOptions(currentVersion: string) {
  if (currentVersion === 'v2.4.1') return ['v2.4.1', 'v2.4.0', 'v2.3.2', 'v2.3.1'];
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion);
  if (!match) return [currentVersion];
  const [, major, minor, patch] = match.map(Number);
  return Array.from(new Set([
    currentVersion,
    `v${major}.${minor}.${Math.max(0, patch - 1)}`,
    `v${major}.${Math.max(0, minor - 1)}.${patch}`,
  ]));
}

const myWorkGroups: NavGroup[] = [
  { label: '나의 작업', icon: CheckSquare, badge: 2, children: [{ label: '할 일', href: '/work/tasks' }, { label: '작업 이력', href: '/work/history' }] },
  { label: '즐겨찾기', icon: Star, children: [{ label: '즐겨찾는 과제', href: '/#flow' }, { label: '즐겨찾는 자산', href: '/assets/code' }] },
];

const platformGroups: NavGroup[] = [
  { label: '대시보드', icon: LayoutDashboard, children: [{ label: '홈', href: '/' }, { label: '오늘의 작업', href: '/#attention' }, { label: '거점 운영', href: '/#sites' }, { label: '파이프라인 현황', href: '/#execute' }, { label: '성과 근거', href: '/#evidence' }, { label: '재무 기여', href: '/#contribution' }] },
  { label: '과제관리', icon: Layers3, href: '/projects' },
  { label: '데이터관리', icon: Database, children: [{ label: '이미지 카탈로그', href: '/image-catalog/review' }, { label: '데이터 연결 매뉴얼', href: '/#assets' }] },
  { label: '자산관리', icon: LibraryBig, active: true, children: [{ label: '모델 자산', href: '/assets/models' }, { label: '코드 자산', href: '/assets/code', current: true }, { label: '데이터 자산', href: '/assets/data' }, { label: '파이프라인 개발 매뉴얼', href: '/#flow' }, { label: 'SDK 매뉴얼', href: '/#flow' }] },
  { label: '실행관리', icon: Workflow, children: [{ label: '실험 대시보드', href: '/assets/code?pipeline=1' }] },
  { label: '평가관리', icon: ShieldCheck, children: [{ label: '모델 평가', href: '/evaluation/models' }, { label: '자동 평가 기준 관리', href: '/#evidence' }] },
  { label: '배포관리', icon: Rocket, children: [{ label: '배포 현황', href: '/#sites' }, { label: '배포 요청', href: '/#attention' }, { label: '단계 승격', href: '/#attention' }, { label: '거점 확산', href: '/#sites' }, { label: '버전·롤백', href: '/#history' }] },
  { label: '모니터링', icon: Activity, badge: 1, children: [{ label: '모델 성능', href: '/monitoring/models' }, { label: '데이터 드리프트', href: '/monitoring/models' }, { label: '서비스 상태', href: '/#sites' }, { label: '알림·이벤트', href: '/#history' }, { label: '이슈·조치', href: '/#attention' }] },
  { label: '자원관리', icon: Cpu, children: [{ label: '실행 자원 관리', href: '/resources/compute' }, { label: '실행 환경 관리', href: '/resources/environments' }] },
  { label: '관리자', icon: Settings2, children: [{ label: '사용자·조직', href: '/#top' }, { label: '역할·권한', href: '/#top' }, { label: '정책·승인', href: '/#top' }, { label: '환경·자원', href: '/#top' }, { label: '연동·감사', href: '/#top' }] },
];

const initialAssets: CodeAsset[] = [
  {
    id: 'PRJ000212-C-0001', title: '용접 비드 결함 검출 학습',
    description: '차체 용접 이미지에서 비드 형상과 결함 유형을 학습하는 표준 Notebook입니다.',
    role: '학습', plant: '울산', process: '차체 · 용접', project: '용접 품질 고도화', dataType: 'Image', framework: 'PyTorch',
    owner: '제조AI기술개발팀', version: 'v2.4.1', updated: '2일 전', verified: '재현 확인', reuse: 3, executable: true, favorite: true,
    preview: 'curve', previewMetric: '0.967', previewLabel: 'mAP50', previewImage: '/weld-inspection-defect.png',
  },
  {
    id: 'CODE-ASN-PAINT-014', title: '도장 표면 결함 모델 평가',
    description: '도장 표면 결함 모델의 공정별 성능과 오검출 사례를 비교·평가합니다.',
    role: '평가', plant: '아산', process: '도장 · 검사', project: 'Surface Zero Defect', dataType: 'Image', framework: 'PyTorch',
    owner: '품질AI팀', version: 'v1.8.0', updated: '어제', verified: '운영 승인', reuse: 2, executable: true,
    preview: 'matrix', previewMetric: '97.8%', previewLabel: '검출률',
  },
  {
    id: 'CODE-JJN-ASSEMBLY-008', title: '의장 체결 이상 실시간 추론',
    description: '체결 토크 시계열을 입력받아 이상 징후를 실시간으로 판정하는 추론 코드입니다.',
    role: '추론', plant: '전주', process: '의장 · 체결', project: '체결 이상 조기감지', dataType: 'Time Series', framework: 'ONNX Runtime',
    owner: '공정지능화팀', version: 'v3.1.2', updated: '4일 전', verified: '운영 승인', reuse: 4, executable: false,
    preview: 'series', previewMetric: '18ms', previewLabel: 'P95 응답',
  },
  {
    id: 'CODE-NYG-PRESS-021', title: '프레스 패널 형상 데이터 전처리',
    description: '3D 스캔 데이터의 좌표 정합과 결측 영역 보간을 표준화한 전처리 Notebook입니다.',
    role: '전처리', plant: '남양', process: '프레스 · 금형', project: '패널 형상 예측', dataType: 'Point Cloud', framework: 'Open3D',
    owner: '선행제조기술팀', version: 'v1.3.0', updated: '6일 전', verified: '재현 확인', reuse: 5, executable: true,
    preview: 'scatter', previewMetric: '98.4%', previewLabel: '정합률',
  },
  {
    id: 'CODE-HMA-ENERGY-004', title: '설비 에너지 사용량 예측',
    description: '공정 부하와 생산계획을 이용해 시간대별 전력 사용량을 예측합니다.',
    role: '학습', plant: 'HMA', process: '에너지 · 전공장', project: 'Factory Energy Optimizer', dataType: 'Tabular', framework: 'LightGBM',
    owner: '글로벌제조AI팀', version: 'v0.9.4', updated: '8일 전', verified: '사전 점검', reuse: 1, executable: true,
    preview: 'bars', previewMetric: '4.7%', previewLabel: 'MAPE',
  },
  {
    id: 'CODE-HMMA-LOGISTICS-011', title: '공장 물류 경로 최적화 분석',
    description: 'AGV 이동 이력과 공정 대기시간을 분석해 병목 구간을 탐색합니다.',
    role: '분석', plant: 'HMMA', process: '물류 · AGV', project: 'Smart Intralogistics', dataType: 'Tabular', framework: 'OR-Tools',
    owner: '생산물류혁신팀', version: 'v1.1.0', updated: '11일 전', verified: '미검증', reuse: 0, executable: false, restricted: true,
    preview: 'heatmap', previewMetric: '3개', previewLabel: '병목 구간',
  },
  {
    id: 'CODE-USN-BATTERY-031', title: '배터리 셀 이상 탐지 학습',
    description: '충방전 시계열의 미세한 패턴 변화를 학습해 이상 셀을 조기에 탐지합니다.',
    role: '학습', plant: '울산', process: '배터리 · 검사', project: 'Cell Quality Intelligence', dataType: 'Time Series', framework: 'PyTorch',
    owner: '전동화품질팀', version: 'v0.7.6', updated: '13일 전', verified: '사전 점검', reuse: 1, executable: true,
    preview: 'series', previewMetric: '0.951', previewLabel: 'AUROC',
  },
  {
    id: 'CODE-ASN-PAINT-017', title: '도장 결함 배치 추론',
    description: '교대 종료 후 검사 이미지를 일괄 판정하고 결과 데이터를 생성합니다.',
    role: '추론', plant: '아산', process: '도장 · 검사', project: 'Surface Zero Defect', dataType: 'Image', framework: 'TensorRT',
    owner: '품질AI팀', version: 'v1.6.3', updated: '15일 전', verified: '재현 확인', reuse: 2, executable: true,
    preview: 'matrix', previewMetric: '12.4K', previewLabel: '교대 처리량',
  },
];

const demoNavigation: Record<DemoStage, { group: string; child: string }> = {
  data: { group: '자산관리', child: '데이터 자산' },
  train: { group: '자산관리', child: '코드 자산' },
  run: { group: '실행관리', child: '실험 대시보드' },
  evaluate: { group: '평가관리', child: '모델 평가' },
  model: { group: '자산관리', child: '모델 자산' },
  monitor: { group: '모니터링', child: '모델 성능' },
};

export function PortalNavigation({ screen, demoStage, activeNavigation }: { screen: WorkspaceScreen; demoStage?: DemoStage; activeNavigation?: { group: string; child: string } }) {
  return (
    <Sidebar className="app-sidebar">
      <SidebarHeader className="sidebar-header">
        <Link href="/" className="wordmark" aria-label="PRIZM 홈">
          <Image src="/prizm-logo-dark-rainbow.svg" alt="PRIZM" width={920} height={300} priority />
        </Link>
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
            {myWorkGroups.map((group) => {
              const groupActive = activeNavigation?.group === group.label;
              return (
              <details className={groupActive ? 'nav-disclosure is-active' : 'nav-disclosure'} key={group.label} name="code-my-work-navigation" open={groupActive}>
                <summary><group.icon /><span>{group.label}</span>{group.badge && <b className="nav-badge urgent">{group.badge}</b>}<ChevronDown className="nav-chevron" /></summary>
                <div className="nav-submenu">{group.children?.map((child) => {
                  const unavailable = child.href.startsWith('/#');
                  const current = groupActive && activeNavigation?.child === child.label;
                  const classes = [current ? 'is-current' : '', unavailable ? 'is-unavailable' : ''].filter(Boolean).join(' ');
                  return <Link className={classes} href={child.href} title={unavailable ? '화면 준비 중' : undefined} key={child.label}>{child.label}</Link>;
                })}</div>
              </details>
            )})}
          </div>
          <div className="nav-section-label nav-section-spaced">Platform</div>
          <div className="nav-accordion">
            {platformGroups.map((group) => {
              const groupActive = activeNavigation
                ? group.label === activeNavigation.group
                : demoStage
                ? group.label === demoNavigation[demoStage].group
                : (group.label === '자산관리' && (screen === 'catalog' || screen === 'detail')) || (group.label === '실행관리' && (screen === 'pipeline' || screen === 'run'));
              if (group.href) return <Link className={groupActive ? 'nav-direct is-active' : 'nav-direct'} href={group.href} key={group.label}><group.icon /><span>{group.label}</span></Link>;
              return (
              <details className={groupActive ? 'nav-disclosure is-active' : 'nav-disclosure'} key={group.label} name="code-platform-navigation" open={groupActive}>
                <summary><group.icon /><span>{group.label}</span>{group.badge && <b className="nav-badge urgent">{group.badge}</b>}<ChevronDown className="nav-chevron" /></summary>
                <div className="nav-submenu">{group.children?.map((child) => {
                  const current = activeNavigation
                    ? group.label === activeNavigation.group && child.label === activeNavigation.child
                    : demoStage
                    ? group.label === demoNavigation[demoStage].group && child.label === demoNavigation[demoStage].child
                    : (child.label === '코드 자산' && (screen === 'catalog' || screen === 'detail')) || (child.label === '실험 대시보드' && (screen === 'pipeline' || screen === 'run'));
                  const unavailable = group.label !== '대시보드' && child.href.startsWith('/#');
                  const classes = [current ? 'is-current' : '', unavailable ? 'is-unavailable' : ''].filter(Boolean).join(' ');
                  return child.href.startsWith('/assets/code?pipeline') ? <a className={classes} href={child.href} title={unavailable ? '화면 준비 중' : undefined} key={child.label}>{child.label}</a> : <Link className={classes} href={child.href} title={unavailable ? '화면 준비 중' : undefined} key={child.label}>{child.label}</Link>;
                })}</div>
              </details>
            )})}
          </div>
        </nav>
      </SidebarContent>
      <SidebarFooter className="sidebar-footer">
        <a href="#support" className="help-link"><CircleHelp size={17} /><span>도움말 및 지원</span><ArrowUpRight size={14} /></a>
        <div className="sidebar-brand-footer">
          <div className="sidebar-brand-meta"><Image src="/eforest-wordmark.svg" alt="E-FOREST" width={58} height={7} style={{ width: '58px', height: 'auto' }} /><i /><span>PRIZM v2.8.4</span></div>
          <small className="sidebar-copyright"><span className="copyright-symbol">©</span><span>2026 HYUNDAI MOTOR COMPANY</span></small>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function CodeAssetsTopbar() {
  return (
    <header className="topbar">
      <div className="topbar-path">
        <SidebarTrigger aria-label="메뉴 열기 또는 닫기" />
      </div>
      <button className="command-search" type="button"><Search size={16} /><span>과제, 자산, 모델 검색</span><kbd>⌘ K</kbd></button>
      <div className="topbar-actions">
        <span className="system-health"><i /> 시스템 정상</span>
        <button type="button" className="icon-button" aria-label="알림"><Bell size={18} /><i /></button>
        <span className="topbar-divider" />
        <button className="profile" type="button"><span className="avatar">HS</span><span><strong>이학선 책임매니저</strong><small>제조AI기술개발팀</small></span><ChevronDown size={14} /></button>
      </div>
    </header>
  );
}

function TrustStatus({ status }: { status: CodeAsset['verified'] }) {
  return <span className={status === '운영 승인' || status === '재현 확인' ? 'detail-trust is-verified' : status === '사전 점검' ? 'detail-trust is-check' : 'detail-trust'}><i />{status}</span>;
}

function NotebookThumbnail({ asset }: { asset: Pick<CodeAsset, 'preview' | 'previewLabel' | 'previewMetric' | 'role' | 'previewImage'> }) {
  const seriesPoints = asset.preview === 'curve'
    ? '0,76 18,68 36,59 54,48 72,39 90,29 108,23 126,17 144,14 162,11 180,9'
    : '0,52 15,48 30,55 45,36 60,41 75,24 90,31 105,18 120,27 135,14 150,20 165,10 180,16';
  const bars = asset.preview === 'bars' ? [38, 54, 46, 68, 72, 61, 82, 76, 91] : [72, 45, 88, 62, 93, 57];
  const matrix = [0.92, 0.12, 0.05, 0.18, 0.84, 0.09, 0.04, 0.16, 0.96];
  const heatmap = [0.14, 0.22, 0.68, 0.35, 0.18, 0.82, 0.94, 0.47, 0.25, 0.31, 0.73, 0.19];
  const scatter = [[12, 62], [22, 46], [30, 70], [39, 34], [48, 54], [58, 28], [65, 64], [75, 42], [83, 22], [91, 51]];

  return (
    <figure className={`notebook-thumbnail preview-${asset.preview} ${asset.previewImage ? 'has-result-image' : ''}`}>
      <figcaption className="sr-only">{asset.previewLabel} {asset.previewMetric} Notebook 자동 미리보기</figcaption>
      <header><span>NOTEBOOK OUTPUT</span><b>AUTO</b></header>
      <div className="notebook-thumbnail-body">
        {asset.previewImage ? <div className="thumbnail-result-image"><Image src={asset.previewImage} alt="용접 비드 결함 검출 결과" fill sizes="(max-width: 1320px) 50vw, 33vw" /><span aria-hidden="true" /></div> : <><div className="thumbnail-code-lines" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="thumbnail-visual">
          {(asset.preview === 'curve' || asset.preview === 'series') && <svg viewBox="0 0 180 82" preserveAspectRatio="none"><path d="M0 72H180 M0 44H180 M0 16H180" /><polyline points={seriesPoints} /><circle cx="180" cy={asset.preview === 'curve' ? '9' : '16'} r="3" /></svg>}
          {asset.preview === 'matrix' && <div className="thumbnail-matrix">{matrix.map((value, index) => <i key={index} style={{ '--cell-opacity': value } as CSSProperties} />)}</div>}
          {asset.preview === 'scatter' && <svg viewBox="0 0 100 82" preserveAspectRatio="none"><path d="M0 70L100 18" />{scatter.map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={index % 3 === 0 ? 3 : 2} />)}</svg>}
          {asset.preview === 'bars' && <div className="thumbnail-bars">{bars.map((height, index) => <i key={index} style={{ '--bar-height': `${height}%` } as CSSProperties} />)}</div>}
          {asset.preview === 'heatmap' && <div className="thumbnail-heatmap">{heatmap.map((value, index) => <i key={index} style={{ '--cell-opacity': value } as CSSProperties} />)}</div>}
        </div></>}
      </div>
      <footer><span>{asset.previewLabel}</span><strong>{asset.previewMetric}</strong><em>{asset.role}</em></footer>
    </figure>
  );
}

function NotebookHtmlViewer({ version }: { version: string }) {
  return (
    <section className="notebook-html-shell">
      <header className="notebook-html-toolbar">
        <div><span>HTML 변환본</span><strong>weld-training-{version}.ipynb</strong><small>읽기 전용 · 출력 포함</small></div>
        <a href="/notebooks/weld-training-v2.4.1-reader.html" target="_blank" rel="noreferrer">새 창에서 보기 <ArrowUpRight size={13} /></a>
      </header>
      <iframe
        className="notebook-html-frame"
        src="/notebooks/weld-training-v2.4.1.html"
        title="차체 용접 비드 결함 검출 모델 학습 Notebook"
        sandbox=""
      />
    </section>
  );
}

function PackageView() {
  const packages = [
    ['torch', '==2.4.0', '2.4.0+cu124', 'PyPI', '호환'],
    ['torchvision', '==0.19.0', '0.19.0+cu124', 'PyPI', '호환'],
    ['ultralytics', '==8.3.14', '8.3.14', 'PyPI', '호환'],
    ['opencv-python-headless', '==4.10.0.84', '4.10.0.84', 'PyPI', '호환'],
    ['numpy', '>=1.26,<2.0', '1.26.4', 'PyPI', '확정'],
    ['pandas', '==2.2.2', '2.2.2', 'PyPI', '호환'],
    ['pyyaml', '==6.0.2', '6.0.2', 'PyPI', '호환'],
    ['mlflow', '==3.4.0', '3.4.0', '사내 저장소', '호환'],
    ['prizm-sdk', '==2.8.4', '2.8.4', '사내 저장소', '호환'],
  ];
  const requirements = `torch==2.4.0\ntorchvision==0.19.0\nultralytics==8.3.14\nopencv-python-headless==4.10.0.84\nnumpy>=1.26,<2.0\npandas==2.2.2\npyyaml==6.0.2\nmlflow==3.4.0\nprizm-sdk==2.8.4`;

  return (
    <section className="package-view">
      <header className="package-summary">
        <div><span>PYTHON</span><strong>3.11.9</strong><small>CPython · linux/amd64</small></div>
        <div><span>등록 패키지</span><strong>9</strong><small>직접 의존성</small></div>
        <div><span>확정 패키지</span><strong>187</strong><small>실행 시점 전체 목록</small></div>
        <div className="is-passed"><span>환경 호환성</span><strong><Check size={16} /> 통과</strong><small>pytorch-2.4-yolo12-py311-cu124</small></div>
      </header>
      <div className="package-main">
        <div className="package-list-panel">
          <header><div><span className="detail-section-label">RESOLVED PACKAGES</span><h3>설치 패키지</h3></div><small>RUN-26841에서 확정 · 2026.09.08</small></header>
          <table className="package-table"><thead><tr><th>패키지</th><th>요청 버전</th><th>설치 버전</th><th>출처</th><th>상태</th></tr></thead><tbody>{packages.map((item) => <tr key={item[0]}><td><strong>{item[0]}</strong></td><td><code>{item[1]}</code></td><td><code>{item[2]}</code></td><td>{item[3]}</td><td><span className="package-status"><Check size={11} />{item[4]}</span></td></tr>)}</tbody></table>
        </div>
        <aside className="requirements-panel">
          <header><div><span>원본 파일</span><strong>requirements.txt</strong></div><b>8 PACKAGES</b></header>
          <pre><code>{requirements}</code></pre>
          <div className="requirements-note"><ShieldCheck size={16} /><span><strong>재현 가능한 환경</strong><small>요청 범위와 실제 설치 버전을 함께 보존합니다.</small></span></div>
        </aside>
      </div>
    </section>
  );
}

function VersionHistory() {
  const rows = [
    ['v2.4.1', '재현 확인', '클래스 가중치 조정 및 검증 데이터 v5 반영', '김민준', '2026.09.08'],
    ['v2.4.0', '재현 확인', '입력 해상도 1024px 상향, Augmentation 개선', '김민준', '2026.08.29'],
    ['v2.3.2', '운영 승인', '울산 차체 2라인 운영 기준 버전', '박서연', '2026.08.12'],
    ['v2.3.1', '사전 점검', '라벨 매핑 오류 수정', '김민준', '2026.08.09'],
  ];
  return <div className="detail-table-wrap"><table className="detail-table"><thead><tr><th>버전</th><th>검증</th><th>변경 내용</th><th>등록자</th><th>등록일</th><th aria-label="버전 메뉴" /></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td><TrustStatus status={row[1] as CodeAsset['verified']} /></td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td><td><button type="button" aria-label={`${row[0]} 버전 메뉴`}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div>;
}

function RunHistory({ onOpenRun }: { onOpenRun: () => void }) {
  const rows = [
    ['RUN-26841', '성공', 'v2.4.1', 'Weld Image 2026 Q3 · v12', 'pytorch-2.4-yolo12-py311-cu124', 'ml.a100.20gb', '김민준', '1h 42m'],
    ['RUN-26798', '성공', 'v2.4.1', 'Weld Image 2026 Q3 · v12', 'pytorch-2.4-yolo12-py311-cu124', 'ml.a100.20gb', '정다은', '1h 45m'],
    ['RUN-26422', '중단', 'v2.4.0', 'Weld Image 2026 Q3 · v11', 'pytorch-2.4-vision-py312-cu124', 'ml.a100.10gb', '김민준', '38m'],
    ['RUN-26190', '성공', 'v2.3.2', 'Weld Image 2026 Q2 · v8', 'Ubuntu 20.04 · PyTorch', 'ml.a100.20gb', '박서연', '1h 51m'],
  ];
  return <div className="detail-table-wrap"><table className="detail-table run-history-table"><thead><tr><th>실행 ID</th><th>상태</th><th>코드</th><th>입력 데이터</th><th>실행 환경</th><th>실행 자원</th><th>실행자</th><th>소요시간</th><th aria-label="실행 상세" /></tr></thead><tbody>{rows.map((row, index) => <tr key={row[0]}><td><button type="button" className="run-link" onClick={index === 0 ? onOpenRun : undefined}>{row[0]}</button></td><td><span className={`run-state state-${row[1]}`}><i />{row[1]}</span></td>{row.slice(2).map((cell) => <td key={cell}>{cell}</td>)}<td><ArrowUpRight size={14} /></td></tr>)}</tbody></table></div>;
}

function LineageView() {
  const nodes = [
    { type: 'DATA', title: '용접 비드 결함 데이터셋', meta: 'v13 · 43,180 images', icon: Database },
    { type: 'CODE', title: '용접 비드 결함 검출 학습', meta: 'v2.4.1', icon: FileCode2 },
    { type: 'RUN', title: 'RUN-26841', meta: 'pytorch-2.4-yolo12-py311-cu124', icon: Play },
    { type: 'EVALUATION', title: 'Weld Detection Gate', meta: '7 / 7 PASS', icon: ShieldCheck },
    { type: 'MODEL', title: 'WeldNet', meta: 'v2.4.1 · Candidate', icon: Box },
    { type: 'DEPLOYMENT', title: '울산 차체 2라인', meta: '운영 v2.3.2', icon: Rocket },
  ];
  return <div className="lineage-panel"><header><div><span>ACTIVE LINEAGE</span><h3>코드에서 현장 운영까지</h3></div><button type="button"><Share2 size={14} /> 전체 화면</button></header><div className="lineage-track">{nodes.map((node, index) => <div className="lineage-step" key={node.type}><div className="lineage-node"><node.icon size={18} /><span>{node.type}</span><strong>{node.title}</strong><small>{node.meta}</small></div>{index < nodes.length - 1 && <i className="lineage-connector"><ArrowRight size={14} /></i>}</div>)}</div><div className="related-notebooks"><span>연관 자산</span><a href="/assets/data?asset=PRJ000212-D-0001">데이터 · 용접 비드 결함 데이터셋 v13 <ArrowRight size={13} /></a><a href="/evaluation/models">평가 · 용접 비드 결함 모델 평가 <ArrowRight size={13} /></a><a href="/assets/models">모델 · Weld Detector v2.5.0 <ArrowRight size={13} /></a></div></div>;
}

function AccessView({ requested, onRequest }: { requested: boolean; onRequest: () => void }) {
  return <div className="access-panel"><section><span className="detail-section-label">공개 범위</span><h3>제조솔루션본부 내 검색·열람 가능</h3><p>Notebook에 연결된 원천 이미지는 울산 차체 품질 조직의 별도 권한을 적용합니다.</p><div className="access-scope"><div className="is-active"><Eye size={16} /><strong>검색·열람</strong><span>본부 구성원</span></div><div className="is-active"><Play size={16} /><strong>실행</strong><span>과제 실행자</span></div><div><GitBranch size={16} /><strong>새 버전</strong><span>코드 기여자</span></div><div><KeyRound size={16} /><strong>접근 관리</strong><span>자산 책임자</span></div></div></section><section><span className="detail-section-label">담당 그룹</span><div className="access-group"><Users size={20} /><div><strong>용접 품질 고도화 · 코드 기여자</strong><span>12명 · 실행 8명 · 검증 2명</span></div><button type="button" onClick={onRequest}>{requested ? '요청 접수됨' : '권한 요청'}</button></div></section></div>;
}

function ExecutionSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="execution-native-select">
      <span>{label}</span>
      <span className="execution-native-select-control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
}

function WorkspaceTabs({ screen, asset, runId, openTabs, onNavigate, onClose, onCloseAll }: { screen: WorkspaceScreen; asset: CodeAsset; runId: string; openTabs: WorkspaceTask[]; onNavigate: (screen: WorkspaceScreen) => void; onClose: (screen: WorkspaceTask) => void; onCloseAll: () => void }) {
  const definitions: Record<WorkspaceTask, { label: string; icon: LucideIcon }> = {
    data: { label: '용접 비드 결함 데이터셋', icon: Database },
    detail: { label: asset.title, icon: FileCode2 },
    run: { label: runId, icon: Activity },
  };
  if (!openTabs.length) return null;
  return (
    <nav className="workspace-tabs" aria-label="열린 작업">
      <div className="workspace-tab-track">{openTabs.map((id) => {
          const tab = definitions[id];
          return <span className={screen === id ? 'workspace-tab-item is-active' : 'workspace-tab-item'} key={id}><button type="button" onClick={() => id === 'data' ? window.location.href = '/assets/data?asset=PRJ000212-D-0001' : onNavigate(id)}><tab.icon size={14} /><span>{tab.label}</span></button><button type="button" className="workspace-tab-close" aria-label={`${tab.label} 탭 닫기`} onClick={() => onClose(id)}><X size={12} /></button></span>;
        })}</div>
      {openTabs.length > 1 && <button type="button" className="workspace-close-all" onClick={onCloseAll}><X size={13} /> 모두 닫기</button>}
    </nav>
  );
}

function PipelineWorkspace({ runs, schedules, view, project, onProjectChange, onExecute, onViewChange, onOpenRun }: { runs: RunRecord[]; schedules: ScheduleRecord[]; view: 'runs' | 'schedules'; project: string; onProjectChange: (project: string) => void; onExecute: () => void; onViewChange: (value: 'runs' | 'schedules') => void; onOpenRun: (id: string) => void }) {
  const projectRuns = runs.filter((run) => run.project === project);
  const projectSchedules = schedules.filter((schedule) => schedule.project === project);
  return (
    <PortalPageFrame className="pipeline-workspace-page">
      <PortalPageHeader className="pipeline-workspace-heading" kicker="EXPERIMENT WORKSPACE" title="실험 대시보드" description="과제를 선택해 학습 코드와 실행 이력, 예약 상태를 한곳에서 관리합니다." />
      <section className="experiment-command-surface" aria-label="실험 실행 도구">
        <ExecutionSelect label="과제 선택" value={project} onChange={onProjectChange}><option value="용접 품질 고도화">PRJ000212 · 용접 품질 고도화</option><option value="Surface Zero Defect">PRJ000274 · Surface Zero Defect</option><option value="Cell Quality Intelligence">PRJ000341 · Cell Quality Intelligence</option></ExecutionSelect>
        <div className="experiment-heading-actions"><div className="pipeline-summary"><span><i className="is-running" /><strong>{projectRuns.filter((run) => run.status !== '완료' && run.status !== '실패').length}</strong> 실행 중</span><span><i /><strong>{projectSchedules.filter((schedule) => schedule.active).length}</strong> 활성 스케줄</span></div><button type="button" className="experiment-run-button" onClick={onExecute}><Play size={15} fill="currentColor" /> 파이프라인 실행</button></div>
      </section>
      <Tabs value={view} onValueChange={(value) => onViewChange(value as 'runs' | 'schedules')} className="pipeline-workspace-tabs">
        <TabsList variant="line" className="pipeline-workspace-tablist"><TabsTrigger value="runs">실행 내역 <b>{projectRuns.length}</b></TabsTrigger><TabsTrigger value="schedules">예약·스케줄 <b>{projectSchedules.length}</b></TabsTrigger></TabsList>
        <TabsContent value="runs" className="pipeline-workspace-content">
          {projectRuns.length ? <div className="pipeline-table-wrap"><table className="pipeline-table"><thead><tr><th>상태</th><th>과제 / 코드</th><th>버전</th><th>실행 방식</th><th>요청자</th><th>요청 시각</th><th>진행률</th><th /></tr></thead><tbody>{projectRuns.map((run) => <tr key={run.id}><td><span className={`pipeline-status state-${run.status.replace(' ', '-')}`}><i />{run.status}</span></td><td><span className="pipeline-project-name">{run.project}</span><strong>{run.title}</strong><small>{run.id}</small></td><td>{run.version}</td><td>{run.mode}</td><td>이학선</td><td>{run.requestedAt}</td><td><div className="pipeline-mini-progress"><i><b style={{ width: `${run.progress}%` }} /></i><span>{run.progress}%</span></div></td><td><button type="button" onClick={() => onOpenRun(run.id)}>상세 <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div> : <div className="pipeline-empty"><Workflow size={26} /><h2>이 과제의 실행 이력이 없습니다</h2><p>우측 상단의 파이프라인 실행 버튼에서 코드를 선택해 첫 실험을 시작하세요.</p></div>}
        </TabsContent>
        <TabsContent value="schedules" className="pipeline-workspace-content">
          {projectSchedules.length ? <div className="schedule-list">{projectSchedules.map((schedule) => <article key={schedule.id}><div className="schedule-calendar"><CalendarClock size={19} /><span>{schedule.active ? 'ACTIVE' : 'PAUSED'}</span></div><div><span className="pipeline-project-name">{schedule.project}</span><h3>{schedule.title}</h3><p>{schedule.version} · {schedule.pattern}</p></div><div><span>다음 실행</span><strong>{schedule.nextRun}</strong></div><button type="button">관리 <ChevronDown size={13} /></button></article>)}</div> : <div className="pipeline-empty"><CalendarClock size={26} /><h2>등록된 스케줄이 없습니다</h2><p>파이프라인 실행에서 실행 조건을 설정한 뒤 예약할 수 있습니다.</p></div>}
        </TabsContent>
      </Tabs>
    </PortalPageFrame>
  );
}

const demoStagePaths: Record<DemoStage, string> = {
  data: '/assets/data',
  train: '/assets/code/demo',
  run: '/execution/pipelines/demo',
  evaluate: '/evaluation/models',
  model: '/assets/models',
  monitor: '/monitoring/models',
};

export function CodeAssetsWorkspace({ demoStage }: { demoStage?: DemoStage }) {
  const [assets, setAssets] = useState(initialAssets);
  const [currentDemoStage, setCurrentDemoStage] = useState<DemoStage | undefined>(demoStage);
  const visionDemoOpen = Boolean(currentDemoStage);
  const [screen, setScreen] = useState<WorkspaceScreen>('catalog');
  const [openWorkspaceTabs, setOpenWorkspaceTabs] = useState<WorkspaceTask[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0].id);
  const [selectedVersion, setSelectedVersion] = useState(initialAssets[0].version);
  const [detailTab, setDetailTab] = useState('notebook');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('전체 코드');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [plantFilter, setPlantFilter] = useState<string | null>(null);
  const [dataFilter, setDataFilter] = useState<string | null>(null);
  const [executableOnly, setExecutableOnly] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [view, setView] = useState<'list' | 'grid'>('grid');
  const [sortMode, setSortMode] = useState<'관련도순' | '최근 수정순' | '재사용순'>('관련도순');
  const [executionOpen, setExecutionOpen] = useState(false);
  const [preflightPassed, setPreflightPassed] = useState(false);
  const [preflightRunning, setPreflightRunning] = useState(false);
  const [executionResource, setExecutionResource] = useState('a100-20');
  const [executionRuntime, setExecutionRuntime] = useState('yolo12-14');
  const [runParameterInputs, setRunParameterInputs] = useState<Record<RunParameterName, string>>({ epochs: '3', batch_size: '4', image_size: '320', seed: '42' });
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState('RUN-26841');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pipelineView, setPipelineView] = useState<'runs' | 'schedules'>('runs');
  const [pipelineProject, setPipelineProject] = useState('용접 품질 고도화');
  const [pipelineCodePickerOpen, setPipelineCodePickerOpen] = useState(false);
  const [pipelineCodeAssetId, setPipelineCodeAssetId] = useState(initialAssets[0].id);
  const [scheduleMode, setScheduleMode] = useState<'once' | 'repeat'>('once');
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleDays, setScheduleDays] = useState(['월', '목']);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
  const [scheduleDate, setScheduleDate] = useState('2026-09-14');
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [forkOpen, setForkOpen] = useState(false);
  const [forkProject, setForkProject] = useState('PRJ000318');
  const [forkDataId, setForkDataId] = useState('PRJ000318-D-0001');
  const [forkTitle, setForkTitle] = useState('조지아 용접 비드 결함 검출 학습');
  const [runRecords, setRunRecords] = useState<RunRecord[]>([
    { id: 'RUN-26841', assetId: initialAssets[0].id, project: initialAssets[0].project, title: initialAssets[0].title, version: 'v2.4.1', data: 'Weld Image 2026 Q3 · v12', environment: 'pytorch-2.4-yolo12-py311-cu124', resource: 'ml.a100.20gb', status: '완료', mode: '즉시 실행', requestedAt: '09.08 09:42', progress: 100, source: 'mock' },
    { id: 'RUN-26798', assetId: initialAssets[0].id, project: initialAssets[0].project, title: initialAssets[0].title, version: 'v2.4.1', data: 'Weld Image 2026 Q3 · v12', environment: 'pytorch-2.4-yolo12-py311-cu124', resource: 'ml.a100.20gb', status: '완료', mode: '예약 실행', requestedAt: '09.06 02:00', progress: 100, source: 'mock' },
  ]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);
  const [registerFile, setRegisterFile] = useState('surface-defect-inference.ipynb');
  const [requirementsFile, setRequirementsFile] = useState('requirements.txt');
  const [accessRequested, setAccessRequested] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sdkOpen, setSdkOpen] = useState(false);
  const [downloadCount, setDownloadCount] = useState(286);
  const [citationCount, setCitationCount] = useState(47);
  const [userRating, setUserRating] = useState(0);
  const runNotebookFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const assetId = params.get('asset');
      const dataId = params.get('data');
      const runId = params.get('run');
      const pipeline = params.get('pipeline');
      if (demoStage) return;
      if (pipeline) {
        if (params.get('project') === 'PRJ000212') setPipelineProject('용접 품질 고도화');
        setPipelineView(params.get('view') === 'schedules' ? 'schedules' : 'runs');
        setScreen('pipeline');
        return;
      }
      if (runId) {
        setActiveRunId(runId);
        setScreen('run');
        setOpenWorkspaceTabs((current) => current.includes('run') ? current : [...current, 'run']);
        return;
      }
      if (assetId && initialAssets.some((asset) => asset.id === assetId)) {
        const asset = initialAssets.find((item) => item.id === assetId);
        setSelectedAssetId(assetId);
        if (asset) setSelectedVersion(params.get('version') ?? asset.version);
        if (['notebook', 'packages', 'versions', 'runs', 'lineage', 'access'].includes(params.get('tab') ?? '')) setDetailTab(params.get('tab')!);
        setScreen('detail');
        setOpenWorkspaceTabs((current) => {
          const next = dataId && !current.includes('data') ? [...current, 'data' as const] : current;
          return next.includes('detail') ? next : [...next, 'detail'];
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoStage]);

  // 시연용 mock run만 진행을 시뮬레이션한다. live run은 백엔드 값을 그대로 쓴다.
  const hasActiveMockRuns = runRecords.some((run) => run.source === 'mock' && run.status !== '완료');
  const hasActiveLiveRuns = runRecords.some((run) => run.live !== undefined && !isFinishedRun(run.live));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listRuns()
        .then((runs) => {
          if (cancelled) return;
          setRunRecords((current) => [...runs.map((run) => toRunRecord(run, initialAssets)), ...current.filter((record) => record.source === 'mock')]);
        })
        .catch(() => undefined); // 실행 서버가 꺼져 있으면 mock 목록만 보여준다
    };
    load();
    const timer = hasActiveLiveRuns ? window.setInterval(load, 5000) : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [hasActiveLiveRuns]);

  useEffect(() => {
    if (!hasActiveMockRuns) return;
    const timer = window.setInterval(() => {
      setRunRecords((current) => current.map((run) => {
        if (run.source !== 'mock' || run.status === '완료') return run;
        const nextProgress = Math.min(100, run.progress + 7);
        return { ...run, progress: nextProgress, status: nextProgress >= 100 ? '완료' : nextProgress >= 24 ? '실행 중' : nextProgress >= 10 ? '자원 준비' : '요청 접수' };
      }));
    }, 2400);
    return () => window.clearInterval(timer);
  }, [hasActiveMockRuns]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0];
  const activeRun = runRecords.find((run) => run.id === activeRunId) ?? runRecords[0];

  const focusRunNotebookOutput = () => {
    const frame = runNotebookFrameRef.current;
    const output = frame?.contentDocument?.getElementById('test-output');
    const targetTop = output && frame?.contentWindow
      ? output.getBoundingClientRect().top + frame.contentWindow.scrollY
      : 0;
    frame?.contentWindow?.scrollTo({ top: Math.max(0, targetTop - 20), behavior: 'auto' });
  };

  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = assets.filter((asset) => {
      const searchable = [asset.title, asset.description, asset.id, asset.plant, asset.process, asset.project, asset.framework, asset.owner, asset.dataType].join(' ').toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (scope === '즐겨찾기' && !asset.favorite) return false;
      if (scope === '검증된 코드' && !['재현 확인', '운영 승인'].includes(asset.verified)) return false;
      if (scope === '내 코드' && !['제조AI기술개발팀', '품질AI팀'].includes(asset.owner)) return false;
      if (scope === '공유받음' && ['제조AI기술개발팀', '품질AI팀'].includes(asset.owner)) return false;
      if (roleFilter && asset.role !== roleFilter) return false;
      if (plantFilter && asset.plant !== plantFilter) return false;
      if (dataFilter && asset.dataType !== dataFilter) return false;
      if (executableOnly && !asset.executable) return false;
      return true;
    });
    if (sortMode === '재사용순') return [...result].sort((a, b) => b.reuse - a.reuse);
    if (sortMode === '최근 수정순') return [...result].sort((a, b) => Number.parseInt(a.updated) - Number.parseInt(b.updated));
    return result;
  }, [assets, dataFilter, executableOnly, plantFilter, query, roleFilter, scope, sortMode]);

  const toggleFavorite = (id: string) => {
    setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, favorite: !asset.favorite } : asset));
  };

  const clearFilters = () => {
    setQuery(''); setRoleFilter(null); setPlantFilter(null); setDataFilter(null); setExecutableOnly(false); setScope('전체 코드');
  };

  const copyAssetUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCitationCount((count) => count + 1);
      setNotice('코드 자산 URL을 클립보드에 복사했습니다.');
    } catch {
      setNotice('URL을 복사하지 못했습니다. 브라우저 주소를 직접 복사해 주세요.');
    }
  };

  const downloadAsset = () => {
    setDownloadCount((count) => count + 1);
    setNotice(`${selectedAsset.title} ${selectedVersion} 다운로드를 준비합니다.`);
  };

  const openAsset = (id: string) => {
    const asset = assets.find((item) => item.id === id);
    setSelectedAssetId(id);
    if (asset) setSelectedVersion(asset.version);
    setScreen('detail');
    setDetailTab('notebook');
    setOpenWorkspaceTabs((current) => current.includes('detail') ? current : [...current, 'detail']);
    setPreflightPassed(false);
    window.history.replaceState(null, '', `/assets/code?asset=${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateCodeDetailUrl = (nextTab: string, nextVersion = selectedVersion) => {
    setDetailTab(nextTab);
    const params = new URLSearchParams(window.location.search);
    params.set('asset', selectedAssetId);
    params.set('tab', nextTab);
    params.set('version', nextVersion);
    window.history.replaceState(null, '', `/assets/code?${params.toString()}`);
  };

  const navigateWorkspace = (nextScreen: WorkspaceScreen, runId = activeRunId) => {
    setScreen(nextScreen);
    if (nextScreen === 'detail' || nextScreen === 'run') setOpenWorkspaceTabs((current) => current.includes(nextScreen) ? current : [...current, nextScreen]);
    if (nextScreen === 'catalog') window.history.replaceState(null, '', '/assets/code');
    if (nextScreen === 'detail') window.history.replaceState(null, '', `/assets/code?asset=${selectedAssetId}`);
    if (nextScreen === 'pipeline') window.history.replaceState(null, '', '/assets/code?pipeline=1');
    if (nextScreen === 'run') window.history.replaceState(null, '', `/assets/code?run=${runId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeWorkspaceTab = (tab: WorkspaceTask) => {
    setOpenWorkspaceTabs((current) => current.filter((item) => item !== tab));
    if (tab !== 'data' && screen === tab) navigateWorkspace(tab === 'run' ? 'pipeline' : 'catalog');
  };

  const closeAllWorkspaceTabs = () => {
    setOpenWorkspaceTabs([]);
    if (screen === 'run') navigateWorkspace('pipeline');
    if (screen === 'detail') navigateWorkspace('catalog');
  };

  const openCatalog = () => {
    setScreen('catalog');
    window.history.replaceState(null, '', '/assets/code');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cycleSort = () => {
    setSortMode((current) => current === '관련도순' ? '최근 수정순' : current === '최근 수정순' ? '재사용순' : '관련도순');
  };

  const runPreflight = () => {
    setPreflightRunning(true);
    window.setTimeout(() => {
      setPreflightRunning(false);
      setPreflightPassed(true);
    }, 650);
  };

  const beginRun = async () => {
    setRunSubmitting(true);
    setRunError(null);
    try {
      const run = await createRun({
        assetId: selectedAsset.id,
        version: selectedVersion,
        // 빈 값·소수는 NaN/정수가 아닌 값으로 전송되어 백엔드가 400 메시지를 돌려준다
        parameters: {
          epochs: Number(runParameterInputs.epochs),
          batch_size: Number(runParameterInputs.batch_size),
          image_size: Number(runParameterInputs.image_size),
          seed: Number(runParameterInputs.seed),
        },
        environment: executionRuntime === 'yolo12-14' ? 'pytorch-2.4-yolo12-py311-cu124' : 'pytorch-2.4-vision-py312-cu124',
        resource: executionResource === 'a100-10' ? 'ml.a100.10gb' : executionResource === 'a100-20' ? 'ml.a100.20gb' : 'ml.a100.48gb',
      });
      setRunRecords((current) => [toRunRecord(run, assets), ...current.filter((record) => record.id !== run.id)]);
      setActiveRunId(run.id);
      setPipelineView('runs');
      setExecutionOpen(false);
      setNotice('코드 실행이 요청되었습니다. Airflow에서 실행 준비를 시작합니다.');
      navigateWorkspace('run', run.id);
    } catch (error) {
      setRunError(error instanceof PrizmApiError ? error.message : '실행 요청 중 알 수 없는 오류가 발생했습니다');
    } finally {
      setRunSubmitting(false);
    }
  };

  const launchWithPreflight = () => {
    if (preflightPassed) {
      void beginRun();
      return;
    }
    setPreflightRunning(true);
    window.setTimeout(() => {
      setPreflightRunning(false);
      setPreflightPassed(true);
      void beginRun();
    }, 700);
  };

  const openScheduling = () => {
    setExecutionOpen(false);
    window.setTimeout(() => setScheduleOpen(true), 120);
  };

  const openPipelineCodePicker = () => {
    const projectAsset = assets.find((asset) => asset.project === pipelineProject && asset.executable);
    if (projectAsset) setPipelineCodeAssetId(projectAsset.id);
    setPipelineCodePickerOpen(true);
  };

  const continuePipelineExecution = () => {
    const asset = assets.find((item) => item.id === pipelineCodeAssetId) ?? assets[0];
    setSelectedAssetId(asset.id);
    setSelectedVersion(asset.version);
    setPreflightPassed(false);
    setPipelineCodePickerOpen(false);
    window.setTimeout(() => setExecutionOpen(true), 120);
  };

  const saveSchedule = () => {
    const pattern = scheduleMode === 'once' ? `${scheduleDate} ${scheduleTime} 한 번 실행` : `${scheduleFrequency === 'daily' ? '매일' : scheduleFrequency === 'weekly' ? `매주 ${scheduleDays.join('·')}요일` : `매월 ${scheduleDayOfMonth}일`} ${scheduleTime}`;
    const nextRun = scheduleMode === 'once' ? `${scheduleDate.replaceAll('-', '.')} ${scheduleTime}` : `2026.09.14 ${scheduleTime}`;
    setSchedules((current) => [{ id: `SCH-${104 + current.length}`, project: selectedAsset.project, title: selectedAsset.title, version: selectedVersion, pattern, nextRun, active: true }, ...current]);
    setPipelineView('schedules');
    setScheduleOpen(false);
    setNotice('실행 스케줄이 등록되었습니다.');
  };

  const createDerivedAsset = () => {
    const target = forkProject === 'PRJ000318'
      ? { project: '조지아 용접 품질 고도화', plant: 'HMGMA' }
      : forkProject === 'PRJ000274'
        ? { project: '아산 용접 품질 고도화', plant: '아산' }
        : { project: '체코 용접 품질 고도화', plant: 'HMMC' };
    const newId = forkProject + '-C-0001';
    const derivedAsset: CodeAsset = {
      ...selectedAsset,
      id: newId,
      title: forkTitle,
      project: target.project,
      plant: target.plant,
      version: '260912-0001',
      updated: '방금',
      verified: '사전 점검',
      reuse: 0,
      favorite: false,
    };
    setAssets((current) => current.some((asset) => asset.id === newId) ? current : [derivedAsset, ...current]);
    setForkOpen(false);
    setSelectedAssetId(newId);
    setSelectedVersion(derivedAsset.version);
    setOpenWorkspaceTabs((current) => current.includes('detail') ? current : [...current, 'detail']);
    setScreen('detail');
    window.history.replaceState(null, '', '/assets/code?asset=' + newId + '&data=' + forkDataId);
    setNotice('파생 코드 자산을 만들었습니다. 원본 코드와 lineage가 자동 연결되었습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const completeRegistration = () => {
    const title = registerFile.replace(/\.ipynb$/i, '').replaceAll('-', ' ');
    const newAsset: CodeAsset = {
      id: 'CODE-ASN-PAINT-019',
      title: title || '도장 표면 결함 추론',
      description: '새로 등록한 Notebook입니다. 실행 정보와 검증 조건을 확인해 주세요.',
      role: '추론', plant: '아산', process: '도장 · 검사', project: 'Surface Zero Defect',
      dataType: 'Image', framework: 'PyTorch', owner: '제조AI기술개발팀', version: 'v0.1.0', updated: '방금',
      verified: '미검증', reuse: 0, executable: false,
      preview: 'matrix', previewMetric: '미실행', previewLabel: '추론 결과',
    };
    setAssets((current) => [newAsset, ...current]);
    setRegisterOpen(false);
    setRegisterStep(1);
    setScope('전체 코드');
    setNotice('Notebook이 작업본으로 등록되었습니다.');
  };

  const currentMenuTab: PortalTabId = currentDemoStage === 'model'
    ? 'model-assets'
    : currentDemoStage === 'evaluate'
      ? 'model-evaluation'
      : currentDemoStage === 'monitor'
        ? 'model-monitoring'
        : currentDemoStage === 'run' || screen === 'pipeline' || screen === 'run'
          ? 'pipeline-runs'
          : currentDemoStage === 'data'
            ? 'data-assets'
            : 'code-assets';

  return (
    <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
      <PortalNavigation screen={screen} demoStage={currentDemoStage} />
      <PortalWorkspaceSurface>
        <CodeAssetsTopbar />
        <PortalWorkspaceTabs current={currentMenuTab} />
        {!visionDemoOpen && (screen === 'catalog' || screen === 'detail') && <PortalPrismAtmosphere />}

        {currentDemoStage && <VisionMlopsDemo initialStage={currentDemoStage} onStageChange={(stage) => { setCurrentDemoStage(stage); window.history.replaceState(null, '', demoStagePaths[stage]); }} onExit={() => { window.location.href = '/assets/code'; }} />}

        {!visionDemoOpen && screen === 'catalog' && <PortalPageFrame className="code-assets-page">
          <PortalPageHeader className="code-page-heading" kicker="ASSET MANAGEMENT / NOTEBOOK HUB" title="코드 자산" description="전 세계 제조 현장의 Notebook을 찾고, 검증된 조건으로 다시 실행합니다." action={<PortalButton variant="primary" onClick={() => setRegisterOpen(true)}><Plus size={16} /> 코드 등록</PortalButton>} />

          <PortalFilterSurface className="code-search-panel" aria-label="코드 자산 검색">
            <label className="code-search-box">
              <Search size={20} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="코드명, 설명, 과제, 공장, 공정으로 검색" />
              {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={15} /></button>}
              <kbd>⌘ K</kbd>
            </label>

            <div className="code-scope-row" aria-label="코드 범위">
              {['전체 코드', '내 코드', '공유받음', '검증된 코드', '즐겨찾기'].map((item) => (
                <button type="button" className={scope === item ? 'is-active' : ''} onClick={() => setScope(item)} key={item}>{item}</button>
              ))}
            </div>

            <div className="code-filter-row">
              <div className="code-filter-chips">
                <button type="button" className={roleFilter === '학습' ? 'is-active' : ''} onClick={() => setRoleFilter(roleFilter === '학습' ? null : '학습')}>용도 {roleFilter && `· ${roleFilter}`} <ChevronDown size={13} /></button>
                <button type="button" className={plantFilter === '울산' ? 'is-active' : ''} onClick={() => setPlantFilter(plantFilter === '울산' ? null : '울산')}>공장·공정 {plantFilter && `· ${plantFilter}`} <ChevronDown size={13} /></button>
                <button type="button" className={dataFilter ? 'is-active' : ''} onClick={() => setDataFilter(dataFilter === 'Image' ? null : 'Image')}>데이터 유형 {dataFilter && `· ${dataFilter}`} <ChevronDown size={13} /></button>
                <button type="button" className={moreFilters ? 'is-active' : ''} onClick={() => setMoreFilters((open) => !open)}><SlidersHorizontal size={13} /> 필터 더 보기</button>
              </div>
              <label className="code-executable-toggle"><input type="checkbox" checked={executableOnly} onChange={(event) => setExecutableOnly(event.target.checked)} /><span />내가 실행 가능한 코드만</label>
            </div>

            {moreFilters && (
              <div className="code-expanded-filters">
                <div><span>코드 용도</span>{['학습', '평가', '추론', '전처리', '분석'].map((role) => <button type="button" className={roleFilter === role ? 'is-active' : ''} onClick={() => setRoleFilter(roleFilter === role ? null : role)} key={role}>{role}</button>)}</div>
                <div><span>생산 거점</span>{['울산', '아산', '전주', '남양', 'HMA', 'HMMA'].map((plant) => <button type="button" className={plantFilter === plant ? 'is-active' : ''} onClick={() => setPlantFilter(plantFilter === plant ? null : plant)} key={plant}>{plant}</button>)}</div>
                <div><span>데이터 유형</span>{['Image', 'Tabular', 'Time Series', 'Point Cloud'].map((data) => <button type="button" className={dataFilter === data ? 'is-active' : ''} onClick={() => setDataFilter(dataFilter === data ? null : data)} key={data}>{data}</button>)}</div>
              </div>
            )}
          </PortalFilterSurface>

          <section className="code-results-section">
            <header className="code-results-toolbar">
              <div><strong>검색 결과 {filteredAssets.length}개</strong><span>업데이트와 실행 이력을 반영한 결과입니다.</span></div>
              <div><button type="button" className="code-sort" onClick={cycleSort}>{sortMode} <ChevronDown size={13} /></button><span className="code-view-switch"><button type="button" className={view === 'list' ? 'is-active' : ''} aria-label="목록 보기" onClick={() => setView('list')}><List size={16} /></button><button type="button" className={view === 'grid' ? 'is-active' : ''} aria-label="카드 보기" onClick={() => setView('grid')}><Grid2X2 size={15} /></button></span></div>
            </header>

            {filteredAssets.length ? (
              <div className={view === 'grid' ? 'code-asset-list is-grid' : 'code-asset-list'}>
                {filteredAssets.map((asset) => (
                  <article className="code-asset-row" key={asset.id}>
                    <button className="code-asset-main" type="button" onClick={() => openAsset(asset.id)}>
                      <NotebookThumbnail asset={asset} />
                      <div className="code-asset-copy">
                        <span className="code-asset-project">{asset.project}</span>
                        <div className="code-asset-title"><span className={`code-role role-${asset.role}`}>{asset.role}</span><h2>{asset.title}</h2>{asset.restricted && <LockKeyhole size={14} aria-label="본문 접근 제한" />}</div>
                        <p>{asset.description}</p>
                        <div className="code-asset-context"><span>{asset.plant} / {asset.process}</span><i /> <span>{asset.owner}</span></div>
                      </div>
                    </button>
                    <div className="code-asset-technical"><span>{asset.dataType}</span><span>{asset.framework}</span><small>{asset.id}</small></div>
                    <div className="code-asset-owner"><strong>{asset.owner}</strong><span>{asset.version} · {asset.updated}</span></div>
                    <div className="code-asset-trust"><strong className={asset.verified === '운영 승인' || asset.verified === '재현 확인' ? 'is-verified' : asset.verified === '사전 점검' ? 'is-check' : ''}>{asset.verified}</strong><span>{asset.reuse ? `${asset.reuse}개 공장 활용` : '활용 이력 없음'}</span></div>
                    <button type="button" className={asset.favorite ? 'code-favorite is-active' : 'code-favorite'} onClick={() => toggleFavorite(asset.id)} aria-label={asset.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}><Bookmark size={17} fill={asset.favorite ? 'currentColor' : 'none'} /></button>
                    <ArrowRight className="code-row-arrow" size={16} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="code-empty-state"><Search size={28} /><h2>조건에 맞는 코드가 없습니다</h2><p>검색어나 필터 조건을 바꿔보세요.</p><button type="button" onClick={clearFilters}>전체 조건 초기화</button></div>
            )}
          </section>
        </PortalPageFrame>}

        {!visionDemoOpen && screen === 'detail' && <PortalDetailFrame className="code-detail-page">
          <button className="detail-back" type="button" onClick={openCatalog}><ArrowLeft size={15} /> 코드 자산</button>
          <header className="code-detail-header">
            <div className="code-detail-title">
              <span className="detail-project-name">{selectedAsset.project}</span>
              <h1>{selectedAsset.title}</h1>
              <p>{selectedAsset.plant} / {selectedAsset.process} · {selectedAsset.owner}</p>
              <div className="detail-identity-row">
                <span className={`code-role role-${selectedAsset.role}`}>{selectedAsset.role}</span><TrustStatus status={selectedAsset.verified} />
                <span className="detail-asset-id">{selectedAsset.id}</span>
                <span className="detail-usage-signals" aria-label="코드 자산 활용 현황">
                  <span title="조회수"><Eye size={12} /><b>1,248</b></span>
                  <span title="다운로드 수"><Download size={12} /><b>{downloadCount}</b></span>
                  <span title="인용·공유 수"><Quote size={12} /><b>{citationCount}</b></span>
                  <span className="is-rating" title="별점"><Star size={12} fill="currentColor" /><b>4.8</b></span>
                  <span title="즐겨찾기·구독 수"><Bookmark size={12} /><b>{selectedAsset.favorite ? 94 : 93}</b></span>
                </span>
                <label className="detail-version-control">
                  <span>버전</span>
                  <span className="detail-version-native"><select value={selectedVersion} onChange={(event) => { setSelectedVersion(event.target.value); updateCodeDetailUrl(detailTab, event.target.value); setNotice(`${event.target.value} 버전을 불러왔습니다.`); }} aria-label="코드 버전 선택">{getVersionOptions(selectedAsset.version).map((version) => <option value={version} key={version}>{version}{version === selectedAsset.version ? ' · 최신' : ''}</option>)}</select><ChevronDown size={13} /></span>
                </label>
              </div>
            </div>
            <div className="code-detail-actions">
              <button type="button" className={selectedAsset.favorite ? 'detail-icon-action is-active' : 'detail-icon-action'} onClick={() => toggleFavorite(selectedAsset.id)} aria-label="즐겨찾기·구독" title="즐겨찾기·구독"><Bookmark size={17} fill={selectedAsset.favorite ? 'currentColor' : 'none'} /></button>
              <button type="button" className="detail-icon-action" onClick={copyAssetUrl} aria-label="자산 URL 복사" title="자산 URL 복사"><Link2 size={17} /></button>
              <button type="button" className="detail-icon-action" onClick={() => setNotice('코드 자산 정보 수정 화면을 준비합니다.')} aria-label="자산 정보 수정" title="자산 정보 수정"><PencilLine size={17} /></button>
              <button type="button" className="detail-icon-action is-danger" onClick={() => setNotice('코드 자산 사용 중지 요청 화면을 준비합니다.')} aria-label="코드 자산 사용 중지" title="코드 자산 사용 중지"><Power size={17} /></button>
              {selectedAsset.restricted ? <button type="button" className="detail-primary-action" onClick={() => setAccessRequested(true)}><LockKeyhole size={15} /> {accessRequested ? '요청 접수됨' : '열람 권한 요청'}</button> : <button type="button" className="detail-primary-action" onClick={() => setNotice('코드 편집 세션을 준비합니다.')}><PencilLine size={15} /> 코드 편집</button>}
            </div>
          </header>

          {selectedAsset.restricted ? <section className="restricted-notebook"><LockKeyhole size={28} /><span>ACCESS RESTRICTED</span><h2>Notebook 본문 열람 권한이 필요합니다</h2><p>자산의 존재와 일반 메타정보는 확인할 수 있습니다. HMMA 생산물류혁신팀의 승인을 받으면 코드와 실행 이력을 열람할 수 있습니다.</p><button type="button" onClick={() => setAccessRequested(true)}>{accessRequested ? '권한 요청이 접수되었습니다' : '열람 권한 요청'}</button></section> :
          <Tabs value={detailTab} onValueChange={(value) => updateCodeDetailUrl(value)} className="code-detail-tabs">
            <TabsList variant="line" className="code-detail-tablist">
              <TabsTrigger value="notebook">Notebook</TabsTrigger>
              <TabsTrigger value="packages">패키지</TabsTrigger>
              <TabsTrigger value="versions">버전</TabsTrigger>
              <TabsTrigger value="runs">실행 이력</TabsTrigger>
              <TabsTrigger value="lineage">연결 관계</TabsTrigger>
              <TabsTrigger value="access">접근 관리</TabsTrigger>
            </TabsList>
            <TabsContent value="notebook" className="code-detail-tabcontent">
              <div className="notebook-layout">
                <NotebookHtmlViewer version={selectedVersion} />
                <aside className="detail-side-stack">
                  <div className="execution-rail">
                    <section className="rail-status"><span>실행 준비 상태</span><strong><ShieldCheck size={17} /> 재현 확인 완료</strong><small>2026.09.08 · RUN-26841</small></section>
                    <section><span className="rail-label">입력 데이터</span><a href="/assets/data?asset=PRJ000212-D-0001"><Database size={15} /><div><strong>용접 비드 결함 데이터셋</strong><small>v13 · 43,180 images</small></div><ArrowUpRight size={13} /></a></section>
                    <section><span className="rail-label">실행 자원</span><a href="/resources/compute"><Cpu size={15} /><div><strong>ml.a100.20gb</strong><small>CPU 16 · MEM 64GB · NVIDIA A100 20GB</small></div><ArrowUpRight size={13} /></a></section>
                    <section><span className="rail-label">실행 환경</span><a href="/resources/environments"><Layers3 size={15} /><div><strong>pytorch-2.4-yolo12-py311-cu124</strong><small>Ubuntu 22.04 · Python 3.11 · CUDA 12.4</small></div><ArrowUpRight size={13} /></a></section>
                    <section><span className="rail-label">출력 자산</span><a href="/assets/models"><Box size={15} /><div><strong>WeldNet 2.4.1</strong><small>Model candidate</small></div><ArrowUpRight size={13} /></a></section>
                    <button type="button" className="rail-run-button" onClick={() => setExecutionOpen(true)}><Play size={14} fill="currentColor" /> 이 버전으로 실행</button>
                  </div>
                  <section className="asset-utility-card">
                    <header className="asset-utility-heading"><strong>자산 활용</strong><span>코드를 내려받거나 다른 과제에서 재사용합니다.</span></header>
                    <div className="asset-utility-actions">
                      <button type="button" onClick={downloadAsset}><Download size={16} /><span>코드 다운로드</span><ArrowRight size={14} /></button>
                      <button type="button" onClick={() => setSdkOpen(true)}><TerminalSquare size={16} /><span>SDK 스니펫 보기</span><ArrowRight size={14} /></button>
                      <button type="button" className="is-primary" onClick={() => setForkOpen(true)}><GitFork size={16} /><span>이 코드로 시작</span><ArrowRight size={14} /></button>
                    </div>
                    <div className="asset-rating-control"><div><strong>이 코드가 도움이 되었나요?</strong><span>{userRating ? `${userRating}점을 남겼습니다` : '평점을 남겨 재사용 판단을 도와주세요'}</span></div><span>{[1,2,3,4,5].map((score) => <button type="button" className={userRating >= score ? 'is-active' : ''} onClick={() => { setUserRating(score); setNotice(`${score}점 평가를 반영했습니다.`); }} aria-label={`${score}점 주기`} key={score}><Star size={18} fill={userRating >= score ? 'currentColor' : 'none'} /></button>)}</span></div>
                    <button type="button" className="asset-discussion-action" onClick={() => setNotice('이 코드 자산의 디스커션 18개를 불러옵니다.')}><MessageSquareText size={16} /><span><strong>디스커션</strong><small>질문과 활용 경험을 나눕니다</small></span><b>18</b><ArrowRight size={13} /></button>
                  </section>
                </aside>
              </div>
            </TabsContent>
            <TabsContent value="packages" className="code-detail-tabcontent"><PackageView /></TabsContent>
            <TabsContent value="versions" className="code-detail-tabcontent"><VersionHistory /></TabsContent>
            <TabsContent value="runs" className="code-detail-tabcontent"><RunHistory onOpenRun={() => setScreen('run')} /></TabsContent>
            <TabsContent value="lineage" className="code-detail-tabcontent"><LineageView /></TabsContent>
            <TabsContent value="access" className="code-detail-tabcontent"><AccessView requested={accessRequested} onRequest={() => setAccessRequested(true)} /></TabsContent>
          </Tabs>}
        </PortalDetailFrame>}

        {!visionDemoOpen && screen === 'pipeline' && <PipelineWorkspace runs={runRecords} schedules={schedules} view={pipelineView} project={pipelineProject} onProjectChange={(project) => { setPipelineProject(project); const asset = assets.find((item) => item.project === project && item.executable); if (asset) setPipelineCodeAssetId(asset.id); const params = new URLSearchParams(window.location.search); params.set('pipeline', '1'); params.set('project', project === '용접 품질 고도화' ? 'PRJ000212' : project); window.history.replaceState(null, '', `/assets/code?${params.toString()}`); }} onExecute={openPipelineCodePicker} onViewChange={(value) => { setPipelineView(value); const params = new URLSearchParams(window.location.search); params.set('pipeline', '1'); value === 'schedules' ? params.set('view', 'schedules') : params.delete('view'); window.history.replaceState(null, '', `/assets/code?${params.toString()}`); }} onOpenRun={(id) => { setActiveRunId(id); navigateWorkspace('run', id); }} />}

        {!visionDemoOpen && screen === 'run' && <PortalDetailFrame className="run-detail-page">{activeRun.live ? <LiveRunDetail key={activeRun.id} run={activeRun.live} title={activeRun.title} project={activeRun.project} onBack={() => navigateWorkspace('pipeline')} /> : <>
          <button className="detail-back" type="button" onClick={() => navigateWorkspace('pipeline')}><ArrowLeft size={15} /> 실험 대시보드</button>
          <header className="run-detail-header">
            <div><span className="code-page-kicker">{activeRun.id} / TRAINING</span><span className="run-project-name">{activeRun.project}</span><h1>{activeRun.title}</h1><p>{activeRun.assetId} · {activeRun.version} · 울산 차체 2라인</p></div>
            <div className="run-header-actions"><button type="button"><RotateCcw size={15} /> 동일 조건으로 다시 실행</button><button type="button" className="run-stop-button">실행 중지</button></div>
          </header>
          <section className="run-progress-card">
            <div className="run-progress-heading"><div><span className={activeRun.progress >= 100 ? 'run-live-dot is-complete' : 'run-live-dot'} /><strong>{activeRun.progress >= 100 ? '실행 완료' : activeRun.status}</strong><small>{activeRun.progress >= 100 ? '전체 실행이 정상적으로 완료되었습니다.' : activeRun.progress < 24 ? 'Airflow 작업과 실행 자원을 준비하고 있습니다.' : '학습 파이프라인이 정상적으로 실행 중입니다.'}</small></div><b>{activeRun.progress}%</b></div>
            <div className="run-large-progress"><i style={{ width: `${activeRun.progress}%` }} /></div>
            <div className="run-stage-track"><span className={activeRun.progress >= 10 ? 'is-done' : 'is-current'}>{activeRun.progress >= 10 ? <Check size={13} /> : <Clock3 size={13} />}환경 준비</span><span className={activeRun.progress >= 24 ? 'is-done' : activeRun.progress >= 10 ? 'is-current' : ''}>{activeRun.progress >= 24 ? <Check size={13} /> : <Clock3 size={13} />}데이터 연결</span><span className={activeRun.progress >= 100 ? 'is-done' : activeRun.progress >= 24 ? 'is-current' : ''}>{activeRun.progress >= 100 ? <Check size={13} /> : <Clock3 size={13} />}모델 학습</span><span className={activeRun.progress >= 100 ? 'is-done' : ''}>{activeRun.progress >= 100 && <Check size={13} />}평가·등록</span></div>
          </section>
          <div className="run-detail-grid run-notebook-grid">
            <section className="run-notebook-result">
              <header><div><FileCode2 size={16} /><span><strong>Notebook 실행 결과</strong><small>Papermill HTML · 코드와 출력 보존</small></span></div><div><span className={activeRun.progress >= 100 ? 'run-output-state is-complete' : 'run-output-state'}>{activeRun.progress >= 100 ? '실행 완료' : '출력 동기화 중'}</span><button type="button" onClick={focusRunNotebookOutput}><Eye size={14} /> 주요 결과</button><button type="button" onClick={() => setRunRecords((current) => current.map((run) => run.id === activeRun.id ? { ...run, progress: Math.min(100, run.progress + 21), status: run.progress + 21 >= 100 ? '완료' : '실행 중' } : run))}>출력 새로고침</button></div></header>
              <iframe
                ref={runNotebookFrameRef}
                className="run-notebook-frame"
                src="/notebooks/weld-training-v2.4.1.html"
                title={`${activeRun.title} Notebook 실행 결과`}
                sandbox="allow-same-origin"
              />
            </section>
            <aside className="run-context-panel"><section><span>실행 조건</span><dl><div><dt>코드</dt><dd>{activeRun.version}</dd></div><div><dt>데이터</dt><dd>{activeRun.data}</dd></div><div><dt>실행 환경</dt><dd>{activeRun.environment}</dd></div><div><dt>운영체제</dt><dd>Ubuntu 22.04</dd></div><div><dt>실행 자원</dt><dd>{activeRun.resource}</dd></div><div><dt>실행자</dt><dd>이학선</dd></div><div><dt>Seed</dt><dd>42</dd></div></dl></section><section><span>자원 사용</span><div className="resource-meter"><div><small>GPU</small><strong>92%</strong></div><i><b style={{ width: '92%' }} /></i></div><div className="resource-meter"><div><small>GPU Memory</small><strong>15.4 / 20 GB</strong></div><i><b style={{ width: '77%' }} /></i></div></section></aside>
          </div>
          <details className="run-log-details"><summary><span><TerminalSquare size={15} /> Airflow 실행 로그</span><small>기술 진단 정보 · 필요할 때 펼쳐보기</small><ChevronDown size={14} /></summary><pre>{`[${activeRun.requestedAt}] Airflow DAG request accepted · ${activeRun.id}\n[PARAMETERS] Papermill injected 7 parameters\n[PRECHECK] Code and asset permission passed (8/8)\n[ENV] ${activeRun.environment} image prepared\n[RESOURCE] ${activeRun.resource} allocation requested\n[DATA] ${activeRun.data} downloaded\n[TRACKING] MLflow run started · experiment usn-weld-defect\n${activeRun.progress >= 24 ? '[RUNNING] Training started · NVIDIA A100 20GB\n[TRAIN] Epoch 31/80 · mAP50 0.934 · loss 0.147' : '[WAITING] Worker allocation in progress'}\n${activeRun.progress >= 100 ? '[COMPLETE] Epoch 80/80 · mAP50 0.968 · loss 0.082\n[MLFLOW] Parameters, metrics and model artifact logged\n[REGISTER] PRIZM model version created · WeldNet 2.5.0' : '[STREAM] Awaiting next checkpoint...'}`}</pre></details>
          {activeRun.progress >= 100 && <section className="run-result-strip"><div><ShieldCheck size={22} /><span><strong>평가 기준 7개 통과</strong><small>WELD-DETECTION-GATE:v3</small></span></div><div><span>mAP50</span><strong>0.968</strong></div><div><span>생성 모델</span><strong>WeldNet 2.5.0</strong></div><button type="button">모델 자산 확인 <ArrowRight size={14} /></button></section>}
        </>}</PortalDetailFrame>}

        {notice && <output className="code-notice"><Check size={15} /><span>{notice}</span>{notice.includes('실행') && <button type="button" className="code-notice-link" onClick={() => { setNotice(null); navigateWorkspace('pipeline'); }}>실험 대시보드 보기 <ArrowRight size={13} /></button>}<button type="button" onClick={() => setNotice(null)} aria-label="알림 닫기"><X size={14} /></button></output>}
        <AssetSdkDialog open={sdkOpen} onOpenChange={setSdkOpen} type="code" assetId={selectedAsset.id} version={selectedVersion} title={selectedAsset.title} />
      </PortalWorkspaceSurface>

      <Dialog open={pipelineCodePickerOpen} onOpenChange={setPipelineCodePickerOpen}>
        <DialogContent className="pipeline-code-dialog">
          <DialogHeader className="pipeline-code-dialog-header"><span>SELECT EXECUTABLE CODE</span><DialogTitle>실행할 코드 자산 선택</DialogTitle><DialogDescription><b>{pipelineProject}</b> 과제에 연결된 실행 가능한 코드입니다.</DialogDescription></DialogHeader>
          <div className="pipeline-code-dialog-body">
            <div className="pipeline-code-context"><span>선택 과제</span><strong>{pipelineProject === '용접 품질 고도화' ? 'PRJ000212' : pipelineProject === 'Surface Zero Defect' ? 'PRJ000274' : 'PRJ000341'} · {pipelineProject}</strong></div>
            <div className="pipeline-code-options">{assets.filter((asset) => asset.project === pipelineProject).map((asset) => <button type="button" className={pipelineCodeAssetId === asset.id ? 'is-selected' : ''} disabled={!asset.executable} onClick={() => setPipelineCodeAssetId(asset.id)} key={asset.id}><span className="pipeline-code-icon"><FileCode2 size={19} /></span><span><small>{asset.role} · {asset.framework}</small><strong>{asset.title}</strong><em>{asset.id} · {asset.version}</em></span><b>{asset.executable ? <><ShieldCheck size={13} /> 실행 가능</> : '실행 권한 없음'}</b>{pipelineCodeAssetId === asset.id && <Check size={16} />}</button>)}</div>
            {!assets.some((asset) => asset.project === pipelineProject) && <div className="pipeline-code-empty"><FileCode2 size={24} /><strong>연결된 코드 자산이 없습니다</strong><span>과제의 코드 자산을 먼저 등록해 주세요.</span></div>}
          </div>
          <DialogFooter className="pipeline-code-dialog-footer"><button type="button" className="schedule-cancel" onClick={() => setPipelineCodePickerOpen(false)}>취소</button><button type="button" className="pipeline-code-continue" disabled={!assets.some((asset) => asset.id === pipelineCodeAssetId && asset.project === pipelineProject && asset.executable)} onClick={continuePipelineExecution}>선택한 코드로 실행 설정 <ArrowRight size={14} /></button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={executionOpen} onOpenChange={setExecutionOpen}>
        <SheetContent side="right" className="execution-sheet">
          <SheetHeader className="execution-sheet-header"><span>NEW RUN / {selectedAsset.role}</span><SheetTitle>실행 설정</SheetTitle><SheetDescription><b>{selectedAsset.project}</b><em>{selectedAsset.title} · {selectedVersion}</em></SheetDescription></SheetHeader>
          <div className="execution-sheet-body">
            <section className="execution-form-section execution-target-section"><span className="execution-section-number">01</span><div><h3>실행 대상</h3><p>결과는 현재 과제의 실행 이력에 자동으로 기록됩니다.</p><dl><div><dt>과제</dt><dd>{selectedAsset.project}</dd></div><div><dt>코드</dt><dd>{selectedAsset.title}</dd></div><div><dt>버전</dt><dd>{selectedVersion}</dd></div></dl></div></section>
            <section className="execution-form-section"><span className="execution-section-number">02</span><div><h3>실행 자원과 환경</h3><p>실행 자원과 Docker 환경은 서로 독립적으로 선택합니다.</p><div className="execution-resource-grid"><ExecutionSelect label="실행 자원" value={executionResource} onChange={(value) => { setExecutionResource(value); setPreflightPassed(false); }}><option value="a100-10">ml.a100.10gb · CPU 8 · MEM 32GB</option><option value="a100-20">ml.a100.20gb · CPU 16 · MEM 64GB · 권장</option><option value="a100-48">ml.a100.48gb · CPU 32 · MEM 128GB</option></ExecutionSelect><ExecutionSelect label="실행 환경" value={executionRuntime} onChange={(value) => { setExecutionRuntime(value); setPreflightPassed(false); }}><option value="yolo12-14">pytorch-2.4-yolo12-py311-cu124</option><option value="vision32">pytorch-2.4-vision-py312-cu124</option></ExecutionSelect></div><div className="runtime-independent-summary"><span><Cpu size={15} /><small>실행 자원</small><strong>{executionResource === 'a100-10' ? 'ml.a100.10gb' : executionResource === 'a100-20' ? 'ml.a100.20gb' : 'ml.a100.48gb'}</strong></span><span><Layers3 size={15} /><small>실행 환경</small><strong>{executionRuntime === 'yolo12-14' ? 'pytorch-2.4-yolo12-py311-cu124' : 'pytorch-2.4-vision-py312-cu124'}</strong></span></div></div></section>
            <section className="execution-form-section"><span className="execution-section-number">03</span><div><h3>파라미터</h3><p>Papermill이 동일한 변수명으로 Notebook에 값을 주입합니다.</p><div className="parameter-grid parameter-asset-grid"><label><span>data_id</span><input type="text" value="PRJ000212-D-0001" readOnly /></label><label><span>model_id</span><input type="text" value="PRJ000001-M-0012" readOnly /></label><label><span>model_version</span><input type="text" value="v12.0.0" readOnly /></label></div><div className="parameter-grid parameter-value-grid">{runParameterNames.map((name) => <label key={name}><span>{name}</span><input type="number" min={1} step={1} value={runParameterInputs[name]} onChange={(event) => { const { value } = event.target; setRunParameterInputs((current) => ({ ...current, [name]: value })); }} /></label>)}</div><small className="parameter-contract"><Check size={13} /> parameters 셀 다음에 injected-parameters 셀이 자동 생성됩니다.</small></div></section>
            <section className={preflightPassed ? 'preflight-panel is-passed' : preflightRunning ? 'preflight-panel is-running' : 'preflight-panel'}><header><div><ShieldCheck size={18} /><span><strong>{preflightRunning ? '실행 조건 확인 중' : '실행 전 확인'}</strong><small>{preflightPassed ? '8개 항목을 모두 확인했습니다.' : preflightRunning ? '코드, 데이터, 환경 호환성을 점검합니다.' : '실행 조건과 권한을 확인합니다.'}</small></span></div><b>{preflightPassed ? '8 / 8 PASS' : preflightRunning ? 'CHECKING' : 'READY'}</b></header>{preflightPassed && <div className="preflight-checks"><span><Check size={12} /> 코드·환경 호환</span><span><Check size={12} /> 데이터 권한</span><span><Check size={12} /> 입력 규격</span><span><Check size={12} /> GPU 할당</span></div>}</section>
          </div>
          <SheetFooter className="execution-sheet-footer">{runError && <p className="execution-run-error" role="alert">{runError}</p>}<div className="execution-estimate"><span>예상 소요시간</span><strong>약 3~5분 (CPU)</strong></div><div className="execution-footer-actions"><button type="button" className="execution-preflight-action" disabled={preflightRunning} onClick={runPreflight}><ShieldCheck size={14} /> {preflightPassed ? '다시 점검' : preflightRunning ? '점검 중' : '사전 점검'}</button><button type="button" className="execution-schedule-action" onClick={openScheduling}><CalendarClock size={14} /> 스케줄링</button><button type="button" className="detail-primary-action" disabled={preflightRunning || runSubmitting} onClick={launchWithPreflight}><Play size={14} fill="currentColor" /> {runSubmitting ? '실행 요청 중' : '즉시 실행'}</button></div></SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="schedule-dialog">
          <DialogHeader className="schedule-dialog-header"><span>SCHEDULE PIPELINE</span><DialogTitle>실행 스케줄 설정</DialogTitle><DialogDescription><b>{selectedAsset.project}</b><em>{selectedAsset.title} · {selectedVersion}</em></DialogDescription></DialogHeader>
          <div className="schedule-dialog-body">
            <div className="schedule-mode-switch"><button type="button" className={scheduleMode === 'once' ? 'is-active' : ''} onClick={() => setScheduleMode('once')}><Clock3 size={16} /><span><strong>한 번 예약</strong><small>정해진 시점에 한 번 실행</small></span></button><button type="button" className={scheduleMode === 'repeat' ? 'is-active' : ''} onClick={() => setScheduleMode('repeat')}><CalendarClock size={16} /><span><strong>반복 실행</strong><small>주기와 요일을 설정</small></span></button></div>
            {scheduleMode === 'once' ? <div className="schedule-form-grid"><label><span>실행 날짜</span><input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></label><label><span>실행 시간</span><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></label></div> : <><div className="schedule-form-grid"><ExecutionSelect label="실행 주기" value={scheduleFrequency} onChange={setScheduleFrequency}><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option></ExecutionSelect><label><span>실행 시간</span><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></label></div>{scheduleFrequency === 'weekly' && <div className="weekday-picker"><span>실행 요일</span><div>{['월','화','수','목','금','토','일'].map((day) => <button type="button" className={scheduleDays.includes(day) ? 'is-active' : ''} onClick={() => setScheduleDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} key={day}>{day}</button>)}</div></div>}{scheduleFrequency === 'monthly' && <ExecutionSelect label="실행일" value={scheduleDayOfMonth} onChange={setScheduleDayOfMonth}>{['1','5','10','15','20','25'].map((day) => <option value={day} key={day}>매월 {day}일</option>)}</ExecutionSelect>}</>}
            <div className="schedule-policy"><ListChecks size={18} /><div><strong>중복 실행 방지</strong><span>이전 실행이 끝나지 않으면 다음 실행은 대기열에 추가합니다.</span></div></div>
            <div className="schedule-summary"><span>다음 실행</span><strong>{scheduleMode === 'once' ? `${scheduleDate.replaceAll('-', '.')} ${scheduleTime}` : `2026.09.14 ${scheduleTime}`}</strong><small>한국 시간 · Asia/Seoul</small></div>
          </div>
          <DialogFooter className="schedule-dialog-footer"><button type="button" className="schedule-cancel" onClick={() => setScheduleOpen(false)}>취소</button><button type="button" className="schedule-save" onClick={saveSchedule}><CalendarClock size={14} /> 스케줄 등록</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forkOpen} onOpenChange={setForkOpen}>
        <DialogContent className="fork-dialog">
          <DialogHeader className="fork-dialog-header">
            <span>START FROM VERIFIED CODE</span>
            <DialogTitle>이 코드로 시작</DialogTitle>
            <DialogDescription>검증된 코드와 실행 조건을 새 과제로 가져옵니다.</DialogDescription>
          </DialogHeader>
          <div className="fork-dialog-body">
            <section className="fork-source-card">
              <div><GitBranch size={19} /><span><small>원본 코드</small><strong>{selectedAsset.title}</strong><em>{selectedAsset.id} · {selectedVersion}</em></span></div>
              <b><ShieldCheck size={13} /> 재현 확인</b>
            </section>
            <div className="fork-form">
              <ExecutionSelect label="대상 프로젝트" value={forkProject} onChange={(value) => {
                setForkProject(value);
                if (value === 'PRJ000318') { setForkDataId('PRJ000318-D-0001'); setForkTitle('조지아 용접 비드 결함 검출 학습'); }
                if (value === 'PRJ000274') { setForkDataId('PRJ000274-D-0003'); setForkTitle('아산 용접 비드 결함 검출 학습'); }
                if (value === 'PRJ000341') { setForkDataId('PRJ000341-D-0001'); setForkTitle('체코 용접 비드 결함 검출 학습'); }
              }}>
                <option value="PRJ000318">PRJ000318 · 조지아 용접 품질 고도화</option>
                <option value="PRJ000274">PRJ000274 · 아산 용접 품질 고도화</option>
                <option value="PRJ000341">PRJ000341 · 체코 용접 품질 고도화</option>
              </ExecutionSelect>
              <label><span>새 코드 자산명</span><input value={forkTitle} onChange={(event) => setForkTitle(event.target.value)} /></label>
              <label><span>data_id</span><input value={forkDataId} onChange={(event) => setForkDataId(event.target.value)} /></label>
            </div>
            <section className="fork-lineage-preview">
              <span>자동 연결되는 lineage</span>
              <div><code>{selectedAsset.id}</code><ArrowRight size={15} /><code>{forkProject}-C-0001</code></div>
              <p>Notebook·패키지·실행 환경을 복사하고 Papermill의 <b>data_id</b> 기본값만 대상 데이터로 변경합니다.</p>
            </section>
          </div>
          <DialogFooter className="fork-dialog-footer">
            <button type="button" className="schedule-cancel" onClick={() => setForkOpen(false)}>취소</button>
            <button type="button" className="fork-create" onClick={createDerivedAsset}><Copy size={14} /> 새 코드 자산 만들기</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="register-dialog">
          <DialogHeader className="register-header"><span>REGISTER NOTEBOOK / {registerStep} OF 4</span><DialogTitle>Notebook 등록</DialogTitle><DialogDescription>Notebook과 Python 패키지 목록을 분석해 실행 가능한 코드 자산으로 등록합니다.</DialogDescription></DialogHeader>
          <div className="register-steps">{['Notebook', '기본 정보', '실행 정보', '공유 범위'].map((step, index) => <span className={registerStep >= index + 1 ? 'is-active' : ''} key={step}><i>{registerStep > index + 1 ? <Check size={12} /> : index + 1}</i>{step}</span>)}</div>
          <div className="register-body">
            {registerStep === 1 && <div className="upload-pair"><label className="upload-zone"><input className="sr-only" type="file" accept=".ipynb" onChange={(event) => event.target.files?.[0] && setRegisterFile(event.target.files[0].name)} /><Upload size={26} /><em>NOTEBOOK</em><strong>{registerFile || 'Notebook 파일을 선택하세요'}</strong><span>.ipynb · 최대 100MB</span><b>파일 선택</b></label><label className="upload-zone is-secondary"><input className="sr-only" type="file" accept=".txt" onChange={(event) => event.target.files?.[0] && setRequirementsFile(event.target.files[0].name)} /><LibraryBig size={26} /><em>PYTHON PACKAGES</em><strong>{requirementsFile || 'requirements.txt를 선택하세요'}</strong><span>requirements.txt · 최대 1MB</span><b>파일 선택</b></label></div>}
            {registerStep === 2 && <div className="register-form"><label><span>코드 자산명</span><input defaultValue="도장 표면 결함 추론" /></label><label><span>한 줄 설명</span><input defaultValue="검사 이미지를 배치 판정하고 결함 결과를 생성합니다." /></label><div className="register-form-grid"><div className="form-field"><span>코드 용도</span><Select defaultValue="inference"><SelectTrigger className="register-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inference">추론</SelectItem><SelectItem value="train">학습</SelectItem><SelectItem value="evaluate">평가</SelectItem></SelectContent></Select></div><div className="form-field"><span>소속 과제</span><Select defaultValue="surface"><SelectTrigger className="register-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="surface">Surface Zero Defect</SelectItem><SelectItem value="weld">용접 품질 고도화</SelectItem></SelectContent></Select></div></div></div>}
            {registerStep === 3 && <div className="register-form"><div className="register-auto-preview"><NotebookThumbnail asset={{ preview: 'matrix', previewMetric: 'AUTO', previewLabel: '추론 결과', role: '추론' }} /><div><span>AUTO PREVIEW</span><strong>HTML 변환본과 대표 카드를 만들었습니다</strong><p>Notebook은 출력까지 보존해 HTML로 변환하고, 첫 번째 의미 있는 출력 셀을 대표 카드로 선택합니다.</p></div></div><div className="register-runtime-grid"><div className="form-field"><span>권장 실행 자원</span><Select defaultValue="a100-20"><SelectTrigger className="register-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a100-20">ml.a100.20gb · CPU 16 · MEM 64GB</SelectItem><SelectItem value="a100-10">ml.a100.10gb · CPU 8 · MEM 32GB</SelectItem></SelectContent></Select></div><div className="form-field"><span>표준 실행 환경</span><Select defaultValue="yolo12-14"><SelectTrigger className="register-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yolo12-14">pytorch-2.4-yolo12-py311-cu124</SelectItem><SelectItem value="vision32">pytorch-2.4-vision-py312-cu124</SelectItem></SelectContent></Select></div></div><div className="registration-analysis"><Check size={18} /><div><strong>Notebook에서 실행 정보를 찾았습니다</strong><span>Python · PyTorch · OpenCV · 입력 경로 1개 · 출력 모델 1개</span></div></div><label><span>입력 데이터</span><input defaultValue="Paint Surface Image 2026 Q3 · v7" /></label></div>}
            {registerStep === 4 && <div className="sharing-options"><button type="button" className="is-selected"><Users size={18} /><span><strong>제조솔루션본부</strong><small>본부 구성원이 검색하고 열람할 수 있습니다.</small></span><Check size={16} /></button><button type="button"><Factory size={18} /><span><strong>아산공장 한정</strong><small>아산공장 구성원에게만 노출합니다.</small></span></button><button type="button"><LockKeyhole size={18} /><span><strong>과제 참여자 한정</strong><small>Surface Zero Defect 참여자만 접근합니다.</small></span></button></div>}
          </div>
          <DialogFooter className="register-footer"><button type="button" className="register-cancel" onClick={() => setRegisterOpen(false)}>취소</button>{registerStep > 1 && <button type="button" className="register-previous" onClick={() => setRegisterStep((step) => step - 1)}>이전</button>}<button type="button" className="register-next" onClick={() => registerStep < 4 ? setRegisterStep((step) => step + 1) : completeRegistration()}>{registerStep < 4 ? <>다음 <ArrowRight size={14} /></> : <>Notebook 작업본 등록 <Check size={14} /></>}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
