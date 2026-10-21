import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fmtDate } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Loans() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const qc = useQueryClient();
  const loans = useQuery({ queryKey: ['loans'], queryFn: () => api.loans() });
  const giveBack = useMutation({
    mutationFn: api.returnLoan,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loans'] });
      void qc.invalidateQueries({ queryKey: ['books'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const open = loans.data?.filter((l) => !l.returned_at) ?? [];
  const history = loans.data?.filter((l) => l.returned_at) ?? [];

  return (
    <section>
      <h1>{admin ? 'All loans' : 'My loans'}</h1>
      <h2>On loan ({open.length})</h2>
      <table>
        <thead><tr><th>Book</th>{admin && <th>Member</th>}<th>Borrowed</th><th>Due</th><th>Status</th><th /></tr></thead>
        <tbody>
          {open.map((l) => (
            <tr key={l.id}>
              <td><span className="strong">{l.title}</span><br /><small className="muted">{l.author}</small></td>
              {admin && <td>{l.member}</td>}
              <td>{fmtDate(l.borrowed_at)}</td>
              <td>{fmtDate(l.due_at)}</td>
              <td>{l.overdue ? <span className="bad">Overdue</span> : <span className="ok">On time</span>}</td>
              <td className="actions"><button disabled={giveBack.isPending} onClick={() => giveBack.mutate(l.id)}>Return</button></td>
            </tr>
          ))}
          {open.length === 0 && <tr><td colSpan={6} className="muted">Nothing on loan.</td></tr>}
        </tbody>
      </table>
      <h2>History</h2>
      <table>
        <thead><tr><th>Book</th>{admin && <th>Member</th>}<th>Borrowed</th><th>Returned</th></tr></thead>
        <tbody>
          {history.slice(0, 50).map((l) => (
            <tr key={l.id}>
              <td>{l.title}</td>
              {admin && <td>{l.member}</td>}
              <td>{fmtDate(l.borrowed_at)}</td>
              <td>{fmtDate(l.returned_at!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
