'use client';

import { ArrowDown, Database, Factory, Orbit } from 'lucide-react';
import { useState, type CSSProperties, type PointerEvent } from 'react';

const modelStreams = [
  { id: 'quality', code: 'QUALITY VISION', color: '#00AAD2', y: 72, delay: '0s', models: '18 MODELS', sites: '9 FACTORIES' },
  { id: 'process', code: 'PROCESS CONTROL', color: '#2F6BFF', y: 148, delay: '-1.1s', models: '14 MODELS', sites: '7 FACTORIES' },
  { id: 'asset', code: 'ASSET HEALTH', color: '#00A87B', y: 224, delay: '-2.2s', models: '12 MODELS', sites: '11 FACTORIES' },
  { id: 'energy', code: 'ENERGY OPTIMIZATION', color: '#F28C45', y: 300, delay: '-3.3s', models: '11 MODELS', sites: '6 FACTORIES' },
  { id: 'supply', code: 'FLOW INTELLIGENCE', color: '#9B68D7', y: 376, delay: '-4.4s', models: '9 MODELS', sites: '8 FACTORIES' },
];

const sourceRows = [
  { label: 'EQUIPMENT', y: 128 },
  { label: 'QUALITY', y: 178 },
  { label: 'PROCESS', y: 228 },
  { label: 'ENERGY', y: 278 },
  { label: 'LOGISTICS', y: 328 },
];

export function PrizmHero() {
  const [activeStream, setActiveStream] = useState(modelStreams[0].id);
  const active = modelStreams.find((stream) => stream.id === activeStream) ?? modelStreams[0];

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty('--spot-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--spot-y', `${y * 100}%`);
    event.currentTarget.style.setProperty('--prism-x', `${(x - 0.5) * 10}px`);
    event.currentTarget.style.setProperty('--prism-y', `${(y - 0.5) * 7}px`);
  };

  return (
    <section className="prizm-hero" aria-labelledby="prizm-hero-title" onPointerMove={handlePointerMove}>
      <div className="hero-field" aria-hidden="true" />

      <header className="hero-meta">
        <span>PRIZM / GLOBAL MANUFACTURING NETWORK</span>
        <span className="hero-network-state"><i /> 12 SITES CONNECTED</span>
      </header>

      <div className="prism-canvas">
        <svg viewBox="0 0 1160 448" aria-labelledby="prizm-flow-title">
          <title id="prizm-flow-title">하나의 데이터 파이프라인이 PRIZM을 통과해 여러 제조 AI 모델로 분화되고 전 세계 공장으로 전달되는 모습</title>
          <defs>
            <linearGradient id="pipelineStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7A94AB" stopOpacity="0.14" />
              <stop offset="0.65" stopColor="#002C5F" stopOpacity="0.78" />
              <stop offset="1" stopColor="#00AAD2" />
            </linearGradient>
            <linearGradient id="prismGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
              <stop offset="0.48" stopColor="#D6F5FC" stopOpacity="0.58" />
              <stop offset="1" stopColor="#7FD9EB" stopOpacity="0.16" />
            </linearGradient>
            <radialGradient id="prismCore">
              <stop offset="0" stopColor="#BDF4FF" stopOpacity="0.95" />
              <stop offset="1" stopColor="#00AAD2" stopOpacity="0" />
            </radialGradient>
            <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="rayGlow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g className="source-field">
            {sourceRows.map((source, index) => (
              <g key={source.label}>
                <rect x="22" y={source.y - 13} width="96" height="26" rx="2" />
                <circle cx="37" cy={source.y} r="3" />
                <text x="49" y={source.y + 3}>{source.label}</text>
                <path d={`M 118 ${source.y} C 210 ${source.y}, 252 224, 354 224`} />
                <circle className="source-packet" r="2.8">
                  <animateMotion dur={`${4.8 + index * 0.36}s`} begin={`${index * -0.71}s`} repeatCount="indefinite" path={`M 118 ${source.y} C 210 ${source.y}, 252 224, 354 224`} />
                </circle>
              </g>
            ))}
          </g>

          <g className="pipeline-trunk">
            <path d="M 354 224 L 470 224" />
            <path className="pipeline-glow" d="M 354 224 L 470 224" />
            <circle r="4">
              <animateMotion dur="2.1s" repeatCount="indefinite" path="M 354 224 L 470 224" />
            </circle>
            <text x="356" y="205">ONE DATA PIPELINE</text>
          </g>

          <g className="prizm-object">
            <circle className="prism-aura" cx="540" cy="224" r="82" />
            <polygon className="prism-back" points="514,107 646,224 514,341" />
            <polygon className="prism-face" points="486,107 618,224 486,341" />
            <path className="prism-edge" d="M486 107 L514 107 L646 224 L514 341 L486 341" />
            <path className="prism-z" d="M521 173 H574 L522 274 H581" />
            <circle className="prism-core" cx="548" cy="224" r="48" />
            <text className="prism-label" x="533" y="322">PRIZM CORE</text>
          </g>

          <g className="world-field">
            <ellipse cx="947" cy="224" rx="178" ry="178" />
            <ellipse cx="947" cy="224" rx="178" ry="68" />
            <ellipse cx="947" cy="224" rx="78" ry="178" />
            <path d="M769 224 H1125" />
            <path className="world-orbit" d="M 782 154 C 860 56, 1051 61, 1111 173" />
            <circle cx="831" cy="115" r="3" />
            <circle cx="1054" cy="103" r="3" />
            <circle cx="1107" cy="244" r="3" />
            <circle cx="997" cy="376" r="3" />
            <circle cx="811" cy="320" r="3" />
          </g>

          <g className="spectrum-field">
            {modelStreams.map((stream, index) => {
              const activeClass = stream.id === activeStream ? 'is-active' : '';
              const path = `M 620 224 C 718 224, 786 ${stream.y}, 1084 ${stream.y}`;
              return (
                <g
                  key={stream.id}
                  className={`spectrum-ray ${activeClass}`}
                  style={{ '--ray-color': stream.color } as CSSProperties}
                  onPointerEnter={() => setActiveStream(stream.id)}
                >
                  <path className="ray-halo" d={path} />
                  <path className="ray-line" d={path} />
                  <circle className="ray-packet" r="4.2">
                    <animateMotion dur="5.5s" begin={stream.delay} repeatCount="indefinite" path={path} />
                  </circle>
                  <circle className="factory-halo" cx="1084" cy={stream.y} r="15" />
                  <circle className="factory-node" cx="1084" cy={stream.y} r="6" />
                  <path className="factory-tick" d={`M 1097 ${stream.y} H 1112`} />
                  <text className="factory-code" x="1118" y={stream.y + 3}>{`F${String(index + 1).padStart(2, '0')}`}</text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="stream-control" aria-label="제조 AI 모델 흐름 선택">
          <div className="stream-summary" aria-live="polite">
            <span style={{ '--ray-color': active.color } as CSSProperties}><i />{active.code}</span>
            <strong>{active.models}</strong>
            <small>{active.sites}</small>
          </div>
          <div className="stream-tabs">
            {modelStreams.map((stream) => (
              <button
                type="button"
                key={stream.id}
                className={stream.id === activeStream ? 'is-active' : ''}
                style={{ '--ray-color': stream.color } as CSSProperties}
                onPointerEnter={() => setActiveStream(stream.id)}
                onFocus={() => setActiveStream(stream.id)}
                onClick={() => setActiveStream(stream.id)}
                aria-label={`${stream.code} 흐름 보기`}
              >
                <i />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-statement">
        <div className="hero-title-wrap">
          <span className="hero-sequence">P — R — I / Z — M</span>
          <h1 id="prizm-hero-title">
            <span>Production-Ready Innovation</span>
            <strong>for Zero-Loss Manufacturing</strong>
          </h1>
        </div>
        <div className="hero-legend" aria-label="PRIZM 흐름">
          <span><Database size={15} /> Unified data</span>
          <span><Orbit size={15} /> Model spectrum</span>
          <span><Factory size={15} /> Every factory</span>
        </div>
        <a href="#operations" className="hero-enter">
          <span>ENTER OPERATIONS</span><ArrowDown size={16} />
        </a>
      </div>
    </section>
  );
}
