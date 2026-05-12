FROM node:22

WORKDIR /home/node/app

COPY package.json ./
COPY package-lock.json ./

RUN npm install --ignore-scripts wrtc 

COPY . .

CMD npm run test