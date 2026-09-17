'use client';

import Image from 'next/image';
import { useState, type CSSProperties, type PointerEvent } from 'react';

const globalFactories = [
  { id: 'us', code: 'US', name: 'ALABAMA · GEORGIA', x: 754, y: 120 },
  { id: 'mx', code: 'MX', name: 'KIA MEXICO', x: 755, y: 151 },
  { id: 'br', code: 'BR', name: 'HMB', x: 796, y: 201 },
  { id: 'eu', code: 'CZ · SK', name: 'HMMC · KIA', x: 840, y: 105 },
  { id: 'tr', code: 'TR', name: 'HAOS', x: 867, y: 137 },
  { id: 'in', code: 'IN', name: 'CHENNAI · PUNE · AP', x: 899, y: 162 },
  { id: 'cn', code: 'CN', name: 'BEIJING · YANCHENG', x: 927, y: 134 },
  { id: 'kr', code: 'KR', name: 'HMC · KIA', x: 960, y: 119 },
  { id: 'asean', code: 'ID · SG', name: 'HMMI · HMGICS', x: 946, y: 187 },
];

const modelStreams = [
  { id: 'quality', code: '외관 품질 검사 AI', color: '#26C7E8', endX: 820, endY: 66, delay: '0s', factories: ['us', 'eu', 'cn', 'kr'] },
  { id: 'process', code: '공정 조건 최적화 AI', color: '#5C78FF', endX: 916, endY: 104, delay: '-1.1s', factories: ['eu', 'tr', 'in', 'kr'] },
  { id: 'asset', code: '설비 이상 예측 AI', color: '#35D5A3', endX: 970, endY: 165, delay: '-2.2s', factories: ['us', 'mx', 'br', 'eu', 'tr', 'in', 'cn', 'kr', 'asean'] },
  { id: 'energy', code: '에너지 사용량 최적화 AI', color: '#F6AF55', endX: 905, endY: 226, delay: '-3.3s', factories: ['kr', 'in', 'cn', 'asean'] },
  { id: 'supply', code: '공장 물류 흐름 최적화 AI', color: '#B983E8', endX: 808, endY: 270, delay: '-4.4s', factories: ['us', 'mx', 'br', 'cn', 'asean'] },
];

const factorySources = [
  { x: 43, y: 108, scale: 0.9 },
  { x: 103, y: 171, scale: 1.08 },
  { x: 49, y: 238, scale: 0.78 },
];

const kpis = [
  { label: '전체 제조 AI 과제', value: '128', meta: '이번 분기 +12' },
  { label: '운영 배포 모델', value: '556', meta: '정상 98.7%' },
  { label: '등록된 파이프라인', value: '512', meta: '운영 가능 96.4%' },
  { label: '24시간 추론', value: '2.48M', meta: '실시간 처리량' },
];

function FactoryGlyph({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="source-factory" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path className="source-factory-shell" d="M0 27V1l17 10V0l17 10V-9h10v36z" />
      <path className="source-factory-roof" d="M34 10L17 0v11L0 1" />
      <path className="source-factory-floor" d="M-5 27H49" />
      <rect x="7" y="17" width="5" height="5" />
      <rect x="19" y="17" width="5" height="5" />
      <rect x="31" y="17" width="5" height="5" />
    </g>
  );
}

export function PrizmFlowCanvas({ className = '', showKpis = true, interactive = true }: { className?: string; showKpis?: boolean; interactive?: boolean }) {
  const [activeStream, setActiveStream] = useState(modelStreams[0].id);
  const active = modelStreams.find((stream) => stream.id === activeStream) ?? modelStreams[0];

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty('--spot-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--spot-y', `${y * 100}%`);
    event.currentTarget.style.setProperty('--prism-x', `${(x - 0.5) * 4}px`);
    event.currentTarget.style.setProperty('--prism-y', `${(y - 0.5) * 2.5}px`);
  };

  return (
      <div className={`prism-canvas ${className}`.trim()} onPointerMove={interactive ? handlePointerMove : undefined}>
        <div className="canvas-caption">
          <span>ONE DATA PIPELINE</span>
          <i aria-hidden="true" />
          <strong>PRIZM GENERATES AI MODELS</strong>
          <i aria-hidden="true" />
          <span>GLOBAL MANUFACTURING</span>
        </div>

        <svg viewBox="0 0 1020 330" aria-labelledby="prizm-flow-title">
          <title id="prizm-flow-title">세계 공장의 데이터가 하나의 파이프라인으로 모여 프리즘을 통과하고 여러 제조 AI 모델로 분산되는 모습</title>
          <defs>
            <linearGradient id="darkPipeline" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7190AC" stopOpacity="0.26" /><stop offset="0.42" stopColor="#DDF7FF" stopOpacity="0.72" /><stop offset="1" stopColor="#FFFFFF" /></linearGradient>
            <linearGradient id="prismFront" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" /><stop offset="0.42" stopColor="#B6EBF5" stopOpacity="0.15" /><stop offset="1" stopColor="#54C7E0" stopOpacity="0.05" /></linearGradient>
            <linearGradient id="prismSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#BFEAF3" stopOpacity="0.04" /><stop offset="1" stopColor="#89DDF0" stopOpacity="0.23" /></linearGradient>
            <radialGradient id="darkPrismCore"><stop offset="0" stopColor="#C9F8FF" stopOpacity="0.86" /><stop offset="0.32" stopColor="#27C6E7" stopOpacity="0.3" /><stop offset="1" stopColor="#00AAD2" stopOpacity="0" /></radialGradient>
            <radialGradient id="earthBloom"><stop offset="0" stopColor="#3485AB" stopOpacity="0.34" /><stop offset="0.62" stopColor="#1C5273" stopOpacity="0.12" /><stop offset="1" stopColor="#07192D" stopOpacity="0" /></radialGradient>
            <filter id="darkSoftGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9" /></filter>
            <filter id="darkRayGlow" x="-30%" y="-150%" width="160%" height="400%"><feGaussianBlur stdDeviation="2.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="pipelineGlow" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="5" /></filter>
          </defs>

          <g className="source-factories">
            {factorySources.map((factory, index) => (
              <g key={`${factory.x}-${factory.y}`}>
                <FactoryGlyph {...factory} />
                <path className="source-conduit" d={`M ${factory.x + 48 * factory.scale} ${factory.y + 12 * factory.scale} C 165 ${factory.y + 12 * factory.scale}, 176 165, 230 165`} />
                <circle className="source-data-pulse" r="2.2"><animateMotion dur={`${4.2 + index * 0.55}s`} begin={`${index * -1.15}s`} repeatCount="indefinite" path={`M ${factory.x + 48 * factory.scale} ${factory.y + 12 * factory.scale} C 165 ${factory.y + 12 * factory.scale}, 176 165, 230 165`} /></circle>
              </g>
            ))}
            <path className="factory-baseline" d="M31 270H179" />
          </g>

          <g className="unified-pipeline">
            <circle className="pipeline-merge-ring" cx="230" cy="165" r="7" />
            <circle className="pipeline-merge-core" cx="230" cy="165" r="2.5" />
            <path className="pipeline-halo-dark" d="M230 165H422" />
            <path className="pipeline-line-dark" d="M230 165H422" />
            <circle className="pipeline-pulse" r="3.4"><animateMotion dur="2.8s" repeatCount="indefinite" path="M230 165H422" /></circle>
          </g>

          <g className="prizm-object-dark">
            <ellipse className="prism-floor-glow" cx="468" cy="270" rx="88" ry="8" />
            <circle className="prism-aura-dark" cx="468" cy="165" r="86" />
            <polygon className="prism-back-dark" points="440,68 538,165 440,262" />
            <polygon className="prism-side-dark" points="416,68 440,68 538,165 514,165" />
            <polygon className="prism-side-dark lower" points="416,262 440,262 538,165 514,165" />
            <polygon className="prism-face-dark" points="416,68 514,165 416,262" />
            <polygon className="prism-sheen-dark" points="416,68 451,103 431,235 416,262" />
            <path className="prism-edge-dark" d="M416 68H440L538 165 440 262H416" />
            <path className="prism-white-axis" d="M395 165H470" />
            <g className="prism-refraction">
              {modelStreams.map((stream, index) => <path key={stream.id} style={{ '--ray-color': stream.color } as CSSProperties} d={`M468 165 L520 ${153 + index * 6}`} />)}
            </g>
            <circle className="prism-core-dark" cx="505" cy="165" r="51" />
            <circle className="prism-flare-dark" cx="518" cy="165" r="5.5" />
          </g>

          <g className="earth-field">
            <circle className="earth-bloom" cx="845" cy="165" r="178" />
            <ellipse cx="845" cy="165" rx="154" ry="124" />
            <ellipse cx="845" cy="165" rx="62" ry="124" />
            <path d="M691 165H999M714 110H976M714 220H976" />
            <path className="continent" d="M699 75C708 62 725 57 740 61L750 55 765 59 773 70 788 72 798 83 790 95 780 99 786 110 778 124 768 132 762 145 752 141 744 128 734 121 729 106 715 99 707 87Z" />
            <path className="continent" d="M744 127C754 130 761 140 765 148L773 155 770 162 760 155 754 147 746 142Z" />
            <path className="continent" d="M795 64L812 55 827 65 823 87 810 98 796 89Z" />
            <path className="continent" d="M772 155C785 150 802 156 813 169 819 179 814 192 807 202 804 214 801 226 791 240L784 261 775 250 771 230 765 211 759 193 761 175Z" />
            <path className="continent" d="M830 103L838 96 847 98 852 106 847 113 853 119 844 125 834 120 827 113Z" />
            <path className="continent" d="M833 124C846 118 864 122 876 134L882 151 873 161 869 181 861 206 850 218 842 203 838 184 829 169 825 148Z" />
            <path className="continent" d="M846 92C864 78 889 75 912 79L939 75 966 82 984 94 977 106 962 110 956 123 944 126 934 139 922 137 914 151 904 153 895 141 883 138 877 128 865 124 854 115 850 104Z" />
            <path className="continent" d="M883 134L897 141 908 151 902 169 894 183 886 166 879 151Z" />
            <path className="continent" d="M914 149L926 153 933 164 943 167 950 177 941 181 931 175 922 177 915 169 905 165Z" />
            <path className="continent" d="M936 194C949 186 968 188 982 198L985 216 973 228 955 230 940 219 931 207Z" />
            <path className="continent continent-island" d="M973 143L978 132 982 143 978 154ZM858 214L862 224 858 237 854 225ZM990 230L994 239 990 247 987 238Z" />
            <path className="earth-orbit" d="M705 202C762 88 918 62 987 136" />
          </g>

          <g className="spectrum-field-dark">
            {modelStreams.map((stream) => {
              const isActive = stream.id === activeStream;
              const rayPath = `M 518 165 L ${stream.endX} ${stream.endY}`;
              return (
                <g
                  key={stream.id}
                  className={isActive ? 'spectrum-ray-dark is-active' : 'spectrum-ray-dark'}
                  style={{ '--ray-color': stream.color } as CSSProperties}
                  tabIndex={0}
                  aria-label={`${stream.code} 모델 네트워크 보기`}
                  onPointerEnter={() => setActiveStream(stream.id)}
                  onFocus={() => setActiveStream(stream.id)}
                  onClick={() => setActiveStream(stream.id)}
                >
                  <path className="ray-hit-area" d={rayPath} />
                  <path className="ray-halo-dark" d={rayPath} />
                  <path className="ray-line-dark" d={rayPath} />
                  <circle className="ray-packet-dark" r="3.2"><animateMotion dur="4.9s" begin={stream.delay} repeatCount="indefinite" path={rayPath} /></circle>
                  <circle className="ray-terminal" cx={stream.endX} cy={stream.endY} r="3.2" />
                </g>
              );
            })}
          </g>

          <g className="global-factory-field">
            {globalFactories.map((factory) => {
              const isLinked = active.factories.includes(factory.id);
              return (
                <g key={factory.id} className={isLinked ? 'global-factory is-linked' : 'global-factory'} transform={`translate(${factory.x} ${factory.y})`} style={{ '--ray-color': active.color } as CSSProperties}>
                  <circle className="global-factory-ring" r="13" />
                  <circle className="global-factory-dot" r="3.2" />
                  <text x="9" y="-7">{factory.code}</text>
                  <text className="global-factory-name" x="9" y="3">{factory.name}</text>
                </g>
              );
            })}
          </g>
        </svg>

        {showKpis && <aside className="hero-kpi-rail" aria-label="글로벌 제조 AI 주요 지표">
          <header><span>제조 AI 모델 운용 현황</span><i /></header>
          {kpis.map((kpi, index) => (
            <div className="hero-kpi" key={kpi.label}>
              <span>0{index + 1} / {kpi.label}</span>
              <strong>{kpi.value}</strong>
              <small>{kpi.meta}</small>
            </div>
          ))}
        </aside>}
      </div>
  );
}

export function PrizmHero() {
  return (
    <section className="prizm-hero" aria-labelledby="prizm-hero-title">
      <div className="hero-field" aria-hidden="true" />

      <header className="hero-brandbar">
        <a className="hero-brand-lockup" href="/brand" target="_blank" rel="noreferrer" aria-label="PRIZM 브랜드 스토리 새 창에서 보기">
          <Image className="hero-wordmark" src="/prizm-eforest.svg" alt="E-FOREST PRIZM" width={920} height={300} priority />
          <div className="hero-definition">
            <h1 id="prizm-hero-title">
              <span><b>P</b>ipeline for <b>R</b>esource <b>I</b>ntegration</span>
              <span>toward <em>Z</em>ero-Loss <b>M</b>anufacturing</span>
            </h1>
          </div>
          <span className="hero-brand-story-link">BRAND STORY ↗</span>
        </a>
        <div className="hero-network-state"><span><i /> 연결된 공장</span><strong>12개 거점</strong></div>
      </header>

      <PrizmFlowCanvas />
    </section>
  );
}
