import Image from "next/image";

type BrandProps = {
  inverse?: boolean;
  markOnly?: boolean;
};

export function Brand({ markOnly = false }: BrandProps) {
  return (
    <Image
      src={markOnly ? "/brand/techprofile-mark.svg" : "/brand/techprofile-full.svg"}
      alt={markOnly ? "TechProfile AI" : "TechProfile AI"}
      width={markOnly ? 64 : 480}
      height={markOnly ? 64 : 84}
      className={markOnly ? "brand-mark" : "brand-logo"}
      priority
    />
  );
}
