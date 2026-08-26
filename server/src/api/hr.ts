/**
 * The HR oversight dashboard: everything in flight, who's ignoring what, and a
 * leaderboard of task completion vs. HR incidents. Served at /hr; the page
 * polls /hr/data. Read-only — HR observes, HR notes, HR never touches.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { config } from "../config.js";
import { getDb } from "../db/index.js";

export const hr = Router();

const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/hr.html");

hr.get("/hr", (_req: Request, res: Response) => {
  res.sendFile(PAGE);
});

hr.get("/hr/data", async (_req: Request, res: Response) => {
  const db = getDb();

  const inFlight = await db.execute(sql`
    select t.id,
           coalesce(t.args->>'file', t.tool_name) as file,
           split_part(t.description, e'\n', 1)     as headline,
           coalesce(a.name, 'unassigned')          as who,
           t.status,
           t.escalation_level                      as level,
           t.thread_id                             as thread,
           extract(epoch from (now() - coalesce(t.assigned_at, t.created_at)))::int as waiting_secs
    from tasks t
    left join agents a on a.discord_id = t.agent_id
    where t.status <> 'completed'
    order by t.created_at asc
  `);

  const leaderboard = await db.execute(sql`
    select a.name,
           a.flair,
           count(t.id) filter (where t.status = 'completed')                              as completed,
           count(t.id) filter (where t.status = 'completed' and t.escalation_level = 1)  as clean,
           count(t.id) filter (where t.escalation_level >= 3)                            as incidents,
           count(t.id) filter (where t.status <> 'completed')                            as open,
           coalesce(avg(extract(epoch from (t.completed_at - t.assigned_at)))
                    filter (where t.status = 'completed'), 0)::int                       as avg_secs
    from agents a
    left join tasks t on t.agent_id = a.discord_id
    group by a.discord_id, a.name, a.flair
    order by completed desc, incidents asc, clean desc, a.name asc
  `);

  const recent = await db.execute(sql`
    select coalesce(t.args->>'file', t.tool_name) as file,
           coalesce(a.name, 'unassigned')         as who,
           t.escalation_level                     as level,
           extract(epoch from (now() - t.completed_at))::int as ago_secs
    from tasks t
    left join agents a on a.discord_id = t.agent_id
    where t.status = 'completed' and t.completed_at is not null
    order by t.completed_at desc
    limit 8
  `);

  res.json({
    guildId: config.discord.guildId ?? null,
    inFlight: inFlight.rows,
    leaderboard: leaderboard.rows,
    recent: recent.rows,
  });
});
