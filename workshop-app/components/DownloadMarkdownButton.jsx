'use client';

import { BORDER, MUTED } from './design-tokens';

export function downloadMarkdown(filename, markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DownloadMarkdownButton({
  filename,
  getMarkdown,
  label = 'Download .md',
  color,
  variant = 'ghost',
  size = 'md',
  style,
}) {
  const primary = variant === 'primary';
  const pad = size === 'sm' ? '6px 12px' : '10px 20px';
  const fontSize = size === 'sm' ? 12 : 14;
  return (
    <button
      onClick={() => downloadMarkdown(filename, getMarkdown())}
      style={{
        padding: pad,
        fontSize,
        fontWeight: 600,
        background: primary ? color : 'transparent',
        color: primary ? '#fff' : (color || MUTED),
        border: `1px solid ${primary ? color : (color || BORDER)}`,
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {'⬇️'} {label}
    </button>
  );
}
