FROM node:16
WORKDIR ~/CloudProject/HW8
COPY package.json ./
RUN npm install
COPY . .
ENV GOOGLE_APPLICATION_CREDENTIALS='./assignment-8-368723-3000775a7af7.json'
ENV PORT=8000
EXPOSE ${PORT}
CMD ["npm", "start"]