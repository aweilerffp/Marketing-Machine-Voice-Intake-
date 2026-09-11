// Renders extracted section JSON into Markdown. Isomorphic: used by the
// browser download buttons and by the server-side save route.
import { SECTIONS } from './constants';

const DEPTH_LABELS = {
  fully_covered: 'Full',
  partially_covered: 'Partial',
  not_covered: 'Gap',
};

export function coverageCounts(coverageCheck) {
  const list = Array.isArray(coverageCheck) ? coverageCheck : [];
  return {
    full: list.filter(q => q.coverage_depth === 'fully_covered').length,
    partial: list.filter(q => q.coverage_depth === 'partially_covered').length,
    gap: list.filter(q => q.coverage_depth === 'not_covered').length,
    total: list.length,
  };
}

export function coverageSummary(coverageCheck) {
  const c = coverageCounts(coverageCheck);
  if (c.total === 0) return 'no coverage data';
  return `${c.full} full · ${c.partial} partial · ${c.gap} gap (of ${c.total})`;
}

function h(level, text) {
  return `${'#'.repeat(Math.min(6, Math.max(1, level)))} ${text}`;
}

function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}

function quoteBlock(text) {
  return String(text ?? '')
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function renderTheme(theme, level) {
  const out = [h(level, theme?.section_title || 'Untitled theme'), ''];
  const insights = Array.isArray(theme?.insights) ? theme.insights : [];
  const quotes = Array.isArray(theme?.verbatim_quotes) ? theme.verbatim_quotes : [];
  const donts = Array.isArray(theme?.explicit_dont) ? theme.explicit_dont : [];

  if (insights.length) {
    out.push(h(level + 1, 'Insights'), '');
    for (const ins of insights) {
      out.push(`- **${ins.label ?? 'Insight'}:** ${ins.value ?? ''}`);
      if (ins.evidence) out.push(`  _Evidence: ${ins.evidence}_`);
    }
    out.push('');
  }
  if (quotes.length) {
    out.push(h(level + 1, 'Verbatim quotes'), '');
    for (const q of quotes) {
      out.push(quoteBlock(`"${q.quote ?? ''}"`));
      const attribution = [q.speaker, q.context].filter(Boolean).join(', ');
      if (attribution) out.push(`> — ${attribution}`);
      out.push('');
    }
  }
  if (donts.length) {
    out.push(h(level + 1, "Don'ts"), '');
    for (const d of donts) out.push(`- ${d}`);
    out.push('');
  }
  return out;
}

export function renderSectionMarkdown({ clientName, sessionId, letter, sectionData, headingLevel = 1 }) {
  const meta = SECTIONS[letter] || {};
  const data = sectionData?.extractedData;
  const nuggets = Array.isArray(sectionData?.nuggets) ? sectionData.nuggets : [];
  const out = [];

  out.push(h(headingLevel, `${meta.deliv || 'Deliverable'} — ${clientName || 'Client'}`));
  const metaBits = [
    `Section ${letter} · ${meta.label || ''}`.trim(),
    formatDate(sectionData?.completedAt) ? `Generated ${formatDate(sectionData.completedAt)}` : null,
    sessionId ? `Session ${sessionId}` : null,
  ].filter(Boolean);
  out.push(`_${metaBits.join(' · ')}_`, '');

  if (!data) {
    out.push('_Deliverable not generated for this section._', '');
  } else {
    const themes = data.themes && typeof data.themes === 'object' ? Object.values(data.themes) : [];
    for (const theme of themes) out.push(...renderTheme(theme, headingLevel + 1));

    const coverage = Array.isArray(data.coverage_check) ? data.coverage_check : [];
    if (coverage.length) {
      out.push(h(headingLevel + 1, 'Coverage'), '');
      out.push(`**${coverageSummary(coverage)}**`, '');
      out.push('| # | Question | Coverage | Evidence / gap |');
      out.push('|---|----------|----------|----------------|');
      for (const q of coverage) {
        const note = q.coverage_depth === 'fully_covered'
          ? q.evidence_summary
          : (q.gap_description || q.evidence_summary);
        out.push(`| ${cell(q.question_number)} | ${cell(q.question_text)} | ${DEPTH_LABELS[q.coverage_depth] || cell(q.coverage_depth)} | ${cell(note)} |`);
      }
      out.push('');
    }

    if (data.client_reflection) {
      out.push(h(headingLevel + 1, 'Reflection'), '', String(data.client_reflection).trim(), '');
    }
  }

  if (nuggets.length) {
    out.push(h(headingLevel + 1, `Session highlights (${nuggets.length})`), '');
    for (const n of nuggets) {
      out.push(`- ${n.text ?? ''}${n.category ? ` _(${n.category})_` : ''}`);
    }
    out.push('');
  }

  return out.join('\n');
}

export function renderWorkshopMarkdown({ clientName, sessionId, startedAt, sections }) {
  const out = [];
  out.push(`# Workshop deliverables — ${clientName || 'Client'}`);
  const metaBits = [
    formatDate(startedAt) ? `Started ${formatDate(startedAt)}` : null,
    sessionId ? `Session ${sessionId}` : null,
  ].filter(Boolean);
  if (metaBits.length) out.push(`_${metaBits.join(' · ')}_`);
  out.push('');

  out.push('| Section | Status | Coverage |');
  out.push('|---------|--------|----------|');
  for (const letter of ['A', 'B', 'C']) {
    const meta = SECTIONS[letter];
    const sd = sections?.[letter];
    const generated = !!sd?.extractedData;
    out.push(`| ${letter} · ${meta.deliv} | ${generated ? 'Generated' : 'Not generated'} | ${generated ? coverageSummary(sd.extractedData.coverage_check) : '—'} |`);
  }
  out.push('');

  for (const letter of ['A', 'B', 'C']) {
    out.push('---', '');
    out.push(renderSectionMarkdown({
      clientName,
      sessionId,
      letter,
      sectionData: sections?.[letter] || {},
      headingLevel: 2,
    }));
  }
  return out.join('\n');
}
