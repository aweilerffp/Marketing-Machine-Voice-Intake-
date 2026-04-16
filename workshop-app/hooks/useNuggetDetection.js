'use client';

import { useRef, useEffect, useCallback } from 'react';

const MIN_CHUNK_SIZE = 200; // characters before checking for nuggets
const DEBOUNCE_MS = 3000;  // wait 3s after last transcript update

export function useNuggetDetection(transcript, isActive, onNuggetsFound, existingNuggets = []) {
  const lastCheckedLength = useRef(0);
  const timerRef = useRef(null);

  const checkForNuggets = useCallback(async () => {
    const newText = transcript.slice(lastCheckedLength.current);
    if (newText.trim().length < MIN_CHUNK_SIZE) return;

    lastCheckedLength.current = transcript.length;

    try {
      const res = await fetch('/api/nuggets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_chunk: newText,
          existing_nuggets: existingNuggets.map(n => n.text),
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data.nuggets && data.nuggets.length > 0) {
        onNuggetsFound(data.nuggets);
      }
    } catch {
      // Non-critical — silently skip
    }
  }, [transcript, existingNuggets, onNuggetsFound]);

  useEffect(() => {
    if (!isActive) return;

    const newChars = transcript.length - lastCheckedLength.current;
    if (newChars < MIN_CHUNK_SIZE) return;

    // Debounce: wait for a pause in the transcript
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(checkForNuggets, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [transcript, isActive, checkForNuggets]);
}
