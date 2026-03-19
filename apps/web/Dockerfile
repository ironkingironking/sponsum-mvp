FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/ui/package*.json ./packages/ui/
RUN npm install
COPY . .
RUN npm run build --workspace @sponsum/shared && npm run build --workspace @sponsum/ui && npm run build --workspace @sponsum/web
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@sponsum/web"]
