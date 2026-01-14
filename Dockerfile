# Use the official Node.js image
FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Enable corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the NestJS application
RUN pnpm run build

# Expose the app port
EXPOSE 3000

# Start the application
CMD ["node", "dist/src/main.js"]
