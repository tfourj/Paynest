import { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgUri, SvgXml } from "react-native-svg";

import { loadCachedIconXml } from "../iconCache";
import { getSimpleIcon, type IconSource } from "../iconSearch";
import { styles } from "../styles";
import { SimpleIcon } from "./SimpleIcon";

type SubscriptionIconProps = {
  color: string;
  fallbackLabel?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconSource?: IconSource;
  size: number;
};

export function SubscriptionIcon({
  color,
  fallbackLabel,
  iconName = "card",
  iconSource,
  size,
}: SubscriptionIconProps) {
  const [cachedSvgXml, setCachedSvgXml] = useState<string>();
  const simpleIconSlug = iconSource?.provider === "simpleicons" ? iconSource.slug : undefined;
  const remoteUrl = iconSource?.provider !== "simpleicons" ? iconSource?.url : undefined;
  const simpleIcon = getSimpleIcon(simpleIconSlug);

  useEffect(() => {
    let active = true;

    setCachedSvgXml(undefined);
    if (!remoteUrl) return undefined;

    void loadCachedIconXml(remoteUrl)
      .then((xml) => {
        if (active) setCachedSvgXml(xml);
      })
      .catch(() => {
        if (active) setCachedSvgXml(undefined);
      });

    return () => {
      active = false;
    };
  }, [remoteUrl]);

  if (simpleIcon) {
    return <SimpleIcon slug={simpleIcon.slug} size={size} color={color} />;
  }

  if (remoteUrl) {
    if (cachedSvgXml) {
      return <SvgXml xml={cachedSvgXml} width={size} height={size} />;
    }

    if (remoteUrl.endsWith(".svg")) {
      return <SvgUri uri={remoteUrl} width={size} height={size} />;
    }

    return (
      <Image
        source={{ uri: remoteUrl }}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    );
  }

  if (fallbackLabel) {
    return <Text style={[styles.iconBadgeText, { color }]}>{fallbackLabel}</Text>;
  }

  return <Ionicons name={iconName} size={size - 1} color={color} />;
}
