'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  Box, Check, ChevronDown, Clock3, Copy, Cpu, Gauge, Layers3, MemoryStick,
  Plus, Search, ShieldCheck, SlidersHorizontal,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';

type ResourceMode = 'compute' | 'environment';

const computeProfiles = [
  { id: 'RES-CPU-S', name: 'ml.c4.large', type: 'CPU', cpu: '4 vCPU', memory: '16 GB', gpu: '—', use: '데이터 전처리 · 경량 분석', available: '28 / 32', utilization: 41, queue: '즉시', tone: 'cpu' },
  { id: 'RES-CPU-L', name: 'ml.c16.4xlarge', type: 'CPU', cpu: '16 vCPU', memory: '64 GB', gpu: '—', use: '대용량 전처리 · Tabular 학습', available: '10 / 16', utilization: 58, queue: '즉시', tone: 'cpu' },
  { id: 'RES-A100-10', name: 'ml.a100.10gb', type: 'GPU', cpu: '8 vCPU', memory: '32 GB', gpu: 'A100 · 10 GB', use: '개발 검증 · 경량 Vision 학습', available: '9 / 16', utilization: 63, queue: '약 3분', tone: 'gpu' },
  { id: 'RES-A100-20', name: 'ml.a100.20gb', type: 'GPU', cpu: '16 vCPU', memory: '64 GB', gpu: 'A100 · 20 GB', use: '표준 Vision 학습 · YOLO12', available: '6 / 12', utilization: 71, queue: '약 6분', tone: 'gpu', recommended: true },
  { id: 'RES-A100-48', name: 'ml.a100.48gb', type: 'GPU', cpu: '32 vCPU', memory: '128 GB', gpu: 'A100 · 48 GB', use: '고해상도 학습 · 대형 모델', available: '2 / 6', utilization: 82, queue: '약 18분', tone: 'gpu' },
];

const environmentImages = [
  { id: 'pytorch-yolo12', name: 'pytorch-2.4-yolo12-py311-cu124', os: 'Ubuntu 22.04', workload: 'YOLO12 · GPU', tag: '2.4.0-gpu-py311-cu124-ubuntu22.04-prizm-v1.4', python: '3.11', cuda: '12.4', framework: 'PyTorch 2.4.0', packages: [['torch','2.4.0'],['torchvision','0.19.0'],['ultralytics','8.3.14'],['opencv-python-headless','4.10.0.84'],['numpy','1.26.4'],['pandas','2.2.2'],['PyYAML','6.0.2']], size: '12.8 GB', scan: '오늘 09:18', digest: 'sha256:8f3a…1c7', status: '운영', recommended: true },
  { id: 'pytorch-vision', name: 'pytorch-2.4-vision-py312-cu124', os: 'Ubuntu 22.04', workload: 'Vision · GPU', tag: '2.4.0-gpu-py312-cu124-ubuntu22.04-prizm-v1.2', python: '3.12', cuda: '12.4', framework: 'PyTorch 2.4.0', packages: [['torch','2.4.0'],['torchvision','0.19.0'],['torchaudio','2.4.0'],['albumentations','1.4.14'],['opencv-python-headless','4.10.0.84'],['numpy','1.26.4'],['scipy','1.14.1']], size: '11.6 GB', scan: '어제 16:42', digest: 'sha256:bd71…2e4', status: '운영' },
  { id: 'tensorflow', name: 'tensorflow-2.18-py310-cu122', os: 'Ubuntu 22.04', workload: 'TensorFlow · GPU', tag: '2.18.0-gpu-py310-cu122-ubuntu22.04-prizm-v1.0', python: '3.10', cuda: '12.2', framework: 'TensorFlow 2.18.0', packages: [['tensorflow','2.18.0'],['keras','3.7.0'],['tensorboard','2.18.0'],['numpy','1.26.4'],['pandas','2.2.2']], size: '10.4 GB', scan: '3일 전', digest: 'sha256:179c…aa8', status: '운영' },
  { id: 'tensorrt', name: 'tensorrt-10.2-py310-cu124', os: 'Ubuntu 22.04', workload: 'TensorRT · GPU', tag: '10.2.0-gpu-py310-cu124-ubuntu22.04-prizm-v1.1', python: '3.10', cuda: '12.4', framework: 'TensorRT 10.2', packages: [['torch','2.4.0'],['tensorrt','10.2.0'],['onnxruntime-gpu','1.19.0'],['tritonclient','2.49.0'],['numpy','1.26.4'],['fastapi','0.112.2']], size: '8.9 GB', scan: '4일 전', digest: 'sha256:62ae…9b1', status: '검증 완료' },
  { id: 'python-vision', name: 'python-vision-py312-cpu', os: 'Ubuntu 22.04', workload: 'OpenCV · CPU', tag: '3.12-cpu-py312-ubuntu22.04-prizm-v1.3', python: '3.12', cuda: '—', framework: 'OpenCV 4.10', packages: [['opencv-python-headless','4.10.0.84'],['numpy','1.26.4'],['pillow','10.4.0'],['scikit-image','0.24.0'],['pandas','2.2.2'],['jupyterlab','4.2.5']], size: '2.7 GB', scan: '오늘 08:51', digest: 'sha256:c58d…e32', status: '운영' },
];

function ComputeCard({ profile }: { profile: (typeof computeProfiles)[number] }) {
  return <article className={`resource-profile-card tone-${profile.tone}`}>
    <header><span className="resource-card-icon">{profile.type === 'GPU' ? <Gauge size={20} /> : <Cpu size={20} />}</span><div><span>{profile.id}</span><h2>{profile.name}</h2></div>{profile.recommended && <b className="resource-recommended"><Check size={12} /> 권장</b>}</header>
    <div className="resource-spec-grid"><span><Cpu size={15} /><small>CPU</small><strong>{profile.cpu}</strong></span><span><MemoryStick size={15} /><small>MEM</small><strong>{profile.memory}</strong></span><span><Layers3 size={15} /><small>GPU</small><strong>{profile.gpu}</strong></span></div>
    <p>{profile.use}</p>
    <div className="resource-capacity"><div><span>현재 가용</span><strong>{profile.available}</strong></div><div className="resource-capacity-meter"><i style={{ width: `${profile.utilization}%` }} /></div><footer><span>사용률 {profile.utilization}%</span><span><Clock3 size={12} /> 대기 {profile.queue}</span></footer></div>
    <button type="button">상세 현황</button>
  </article>;
}

function EnvironmentRow({ image, onDetails }: { image: (typeof environmentImages)[number]; onDetails: () => void }) {
  return <article className="runtime-image-row">
    <button type="button" className="runtime-row-main" onClick={onDetails}><span className="runtime-list-identity"><i><Box size={18} /></i><span><strong>{image.name}</strong><small>{image.workload}{image.recommended ? ' · 권장' : ''}</small></span></span><span className="runtime-list-value"><small>Python</small><strong>{image.python}</strong></span><span className="runtime-list-value"><small>CUDA</small><strong>{image.cuda}</strong></span><span className="runtime-list-value"><small>OS</small><strong>{image.os}</strong></span><span className="runtime-list-packages"><strong>{image.packages.slice(0, 2).map(([name]) => name).join(' · ')}</strong><small>외 {Math.max(0, image.packages.length - 2)}개</small></span><span className={image.status === '운영' ? 'runtime-status is-live' : 'runtime-status'}><i />{image.status}</span><span className="runtime-list-updated"><strong>{image.scan}</strong><small>{image.size}</small></span></button><button type="button" className="runtime-row-action" onClick={onDetails}>상세</button>
  </article>;
}

export function ResourceManagementWorkspace({ mode }: { mode: ResourceMode }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('전체');
  const [selectedImage, setSelectedImage] = useState<(typeof environmentImages)[number] | null>(null);
  const isCompute = mode === 'compute';
  const filteredCompute = useMemo(() => computeProfiles.filter((item) => (filter === '전체' || item.type === filter) && [item.name, item.cpu, item.memory, item.gpu, item.use].join(' ').toLowerCase().includes(query.toLowerCase())), [filter, query]);
  const filteredImages = useMemo(() => environmentImages.filter((item) => [item.name, item.os, item.workload, item.id, item.tag, item.python, item.cuda, item.framework, ...item.packages.flat()].join(' ').toLowerCase().includes(query.toLowerCase())), [query]);

  return <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
    <PortalNavigation screen="catalog" activeNavigation={{ group: '자원관리', child: isCompute ? '실행 자원 관리' : '실행 환경 관리' }} />
    <div className="app-shell code-assets-shell">
      <CodeAssetsTopbar />
      <PortalWorkspaceTabs current={isCompute ? 'execution-resources' : 'execution-environments'} />
      <main className="code-assets-page resource-management-page">
        <section className="code-page-heading resource-page-heading"><div><span className="code-page-kicker">RESOURCE MANAGEMENT / {isCompute ? 'COMPUTE PROFILES' : 'RUNTIME IMAGES'}</span><h1>{isCompute ? '실행 자원 관리' : '실행 환경 관리'}</h1><p>{isCompute ? '코드 실행에 할당할 CPU·메모리·GPU 규격과 실시간 가용 상태를 관리합니다.' : '검증된 Docker 이미지를 표준 실행 환경으로 등록하고 코드 자산과 연결합니다.'}</p></div><button className="code-primary-action" type="button"><Plus size={16} /> {isCompute ? '실행 자원 등록' : '실행 환경 등록'}</button></section>

        <section className="resource-summary-strip">
          {isCompute ? <><div><span>운영 프로파일</span><strong>5</strong><small>CPU 2 · GPU 3</small></div><div><span>가용 GPU 슬롯</span><strong>17 / 34</strong><small>A100 실행 할당</small></div><div><span>현재 사용률</span><strong>68%</strong><small>최근 15분 평균</small></div><div><span>평균 대기</span><strong>7분</strong><small>정상 범위</small></div></> : <><div><span>운영 이미지</span><strong>5</strong><small>Python 3.10 · 3.11 · 3.12</small></div><div><span>보안 검증</span><strong>5 / 5</strong><small>취약점 기준 통과</small></div><div><span>연결 코드</span><strong>184</strong><small>활성 버전 기준</small></div><div><span>최근 업데이트</span><strong>오늘</strong><small>pytorch-2.4-yolo12-py311-cu124</small></div></>}
        </section>

        <section className="resource-toolbar"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isCompute ? '자원명, GPU, 용도로 검색' : '이미지명, 프레임워크, 패키지로 검색'} /></label>{isCompute && <div className="resource-filter-tabs">{['전체', 'CPU', 'GPU'].map((item) => <button type="button" className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>}<button type="button" className="resource-filter-button"><SlidersHorizontal size={14} /> 상세 필터 <ChevronDown size={13} /></button></section>

        <section className="resource-results"><header><div><strong>{isCompute ? `실행 자원 ${filteredCompute.length}개` : `Docker 이미지 ${filteredImages.length}개`}</strong><span>{isCompute ? '자원 규격과 현재 할당 가능 여부를 함께 표시합니다.' : '운영 승인을 받은 최신 이미지가 먼저 표시됩니다.'}</span></div><span className="resource-live"><i /> 30초 전 동기화</span></header>
          {isCompute ? <div className="resource-profile-grid">{filteredCompute.map((profile) => <ComputeCard profile={profile} key={profile.id} />)}</div> : <div className="runtime-image-list"><div className="runtime-list-head"><span>실행 환경</span><span>Python</span><span>CUDA</span><span>운영체제</span><span>기본 패키지</span><span>상태</span><span>최근 검증</span><span /></div>{filteredImages.map((image) => <EnvironmentRow image={image} onDetails={() => setSelectedImage(image)} key={`${image.id}-${image.tag}`} />)}</div>}
        </section>
      </main>
    </div>
    <Dialog open={Boolean(selectedImage)} onOpenChange={(open) => { if (!open) setSelectedImage(null); }}>
      <DialogContent className="runtime-detail-dialog">
        {selectedImage && <><DialogHeader className="runtime-detail-header"><span>RUNTIME IMAGE / {selectedImage.id}</span><DialogTitle>{selectedImage.name}</DialogTitle><DialogDescription>{selectedImage.workload}</DialogDescription></DialogHeader><div className="runtime-detail-body"><section className="runtime-image-identity"><div><span>IMAGE TAG</span><code>{selectedImage.tag}</code></div><button type="button" aria-label="이미지 태그 복사"><Copy size={15} /></button></section><div className="runtime-detail-facts"><div><span>운영체제</span><strong>{selectedImage.os}</strong></div><div><span>Python</span><strong>{selectedImage.python}</strong></div><div><span>CUDA</span><strong>{selectedImage.cuda}</strong></div><div><span>프레임워크</span><strong>{selectedImage.framework}</strong></div><div><span>이미지 크기</span><strong>{selectedImage.size}</strong></div></div><section className="runtime-package-panel"><header><div><span>BASE PYTHON PACKAGES</span><h3>기본 Python 패키지</h3></div><b>{selectedImage.packages.length} packages</b></header><table><thead><tr><th>패키지</th><th>버전</th><th>설치 범위</th></tr></thead><tbody>{selectedImage.packages.map(([name, version]) => <tr key={name}><td>{name}</td><td>{version}</td><td>Base</td></tr>)}</tbody></table></section><section className="runtime-security-row"><ShieldCheck size={18} /><div><strong>보안 검증 완료</strong><span>마지막 스캔 {selectedImage.scan} · Critical 취약점 0건</span></div><code>{selectedImage.digest}</code></section></div></>}
      </DialogContent>
    </Dialog>
  </SidebarProvider>;
}
