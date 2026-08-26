import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "my-app" });

// Your first function: triggered by the "test/hello.world" event
const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "test/hello.world" }] },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { message: `Hello ${event.data.email}!` };
  },
);

// Every function must be added to this array so Inngest can serve it
export const functions = [helloWorld];
