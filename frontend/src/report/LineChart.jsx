import { useEffect, useRef, useState } from "react";
import { formatDate, formatNumber } from "./format";

const HEIGHT = 240;
const MARGIN = { top: 16, right: 64, bottom: 32, left: 56 };
const NARROW_MARGIN = { top: 16, right: 52, bottom: 32, left: 44 };
const NARROW_WIDTH = 480;
const DEFAULT_WIDTH = 640;

function niceStep(span) {
  const raw = span / 3 || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return nice * power;
}

function yTicks(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(max - min);
  const low = Math.floor(min / step) * step;
  const high = Math.max(Math.ceil(max / step) * step, low + step);
  const ticks = [];
  for (let tick = low; tick <= high + step / 2; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

function compact(value, locale) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function useWidth(ref) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver !== "function") {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export default function LineChart({ points, locale }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(null);

  if (points.length === 0) {
    return null;
  }

  const narrow = width < NARROW_WIDTH;
  const margin = narrow ? NARROW_MARGIN : MARGIN;
  const sums = points.map((point) => point.sum);
  const ticks = yTicks(sums);
  const low = ticks[0];
  const high = ticks[ticks.length - 1];
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = HEIGHT - margin.top - margin.bottom;
  const baseY = margin.top + innerHeight;
  const x = (index) =>
    points.length === 1 ? margin.left + innerWidth / 2 : margin.left + (index / (points.length - 1)) * innerWidth;
  const y = (value) => margin.top + (1 - (value - low) / (high - low)) * innerHeight;
  const plotted = points.map((point, index) => ({ x: x(index), y: y(point.sum) }));
  const line = plotted.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${plotted[plotted.length - 1].x},${baseY} L${plotted[0].x},${baseY} Z`;
  const last = plotted.length - 1;
  // Narrow charts keep only the first and last date so the labels never collide.
  const xLabels = [...new Set(narrow ? [0, last] : [0, Math.floor(last / 2), last])];
  const title = points
    .map((point) => formatNumber(point.sum, locale))
    .filter((sum) => sum != null)
    .join(", ");

  function pointerToIndex(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - margin.left) / innerWidth;
    return Math.min(last, Math.max(0, Math.round(ratio * last)));
  }

  function handleKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    setActive((current) => Math.min(last, Math.max(0, (current ?? last) + step)));
  }

  const readout = active == null ? null : points[active];
  const readoutLeft = active == null ? 0 : Math.min(Math.max(plotted[active].x, 70), width - 70);

  return (
    <div
      ref={wrapRef}
      className="line-chart"
      tabIndex={0}
      data-testid="line-chart"
      onFocus={() => setActive(last)}
      onBlur={() => setActive(null)}
      onKeyDown={handleKeyDown}
    >
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        onPointerMove={(event) => setActive(pointerToIndex(event))}
        onPointerLeave={() => setActive(null)}
      >
        <title>{title}</title>
        <defs>
          <linearGradient id="line-chart-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick} className="line-chart-grid">
            <line x1={margin.left} x2={margin.left + innerWidth} y1={y(tick)} y2={y(tick)} />
            <text x={margin.left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {compact(tick, locale)}
            </text>
          </g>
        ))}
        {xLabels.map((index) => (
          <text
            key={index}
            className="line-chart-axis"
            x={plotted[index].x}
            y={HEIGHT - 8}
            textAnchor={index === 0 && points.length > 1 ? "start" : index === last && points.length > 1 ? "end" : "middle"}
          >
            {formatDate(points[index].bucket, locale)}
          </text>
        ))}
        {points.length >= 2 ? (
          <>
            <path className="line-chart-area" d={area} fill="url(#line-chart-wash)" />
            <path className="line-chart-line" d={line} pathLength="1" />
          </>
        ) : null}
        {readout ? (
          <line
            className="line-chart-crosshair"
            x1={plotted[active].x}
            x2={plotted[active].x}
            y1={margin.top}
            y2={baseY}
          />
        ) : null}
        <circle className="line-chart-dot" cx={plotted[last].x} cy={plotted[last].y} r="4" />
        <text
          className="line-chart-end"
          x={plotted[last].x + 10}
          y={plotted[last].y}
          dominantBaseline="middle"
        >
          {compact(points[last].sum, locale)}
        </text>
        {readout && active !== last ? (
          <circle className="line-chart-dot" cx={plotted[active].x} cy={plotted[active].y} r="4" />
        ) : null}
      </svg>
      {readout ? (
        <div className="line-chart-tip" style={{ left: readoutLeft }} data-testid="chart-readout" aria-live="polite">
          <strong>{formatNumber(readout.sum, locale)}</strong>
          <span>{formatDate(readout.bucket, locale)}</span>
        </div>
      ) : null}
    </div>
  );
}
