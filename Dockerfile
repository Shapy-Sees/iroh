FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache git

RUN npm install -g typescript ts-node nodemon

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
