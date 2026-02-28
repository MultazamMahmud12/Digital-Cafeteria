# identity-service Dockerfile
FROM node:18-alpine

# create app directory
WORKDIR /usr/src/app

# install dependencies
COPY package*.json ./
RUN npm ci --only=production

# copy source
COPY . .

# expose port
EXPOSE 3001

# start command
CMD ["node", "server.js"]
