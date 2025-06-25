# Use the official Bun image
FROM oven/bun:1

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy only app code (not env)
COPY . .

# Expose port
EXPOSE 3001

# Start the app
CMD ["bun", "run", "dev"]
