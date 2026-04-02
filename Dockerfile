FROM php:8.2-cli

# Install system deps + PHP extensions
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    unzip \
    curl \
    && docker-php-ext-install curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# PHP config — tăng giới hạn upload
RUN echo "upload_max_filesize = 500M\n\
post_max_size = 510M\n\
max_execution_time = 600\n\
max_input_time = 600\n\
memory_limit = 512M\n\
default_socket_timeout = 600" > /usr/local/etc/php/conf.d/subai.ini

WORKDIR /app

COPY . .

# Tạo thư mục cần thiết
RUN mkdir -p uploads tmp && chmod 777 uploads tmp

EXPOSE 10000

CMD ["php", "-S", "0.0.0.0:10000", "-t", "."]
