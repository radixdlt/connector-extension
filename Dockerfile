FROM node:22

WORKDIR /home/node/app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY vendor ./vendor

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

CMD pnpm run test:ci
