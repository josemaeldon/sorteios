FROM php:8.3-apache

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    netcat-openbsd \
    libzip-dev \
    && docker-php-ext-install pdo pdo_mysql mysqli \
    && docker-php-ext-enable pdo_mysql \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache modules
RUN a2enmod rewrite headers

# Configure Apache
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html/

# Create config directory if it doesn't exist
RUN mkdir -p /var/www/html/config

# Copy database config template if config doesn't exist
RUN if [ -f config/database.php.example ] && [ ! -f config/database.php ]; then \
    cp config/database.php.example config/database.php; \
    fi

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/config

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use custom entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["apache2-foreground"]
