# Create the production image
FROM imbios/bun-node:latest-22-debian AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./
COPY lerna.json ./

COPY packages/ ./packages/
COPY clients/ ./clients/

# Install dependencies
RUN npm ci

# Build the mono-repo
RUN npm run build

# Stage 2: Create the service image
FROM nginx:alpine

# Copy only the necessary files from the builder stage
COPY --from=builder /app/clients/webapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/clients/webapp/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]