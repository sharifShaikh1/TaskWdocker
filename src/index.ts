import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, desc,sql,max } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './db/schema.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connection = postgres(process.env.DATABASE_URL!, {
	ssl: 'require',
});
const db = drizzle(connection, { schema });
const app = new Hono();

app.use('*', logger());
app.use(
	'/api/*',
	cors({
		origin: '*',
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Authorization', 'Content-Type'],
	})
);

app.get('/', swaggerUI({ url: '/doc' }));
app.get('/doc', (c) => {
	return c.json({
		openapi: '3.1.0',
		info: {
			title: 'AI Task Generator API',
			version: '1.0.0',
		},
		paths: {},
	});
});

const authMiddleware = clerkMiddleware();

const createTaskSchema = z.object({
	content: z.string().min(1, 'Task content cannot be empty'),
	topic: z.string().min(1, "Topic cannot be empty"),
});
const createBulkTasksSchema = z.object({
  topic: z.string().min(1),
  contents: z.array(z.string().min(1)),
});
const updateTaskSchema = z.object({
	content: z.string().min(1).optional(),
	isCompleted: z.boolean().optional(),
});

const generateTasksSchema = z.object({
	topic: z.string().min(2, 'Topic must be at least 2 characters long'),

});

const apiRoutes = new Hono()

 .get('/topics', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

        // This new query correctly groups by topic and sorts by the most recent date.
        const result = await db
            .select({
                topic: schema.tasks.topic,
                lastActivity: max(schema.tasks.createdAt),
            })
            .from(schema.tasks)
            .where(eq(schema.tasks.userId, auth.userId))
            .groupBy(schema.tasks.topic)
            .orderBy(desc(max(schema.tasks.createdAt)));
        
        const topics = result.map(r => r.topic);
        return c.json({ topics });
    })
	 .delete('/topics/:topic', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

        const topic = c.req.param('topic');

        // This command deletes all tasks that match the user ID and the topic name
        const result = await db.delete(schema.tasks)
            .where(and(eq(schema.tasks.userId, auth.userId), eq(schema.tasks.topic, topic)))
            .returning();
        
        if (result.length === 0) {
            return c.json({ error: "Topic not found or no tasks to delete" }, 404);
        }

        return c.json({ message: `Topic "${topic}" and its tasks deleted successfully.` });
    })
.get('/tasks', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
        
        const topic = c.req.query("topic");

        const query = db
            .select()
            .from(schema.tasks)
            .where(
                and(
                    eq(schema.tasks.userId, auth.userId),
                    topic ? eq(schema.tasks.topic, topic) : undefined
                )
            )
            .orderBy(desc(schema.tasks.createdAt));
        
        const tasks = await query;
        return c.json({ tasks });
    })
  .post('/tasks/bulk', authMiddleware, zValidator('json', createBulkTasksSchema), async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

        const { topic, contents } = c.req.valid('json');

        const tasksToInsert = contents.map(content => ({
            content,
            topic,
            userId: auth.userId,
        }));

        const newTasks = await db.insert(schema.tasks).values(tasksToInsert).returning();
        
        return c.json({ tasks: newTasks }, 201);
    })
    

	.put('/tasks/:id', authMiddleware, zValidator('json', updateTaskSchema), async (c) => {
		const auth = getAuth(c);
		if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
		const id = parseInt(c.req.param('id'));
		const { content, isCompleted } = c.req.valid('json');
		const [updatedTask] = await db
			.update(schema.tasks)
			.set({ content, isCompleted })
			.where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, auth.userId)))
			.returning();
		if (!updatedTask) return c.json({ error: 'Task not found' }, 404);
		return c.json({ task: updatedTask });
	})
	.delete('/tasks/:id', authMiddleware, async (c) => {
		const auth = getAuth(c);
		if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
		const id = parseInt(c.req.param('id'));
		const [deletedTask] = await db
			.delete(schema.tasks)
			.where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, auth.userId)))
			.returning();
		if (!deletedTask) return c.json({ error: 'Task not found' }, 404);
		return c.json({ message: 'Task deleted successfully' });
	})
.post('/generate', authMiddleware, zValidator('json', generateTasksSchema), async (c) => {
  const { topic } = c.req.valid('json');
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('🧩 Gemini API Key present?', !!apiKey);

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is missing.');
    return c.json({ error: 'Service is not configured.' }, 500);
  }

const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;

  try {
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Generate a list of 5 concise, actionable tasks to learn about ${topic}.` }] }] }),
    });

    console.log('🔁 Gemini API responded with status:', geminiResponse.status);
    const body = await geminiResponse.text();
    console.log('📥 Gemini response body:', body);

    if (!geminiResponse.ok) {
      return c.json({ error: `Gemini API error (${geminiResponse.status})` }, 502);
    }

    const result = JSON.parse(body);
    console.log('✅ Parsed Gemini result:', result);

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('❌ Missing or malformed content in Gemini response.');
      return c.json({ error: 'Received empty response from AI.' }, 500);
    }

    const generatedTasks = text.trim().split('\n').filter((t: string) => t.trim());
    return c.json({ tasks: generatedTasks });

  } catch (err) {
    console.error('🚨 Gemini fetch failed', err);
    return c.json({ error: 'Unexpected error during AI request.' }, 500);
  }
});

app.route('/api', apiRoutes);

export default {
    port: 3001,
    fetch: app.fetch,
}