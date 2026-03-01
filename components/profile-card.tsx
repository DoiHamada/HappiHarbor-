import type { ReactNode } from "react";

type ProfileCardProps = {
  avatarUrl?: string | null;
  displayName: string;
  publicId: string;
  isActive?: boolean;
  nameAdornment?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
};

export function ProfileCard({
  avatarUrl,
  displayName,
  publicId,
  isActive = false,
  nameAdornment,
  meta,
  action
}: ProfileCardProps) {
  return (
    <section className="overflow-hidden rounded-xl2 border border-harbor-ink/10 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl ?? "/logo-mark.svg"}
            alt={`${displayName} avatar`}
            className="h-16 w-16 rounded-full border border-harbor-ink/10 object-cover"
          />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span>{displayName}</span>
              {nameAdornment}
            </h1>
            {meta ? (
              <div className="mt-1 text-sm text-harbor-ink/75">{meta}</div>
            ) : (
              <p className="mt-1 flex items-center gap-2 text-sm text-harbor-ink/75">
                <span className={`inline-block size-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                {publicId} · {isActive ? "Active now" : "Inactive"}
              </p>
            )}
          </div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </section>
  );
}
