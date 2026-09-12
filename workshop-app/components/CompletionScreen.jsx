'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { SECTIONS } from '../lib/constants';
import { CARD, BORDER, MUTED, GREEN, AMBER, TEXT } from './design-tokens';
import { clearSession } from '../lib/session';
import { saveToServer } from '../lib/save-client';
import { renderSectionMarkdown, renderWorkshopMarkdown } from '../lib/render-markdown';
import { sectionDownloadName, workshopDownloadName } from '../lib/slug';
import DownloadMarkdownButton from './DownloadMarkdownButton';
import ConfirmDialog from './ConfirmDialog';

export default function CompletionScreen() {
  const { state, dispatch } = useWorkshopSession();
  const [showConfirm, setShowConfirm] = useState(false);
  const [notice, setNotice] = useState(null); // { ok: boolean, text: string }
  const notified = useRef(false);

  const sections = { A: state.sectionA, B: state.sectionB, C: state.sectionC };

  // Save the combined deliverable on the server and notify Slack, once per session.
  useEffect(() => {
    if (notified.current) return;
    notified.current = true;
    if (state.completionSavedAt) {
      setNotice({ ok: true, text: 'Saved to server' });
      return;
    }
    if (!state.sessionId) return;
    saveToServer({
      event: 'complete',
      sessionId: state.sessionId,
      clientName: state.clientName,
      startedAt: state.startedAt,
      sections,
    }).then(r => {
      if (r.ok) {
        dispatch({ type: 'SET_COMPLETION_SAVED' });
        setNotice({ ok: true, text: r.slack === 'sent' ? 'Saved to server and team notified' : 'Saved to server' });
      } else {
        setNotice({ ok: false, text: "Couldn't reach the server — use the download buttons below" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReset() {
    clearSession();
    dispatch({ type: 'RESET' });
    setShowConfirm(false);
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 40,
        textAlign: 'center',
        maxWidth: 560,
        width: '100%',
        animation: 'fade-in 0.5s ease-out',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{'🎉'}</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: GREEN }}>
          Workshop Complete!
        </h2>
        <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.5, marginBottom: 24 }}>
          All three discovery sections are done for <strong style={{ color: TEXT }}>{state.clientName}</strong>.
          Your deliverables are ready.
        </p>

        <div style={{ marginBottom: 12 }}>
          <DownloadMarkdownButton
            variant="primary"
            color={GREEN}
            label="Download all deliverables (.md)"
            filename={workshopDownloadName(state.clientName)}
            getMarkdown={() => renderWorkshopMarkdown({
              clientName: state.clientName,
              sessionId: state.sessionId,
              startedAt: state.startedAt,
              sections,
            })}
            style={{ padding: '14px 28px', fontSize: 16, borderRadius: 10 }}
          />
        </div>
        {notice && (
          <div style={{ fontSize: 12, color: notice.ok ? GREEN : AMBER, marginBottom: 24 }}>
            {notice.ok ? '✓ ' : ''}{notice.text}
          </div>
        )}
        {!notice && <div style={{ marginBottom: 24 }} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {['A', 'B', 'C'].map(letter => {
            const meta = SECTIONS[letter];
            const section = state[meta.stateKey];
            const hasData = !!section.extractedData;
            return (
              <div key={letter} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: '#0F172A',
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                  {meta.deliv}
                </span>
                {hasData ? (
                  <DownloadMarkdownButton
                    size="sm"
                    color={meta.color}
                    label=".md"
                    filename={sectionDownloadName(state.clientName, letter, meta.deliv)}
                    getMarkdown={() => renderSectionMarkdown({
                      clientName: state.clientName,
                      sessionId: state.sessionId,
                      letter,
                      sectionData: section,
                    })}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: MUTED }}>Pending</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: 'transparent',
              color: MUTED,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Start New Session
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Start a new session?"
          body={<>This will erase everything for <strong style={{ color: TEXT }}>{state.clientName}</strong> from this browser — transcripts, insights, and deliverables. Download your deliverables first if you have not already.</>}
          confirmLabel="Erase and start over"
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
