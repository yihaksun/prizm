'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function PrizmAppLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const startedAt = window.performance.now();
    let fadeTimer: number | undefined;
    let removeTimer: number | undefined;

    const finishLoading = () => {
      const elapsed = window.performance.now() - startedAt;
      const remaining = Math.max(0, 700 - elapsed);
      fadeTimer = window.setTimeout(() => {
        setLeaving(true);
        removeTimer = window.setTimeout(() => setVisible(false), 180);
      }, remaining);
    };

    if (document.readyState === 'complete') finishLoading();
    else window.addEventListener('load', finishLoading, { once: true });

    return () => {
      window.removeEventListener('load', finishLoading);
      if (fadeTimer) window.clearTimeout(fadeTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <output className={leaving ? 'prizm-app-loader is-leaving' : 'prizm-app-loader'} aria-live="polite" aria-label="PRIZM을 불러오는 중">
      <div className="prizm-loader-content">
        <div className="prizm-loader-mark">
          <Image src="/prizm-z-loader-transparent.png" alt="" width={512} height={475} priority />
          <span className="prizm-loader-beam" aria-hidden="true"><i /></span>
        </div>
      </div>
    </output>
  );
}
