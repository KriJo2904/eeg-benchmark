FROM node:20-bookworm-slim
WORKDIR /app
COPY projects-api/package.json /app/package.json
RUN npm install --omit=dev
COPY projects-api/server.js /app/server.js
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]

