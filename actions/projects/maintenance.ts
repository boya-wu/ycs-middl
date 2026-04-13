'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------

export interface ProjectWithTasks {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tasks: TaskRow[];
}

export interface TaskRow {
  id: string;
  project_id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  budgeted_md: number | null;
  created_at: string;
  updated_at: string;
}

type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

export async function listProjectsWithTasks(): Promise<ActionResult<ProjectWithTasks[]>> {
  const supabase = createServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(*)')
      .order('code', { ascending: true });

    if (error) {
      throw new Error(`查詢專案列表失敗: ${error.message}`);
    }

    const projects = (data ?? []).map((p: any) => ({
      ...p,
      tasks: (p.tasks ?? []).sort((a: TaskRow, b: TaskRow) =>
        a.code.localeCompare(b.code)
      ),
    })) as ProjectWithTasks[];

    return { success: true, data: projects };
  } catch (error) {
    console.error('listProjectsWithTasks 錯誤:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知錯誤' };
  }
}

// ---------------------------------------------------------------------------
// 專案 CRUD
// ---------------------------------------------------------------------------

export async function createProject(params: {
  code: string;
  name: string;
  description?: string;
}): Promise<ActionResult> {
  const code = params.code?.trim();
  const name = params.name?.trim();
  if (!code) return { success: false, error: '專案代碼（PY）為必填' };
  if (!name) return { success: false, error: '專案名稱為必填' };

  const supabase = createServerSupabaseClient();

  try {
    const { error } = await supabase.from('projects').insert({ code, name, description: params.description?.trim() || null });
    if (error) {
      if (error.code === '23505') return { success: false, error: `專案代碼「${code}」已存在` };
      throw new Error(error.message);
    }
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/billing');
    return { success: true };
  } catch (error) {
    console.error('createProject 錯誤:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知錯誤' };
  }
}

export async function updateProject(params: {
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  status?: string;
}): Promise<ActionResult> {
  if (!params.id) return { success: false, error: '缺少專案 ID' };

  const patch: Record<string, unknown> = {};
  if (params.code !== undefined) {
    const code = params.code.trim();
    if (!code) return { success: false, error: '專案代碼不可為空' };
    patch.code = code;
  }
  if (params.name !== undefined) {
    const name = params.name.trim();
    if (!name) return { success: false, error: '專案名稱不可為空' };
    patch.name = name;
  }
  if (params.description !== undefined) patch.description = params.description?.trim() || null;
  if (params.status !== undefined) patch.status = params.status;

  if (Object.keys(patch).length === 0) return { success: false, error: '沒有要更新的欄位' };

  const supabase = createServerSupabaseClient();

  try {
    const { error } = await supabase.from('projects').update(patch).eq('id', params.id);
    if (error) {
      if (error.code === '23505') return { success: false, error: `專案代碼「${patch.code}」已存在` };
      throw new Error(error.message);
    }
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/billing');
    return { success: true };
  } catch (error) {
    console.error('updateProject 錯誤:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知錯誤' };
  }
}

// ---------------------------------------------------------------------------
// 任務 CRUD
// ---------------------------------------------------------------------------

export async function createTask(params: {
  project_id: string;
  code: string;
  name: string;
  description?: string;
  budgeted_md?: number | null;
}): Promise<ActionResult> {
  const code = params.code?.trim();
  const name = params.name?.trim();
  if (!params.project_id) return { success: false, error: '缺少所屬專案' };
  if (!code) return { success: false, error: '任務代碼（SR）為必填' };
  if (!name) return { success: false, error: '任務名稱為必填' };
  if (params.budgeted_md !== undefined && params.budgeted_md !== null && params.budgeted_md < 0) {
    return { success: false, error: '預算 MD 不可為負數' };
  }

  const supabase = createServerSupabaseClient();

  try {
    const { error } = await supabase.from('tasks').insert({
      project_id: params.project_id,
      code,
      name,
      description: params.description?.trim() || null,
      budgeted_md: params.budgeted_md ?? null,
    });
    if (error) {
      if (error.code === '23505') return { success: false, error: `同一專案下任務代碼「${code}」已存在` };
      throw new Error(error.message);
    }
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/billing');
    return { success: true };
  } catch (error) {
    console.error('createTask 錯誤:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知錯誤' };
  }
}

export async function updateTask(params: {
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  status?: string;
  budgeted_md?: number | null;
}): Promise<ActionResult> {
  if (!params.id) return { success: false, error: '缺少任務 ID' };

  const patch: Record<string, unknown> = {};
  if (params.code !== undefined) {
    const code = params.code.trim();
    if (!code) return { success: false, error: '任務代碼不可為空' };
    patch.code = code;
  }
  if (params.name !== undefined) {
    const name = params.name.trim();
    if (!name) return { success: false, error: '任務名稱不可為空' };
    patch.name = name;
  }
  if (params.description !== undefined) patch.description = params.description?.trim() || null;
  if (params.status !== undefined) patch.status = params.status;
  if (params.budgeted_md !== undefined) {
    if (params.budgeted_md !== null && params.budgeted_md < 0) {
      return { success: false, error: '預算 MD 不可為負數' };
    }
    patch.budgeted_md = params.budgeted_md;
  }

  if (Object.keys(patch).length === 0) return { success: false, error: '沒有要更新的欄位' };

  const supabase = createServerSupabaseClient();

  try {
    const { error } = await supabase.from('tasks').update(patch).eq('id', params.id);
    if (error) {
      if (error.code === '23505') return { success: false, error: `同一專案下任務代碼「${patch.code}」已存在` };
      throw new Error(error.message);
    }
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/billing');
    return { success: true };
  } catch (error) {
    console.error('updateTask 錯誤:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知錯誤' };
  }
}
