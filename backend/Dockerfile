FROM node:26-alpine

WORKDIR /app

# Dépendances d'abord (cache de couche)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Non-root : le code reste en lecture seule (root), seul bulk-data/ est inscriptible
RUN mkdir -p bulk-data && chown node:node bulk-data
USER node

EXPOSE 3001

# Applique les migrations puis démarre (cf. script "start")
CMD ["npm", "start"]
