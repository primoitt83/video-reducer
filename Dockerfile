FROM arm64v8/ubuntu:focal

ENV DEBIAN_FRONTEND=noninteractive

## Instala dependências do sistema
RUN apt update && \
    apt install -y curl wget && \
    wget https://github.com/MarcA711/Rockchip-FFmpeg-Builds/releases/download/6.1-6/ffmpeg -O /usr/bin/ffmpeg && \
    chmod +x /usr/bin/ffmpeg

## Instala Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt install -y nodejs && \
    npm install -g npm@latest

# Configura o ambiente
WORKDIR /app

# Copia APENAS os arquivos de dependência (para melhor cache)
COPY ./app/package*.json ./

# Instala dependências de forma mais robusta
RUN npm config set fund false && \
    npm config set audit false && \
    npm install --production --force && \
    npm cache clean --force

# Copia o restante da aplicação
COPY ./app .

## Limpeza
RUN apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/apt/* /tmp/* /var/tmp/* /usr/share/doc/*

CMD ["node", "/app/server.js"]