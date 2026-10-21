import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Members() {
  const users = useQuery({ queryKey: ['users'], queryFn: api.users });
  return (
    <section>
      <h1>Members</h1>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {users.data?.map((u) => (
            <tr key={u.id}><td className="strong">{u.name}</td><td>{u.email}</td><td><span className="pill">{u.role}</span></td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
