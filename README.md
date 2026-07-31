# Zoo Catcher

A simple Express server that demonstrates a basic server running. It can be started with `npm start` and is ready for deployment to Google Cloud Platform (GCP) Cloud Run.

## Local Development

```bash
npm install
npm start
```

The server will listen on port `3000` (or the port defined in `PORT` environment variable).

## Deployment to GCP Cloud Run

A Dockerfile is included for building a container image that can be deployed to Cloud Run.

```Dockerfile
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
```

Build and deploy using the Google Cloud SDK:

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Build the container
docker build -t zoocatcher .

# Deploy to Cloud Run
gcloud run deploy zoocatcher --image zoocatcher --platform managed
```

This will deploy the service and provide a publicly accessible URL.

## Deployment to Vercel

The game lives in `public/` (`public/index.html` = Zoo Catcher, `public/kaichudentou.html` = Flashlight Game) and is served by the Express app in `index.js`.

1. Open <https://vercel.com/new> and import `bonsai/zoo-catcher`.
2. Leave **Framework Preset** as `Express` and **Build Command** empty.
3. Click **Deploy**, then open the generated URL and play.

Alternatively, install the Vercel CLI and run:

```bash
npx vercel --prod
```
