// Всё хранится в localStorage браузера пользователя. Бэкенда нет.
const KEY = 'drss-portfolio:v1';

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function uid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Проверяет и дополняет структуру (для импорта из файла и старых версий).
export function normalize(d) {
  if (!d || !Array.isArray(d.employees) || !Array.isArray(d.projects)) {
    throw new Error('bad format');
  }
  return {
    version: 1,
    employees: d.employees.map((e) => ({
      id: e.id || uid(),
      name: String(e.name || '').trim(),
      position: e.position || 'Инженер',
      managerId: e.managerId || '',
      format: e.format || 'Офис',
      officeDays: e.officeDays ?? 3,
      rate: Number(e.rate) || 1,
      status: e.status || 'Активен',
      startDate: e.startDate || '',
      skills: e.skills || '',
      note: e.note || '',
    })),
    projects: d.projects.map((p) => ({
      id: p.id || uid(),
      name: String(p.name || '').trim(),
      code: p.code || '',
      type: p.type || 'support',
      customer: p.customer || '',
      managerId: p.managerId || '',
      status: p.status || 'В работе',
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      basis: p.basis || '',
      budget: p.budget || '',
      plannedFte: p.plannedFte || '',
      note: p.note || '',
      assignments: Array.isArray(p.assignments)
        ? p.assignments.map((a) => ({ employeeId: a.employeeId, percent: Number(a.percent) || 0 }))
        : [],
    })),
  };
}
