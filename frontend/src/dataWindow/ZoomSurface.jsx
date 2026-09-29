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

export default function ZoomSurface({ children }) {
  const coarse = useCoarsePointer();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
    if (startedOnButton(event)) {
      return;
    }
    pointers.current.set(event.pointerId, pointFromEvent(event));
    if (typeof event.currentTarget.setPointerCapture === "function") {
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
    const previous = pointers.current.get(event.pointerId);
    const point = pointFromEvent(event);
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = distance(a, b);
      if (pinch.current.dist > 0) {
        commitScale(pinch.current.scale * (dist / pinch.current.dist));
      }
      return;
    }

    setPan((current) => ({
      x: current.x + (point.x - previous.x),
      y: current.y + (point.y - previous.y),
    }));
  }

  function onPointerUp(event) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.delete(event.pointerId);
    capturePinch();
  }

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
        className="zoom-surface-content"
        data-testid="zoom-content"
        data-scale={scale}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
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
