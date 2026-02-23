import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  textClassName?: string;
};

export function BrandLogo({ href = "/", className = "", textClassName = "" }: BrandLogoProps) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 no-underline ${className}`}>
      <img src="/logo-mark.svg" alt="HappiHarbor logo" className="h-8 w-8 rounded-full" />
      <span className={`text-lg font-bold text-[#1e2740] ${textClassName}`}>HappiHarbor</span>
    </Link>
  );
}
