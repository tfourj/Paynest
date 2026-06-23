import Svg, { Path } from "react-native-svg";
import * as SimpleIcons from "simple-icons";

type SimpleIconData = {
  path: string;
  slug: string;
  title: string;
  hex: string;
};

export function getSimpleIcon(slug?: string) {
  if (!slug) return undefined;
  const key = `si${slug[0].toUpperCase()}${slug.slice(1)}`;
  return (SimpleIcons as Record<string, unknown>)[key] as SimpleIconData | undefined;
}

type SimpleIconProps = {
  color: string;
  size: number;
  slug?: string;
};

export function SimpleIcon({ color, size, slug }: SimpleIconProps) {
  const icon = getSimpleIcon(slug);
  if (!icon) return null;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={icon.path} fill={color} />
    </Svg>
  );
}
