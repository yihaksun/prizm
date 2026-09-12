'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, ChevronDown, Copy, Database, Download,
  FileCode2, Grid2X2, ImageIcon, KeyRound, Layers3, List, Plus, RefreshCw, Search,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, TerminalSquare, Users, X,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';
import { AssetSdkDialog } from '@/components/asset-sdk-dialog';

type DataAsset = {
  id: string;
  title: string;
  description: string;
  project: string;
  plant: string;
  process: string;
  owner: string;
  version: string;
  updated: string;
  type: 'Image' | 'Tabular';
  size: string;
  labels: string;
  quality: string;
  favorite?: boolean;
  visual: 'weld' | 'paint' | 'press' | 'battery' | 'vision' | 'table';
};

const dataAssets: DataAsset[] = [
  { id: 'PRJ000212-D-0001', title: '용접 비드 결함 데이터셋', description: '용접 비드 이미지와 결함 Labels을 결합한 학습 가능한 데이터입니다.', project: '용접 품질 고도화', plant: '울산', process: '차체 · 용접', owner: '제조AI기술개발팀', version: 'v13', updated: '오늘 14:20', type: 'Image', size: '43,180 images', labels: '61,492 Labels', quality: '98.7', favorite: true, visual: 'weld' },
  { id: 'DATA-ASN-PAINT-018', title: '도장 표면 결함 이미지', description: '오렌지필, 이물, 크레이터 유형을 현장 판정과 연결한 검사 데이터입니다.', project: 'Surface Zero Defect', plant: '아산', process: '도장 · 검사', owner: '품질AI팀', version: 'v8', updated: '어제', type: 'Image', size: '28,640 images', labels: '34,912 Labels', quality: '97.9', visual: 'paint' },
  { id: 'DATA-USN-PRESS-011', title: '프레스 균열·주름 데이터', description: '차종과 금형 조건별 균열 및 주름 판정 이미지를 표준화했습니다.', project: 'Press Quality Guard', plant: '울산', process: '프레스 · 성형', owner: '생산기술AI팀', version: 'v6', updated: '3일 전', type: 'Image', size: '19,284 images', labels: '22,106 Labels', quality: '96.8', visual: 'press' },
  { id: 'DATA-HMGMA-CELL-007', title: '배터리 셀 외관 검사', description: '셀 표면 스크래치와 전극 정렬 상태를 포함한 글로벌 공통 데이터셋입니다.', project: 'Battery Cell Intelligence', plant: 'HMGMA', process: '배터리 · 검사', owner: '배터리AI팀', version: 'v4', updated: '5일 전', type: 'Image', size: '51,902 images', labels: '73,441 Labels', quality: '98.2', visual: 'battery' },
  { id: 'DATA-NYG-VISION-024', title: '차종 공통 조립 검사', description: '조립 누락과 체결 상태를 차종 공통 스키마로 구성한 이미지 자산입니다.', project: 'Assembly Vision Standard', plant: '남양', process: '의장 · 검사', owner: 'Vision CoE', version: 'v10', updated: '8일 전', type: 'Image', size: '36,771 images', labels: '42,890 Labels', quality: '97.4', visual: 'vision' },
  { id: 'DATA-JNJ-TORQUE-016', title: '체결 토크 시계열', description: '설비·차종·공정 조건과 체결 결과를 연결한 분석용 정형 데이터입니다.', project: 'Fastening Quality AI', plant: '전주', process: '의장 · 체결', owner: '데이터플랫폼팀', version: 'v12', updated: '11일 전', type: 'Tabular', size: '18.6M rows', labels: '12 features', quality: '99.1', visual: 'table' },
];

function DataThumbnail({ asset }: { asset: DataAsset }) {
  return <figure className={`data-catalog-thumbnail visual-${asset.visual}`}>
    {asset.visual === 'weld' ? <Image src="/weld-inspection-defect.png" alt="용접 비드 결함 데이터 미리보기" fill sizes="(max-width: 767px) 100vw, 30vw" /> : <div className="data-pattern" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
    <header><span>{asset.type.toUpperCase()} DATASET</span></header>
    <footer><span>{asset.size}</span><strong>{asset.quality}</strong><small>QUALITY</small></footer>
  </figure>;
}

function DataAssetDetail({ onClose, onTrain, favorite, onFavorite }: { onClose: () => void; onTrain: () => void; favorite: boolean; onFavorite: () => void }) {
  const [version, setVersion] = useState('v13');
  const [sdkOpen, setSdkOpen] = useState(false);
  return <main className="code-detail-page data-detail-page">
      <button className="detail-back" type="button" onClick={onClose}><ArrowLeft size={15} /> 데이터 자산</button>
      <header className="code-detail-header">
        <div className="detail-title-mark data-title-mark"><Database size={23} /><span>DATA</span></div>
        <div className="code-detail-title"><span className="detail-project-name">용접 품질 고도화</span><h1>용접 비드 결함 데이터셋</h1><p>울산 / 차체 · 용접 · 제조AI기술개발팀</p><div className="detail-identity-row"><span className="code-role role-학습">Image</span><span className="detail-trust is-verified"><i />검증 완료</span><span className="detail-asset-id">PRJ000212-D-0001</span><span className="detail-meta-divider" /><label className="detail-version-control"><span>버전</span><span className="detail-version-native"><select value={version} onChange={(event) => setVersion(event.target.value)} aria-label="데이터 버전 선택"><option value="v13">v13 · 최신</option><option value="v12">v12</option><option value="v11">v11</option></select><ChevronDown size={13} /></span></label></div></div>
        <div className="code-detail-actions"><button type="button" className={favorite ? 'detail-icon-action is-active' : 'detail-icon-action'} onClick={onFavorite} aria-label="즐겨찾기"><Star size={17} fill={favorite ? 'currentColor' : 'none'} /></button><button type="button" className="detail-secondary-action"><Download size={15} /> 다운로드</button><button type="button" className="detail-secondary-action" onClick={() => setSdkOpen(true)}><TerminalSquare size={15} /> SDK 스니펫</button><button type="button" className="detail-secondary-action"><Copy size={15} /> 다른 과제에서 사용</button><button type="button" className="detail-primary-action" onClick={onTrain}><FileCode2 size={15} /> 이 데이터로 학습</button></div>
      </header>

      <Tabs defaultValue="overview" className="code-detail-tabs">
        <TabsList variant="line" className="code-detail-tablist"><TabsTrigger value="overview">개요</TabsTrigger><TabsTrigger value="samples">데이터 미리보기</TabsTrigger><TabsTrigger value="versions">버전</TabsTrigger><TabsTrigger value="lineage">연결 관계</TabsTrigger><TabsTrigger value="access">접근 관리</TabsTrigger></TabsList>
        <TabsContent value="overview" className="code-detail-tabcontent"><div className="notebook-layout data-overview-layout"><section className="data-detail-main"><div className="data-detail-preview"><Image src="/weld-inspection-defect.png" alt="용접 비드 미세 크랙 데이터" fill sizes="(max-width: 900px) 100vw, 60vw" /><span className="defect-marker"><i />미세 크랙 · Label</span><div><span>IMG 042761</span><b>LABEL VERIFIED</b></div></div><div className="data-detail-stats"><article><span>이미지</span><strong>43,180</strong><small>+320</small></article><article><span>Labels</span><strong>61,492</strong><small>+486</small></article><article><span>결함 유형</span><strong>6</strong><small>표준 클래스</small></article><article><span>품질 점수</span><strong>98.7</strong><small>12 / 12 PASS</small></article></div><section className="data-change-summary"><header><div><span>VERSION SUMMARY</span><h3>v12 이후 달라진 데이터</h3></div><small>이미지 카탈로그에서 자동 동기화</small></header><div><span><ImageIcon size={16} /><b>신규 이미지 320</b></span><span><Layers3 size={16} /><b>Labels 보강 486</b></span><span><RefreshCw size={16} /><b>Labels 수정 48</b></span><span><Sparkles size={16} /><b>새 결함 패턴 1</b></span></div></section></section><aside className="execution-rail data-relation-rail"><section className="rail-status"><span>품질 검증</span><strong><ShieldCheck size={17} /> 12 / 12 통과</strong><small>2026.09.11 · 12 / 12 PASS</small></section><section><span className="rail-label">원본 데이터</span><a href="#catalog"><ImageIcon size={15} /><div><strong>Image Catalog</strong><small>Weld Defect Collection 09</small></div><ArrowUpRight size={13} /></a></section><section><span className="rail-label">연관 코드</span><a href="/assets/code?asset=PRJ000212-C-0001&data=PRJ000212-D-0001"><FileCode2 size={15} /><div><strong>용접 비드 결함 검출 학습</strong><small>v2.4.1 · 재현 확인</small></div><ArrowUpRight size={13} /></a></section><section><span className="rail-label">파생 모델</span><a href="/assets/models"><Box size={15} /><div><strong>Weld Detector</strong><small>v2.5.0 · Production</small></div><ArrowUpRight size={13} /></a></section></aside></div></TabsContent>
        <TabsContent value="samples" className="code-detail-tabcontent"><section className="data-sample-browser"><header><div><span>DATA PREVIEW</span><h3>이미지와 Labels 미리보기</h3></div><small>43,180개 중 대표 샘플</small></header><div>{[1,2,3,4,5,6].map((item) => <article key={item}><div><Image src="/weld-inspection-defect.png" alt={`용접 검사 샘플 ${item}`} fill sizes="20vw" /><i /></div><span>IMG {String(42760 + item).padStart(6, '0')}</span><b>{item % 3 === 0 ? 'Porosity' : 'Micro crack'}</b></article>)}</div></section></TabsContent>
        <TabsContent value="versions" className="code-detail-tabcontent"><div className="detail-table-wrap"><table className="detail-table"><thead><tr><th>버전</th><th>상태</th><th>변경 내용</th><th>이미지</th><th>등록일</th></tr></thead><tbody><tr><td><strong>v13</strong></td><td><span className="detail-trust is-verified"><i />검증 완료</span></td><td>미세 크랙 신규 패턴 및 현장 검토 Labels 반영</td><td>43,180</td><td>2026.09.11</td></tr><tr><td><strong>v12</strong></td><td><span className="detail-trust is-verified"><i />검증 완료</span></td><td>야간 조도 이미지 품질 보정</td><td>42,860</td><td>2026.08.29</td></tr><tr><td><strong>v11</strong></td><td><span className="detail-trust is-verified"><i />검증 완료</span></td><td>결함 클래스 매핑 표준화</td><td>41,904</td><td>2026.08.12</td></tr></tbody></table></div></TabsContent>
        <TabsContent value="lineage" className="code-detail-tabcontent"><div className="lineage-panel"><header><div><span>RELATED ASSETS</span><h3>데이터에서 운영 모델까지</h3></div></header><div className="lineage-track"><a className="lineage-step" href="/assets/data?asset=PRJ000212-D-0001"><div className="lineage-node"><Database size={18} /><span>DATA</span><strong>용접 비드 결함 데이터셋</strong><small>v13</small></div><i className="lineage-connector"><ArrowRight size={14} /></i></a><a className="lineage-step" href="/assets/code?asset=PRJ000212-C-0001&data=PRJ000212-D-0001"><div className="lineage-node"><FileCode2 size={18} /><span>CODE</span><strong>용접 비드 결함 검출 학습</strong><small>v2.4.1</small></div><i className="lineage-connector"><ArrowRight size={14} /></i></a><a className="lineage-step" href="/assets/models"><div className="lineage-node"><Box size={18} /><span>MODEL</span><strong>Weld Detector</strong><small>v2.5.0</small></div></a></div></div></TabsContent>
        <TabsContent value="access" className="code-detail-tabcontent"><div className="access-panel"><section><span className="detail-section-label">공개 범위</span><h3>제조솔루션본부 내 검색 가능</h3><p>원본 이미지 열람과 다운로드는 울산 차체 품질 조직의 권한 정책을 적용합니다.</p><div className="access-scope"><div className="is-active"><Database size={16} /><strong>메타정보</strong><span>본부 구성원</span></div><div className="is-active"><FileCode2 size={16} /><strong>학습 연결</strong><span>과제 실행자</span></div><div><KeyRound size={16} /><strong>원본 열람</strong><span>승인 사용자</span></div><div><Users size={16} /><strong>접근 관리</strong><span>자산 책임자</span></div></div></section></div></TabsContent>
      </Tabs>
      <AssetSdkDialog open={sdkOpen} onOpenChange={setSdkOpen} type="data" assetId="PRJ000212-D-0001" version={version} title="용접 비드 결함 데이터셋" />
    </main>;
}

export function DataAssetsWorkspace() {
  const [selected, setSelected] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('전체 데이터');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [plantFilter, setPlantFilter] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState(() => new Set(dataAssets.filter((asset) => asset.favorite).map((asset) => asset.id)));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('asset')) setSelected(true);
  }, []);

  const filtered = useMemo(() => dataAssets.filter((asset) => {
    const searchable = [asset.id, asset.title, asset.description, asset.project, asset.plant, asset.process, asset.owner].join(' ').toLowerCase();
    if (query && !searchable.includes(query.toLowerCase())) return false;
    if (scope === '즐겨찾기' && !favorites.has(asset.id)) return false;
    if (scope === '내 데이터' && !['제조AI기술개발팀', '품질AI팀'].includes(asset.owner)) return false;
    if (typeFilter && asset.type !== typeFilter) return false;
    if (plantFilter && asset.plant !== plantFilter) return false;
    return true;
  }), [favorites, plantFilter, query, scope, typeFilter]);

  const openAsset = (asset: DataAsset) => {
    if (asset.id !== 'PRJ000212-D-0001') return;
    setSelected(true);
    window.history.replaceState(null, '', `/assets/data?asset=${asset.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
    <PortalNavigation screen="catalog" demoStage="data" />
    <div className="app-shell code-assets-shell">
      <CodeAssetsTopbar />
      <PortalWorkspaceTabs current="data-assets" />
      {selected ? <DataAssetDetail favorite={favorites.has('PRJ000212-D-0001')} onFavorite={() => setFavorites((current) => { const next = new Set(current); next.has('PRJ000212-D-0001') ? next.delete('PRJ000212-D-0001') : next.add('PRJ000212-D-0001'); return next; })} onTrain={() => { window.location.href = '/assets/code?asset=PRJ000212-C-0001&data=PRJ000212-D-0001'; }} onClose={() => { setSelected(false); window.history.replaceState(null, '', '/assets/data'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /> : <main className="code-assets-page">
        <section className="code-page-heading">
          <div><span className="code-page-kicker">ASSET MANAGEMENT / DATA REGISTRY</span><h1>데이터 자산</h1><p>공장과 과제에서 생성된 학습 데이터를 찾고, 버전과 품질 근거를 확인합니다.</p></div>
          <button className="code-primary-action" type="button"><Plus size={16} /> 데이터 등록</button>
        </section>

        <section className="code-search-panel" aria-label="데이터 자산 검색">
          <label className="code-search-box"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="데이터명, 과제, 공장, 공정으로 검색" />{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={15} /></button>}<kbd>⌘ K</kbd></label>
          <div className="code-scope-row">{['전체 데이터', '내 데이터', '공유받음', '검증 완료', '즐겨찾기'].map((item) => <button type="button" className={scope === item ? 'is-active' : ''} onClick={() => setScope(item)} key={item}>{item}</button>)}</div>
          <div className="code-filter-row"><div className="code-filter-chips"><button type="button" className={typeFilter ? 'is-active' : ''} onClick={() => setTypeFilter(typeFilter ? null : 'Image')}>데이터 유형 {typeFilter && `· ${typeFilter}`} <ChevronDown size={13} /></button><button type="button" className={plantFilter ? 'is-active' : ''} onClick={() => setPlantFilter(plantFilter ? null : '울산')}>공장·공정 {plantFilter && `· ${plantFilter}`} <ChevronDown size={13} /></button><button type="button"><SlidersHorizontal size={13} /> 필터 더 보기</button></div><span className="data-catalog-status"><i /> 품질 검증 통과 데이터만 표시</span></div>
        </section>

        <section className="code-results-section">
          <header className="code-results-toolbar"><div><strong>검색 결과 {filtered.length}개</strong><span>최신 버전과 품질 검증 상태를 반영한 결과입니다.</span></div><div><button type="button" className="code-sort">최근 업데이트순 <ChevronDown size={13} /></button><span className="code-view-switch"><button type="button" className={view === 'list' ? 'is-active' : ''} aria-label="목록 보기" onClick={() => setView('list')}><List size={16} /></button><button type="button" className={view === 'grid' ? 'is-active' : ''} aria-label="카드 보기" onClick={() => setView('grid')}><Grid2X2 size={15} /></button></span></div></header>
          <div className={view === 'grid' ? 'code-asset-list is-grid' : 'code-asset-list'}>{filtered.map((asset) => <article className={`code-asset-row data-catalog-card ${asset.id === 'PRJ000212-D-0001' ? 'is-demo-ready' : ''}`} key={asset.id}>
            <button className="code-asset-main" type="button" onClick={() => openAsset(asset)}><DataThumbnail asset={asset} /><div className="code-asset-copy"><span className="code-asset-project">{asset.project}</span><div className="code-asset-title"><span className="code-role role-학습">{asset.type}</span><h2>{asset.title}</h2></div><p>{asset.description}</p><div className="code-asset-context"><span>{asset.plant} / {asset.process}</span><i /><span>{asset.owner}</span></div></div></button>
            <div className="code-asset-technical"><span>{asset.size}</span><span>{asset.labels}</span><small>{asset.id}</small></div><div className="code-asset-owner"><strong>{asset.owner}</strong><span>{asset.version} · {asset.updated}</span></div><div className="code-asset-trust"><strong className="is-verified">검증 완료</strong><span>품질 {asset.quality}</span></div><button type="button" className={favorites.has(asset.id) ? 'code-favorite is-active' : 'code-favorite'} onClick={() => setFavorites((current) => { const next = new Set(current); next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id); return next; })} aria-label="즐겨찾기"><Star size={17} fill={favorites.has(asset.id) ? 'currentColor' : 'none'} /></button><ArrowRight className="code-row-arrow" size={16} />
          </article>)}</div>
        </section>
      </main>}
    </div>
  </SidebarProvider>;
}
