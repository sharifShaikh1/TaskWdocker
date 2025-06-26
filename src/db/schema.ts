import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  serial,
  integer, // Make sure integer is imported
} from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 256 }).notNull(),
  topic: varchar("topic", { length: 256 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default('General'),
  content: text("content").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
 
  parentId: integer('parent_id'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
