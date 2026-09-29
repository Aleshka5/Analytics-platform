import { formatNumber } from "./format";

const WIDTH = 320;
const HEIGHT = 120;
const PAD = 12;

function coordinates(points) {
  const sums = points.map((point) => point.sum);
  const min = Math.min(...sums);
  const max = Math.max(...sums);
  const span = max - min || 1;
  const innerWidth = WIDTH - PAD * 2;
  const innerHeight = HEIGHT - PAD * 2;
  return points.map((point, index) => {
    const x = points.length === 1 ? WIDTH / 2 : PAD + (index / (points.length - 1)) * innerWidth;
    const y = PAD + (1 - (point.sum - min) / span) * innerHeight;
    return { x, y };
  });
}

export default function LineChart({ points, locale }) {
  const plotted = coordinates(points);
  const title = points
    .map((point) => formatNumber(point.sum, locale))
    .filter((sum) => sum != null)
    .join(", ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img">
      <title>{title}</title>
      {points.length >= 2 ? (
        <polyline
          fill="none"
          stroke="#18181b"
          strokeWidth="2"
          points={plotted.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      ) : null}
      {points.length === 1 ? (
        <circle cx={plotted[0].x} cy={plotted[0].y} r="4" fill="#18181b" />
      ) : null}
    </svg>
  );
}
