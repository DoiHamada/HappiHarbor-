import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

const svgClass = "h-5 w-5";

function FemaleGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="5" />
      <path d="M12 13v8M8 18h8" />
    </svg>
  );
}

function MaleGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="15" r="6" />
      <path d="M13 11l7-7M15 4h5v5" />
    </svg>
  );
}

function TransFemaleGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="10" cy="9" r="4.5" />
      <path d="M10 13.5v7M6.5 17h7" />
      <path d="M14 5l5-4M16 1h3v3" />
    </svg>
  );
}

function TransMaleGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="12" r="5" />
      <path d="M12.5 8.5l5-5M14.5 3.5h3v3" />
      <path d="M9 17v5M6.5 20h5" />
    </svg>
  );
}

function TwoMaleGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="8" cy="14" r="4.5" />
      <circle cx="14.5" cy="10" r="4.5" />
      <path d="M11.5 7.5L16 3M13 3h3v3" />
      <path d="M18 6l3-3M18 3h3v3" />
    </svg>
  );
}

function MaleFemaleGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="8" cy="14" r="4.5" />
      <circle cx="15.5" cy="8.5" r="4" />
      <path d="M15.5 12.5v6M12.5 16h6" />
      <path d="M18.5 5.5L22 2M19 2h3v3" />
    </svg>
  );
}

function BisexualGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="10" cy="10" r="4.5" />
      <path d="M10 14.5V21M6.5 18h7" />
      <path d="M13 7l5-5M15 2h3v3" />
    </svg>
  );
}

function PanGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="12" r="4.5" />
      <circle cx="15" cy="12" r="4.5" />
    </svg>
  );
}

function AsexualGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 6.5v11M6.5 12h11" />
    </svg>
  );
}

function QuestionGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.8-2.5 2-2.5 4" />
      <circle cx="12" cy="17.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

function OtherGlyph({ className = svgClass }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.7 5.7l2.8 2.8M15.5 15.5l2.8 2.8M18.3 5.7l-2.8 2.8M8.5 15.5l-2.8 2.8" />
    </svg>
  );
}

function titleize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function genderLabel(value: string): string {
  if (value === "trans_female") return "Transgender Female";
  if (value === "trans_male") return "Transgender Male";
  return titleize(value);
}

export function orientationLabel(value: string): string {
  if (value === "prefer_not_to_say") return "Prefer Not To Say";
  return titleize(value);
}

export function GenderIcon({ value, className }: { value: string; className?: string }) {
  if (value === "female") return <FemaleGlyph className={className} />;
  if (value === "male") return <MaleGlyph className={className} />;
  if (value === "trans_female") return <TransFemaleGlyph className={className} />;
  if (value === "trans_male") return <TransMaleGlyph className={className} />;
  return <OtherGlyph className={className} />;
}

export function OrientationIcon({ value, className }: { value: string; className?: string }) {
  if (value === "heterosexual") return <MaleFemaleGlyph className={className} />;
  if (value === "homosexual") return <TwoMaleGlyph className={className} />;
  if (value === "bisexual") return <BisexualGlyph className={className} />;
  if (value === "pansexual") return <PanGlyph className={className} />;
  if (value === "asexual") return <AsexualGlyph className={className} />;
  if (value === "questioning") return <QuestionGlyph className={className} />;
  return <OtherGlyph className={className} />;
}

export function IdentityPill({
  icon,
  label
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-harbor-ink/15 px-2.5 py-1 text-xs text-harbor-ink/80">
      {icon}
      <span>{label}</span>
    </span>
  );
}
