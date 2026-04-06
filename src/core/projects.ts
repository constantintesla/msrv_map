import type { Project, ProjectData } from '../types';
import { state } from './state';

const STORAGE_KEY = 'msrv_map_projects';

function getAll(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects(): Project[] {
  return getAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveProject(name: string): Project {
  if (!name.trim()) throw new Error('Название проекта обязательно');

  const snap = state.snapshot();
  const data: ProjectData = { ...snap };
  // Remove UI-only fields
  delete (data as any).markerMode;
  delete (data as any).zoneSelectionMode;

  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    data,
  };

  const all = getAll();
  all.push(project);
  saveAll(all);
  return project;
}

export function loadProject(id: string): void {
  const project = getAll().find(p => p.id === id);
  if (!project) throw new Error('Проект не найден');

  state.load(project.data);
}

export function deleteProject(id: string): void {
  const all = getAll().filter(p => p.id !== id);
  saveAll(all);
}
