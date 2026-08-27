"use client";

import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const DESKTOP_PREVIEW_WIDTH = 1440;

export function getPublicProfileDesktopPreviewLayout(
  viewportWidth: number,
  canvasHeight: number,
) {
  const scale = Math.min(1, viewportWidth / DESKTOP_PREVIEW_WIDTH);

  return {
    height: Math.ceil(canvasHeight * scale),
    scale,
  };
}

export function PublicProfileDesktopPreview({
  children,
}: {
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const staticContentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ height: 0, scale: 1 });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;

    if (!viewport || !canvas) return;

    const viewportWidth = viewport.clientWidth;
    const canvasHeight = canvas.scrollHeight;

    if (!viewportWidth || !canvasHeight) return;

    const { height, scale } = getPublicProfileDesktopPreviewLayout(
      viewportWidth,
      canvasHeight,
    );

    setLayout((current) =>
      current.scale === scale && current.height === height
        ? current
        : { height, scale },
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const staticContent = staticContentRef.current;
    staticContent?.setAttribute("inert", "");

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);

    if (resizeObserver) {
      if (viewportRef.current) resizeObserver.observe(viewportRef.current);
      if (canvasRef.current) resizeObserver.observe(canvasRef.current);
    }

    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      staticContent?.removeAttribute("inert");
    };
  }, [measure]);

  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-brand-lavender bg-surface-muted"
      data-testid="public-profile-desktop-preview"
      ref={viewportRef}
      style={layout.height ? { height: `${layout.height}px` } : undefined}
    >
      <div
        className="origin-top-left select-none"
        ref={canvasRef}
        style={{
          transform: `scale(${layout.scale})`,
          width: `${DESKTOP_PREVIEW_WIDTH}px`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none select-none"
          ref={staticContentRef}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
