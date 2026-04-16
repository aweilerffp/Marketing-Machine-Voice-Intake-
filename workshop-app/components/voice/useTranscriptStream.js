'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { MockTranscriptSource, MOCK_TRANSCRIPTS } from './MockTranscriptSource';

export function useTranscriptStream(sectionKey) {
  const [transcript, setTranscript] = useState('');
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const sourceRef = useRef(null);

  const start = useCallback(async () => {
    if (sourceRef.current) return;

    // Fetch mock transcript
    const url = MOCK_TRANSCRIPTS[sectionKey];
    const res = await fetch(url);
    const text = await res.text();

    const source = new MockTranscriptSource(text, {
      wordsPerChunk: 4,
      msPerChunk: 250,
      onTranscript: (chunk) => {
        setTranscript(prev => prev + chunk);
      },
      onSpeakerChange: (speaker) => {
        setCurrentSpeaker(speaker);
      },
      onComplete: () => {
        setIsActive(false);
        setIsComplete(true);
        sourceRef.current = null;
      },
    });

    sourceRef.current = source;
    setIsActive(true);
    setIsComplete(false);
    source.start();
  }, [sectionKey]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
      setIsActive(false);
      setIsComplete(true);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        sourceRef.current.pause();
        sourceRef.current = null;
      }
    };
  }, []);

  return { transcript, currentSpeaker, isActive, isComplete, start, stop };
}
