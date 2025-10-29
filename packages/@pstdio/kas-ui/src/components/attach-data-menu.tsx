import { Box, IconButton, Input, Menu, Portal, Span, Tooltip } from "@chakra-ui/react";
import { useState } from "react";
import { MenuItem } from "./menu-item";
import { Paperclip, UploadCloud, FileText } from "lucide-react";

export interface AttachDataMenuProps {
  availableResources?: string[];
  attachedResources?: string[];
  onFileUpload?: () => Promise<string[] | undefined>;
  onAttach?: (resourceId: string) => void;
  isDisabled?: boolean;
}

export const AttachDataMenu = (props: AttachDataMenuProps) => {
  const { availableResources = [], attachedResources = [], onFileUpload, onAttach, isDisabled = false } = props;

  const [searchTerm, setSearchTerm] = useState("");
  const attachedSet = new Set(attachedResources);

  const filteredResources = availableResources.filter((resource) =>
    resource.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const selectableResources = filteredResources.filter((resource) => !attachedSet.has(resource));
  const hasUploadAction = typeof onFileUpload === "function";
  const showSearch = availableResources.length > 5;
  const noMatches = selectableResources.length === 0;
  const showNoResults = searchTerm.length > 0 && noMatches;
  const showNoResources = searchTerm.length === 0 && noMatches && !hasUploadAction;

  const trigger = (
    <Tooltip.Root closeDelay={50} openDelay={100}>
      <Tooltip.Trigger asChild>
        <IconButton size="xs" variant="ghost" colorPalette="secondary" aria-label="Attach data" disabled={isDisabled}>
          <Paperclip size={16} />
          <Span srOnly>Attach data</Span>
        </IconButton>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>Attach data</Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );

  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content gap="2">
            {showSearch && (
              <Box px="sm">
                <Input
                  autoFocus
                  size="md"
                  px="2"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Box>
            )}
            {showNoResults && <MenuItem isDisabled primaryLabel="No results found" />}
            {hasUploadAction && !searchTerm && (
              <MenuItem
                primaryLabel="Upload Files"
                leftIcon={<UploadCloud size={16} />}
                onClick={async () => {
                  const ids = await onFileUpload?.();
                  if (!ids || ids.length === 0) return;
                  ids.forEach((id) => onAttach?.(id));
                  setSearchTerm("");
                }}
              />
            )}
            {selectableResources.map((resource) => (
              <MenuItem
                key={resource}
                primaryLabel={resource}
                leftIcon={<FileText size={16} />}
                onClick={() => {
                  onAttach?.(resource);
                  setSearchTerm("");
                }}
              />
            ))}
            {showNoResources && <MenuItem isDisabled primaryLabel="No available resources" />}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
