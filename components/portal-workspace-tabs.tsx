'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Boxes, CheckSquare, Cpu, X } from 'lucide-react';
import { PrizmCodeIcon, PrizmDataIcon, PrizmEvaluationIcon, PrizmModelIcon, PrizmPipelineIcon } from '@/components/prizm-asset-icons';

export type PortalTabId = 'my-tasks' | 'projects' | 'data-assets' | 'code-assets' | 'model-assets' | 'pipeline-runs' | 'model-evaluation' | 'model-monitoring' | 'execution-resources' | 'execution-environments';

type PortalTab = { id: PortalTabId; label: string; href: string; scrollY?: number };
type PortalTabIcon = ComponentType<{ size?: number; className?: string }>;

const tabDefinitions: Record<PortalTabId, { label: string; href: string; icon: PortalTabIcon }> = {
  'my-tasks': { label: '나의 작업', href: '/work/tasks', icon: CheckSquare },
  'projects': { label: '과제관리', href: '/projects', icon: Boxes },
  'data-assets': { label: '데이터 자산', href: '/assets/data', icon: PrizmDataIcon },
  'code-assets': { label: '코드 자산', href: '/assets/code', icon: PrizmCodeIcon },
  'model-assets': { label: '모델 자산', href: '/assets/models', icon: PrizmModelIcon },
  'pipeline-runs': { label: '실험 대시보드', href: '/assets/code?pipeline=1', icon: PrizmPipelineIcon },
  'model-evaluation': { label: '모델 평가', href: '/evaluation/models', icon: PrizmEvaluationIcon },
  'model-monitoring': { label: '모델 성능', href: '/monitoring/models', icon: Activity },
  'execution-resources': { label: '실행 자원 관리', href: '/resources/compute', icon: Cpu },
  'execution-environments': { label: '실행 환경 관리', href: '/resources/environments', icon: Boxes },
};

const storageKey = 'prizm-open-menu-tabs';

function readTabs(): PortalTab[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as PortalTab[];
    return parsed.filter((tab) => tabDefinitions[tab.id]);
  } catch {
    return [];
  }
}

export function PortalWorkspaceTabs({ current }: { current: PortalTabId }) {
  const currentTab = { id: current, label: tabDefinitions[current].label, href: tabDefinitions[current].href };
  const [tabs, setTabs] = useState<PortalTab[]>([currentTab]);
  const router = useRouter();

  useEffect(() => {
    let lastHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const frame = window.requestAnimationFrame(() => {
      const saved = readTabs();
      const existingIndex = saved.findIndex((tab) => tab.id === current);
      const savedCurrent = existingIndex >= 0 ? saved[existingIndex] : undefined;
      const liveTab = {
        id: current,
        label: tabDefinitions[current].label,
        href: lastHref,
        scrollY: savedCurrent?.href === lastHref ? savedCurrent.scrollY : 0,
      };
      const next = existingIndex >= 0
        ? saved.map((tab, index) => index === existingIndex ? liveTab : tab)
        : [...saved, liveTab];
      setTabs(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      if (liveTab.scrollY) window.setTimeout(() => window.scrollTo({ top: liveTab.scrollY, behavior: 'auto' }), 80);
    });

    const syncCurrentLocation = () => {
      const liveHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (liveHref === lastHref) return;
      lastHref = liveHref;
      setTabs((currentTabs) => {
        const next = currentTabs.map((tab) => tab.id === current ? { ...tab, href: liveHref, scrollY: window.scrollY } : tab);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    };

    let scrollFrame = 0;
    const rememberScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        const saved = readTabs();
        const next = saved.map((tab) => tab.id === current ? { ...tab, href: lastHref, scrollY: window.scrollY } : tab);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      });
    };

    const locationTimer = window.setInterval(syncCurrentLocation, 200);
    window.addEventListener('popstate', syncCurrentLocation);
    window.addEventListener('scroll', rememberScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.clearInterval(locationTimer);
      window.removeEventListener('popstate', syncCurrentLocation);
      window.removeEventListener('scroll', rememberScroll);
    };
  }, [current]);

  const rememberCurrentTab = () => {
    const liveHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const saved = readTabs();
    const next = saved.map((tab) => tab.id === current ? { ...tab, href: liveHref, scrollY: window.scrollY } : tab);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const activateTab = (tab: PortalTab) => {
    if (tab.id === current) return;
    rememberCurrentTab();
    router.push(tab.href);
  };

  const closeTab = (id: PortalTabId) => {
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    window.localStorage.setItem(storageKey, JSON.stringify(remaining));
    if (id === current && remaining.length) router.push(remaining[remaining.length - 1].href);
  };

  const closeAll = () => {
    setTabs([]);
    window.localStorage.removeItem(storageKey);
    router.push('/');
  };

  if (!tabs.length) return null;
  return <nav className="workspace-tabs" aria-label="열린 메뉴 작업공간"><div className="workspace-tab-track">{tabs.map((tab) => {
    const definition = tabDefinitions[tab.id];
    return <span className={tab.id === current ? 'workspace-tab-item is-active' : 'workspace-tab-item'} key={tab.id}><button type="button" aria-current={tab.id === current ? 'page' : undefined} onClick={() => activateTab(tab)}><definition.icon size={14} /><span>{tab.label}</span></button><button type="button" className="workspace-tab-close" aria-label={`${tab.label} 탭 닫기`} onClick={() => closeTab(tab.id)}><X size={12} /></button></span>;
  })}</div>{tabs.length > 1 && <button type="button" className="workspace-close-all" onClick={closeAll}><X size={13} /> 모두 닫기</button>}</nav>;
}
