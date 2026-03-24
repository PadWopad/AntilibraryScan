# Stage 1: Build the frontend
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend (creates the /dist directory)
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim

WORKDIR /app

# Install tsx globally to run TypeScript server directly
RUN npm install -g tsx

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the built frontend from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the server file and other necessary source files
COPY server.ts ./
COPY src/firebase.ts ./src/
COPY src/services/ ./src/services/
COPY src/constants/ ./src/constants/
# Note: Add other directories if server.ts imports from them

# Expose the application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["tsx", "server.ts"]
