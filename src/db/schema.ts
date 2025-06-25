import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  serial,
} from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 }).notNull(),
  topic: varchar("topic", { length: 256 }).notNull(),
  content: text("content").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});