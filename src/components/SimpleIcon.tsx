import Svg, { Path } from "react-native-svg";

import { getSimpleIcon } from "../iconSearch";

export { getSimpleIcon };

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
