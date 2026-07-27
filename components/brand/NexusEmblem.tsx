import Image from "next/image";

export function NexusEmblem({
  state = "idle",
  className = "",
}: {
  state?: "idle" | "thinking" | "complete";
  className?: string;
}) {
  return (
    <span
      className={`nexus-emblem nexus-emblem--${state} ${className}`}
      aria-hidden="true"
    >
      <span className="nexus-emblem__field" />
      <Image
        className="nexus-emblem__image"
        src="/nexus-emblem-96.png"
        width={54}
        height={54}
        alt=""
        priority
      />
    </span>
  );
}
