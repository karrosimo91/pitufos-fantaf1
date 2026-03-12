interface CountryFlagProps {
  countryCode: string;
  size?: number;
  className?: string;
}

export default function CountryFlag({ countryCode, size = 20, className = "" }: CountryFlagProps) {
  return (
    <img
      src={`/flags/${countryCode}.svg`}
      alt={countryCode.toUpperCase()}
      width={size * 1.5}
      height={size}
      className={`inline-block rounded-sm object-cover ${className}`}
      style={{ width: size * 1.5, height: size }}
    />
  );
}
