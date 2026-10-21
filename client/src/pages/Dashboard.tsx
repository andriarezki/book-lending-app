import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';

const COLORS = ['#5b8def', '#4fb59a', '#f2a65a', '#c879c4', '#e3c34f'];

export default function Dashboard() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  if (!stats.data) return <p className="muted">Loading…</p>;
  const s = stats.data;
  const cards: [string, number, string?][] = [
    ['Titles', s.titles], ['Copies', s.copies], ['Members', s.members], ['On loan', s.onLoan], ['Overdue', s.overdue, s.overdue ? 'bad' : 'ok'],
  ];

  return (
    <section>
      <h1>Dashboard</h1>
      <div className="cards">
        {cards.map(([label, value, tone]) => (
          <div className="card stat" key={label}><span className="muted">{label}</span><b className={tone}>{value}</b></div>
        ))}
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Loans per month</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.perMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="loans" fill="#5b8def" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Most borrowed categories</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={s.topCategories} dataKey="loans" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {s.topCategories.map((c, i) => <Cell key={c.category} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
