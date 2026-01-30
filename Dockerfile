FROM node:18-alpine

WORKDIR /app

# Copy backend files
COPY package*.json ./
RUN npm install --production

# Copy all files
COPY . .

# Copy website.html to a public directory for nginx
RUN mkdir -p /usr/share/nginx/html && cp website.html /usr/share/nginx/html/index.html

# Install nginx
RUN apk add --no-cache nginx

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set proper permissions
RUN chown -R nodejs:nodejs /app /usr/share/nginx/html

# Switch to non-root user
USER nodejs

# Expose both backend (3000) and frontend (80)
EXPOSE 3000 80

# Start both Node.js backend and nginx
CMD sh -c "npm start & nginx -g 'daemon off;'"