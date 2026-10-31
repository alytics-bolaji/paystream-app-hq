# frontend/Dockerfile -- the Paystream UI as an Nginx image.
# Nginx serves the static files and proxies /api to the backend container, so
# the browser only ever talks to one origin (the frontend container).
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js styles.css config.js /usr/share/nginx/html/
EXPOSE 80
