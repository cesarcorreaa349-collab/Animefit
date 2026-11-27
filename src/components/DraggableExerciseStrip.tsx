import { useEffect, useRef, useState } from 'react';
import { Dumbbell, MoveHorizontal, Plus } from 'lucide-react';
import { UserProfile } from '../types/animefit';
import { getExerciseById, getMuscleBadge } from '../utils/animefit';

interface DraggableExerciseStripProps {
  items: Array<{ exId: string }>;
  user: UserProfile;
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onAddClick?: () => void;
  addLabel?: string;
}

const LONG_PRESS_MS = 280;
const MOVE_TOLERANCE_PX = 8;

interface GestureState {
  pointerId: number | null;
  activeIdx: number | null;
  startX: number;
  startY: number;
  visualOriginX: number;
  isDragging: boolean;
  timerId: number | null;
  justDraggedUntil: number;
}

export function DraggableExerciseStrip({
  items,
  user,
  selectedIdx,
  onSelectIdx,
  onReorder,
  onAddClick,
  addLabel = 'Añadir',
}: DraggableExerciseStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragVisualX, setDragVisualX] = useState<number>(0);

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onSelectIdxRef = useRef(onSelectIdx);
  onSelectIdxRef.current = onSelectIdx;

  const gestureRef = useRef<GestureState>({
    pointerId: null,
    activeIdx: null,
    startX: 0,
    startY: 0,
    visualOriginX: 0,
    isDragging: false,
    timerId: null,
    justDraggedUntil: 0,
  });

  // Prevent browser touch scrolling ONLY while actively dragging a grabbed circle
  useEffect(() => {
    if (draggingIdx === null) return;
    const preventTouchMove = (ev: TouchEvent) => {
      if (gestureRef.current.isDragging) {
        ev.preventDefault();
      }
    };
    window.addEventListener('touchmove', preventTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventTouchMove);
    };
  }, [draggingIdx]);

  // Attach global pointer handlers while a press or drag is active
  useEffect(() => {
    const clearTimer = () => {
      if (gestureRef.current.timerId !== null) {
        window.clearTimeout(gestureRef.current.timerId);
        gestureRef.current.timerId = null;
      }
    };

    const endGesture = () => {
      clearTimer();
      if (gestureRef.current.isDragging) {
        gestureRef.current.justDraggedUntil = Date.now() + 180;
      }
      gestureRef.current.pointerId = null;
      gestureRef.current.activeIdx = null;
      gestureRef.current.isDragging = false;
      setDraggingIdx(null);
      setDragVisualX(0);
    };

    const handlePointerMove = (ev: PointerEvent) => {
      const g = gestureRef.current;
      if (g.pointerId === null || ev.pointerId !== g.pointerId) return;

      if (!g.isDragging) {
        const dist = Math.hypot(ev.clientX - g.startX, ev.clientY - g.startY);
        if (dist > MOVE_TOLERANCE_PX) {
          // User is scrolling/swiping horizontally or vertically — cancel long press immediately
          clearTimer();
          g.pointerId = null;
          g.activeIdx = null;
        }
        return;
      }

      const curIdx = g.activeIdx;
      if (curIdx === null) return;

      // Auto-scroll strip smoothly near horizontal edges
      const stripEl = stripRef.current;
      if (stripEl) {
        const stripRect = stripEl.getBoundingClientRect();
        if (ev.clientX < stripRect.left + 44) {
          stripEl.scrollLeft -= 10;
        } else if (ev.clientX > stripRect.right - 44) {
          stripEl.scrollLeft += 10;
        }
      }

      const curEl = itemRefs.current[curIdx];
      const nextEl = itemRefs.current[curIdx + 1];
      const prevEl = itemRefs.current[curIdx - 1];

      if (curEl && nextEl) {
        const curRect = curEl.getBoundingClientRect();
        const nextRect = nextEl.getBoundingClientRect();
        if (ev.clientX > nextRect.left + nextRect.width * 0.45) {
          const stepDelta =
            nextRect.left +
            nextRect.width / 2 -
            (curRect.left + curRect.width / 2);
          onReorderRef.current(curIdx, curIdx + 1);
          g.activeIdx = curIdx + 1;
          g.visualOriginX += stepDelta || 80;
          setDraggingIdx(curIdx + 1);
          setDragVisualX(ev.clientX - g.visualOriginX);
          return;
        }
      }

      if (curEl && prevEl) {
        const curRect = curEl.getBoundingClientRect();
        const prevRect = prevEl.getBoundingClientRect();
        if (ev.clientX < prevRect.left + prevRect.width * 0.55) {
          const stepDelta =
            prevRect.left +
            prevRect.width / 2 -
            (curRect.left + curRect.width / 2);
          onReorderRef.current(curIdx, curIdx - 1);
          g.activeIdx = curIdx - 1;
          g.visualOriginX += stepDelta || -80;
          setDraggingIdx(curIdx - 1);
          setDragVisualX(ev.clientX - g.visualOriginX);
          return;
        }
      }

      setDragVisualX(ev.clientX - g.visualOriginX);
    };

    const handlePointerUpOrCancel = (ev: PointerEvent) => {
      const g = gestureRef.current;
      if (g.pointerId === null || ev.pointerId !== g.pointerId) return;
      endGesture();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUpOrCancel);
    window.addEventListener('pointercancel', handlePointerUpOrCancel);

    return () => {
      clearTimer();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpOrCancel);
      window.removeEventListener('pointercancel', handlePointerUpOrCancel);
    };
  }, []);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const g = gestureRef.current;
    if (g.timerId !== null) {
      window.clearTimeout(g.timerId);
      g.timerId = null;
    }

    g.pointerId = e.pointerId;
    g.activeIdx = idx;
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.visualOriginX = e.clientX;
    g.isDragging = false;

    g.timerId = window.setTimeout(() => {
      if (gestureRef.current.pointerId !== e.pointerId) return;
      gestureRef.current.isDragging = true;
      gestureRef.current.timerId = null;
      setDraggingIdx(idx);
      setDragVisualX(0);
      onSelectIdxRef.current(idx);
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(15);
        }
      } catch {
        // ignore vibration unsupported
      }
    }, LONG_PRESS_MS);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={stripRef}
        className="flex items-start gap-3 overflow-x-auto no-scrollbar pb-1 pt-1.5 px-0.5"
        style={{
          touchAction: draggingIdx !== null ? 'none' : 'pan-x pan-y',
        }}
      >
        {items.map((item, idx) => {
          const ex = getExerciseById(item.exId, user);
          const isActive = idx === selectedIdx;
          const isDragging = draggingIdx === idx;
          const shortBadge = ex ? getMuscleBadge(ex.muscle) : 'EJ';

          return (
            <button
              key={`${item.exId}_${idx}`}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              onClick={() => {
                if (Date.now() < gestureRef.current.justDraggedUntil) {
                  return;
                }
                onSelectIdx(idx);
              }}
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                touchAction: isDragging ? 'none' : 'pan-x pan-y',
                transform: isDragging
                  ? `translate3d(${dragVisualX}px, -4px, 0) scale(1.1)`
                  : undefined,
              }}
              className={`relative flex flex-col items-center gap-1.5 shrink-0 w-[68px] select-none group ${
                isDragging
                  ? 'z-30 cursor-grabbing transition-none'
                  : 'z-0 cursor-pointer transition-transform duration-150'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 transition-all ${
                  isDragging
                    ? 'bg-[#171A24] border-[#FACC15] text-[#FACC15] shadow-[0_8px_24px_rgba(250,204,21,0.38)] ring-2 ring-[#FACC15]/45'
                    : isActive
                    ? 'bg-[#101218] border-[#FACC15] text-[#FACC15] shadow-[0_0_14px_rgba(29,78,216,0.26)]'
                    : 'bg-[#0A0B0F] border-[#1B1E26] text-[#8A92A2] group-hover:border-[#38BDF8]'
                }`}
              >
                {isDragging ? (
                  <MoveHorizontal className="w-4 h-4 mb-0.5 text-[#FACC15]" />
                ) : (
                  <Dumbbell className="w-4 h-4 mb-0.5" />
                )}
                <span className="text-[10px] font-black tracking-wider">
                  {shortBadge}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold leading-tight text-center line-clamp-1 w-full ${
                  isDragging || isActive ? 'text-[#FACC15]' : 'text-[#8A92A2]'
                }`}
              >
                {ex ? ex.name : 'Ejercicio'}
              </span>
            </button>
          );
        })}

        {onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
          >
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#38BDF8]/70 bg-[#0A0B0F]/70 hover:bg-[#101218] text-[#38BDF8] flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold text-[#38BDF8]">
              {addLabel}
            </span>
          </button>
        )}
      </div>

      {items.length > 1 && (
        <p
          className={`text-[11px] font-medium px-0.5 transition-colors ${
            draggingIdx !== null ? 'text-[#FACC15]' : 'text-[#64748B]'
          }`}
        >
          {draggingIdx !== null
            ? 'Arrastra a izquierda o derecha para cambiar el orden'
            : 'Mantén apretado un círculo y arrastra para reordenar'}
        </p>
      )}
    </div>
  );
}
