FROM node:18

WORKDIR /home/node/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn add --dev wrtc

COPY . .

CMD yarn test:jest