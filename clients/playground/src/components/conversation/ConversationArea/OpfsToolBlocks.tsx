import { DiffEditor, ResourceBadge } from "@pstdio/kas-ui";
import { Card, Stack, Text } from "@chakra-ui/react";

export interface OpfsLsBlockProps {
  entries: Array<{ path: string; kind: "file" | "directory" }>;
  onOpenFile?: (filePath: string) => void;
}

export function OpfsLsBlock(props: OpfsLsBlockProps) {
  const { entries, onOpenFile } = props;
  const hasEntries = entries.length > 0;

  return (
    <Card.Root background="transparent" borderColor="border.subtle">
      <Card.Body padding="0">
        <Stack gap="2xs">
          {hasEntries ? (
            entries.map((entry) => {
              const displayPath = entry.kind === "directory" ? `${entry.path}/` : entry.path;
              const handleSelect = onOpenFile ? () => onOpenFile(entry.path) : undefined;
              return <ResourceBadge key={entry.path} fileName={displayPath} onSelect={handleSelect} />;
            })
          ) : (
            <Text textStyle="label/S/regular" color="foreground.secondary">
              No entries found.
            </Text>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export interface OpfsWriteFileBlockProps {
  originalContent: string;
  newContent: string;
  language?: string;
}

export function OpfsWriteFileBlock(props: OpfsWriteFileBlockProps) {
  const { language, newContent, originalContent } = props;

  return (
    <Card.Root height="160px" overflow="hidden">
      <Card.Body padding="0">
        <DiffEditor
          original={originalContent}
          modified={newContent}
          language={language}
          sideBySide={false}
          disableScroll={true}
        />
      </Card.Body>
    </Card.Root>
  );
}
