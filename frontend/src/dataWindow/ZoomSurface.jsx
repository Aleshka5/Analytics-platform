import { useEffect, useRef, useState } from "react";
import { MAX_SCALE, MIN_SCALE, clampScale, stepScale } from "./scale";
import "./ZoomSurface.css";

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(query.matches);
    setCoarse(query.matches);
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    return undefined;
  }, []);

  return coarse;
}

function pointFromEvent(event) {
  return { x: event.clientX, y: event.clientY };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function startedOnButton(event) {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target?.closest("button"));
}

export default function ZoomSurface({ children, onReachEnd, watchKey }) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const onReachEndRef = useRef(onReachEnd);
  onReachEndRef.current = onReachEnd;
  const coarse = useCoarsePointer();
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scaleRef = useRef(1);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  function commitScale(value) {
    const next = clampScale(value);
    scaleRef.current = next;
    setScale(next);
  }

  function step(direction) {
    setScale((current) => {
      const next = stepScale(current, direction);
      scaleRef.current = next;
      return next;
    });
  }

  function capturePinch() {
    if (pointers.current.size < 2) {
      pinch.current = null;
      return;
    }
    const [a, b] = [...pointers.current.values()];
    pinch.current = { dist: distance(a, b), scale: scaleRef.current };
  }

  function onPointerDown(event) {
    if (!coarse || startedOnButton(event)) {
      return;
    }
    pointers.current.set(event.pointerId, pointFromEvent(event));
    if (pointers.current.size >= 2 && typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // jsdom and a pointer that already ended do not capture.
      }
    }
    capturePinch();
  }

  function onPointerMove(event) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.set(event.pointerId, pointFromEvent(event));

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = distance(a, b);
      if (pinch.current.dist > 0) {
        commitScale(pinch.current.scale * (dist / pinch.current.dist));
      }
    }
  }

  function onPointerUp(event) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.delete(event.pointerId);
    capturePinch();
  }

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return undefined;
    }
    const measure = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      setSize((current) => (
        current.width === width && current.height === height ? current : { width, height }
      ));
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [watchKey, scale]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onReachEnd) {
      return undefined;
    }
    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 64) {
        onReachEndRef.current?.();
      }
    };
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [onReachEnd, watchKey, scale, size]);

  return (
    <div
      className="zoom-surface"
      data-testid="zoom-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={scrollRef}
        className="zoom-surface-scroll"
        data-testid="zoom-scroll"
      >
        <div
          className="zoom-surface-sizer"
          style={{ width: size.width * scale, height: size.height * scale }}
        >
          <div
            ref={contentRef}
            className="zoom-surface-content"
            data-testid="zoom-content"
            data-scale={scale}
            style={{ transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
      </div>
      {coarse ? (
        <svg
          className="zoom-surface-hint"
          data-testid="pinch-hint"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
          viewBox="0 0 64 32"
          width="64"
          height="32"
        >
          <circle className="zoom-surface-hint-left" cx="24" cy="16" r="6" fill="currentColor" />
          <circle className="zoom-surface-hint-right" cx="40" cy="16" r="6" fill="currentColor" />
        </svg>
      ) : (
        <div className="zoom-surface-controls">
          <button
            type="button"
            data-testid="zoom-in"
            disabled={scale >= MAX_SCALE}
            onClick={() => step(1)}
          >
            +
          </button>
          <button
            type="button"
            data-testid="zoom-out"
            disabled={scale <= MIN_SCALE}
            onClick={() => step(-1)}
          >
            {"\u2212"}
          </button>
        </div>
      )}
    </div>
  );
}
