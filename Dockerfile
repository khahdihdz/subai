FROM php:8.2-cli

RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev libssl-dev unzip curl \
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

WORKDIR /app
COPY . .

# Startup script: tạo thư mục /tmp lúc runtime (không phải build time)
RUN printf '#!/bin/sh\nmkdir -p /tmp/subai_uploads /tmp/subai_tmp\nchmod 777 /tmp/subai_uploads /tmp/subai_tmp\nexec php -S 0.0.0.0:10000 -t /app\n' > /start.sh \
    && chmod +x /start.sh

EXPOSE 10000
CMD ["/start.sh"]
