FROM arm64v8/ubuntu:focal

ENV DEBIAN_FRONTEND=noninteractive
COPY ./app /app

## ffmpeg
RUN \
    apt update && \
    apt install -y curl wget && \
    wget https://github.com/MarcA711/Rockchip-FFmpeg-Builds/releases/download/6.1-6/ffmpeg -O /usr/bin/ffmpeg && \
    chmod +x /usr/bin/ffmpeg

## nodejs v20 from node-repo
RUN \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt install -y nodejs

WORKDIR /app
RUN \
    npm install && \
    npm init -y && \
    npm install express multer fluent-ffmpeg ffmpeg-static

## cleanup
RUN \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/apt/* /tmp/* /var/tmp/* /usr/share/doc/*

CMD ["sh", "-c", "node /app/server.js"]