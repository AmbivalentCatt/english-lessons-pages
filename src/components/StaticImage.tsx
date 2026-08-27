import type { CSSProperties, ImgHTMLAttributes } from "react";

type StaticImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  src: string;
  unoptimized?: boolean;
};

export default function StaticImage({
  fill = false,
  priority = false,
  style,
  unoptimized,
  ...props
}: StaticImageProps) {
  void unoptimized;
  const fillStyle: CSSProperties | undefined = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        ...style,
      }
    : style;

  return (
    <img
      {...props}
      decoding="async"
      loading={priority ? "eager" : props.loading}
      style={fillStyle}
    />
  );
}
