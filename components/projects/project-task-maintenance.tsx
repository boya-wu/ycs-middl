'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ProjectWithTasks, TaskRow } from '@/actions/projects/maintenance';
import {
  createProject,
  updateProject,
  createTask,
  updateTask,
} from '@/actions/projects/maintenance';

// ---------------------------------------------------------------------------
// 狀態標籤
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'active', label: '啟用' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已封存' },
] as const;

const TASK_STATUS_OPTIONS = [
  { value: 'active', label: '啟用' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
] as const;

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'active'
      ? 'default'
      : status === 'completed'
        ? 'secondary'
        : 'outline';
  const label =
    [...STATUS_OPTIONS, ...TASK_STATUS_OPTIONS].find((o) => o.value === status)?.label ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectTaskMaintenanceProps {
  initialProjects: ProjectWithTasks[];
}

// ---------------------------------------------------------------------------
// 主元件
// ---------------------------------------------------------------------------

export function ProjectTaskMaintenance({ initialProjects }: ProjectTaskMaintenanceProps) {
  const projects = initialProjects;
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjects[0]?.id ?? null
  );

  // Dialog 狀態
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithTasks | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) setSelectedProjectId(null);
      return;
    }
    if (selectedProjectId && projects.some((p) => p.id === selectedProjectId)) return;
    setSelectedProjectId(projects[0]?.id ?? null);
  }, [projects, selectedProjectId]);

  // -- 專案 Dialog 開啟 -------------------------------------------------------
  function openCreateProject() {
    setEditingProject(null);
    setProjectDialogOpen(true);
  }
  function openEditProject(project: ProjectWithTasks) {
    setEditingProject(project);
    setProjectDialogOpen(true);
  }

  // -- 任務 Dialog 開啟 -------------------------------------------------------
  function openCreateTask() {
    setEditingTask(null);
    setTaskDialogOpen(true);
  }
  function openEditTask(task: TaskRow) {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* ====== 專案表格 ====== */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">專案列表（PY）</h2>
          <Button size="sm" onClick={openCreateProject}>
            <Plus className="mr-1.5 h-4 w-4" />
            新增專案
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-36">代碼</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead className="w-24">狀態</TableHead>
                <TableHead className="w-20 text-center">任務數</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    尚無專案，請新增第一筆
                  </TableCell>
                </TableRow>
              )}
              {projects.map((p) => {
                const isSelected = p.id === selectedProjectId;
                return (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer ${isSelected ? 'bg-muted/60' : 'hover:bg-muted/30'}`}
                    onClick={() => setSelectedProjectId(p.id)}
                  >
                    <TableCell className="px-2 text-center">
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${isSelected ? 'rotate-90 text-foreground' : 'text-muted-foreground'}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-center">{p.tasks.length}</TableCell>
                    <TableCell className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); openEditProject(p); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ====== 任務表格 ====== */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            {selectedProject
              ? `${selectedProject.code} — 任務列表（SR）`
              : '請先選擇專案'}
          </h2>
          {selectedProject && (
            <Button size="sm" onClick={openCreateTask}>
              <Plus className="mr-1.5 h-4 w-4" />
              新增任務
            </Button>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">代碼</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead className="w-32 text-right">預算 MD</TableHead>
                <TableHead className="w-24">狀態</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedProject && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    請在上方選擇一個專案以顯示任務
                  </TableCell>
                </TableRow>
              )}
              {selectedProject && selectedProject.tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    此專案尚無任務，請新增第一筆
                  </TableCell>
                </TableRow>
              )}
              {selectedProject?.tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.code}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {t.budgeted_md !== null ? t.budgeted_md.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="px-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditTask(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ====== Dialogs ====== */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        editing={editingProject}
      />
      {selectedProject && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          editing={editingTask}
          projectId={selectedProject.id}
          projectCode={selectedProject.code}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 專案 Dialog
// ---------------------------------------------------------------------------

function ProjectDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ProjectWithTasks | null;
}) {
  const router = useRouter();
  const isEdit = !!editing;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [isPending, startTransition] = useTransition();

  // 每次開啟時重設表單
  const handleOpenChange = (v: boolean) => {
    if (v && editing) {
      setCode(editing.code);
      setName(editing.name);
      setDescription(editing.description ?? '');
      setStatus(editing.status);
    } else if (v) {
      setCode('');
      setName('');
      setDescription('');
      setStatus('active');
    }
    onOpenChange(v);
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateProject({ id: editing!.id, code, name, description, status })
        : await createProject({ code, name, description });

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? '專案已更新' : '專案已新增');
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯專案' : '新增專案'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="proj-code">代碼 (PY) *</Label>
            <Input id="proj-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如 PY_2026_001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-name">名稱 *</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="專案名稱" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-desc">說明</Label>
            <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="選填" />
          </div>
          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="proj-status">狀態</Label>
              <Select id="proj-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={isPending || !code.trim() || !name.trim()}>
            {isPending ? '處理中…' : isEdit ? '儲存' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 任務 Dialog
// ---------------------------------------------------------------------------

function TaskDialog({
  open,
  onOpenChange,
  editing,
  projectId,
  projectCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TaskRow | null;
  projectId: string;
  projectCode: string;
}) {
  const router = useRouter();
  const isEdit = !!editing;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetedMd, setBudgetedMd] = useState('');
  const [status, setStatus] = useState('active');
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (v: boolean) => {
    if (v && editing) {
      setCode(editing.code);
      setName(editing.name);
      setDescription(editing.description ?? '');
      setBudgetedMd(editing.budgeted_md !== null ? String(editing.budgeted_md) : '');
      setStatus(editing.status);
    } else if (v) {
      setCode('');
      setName('');
      setDescription('');
      setBudgetedMd('');
      setStatus('active');
    }
    onOpenChange(v);
  };

  function handleSubmit() {
    const parsedMd = budgetedMd.trim() === '' ? null : parseFloat(budgetedMd);
    if (parsedMd !== null && (isNaN(parsedMd) || parsedMd < 0)) {
      toast.error('預算 MD 格式不正確');
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateTask({ id: editing!.id, code, name, description, status, budgeted_md: parsedMd })
        : await createTask({ project_id: projectId, code, name, description, budgeted_md: parsedMd });

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? '任務已更新' : '任務已新增');
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯任務' : `新增任務（${projectCode}）`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="task-code">代碼 (SR) *</Label>
            <Input id="task-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如 SR_001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-name">名稱 *</Label>
            <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="任務名稱" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">說明</Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="選填" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-md">預算 MD</Label>
            <Input id="task-md" type="number" step="0.5" min="0" value={budgetedMd} onChange={(e) => setBudgetedMd(e.target.value)} placeholder="例如 2.0（選填）" />
          </div>
          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="task-status">狀態</Label>
              <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {TASK_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={isPending || !code.trim() || !name.trim()}>
            {isPending ? '處理中…' : isEdit ? '儲存' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
