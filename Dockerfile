FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev libssl-dev \
    && docker-php-ext-install curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# PHP config
RUN { \
    echo "upload_max_filesize = 512M"; \
    echo "post_max_size = 520M"; \
    echo "max_execution_time = 600"; \
    echo "max_input_time = 600"; \
    echo "memory_limit = 512M"; \
    echo "default_socket_timeout = 600"; \
    echo "upload_tmp_dir = /tmp"; \
} > /usr/local/etc/php/conf.d/subai.ini

# Apache: enable mod_rewrite, đổi port sang 10000 (Render yêu cầu)
RUN a2enmod rewrite && \
    sed -i 's/Listen 80/Listen 10000/' /etc/apache2/ports.conf && \
    sed -i 's/:80>/:10000>/' /etc/apache2/sites-enabled/000-default.conf && \
    sed -i 's|/var/www/html|/app|g' /etc/apache2/sites-enabled/000-default.conf

# Cho phép .htaccess override
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

WORKDIR /app
COPY . .

# Tạo thư mục /tmp lúc runtime
RUN printf '#!/bin/sh\nmkdir -p /tmp/subai_uploads /tmp/subai_tmp\nchmod 777 /tmp/subai_uploads /tmp/subai_tmp\napache2-foreground\n' \
    > /start.sh && chmod +x /start.sh

EXPOSE 10000
CMD ["/start.sh"]
