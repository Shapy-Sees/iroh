FROM node:18-alpine

WORKDIR /app

# Install Python and build dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    gcc \
    linux-headers \
    udev \
    raspberrypi-dev \
    raspberrypi-libs \
    raspberrypi-utils

# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3

COPY package*.json ./

# Install dependencies with Python path explicitly set
RUN npm cache clean --force
RUN npm install --python=/usr/bin/python3

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
