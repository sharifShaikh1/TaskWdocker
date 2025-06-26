import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, desc, sql, max } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './db/schema.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: ".env.local" });

const connection = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
const db = drizzle(connection, { schema });
const app = new Hono();

// --- Middleware (Unchanged) ---
app.use('*', logger());
app.use('/api/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Authorization', 'Content-Type'] }));
app.get('/', swaggerUI({ url: '/doc' }));
app.get('/doc', (c) => c.json({ openapi: '3.1.0', info: { title: 'AI Task Generator API', version: '1.0.0' }, paths: {} }));

const authMiddleware = clerkMiddleware();

// --- Zod Schemas (Updated for Robustness) ---
const createBulkTasksSchema = z.object({
  topic: z.string().min(1),
  category: z.string(), // No longer requires min(1), we'll handle fallback later
  contents: z.array(z.string().min(1)).min(1, { message: "Cannot create a topic with zero tasks." }),
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
        const category = c.req.query("category");
        const result = await db
            .select({
                topic: schema.tasks.topic,
                category: schema.tasks.category,
            })
            .from(schema.tasks)
            .where(and(
                eq(schema.tasks.userId, auth.userId),
                category && category !== "all" ? eq(schema.tasks.category, category) : undefined
            ))
            .groupBy(schema.tasks.topic, schema.tasks.category)
            .orderBy(desc(max(schema.tasks.createdAt)));
        return c.json({ topics: result });
    })
    .get('/categories', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
        const result = await db.selectDistinct({ category: schema.tasks.category }).from(schema.tasks).where(eq(schema.tasks.userId, auth.userId)).orderBy(schema.tasks.category);
        return c.json({ categories: result.map(r => r.category) });
    })
    .delete('/topics/:topic', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
        const topic = c.req.param('topic');
        await db.delete(schema.tasks).where(and(eq(schema.tasks.userId, auth.userId), eq(schema.tasks.topic, topic)));
        return c.json({ message: `Topic "${topic}" and its tasks were deleted successfully.` });
    })
    .get('/tasks', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
        const topic = c.req.query("topic");
        const query = db.select().from(schema.tasks)
            .where(and(eq(schema.tasks.userId, auth.userId), topic ? eq(schema.tasks.topic, topic) : undefined))
            .orderBy(desc(schema.tasks.createdAt));
        const tasks = await query;
        return c.json({ tasks });
    })
    .post('/tasks/bulk', authMiddleware, zValidator('json', createBulkTasksSchema), async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);
        const { topic, category, contents } = c.req.valid('json');
        
        // Use a fallback category if the provided one is empty
        const finalCategory = category.trim() || 'General';

        const tasksToInsert = contents.map(content => ({
            content,
            topic,
            category: finalCategory,
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
        const [updatedTask] = await db.update(schema.tasks).set({ content, isCompleted }).where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, auth.userId))).returning();
        if (!updatedTask) return c.json({ error: 'Task not found' }, 404);
        return c.json({ task: updatedTask });
    })
    .delete('/tasks/:id', authMiddleware, async (c) => {
        const auth = getAuth(c);
        if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
        const id = parseInt(c.req.param('id'));
        const [deletedTask] = await db.delete(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, auth.userId))).returning();
        if (!deletedTask) return c.json({ error: 'Task not found' }, 404);
        return c.json({ message: 'Task deleted successfully' });
    })
    .post('/generate', authMiddleware, zValidator('json', generateTasksSchema), async (c) => {
        const { topic } = c.req.valid('json');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return c.json({ error: "Service is not configured." }, 500);
        const prompt = `For the given topic, generate a list of 5 concise, actionable tasks and a single, relevant category for the topic.
        Topic: "${topic}"
        Valid categories: "Programming", "Health & Fitness", "Finance", "Productivity", "Learning", "Creative", "Home & Garden", "Career", "General".
        Please respond in a valid JSON format only, with no other text or markdown, like this: {"category": "Your Suggested Category", "tasks": ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"]}`;
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        try {
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });
            if (!geminiResponse.ok) throw new Error("Failed to communicate with AI service.");
            const result = await geminiResponse.json();
            const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!content) throw new Error("Received an empty or invalid response from AI.");
            const parsedContent = JSON.parse(content);
            return c.json({
                category: parsedContent.category || 'General',
                tasks: parsedContent.tasks || []
            });
        } catch (error: any) {
            console.error("Gemini Generation Error:", error);
            return c.json({ error: "Failed to generate AI content." }, 500);
        }
    });

// --- BETTER ERROR HANDLER ---
app.onError((err, c) => {
    console.error('Unhandled API Error:', err);
    if (err instanceof z.ZodError) {
        return c.json({ error: 'Invalid input provided.', details: err.flatten() }, 400);
    }
    return c.json({ error: 'An internal server error occurred' }, 500);
});

app.route('/api', apiRoutes);

export default { port: 3001, fetch: app.fetch };
