import express from "express";
import { serve } from "inngest/express";
import { inngest, functions } from "./src/inngest/index.js";

const app = express();

// Important: JSON middleware is required to process incoming JSON POST payloads.
app.use(express.json());

// Serve the Inngest functions at the recommended /api/inngest endpoint
app.use("/api/inngest", serve({ client: inngest, functions }));

// Example route that sends an event to trigger the hello-world function
app.get("/api/hello", async (req, res, next) => {
  await inngest
    .send({
      name: "test/hello.world",
      data: { email: "testUser@example.com" },
    })
    .catch(next);
  res.json({ message: "Event sent!" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
