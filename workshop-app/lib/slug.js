// Isomorphic helpers shared by the browser (download filenames) and the
// server (outputs/ folder names). No node imports here.

export function slugify(name) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug || 'client';
}

export function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-z0-9-]{8,64}$/i.test(id);
}

export function newSessionId() {
  const date = new Date().toISOString().slice(0, 10);
  let rand;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  } else {
    rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  }
  return `${date}-${rand}`;
}

export function sectionFileBase(letter) {
  return `section-${String(letter).toLowerCase()}`;
}

export function sectionDownloadName(clientName, letter, deliv) {
  return `${slugify(clientName)}-${sectionFileBase(letter)}-${slugify(deliv)}.md`;
}

export function workshopDownloadName(clientName) {
  return `${slugify(clientName)}-workshop-deliverables.md`;
}
