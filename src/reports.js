// Сборка листов для выгрузки в Excel. Только чтение: считает через model.js,
// чтобы цифры в файле совпадали с тем, что показано на экране.
import { PROJECT_TYPES, assignmentFte, employeeLoad, projectFte, summarize } from './model.js';

const typeFull = (t) => PROJECT_TYPES[t]?.full || t;
const typeShort = (t) => PROJECT_TYPES[t]?.label || t;
const nameOf = (empById, id) => empById.get(id)?.name || '';
const round = (n) => Math.round(Number(n) * 100) / 100;
const projectList = (items) => items.map((i) => `${i.project.name} (${i.percent}%)`).join('; ');

export function employeesSheet(employees, projects, empById, name = 'Сотрудники') {
  return {
    name,
    columns: [
      { header: 'ФИО', width: 28 },
      { header: 'Должность', width: 20 },
      { header: 'Руководитель', width: 24 },
      { header: 'Формат', width: 14 },
      { header: 'Дней в офисе', width: 13, type: 'int' },
      { header: 'Ставка', width: 9, type: 'num' },
      { header: 'Статус', width: 12 },
      { header: 'Дата начала', width: 13, type: 'date' },
      { header: 'Компетенции', width: 24 },
      { header: 'Проектов', width: 10, type: 'int' },
      { header: 'Загрузка, %', width: 12, type: 'int' },
      { header: 'FTE', width: 9, type: 'num' },
      { header: 'Проекты', width: 50 },
      { header: 'Комментарий', width: 30 },
    ],
    rows: employees.map((e) => {
      const l = employeeLoad(e.id, projects);
      return [
        e.name,
        e.position,
        nameOf(empById, e.managerId),
        e.format,
        e.format === 'Гибрид' ? e.officeDays : '',
        Number(e.rate),
        e.status,
        e.startDate,
        e.skills,
        l.items.length,
        l.percent,
        round((l.percent / 100) * Number(e.rate)),
        projectList(l.items),
        e.note,
      ];
    }),
  };
}

export function projectsSheet(projects, empById, name = 'Проекты') {
  return {
    name,
    columns: [
      { header: 'Проект', width: 34 },
      { header: 'Код', width: 14 },
      { header: 'Тип', width: 28 },
      { header: 'Заказчик', width: 20 },
      { header: 'Руководитель', width: 24 },
      { header: 'Статус', width: 14 },
      { header: 'Начало', width: 12, type: 'date' },
      { header: 'Окончание', width: 12, type: 'date' },
      { header: 'Основание', width: 26 },
      { header: 'Бюджет, ₸', width: 16 },
      { header: 'Плановый FTE', width: 13, type: 'num' },
      { header: 'Факт FTE', width: 10, type: 'num' },
      { header: 'Людей', width: 9, type: 'int' },
      { header: 'Описание', width: 44 },
    ],
    rows: projects.map((p) => [
      p.name,
      p.code,
      typeFull(p.type),
      p.customer,
      nameOf(empById, p.managerId),
      p.status,
      p.startDate,
      p.endDate,
      p.basis,
      p.budget,
      p.plannedFte === '' ? '' : Number(p.plannedFte),
      round(projectFte(p, empById)),
      p.assignments.length,
      p.note,
    ]),
  };
}

export function assignmentsSheet(projects, empById, name = 'Назначения') {
  const rows = [];
  for (const p of projects) {
    for (const a of p.assignments) {
      const e = empById.get(a.employeeId);
      rows.push([
        p.name,
        typeShort(p.type),
        p.status,
        e?.name || 'Удалённый сотрудник',
        e?.position || '',
        Number(e?.rate ?? 0),
        Number(a.percent) || 0,
        round(assignmentFte(a, empById)),
      ]);
    }
  }
  return {
    name,
    columns: [
      { header: 'Проект', width: 34 },
      { header: 'Тип', width: 18 },
      { header: 'Статус проекта', width: 14 },
      { header: 'Сотрудник', width: 28 },
      { header: 'Должность', width: 20 },
      { header: 'Ставка', width: 9, type: 'num' },
      { header: 'Доля, %', width: 9, type: 'int' },
      { header: 'FTE', width: 9, type: 'num' },
    ],
    rows,
  };
}

// Три таблицы раздела «Сводное» плюс лист с ключевыми показателями.
export function summarySheets(data, empById) {
  const s = summarize(data, empById);
  const share = (fte) => (s.distributed > 0 ? round((fte / s.distributed) * 100) : 0);

  const figures = {
    name: 'Показатели',
    columns: [
      { header: 'Показатель', width: 34 },
      { header: 'Значение', width: 14, type: 'auto' },
    ],
    rows: [
      ['Сотрудников в списке', data.employees.length],
      ['Активных сотрудников', s.active.length],
      ['Мощность департамента, FTE', round(s.capacity)],
      ['Распределено по проектам, FTE', round(s.distributed)],
      ['Свободно, FTE', round(Math.max(0, s.capacity - s.distributed))],
      ['Проектов всего', data.projects.length],
      ['Проектов незавершённых', s.projects.length],
      ['Перегружено, чел.', s.over],
      ['Без проектов, чел.', s.idle],
      ['Дата выгрузки', new Date().toLocaleDateString('ru-RU')],
    ],
  };

  const byType = {
    name: 'Свод по типам',
    columns: [
      { header: 'Тип', width: 30 },
      { header: 'Проектов', width: 11, type: 'int' },
      { header: 'Людей', width: 9, type: 'int' },
      { header: 'FTE', width: 10, type: 'num' },
      { header: 'Доля, %', width: 10, type: 'num' },
    ],
    rows: s.byType.map((r) => [typeFull(r.type), r.count, r.people, round(r.fte), share(r.fte)]),
  };

  const byProject = {
    name: 'Проекты по FTE',
    columns: [
      { header: 'Проект', width: 34 },
      { header: 'Тип', width: 18 },
      { header: 'Статус', width: 14 },
      { header: 'Людей', width: 9, type: 'int' },
      { header: 'FTE', width: 10, type: 'num' },
      { header: 'Доля от распределённого, %', width: 24, type: 'num' },
    ],
    rows: s.projRows.map((r) => [r.p.name, typeShort(r.p.type), r.p.status, r.people, round(r.fte), share(r.fte)]),
  };

  const load = {
    name: 'Загрузка',
    columns: [
      { header: 'Сотрудник', width: 28 },
      { header: 'Должность', width: 20 },
      { header: 'Формат', width: 14 },
      { header: 'Ставка', width: 9, type: 'num' },
      { header: 'Статус', width: 12 },
      { header: 'Проектов', width: 10, type: 'int' },
      { header: 'Загрузка, %', width: 12, type: 'int' },
      { header: 'FTE', width: 9, type: 'num' },
      { header: 'Проекты', width: 50 },
    ],
    rows: s.empRows.map((r) => [
      r.e.name, r.e.position, r.e.format, Number(r.e.rate), r.e.status,
      r.items.length, r.load, round(r.fte), projectList(r.items),
    ]),
  };

  return [figures, byType, byProject, load];
}

// Вся книга: реестры целиком плюс сводные таблицы.
export function workbookSheets(data, empById) {
  const [figures, ...rest] = summarySheets(data, empById);
  return [
    figures,
    employeesSheet(data.employees, data.projects, empById),
    projectsSheet(data.projects, empById),
    assignmentsSheet(data.projects, empById),
    ...rest,
  ];
}
