'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity, ArrowLeft, ArrowRight, Box, Check, CheckSquare, ChevronRight, CircleGauge, Clock3,
  Database, Factory, FileCode2, Globe2, ImageIcon, Layers3,
  Mail, MapPin, Play, RefreshCw, Rocket, Search, ShieldCheck, Sparkles, TriangleAlert,
  UserRound, Workflow, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type DemoStage = 'data' | 'train' | 'run' | 'evaluate' | 'model' | 'monitor';
type MonitorLevel = 'global' | 'factory' | 'model';

const stages: { id: DemoStage; number: string; label: string; icon: typeof Database }[] = [
  { id: 'data', number: '01', label: '검증 데이터', icon: Database },
  { id: 'train', number: '02', label: 'YOLO12 학습', icon: FileCode2 },
  { id: 'run', number: '03', label: '파이프라인 실행', icon: Workflow },
  { id: 'evaluate', number: '04', label: '현장 평가', icon: ShieldCheck },
  { id: 'model', number: '05', label: '운영 승격', icon: Rocket },
  { id: 'monitor', number: '06', label: '글로벌 모니터링', icon: Globe2 },
];

const stageIndex = (stage: DemoStage) => stages.findIndex((item) => item.id === stage);

function DemoJourney({ stage, onChange, onExit }: { stage: DemoStage; onChange: (stage: DemoStage) => void; onExit: () => void }) {
  const currentIndex = stageIndex(stage);
  return (
    <header className="vision-demo-journey">
      <div className="vision-demo-journey-title"><span><Sparkles size={14} /> VISION MLOPS DEMO</span><strong>용접 결함 개선 시나리오</strong></div>
      <nav aria-label="데모 단계">{stages.map((item, index) => <button type="button" className={stage === item.id ? 'is-current' : index < currentIndex ? 'is-done' : ''} onClick={() => onChange(item.id)} key={item.id}><i>{index < currentIndex ? <Check size={12} /> : item.number}</i><span>{item.label}</span></button>)}</nav>
      <button type="button" className="vision-demo-exit" onClick={onExit}><X size={14} /> 데모 종료</button>
    </header>
  );
}

function DemoPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="vision-demo-page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function DataStage({ onNext, nextCycle }: { onNext: () => void; nextCycle: boolean }) {
  const version = nextCycle ? 'v14' : 'v13';
  const previousVersion = nextCycle ? 'v13' : 'v12';
  const imageCount = nextCycle ? '43,466' : '43,180';
  const newImages = nextCycle ? '+286' : '+320';
  return <main className="vision-demo-page">
    <DemoPageHeader eyebrow="DATA ASSET / VALIDATED" title={nextCycle ? '운영 신호로 개선된 용접 데이터셋' : '용접 비드 결함 데이터셋'} description={nextCycle ? '운영 모델이 발견한 저신뢰 사례가 검토를 거쳐 다음 학습 데이터로 연결됐습니다.' : '이미지 카탈로그에서 구성한 이미지와 Labels을 학습 가능한 자산으로 보존합니다.'} action={<button type="button" className="vision-primary-button" onClick={onNext}><FileCode2 size={15} /> 이 데이터로 재학습 <ArrowRight size={14} /></button>} />
    <section className="data-asset-hero">
      <div className="data-asset-visual"><Image src="/weld-inspection-defect.png" alt="용접 비드 미세 크랙 검사 이미지" fill sizes="(max-width: 900px) 100vw, 55vw" priority /><span className="defect-marker"><i />미세 크랙 · Label</span><div className="image-sequence"><span>IMG 042761</span><span>LABEL VERIFIED</span></div></div>
      <div className="data-asset-summary"><span className="demo-project-label">용접 품질 고도화</span><h2>PRJ000212-D-0001</h2><div className="data-version-row"><strong>{version}</strong><span>최신 버전</span><small>2026.09.11 14:20</small></div><dl><div><dt>이미지</dt><dd>{imageCount}</dd></div><div><dt>Labels</dt><dd>{nextCycle ? '61,778' : '61,492'}</dd></div><div><dt>결함 유형</dt><dd>6</dd></div><div><dt>품질 점수</dt><dd>98.7</dd></div></dl><div className="data-ready-status"><ShieldCheck size={20} /><span><strong>학습 준비 완료</strong><small>이미지·Labels 연결, 중복, 라벨 규격 검증 통과</small></span><b>12 / 12 PASS</b></div></div>
    </section>
    <section className="data-version-diff">
      <header><div><span>VERSION INTELLIGENCE</span><h2>{previousVersion} 이후 달라진 데이터</h2></div><small>{nextCycle ? '운영 모니터링에서 자동 수집' : '이미지 카탈로그에서 자동 동기화'}</small></header>
      <div className="data-diff-grid"><article><ImageIcon size={18} /><span>신규 이미지</span><strong>{newImages}</strong><small>{nextCycle ? '야간 저신뢰 사례 선별' : '신규 미세 크랙 사례 포함'}</small></article><article><Layers3 size={18} /><span>Labels 보강</span><strong>{nextCycle ? '+214' : '+486'}</strong><small>미세 크랙 경계 라벨 추가</small></article><article><RefreshCw size={18} /><span>Labels 수정</span><strong>{nextCycle ? '27' : '48'}</strong><small>현장 검토 의견 반영</small></article><article className="is-highlight"><Sparkles size={18} /><span>새 결함 패턴</span><strong>1</strong><small>{nextCycle ? '야간 조도 취약 유형' : '기존 운영 모델 미검출 유형'}</small></article></div>
      <div className="source-lineage"><span>{nextCycle ? 'PRODUCTION SIGNAL' : 'IMAGE CATALOG'}</span><i /><strong>PRJ000212-D-0001:{version}</strong><i /><span>READY FOR TRAINING</span></div>
    </section>
  </main>;
}

function TrainStage({ onRun, dataVersion }: { onRun: () => void; dataVersion: 'v13' | 'v14' }) {
  const [resolved, setResolved] = useState(true);
  return <main className="vision-demo-page">
    <DemoPageHeader eyebrow="CODE ASSET / TRAINING" title="YOLO12 용접 결함 표준 학습" description="검증된 학습 코드와 표준 실행 환경을 데이터셋 ID 하나로 재현합니다." />
    <section className="train-workbench">
      <div className="train-code-panel"><header><span><FileCode2 size={16} /> yolo12_weld_training.ipynb</span><b>v1.4.0 · 운영 승인</b></header><pre><code>{`dataset = prizm.data.load(DATASET_ID)\n\nmodel = YOLO("yolo12m.pt")\nmodel.train(\n    data=dataset.manifest,\n    epochs=80,\n    imgsz=1024,\n    project=PROJECT_ID\n)`}</code></pre><footer><span>소속 과제</span><strong>용접 품질 고도화</strong><span>출력</span><strong>MODEL CANDIDATE</strong></footer></div>
      <aside className="train-launch-panel"><span className="demo-section-label">QUICK TRAIN</span><h2>데이터셋 ID로 학습 준비</h2><label><span>데이터셋 ID</span><div><Database size={16} /><input value="PRJ000212-D-0001" readOnly /><button type="button" onClick={() => setResolved(true)}><Search size={14} /> 확인</button></div></label>{resolved && <div className="dataset-resolution"><header><Check size={15} /><span><strong>최신 버전을 확인했습니다</strong><small>실행 시점에 {dataVersion}으로 고정됩니다.</small></span><b>{dataVersion}</b></header><dl><div><dt>데이터</dt><dd>{dataVersion === 'v14' ? '43,466' : '43,180'} images</dd></div><div><dt>라벨</dt><dd>Labels verified</dd></div><div><dt>실행 환경</dt><dd>pytorch-2.4-yolo12-py311-cu124</dd></div><div><dt>실행 자원</dt><dd>ml.a100.20gb</dd></div></dl></div>}<button type="button" className="train-run-button" onClick={onRun}><Play size={15} fill="currentColor" /> 학습 시작</button><p>코드·데이터·환경 버전이 실행 이력에 함께 보존됩니다.</p></aside>
    </section>
    <section className="automation-proof"><span>DATASET ID</span><ArrowRight size={15} /><strong>데이터 해석</strong><ArrowRight size={15} /><strong>환경 재현</strong><ArrowRight size={15} /><strong>GPU 할당</strong><ArrowRight size={15} /><span>MODEL CANDIDATE</span></section>
  </main>;
}

function RunStage({ onNext }: { onNext: () => void }) {
  const [progress, setProgress] = useState(36);
  useEffect(() => { if (progress >= 100) return; const timer = window.setInterval(() => setProgress((value) => Math.min(100, value + 4)), 900); return () => window.clearInterval(timer); }, [progress]);
  const complete = progress >= 100;
  return <main className="vision-demo-page">
    <DemoPageHeader eyebrow="PIPELINE RUN / RUN-27018" title="YOLO12 용접 결함 모델 학습" description="Airflow 파이프라인에서 데이터 연결부터 모델 등록까지 실행 중입니다." action={!complete ? <button type="button" className="vision-secondary-button" onClick={() => setProgress(100)}>완료 결과 불러오기</button> : <button type="button" className="vision-primary-button" onClick={onNext}>현장 이미지로 평가 <ArrowRight size={14} /></button>} />
    <section className="demo-run-card"><header><div><span className={complete ? 'demo-live-dot is-complete' : 'demo-live-dot'} /><span><strong>{complete ? '학습 및 후보 모델 등록 완료' : '모델 학습 중'}</strong><small>{complete ? 'PRJ000212-M-0001:2.5.0-rc1' : 'Epoch 31 / 80 · 예상 완료 16:05'}</small></span></div><b>{progress}%</b></header><div className="demo-run-progress"><i style={{ width: `${progress}%` }} /></div><div className="demo-run-stages">{['실행 환경 준비','데이터 v13 연결','YOLO12 학습','모델 검증','후보 모델 등록'].map((label, index) => { const threshold = [5,18,35,86,100][index]; return <span className={progress >= threshold ? 'is-done' : progress >= threshold - 20 ? 'is-current' : ''} key={label}>{progress >= threshold ? <Check size={13} /> : <Clock3 size={13} />}{label}</span>; })}</div></section>
    <div className="demo-run-grid"><section className="demo-log-panel"><header><span>LIVE PIPELINE LOG</span><b>Airflow · vision_train_v4</b></header><pre>{`[14:22:01] DAG accepted · RUN-27018\n[14:22:08] PRJ000212-D-0001:v13 resolved\n[14:22:12] Dataset quality checks passed (12/12)\n[14:22:21] Runtime pytorch-2.4-yolo12-py311-cu124 prepared\n[14:22:34] Training started · NVIDIA A100 20GB\n[14:51:20] Epoch 31/80 · mAP50 0.946 · loss 0.132\n${complete ? '[16:02:48] Training completed · mAP50 0.971\n[16:03:10] Candidate PRJ000212-M-0001:2.5.0-rc1 registered' : '[14:51:21] Streaming metrics...'}`}</pre></section><aside className="demo-run-context"><span>IMMUTABLE SNAPSHOT</span><dl><div><dt>Dataset</dt><dd>PRJ000212-D-0001:v13</dd></div><div><dt>Code</dt><dd>PRJ000212-C-0001:v1.4.0</dd></div><div><dt>Environment</dt><dd>pytorch-2.4-yolo12-py311-cu124</dd></div><div><dt>Resource</dt><dd>ml.a100.20gb</dd></div><div><dt>Commit</dt><dd>8f3a1c7</dd></div></dl></aside></div>
  </main>;
}

export function ModelEvaluationDetail({ onPromote, onBack }: { onPromote: () => void; onBack?: () => void }) {
  const [overlay, setOverlay] = useState<'gt' | 'old' | 'new'>('new');
  const [promoteOpen, setPromoteOpen] = useState(false);
  return <main className="vision-demo-page">
    {onBack && <button type="button" className="monitor-back" onClick={onBack}><ArrowLeft size={14} /> 평가 목록</button>}
    <DemoPageHeader eyebrow="MODEL EVALUATION / FIELD REVIEW" title="현장 이미지로 성능 평가" description="전문 지표를 몰라도 기존 모델과 신규 모델의 판정 차이를 실제 검사 이미지로 확인합니다." />
    <section className="evaluation-comparison">
      <header><div className="evaluation-filter"><button type="button">놓친 불량 <b>25건 개선</b></button><button type="button">과검출 <b>33건 개선</b></button><button type="button">판정 변경 <b>71건</b></button></div><div className="overlay-switch">{(['gt','old','new'] as const).map((item) => <button type="button" className={overlay === item ? 'is-active' : ''} onClick={() => setOverlay(item)} key={item}>{item === 'gt' ? 'Labels' : item === 'old' ? '기존 모델' : '신규 모델'}</button>)}</div></header>
      <div className="evaluation-images"><article><div className="evaluation-image"><Image src="/weld-inspection-defect.png" alt="기존 운영 모델 평가 이미지" fill sizes="50vw" /><span className="missed-tag">MISSED</span></div><footer><span>현재 운영 모델 · v2.4.1</span><strong>정상 판정</strong><small>결함 확률 18.4%</small></footer></article><article className="is-candidate"><div className="evaluation-image"><Image src="/weld-inspection-defect.png" alt="신규 후보 모델 평가 이미지" fill sizes="50vw" />{overlay !== 'old' && <span className={overlay === 'gt' ? 'detection-box is-gt' : 'detection-box'}><i>{overlay === 'gt' ? 'Label · 미세 크랙' : '미세 크랙 · 96.8%'}</i></span>}</div><footer><span>신규 후보 모델 · v2.5.0-rc1</span><strong>미세 크랙 검출</strong><small>결함 확률 96.8%</small></footer></article></div>
    </section>
    <section className="field-metrics"><header><span>FIELD LANGUAGE METRICS</span><h2>현장 기준 비교 결과</h2></header><div><article><span>놓친 불량</span><strong><del>37</del> 12건</strong><small>25건 감소</small></article><article><span>정상인데 불량 판정</span><strong><del>84</del> 51건</strong><small>33건 감소</small></article><article><span>미세 크랙 검출률</span><strong><del>71.2</del> 94.6%</strong><small>+23.4%p</small></article><article className="has-tradeoff"><span>이미지당 판정 시간</span><strong><del>24</del> 26ms</strong><small>+2ms · 기준 내</small></article></div><footer><ShieldCheck size={18} /><span><strong>운영 승격 기준 7개 통과</strong><small>WELD-DETECTION-GATE:v3 · 평가 데이터 EVAL-USN-WELD-009:v5</small></span><button type="button" onClick={() => setPromoteOpen(true)}><Rocket size={15} /> 운영 버전으로 승격</button></footer></section>
    <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}><DialogContent className="promotion-dialog"><DialogHeader><span>PRODUCTION PROMOTION</span><DialogTitle>운영 모델 승격</DialogTitle><DialogDescription>검증 결과와 현장 판단을 승인 기록으로 남깁니다.</DialogDescription></DialogHeader><div className="promotion-body"><div><span>현재 운영 버전</span><strong>Weld Detector v2.4.1</strong></div><ArrowRight size={18} /><div className="is-new"><span>승격 대상</span><strong>Weld Detector v2.5.0-rc1</strong></div></div><div className="promotion-checks"><span><Check size={13} /> 필수 평가 기준 7 / 7</span><span><Check size={13} /> 현장 이미지 검토 완료</span><span><Check size={13} /> 추론 지연 기준 충족</span></div><label className="promotion-opinion"><span>승인 의견</span><textarea defaultValue="미세 크랙 검출 개선과 현장 오검출 감소를 확인했습니다." /></label><DialogFooter><button type="button" onClick={() => setPromoteOpen(false)}>취소</button><button type="button" className="promotion-confirm" onClick={() => { setPromoteOpen(false); onPromote(); }}><ShieldCheck size={14} /> 운영 버전 승인</button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function ModelStage({ onNext }: { onNext: () => void }) {
  const lineage = [{ icon: Database, type: 'DATA', title: 'PRJ000212-D-0001', meta: 'v13' }, { icon: FileCode2, type: 'CODE', title: 'YOLO12 Weld Training', meta: 'v1.4.0' }, { icon: Workflow, type: 'RUN', title: 'RUN-27018', meta: 'SUCCESS' }, { icon: ShieldCheck, type: 'EVALUATION', title: 'Field Review', meta: '7 / 7 PASS' }, { icon: Box, type: 'MODEL', title: 'Weld Detector', meta: 'v2.5.0' }];
  return <main className="vision-demo-page"><DemoPageHeader eyebrow="MODEL ASSET / PRODUCTION" title="Weld Detector v2.5.0" description="승인된 후보 모델이 운영 버전으로 등록되고 모든 생성 근거가 함께 보존됩니다." action={<button type="button" className="vision-primary-button" onClick={onNext}><Activity size={15} /> 운영 상태 모니터링 <ArrowRight size={14} /></button>} /><section className="model-release-hero"><div className="model-cube"><Box size={42} /><span>PRODUCTION</span></div><div><span className="demo-project-label">용접 품질 고도화</span><h2>PRJ000212-M-0001</h2><p>YOLO12 기반 용접 비드 결함 검출 모델</p><div className="model-badges"><span><Check size={12} /> 운영 승인</span><span>v2.5.0</span><span>2026.09.11 16:12</span></div></div><dl><div><dt>mAP50</dt><dd>0.971</dd></div><div><dt>미세 크랙 검출</dt><dd>94.6%</dd></div><div><dt>추론 지연</dt><dd>26ms</dd></div></dl></section><section className="model-lineage"><header><span>END-TO-END LINEAGE</span><h2>운영 모델의 근거</h2><p>어떤 데이터와 코드로 만들고, 누가 무엇을 보고 승인했는지 추적합니다.</p></header><div>{lineage.map((node, index) => <article key={node.type}><node.icon size={19} /><span>{node.type}</span><strong>{node.title}</strong><small>{node.meta}</small>{index < lineage.length - 1 && <i><ChevronRight size={14} /></i>}</article>)}</div></section><section className="model-next-action"><Globe2 size={20} /><span><strong>울산 차체 2라인 운영 대상</strong><small>승격된 모델은 배포 승인 후 글로벌 거점으로 확산할 수 있습니다.</small></span><button type="button">배포 요청 <ArrowRight size={14} /></button></section></main>;
}

const factories = [
  ['울산공장','대한민국','38','142','주의'], ['아산공장','대한민국','21','86','정상'], ['전주공장','대한민국','14','51','정상'], ['HMA','미국','19','74','정상'], ['HMMA','미국','17','63','정상'], ['HMGMA','미국','11','38','정상'], ['HMMC','체코','13','45','정상'], ['HMI','인도','16','57','정상'],
];

function GlobalMonitor({ onFactory }: { onFactory: () => void }) {
  return <><DemoPageHeader eyebrow="GLOBAL AI OPERATIONS" title="전사 제조 AI 운용 현황" description="전 세계 공장의 모델 상태와 성과, 대응이 필요한 변화를 한 화면에서 확인합니다." /><section className="global-monitor-hero"><div className="global-monitor-kpis"><article><span>운영 공장</span><strong>8</strong><small>3개 권역 연결</small></article><article><span>운영 모델</span><strong>556</strong><small>오늘 +7</small></article><article><span>일 평균 추론</span><strong>18.4M</strong><small>정상 처리 99.96%</small></article><article><span>품질 비용 절감</span><strong>₩184.2억</strong><small>2026 누적 추정</small></article></div><div className="global-trend"><header><span>GLOBAL INFERENCE</span><strong>최근 24시간</strong></header><svg viewBox="0 0 640 120" preserveAspectRatio="none" aria-label="글로벌 추론량 추이"><path d="M0 94 C70 88 95 64 150 70 S250 38 320 51 S410 25 470 39 S570 16 640 22" /><path className="area" d="M0 94 C70 88 95 64 150 70 S250 38 320 51 S410 25 470 39 S570 16 640 22 L640 120H0Z" /></svg><footer><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>현재</span></footer></div></section><section className="factory-network"><header><div><span>CONNECTED FACTORIES</span><h2>공장별 운용 상태</h2></div><span className="monitor-normal"><i /> 7 정상</span><span className="monitor-warning"><i /> 1 주의</span></header><div>{factories.map(([name,country,projects,models,status]) => <button type="button" className={[name === '울산공장' ? 'is-focus' : '', status === '주의' ? 'has-warning' : ''].filter(Boolean).join(' ')} onClick={name === '울산공장' ? onFactory : undefined} key={name}><span className="factory-icon"><Factory size={18} /></span><span><strong>{name}</strong><small><MapPin size={11} /> {country}</small></span><span><b>{projects}</b> 과제</span><span><b>{models}</b> 모델</span><em><i />{status}</em><ChevronRight size={15} /></button>)}</div></section></>;
}

function FactoryMonitor({ onBack, onModel }: { onBack: () => void; onModel: () => void }) {
  return <><button type="button" className="monitor-back" onClick={onBack}><ArrowLeft size={14} /> 전사 현황</button><DemoPageHeader eyebrow="FACTORY OPERATIONS / ULSAN" title="울산공장 제조 AI 현황" description="공장 단위의 과제 성과와 운영 모델 상태를 공정별로 확인합니다." /><section className="factory-overview"><div><span>운영 과제</span><strong>38</strong><small>이달 신규 3</small></div><div><span>운영 모델</span><strong>142</strong><small>정상 139 · 주의 3</small></div><div><span>오늘 추론</span><strong>4.82M</strong><small>오류율 0.03%</small></div><div><span>품질 손실 예방</span><strong>₩42.6억</strong><small>2026 누적 추정</small></div></section><div className="factory-detail-grid"><section className="factory-projects"><header><span>ACTIVE PROJECTS</span><h2>주요 과제</h2></header><button type="button" className="is-selected" onClick={onModel}><span className="project-rank">01</span><span><strong>용접 품질 고도화</strong><small>차체 · 용접 / 2라인</small></span><b>12 models</b><em>₩8.4억</em><ChevronRight size={15} /></button><button type="button"><span className="project-rank">02</span><span><strong>프레스 균열 조기감지</strong><small>프레스 · 성형 / 1라인</small></span><b>8 models</b><em>₩6.1억</em><ChevronRight size={15} /></button><button type="button"><span className="project-rank">03</span><span><strong>배터리 셀 이상 탐지</strong><small>배터리 · 검사 / 3라인</small></span><b>6 models</b><em>₩4.7억</em><ChevronRight size={15} /></button></section><section className="factory-alerts"><header><span>NEEDS ATTENTION</span><h2>확인이 필요한 변화</h2></header><button type="button" className="is-warning is-clickable" onClick={onModel}><TriangleAlert size={18} /><span><strong>Weld Detector · 260911-0003</strong><small>야간 조도에서 미세 크랙 검출률 기준 이탈</small></span><b>확인</b></button><article><Activity size={18} /><span><strong>Battery Cell Detector v1.8.2</strong><small>처리 지연 P95 기준 근접</small></span><b>관찰</b></article></section></div></>;
}

function ModelMonitor({ onBack }: { onBack: () => void }) {
  return <><button type="button" className="monitor-back" onClick={onBack}><ArrowLeft size={14} /> 울산공장</button><DemoPageHeader eyebrow="MODEL MONITORING / INCIDENT" title="Weld Detector · 성능 이상 감지" description="운영 신호를 업무로 전환하고, 현장과 모델 검토가 끝날 때까지 조치 과정을 추적합니다." action={<Link className="vision-primary-button" href="/work/tasks?task=TASK-260912-017"><CheckSquare size={15} /> 나의 작업에서 확인 <ArrowRight size={14} /></Link>} /><section className="monitor-incident-banner"><div className="monitor-incident-icon"><TriangleAlert size={22} /></div><div><span>INC-260912-0042 · 09:12 자동 감지</span><h2>야간 조도 구간에서 미세 크랙 미검출이 증가했습니다</h2><p>최근 60분의 현장 재검사 결과와 모델 판정을 비교해 검출률이 운영 기준 아래로 내려간 것을 확인했습니다.</p></div><dl><div><dt>영향 공정</dt><dd>울산 차체 2라인</dd></div><div><dt>운영 버전</dt><dd>260911-0003</dd></div><div><dt>우선순위</dt><dd>높음 · 4시간 이내</dd></div></dl></section><section className="model-health-hero has-incident"><div className="health-score"><CircleGauge size={32} /><span>MODEL HEALTH</span><strong>68</strong><small>조치 필요</small></div><div className="health-kpis"><article><span>미세 크랙 검출률</span><strong>88.6%</strong><small>운영 기준 92.0%</small></article><article><span>저신뢰 이미지</span><strong>286</strong><small>자동 선별 완료</small></article><article><span>미검출 확인</span><strong>47건</strong><small>현장 재검사 기준</small></article><article><span>알림 대상</span><strong>6명</strong><small>ML · 공정 · 품질</small></article></div></section><div className="model-monitor-grid"><section className="drift-panel"><header><div><span>PERFORMANCE SIGNAL</span><h2>미세 크랙 검출률 변화</h2></div><b>기준 이탈</b></header><svg viewBox="0 0 640 180" preserveAspectRatio="none" aria-label="미세 크랙 검출률 변화"><path className="threshold" d="M0 62H640" /><path className="baseline" d="M0 45 C90 49 150 43 220 48 S350 44 430 47 S540 43 640 46" /><path className="current" d="M0 48 C90 46 150 51 220 55 S350 68 430 82 S540 112 640 126" /></svg><footer><span><i className="baseline" /> 운영 기준</span><span><i className="current" /> 현재 성능</span><b>야간 조도 영향 +18.4%</b></footer></section><section className="impact-panel incident-evidence"><header><span>INCIDENT EVIDENCE</span><h2>판정 불일치</h2></header><div className="incident-evidence-image"><Image src="/weld-inspection-defect.png" alt="미세 크랙 미검출 사례" fill sizes="32vw" /><span>AI 정상 · 82.4%</span><b>현장 판정 · 미세 크랙</b></div></section></div><IncidentProcess compact /><section className="closed-loop-card incident-loop-card"><div className="closed-loop-icon"><RefreshCw size={25} /></div><div><span>CLOSED-LOOP ACTION</span><h2>두 담당자의 확인이 끝나면 개선 데이터 생성을 시작합니다</h2><p>ML 엔지니어에게 원인 확인 작업이 배정됐고, 공정 엔지니어에게 현장 판정 확인 요청이 동시에 전달됐습니다.</p><div><span>ML 검토 · 대기</span><span>공정 검토 · 진행 중</span><span>결과 메일 · 대기</span></div></div><Link href="/work/tasks?task=TASK-260912-017">작업 열기 <ArrowRight size={14} /></Link></section></>;
}

function IncidentProcess({ compact = false }: { compact?: boolean }) {
  return <section className={compact ? 'incident-process is-compact' : 'incident-process'}><header><div><span>RESPONSE WORKFLOW</span><h2>이상 감지 대응 프로세스</h2></div><p>두 검토가 모두 완료되어야 다음 단계가 열립니다.</p></header><div className="incident-process-flow"><article className="process-start"><i><TriangleAlert size={18} /></i><span>자동 감지</span><strong>성능 기준 이탈</strong><small>09:12 · 규칙 MON-17</small></article><span className="process-line" /><i className="process-gateway">+</i><div className="process-parallel"><article><i><UserRound size={17} /></i><span>ML 엔지니어</span><strong>모델·데이터 원인 확인</strong><small>이학선 · 작업 대기</small><em>나의 작업</em></article><article><i><Factory size={17} /></i><span>공정 엔지니어</span><strong>실물·설비 조건 확인</strong><small>울산 차체품질 · 진행 중</small><em>확인 요청</em></article></div><i className="process-gateway is-merge">+</i><span className="process-line" /><article className="process-end"><i><Mail size={18} /></i><span>자동 결과 공유</span><strong>관계자 메일 발송</strong><small>두 확인 완료 후 발송</small></article></div></section>;
}

function MonitorStage({ level, onLevel }: { level: MonitorLevel; onLevel: (level: MonitorLevel) => void }) {
  return <main className="vision-demo-page monitor-demo-page">{level === 'global' ? <GlobalMonitor onFactory={() => onLevel('factory')} /> : level === 'factory' ? <FactoryMonitor onBack={() => onLevel('global')} onModel={() => onLevel('model')} /> : <ModelMonitor onBack={() => onLevel('factory')} />}</main>;
}

export function VisionMlopsDemo({ initialStage = 'data', onStageChange, onExit }: { initialStage?: DemoStage; onStageChange?: (stage: DemoStage) => void; onExit: () => void }) {
  const [stage, setStage] = useState<DemoStage>(initialStage);
  const [monitorLevel, setMonitorLevel] = useState<MonitorLevel>('global');
  const nextCycle = false;
  const changeStage = (next: DemoStage) => { setStage(next); onStageChange?.(next); if (next === 'monitor') setMonitorLevel('global'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <div className="vision-demo-shell"><DemoJourney stage={stage} onChange={changeStage} onExit={onExit} />{stage === 'data' ? <DataStage nextCycle={nextCycle} onNext={() => changeStage('train')} /> : stage === 'train' ? <TrainStage dataVersion={nextCycle ? 'v14' : 'v13'} onRun={() => changeStage('run')} /> : stage === 'run' ? <RunStage onNext={() => changeStage('evaluate')} /> : stage === 'evaluate' ? <ModelEvaluationDetail onPromote={() => changeStage('model')} /> : stage === 'model' ? <ModelStage onNext={() => changeStage('monitor')} /> : <MonitorStage level={monitorLevel} onLevel={(level) => { setMonitorLevel(level); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}</div>;
}
