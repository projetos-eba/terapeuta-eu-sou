import type { ImgHTMLAttributes } from "react";
// Next image optimization is not part of this isolated adapter test.
export default function Image({
  fill,
  priority: _priority,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      {...props}
      alt={props.alt ?? ""}
      style={
        fill
          ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
          : props.style
      }
    />
  );
}
