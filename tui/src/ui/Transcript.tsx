import { Box, Static, Text } from "ink";

export type TranscriptEntry =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "assistant"; text: string }
  | { id: number; kind: "tool"; name: string; detail: string; summary: string }
  | { id: number; kind: "system"; text: string };

export function Transcript({ entries }: { entries: TranscriptEntry[] }) {
  return (
    <Static items={entries}>
      {(entry) => (
        <Box key={entry.id} flexDirection="column" marginBottom={1}>
          {entry.kind === "user" && (
            <Text>
              <Text color="cyan" bold>
                {"> "}
              </Text>
              {entry.text}
            </Text>
          )}
          {entry.kind === "assistant" && <Text>{entry.text}</Text>}
          {entry.kind === "tool" && (
            <Box flexDirection="column">
              <Text dimColor>
                ⏺ {entry.name}({entry.detail})
              </Text>
              <Text dimColor>{"  └ " + entry.summary}</Text>
            </Box>
          )}
          {entry.kind === "system" && <Text color="yellow">{entry.text}</Text>}
        </Box>
      )}
    </Static>
  );
}
