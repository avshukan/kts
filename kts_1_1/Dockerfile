# builder
FROM node:18-alpine as builder

WORKDIR /app

RUN npm install -g npm@10.2.5

COPY ./demoapp/package*.json .

RUN npm install

COPY ./demoapp/src ./src

COPY ./demoapp/public ./public

RUN npm run build



# Bundle static assets with nginx
FROM nginx:alpine as production

COPY --from=builder /app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8899

CMD ["nginx", "-g", "daemon off;"]