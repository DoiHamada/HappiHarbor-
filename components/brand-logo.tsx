import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  textClassName?: string;
};

export function BrandLogo({ href = "/", className = "", textClassName = "" }: BrandLogoProps) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 no-underline ${className}`}>
      <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-[#dbe6e0]">
        <img src="/logo-mark.svg" alt="HappiHarbor logo" className="h-8 w-8 object-contain" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight text-[#1e2740] ${textClassName}`}>HappiHarbor</span>
    </Link>
  );
}
