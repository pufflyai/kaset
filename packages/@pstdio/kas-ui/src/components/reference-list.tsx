import { Stack } from "@chakra-ui/react";
import { ResourceBadge } from "./resource-badge";

export interface ReferenceListProps {
  references?: string[];
  onSelect?: (resourceId: string) => void;
  onRemove?: (resourceId: string) => void;
}

/**
 * Simple reference list component that displays resource badges.
 * This is a "dumb" component that only handles rendering based on provided props.
 */
export const ReferenceList = (props: ReferenceListProps) => {
  const { references = [], onSelect, onRemove } = props;

  if (references.length === 0) return null;

  return (
    <Stack mt="1" gap="1" flexDir="row" flexWrap="wrap">
      {references.map((reference) => (
        <ResourceBadge
          key={reference}
          fileName={reference}
          onSelect={() => onSelect?.(reference)}
          onRemove={() => onRemove?.(reference)}
        />
      ))}
    </Stack>
  );
};
