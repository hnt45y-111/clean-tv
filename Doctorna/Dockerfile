# نشر مجاني على Hugging Face Spaces (Docker) — بدون بطاقة. يسحب الكود من جت هب ويشغّله على المنفذ 7860.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ccr-4240d295-xmzhyg https://github.com/hnt45y-111/clean-tv.git /app
WORKDIR /app/Doctorna/server
ENV PORT=7860 DOCTORNA_DEMO=1 DOCTORNA_DB=/tmp/doctorna.db OWNER_PHONE=07700000001
EXPOSE 7860
CMD ["node", "src/server.js"]
