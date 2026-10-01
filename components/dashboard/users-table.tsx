"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateUserRole } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { formatPhone, timeAgo } from "@/lib/utilities/format";
import type { AppRole } from "@/types/domain";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  rescue_team_id: string | null;
  district: string | null;
  created_at: string;
};
type TeamRow = { id: string; call_sign: string; name: string };

export function UsersTable({ users, teams, currentUserId }: { users: UserRow[]; teams: TeamRow[]; currentUserId: string }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">User</th>
            <th scope="col" className="px-4 py-2 font-medium">Phone</th>
            <th scope="col" className="px-4 py-2 font-medium">Role</th>
            <th scope="col" className="px-4 py-2 font-medium">Rescue team</th>
            <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u) => (
            <UserRowEditor key={`${u.id}:${u.role}:${u.rescue_team_id}`} user={u} teams={teams} isSelf={u.id === currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRowEditor({ user, teams, isSelf }: { user: UserRow; teams: TeamRow[]; isSelf: boolean }) {
  const [role, setRole] = useState<AppRole>(user.role);
  const [team, setTeam] = useState<string | null>(user.rescue_team_id);
  const [pending, startTransition] = useTransition();
  const dirty = role !== user.role || (role === "rescue" && team !== user.rescue_team_id);

  function save() {
    startTransition(async () => {
      const res = await updateUserRole({ userId: user.id, role, rescueTeamId: role === "rescue" ? team : null });
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <tr>
      <td className="px-4 py-2">
        <p className="font-medium">{user.full_name ?? <span className="text-muted-foreground">Unnamed (guest/citizen)</span>}{isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p>
        <p className="text-xs text-muted-foreground">Joined {timeAgo(user.created_at)}</p>
      </td>
      <td className="px-4 py-2 tabular">{formatPhone(user.phone)}</td>
      <td className="px-4 py-2">
        <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={isSelf}>
          <SelectTrigger className="h-8 w-44" aria-label={`Role for ${user.full_name ?? "user"}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2">
        {role === "rescue" ? (
          <Select value={team ?? ""} onValueChange={setTeam}>
            <SelectTrigger className="h-8 w-36" aria-label="Rescue team"><SelectValue placeholder="Choose team" /></SelectTrigger>
            <SelectContent>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.call_sign}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
      </td>
    </tr>
  );
}
