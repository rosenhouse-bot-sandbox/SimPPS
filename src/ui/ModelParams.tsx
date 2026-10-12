import { useEffect, useState } from 'preact/hooks';
import { cleanOverrides, defaultValue, EDITABLE_PATHS, LIMITS, MODEL_DEFAULTS, paramError, setModelParams, type Model } from '../sim/model';
import type { ModelOverrides } from '../sim/types';
import { MODEL_PARAMS } from '../sources/model';
import { allowsNegative, paramInfo, parseParam } from '../sources/params';
import { getSource } from '../sources/registry';
import { Sourced } from './Sourced';
import { Window } from './Window';

/** Rows by source, in the order the parameters appear in M. Fixed parameters show their value only. */
const GROUPS = (() => {
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(MODEL_PARAMS) as (keyof Model)[]) {
    const paths = LIMITS[key] === 'fixed' ? [key] : EDITABLE_PATHS.filter((p) => p.split('.')[0] === key);
    const source = MODEL_PARAMS[key].source;
    groups.set(source, [...(groups.get(source) ?? []), ...paths]);
  }
  return [...groups];
})();

function fmtFixed(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(fmtFixed).join(', ')}]`;
  return v === Infinity ? '∞' : String(v);
}

/** `model` with each typed value that is valid next to the others. A bad value keeps the last valid one. */
function withTexts(model: ModelOverrides, texts: Record<string, string>): ModelOverrides {
  const next = { ...model };
  for (const [path, text] of Object.entries(texts)) next[path] = parseParam(text);
  for (;;) {
    const bad = Object.keys(texts).filter((p) => next[p] !== model[p] && paramError(p, next[p], next) !== null);
    if (!bad.length) return cleanOverrides(next);
    for (const p of bad) {
      if (p in model) next[p] = model[p];
      else delete next[p];
    }
  }
}

interface ModelParamsProps {
  model: ModelOverrides;
  onChange: (model: ModelOverrides) => void;
  onClose: () => void;
}

export function ModelParams({ model, onChange, onClose }: ModelParamsProps) {
  const [texts, setTexts] = useState<Record<string, string>>({});
  // The pop-overs here quote the defaults. The game that starts next sets its own parameters.
  useEffect(() => setModelParams(), []);
  const typed: ModelOverrides = { ...model };
  for (const [path, text] of Object.entries(texts)) typed[path] = parseParam(text);
  const errors = Object.fromEntries(
    Object.keys(texts).flatMap((p) => {
      const error = paramError(p, typed[p], typed);
      return error ? [[p, error]] : [];
    }),
  );
  const invalid = Object.keys(errors).length;
  const edit = (path: string, text: string) => {
    const next = { ...texts, [path]: text };
    setTexts(next);
    onChange(withTexts(model, next));
  };
  const reset = () => {
    setTexts({});
    onChange({});
  };
  const changed = Object.keys(model).length;
  return (
    <Window title="Model parameters" class="panel sheet model-params" onClose={onClose} dialog>
      <p class="intro">Changes apply to the next game, ghost included, and go in its link.</p>
      {GROUPS.map(([source, paths]) => {
        const s = getSource(source)!;
        return (
          <section key={source} class="param-group">
            <h3>
              <Sourced k={source} text>
                {s.label}
              </Sourced>
            </h3>
            <ul class="params">
              {paths.map((path) => {
                const info = paramInfo(path);
                const tag = <span class="param-tag">[{info.tag ?? s.tag}]</span>;
                if (LIMITS[path as keyof Model] === 'fixed')
                  return (
                    <li key={path} class="param">
                      <span class="param-name">
                        <code>{path}</code> {tag}
                      </span>
                      <span class="param-value">{fmtFixed(MODEL_DEFAULTS[path as keyof Model])}</span>
                      <p class="note">{info.label}</p>
                    </li>
                  );
                const error = errors[path];
                const isChanged = path in model;
                const id = `param-${path}`;
                return (
                  <li key={path} class={isChanged ? 'param changed' : 'param'}>
                    <label class="param-name" for={id}>
                      <code>{path}</code> {tag}
                    </label>
                    <input
                      id={id}
                      class="param-value"
                      type="text"
                      inputMode={allowsNegative(path) ? 'text' : 'decimal'}
                      aria-label={path}
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? `${id}-error` : undefined}
                      value={texts[path] ?? String(model[path] ?? defaultValue(path))}
                      onInput={(e) => edit(path, e.currentTarget.value)}
                    />
                    <p class="note">
                      {info.label}
                      {isChanged && ` · default ${defaultValue(path)}`}
                    </p>
                    {error && (
                      <p id={`${id}-error`} class="param-error">
                        {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div class="actions">
        <button type="button" class="btn" onClick={reset} disabled={!changed && !Object.keys(texts).length}>
          Reset all
        </button>
        <span class={invalid ? 'note param-error' : 'note'}>
          {invalid ? `${invalid} invalid, last valid value kept` : changed ? `${changed} changed` : 'All defaults'}
        </span>
        <button type="button" class="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Window>
  );
}
