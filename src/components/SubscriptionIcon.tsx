import { Component, type ReactNode, useEffect, useState } from "react";
import { Image, Platform, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";

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

type SvgIconBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  resetKey?: string;
};

type SvgIconBoundaryState = {
  hasError: boolean;
};

class SvgIconBoundary extends Component<SvgIconBoundaryProps, SvgIconBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: SvgIconBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

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
  const remoteSvgUrl = remoteUrl?.endsWith(".svg") ? remoteUrl : undefined;
  const simpleIcon = getSimpleIcon(simpleIconSlug);
  const fallbackIcon = <Ionicons name={iconName} size={size - 1} color={color} />;

  useEffect(() => {
    let active = true;

    setCachedSvgXml(undefined);
    if (!remoteSvgUrl || Platform.OS === "web") return undefined;

    void loadCachedIconXml(remoteSvgUrl)
      .then((xml) => {
        if (active) setCachedSvgXml(xml);
      })
      .catch(() => {
        if (active) setCachedSvgXml(undefined);
      });

    return () => {
      active = false;
    };
  }, [remoteSvgUrl]);

  if (simpleIcon) {
    return <SimpleIcon slug={simpleIcon.slug} size={size} color={color} />;
  }

  if (remoteUrl) {
    if (Platform.OS === "web" && remoteSvgUrl) {
      return (
        <Image
          source={{ uri: remoteSvgUrl }}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      );
    }

    if (cachedSvgXml) {
      return (
        <SvgIconBoundary fallback={fallbackIcon} resetKey={remoteSvgUrl}>
          <SvgXml xml={cachedSvgXml} width={size} height={size} />
        </SvgIconBoundary>
      );
    }

    if (remoteSvgUrl) {
      return fallbackIcon;
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

  return fallbackIcon;
}
