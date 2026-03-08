FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/ui/package*.json ./packages/ui/
RUN npm install
COPY . .
RUN npm run db:generate
EXPOSE 4000
CMD ["npm", "run", "dev", "--workspace", "@sponsum/api"]
