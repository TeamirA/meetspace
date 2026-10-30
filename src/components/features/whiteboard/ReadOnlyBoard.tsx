"use client";

import type Konva from "konva";
import { Download, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import type { BoardElement } from "@/core/domain/entities/Whiteboard";
import { BoardCanvas, exportPng, fitView, type View } from "./BoardCanvas";

export function ReadOnlyBoard({ elements, filename }: { elements: BoardElement[]; filename: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const next = { width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) };
      setSize(next);
      setView(fitView(elements, next.width, next.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [elements]);

  if (!elements.length) {
    return <EmptyState icon={<PenLine />} title="The whiteboard was empty" className="rounded-2xl border" />;
  }
  return (
    <div className="relative">
      <div ref={ref} className="aspect-video w-full overflow-hidden rounded-2xl border bg-white">
        {size.width > 0 && (
          <BoardCanvas ref={stage} width={size.width} height={size.height} view={view} elements={elements} />
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="shadow-soft absolute top-3 right-3"
        onClick={() => exportPng(stage.current, filename)}
      >
        <Download /> Export PNG
      </Button>
    </div>
  );
}
