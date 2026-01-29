FROM nginx:alpine

# Serve the static site from nginx default html directory
# Copy the main page to index.html and also copy any assets
COPY ./website.html /usr/share/nginx/html/index.html
COPY ./ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]