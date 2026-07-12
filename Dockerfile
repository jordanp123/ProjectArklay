FROM nginxinc/nginx-unprivileged:alpine

COPY css/ /usr/share/nginx/html/css/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY favicon.svg /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/