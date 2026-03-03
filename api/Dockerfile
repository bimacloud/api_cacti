FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies needed for SSH and RRD processing
# sshpass is for remote fetching, rrdtool is for local fetching
RUN apk update && \
    apk add --no-cache openssh-client sshpass rrdtool tzdata && \
    cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime && \
    echo "Asia/Jakarta" > /etc/timezone && \
    apk del tzdata

# Copy package.json and package-lock.json
COPY package*.json ./

# Install application dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Expose API port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
