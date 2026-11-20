#!/usr/bin/env bash
# تشغيل دكتورنا أوفلاين: يجهّز الحسابات التجريبية ويشغّل الخادم على http://localhost:3100
cd "$(dirname "$0")/server" || exit 1
export OWNER_PASSWORD="${OWNER_PASSWORD:-owner123}"
export PORT="${PORT:-3100}"
node -e "process.exit(+process.versions.node.split('.')[0] >= 22 ? 0 : 1)" || { echo "لازم Node.js 22 أو أحدث"; exit 1; }
node src/seed.js 2>/dev/null | head -1
echo "افتح بالمتصفح:  http://localhost:$PORT"
exec node src/server.js
