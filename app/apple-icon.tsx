import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M19 4 10 18h6l-3 10 10-15h-6l3-9z" fill="#00C2FF" />
        </svg>
      </div>
    ),
    size,
  );
}
