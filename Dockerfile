# Stage 1
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci
 
COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src

RUN npm run build

RUN npm prune --omit=dev

# Stage 2 

FROM node:20-alpine AS production

WORKDIR /app

 
COPY --from=builder --chown=node:node /app/package.json ./ 
COPY --from=builder --chown=node:node /app/node_modules ./node_modules 
COPY --from=builder --chown=node:node /app/dist ./dist 
COPY --from=builder --chown=node:node /app/drizzle ./drizzle 
ENV NODE_ENV=production 
ENV PORT=5000 

EXPOSE 5000


USER node 


HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \ 
CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "dist/index.js"]
