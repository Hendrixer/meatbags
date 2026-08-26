import { inngest } from "./client.js";

/**
 * The Bobs (stub). Fans out from every completed task — the same
 * `human/task.completed` event the waiting tool call consumes also kicks off a
 * performance review here. Stubbed for now: the full version would interview the
 * human in-thread and write a review to the `reviews` table.
 */
export const bobs = inngest.createFunction(
  { id: "the-bobs", triggers: [{ event: "human/task.completed" }] },
  async ({ event }) => {
    const taskId = String(event.data?.taskId ?? "");
    // TODO: interview the human, write to `reviews`. Shows Inngest fan-out.
    return { stub: true, taskId, note: "What would you say… you do here?" };
  },
);
