FROM node:24-alpine

WORKDIR /app

# Dépendances d'abord (cache de couche)
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

# Applique les migrations puis démarre (cf. script "start")
CMD ["npm", "start"]
