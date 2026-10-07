FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p storage/{uploads,audio,subtitles,voice,output,temp}
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
CMD ["node","src/server.js"]