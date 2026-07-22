import Image from "next/image";
import { toolLogoOverrides } from "./data";

const MONOGRAM_PALETTE = [
  "#165DFC",
  "#6C1BDE",
  "#0F8F58",
  "#C15E12",
  "#0F2D5A",
  "#8B2FEF",
];

function hashToIndex(id: string, mod: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % mod;
  return hash;
}

/** Renders a real brand SVG where one is available locally, otherwise a
 *  deterministic monogram tile as an honest placeholder — no brand artwork
 *  for these tools was supplied with the imported design. */
export function ToolLogo({
  id,
  name,
  size = 48,
  radius = 14,
}: {
  id: string;
  name: string;
  size?: number;
  radius?: number;
}) {
  const src = toolLogoOverrides[id];
  if (src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Image
          src={src}
          alt={`${name} logo`}
          width={size * 0.6}
          height={size * 0.6}
          style={{ width: size * 0.6, height: size * 0.6, objectFit: "contain" }}
        />
      </div>
    );
  }

  const bg = MONOGRAM_PALETTE[hashToIndex(id, MONOGRAM_PALETTE.length)];
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
