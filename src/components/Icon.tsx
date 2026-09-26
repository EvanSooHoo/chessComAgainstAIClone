import type { ReactNode } from 'react';

// The original SVG artwork, expressed as JSX rather than HTML strings.
const icons = {
  play: <path d="m9 5 11 7-11 7z" />,
  folder: <path d="M3 7h7l2-3h9v16H3z" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1" />
    </>
  ),
  undo: <path d="m8 5-5 5 5 5M3 10h11a6 6 0 0 1 0 12" />,
  hint: <path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2" />,
  flip: <path d="M5 7h14l-4-4m4 14H5l4 4M19 7v4M5 17v-4" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  flag: <path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0" />,
  volume: <path d="m3 9 5 0 5-5v16l-5-5H3zM17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4 4L20 5" />,
} satisfies Record<string, ReactNode>;

export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}
