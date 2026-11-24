FROM node:24-bookworm-slim AS web
WORKDIR /srv/firstchair
COPY package*.json ./
RUN npm ci
COPY app ./app
COPY components ./components
COPY data ./data
COPY lib ./lib
COPY public ./public
COPY next.config.mjs ./
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /srv/firstchair
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN python3 -m venv /opt/firstchair && /opt/firstchair/bin/pip install --no-cache-dir -r requirements.txt
COPY --from=web /srv/firstchair/out ./out
COPY --from=web /srv/firstchair/node_modules ./node_modules
COPY backend ./backend
COPY data ./data
COPY scripts ./scripts
COPY lib ./lib
COPY package.json ./
ENV PATH="/opt/firstchair/bin:$PATH"
ENV FIRSTCHAIR_DB=/var/lib/firstchair/workspace.sqlite
RUN mkdir -p /var/lib/firstchair && chown node:node /var/lib/firstchair
USER node
EXPOSE 8400
CMD ["python3","-m","uvicorn","backend.app:app","--host","0.0.0.0","--port","8400"]
