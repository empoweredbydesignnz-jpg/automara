#!/bin/bash

#############################################
# Automara Multi-Tenant SaaS Setup Script
# Empowered by Design
# 
# This script sets up the complete Automara stack:
# - PostgreSQL with per-tenant schemas
# - SuperTokens for authentication & MFA
# - N8N workflow automation
# - React frontend
# - Node.js API backend
# - Nginx reverse proxy with SSL
# - Portainer for container management
#############################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="empoweredbydesign.co.nz"
FRONTEND_DOMAIN="automara.${DOMAIN}"
API_DOMAIN="api.${DOMAIN}"
WEBHOOK_DOMAIN="webhook.${DOMAIN}"
STATIC_IP="${STATIC_IP:-YOUR_STATIC_IP}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}"

# Ports
FRONTEND_PORT=3000
API_PORT=4000
N8N_PORT=5678
POSTGRES_PORT=5432
SUPERTOKENS_PORT=3567
PORTAINER_PORT=9000

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   Automara Multi-Tenant SaaS Setup${NC}"
echo -e "${GREEN}   Empowered by Design${NC}"
echo -e "${GREEN}================================================${NC}\n"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}" 
   exit 1
fi

# Prompt for required information
read -p "Enter your static IP address: " STATIC_IP
read -p "Enter your email for Let's Encrypt: " EMAIL
read -sp "Enter PostgreSQL password: " POSTGRES_PASSWORD
echo
read -sp "Enter N8N encryption key (32 chars): " N8N_ENCRYPTION_KEY
echo
read -sp "Enter SuperTokens API key: " SUPERTOKENS_API_KEY
echo
read -sp "Enter Stripe secret key: " STRIPE_SECRET_KEY
echo

echo -e "\n${YELLOW}Installing system dependencies...${NC}"

# Update system
apt-get update && apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}Docker Compose already installed${NC}"
fi

# Create project structure
echo -e "${YELLOW}Creating project structure...${NC}"
mkdir -p /opt/automara/{backend,frontend,nginx,postgres,n8n,supertokens,scripts}
cd /opt/automara

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
DB_ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SIGNING_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# Domain Configuration
DOMAIN=${DOMAIN}
FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
API_DOMAIN=${API_DOMAIN}
WEBHOOK_DOMAIN=${WEBHOOK_DOMAIN}
STATIC_IP=${STATIC_IP}

# PostgreSQL Configuration
POSTGRES_USER=automara
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=automara
POSTGRES_PORT=${POSTGRES_PORT}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=24h

# Database Encryption
DB_ENCRYPTION_KEY=${DB_ENCRYPTION_KEY}

# N8N Configuration
N8N_PORT=${N8N_PORT}
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
N8N_HOST=n8n
N8N_PROTOCOL=http
WEBHOOK_URL=https://${WEBHOOK_DOMAIN}

# SuperTokens Configuration
SUPERTOKENS_PORT=${SUPERTOKENS_PORT}
SUPERTOKENS_API_KEY=${SUPERTOKENS_API_KEY}
SUPERTOKENS_CONNECTION_URI=http://supertokens:${SUPERTOKENS_PORT}

# Stripe Configuration
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# Webhook Security
WEBHOOK_SIGNING_SECRET=${WEBHOOK_SIGNING_SECRET}

# Email Configuration (configure later)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@${DOMAIN}

# Ports
FRONTEND_PORT=${FRONTEND_PORT}
API_PORT=${API_PORT}
PORTAINER_PORT=${PORTAINER_PORT}

# Let's Encrypt
LETSENCRYPT_EMAIL=${EMAIL}
EOF

echo -e "${GREEN}.env file created${NC}"

# Create docker-compose.yml
cat > docker-compose.yml << 'EOFCOMPOSE'
version: '3.8'

services:
  # PostgreSQL Database with per-tenant schemas
  postgres:
    image: postgres:15-alpine
    container_name: automara-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "${POSTGRES_PORT}:5432"
    networks:
      - automara-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # SuperTokens for Authentication & MFA
  supertokens:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:latest
    container_name: automara-supertokens
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      POSTGRESQL_CONNECTION_URI: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      API_KEYS: ${SUPERTOKENS_API_KEY}
    ports:
      - "${SUPERTOKENS_PORT}:3567"
    networks:
      - automara-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3567/hello"]
      interval: 10s
      timeout: 5s
      retries: 5

  # N8N Workflow Automation
  n8n:
    image: n8nio/n8n:latest
    container_name: automara-n8n
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: ${POSTGRES_DB}
      DB_POSTGRESDB_USER: ${POSTGRES_USER}
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      N8N_HOST: ${N8N_HOST}
      N8N_PROTOCOL: ${N8N_PROTOCOL}
      WEBHOOK_URL: ${WEBHOOK_URL}
      N8N_DIAGNOSTICS_ENABLED: false
      N8N_PERSONALIZATION_ENABLED: false
      EXECUTIONS_DATA_PRUNE: true
      EXECUTIONS_DATA_MAX_AGE: 336
    volumes:
      - n8n_data:/home/node/.n8n
    ports:
      - "${N8N_PORT}:5678"
    networks:
      - automara-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: automara-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      supertokens:
        condition: service_healthy
      n8n:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: ${API_PORT}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRY: ${JWT_EXPIRY}
      DB_ENCRYPTION_KEY: ${DB_ENCRYPTION_KEY}
      SUPERTOKENS_CONNECTION_URI: ${SUPERTOKENS_CONNECTION_URI}
      SUPERTOKENS_API_KEY: ${SUPERTOKENS_API_KEY}
      N8N_HOST: http://n8n:5678
      N8N_API_KEY: ${N8N_ENCRYPTION_KEY}
      WEBHOOK_URL: ${WEBHOOK_URL}
      WEBHOOK_SIGNING_SECRET: ${WEBHOOK_SIGNING_SECRET}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      FRONTEND_URL: https://${FRONTEND_DOMAIN}
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "${API_PORT}:4000"
    networks:
      - automara-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend React Application
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: automara-frontend
    restart: unless-stopped
    environment:
      REACT_APP_API_URL: https://${API_DOMAIN}
      REACT_APP_WEBHOOK_URL: https://${WEBHOOK_DOMAIN}
      REACT_APP_SUPERTOKENS_URL: https://${API_DOMAIN}
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "${FRONTEND_PORT}:80"
    networks:
      - automara-network

  # Nginx Reverse Proxy with SSL
  nginx:
    image: nginx:alpine
    container_name: automara-nginx
    restart: unless-stopped
    depends_on:
      - frontend
      - backend
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_conf:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    ports:
      - "80:80"
      - "443:443"
    networks:
      - automara-network
    command: "/bin/sh -c 'while :; do sleep 6h & wait $${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"

  # Certbot for SSL certificates
  certbot:
    image: certbot/certbot
    container_name: automara-certbot
    restart: unless-stopped
    volumes:
      - certbot_conf:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

  # Portainer for container management
  portainer:
    image: portainer/portainer-ce:latest
    container_name: automara-portainer
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    ports:
      - "${PORTAINER_PORT}:9000"
    networks:
      - automara-network

networks:
  automara-network:
    driver: bridge

volumes:
  postgres_data:
  n8n_data:
  portainer_data:
  certbot_conf:
  certbot_www:
EOFCOMPOSE

echo -e "${GREEN}docker-compose.yml created${NC}"

# Create database initialization script
cat > scripts/init-db.sql << 'EOFSQL'
-- Automara Database Initialization Script
-- Creates master tables and encryption functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Master tenants table (not in a schema - shared across all)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    schema_name VARCHAR(63) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50),
    subscription_plan VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Master users table for authentication
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    supertokens_user_id VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Encryption/Decryption functions using AES
-- Note: The key should be stored securely and passed from environment
CREATE OR REPLACE FUNCTION encrypt_field(data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        pgp_sym_encrypt(data, key, 'cipher-algo=aes256'),
        'base64'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION decrypt_field(encrypted_data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(
        decode(encrypted_data, 'base64'),
        key
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create a new tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Set search path
    EXECUTE format('SET search_path TO %I', schema_name);
    
    -- Create tenant-specific tables
    
    -- API Keys table (encrypted)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.api_keys (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            service_name VARCHAR(100) NOT NULL,
            key_name VARCHAR(255) NOT NULL,
            encrypted_key TEXT NOT NULL,
            encrypted_secret TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP,
            metadata JSONB DEFAULT ''{}''
        )', schema_name);
    
    -- Workflows table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.workflows (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            n8n_workflow_id VARCHAR(255) UNIQUE NOT NULL,
            workflow_type VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            webhook_url TEXT,
            is_active BOOLEAN DEFAULT false,
            configuration JSONB DEFAULT ''{}''::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_executed TIMESTAMP,
            execution_count INTEGER DEFAULT 0
        )', schema_name);
    
    -- Workflow executions log
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.workflow_executions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workflow_id UUID REFERENCES %I.workflows(id) ON DELETE CASCADE,
            n8n_execution_id VARCHAR(255),
            status VARCHAR(50),
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP,
            error_message TEXT,
            input_data JSONB,
            output_data JSONB
        )', schema_name, schema_name);
    
    -- M365 configurations
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.m365_configs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id VARCHAR(255) NOT NULL,
            encrypted_client_id TEXT NOT NULL,
            encrypted_client_secret TEXT NOT NULL,
            encrypted_tenant_id TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);
    
    -- Audit logs
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.audit_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(100),
            resource_id UUID,
            ip_address INET,
            user_agent TEXT,
            changes JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);
    
    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_api_keys_service ON %I.api_keys(service_name)', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_workflows_type ON %I.workflows(workflow_type)', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_executions_workflow ON %I.workflow_executions(workflow_id)', schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_user ON %I.audit_logs(user_id)', schema_name);
    
END;
$$ LANGUAGE plpgsql;

-- Create indexes on master tables
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO automara;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO automara;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO automara;
EOFSQL

echo -e "${GREEN}Database initialization script created${NC}"

# Create Nginx configuration
mkdir -p nginx/conf.d

cat > nginx/nginx.conf << 'EOFNGINX'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    include /etc/nginx/conf.d/*.conf;
}
EOFNGINX

cat > nginx/conf.d/automara.conf << EOFCONF
# Frontend - Automara
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${FRONTEND_DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${FRONTEND_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${FRONTEND_DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        if ($request_method = OPTIONS) {
            add_header 'Access-Control-Allow-Origin' 'https://${FRONTEND_DOMAIN}' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-Tenant-ID' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Length' 0;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            return 204;
        }

    }
}

# API Backend
server {
    listen 80;
    server_name ${API_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${API_DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${API_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${API_DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://${FRONTEND_DOMAIN}' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-Tenant-ID' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
}

# Webhook Endpoint
server {
    listen 80;
    server_name ${WEBHOOK_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${WEBHOOK_DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${WEBHOOK_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${WEBHOOK_DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://backend:4000/webhooks;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOFCONF

echo -e "${GREEN}Nginx configuration created${NC}"

# Create SSL certificate request script
cat > scripts/init-letsencrypt.sh << 'EOFLETSENCRYPT'
#!/bin/bash

domains=(automara.empoweredbydesign.co.nz api.empoweredbydesign.co.nz webhook.empoweredbydesign.co.nz)
rsa_key_size=4096
data_path="./nginx/ssl"
email="" # Adding a valid address is strongly recommended
staging=0 # Set to 1 if you're testing your setup

if [ -d "$data_path" ]; then
  read -p "Existing data found for $domains. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for $domains ..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$data_path/conf/live/$domains"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Starting nginx ..."
docker-compose up --force-recreate -d nginx
echo

echo "### Deleting dummy certificate for $domains ..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for $domains ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Reloading nginx ..."
docker-compose exec nginx nginx -s reload
EOFLETSENCRYPT

chmod +x scripts/init-letsencrypt.sh

echo -e "${GREEN}SSL certificate script created${NC}"

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "1. Review and update the .env file with your configurations"
echo -e "2. Create the backend and frontend code (see separate artifacts)"
echo -e "3. Run: ${GREEN}docker-compose up -d${NC}"
echo -e "4. Initialize SSL: ${GREEN}./scripts/init-letsencrypt.sh${NC}"
echo -e "5. Access Portainer at: ${GREEN}http://${STATIC_IP}:${PORTAINER_PORT}${NC}"
echo -e "6. Access frontend at: ${GREEN}https://${FRONTEND_DOMAIN}${NC}"
echo -e "\n${GREEN}Setup script completed!${NC}\n"
echo -e "${YELLOW}Important: Make sure DNS A records point to ${STATIC_IP}:${NC}"
echo -e "  - ${FRONTEND_DOMAIN}"
echo -e "  - ${API_DOMAIN}"
echo -e "  - ${WEBHOOK_DOMAIN}"
