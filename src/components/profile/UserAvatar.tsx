export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserAvatar({
  src,
  name,
  className = "h-10 w-10",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center justify-center overflow-hidden rounded-full border border-glass-border bg-primary/15 font-display font-bold text-primary ${className}`}
    >
      {src ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initialsOf(name ?? "")
      )}
    </span>
  );
}
