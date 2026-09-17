import { useEffect, useMemo, useRef, useState } from 'react';
import Employees from './components/Employees.jsx';
import Projects from './components/Projects.jsx';
import Summary from './components/Summary.jsx';
import { createSeed } from './seed.js';
import { loadData, normalize, saveData } from './storage.js';
import { downloadBlob, today } from './csv.js';
import { downloadXlsx } from './xlsx.js';
import { workbookSheets } from './reports.js';

const NAV = [
  { id: 'employees', label: 'Сотрудники' },
  { id: 'projects', label: 'Проекты' },
  { id: 'summary', label: 'Сводное' },
];

export default function App() {
  const [data, setData] = useState(() => loadData() ?? createSeed());
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.slice(1);
    return NAV.some((n) => n.id === h) ? h : 'employees';
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { setSaveFailed(!saveData(data)); }, [data]);
  useEffect(() => { window.history.replaceState(null, '', `#${tab}`); }, [tab]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const empById = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);

  const api = useMemo(() => {
    const upsert = (list, item) =>
      list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
    return {
      upsertEmployee: (e) => { setData((d) => ({ ...d, employees: upsert(d.employees, e) })); setToast('Сотрудник сохранён'); },
      deleteEmployee: (id) => {
        setData((d) => ({
          ...d,
          employees: d.employees.filter((x) => x.id !== id).map((x) => (x.managerId === id ? { ...x, managerId: '' } : x)),
          projects: d.projects.map((p) => ({
            ...p,
            managerId: p.managerId === id ? '' : p.managerId,
            assignments: p.assignments.filter((a) => a.employeeId !== id),
          })),
        }));
        setToast('Сотрудник удалён');
      },
      upsertProject: (p) => { setData((d) => ({ ...d, projects: upsert(d.projects, p) })); setToast('Проект сохранён'); },
      deleteProject: (id) => { setData((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id) })); setToast('Проект удалён'); },
    };
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `drss-portfolio-${today()}.json`);
    setToast('Резервная копия скачана');
  };

  const exportXlsx = () => {
    downloadXlsx('портфель-дрсс', workbookSheets(data, empById));
    setToast('Книга Excel скачана');
  };

  const importJson = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalize(JSON.parse(String(reader.result)));
        if (window.confirm(`В файле ${next.employees.length} сотрудников и ${next.projects.length} проектов. Заменить ими текущие данные?`)) {
          setData(next);
          setToast('Данные загружены из файла');
        }
      } catch (e) {
        // userText ставит storage.js: битый формат, слишком новая схема, нет миграции.
        window.alert(e?.userText || 'Файл не распознан. Нужен JSON, скачанный кнопкой «Скачать копию».');
      }
    };
    reader.readAsText(file);
  };

  const reset = () => {
    if (window.confirm('Сбросить всё к начальному списку сотрудников? Все проекты и изменения будут удалены. Сначала лучше скачать копию.')) {
      setData(createSeed());
      setToast('Данные сброшены');
    }
  };

  const counts = { employees: data.employees.length, projects: data.projects.length };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>
            <b>Портфель ДРСС</b>
            <small>Проекты и загрузка</small>
          </span>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${tab === n.id ? 'on' : ''}`}
              aria-current={tab === n.id ? 'page' : undefined} onClick={() => setTab(n.id)}>
              {n.label}
              {counts[n.id] !== undefined && <span className="count">{counts[n.id]}</span>}
            </button>
          ))}
        </nav>

        <div className="side-data">
          <p className="side-note">
            Данные хранятся только в этом браузере на этом компьютере. Регулярно скачивайте копию.
          </p>
          <button className="btn side-btn" onClick={exportJson}>Скачать копию</button>
          <button className="btn side-btn" onClick={() => fileRef.current?.click()}>Загрузить из файла</button>
          <button className="btn side-btn" onClick={exportXlsx}>Выгрузить в Excel</button>
          <button className="btn side-btn danger-ghost" onClick={reset}>Сбросить к начальному списку</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </aside>

      <main className="main">
        {saveFailed && (
          <div className="banner" role="alert">
            Браузер не даёт сохранять данные (возможно, режим инкогнито или запрет хранилища). Изменения пропадут после закрытия вкладки — скачайте копию.
          </div>
        )}
        {tab === 'employees' && <Employees data={data} empById={empById} api={api} />}
        {tab === 'projects' && <Projects data={data} empById={empById} api={api} />}
        {tab === 'summary' && <Summary data={data} empById={empById} />}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
