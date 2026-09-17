export const POSITIONS = ['Директор департамента', 'Ведущий инженер', 'Старший инженер', 'Инженер'];
export const FORMATS = ['Офис', 'Гибрид', 'Удалённо', 'Совместитель', 'Аутстафф'];
export const RATES = [
  { value: 1, label: 'Полная ставка (1,0)' },
  { value: 0.75, label: '0,75 ставки' },
  { value: 0.5, label: 'Полставки (0,5)' },
  { value: 0.25, label: '0,25 ставки' },
];
export const EMPLOYEE_STATUSES = ['Активен', 'Отпуск', 'Декрет', 'Уволен'];
export const PROJECT_STATUSES = ['Планируется', 'В работе', 'Приостановлен', 'Завершён'];

export const PROJECT_TYPES = {
  support: { label: 'Сопровождение', full: 'Утверждённый: сопровождение', group: 'approved' },
  development: { label: 'Развитие', full: 'Утверждённый: развитие', group: 'approved' },
  unapproved: { label: 'Неутверждённый', plural: 'Неутверждённые', full: 'Неутверждённый (по поручению)', group: 'unapproved' },
  initiative: { label: 'Инициативный', plural: 'Инициативные', full: 'Инициативный проект департамента', group: 'initiative' },
};
export const TYPE_ORDER = ['support', 'development', 'unapproved', 'initiative'];

export const isActiveProject = (p) => p.status !== 'Завершён';
export const isWorking = (e) => e.status === 'Активен';

export function rateLabel(rate) {
  return RATES.find((r) => r.value === Number(rate))?.label ?? String(rate);
}

// Загрузка сотрудника = сумма долей участия (%) в незавершённых проектах.
export function employeeLoad(empId, projects, exceptProjectId) {
  let percent = 0;
  const items = [];
  for (const p of projects) {
    if (!isActiveProject(p) || p.id === exceptProjectId) continue;
    for (const a of p.assignments) {
      if (a.employeeId === empId) {
        const v = Number(a.percent) || 0;
        percent += v;
        items.push({ project: p, percent: v });
      }
    }
  }
  return { percent, items };
}

// FTE назначения = доля участия × ставка сотрудника.
// Пример: полставки (0,5) и 100% времени на проекте = 0,5 FTE.
export function assignmentFte(a, empById) {
  const e = empById.get(a.employeeId);
  if (!e) return 0;
  return ((Number(a.percent) || 0) / 100) * (Number(e.rate) || 0);
}

export function projectFte(p, empById) {
  return p.assignments.reduce((s, a) => s + assignmentFte(a, empById), 0);
}

export function loadTone(pct) {
  if (pct > 100) return 'over';
  if (pct >= 80) return 'ok';
  return 'under';
}

export const num = (n, digits = 2) =>
  Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (n) => `${Math.round(n)}%`;

export const cmpRu = (a, b) => String(a).localeCompare(String(b), 'ru');
