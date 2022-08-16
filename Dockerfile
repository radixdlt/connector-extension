FROM node:18

WORKDIR /home/node/app

COPY package.json ./
COPY yarn.lock ./

COPY . .

CMD yarn test