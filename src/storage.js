// Всё хранится в localStorage браузера пользователя. Бэкенда нет.
// Имя ключа не меняем никогда: другой ключ = у всех пользователей пустое приложение.
// Версия данных живёт внутри самого объекта, в поле version.
const KEY = 'drss-portfolio:v1';
// Копия данных до миграции — страховка, если миграция окажется кривой.
const BACKUP_KEY = 'drss-portfolio:backup';

// Текущая версия схемы. При изменении структуры данных: поднять число,
// добавить миграцию в MIGRATIONS и строку в SCHEMA.md.
export const VERSION = 1;

// Миграции старых копий. Ключ — версия, ИЗ которой переводим.
// Применяются по цепочке (1 → 2 → 3…), пока не дойдём до VERSION,
// поэтому промежуточные версии пропускать нельзя.
// Каждая функция получает и возвращает сырой объект данных вместе с новым version.
const MIGRATIONS = {
  // Пример будущей миграции:
  // 1: (d) => ({
  //   ...d,
  //   version: 2,
  //   projects: d.projects.map((p) => ({ ...p, priority: '' })),
  // }),
};

// Ошибка с текстом, который не стыдно показать пользователю.
const fail = (text) => {
  throw Object.assign(new Error(text), { userText: text });
};

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Перед первой миграцией откладываем копию исходных данных.
    if ((Number(parsed?.version) || 1) < VERSION) backup(raw);
    return normalize(parsed);
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

function backup(raw) {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    // Не смогли сохранить копию — не повод ронять загрузку.
  }
}

export function uid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Переводит данные к текущей версии схемы.
function migrate(d) {
  let out = d;
  let v = Number(out.version) || 1;
  if (v > VERSION) {
    fail(`Файл сделан в более новой версии приложения (схема v${v}, здесь v${VERSION}). Обновите страницу и попробуйте снова.`);
  }
  while (v < VERSION) {
    const step = MIGRATIONS[v];
    if (!step) fail(`Нет миграции данных с версии v${v}. Напишите разработчику, копию файла не удаляйте.`);
    out = step(out);
    const next = Number(out.version) || 0;
    // Страховка от миграции, которая забыла поднять version: иначе вечный цикл.
    v = next > v ? next : v + 1;
  }
  return out;
}

// Проверяет и дополняет структуру (для импорта из файла и старых версий).
export function normalize(input) {
  if (!input || !Array.isArray(input.employees) || !Array.isArray(input.projects)) {
    fail('Файл не распознан. Нужен JSON, скачанный кнопкой «Скачать копию».');
  }
  const d = migrate(input);
  return {
    version: VERSION,
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
