'use client';

import { useEffect, useRef } from 'react';

const BAR_COUNT = 28;
const HEIGHT = 64;
const GAP = 4;

export default function VoiceWaveform({
  getInputData,
  getOutputData,
  isSpeaking,
  isActive,
  userColor = '#3B82F6',
  agentColor = '#A78BFA',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const smoothedRef = useRef(new Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = HEIGHT * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      ctx.clearRect(0, 0, width * dpr, HEIGHT * dpr);

      let data = null;
      const activeColor = isSpeaking ? agentColor : userColor;

      if (isActive) {
        try {
          const getter = isSpeaking ? getOutputData : getInputData;
          if (typeof getter === 'function') {
            const raw = getter();
            if (raw && raw.length) data = raw;
          }
        } catch {
          data = null;
        }
      }

      const barWidth = (width - GAP * (BAR_COUNT - 1)) / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = 0;
        if (data) {
          const step = Math.floor(data.length / BAR_COUNT);
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j];
          target = (sum / step) / 255;
        }
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.3;
        const v = smoothedRef.current[i];
        const barH = Math.max(3, v * HEIGHT);
        const x = i * (barWidth + GAP);
        const y = (HEIGHT - barH) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, activeColor);
        grad.addColorStop(1, activeColor + '55');
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, barWidth, barH, Math.min(barWidth / 2, 3));
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [getInputData, getOutputData, isSpeaking, isActive, userColor, agentColor]);

  return (
    <div style={{ width: '100%', maxWidth: 520, padding: '0 32px' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, display: 'block' }}
      />
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
