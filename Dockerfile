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

# Enable modules
RUN a2enmod rewrite headers

# Đổi port 80 → 10000
RUN sed -i 's/Listen 80/Listen 10000/g' /etc/apache2/ports.conf

# Viết VirtualHost sạch
RUN printf '<VirtualHost *:10000>\n\
    DocumentRoot /var/www/html\n\
    DirectoryIndex index.php index.html\n\
    <Directory /var/www/html>\n\
        Options -Indexes +FollowSymLinks\n\
        AllowOverride All\n\
        Require all granted\n\
    </Directory>\n\
    ErrorLog /dev/stderr\n\
    CustomLog /dev/stdout combined\n\
</VirtualHost>\n' > /etc/apache2/sites-enabled/000-default.conf

WORKDIR /var/www/html
COPY . .
RUN chown -R www-data:www-data /var/www/html

# Runtime script
RUN printf '#!/bin/sh\n\
mkdir -p /tmp/subai_uploads /tmp/subai_tmp\n\
chmod 777 /tmp/subai_uploads /tmp/subai_tmp\n\
exec apache2-foreground\n' > /start.sh && chmod +x /start.sh

EXPOSE 10000
CMD ["/start.sh"]
