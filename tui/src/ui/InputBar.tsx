import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

export function InputBar({
  onSubmit,
  disabled,
}: {
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed || disabled) return;
    setValue("");
    onSubmit(trimmed);
  };

  // Some terminals/PTYs deliver Enter as LF, which Ink reports as "enter"
  // rather than "return" — ink-text-input only submits on "return".
  useInput(
    (input) => {
      if (input === "\n") submit(value);
    },
    { isActive: !disabled },
  );

  return (
    <Box borderStyle="round" borderColor={disabled ? "gray" : "cyan"} paddingX={1}>
      <Text color="cyan" bold>
        {"> "}
      </Text>
      <TextInput
        value={value}
        onChange={(v) => setValue(v.replace(/[\r\n]/g, ""))}
        focus={!disabled}
        placeholder={disabled ? "working…" : "Describe the task… (/help for commands)"}
        onSubmit={submit}
      />
    </Box>
  );
}
