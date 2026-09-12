'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, TerminalSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AssetType = 'data' | 'code' | 'model';

const sdkMethods: Record<AssetType, { label: string; variable: string; path: string }> = {
  data: { label: '데이터 자산', variable: 'dataset', path: './data' },
  code: { label: '코드 자산', variable: 'notebook', path: './code' },
  model: { label: '모델 자산', variable: 'model', path: './models' },
};

export function AssetSdkDialog({ open, onOpenChange, type, assetId, version, title }: { open: boolean; onOpenChange: (open: boolean) => void; type: AssetType; assetId: string; version: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const definition = sdkMethods[type];
  const snippet = useMemo(() => `import prizm

${definition.variable} = prizm.${type}.download(
    id="${assetId}",
    version="${version}",
    path="${definition.path}",
)`, [assetId, definition.path, definition.variable, type, version]);

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setCopied(false); onOpenChange(nextOpen); }}>
    <DialogContent className="asset-sdk-dialog">
      <DialogHeader className="asset-sdk-header"><span>PRIZM PYTHON SDK</span><DialogTitle>SDK 스니펫</DialogTitle><DialogDescription><b>{title}</b> 자산을 실행 환경으로 다운로드하는 예제입니다.</DialogDescription></DialogHeader>
      <div className="asset-sdk-body">
        <div className="asset-sdk-context"><span><TerminalSquare size={15} /> {definition.label}</span><strong>{assetId}</strong><b>{version}</b></div>
        <pre><code>{snippet}</code></pre>
        <p>과제 권한을 기준으로 접근이 제어되며, 다운로드 이력은 자산 lineage에 자동 기록됩니다.</p>
      </div>
      <DialogFooter className="asset-sdk-footer"><button type="button" onClick={() => onOpenChange(false)}>닫기</button><button type="button" className={copied ? 'is-copied' : ''} onClick={copySnippet}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '복사했습니다' : '코드 복사'}</button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
