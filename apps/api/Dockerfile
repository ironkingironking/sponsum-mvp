FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/ui/package*.json ./packages/ui/
RUN npm install
COPY . .
RUN npm run db:generate
RUN npm run build --workspace @sponsum/shared && npm run build --workspace @sponsum/api
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@sponsum/api"]
