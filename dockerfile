# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Default port; docker-compose may override via build arg from .env
ARG PORT=9009
ENV PORT=${PORT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy application files
COPY . .

# Expose port
EXPOSE ${PORT}

# Start the application using node
CMD ["npm", "start"]
