'use client';

import { ArrowRight, CircleAlert, Clock3, Play, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useState, type CSSProperties, type PointerEvent } from 'react';

const factories = [
  { id: 'na', code: 'NA', detail: 'HMGMA · EV', x: 892, y: 125 },
  { id: 'eu', code: 'EU', detail: 'CZECH · ASSY', x: 995, y: 103 },
  { id: 'kr', code: 'KR', detail: 'ULSAN · MOBILITY', x: 1084, y: 142 },
  { id: 'in', code: 'IN', detail: 'CHENNAI · ASSY', x: 1047, y: 215 },
  { id: 'latam', code: 'LATAM', detail: 'BRAZIL · ASSY', x: 946, y: 258 },
  { id: 'sea', code: 'SEA', detail: 'INDONESIA · EV', x: 1112, y: 260 },
];

const modelStreams = [
  { id: 'quality', code: 'QUALITY VISION', color: '#00AAD2', y: 62, delay: '0s', models: '18 MODELS', sites: '9 FACTORIES', factories: ['na', 'eu', 'kr'] },
  { id: 'process', code: 'PROCESS CONTROL', color: '#2F6BFF', y: 118, delay: '-1.1s', models: '14 MODELS', sites: '7 FACTORIES', factories: ['eu', 'kr', 'in'] },
  { id: 'asset', code: 'ASSET HEALTH', color: '#00A87B', y: 175, delay: '-2.2s', models: '12 MODELS', sites: '11 FACTORIES', factories: ['na', 'eu', 'kr', 'in', 'latam'] },
  { id: 'energy', code: 'ENERGY OPTIMIZATION', color: '#F28C45', y: 232, delay: '-3.3s', models: '11 MODELS', sites: '6 FACTORIES', factories: ['kr', 'in', 'sea'] },
  { id: 'supply', code: 'FLOW OPTIMIZATION', color: '#9B68D7', y: 288, delay: '-4.4s', models: '9 MODELS', sites: '8 FACTORIES', factories: ['na', 'latam', 'sea'] },
];

const sourceRows = [
  { label: 'EQUIPMENT', y: 96 },
  { label: 'QUALITY', y: 136 },
  { label: 'PROCESS', y: 176 },
  { label: 'ENERGY', y: 216 },
  { label: 'LOGISTICS', y: 256 },
];

function ModelSignature({ id, x, y }: { id: string; x: number; y: number }) {
  if (id === 'quality') {
    return <g className="model-signature" transform={`translate(${x - 14} ${y - 10})`}>{[0, 1, 2, 3, 4, 5].map((item) => <rect key={item} x={(item % 3) * 10} y={Math.floor(item / 3) * 10} width="6" height="6" />)}</g>;
  }
  if (id === 'process') {
    return <g className="model-signature" transform={`translate(${x - 16} ${y})`}><path d="M0 0 C5 -15 10 15 16 0 S27 -15 32 0" /></g>;
  }
  if (id === 'asset') {
    return <g className="model-signature" transform={`translate(${x - 15} ${y + 11})`}>{[9, 17, 25, 13].map((height, index) => <rect key={height} x={index * 9} y={-height} width="5" height={height} />)}</g>;
  }
  if (id === 'energy') {
    return <g className="model-signature" transform={`translate(${x} ${y})`}><circle r="5" /><circle r="12" /><path d="M-18 0 H18" /></g>;
  }
  return <g className="model-signature" transform={`translate(${x} ${y})`}><path d="M-16 8 L0 -10 L16 8 Z" /><circle cx="-16" cy="8" r="3" /><circle cy="-10" r="3" /><circle cx="16" cy="8" r="3" /></g>;
}

export function PrizmHero() {
  const [activeStream, setActiveStream] = useState(modelStreams[0].id);
  const active = modelStreams.find((stream) => stream.id === activeStream) ?? modelStreams[0];

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty('--spot-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--spot-y', `${y * 100}%`);
    event.currentTarget.style.setProperty('--prism-x', `${(x - 0.5) * 8}px`);
    event.currentTarget.style.setProperty('--prism-y', `${(y - 0.5) * 5}px`);
  };

  return (
    <section className="prizm-hero" aria-labelledby="prizm-hero-title" onPointerMove={handlePointerMove}>
      <div className="hero-field" aria-hidden="true" />

      <header className="hero-brandbar">
        <div className="hero-brand-lockup">
          <Image className="hero-wordmark" src="/prizm-eforest.svg" alt="E-FOREST PRIZM" width={920} height={300} priority />
          <div className="hero-definition">
            <h1 id="prizm-hero-title">
              <span className="definition-line"><small>Pipeline for</small><strong>Resource Innovation</strong><b>,</b></span>
              <span className="definition-line"><small>driving</small><strong><em>Z</em>ero-Loss Manufacturing</strong><b>.</b></span>
            </h1>
          </div>
        </div>
        <span className="hero-network-state"><i /> GLOBAL NETWORK · 12 SITES CONNECTED</span>
      </header>

      <div className="prism-canvas">
        <svg viewBox="0 0 1160 330" aria-labelledby="prizm-flow-title">
          <title id="prizm-flow-title">하나의 데이터 파이프라인이 투명한 프리즘을 통과해 여러 제조 AI 모델로 변화하고 세계 각지의 공장으로 전달되는 모습</title>
          <defs>
            <linearGradient id="pipelineStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7A94AB" stopOpacity="0.14" /><stop offset="0.65" stopColor="#002C5F" stopOpacity="0.78" /><stop offset="1" stopColor="#00AAD2" /></linearGradient>
            <linearGradient id="prismGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" /><stop offset="0.48" stopColor="#D6F5FC" stopOpacity="0.58" /><stop offset="1" stopColor="#7FD9EB" stopOpacity="0.16" /></linearGradient>
            <radialGradient id="prismCore"><stop offset="0" stopColor="#BDF4FF" stopOpacity="0.95" /><stop offset="1" stopColor="#00AAD2" stopOpacity="0" /></radialGradient>
            <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" /></filter>
            <filter id="rayGlow" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="2.2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          <g className="source-field">
            {sourceRows.map((source, index) => (
              <g key={source.label}>
                <rect x="18" y={source.y - 11} width="92" height="22" rx="2" /><circle cx="31" cy={source.y} r="2.5" /><text x="42" y={source.y + 3}>{source.label}</text>
                <path d={`M 110 ${source.y} C 205 ${source.y}, 256 175, 350 175`} />
                <circle className="source-packet" r="2.8"><animateMotion dur={`${4.8 + index * 0.36}s`} begin={`${index * -0.71}s`} repeatCount="indefinite" path={`M 110 ${source.y} C 205 ${source.y}, 256 175, 350 175`} /></circle>
              </g>
            ))}
          </g>

          <g className="pipeline-trunk">
            <path d="M 350 175 L 442 175" /><path className="pipeline-glow" d="M 350 175 L 442 175" />
            <circle r="4"><animateMotion dur="2.1s" repeatCount="indefinite" path="M 350 175 L 442 175" /></circle><text x="352" y="157">ONE DATA PIPELINE</text>
          </g>

          <g className="prizm-object">
            <circle className="prism-aura" cx="501" cy="175" r="78" />
            <polygon className="prism-back" points="468,76 574,175 468,274" />
            <polygon className="prism-face" points="442,76 548,175 442,274" />
            <polygon className="prism-sheen" points="442,76 478,110 455,248 442,274" />
            <path className="prism-edge" d="M442 76 L468 76 L574 175 L468 274 L442 274" />
            <path className="prism-light-axis" d="M426 175 H572" />
            <circle className="prism-core" cx="512" cy="175" r="44" />
            <circle className="prism-flare" cx="552" cy="175" r="7" />
          </g>

          <g className="world-map">
            <path d="M842 79l32-23 34 4 15 17-10 19-24 4-8 20-26-5-13-17z" /><path d="M914 143l24 10 15 24-7 31 10 23-17 35-12-19 3-28-14-31z" /><path d="M955 69l24-13 31 8 10 14-13 10-24-5-18 8z" /><path d="M986 102l31-8 18 15 6 28-15 17-11 44-23-16-13-37z" /><path d="M1020 72l35-19 61 10 24 25-13 19-31 2-15 23-33-11-25-20z" /><path d="M1090 216l32-8 21 17-7 24-35 5-18-18z" /><path className="map-route" d="M852 126 C918 77 1047 66 1128 112" />
          </g>

          <g className="spectrum-field">
            {modelStreams.map((stream) => {
              const activeClass = stream.id === activeStream ? 'is-active' : '';
              const rayPath = `M 548 175 C 620 175, 636 ${stream.y}, 724 ${stream.y}`;
              return (
                <g key={stream.id} className={`spectrum-ray ${activeClass}`} style={{ '--ray-color': stream.color } as CSSProperties} onPointerEnter={() => setActiveStream(stream.id)}>
                  <path className="ray-halo" d={rayPath} /><path className="ray-line" d={rayPath} />
                  <circle className="ray-packet" r="4"><animateMotion dur="4.6s" begin={stream.delay} repeatCount="indefinite" path={rayPath} /></circle>
                  <ModelSignature id={stream.id} x={744} y={stream.y} />
                  {stream.factories.map((factoryId) => {
                    const factory = factories.find((item) => item.id === factoryId);
                    if (!factory) return null;
                    return <path key={factory.id} className="model-route" d={`M 766 ${stream.y} C 824 ${stream.y}, 828 ${factory.y}, ${factory.x - 13} ${factory.y}`} />;
                  })}
                </g>
              );
            })}
          </g>

          <g className="factory-field">
            {factories.map((factory) => {
              const isLinked = active.factories.includes(factory.id);
              const alignRight = factory.x > 1060;
              return (
                <g key={factory.id} className={isLinked ? 'factory-site is-linked' : 'factory-site'} transform={`translate(${factory.x} ${factory.y})`} style={{ '--ray-color': active.color } as CSSProperties}>
                  <circle className="factory-halo" r="16" />
                  <path className="factory-shape" d="M-10 8V-4l7 4v-7l7 4v-10h5V8z" />
                  <path className="factory-base" d="M-13 8H13" />
                  <rect className="factory-tag" x={alignRight ? -96 : 14} y="-12" width="80" height="28" rx="2" />
                  <text className="factory-code" x={alignRight ? -19 : 19} y="-1" textAnchor={alignRight ? 'end' : 'start'}>{factory.code}</text>
                  <text className="factory-role" x={alignRight ? -19 : 19} y="10" textAnchor={alignRight ? 'end' : 'start'}>{factory.detail}</text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="stream-control" aria-label="제조 AI 모델 흐름 선택">
          <div className="stream-summary" aria-live="polite"><span style={{ '--ray-color': active.color } as CSSProperties}><i />{active.code}</span><strong>{active.models}</strong><small>{active.sites}</small></div>
          <div className="stream-tabs">
            {modelStreams.map((stream) => <button type="button" key={stream.id} className={stream.id === activeStream ? 'is-active' : ''} style={{ '--ray-color': stream.color } as CSSProperties} onPointerEnter={() => setActiveStream(stream.id)} onFocus={() => setActiveStream(stream.id)} onClick={() => setActiveStream(stream.id)} aria-label={`${stream.code} 흐름 보기`}><i /></button>)}
          </div>
        </div>
      </div>

      <div className="hero-work-ledger" aria-label="오늘의 주요 업무">
        <div className="work-ledger-label"><span>TODAY / 08:42 KST</span><strong>운영 브리핑</strong></div>
        <a href="#attention" className="work-ledger-cell is-urgent"><span><CircleAlert size={13} /> 지금 할 일</span><strong>AssemblyNet 기준 이탈</strong><small>전주 의장 · 11:30까지</small></a>
        <a href="#projects" className="work-ledger-cell"><span><Clock3 size={13} /> 지난 접속 이후</span><strong>WeldNet 2.4 운영 승격</strong><small>변경 3건 · 06:30 이후</small></a>
        <a href="#lifecycle" className="work-ledger-cell"><span><Play size={13} /> 현재 실행</span><strong>학습 8건 · 배포 2건</strong><small>2건 대기 · 전체 정상</small></a>
        <div className="work-ledger-cell active-model-cell"><span><Sparkles size={13} /> 선택 모델군</span><strong>{active.code}</strong><small>{active.models} · {active.sites}</small></div>
        <a href="#operations" className="hero-enter"><span>전체 운영 현황</span><ArrowRight size={16} /></a>
      </div>
    </section>
  );
}
