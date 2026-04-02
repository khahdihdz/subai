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

# Đổi port 80 → 10000
RUN sed -i 's/Listen 80/Listen 10000/' /etc/apache2/ports.conf && \
    sed -i 's/<VirtualHost \*:80>/<VirtualHost *:10000>/' /etc/apache2/sites-enabled/000-default.conf

# Trỏ DocumentRoot về /var/www/html (mặc định của apache image)
# Sẽ copy code vào đó
RUN a2enmod rewrite headers

# Cấu hình VirtualHost — DocumentRoot /var/www/html, cho phép AllowOverride
RUN printf '<VirtualHost *:10000>\n\
    DocumentRoot /var/www/html\n\
    <Directory /var/www/html>\n\
        Options -Indexes +FollowSymLinks\n\
        AllowOverride All\n\
        Require all granted\n\
    </Directory>\n\
    ErrorLog ${APACHE_LOG_DIR}/error.log\n\
    CustomLog ${APACHE_LOG_DIR}/access.log combined\n\
</VirtualHost>\n' > /etc/apache2/sites-enabled/000-default.conf

WORKDIR /var/www/html
COPY . .
RUN chown -R www-data:www-data /var/www/html

# Tạo thư mục /tmp lúc runtime
RUN printf '#!/bin/sh\n\
mkdir -p /tmp/subai_uploads /tmp/subai_tmp\n\
chmod 777 /tmp/subai_uploads /tmp/subai_tmp\n\
apache2-foreground\n' > /start.sh && chmod +x /start.sh

EXPOSE 10000
CMD ["/start.sh"]
