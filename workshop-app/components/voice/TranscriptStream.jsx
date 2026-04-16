'use client';

import { useEffect, useRef } from 'react';
import { CARD, CARD2, BORDER, TEXT, MUTED, DIM, ACCENT } from '../design-tokens';

export default function TranscriptStream({ transcript, currentSpeaker, isActive }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Only auto-scroll if user is near the bottom (within 150px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Parse transcript into segments for rendering
  const segments = parseSegments(transcript);

  return (
    <div ref={containerRef} style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {segments.map((seg, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: 12,
          animation: 'fade-in 0.3s ease-out',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: seg.speaker === 'agent' ? ACCENT : CARD2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
            marginTop: 2,
          }}>
            {seg.speaker === 'agent' ? '\uD83C\uDFA4' : '\uD83D\uDCAC'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11,
              color: DIM,
              marginBottom: 4,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {seg.speaker === 'agent' ? 'Interviewer' : 'You'}
            </div>
            <div style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: TEXT,
            }}>
              {seg.text}
            </div>
          </div>
        </div>
      ))}

      {isActive && (
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: '8px 0',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: currentSpeaker === 'agent' ? ACCENT : CARD2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}>
            {currentSpeaker === 'agent' ? '\uD83C\uDFA4' : '\uD83D\uDCAC'}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: MUTED,
                animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function parseSegments(transcript) {
  if (!transcript.trim()) return [];

  const segments = [];
  const parts = transcript.split(/\n(?=[QA]:)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('Q:')) {
      segments.push({ speaker: 'agent', text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith('A:')) {
      segments.push({ speaker: 'user', text: trimmed.slice(2).trim() });
    } else if (segments.length > 0) {
      // Continuation of previous segment
      segments[segments.length - 1].text += ' ' + trimmed;
    } else {
      segments.push({ speaker: 'agent', text: trimmed });
    }
  }

  return segments;
}
