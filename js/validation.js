(function (root) {
  'use strict';

  function normalizeOverride(override) {
    if (!override || override.mode === 'keep' || !override.mode) return { mode: 'keep', value: '' };
    if (override.mode === 'blank') return { mode: 'blank', value: '' };
    if (override.mode === 'replace') return { mode: 'replace', value: override.value === null || override.value === undefined ? '' : String(override.value) };
    return { mode: 'keep', value: '' };
  }

  function resolveSource(source, overrides) {
    const o = normalizeOverride(overrides?.[source?.key]);
    if (o.mode === 'blank') return { text: '', isRed: Boolean(source?.isRed), key: source?.key || '' };
    if (o.mode === 'replace') return { text: o.value, isRed: Boolean(source?.isRed), key: source?.key || '' };
    return { text: source?.text === null || source?.text === undefined ? '' : String(source.text), isRed: Boolean(source?.isRed), key: source?.key || '' };
  }

  function resolveCell(cell, overrides) {
    if (!cell) return { text: '', isRed: false, segments: [], sources: [] };
    const sources = Array.isArray(cell.sources) ? cell.sources : [];
    if (Array.isArray(cell.segments) && cell.segments.length) {
      const resolved = [];
      for (const seg of cell.segments) {
        const src = sources.find((s) => s.key === seg.key) || (seg.key ? { key: seg.key, text: seg.text, isRed: seg.isRed } : null);
        const r = src ? resolveSource(src, overrides) : { text: String(seg.text ?? ''), isRed: Boolean(seg.isRed), key: seg.key || '' };
        if (r.text !== '') resolved.push(r);
      }
      const separator = cell.separator === undefined ? '' : String(cell.separator);
      return {
        text: resolved.map((s) => s.text).join(separator),
        isRed: resolved.length > 0 && resolved.every((s) => s.isRed),
        segments: resolved,
        separator,
        sources,
      };
    }
    if (sources.length > 1) {
      const separator = cell.separator === undefined ? ' ' : String(cell.separator);
      const resolved = sources.map((s) => resolveSource(s, overrides)).filter((s) => s.text !== '');
      return { text: resolved.map((s) => s.text).join(separator), isRed: resolved.length > 0 && resolved.every((s) => s.isRed), segments: resolved, separator, sources };
    }
    if (sources.length === 1) {
      const r = resolveSource(sources[0], overrides);
      return { text: r.text, isRed: r.isRed, segments: [r], separator: '', sources };
    }
    return { text: String(cell.text ?? ''), isRed: Boolean(cell.isRed), segments: [{ text: String(cell.text ?? ''), isRed: Boolean(cell.isRed), key: '' }], separator: '', sources: [] };
  }

  function buildTechnicalReport({ version, stage, warning, error }) {
    const nav = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/test runtime';
    const safeError = error ? String(error?.message || error) : '';
    const w = warning || {};
    return [
      `Journal PDF ${version}`,
      `Браузер: ${nav}`,
      `Етап: ${stage || 'невідомо'}`,
      `Файл: ${w.file || ''}`,
      `Аркуш: ${w.sheet || ''}`,
      `Клітинка: ${w.cell || ''}`,
      `Тип: ${w.kind || (error ? 'technical_error' : '')}`,
      `Технічний текст: ${safeError || w.message || ''}`,
    ].join('\n');
  }

  root.JournalValidation = { resolveCell, resolveSource, normalizeOverride, buildTechnicalReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.JournalValidation;
})(typeof globalThis !== 'undefined' ? globalThis : self);
