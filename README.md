

# Task Generator API

## Overview

Task Generator API is a backend service designed to help users create, manage, and generate tasks related to various topics. It leverages **Drizzle ORM** for database management, **Hono** for building API routes, and **Gemini AI** for automatically generating tasks based on a given topic. This service offers a RESTful API with JWT authentication via **Clerk Auth**.

## Features

- **Task Creation & Management**: Allows users to create, update, delete, and fetch tasks.
- **Topic & Category Management**: Users can manage tasks by topic and category.
- **Bulk Task Creation**: Create multiple tasks in one API request.
- **AI Task Generation**: Uses Gemini AI to generate actionable tasks for a given topic and suggests a relevant category.
- **Authenticated Endpoints**: API endpoints are secured using **Clerk Authentication**.
- **Swagger UI Documentation**: Provides an interactive interface for exploring the API.

## Table of Contents

1. [Installation](#installation)
2. [Usage](#usage)
3. [Features](#features)
4. [API Documentation](#api-documentation)
5. [Configuration](#configuration)
6. [Dependencies](#dependencies)
7. [Troubleshooting](#troubleshooting)
8. [Contributors](#contributors)
9. [License](#license)

## Installation

### Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (Recommended: v16 or higher)
- **Bun** for fast dependency management and runtime.
- **Docker** (Optional: for containerized setup)
  
You also need a **Gemini API key** for task generation functionality.

### Steps to Install

1. Clone the repository:

   ```bash
   git clone https://github.com/sharifShaikh1/TaskWdocker.git
   cd TaskWdocker
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Set up environment variables. Create a `.env.local` file in the root directory and add the following:

   ```env
   DATABASE_URL=<Your PostgreSQL Database URL>
   GEMINI_API_KEY=<Your Gemini API Key>
   ```

4. If using Docker, build the image:

   ```bash
   docker build -t task-generator .
   ```

5. Run the application locally:

   ```bash
   bun dev
   ```

   The app will start on `http://localhost:3001`.

## Usage

Once the app is running, you can interact with the API through the following endpoints:

### Authenticated Routes

All routes except `/doc` require authentication via Clerk Auth.

#### **GET /topics**
- Fetch all topics associated with the authenticated user.
- Optionally filter by category.
  
#### **GET /categories**
- Fetch all categories associated with the authenticated user.

#### **POST /tasks/bulk**
- Create multiple tasks in one request.
- **Payload**: `topic`, `category` (optional), `contents` (array of task contents).

#### **GET /tasks**
- Retrieve tasks based on the user's topics or a specific topic.

#### **PUT /tasks/:id**
- Update a task's content and completion status.

#### **DELETE /tasks/:id**
- Delete a task by ID.

#### **POST /generate**
- Use Gemini AI to generate tasks for a given topic.
- **Payload**: `topic`.

#### **DELETE /topics/:topic**
- Delete all tasks under a specific topic.

#### **GET /doc**
- Access Swagger UI to interact with the API visually.

## API Documentation

### Endpoints Overview

- **GET /topics**: Returns the list of topics.
- **GET /categories**: Returns a list of categories.
- **POST /tasks/bulk**: Create multiple tasks in bulk.
- **GET /tasks**: Fetch tasks related to a topic.
- **PUT /tasks/:id**: Update a specific task.
- **DELETE /tasks/:id**: Delete a task by its ID.
- **POST /generate**: Generate tasks for a topic using Gemini AI.
- **DELETE /topics/:topic**: Delete tasks under a specific topic.

For detailed API specifications, visit the [Swagger UI](http://localhost:3001/doc).

## Configuration

The application uses several configurations stored in `.env.local`:

- `DATABASE_URL`: The connection string for your PostgreSQL database.
- `GEMINI_API_KEY`: The API key for integrating with Gemini AI.

### Optional Configuration for Docker

To run the app in Docker, make sure the database credentials are correctly passed to the container. Update the `.env.local` file and mount it during container setup:

```bash
docker run -p 3001:3001 --env-file .env.local task-generator
```

## Dependencies

- **Hono**: Lightweight web framework for building APIs.
- **Drizzle ORM**: ORM for PostgreSQL used to handle database operations.
- **PostgreSQL**: The relational database used for storing tasks and topics.
- **Clerk**: Authentication middleware.
- **Gemini API**: AI service for generating tasks based on topics.
- **Zod**: Type validation schema used for incoming requests.

### Production Dependencies

- `@hono/clerk-auth`
- `@hono/swagger-ui`
- `@hono/zod-validator`
- `dotenv`
- `drizzle-orm`
- `postgres`
- `zod`

### Development Dependencies

- `bun-types`
- `drizzle-kit`

## Troubleshooting

### 1. Error: `DATABASE_URL is not defined`
Make sure you have correctly set the `DATABASE_URL` in your `.env.local` file.

### 2. Error: `Unauthorized`
Ensure that you are passing a valid **JWT token** with your requests and that you are logged in via Clerk.

### 3. Error: `Gemini API not configured`
This error occurs if the `GEMINI_API_KEY` is not provided. Ensure you have a valid Gemini API key set in the `.env.local` file.

## Contributors

- [Sharif Shaikh](https://github.com/sharifShaikh1)

## License

This project is licensed under the MIT License.

---

Feel free to adapt or add any additional instructions or features that your project might have!
