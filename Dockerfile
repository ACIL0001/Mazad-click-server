# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies (using clean install for package-lock.json if available)
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code and build it
COPY . .
RUN npm run build

# Stage 2: Serve the application
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy built code from the build stage
COPY --from=builder /app/dist ./dist

# Create uploads directory (optional but recommended for user file persistence)
RUN mkdir -p uploads

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
