'use client';

import { useRef, useEffect, useCallback } from 'react';

const MIN_CHUNK_SIZE = 300;
const CHECK_INTERVAL_MS = 8000;

export function useNuggetDetection(transcript, isActive, onNuggetsFound, existingNuggets = []) {
  const lastCheckedLength = useRef(0);
  const intervalRef = useRef(null);
  const transcriptRef = useRef(transcript);
  const existingRef = useRef(existingNuggets);
  const onFoundRef = useRef(onNuggetsFound);
  const inFlightRef = useRef(false);

  transcriptRef.current = transcript;
  existingRef.current = existingNuggets;
  onFoundRef.current = onNuggetsFound;

  const checkForNuggets = useCallback(async () => {
    if (inFlightRef.current) return;

    const currentTranscript = transcriptRef.current;
    const newText = currentTranscript.slice(lastCheckedLength.current);
    if (newText.trim().length < MIN_CHUNK_SIZE) return;

    lastCheckedLength.current = currentTranscript.length;
    inFlightRef.current = true;

    try {
      const res = await fetch('/api/nuggets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_chunk: newText,
          existing_nuggets: existingRef.current.map(n => n.text),
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data.nuggets && data.nuggets.length > 0) {
        onFoundRef.current(data.nuggets);
      }
    } catch {
      // Non-critical
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(checkForNuggets, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, checkForNuggets]);
}
