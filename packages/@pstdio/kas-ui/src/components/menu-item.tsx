import { Flex, MenuItem as ChakraMenuItem, Text } from "@chakra-ui/react";
import type { MouseEvent, ReactNode } from "react";
import { Tooltip } from "./tooltip";

interface MenuItemProps {
  id?: string;
  children?: ReactNode;
  isDisabled?: boolean;
  isSelected?: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  tooltipLabel?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  tabIndex?: number;
  setRefElement?: (element: HTMLButtonElement | null) => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function MenuItem(props: MenuItemProps) {
  const {
    id,
    primaryLabel,
    tooltipLabel,
    secondaryLabel,
    leftIcon = null,
    rightIcon = null,
    isDisabled,
    isSelected,
    tabIndex,
    setRefElement,
    onClick,
    onMouseDown,
    onMouseEnter,
  } = props;

  return (
    <ChakraMenuItem
      id={id}
      ref={setRefElement}
      tabIndex={tabIndex}
      disabled={isDisabled}
      aria-selected={isSelected}
      paddingX="sm"
      paddingY="xxs"
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      height="auto"
      minHeight="2rem"
      role="option"
      maxWidth="20rem"
      overflow="hidden"
      cursor={isDisabled ? "default" : "pointer"}
      value={id ?? primaryLabel}
    >
      <Flex justifyContent="space-between" alignItems="center" gap="xs" flex="1">
        <Tooltip positioning={{ placement: "right" }} content={tooltipLabel} disabled={!tooltipLabel}>
          <Flex alignItems="center" gap="xs" flex="1">
            {leftIcon}
            <Flex gap="xxs" flexDirection="column">
              <Text textOverflow="ellipsis" textStyle="label/M/regular">
                {primaryLabel}
              </Text>
              {secondaryLabel && (
                <Text textOverflow="ellipsis" textStyle="label/S/regular" color="foreground.secondary">
                  {secondaryLabel}
                </Text>
              )}
            </Flex>
          </Flex>
        </Tooltip>
        <Flex justifyContent="flex-end" color="foreground.primary">
          {rightIcon}
        </Flex>
      </Flex>
    </ChakraMenuItem>
  );
}
