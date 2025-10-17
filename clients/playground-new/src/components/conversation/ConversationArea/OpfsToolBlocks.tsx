import { Card, Stack, Text } from "@chakra-ui/react";
import { CodeEditor } from "@/components/ui/code-editor";
import { DiffEditor } from "@/components/ui/diff-editor";
import { ResourceBadge } from "@/components/ui/resource-badge";

export interface OpfsLsBlockProps {
  entries: Array<{ path: string; kind: "file" | "directory" }>;
  onOpenFile?: (filePath: string) => void;
}

export function OpfsLsBlock(props: OpfsLsBlockProps) {
  const { entries, onOpenFile } = props;
  const hasEntries = entries.length > 0;

  return (
    <Card.Root background="transparent" borderColor="border.subtle">
      <Card.Body padding="sm">
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

export interface OpfsReadFileBlockProps {
  summary?: string;
  content: string;
  language?: string;
  truncated?: boolean;
}

export function OpfsReadFileBlock(props: OpfsReadFileBlockProps) {
  const { content, language, summary, truncated } = props;

  return (
    <Stack gap="xs">
      {summary ? (
        <Text textStyle="label/S/regular" color="foreground.secondary">
          {summary}
        </Text>
      ) : null}
      <Card.Root minH="160px" overflow="hidden">
        <Card.Body padding="0">
          <CodeEditor language={language ?? "text"} code={content} isEditable={false} />
        </Card.Body>
      </Card.Root>
      {truncated ? (
        <Text textStyle="label/XS/regular" color="foreground.secondary">
          Content truncated. Use opfs_read_file with pagination to view more.
        </Text>
      ) : null}
    </Stack>
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
    <Card.Root minH="160px" overflow="hidden">
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
