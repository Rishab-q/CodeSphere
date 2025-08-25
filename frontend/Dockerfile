# --- Stage 1: Build the Vite App ---
# Use an updated Node.js version that is compatible with Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Build the app for production. Vite outputs to the 'dist' folder.
RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:stable-alpine

# Copy the static files from the 'builder' stage to Nginx's web root directory.
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration file.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
