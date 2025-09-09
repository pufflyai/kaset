import { Icon, type IconName } from "@/icons/Icon";
import { Avatar, Button, Card, Timeline as ChakraTimeline, Input, Span, Stack, Text, Box } from "@chakra-ui/react";
import { useState } from "react";
import { CodeEditor } from "./code-editor";
import { DiffBubble } from "./diff-bubble";
import { ResourceBadge } from "./resource-badge";

export const Timeline = ChakraTimeline;

export type TimelineDoc = {
  items: Item[];
};

export type Item = {
  id?: string;
  timestamp?: string;
  indicator?: Indicator;
  title: TitleSegment[];
  blocks?: Block[];
};

export type Indicator =
  | { type: "icon"; icon: IconName; color?: string }
  | { type: "avatar"; src: string; alt?: string }
  | { type: "none" };

export type TitleSegment =
  | { kind: "text"; text: string; bold?: boolean; muted?: boolean }
  | { kind: "avatar"; src: string; alt?: string }
  | { kind: "diff"; fileName: string; filePath?: string; additions?: number; deletions?: number };

export type Block =
  | { type: "comment"; text: string; reactions?: { clap?: number } }
  | { type: "code"; language: string; code: string; editable?: boolean }
  | { type: "input"; placeholder?: string }
  | { type: "text"; text: string }
  | {
      type: "references";
      references: Array<string>;
    };

function TitleInline({
  seg,
  isClickable,
  onOpenFile,
}: {
  seg: TitleSegment;
  isClickable?: boolean;
  onOpenFile?: (filePath: string) => void;
}) {
  if (seg.kind === "avatar") {
    return (
      <Avatar.Root width="1.5rem" height="1.5rem">
        <Avatar.Image src={seg.src} alt={seg.alt} />
        <Avatar.Fallback />
      </Avatar.Root>
    );
  }

  if (seg.kind === "diff") {
    const additions = seg.additions ?? 0;
    const deletions = seg.deletions ?? 0;
    return (
      <DiffBubble
        fileName={seg.fileName}
        additions={additions}
        deletions={deletions}
        onClickFileLink={() => {
          const path = seg.filePath ?? seg.fileName;
          onOpenFile?.(path);
        }}
      />
    );
  }

  const fontWeight = seg.bold ? "medium" : undefined;
  return (
    <Span
      fontWeight={fontWeight}
      color="foreground.secondary"
      _groupHover={{
        color: isClickable && !seg.muted ? "foreground.primary" : "foreground.secondary",
      }}
    >
      {seg.text}
    </Span>
  );
}

function IndicatorView({ ind }: { ind?: Indicator }) {
  if (!ind || ind.type === "none") return null;

  if (ind.type === "icon") {
    return (
      <Timeline.Indicator outline="none" shadow="none" border="none" background={"bg"} color={"fg"}>
        <Span display="inline-flex" alignItems="center">
          <Icon name={ind.icon} size="2xs" />
        </Span>
      </Timeline.Indicator>
    );
  }

  return (
    <Timeline.Indicator>
      <Avatar.Root boxSize="full">
        <Avatar.Image src={ind.src} alt={ind.alt} />
        <Avatar.Fallback />
      </Avatar.Root>
    </Timeline.Indicator>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "comment":
      return (
        <Card.Root>
          <Card.Body>{b.text}</Card.Body>
          {b.reactions?.clap ? (
            <Card.Footer>
              <Button>👏 {b.reactions.clap}</Button>
            </Card.Footer>
          ) : null}
        </Card.Root>
      );
    case "code":
      return (
        <Card.Root height="120px" minH="120px" minWidth="320px" overflow="hidden">
          <Card.Body padding="0">
            <CodeEditor language={b.language} code={b.code} isEditable={!!b.editable} />
          </Card.Body>
        </Card.Root>
      );
    case "input":
      return <Input placeholder={b.placeholder ?? ""} />;
    case "text":
      return (
        <Card.Root background="transparent">
          <Card.Body padding="sm">
            <Text textStyle="label/S/regular">{b.text}</Text>
          </Card.Body>
        </Card.Root>
      );
    case "references":
      return (
        <Stack mt="xs" gap="xs" flexDir="row" flexWrap="wrap">
          {b.references.map((ref) => {
            return <ResourceBadge key={ref} fileName={ref} />;
          })}
        </Stack>
      );
  }
}

export function TimelineFromJSON({ data, onOpenFile }: { data: TimelineDoc; onOpenFile?: (filePath: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const getKey = (it: Item, idx: number) => (it.id ? `id:${it.id}` : `idx:${idx}`);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Timeline.Root>
      {data.items.map((it, idx) => {
        const key = getKey(it, idx);
        const hasBlocks = (it.blocks?.length ?? 0) > 0;
        const isOpen = expanded[key] ?? false;

        return (
          <Timeline.Item gap="xs" key={key}>
            <Timeline.Connector>
              <Timeline.Separator />
              <IndicatorView ind={it.indicator} />
            </Timeline.Connector>
            <Timeline.Content pb="xs">
              {it.title.length > 0 && (
                <Timeline.Title
                  className="group"
                  fontWeight="normal"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  cursor={hasBlocks ? "pointer" : "default"}
                  onClick={hasBlocks ? () => toggle(key) : undefined}
                >
                  <Span display="inline-flex" alignItems="center" gap="sm">
                    {it.title.map((seg, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
                        <TitleInline seg={seg} isClickable={hasBlocks} onOpenFile={onOpenFile} />
                      </span>
                    ))}
                    {hasBlocks ? (
                      <Span
                        display="inline-flex"
                        alignItems="center"
                        transition="transform 200ms ease, color 200ms ease"
                        transform={isOpen ? "rotate(0deg)" : "rotate(-180deg)"}
                        color="transparent"
                        _groupHover={{ color: "foreground.primary" }}
                      >
                        <Icon name="arrow-up-2" size="xs" />
                      </Span>
                    ) : null}
                  </Span>
                </Timeline.Title>
              )}
              {hasBlocks ? (
                <Box
                  display="grid"
                  gridTemplateRows={isOpen ? "1fr" : "0fr"}
                  transition="grid-template-rows 220ms ease"
                >
                  {isOpen ? (
                    <Box
                      overflow="hidden"
                      opacity={1}
                      transform="translateY(0)"
                      transition="opacity 200ms ease, transform 200ms ease"
                    >
                      {it.blocks!.map((b, i) => (
                        <Box key={i}>
                          <BlockView b={b} />
                        </Box>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              ) : null}
            </Timeline.Content>
          </Timeline.Item>
        );
      })}
    </Timeline.Root>
  );
}
