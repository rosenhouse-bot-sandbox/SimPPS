import { useEffect, useMemo, useState } from 'preact/hooks';

export function useMedia(query: string): boolean {
  const list = useMemo(() => (typeof matchMedia === 'function' ? matchMedia(query) : null), [query]);
  const [matches, setMatches] = useState(!!list?.matches);
  useEffect(() => {
    if (!list) return;
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [list]);
  return matches;
}
