# Use the official Node.js 18 image as the base image
FROM node:18-slim

# Create and set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy application code
COPY . .

# Expose the port that the app runs on
EXPOSE 8080

# Run the application
CMD ["node", "index.js"]