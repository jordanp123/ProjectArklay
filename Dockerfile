FROM nginxinc/nginx-unprivileged:alpine-slim

COPY css/ /usr/share/nginx/html/css/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY favicon.svg /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY icons/ /usr/share/nginx/html/icons/
COPY js/ /usr/share/nginx/html/js/