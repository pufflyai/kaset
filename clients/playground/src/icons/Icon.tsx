import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownRight,
  File,
  Globe,
  Play,
  Plug,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

export type IconName =
  | "plugin"
  | "copy"
  | "danger"
  | "check"
  | "play"
  | "arrow-down"
  | "arrow-down-1"
  | "arrow-up-2"
  | "pointing-arrow"
  | "search"
  | "browser"
  | "file";

export type IconSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | number;

const iconMap: Record<IconName, LucideIcon> = {
  plugin: Plug,
  copy: Copy,
  danger: AlertTriangle,
  check: Check,
  play: Play,
  "arrow-down": ArrowDown,
  "arrow-down-1": ChevronDown,
  "arrow-up-2": ChevronUp,
  "pointing-arrow": CornerDownRight,
  search: Search,
  browser: Globe,
  file: File,
};

const sizeMap: Record<Exclude<IconSize, number>, number> = {
  "2xs": 12,
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
};

export interface IconProps extends Omit<ComponentProps<LucideIcon>, "size"> {
  name: IconName;
  size?: IconSize;
}

export function Icon(props: IconProps) {
  const { name, size = "sm", ...rest } = props;
  const Comp = iconMap[name];
  const pixelSize = typeof size === "number" ? size : (sizeMap[size] ?? 16);
  return <Comp size={pixelSize} {...rest} />;
}
