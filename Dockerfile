FROM node:19-alpine
MAINTAINER totalplatform "info@totaljs.com"

VOLUME /code/
WORKDIR /code/
RUN mkdir -p /code/
RUN mkdir -p /code/bundles/

COPY app.bundle ./bundles/app.bundle
COPY index.js .
COPY config .
COPY package.json .

RUN npm install
EXPOSE 8000

CMD [ "npm", "start" ]