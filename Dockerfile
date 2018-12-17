FROM node:carbon-alpine
RUN apk --no-cache add git
RUN git clone https://www.github.com/trainerbill/paypal-webhooks
WORKDIR /paypal-webhooks
RUN npm install -g yarn
RUN yarn install
RUN yarn start
EXPOSE 3000
