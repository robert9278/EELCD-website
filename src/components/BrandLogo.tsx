type Props = {
  className?: string;
  imgClassName?: string;
  src: string;
  alt?: string;
};

export default function BrandLogo({ className, imgClassName, src, alt }: Props) {
  return (
    <div className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      <img src={src} alt={alt || "EAGLEEYE TECH"} className={["h-8 w-auto", imgClassName].filter(Boolean).join(" ")} />
    </div>
  );
}
