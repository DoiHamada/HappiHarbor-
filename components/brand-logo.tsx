import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  textClassName?: string;
};

export function BrandLogo({ href = "/", className = "", textClassName = "" }: BrandLogoProps) {
  return (
    <Link href={href} className={`inline-flex items-center gap-3 no-underline ${className}`}>
      <span className="inline-flex overflow-hidden rounded-full bg-white p-1.5 shadow-[0_10px_24px_-14px_rgba(11,20,48,0.7)] ring-1 ring-[#d9e8e2]">
        <img src="/logo-mark.svg" alt="HappiHarbor logo" className="h-8 w-8 object-contain" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight text-[#111a34] ${textClassName}`}>HappiHarbor</span>
    </Link>
  );
}
