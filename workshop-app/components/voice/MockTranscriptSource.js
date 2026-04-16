/**
 * Replays a transcript word-by-word at natural speaking pace.
 * Detects Q:/A: markers for speaker changes.
 */
export class MockTranscriptSource {
  constructor(transcriptText, options = {}) {
    this.lines = this._parseLines(transcriptText);
    this.wordsPerChunk = options.wordsPerChunk || 4;
    this.msPerChunk = options.msPerChunk || 300; // ~3 words/sec speaking pace
    this.onTranscript = options.onTranscript || (() => {});
    this.onSpeakerChange = options.onSpeakerChange || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this._timer = null;
    this._lineIdx = 0;
    this._wordIdx = 0;
    this._fullTranscript = '';
    this._running = false;
  }

  _parseLines(text) {
    const lines = [];
    const raw = text.split('\n');
    let currentSpeaker = null;
    let currentText = '';

    for (const line of raw) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('SECTION') || trimmed.startsWith('────')) continue;

      if (trimmed.startsWith('Q:')) {
        if (currentText) lines.push({ speaker: currentSpeaker, text: currentText.trim() });
        currentSpeaker = 'agent';
        currentText = trimmed.slice(2).trim();
      } else if (trimmed.startsWith('A:')) {
        if (currentText) lines.push({ speaker: currentSpeaker, text: currentText.trim() });
        currentSpeaker = 'user';
        currentText = trimmed.slice(2).trim();
      } else {
        currentText += ' ' + trimmed;
      }
    }
    if (currentText) lines.push({ speaker: currentSpeaker, text: currentText.trim() });
    return lines;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._tick();
  }

  _tick() {
    if (!this._running) return;
    if (this._lineIdx >= this.lines.length) {
      this._running = false;
      this.onComplete(this._fullTranscript);
      return;
    }

    const line = this.lines[this._lineIdx];
    const words = line.text.split(/\s+/);

    // Emit speaker change at start of line
    if (this._wordIdx === 0) {
      this.onSpeakerChange(line.speaker);
      // Add speaker label to transcript
      const label = line.speaker === 'agent' ? '\nQ: ' : '\nA: ';
      if (this._fullTranscript) {
        this._fullTranscript += label;
        this.onTranscript(label);
      }
    }

    // Emit next chunk of words
    const chunk = words.slice(this._wordIdx, this._wordIdx + this.wordsPerChunk).join(' ');
    if (chunk) {
      const prefix = this._wordIdx > 0 ? ' ' : '';
      this._fullTranscript += prefix + chunk;
      this.onTranscript(prefix + chunk);
    }

    this._wordIdx += this.wordsPerChunk;

    // Check if line is done
    if (this._wordIdx >= words.length) {
      this._lineIdx++;
      this._wordIdx = 0;
      // Pause between speakers (simulates natural conversation gap)
      this._timer = setTimeout(() => this._tick(), this.msPerChunk * 3);
    } else {
      this._timer = setTimeout(() => this._tick(), this.msPerChunk);
    }
  }

  pause() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
  }

  stop() {
    this.pause();
    this.onComplete(this._fullTranscript);
  }

  getFullTranscript() {
    return this._fullTranscript;
  }
}

// Pre-loaded test transcripts (fetched from public dir)
export const MOCK_TRANSCRIPTS = {
  a: '/transcripts/test-emplicit-section-a.txt',
  b: '/transcripts/test-emplicit-section-b.txt',
  c: '/transcripts/test-emplicit-section-c.txt',
};
