FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY index.js .
EXPOSE 502/tcp
ENV HOST=0.0.0.0 PORT=502 UNIT=1 TICK_MS=100 K_IN=20 K_OUT_MIN=2 K_OUT_MAX=15
CMD ["node", "index.js"]