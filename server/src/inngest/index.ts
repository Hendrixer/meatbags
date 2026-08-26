import { humanToolCall, contractor } from "./human-tool-call.js";
import { bobs } from "./bobs.js";

export { inngest } from "./client.js";

/** Every function Inngest serves. Add new functions here. */
export const functions = [humanToolCall, contractor, bobs];
