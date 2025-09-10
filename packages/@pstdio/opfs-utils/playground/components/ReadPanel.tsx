import { useState } from "react";
import { processSingleFileContent, type ProcessedFileReadResult } from "../../src/utils/opfs-files";
import { getDirHandle } from "../helpers";
import { Button, MonoBlock, Row, Section, TextInput } from "./ui";

export function ReadPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [readPath, setReadPath] = useState<string>("src/index.ts");
  const [readOffset, setReadOffset] = useState<number>(0);
  const [readLimit, setReadLimit] = useState<number>(200);
  const [readResult, setReadResult] = useState<ProcessedFileReadResult | null>(null);

  async function handleRead() {
    const dir = await getDirHandle(baseDir, true);

    onStatus("Reading file...");
    const res = await processSingleFileContent(readPath, "", dir, readOffset, readLimit);
    setReadResult(res);
    onStatus(res.returnDisplay || "Read done.");
  }

  const workDirLabel = baseDir ? `/${baseDir}` : "/";

  return (
    <Section title="Read (processSingleFileContent)">
      <Row>
        <TextInput
          label={`File path (relative to ${workDirLabel})`}
          value={readPath}
          onChange={(e) => setReadPath(e.currentTarget.value)}
          width={360}
        />
        <TextInput
          label="Offset"
          type="number"
          inputMode="numeric"
          value={String(readOffset)}
          onChange={(e) => setReadOffset(Number(e.currentTarget.value) || 0)}
          width={120}
        />
        <TextInput
          label="Limit"
          type="number"
          inputMode="numeric"
          value={String(readLimit)}
          onChange={(e) => setReadLimit(Number(e.currentTarget.value) || 0)}
          width={120}
        />
        <Button onClick={handleRead}>Read file</Button>
      </Row>

      <div style={{ marginTop: 10 }}>
        {readResult ? (
          <div>
            {typeof readResult.llmContent === "string" ? (
              <MonoBlock height={260}>{readResult.llmContent}</MonoBlock>
            ) : (
              <div>
                <div style={{ color: "#6b7280", marginBottom: 6 }}>{readResult.returnDisplay}</div>
                {(() => {
                  const data = (readResult.llmContent as any)?.inlineData?.data;
                  const mime = (readResult.llmContent as any)?.inlineData?.mimeType || "application/octet-stream";

                  if (mime.startsWith("image/")) {
                    return (
                      <img
                        src={`data:${mime};base64,${data}`}
                        alt="inline"
                        style={{ maxWidth: "100%", border: "1px solid #ddd", borderRadius: 6 }}
                      />
                    );
                  }
                  if (mime === "application/pdf") {
                    return (
                      <iframe
                        src={`data:${mime};base64,${data}`}
                        title="pdf"
                        style={{ width: "100%", minHeight: 320, border: "1px solid #ddd", borderRadius: 6 }}
                      />
                    );
                  }
                  if (mime.startsWith("audio/")) {
                    return <audio controls src={`data:${mime};base64,${data}`} style={{ width: "100%" }} />;
                  }
                  if (mime.startsWith("video/")) {
                    return (
                      <video controls src={`data:${mime};base64,${data}`} style={{ width: "100%", maxHeight: 400 }} />
                    );
                  }
                  return <div>Unsupported media type: {mime}</div>;
                })()}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "#6b7280" }}>No file read yet.</div>
        )}
      </div>
    </Section>
  );
}
