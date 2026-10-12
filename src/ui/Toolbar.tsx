export type Tool = 'map' | 'plan' | 'budget' | 'layers' | 'news';

const TOOLS: { id: Tool; text: string; label: string }[] = [
  { id: 'map', text: 'Map', label: 'Map' },
  { id: 'plan', text: 'Plan', label: 'Plan' },
  { id: 'budget', text: '$', label: 'Budget' },
  { id: 'layers', text: 'Layers', label: 'Layers' },
  { id: 'news', text: 'News', label: 'News' },
];

interface ToolbarProps {
  active: Tool;
  onPick: (t: Tool) => void;
  onPlay: () => void;
  disabled: boolean;
  canPlay: boolean;
}

export function Toolbar({ active, onPick, onPlay, disabled, canPlay }: ToolbarProps) {
  return (
    <nav class="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          class="tool"
          aria-label={t.label}
          aria-pressed={active === t.id}
          disabled={disabled}
          onClick={() => onPick(t.id)}
        >
          {t.text}
        </button>
      ))}
      <button type="button" class="tool play" aria-label="Play the year" disabled={!canPlay} onClick={onPlay}>
        ▶︎
      </button>
    </nav>
  );
}
