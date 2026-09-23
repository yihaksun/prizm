'use client';

import { useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  Database,
  FileCode2,
  GitBranch,
  Grid2X2,
  List,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  X,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';
import {
  PortalButton,
  PortalFilterSurface,
  PortalPageFrame,
  PortalPageHeader,
  PortalPrismAtmosphere,
  PortalResultsSurface,
  PortalWorkspaceSurface,
} from '@/components/portal-page-primitives';

const pipelineAssets = [
  {
    id: 'PRJ000212-P-0001',
    title: '용접 비드 결함 재학습 파이프라인',
    description: '데이터셋 최신 버전, YOLO12 학습 코드, 평가 게이트, 모델 등록까지 연결된 표준 학습 흐름입니다.',
    project: '용접 품질 고도화',
    plant: '울산',
    process: '차체 · 용접',
    owner: '제조AI기술개발팀',
    status: '운영',
    version: 'v1.3.0',
    updated: '오늘 10:24',
    nodes: 6,
    runs: 42,
  },
  {
    id: 'PRJ000274-P-0001',
    title: '도장 표면 결함 배치 추론 파이프라인',
    description: '검사 이미지 배치 입력부터 추론 결과 적재, 품질 담당자 검토까지 연결합니다.',
    project: 'Surface Zero Defect',
    plant: '아산',
    process: '도장 · 검사',
    owner: '품질AI팀',
    status: '검증',
    version: 'v0.8.2',
    updated: '어제',
    nodes: 5,
    runs: 18,
  },
  {
    id: 'PRJ000341-P-0001',
    title: '배터리 셀 이상 탐지 학습 파이프라인',
    description: '시계열 데이터 추출, 이상 탐지 학습, 운영 후보 모델 생성을 하나의 흐름으로 관리합니다.',
    project: 'Cell Quality Intelligence',
    plant: 'HMGMA',
    process: '배터리 · 검사',
    owner: '전동화품질팀',
    status: '초안',
    version: 'v0.3.4',
    updated: '5일 전',
    nodes: 4,
    runs: 7,
  },
];

function PipelineFlowPreview({ active = false }: { active?: boolean }) {
  const steps = [
    { label: 'DATA', icon: Database },
    { label: 'CODE', icon: FileCode2 },
    { label: 'RUN', icon: Workflow },
    { label: 'EVAL', icon: ShieldCheck },
    { label: 'MODEL', icon: Box },
  ];

  return (
    <div className={active ? 'pipeline-asset-preview is-active' : 'pipeline-asset-preview'} aria-hidden="true">
      {steps.map((step, index) => (
        <span key={step.label}>
          <step.icon size={15} />
          <b>{step.label}</b>
          {index < steps.length - 1 && <i />}
        </span>
      ))}
    </div>
  );
}

export function PipelineAssetsWorkspace() {
  const [query, setQuery] = useState('');
  const flowNodes = [
    { label: '데이터 자산', value: 'PRJ000212-D-0001', icon: Database },
    { label: '코드 자산', value: 'PRJ000212-C-0001', icon: FileCode2 },
    { label: '실험 실행', value: 'RUN Template', icon: Workflow },
    { label: '평가 게이트', value: 'Weld Detection Gate', icon: ShieldCheck },
    { label: '모델 자산', value: 'PRJ000212-M-0001', icon: Box },
  ];
  const resultTools = (
    <>
      <button type="button" className="code-sort">최근 업데이트순 <ChevronDown size={13} /></button>
      <span className="code-view-switch">
        <button type="button" aria-label="목록 보기"><List size={16} /></button>
        <button type="button" className="is-active" aria-label="카드 보기"><Grid2X2 size={15} /></button>
      </span>
    </>
  );

  return (
    <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
      <PortalNavigation screen="catalog" activeNavigation={{ group: '자산관리', child: '파이프라인 구성' }} />
      <PortalWorkspaceSurface>
        <CodeAssetsTopbar />
        <PortalWorkspaceTabs current="pipeline-assets" />
        <PortalPrismAtmosphere />
        <PortalPageFrame className="code-assets-page pipeline-assets-page">
          <PortalPageHeader
            className="code-page-heading"
            kicker="ASSET MANAGEMENT / PIPELINE GRAPH"
            title="파이프라인 구성"
            description="데이터, 코드, 실행, 평가, 모델 자산의 연결관계를 구성하고 운영 흐름으로 관리합니다."
            action={<PortalButton variant="primary"><Plus size={16} /> 파이프라인 구성 등록</PortalButton>}
          />

          <PortalFilterSurface className="code-search-panel" aria-label="파이프라인 구성 검색">
            <label className="code-search-box">
              <Search size={20} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파이프라인명, 과제, 공장, 연결 자산으로 검색" />
              {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={15} /></button>}
              <kbd>⌘ K</kbd>
            </label>
            <div className="code-scope-row">
              {['전체 구성', '내 과제', '운영 구성', '검증 중', '초안'].map((item, index) => <button type="button" className={index === 0 ? 'is-active' : ''} key={item}>{item}</button>)}
            </div>
            <div className="code-filter-row">
              <div className="code-filter-chips">
                <button type="button">과제 <ChevronDown size={13} /></button>
                <button type="button">공장·공정 <ChevronDown size={13} /></button>
                <button type="button"><SlidersHorizontal size={13} /> 필터 더 보기</button>
              </div>
              <span className="data-catalog-status"><i /> 운영 가능한 연결 구성 {pipelineAssets.filter((asset) => asset.status === '운영').length}개</span>
            </div>
          </PortalFilterSurface>

          <PortalResultsSurface className="code-results-section" title={`검색 결과 ${pipelineAssets.length}개`} description="연결관계 탭에서 보이는 자산 흐름을 등록·관리하는 구성입니다." tools={resultTools}>
            <div className="code-asset-list is-grid pipeline-asset-list">
              {pipelineAssets.map((asset) => (
                <article className={`code-asset-row pipeline-asset-row ${asset.status === '운영' ? 'is-demo-ready' : ''}`} key={asset.id}>
                  <button className="code-asset-main" type="button">
                    <PipelineFlowPreview active={asset.status === '운영'} />
                    <div className="code-asset-copy">
                      <span className="code-asset-project">{asset.project}</span>
                      <div className="code-asset-title">
                        <span className={`code-role ${asset.status === '운영' ? 'role-추론' : 'role-평가'}`}>{asset.status}</span>
                        <h2>{asset.title}</h2>
                      </div>
                      <p>{asset.description}</p>
                      <div className="code-asset-context"><span>{asset.plant} / {asset.process}</span><i /><span>{asset.owner}</span></div>
                    </div>
                  </button>
                  <div className="code-asset-technical"><span>노드 {asset.nodes}</span><span>실행 {asset.runs}</span><small>{asset.id}</small></div>
                  <div className="code-asset-owner"><strong>{asset.owner}</strong><span>{asset.version} · {asset.updated}</span></div>
                  <div className="code-asset-trust"><strong className={asset.status === '운영' ? 'is-verified' : 'is-check'}>{asset.status}</strong><span>{asset.nodes}개 자산 연결</span></div>
                  <ArrowRight className="code-row-arrow" size={16} />
                </article>
              ))}
            </div>
          </PortalResultsSurface>

          <section className="pipeline-configuration-panel">
            <header>
              <div><span>PIPELINE GRAPH</span><h2>용접 품질 고도화 연결 구성</h2></div>
              <button type="button"><GitBranch size={15} /> 버전 관리</button>
            </header>
            <div className="pipeline-configuration-flow">
              {flowNodes.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div className="pipeline-configuration-node" key={node.label}>
                    <span><Icon size={18} /></span>
                    <small>{node.label}</small>
                    <strong>{node.value}</strong>
                    <b><Check size={12} /> 연결됨</b>
                    {index < 4 && <i><ArrowRight size={15} /></i>}
                  </div>
                );
              })}
            </div>
            <footer>
              <span>이 구성은 코드 자산의 연결 관계 탭과 모델 자산의 생성 근거에 함께 노출됩니다.</span>
              <a href="/assets/code?asset=PRJ000212-C-0001&tab=lineage">연결 관계에서 보기 <ArrowUpRight size={13} /></a>
            </footer>
          </section>
        </PortalPageFrame>
      </PortalWorkspaceSurface>
    </SidebarProvider>
  );
}
