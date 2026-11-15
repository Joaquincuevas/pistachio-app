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
import { Check, Clock3, GitBranch, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import {
  cn,
  collectPrerequisites,
  collectUnlocks,
  groupBySemester,
  isPractice,
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
  none: '',
  selected: 'border-accent ring-2 ring-accent shadow-raised',
  prereq: 'border-status-completed ring-2 ring-status-completed',
  unlocks: 'border-status-progress ring-2 ring-status-progress',
  dimmed: 'opacity-30',
};

/** Relleno y borde por estado: legibles incluso con el grafo muy alejado. */
const statusClasses: Record<CourseStatus, string> = {
  completed: 'border-status-completed bg-[#DDF0E1]',
  'in-progress': 'border-status-progress bg-[#DDEBFB]',
  pending: 'border-border bg-white',
};

/** Nodo del grafo: card del ramo con relleno, borde e icono según su estado. */
const CourseNode = memo(function CourseNode(props: NodeProps) {
  const { course, status, highlight } = props.data as CourseNodeData;
  const done = status === 'completed';
  const doing = status === 'in-progress';
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-l-[7px] p-3 pr-8 shadow-subtle transition-all duration-200',
        statusClasses[status],
        course.isSlot && !done && !doing && 'border-dashed bg-surface',
        highlight !== 'none' && highlightClasses[highlight],
      )}
      style={{ width: NODE_WIDTH, borderLeftColor: STATUS_COLORS[status] }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} />
      {(done || doing) && (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: STATUS_COLORS[status] }}
          aria-hidden
        >
          {done ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
          ) : (
            <Clock3 className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
        </span>
      )}
      <p
        className={cn(
          'line-clamp-2 text-xs font-semibold leading-snug',
          status === 'pending' ? 'text-text-secondary' : 'text-text-primary',
        )}
      >
        {course.name}
      </p>
      <p className="mt-1 text-[10px] text-text-secondary">
        {course.isSlot ? course.slotCategory : course.id} · {course.credits} SCT
      </p>
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0 }}
        isConnectable={false}
      />
    </div>
  );
});

/** Etiqueta de columna: "Semestre N". */
const SemesterLabelNode = memo(function SemesterLabelNode(props: NodeProps) {
  const { label } = props.data as { label: string };
  return (
    <div className="pointer-events-none select-none text-sm font-semibold tracking-tight text-text-secondary">
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
    // Las prácticas no van en la grilla: se ubican en una fila al pie.
    const regular = plan.courses.filter((c) => !isPractice(c));
    const practices = plan.courses.filter(isPractice);
    const semesters = [...groupBySemester(regular)];
    const maxRows = Math.max(...semesters.map(([, list]) => list.length), 1);
    const result: Node[] = [];
    const semesterToCol = new Map<number, number>();

    const highlightFor = (id: string): Highlight =>
      !selectedId
        ? 'none'
        : id === selectedId
          ? 'selected'
          : prereqSet.has(id)
            ? 'prereq'
            : unlockSet.has(id)
              ? 'unlocks'
              : 'dimmed';

    semesters.forEach(([semester, courses], col) => {
      semesterToCol.set(semester, col);
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
        result.push({
          id: course.id,
          type: 'course',
          position: { x, y: yOffset + row * ROW_HEIGHT },
          data: {
            course,
            status: statuses[course.id] ?? 'pending',
            highlight: highlightFor(course.id),
          } satisfies CourseNodeData,
          draggable: false,
        });
      });
    });

    // Prácticas: fila propia bajo la grilla, alineadas a su semestre.
    if (practices.length > 0) {
      const bottomY = maxRows * ROW_HEIGHT + 48;
      result.push({
        id: 'practices-label',
        type: 'semesterLabel',
        position: { x: 24, y: bottomY - 30 },
        data: { label: 'Prácticas' },
        draggable: false,
        selectable: false,
      });
      for (const course of practices) {
        const col = semesterToCol.get(course.semester) ?? semesters.length - 1;
        result.push({
          id: course.id,
          type: 'course',
          position: { x: col * COL_WIDTH, y: bottomY },
          data: {
            course,
            status: statuses[course.id] ?? 'pending',
            highlight: highlightFor(course.id),
          } satisfies CourseNodeData,
          draggable: false,
        });
      }
    }

    return result;
  }, [plan, statuses, selectedId, prereqSet, unlockSet]);

  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    for (const course of plan.courses) {
      for (const prereq of course.prerequisites) {
        // Sin selección: la arista toma el color del avance del requisito.
        const sourceStatus = statuses[prereq.id];
        let stroke =
          sourceStatus === 'completed'
            ? STATUS_COLORS.completed
            : sourceStatus === 'in-progress'
              ? STATUS_COLORS['in-progress']
              : '#B9B9B5';
        let opacity = sourceStatus === 'completed' || sourceStatus === 'in-progress' ? 0.9 : 0.7;
        let animated = false;
        let width = sourceStatus === 'completed' || sourceStatus === 'in-progress' ? 2 : 1.5;

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
  }, [plan, statuses, selectedId, prereqSet, unlockSet]);

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

  const selectedCourse = selectedId ? plan.courses.find((c) => c.id === selectedId) : undefined;

  return (
    <div className="h-full w-full" role="application" aria-label="Grafo de la malla curricular">
      <ReactFlow
        key={plan.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.04 }}
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

        {/* Leyenda de estados */}
        <Panel position="top-left" className="!m-3 hidden sm:block">
          <ul className="flex items-center gap-3 rounded-full border border-border bg-white/90 px-3.5 py-1.5 text-xs text-text-secondary shadow-subtle backdrop-blur">
            {(
              [
                ['completed', 'Cursado'],
                ['in-progress', 'En progreso'],
                ['pending', 'Pendiente'],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-[4px] border-2"
                  style={{
                    borderColor: STATUS_COLORS[key],
                    backgroundColor:
                      key === 'completed' ? '#DDF0E1' : key === 'in-progress' ? '#DDEBFB' : '#fff',
                  }}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </Panel>

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
