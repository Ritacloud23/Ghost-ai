"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Project } from "@/lib/types";

export default function HomePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) {
      loadProjects();
    }
  }, [isSignedIn]);

  const loadProjects = async () => {
    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) return;
      const data = await api.listProjects(token);
      setProjects(data as Project[]);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) return;
      const project = await api.createProject(newName.trim(), token);
      router.push(`/project/${(project as Project).id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ghost AI</h1>
          <p className="text-gray-500">Welcome back, {user?.firstName || user?.emailAddresses[0]?.emailAddress}</p>
        </div>
      </div>

      <form onSubmit={createProject} className="mb-8 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !newName.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </form>

      <div className="space-y-3">
        {projects.length === 0 ? (
          <p className="text-center text-gray-400">No projects yet. Create your first one above.</p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push(`/project/${project.id}`)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{project.name}</h3>
                <p className="text-sm text-gray-500">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-gray-400">&rarr;</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
