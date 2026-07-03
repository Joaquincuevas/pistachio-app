import { memo, useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import {
  cn,
  collectPrerequisites,
  collectUnlocks,
  groupBySemester,
  STATUS_COLORS,
} from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import type { Course, CourseStatus, Plan } from '@/types';

type Highlight = 'none' | 'selected' | 'prereq' | 'unlocks' | 'dimmed';

interface CourseNodeData {
  course: Course;
  status: CourseStatus;
  highlight: Highlight;
  [key: string]: unknown;
}

const COL_WIDTH = 250;
const ROW_HEIGHT = 96;
const NODE_WIDTH = 208;

const EMPTY_PROGRESS: Record<string, never> = {};

const highlightClasses: Record<Highlight, string> = {
  none: 'border-border',
  selected: 'border-accent ring-2 ring-accent shadow-raised',
  prereq: 'border-status-completed ring-2 ring-status-completed',
  unlocks: 'border-status-progress ring-2 ring-status-progress',
  dimmed: 'border-border opacity-30',
};

/** Nodo del grafo: mini card del ramo con color de estado. */
const CourseNode = memo(function CourseNode(props: NodeProps) {
  const { course, status, highlight } = props.data as CourseNodeData;
  return (
    <div
      className={cn(
        'rounded-xl border border-l-4 bg-white p-3 shadow-subtle transition-all duration-200',
        highlightClasses[highlight],
        course.isSlot && 'border-dashed bg-surface',
      )}
      style={{ width: NODE_WIDTH, borderLeftColor: STATUS_COLORS[status] }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} />
      <p className="line-clamp-2 text-xs font-medium leading-snug text-text-primary">
        {course.name}
      </p>
      <p className="mt-1 text-[10px] text-text-secondary">
        {course.isSlot ? course.slotCategory : course.id} · {course.credits} SCT
      </p>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
});

/** Etiqueta de columna: "Semestre N". */
const SemesterLabelNode = memo(function SemesterLabelNode(props: NodeProps) {
  const { label } = props.data as { label: string };
  return (
    <div className="pointer-events-none select-none font-display text-lg text-text-secondary">
      {label}
    </div>
  );
});

const nodeTypes: NodeTypes = {
  course: CourseNode,
  semesterLabel: SemesterLabelNode,
};

/**
 * Vista grafo de dependencias con React Flow.
 * - Tap en un nodo: resalta prerrequisitos (verde) y ramos que desbloquea (azul).
 * - Segundo tap / doble click: abre el detalle del ramo.
 * - Click derecho: menú de cambio de estado.
 * - Aristas punteadas: el requisito se puede cursar en paralelo.
 */
export function MallaGraph({ plan }: { plan: Plan }) {
  const progressMap = useCurriculumStore((s) => s.progress);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const openStatusMenu = useCurriculumStore((s) => s.openStatusMenu);
  const isDesktop = useIsDesktop();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const statuses = progressMap[plan.id] ?? EMPTY_PROGRESS;

  const { prereqSet, unlockSet } = useMemo(() => {
    if (!selectedId) return { prereqSet: new Set<string>(), unlockSet: new Set<string>() };
    return {
      prereqSet: collectPrerequisites(selectedId, plan.courses),
      unlockSet: collectUnlocks(selectedId, plan.courses),
    };
  }, [selectedId, plan]);

  const nodes = useMemo<Node[]>(() => {
    const semesters = [...groupBySemester(plan.courses)];
    const maxRows = Math.max(...semesters.map(([, list]) => list.length));
    const result: Node[] = [];

    semesters.forEach(([semester, courses], col) => {
      const x = col * COL_WIDTH;
      // Centra verticalmente las columnas con menos ramos.
      const yOffset = ((maxRows - courses.length) * ROW_HEIGHT) / 2;

      result.push({
        id: `sem-${semester}`,
        type: 'semesterLabel',
        position: { x: x + 24, y: -64 },
        data: { label: `Semestre ${semester}` },
        draggable: false,
        selectable: false,
      });

      courses.forEach((course, row) => {
        const status = statuses[course.id] ?? 'pending';
        const highlight: Highlight = !selectedId
          ? 'none'
          : course.id === selectedId
            ? 'selected'
            : prereqSet.has(course.id)
              ? 'prereq'
              : unlockSet.has(course.id)
                ? 'unlocks'
                : 'dimmed';

        result.push({
          id: course.id,
          type: 'course',
          position: { x, y: yOffset + row * ROW_HEIGHT },
          data: { course, status, highlight } satisfies CourseNodeData,
          draggable: false,
        });
      });
    });

    return result;
  }, [plan, statuses, selectedId, prereqSet, unlockSet]);

  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    for (const course of plan.courses) {
      for (const prereq of course.prerequisites) {
        let stroke = '#C9C9C6';
        let opacity = 0.85;
        let animated = false;
        let width = 1.5;

        if (selectedId) {
          const targetInChain = course.id === selectedId || prereqSet.has(course.id);
          const backward = targetInChain && prereqSet.has(prereq.id);
          const forward =
            (prereq.id === selectedId || unlockSet.has(prereq.id)) && unlockSet.has(course.id);

          if (backward) {
            stroke = '#6BA876';
            animated = true;
            width = 2;
          } else if (forward) {
            stroke = '#4A90E2';
            animated = true;
            width = 2;
          } else {
            opacity = 0.15;
          }
        }

        result.push({
          id: `${prereq.id}->${course.id}`,
          source: prereq.id,
          target: course.id,
          animated,
          style: {
            stroke,
            opacity,
            strokeWidth: width,
            // Requisito concurrente ("en paralelo"): línea punteada.
            strokeDasharray: prereq.concurrent ? '6 4' : undefined,
          },
        });
      }
    }
    return result;
  }, [plan, selectedId, prereqSet, unlockSet]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'course') return;
      // Primer tap selecciona y resalta; segundo tap abre el detalle.
      if (selectedId === node.id) {
        selectCourse(node.id);
      } else {
        setSelectedId(node.id);
      }
    },
    [selectedId, selectCourse],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (node.type !== 'course') return;
      openStatusMenu({ courseId: node.id, x: event.clientX, y: event.clientY });
    },
    [openStatusMenu],
  );

  const selectedCourse = selectedId
    ? plan.courses.find((c) => c.id === selectedId)
    : undefined;

  return (
    <div className="h-full w-full" role="application" aria-label="Grafo de la malla curricular">
      <ReactFlow
        key={plan.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={(_e, node) => node.type === 'course' && selectCourse(node.id)}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => setSelectedId(null)}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="#E3E3E0" />
        {isDesktop && <Controls showInteractive={false} />}

        {/* Hint de uso cuando no hay selección */}
        {!selectedId && (
          <Panel position="top-center">
            <div className="flex items-center gap-2 rounded-full border border-border bg-white/90 px-3.5 py-1.5 text-xs text-text-secondary shadow-subtle backdrop-blur">
              <Info className="h-3.5 w-3.5" aria-hidden />
              Toca un ramo para ver sus dependencias
            </div>
          </Panel>
        )}

        {/* Panel de acción del nodo seleccionado */}
        {selectedCourse && (
          <Panel position="bottom-center" className="!m-3 w-[calc(100%-24px)] max-w-md">
            <div className="rounded-card border border-border bg-white p-3.5 shadow-modal">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {selectedCourse.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                    <StatusBadge status={statuses[selectedCourse.id] ?? 'pending'} />
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" aria-hidden />
                      {prereqSet.size} prev · {unlockSet.size} desbloquea
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) =>
                      openStatusMenu({
                        courseId: selectedCourse.id,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }
                  >
                    Estado
                  </Button>
                  <Button size="sm" onClick={() => selectCourse(selectedCourse.id)}>
                    Ver detalle
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
