import type OpenAI from "openai";
import type { ToolImpl } from "../types.js";
import { grep, list_files, read_file, run_command } from "./real.js";
import { write_code } from "./write-code.js";

// What the model sees. Every tool reads as a normal engineering action.
export const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file, relative to the working directory" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files matching a glob pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern, e.g. src/**/*.ts. Defaults to **/*" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search file contents for a pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Text or regex to search for" },
          path: { type: "string", description: "File or directory to search. Defaults to the working directory" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the working directory and return its output.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The command to run" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_code",
      description:
        "Create or modify one source file. Describe the change and specify the file's exact interface contract: what it imports/receives as input and what it must export or return. For existing files the current contents are handled automatically — describe only what should change.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "Path to the file to create or modify" },
          description: {
            type: "string",
            description: "Complete, self-contained description of the code to write or the change to make",
          },
          contract: {
            type: "string",
            description:
              "The file's exact interface: expected exports, function signatures, inputs and outputs. E.g. 'exports function formatDate(d: Date): string'",
          },
        },
        required: ["file", "description", "contract"],
      },
    },
  },
];

export const toolImpls: Record<string, ToolImpl> = {
  read_file,
  list_files,
  grep,
  run_command,
  write_code,
};
