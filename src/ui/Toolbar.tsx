import { HoldButton } from './HoldButton';

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
  onEnd: () => void;
  disabled: boolean;
}

export function Toolbar({ active, onPick, onEnd, disabled }: ToolbarProps) {
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
      {disabled ? (
        <button type="button" class="tool" disabled>
          End
        </button>
      ) : (
        <HoldButton class="tool end" label="End year" onConfirm={onEnd}>
          End
        </HoldButton>
      )}
    </nav>
  );
}
