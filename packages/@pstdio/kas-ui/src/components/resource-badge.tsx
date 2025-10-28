import { chakra, IconButton, Spacer, Text } from "@chakra-ui/react";
import { Tooltip } from "./tooltip.tsx";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, X } from "lucide-react";
import { getFileTypeIcon } from "../utils/getIcon.ts";

export interface MissingResourceBadgeProps {
  referenceId: string;
  onRemove?: (referenceId: string) => void;
}

/**
 * Shown when a reference points to a resource that no longer exists
 */
export const MissingResourceBadge = (props: MissingResourceBadgeProps) => {
  const { referenceId, onRemove } = props;
  return (
    <chakra.span
      height="24px"
      lineHeight={{ base: "24px" }}
      gap="2xs"
      display="flex"
      flexDirection="row"
      alignItems="center"
      paddingX="xs"
      borderRadius="xs"
      color={`foreground.feedback.alert`}
      bg={`bg.accent-secondary.red-light`}
      _hover={{
        bg: `bg.accent-secondary.red-light`,
      }}
    >
      <chakra.span mr="xs" display="inline-flex">
        <AlertTriangle size={14} />
      </chakra.span>
      <Text maxW={{ base: "17.5rem" }} textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden">
        Missing Reference
      </Text>
      <Spacer />
      {onRemove && (
        <IconButton
          color="foreground.feedback.alert"
          aria-label="Remove reference"
          size="2xs"
          ml="sm"
          variant="ghost"
          _hover={{
            bg: "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(referenceId);
          }}
        >
          <X size={12} />
        </IconButton>
      )}
    </chakra.span>
  );
};

export interface ResourceBadgeProps {
  fileName: string;
  onRemove?: (fileName: string) => void;
  onSelect?: (fileName: string) => void;
}

export const ResourceBadge = (props: ResourceBadgeProps) => {
  const { fileName, onSelect, onRemove } = props;
  const IconComp: LucideIcon = getFileTypeIcon(fileName);

  return (
    <chakra.span
      height="24px"
      lineHeight={{ base: "24px" }}
      display="flex"
      flexDirection="row"
      alignItems="center"
      paddingX="xs"
      cursor={onSelect ? "pointer" : "default"}
      borderRadius="xs"
      color={"color.primary"}
      bg={"background.secondary"}
      _hover={{
        bg: "background.tertiary",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(fileName);
      }}
    >
      <chakra.span mr="xs" display="inline-flex">
        <IconComp size={14} />
      </chakra.span>
      <Tooltip content={fileName}>
        <Text maxW={{ base: "14rem" }} textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden">
          {fileName}
        </Text>
      </Tooltip>
      <Spacer />
      {onRemove && (
        <IconButton
          aria-label="Remove reference"
          size="2xs"
          ml="xs"
          variant="ghost"
          _hover={{
            bg: "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(fileName);
          }}
        >
          <X size={12} />
        </IconButton>
      )}
    </chakra.span>
  );
};
