import { useMemo, useState } from 'react';
import {
  PROJECT_TYPES, TYPE_ORDER, assignmentFte, cmpRu, employeeLoad, isActiveProject, isWorking, loadTone, num, pct,
} from '../model.js';
import { Legend, LoadBar, TypeTag } from './ui.jsx';
import { downloadCsv } from '../csv.js';

export default function Summary({ data, empById }) {
  const [empFilter, setEmpFilter] = useState('');

  const s = useMemo(() => {
    const active = data.employees.filter(isWorking);
    const capacity = active.reduce((acc, e) => acc + Number(e.rate), 0);
    const projects = data.projects.filter(isActiveProject);

    const projRows = projects.map((p) => {
      const fte = p.assignments.reduce((acc, a) => acc + assignmentFte(a, empById), 0);
      return { p, fte, people: p.assignments.length };
    });
    const distributed = projRows.reduce((acc, r) => acc + r.fte, 0);

    const byType = TYPE_ORDER.map((t) => {
      const rows = projRows.filter((r) => r.p.type === t);
      const people = new Set(rows.flatMap((r) => r.p.assignments.map((a) => a.employeeId)));
      const fte = rows.reduce((acc, r) => acc + r.fte, 0);
      return { type: t, count: rows.length, people: people.size, fte };
    });

    const approvedPeople = new Set(
      projRows.filter((r) => PROJECT_TYPES[r.p.type].group === 'approved')
        .flatMap((r) => r.p.assignments.map((a) => a.employeeId)),
    ).size;

    const empRows = data.employees
      .filter((e) => e.status !== 'Уволен')
      .map((e) => {
        const l = employeeLoad(e.id, data.projects);
        const fte = (l.percent / 100) * Number(e.rate);
        return { e, load: l.percent, items: l.items, fte };
      });

    return {
      active, capacity, projects, distributed,
      projRows: projRows.sort((a, b) => b.fte - a.fte),
      byType,
      approvedPeople,
      empRows: empRows.sort((a, b) => b.load - a.load || cmpRu(a.e.name, b.e.name)),
      over: empRows.filter((r) => r.load > 100).length,
      idle: empRows.filter((r) => r.load === 0 && isWorking(r.e)).length,
    };
  }, [data, empById]);

  const share = (fte) => (s.distributed > 0 ? (fte / s.distributed) * 100 : 0);
  const approved = s.byType.filter((r) => PROJECT_TYPES[r.type].group === 'approved');
  const approvedFte = approved.reduce((a, r) => a + r.fte, 0);
  const maxProjFte = Math.max(0.0001, ...s.projRows.map((r) => r.fte));
  const empShown = s.empRows.filter((r) => !empFilter || loadTone(r.load) === empFilter || (empFilter === 'idle' && r.load === 0));

  const exportProjects = () => downloadCsv('проекты-fte', [
    ['Проект', 'Тип', 'Статус', 'Людей', 'FTE', 'Доля от распределённого, %'],
    ...s.projRows.map((r) => [r.p.name, PROJECT_TYPES[r.p.type].full, r.p.status, r.people, r.fte.toFixed(2), share(r.fte).toFixed(1)]),
  ]);
  const exportEmployees = () => downloadCsv('загрузка-сотрудников', [
    ['ФИО', 'Должность', 'Формат', 'Ставка', 'Статус', 'Проектов', 'Загрузка, %', 'FTE', 'Проекты'],
    ...s.empRows.map((r) => [
      r.e.name, r.e.position, r.e.format, r.e.rate, r.e.status, r.items.length, r.load, r.fte.toFixed(2),
      r.items.map((i) => `${i.project.name} (${i.percent}%)`).join('; '),
    ]),
  ]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Сводное</h1>
          <p className="sub">По незавершённым проектам и сотрудникам со статусом «Активен»</p>
        </div>
      </div>

      <dl className="figures">
        <div><dt>Мощность департамента</dt><dd>{num(s.capacity)} <small>FTE</small></dd><span className="muted small">{s.active.length} активных сотрудников</span></div>
        <div><dt>Распределено по проектам</dt><dd>{num(s.distributed)} <small>FTE</small></dd><span className="muted small">{pct(s.capacity ? (s.distributed / s.capacity) * 100 : 0)} мощности, {s.projects.length} проектов</span></div>
        <div><dt>Свободно</dt><dd>{num(Math.max(0, s.capacity - s.distributed))} <small>FTE</small></dd><span className="muted small">{s.idle} чел. без проектов</span></div>
        <div className={s.over ? 'alert' : ''}><dt>Перегружены</dt><dd>{s.over} <small>чел.</small></dd><span className="muted small">загрузка больше 100%</span></div>
      </dl>

      <div className="block">
        <h2>Распределение по типам проектов</h2>
        <div className="stackbar" aria-hidden="true">
          {s.byType.map((r) => r.fte > 0 && (
            <span key={r.type} className={`seg t-${r.type}`} style={{ width: `${share(r.fte)}%` }} title={`${PROJECT_TYPES[r.type].label}: ${num(r.fte)} FTE`} />
          ))}
        </div>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr><th>Тип</th><th className="r">Проектов</th><th className="r">Людей</th><th className="r">FTE</th><th className="r">Доля</th></tr>
            </thead>
            <tbody>
              <tr className="group-row">
                <td>Утверждённые</td>
                <td className="r num">{approved.reduce((a, r) => a + r.count, 0)}</td>
                <td className="r num">{s.approvedPeople}</td>
                <td className="r num strong">{num(approvedFte)}</td>
                <td className="r num strong">{pct(share(approvedFte))}</td>
              </tr>
              {s.byType.map((r) => (
                <tr key={r.type} className={PROJECT_TYPES[r.type].group === 'approved' ? 'nested' : ''}>
                  <td><i className={`dot t-${r.type}`} />{PROJECT_TYPES[r.type].group === 'approved' ? PROJECT_TYPES[r.type].label : PROJECT_TYPES[r.type].plural}</td>
                  <td className="r num">{r.count}</td>
                  <td className="r num">{r.people}</td>
                  <td className="r num strong">{num(r.fte)}</td>
                  <td className="r num">{pct(share(r.fte))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Всего</td><td className="r num">{s.projects.length}</td><td /><td className="r num strong">{num(s.distributed)}</td><td className="r num">100%</td></tr>
            </tfoot>
          </table>
        </div>
        <p className="muted small">«Людей» в строке типа считается без повторов; один человек может работать в нескольких типах.</p>
      </div>

      <div className="block">
        <div className="block-head">
          <h2>Проекты по FTE</h2>
          <button className="btn small" onClick={exportProjects} disabled={!s.projRows.length}>Скачать CSV</button>
        </div>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr><th>Проект</th><th>Тип</th><th className="r">Людей</th><th className="r">FTE</th><th className="w-bar">Доля от распределённого</th></tr>
            </thead>
            <tbody>
              {s.projRows.map((r) => (
                <tr key={r.p.id}>
                  <td>{r.p.name}</td>
                  <td><TypeTag type={r.p.type} /></td>
                  <td className="r num">{r.people}</td>
                  <td className="r num strong">{num(r.fte)}</td>
                  <td>
                    <div className="hbar">
                      <span className={`fill t-${r.p.type}`} style={{ width: `${(r.fte / maxProjFte) * 100}%` }} />
                      <b className="num">{pct(share(r.fte))}</b>
                    </div>
                  </td>
                </tr>
              ))}
              {s.projRows.length === 0 && (
                <tr><td colSpan={5} className="empty">Добавьте проекты и назначьте на них людей, чтобы здесь появилась картина.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="block">
        <div className="block-head">
          <h2>Загрузка сотрудников</h2>
          <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} aria-label="Фильтр загрузки">
            <option value="">Все ({s.empRows.length})</option>
            <option value="over">Перегружены</option>
            <option value="ok">Норма 80–100%</option>
            <option value="under">Недогружены</option>
            <option value="idle">Без проектов</option>
          </select>
          <button className="btn small" onClick={exportEmployees}>Скачать CSV</button>
        </div>
        <Legend />
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr><th>Сотрудник</th><th>Формат</th><th className="r">Ставка</th><th className="r">Проектов</th><th className="r">FTE</th><th className="w-load">Загрузка по проектам</th></tr>
            </thead>
            <tbody>
              {empShown.map((r) => (
                <tr key={r.e.id} className={isWorking(r.e) ? '' : 'dim'}>
                  <td>{r.e.name}<span className="muted small block">{r.e.position}{isWorking(r.e) ? '' : `, ${r.e.status.toLowerCase()}`}</span></td>
                  <td>{r.e.format}</td>
                  <td className="r num">{num(r.e.rate)}</td>
                  <td className="r num">{r.items.length}</td>
                  <td className="r num">{num(r.fte)}</td>
                  <td><LoadBar items={r.items} total={r.load} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
