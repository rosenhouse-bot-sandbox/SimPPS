import { useState } from 'preact/hooks';
import { defaultValue, MODEL_DEFAULTS, type Model } from '../sim/model';
import type { ModelOverrides } from '../sim/types';
import { MODEL_PARAMS } from '../sources/model';
import { cleanOverrides, EDITABLE_PATHS, paramError, paramInfo } from '../sources/params';
import { getSource } from '../sources/registry';
import { Sourced } from './Sourced';
import { Window } from './Window';

/** Rows by source, in the order the parameters appear in M. Fixed parameters show their value only. */
const GROUPS = (() => {
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(MODEL_PARAMS) as (keyof Model)[]) {
    const paths = MODEL_PARAMS[key].fixed ? [key] : EDITABLE_PATHS.filter((p) => p.split('.')[0] === key);
    const source = MODEL_PARAMS[key].source;
    groups.set(source, [...(groups.get(source) ?? []), ...paths]);
  }
  return [...groups];
})();

const parse = (text: string) => (text.trim() === '' ? NaN : Number(text));

function fmtFixed(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(fmtFixed).join(', ')}]`;
  return v === Infinity ? '∞' : String(v);
}

interface ModelParamsProps {
  model: ModelOverrides;
  onChange: (model: ModelOverrides) => void;
  onClose: () => void;
}

export function ModelParams({ model, onChange, onClose }: ModelParamsProps) {
  const [texts, setTexts] = useState<Record<string, string>>({});
  const raw: ModelOverrides = { ...model };
  for (const [path, text] of Object.entries(texts)) raw[path] = parse(text);
  const edit = (path: string, text: string) => {
    const next = { ...texts, [path]: text };
    setTexts(next);
    onChange(cleanOverrides({ ...raw, [path]: parse(text) }));
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
                if (info.fixed)
                  return (
                    <li key={path} class="param">
                      <span class="param-name">
                        <code>{path}</code> {tag}
                      </span>
                      <span class="param-value">{fmtFixed(MODEL_DEFAULTS[path as keyof Model])}</span>
                      <p class="note">{info.note}</p>
                    </li>
                  );
                const error = path in texts ? paramError(path, raw[path], raw) : null;
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
                      inputMode="decimal"
                      aria-label={path}
                      aria-invalid={error ? 'true' : undefined}
                      value={texts[path] ?? String(model[path] ?? defaultValue(path))}
                      onInput={(e) => edit(path, e.currentTarget.value)}
                    />
                    <p class="note">
                      {info.note}
                      {isChanged && ` Default ${defaultValue(path)}.`}
                    </p>
                    {error && <p class="param-error">{error}</p>}
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
        <span class="note">{changed ? `${changed} changed` : 'All defaults'}</span>
        <button type="button" class="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Window>
  );
}
