import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  value: string;
  label: string;
  Icon: LucideIcon;
  green?: boolean;
}

export function StatCard({
  value,
  label,
  Icon,
  green,
}: StatCardProps) {
  const color = green ? "#22c55e" : "#2563eb";

  return (

    
    <div
      className="
      group
      relative
      overflow-hidden
      rounded-3xl
      border
      border-white/10
      backdrop-blur-xl
      p-8
      transition-all
      duration-500
      hover:-translate-y-2
      hover:border-blue-400/30
      hover:bg-white/10
      hover:shadow-[0_25px_60px_rgba(37,99,235,0.18)]
    "
    style={{backgroundColor:"white"}}
    >
      {/* Glow */}

      <div
        className="
        absolute
        -right-8
        -top-8
        h-24
        w-24
        rounded-full
        blur-3xl
        opacity-0
        transition
        duration-500
        group-hover:opacity-100
      "
        style={{
          background: "rgba(37,99,235,.18)",
        }}
      />

      {/* Icon */}

      <div
        className="
        mb-6
        flex
        h-14
        w-14
        items-center
        justify-center
        rounded-2xl
        bg-gradient-to-br
        from-blue-500
        to-blue-600
        shadow-lg
        shadow-blue-500/30
        transition
        duration-300
        group-hover:scale-110
      "
      >
        <Icon size={24} color="white" />
      </div>

      {/* Number */}

      <h3
        className="
        text-5xl
        font-black
        tracking-tight
        transition-all
        duration-300
        group-hover:scale-105
      "
        style={{
          color,
        }}
      >
        {value}
      </h3>

      {/* Accent */}

      <div
        className="
        mt-3
        h-1
        w-16
        rounded-full
        transition-all
        duration-300
        group-hover:w-24
      "
        style={{
          background: color,
        }}
      />

      {/* Label */}

      <p className="mt-5 text-base font-medium text-slate-300">
        {label}
      </p>
    </div>
  );
}