"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Member } from "@/lib/api";

function initialOf(member: Member): string {
  const source = member.name?.trim() || member.email;
  return source.charAt(0).toUpperCase() || "?";
}

export default function PeoplePanel({ projectId }: { projectId: string }) {
  const { getToken } = useAuth();
  // Keep the latest getToken without making effects depend on it.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const list = await api.listMembers(projectId, token);
      setMembers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load people");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = members.some((m) => m.is_you && m.role === "owner");

  const invite = async () => {
    const value = email.trim();
    if (!value || inviting) return;
    setInviting(true);
    setNotice(null);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const member = await api.inviteMember(projectId, value, token);
      setMembers((prev) => [...prev, member]);
      setEmail("");
      setNotice(`${member.name || member.email} can now work on this project.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite that person");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          People on this project
        </p>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {notice}
          </div>
        )}

        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
              {initialOf(member)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {member.name || member.email}
                {member.is_you && <span className="ml-1 text-xs text-slate-400">(you)</span>}
              </span>
              {member.name && (
                <span className="block truncate text-[11px] text-slate-500">{member.email}</span>
              )}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                member.role === "owner"
                  ? "bg-indigo-100 text-indigo-600"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {member.role}
            </span>
          </div>
        ))}

        {!loading && !error && members.length === 0 && (
          <p className="text-sm text-slate-500">No one here yet.</p>
        )}
      </div>

      {isOwner && (
        <div className="border-t border-slate-200 p-3">
          <label className="block text-xs font-medium text-slate-600">
            Invite by email
            <div className="mt-1 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    invite();
                  }
                }}
                placeholder="teammate@example.com"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={invite}
                disabled={inviting || !email.trim()}
                className="shrink-0 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {inviting ? "..." : "Invite"}
              </button>
            </div>
          </label>
          <p className="mt-2 text-[11px] text-slate-500">
            They need to have signed in to Ghost AI at least once.
          </p>
        </div>
      )}
    </div>
  );
}
