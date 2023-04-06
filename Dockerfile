FROM node:19-alpine

RUN apk update && apk add bash
RUN apk add curl
RUN apk add docker docker-cli-compose
RUN apk add git
RUN apk add zip

VOLUME /code/
WORKDIR /code/
COPY . /

RUN npm install
EXPOSE 8000

CMD [ "npm", "start" ]