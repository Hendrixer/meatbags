import { Box, Text } from "ink";
import { shortTaskId, type MeatbagTask } from "../types.js";

function escalationBar(level: number): { bar: string; color: string } {
  const filled = Math.min(level, 4);
  return {
    bar: "█".repeat(filled) + "░".repeat(4 - filled),
    color: level >= 3 ? "red" : level === 2 ? "yellow" : "green",
  };
}

const ESCALATION_NOTES: Record<number, string> = {
  2: "⚠ voicemail deployed",
  3: "⚠ formal email sent",
  4: "⚠ leadership CC'd",
};

export function TpsPanel({ tasks }: { tasks: MeatbagTask[] }) {
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={1} minWidth={30}>
      <Text bold color="red">
        TPS REPORT
      </Text>
      {tasks.map((task) => {
        const { bar, color } = escalationBar(task.escalation_level);
        return (
          <Box key={task.taskId} flexDirection="column" marginTop={1}>
            <Text bold>
              TASK #{shortTaskId(task.taskId)} <Text dimColor>{task.file}</Text>
            </Text>
            <Text>
              MEATBAG: <Text color="cyan">{task.assignee ?? "unassigned"}</Text>
            </Text>
            <Text>STATUS: {task.status}</Text>
            <Text>
              ESCALATION: <Text color={color}>{bar}</Text> Lv {task.escalation_level}
            </Text>
            {ESCALATION_NOTES[task.escalation_level] && (
              <Text color="yellow">{ESCALATION_NOTES[task.escalation_level]}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
