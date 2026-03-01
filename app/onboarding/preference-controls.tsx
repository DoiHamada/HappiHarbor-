"use client";

import { useMemo, useState } from "react";
import { LANGUAGE_OPTIONS, ONBOARDING_TAG_OPTIONS, type OnboardingTagKey } from "@/types/profile";

type PreferenceControlsProps = {
  initialMinAge: number;
  initialMaxAge: number;
  initialLanguages: string[];
  initialTags: Partial<Record<OnboardingTagKey, string[]>>;
};

function titleize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function denormalizeToken(value: string): string {
  return titleize(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type TokenFieldProps = {
  label: string;
  name: string;
  suggestions: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
};

function TokenField({ label, name, suggestions, values, onChange, placeholder }: TokenFieldProps) {
  const [draft, setDraft] = useState("");
  const datalistId = `${name}_options`;

  function addToken(raw: string) {
    const normalized = normalizeToken(raw);
    if (!normalized) return;
    if (values.includes(normalized)) {
      setDraft("");
      return;
    }
    onChange([...values, normalized]);
    setDraft("");
  }

  return (
    <fieldset className="space-y-2">
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 ? <p className="text-xs text-harbor-ink/60">No tags selected.</p> : null}
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-2 rounded-full border border-harbor-ink/15 px-3 py-1 text-xs">
            {denormalizeToken(value)}
            <button
              type="button"
              className="text-harbor-ink/60 transition hover:text-harbor-ink"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
            >
              x
            </button>
            <input type="hidden" name={name} value={value} />
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          list={datalistId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addToken(draft);
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={() => addToken(draft)}>
          Add
        </button>
      </div>
      <datalist id={datalistId}>
        {suggestions.map((option) => (
          <option key={option} value={denormalizeToken(option)} />
        ))}
      </datalist>
    </fieldset>
  );
}

export function PreferenceControls({
  initialMinAge,
  initialMaxAge,
  initialLanguages,
  initialTags
}: PreferenceControlsProps) {
  const safeInitialMin = clamp(initialMinAge, 13, 100);
  const safeInitialMax = Math.max(safeInitialMin, clamp(initialMaxAge, 13, 100));

  const [minAge, setMinAge] = useState(safeInitialMin);
  const [maxAge, setMaxAge] = useState(safeInitialMax);
  const [languages, setLanguages] = useState(Array.from(new Set(initialLanguages.map(normalizeToken).filter(Boolean))));
  const [tags, setTags] = useState<Partial<Record<OnboardingTagKey, string[]>>>(initialTags);

  const minPercent = useMemo(() => ((minAge - 13) / 87) * 100, [minAge]);
  const maxPercent = useMemo(() => ((maxAge - 13) / 87) * 100, [maxAge]);

  return (
    <div className="grid gap-4 rounded-xl border border-harbor-ink/10 bg-harbor-cream/50 p-4">
      <fieldset className="space-y-3">
        <legend className="label">Preferred age range</legend>
        <div className="rounded-xl border border-harbor-ink/10 bg-white p-3">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Min: {minAge}</span>
            <span>Max: {maxAge}</span>
          </div>
          <div className="relative h-7">
            <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-harbor-ink/10" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-harbor-coral"
              style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
            />
            <input
              className="range-slider"
              type="range"
              min={13}
              max={100}
              value={minAge}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMinAge(Math.min(next, maxAge));
              }}
            />
            <input
              className="range-slider"
              type="range"
              min={13}
              max={100}
              value={maxAge}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMaxAge(Math.max(next, minAge));
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-harbor-ink/60">
            <span>13</span>
            <span>100</span>
          </div>
          <input type="hidden" name="min_age" value={minAge} />
          <input type="hidden" name="max_age" value={maxAge} />
        </div>
      </fieldset>

      <TokenField
        label="Languages you speak"
        name="preferred_languages"
        suggestions={[...LANGUAGE_OPTIONS]}
        values={languages}
        onChange={setLanguages}
        placeholder="Type a language and press Enter"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(ONBOARDING_TAG_OPTIONS) as OnboardingTagKey[]).map((key) => (
          <TokenField
            key={key}
            label={titleize(key)}
            name={`tag_${key}`}
            suggestions={ONBOARDING_TAG_OPTIONS[key]}
            values={tags[key] ?? []}
            onChange={(next) => setTags((prev) => ({ ...prev, [key]: next }))}
            placeholder={`Add ${titleize(key)} tag`}
          />
        ))}
      </div>

      <style jsx>{`
        .range-slider {
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          transform: translateY(-50%);
          appearance: none;
          background: transparent;
          pointer-events: none;
        }

        .range-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          border: 2px solid #111827;
          background: #ffffff;
          cursor: pointer;
          pointer-events: auto;
        }

        .range-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          border: 2px solid #111827;
          background: #ffffff;
          cursor: pointer;
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}
