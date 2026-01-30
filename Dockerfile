FROM node:18-alpine

WORKDIR /app

# Copy backend files
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Copy website.html to a public directory for nginx
RUN mkdir -p /usr/share/nginx/html && cp website.html /usr/share/nginx/html/index.html

# Install nginx
RUN apk add --no-cache nginx

# Expose both backend (3000) and frontend (80)
EXPOSE 3000 80

# Start both Node.js backend and nginx
CMD sh -c "npm start & nginx -g 'daemon off;'"