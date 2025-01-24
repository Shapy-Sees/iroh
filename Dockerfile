# Dockerfile

FROM node:16

# Install DAHDI dependencies
RUN apt-get update && apt-get install -y \
    dahdi \
    dahdi-linux \
    dahdi-tools \
    build-essential \
    linux-headers-$(uname -r) \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "start"]