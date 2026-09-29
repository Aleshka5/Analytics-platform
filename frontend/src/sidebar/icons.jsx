import { useId } from "react";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Icon({ size = 18, children }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...STROKE}>
      {children}
    </svg>
  );
}

export function FilterIcon() {
  return (
    <Icon>
      <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
    </Icon>
  );
}

export function SortIcon() {
  return (
    <Icon>
      <path d="M8 19V5M4 9l4-4 4 4M16 5v14M12 15l4 4 4-4" />
    </Icon>
  );
}

export function GroupIcon() {
  return (
    <Icon>
      <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon size={16}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon size={16}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function ArrowUpIcon() {
  return (
    <Icon>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  );
}

export function ArrowDownIcon() {
  return (
    <Icon>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Icon>
  );
}

/* Two overlapping sets. "all" fills only the overlap; "any" fills both circles. */
export function VennIcon({ mode }) {
  const clipId = useId();
  return (
    <svg aria-hidden="true" width="64" height="40" viewBox="0 0 64 40" className="venn">
      <defs>
        <clipPath id={clipId}>
          <circle cx="24" cy="20" r="15" />
        </clipPath>
      </defs>
      {mode === "any" ? (
        <>
          <circle cx="24" cy="20" r="15" className="venn-fill" />
          <circle cx="40" cy="20" r="15" className="venn-fill" />
        </>
      ) : (
        <circle cx="40" cy="20" r="15" className="venn-fill" clipPath={`url(#${clipId})`} />
      )}
      <circle cx="24" cy="20" r="15" className="venn-line" />
      <circle cx="40" cy="20" r="15" className="venn-line" />
    </svg>
  );
}

/* Mini tables that show what each group mode does to the rows. */
export function MergedTableIcon() {
  return (
    <svg aria-hidden="true" width="88" height="61" viewBox="0 0 72 50" className="mini-table">
      <rect x="1" y="1" width="22" height="23" className="mini-table-key" />
      <rect x="1" y="26" width="22" height="23" className="mini-table-key" />
      <text x="12" y="16">A</text>
      <text x="12" y="41">B</text>
      {[1, 13.5, 26, 38.5].map((y) => (
        <g key={y}>
          <rect x="25" y={y} width="22" height="10.5" className="mini-table-cell" />
          <rect x="49" y={y} width="22" height="10.5" className="mini-table-cell" />
        </g>
      ))}
    </svg>
  );
}

export function AggregatedTableIcon() {
  return (
    <svg aria-hidden="true" width="88" height="61" viewBox="0 0 72 50" className="mini-table">
      {[
        [1, "A"],
        [13.5, "B"],
      ].map(([y, key]) => (
        <g key={key}>
          <rect x="1" y={y} width="22" height="10.5" className="mini-table-key" />
          <text x="12" y={y + 8}>
            {key}
          </text>
          <rect x="25" y={y} width="22" height="10.5" className="mini-table-cell" />
          <rect x="49" y={y} width="22" height="10.5" className="mini-table-sum" />
          <text x="60" y={y + 8}>
            Σ
          </text>
        </g>
      ))}
    </svg>
  );
}
