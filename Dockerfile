FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx typescript
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--import", "tsx", "src/server.ts"]
