#!/usr/bin/env bash
# يترجم نواة خادم هاتف الراوي (Java) ويشغّل اختبارات التكامل عليها. يتطلب JDK 17 وNode 22.
set -e
cd "$(dirname "$0")"
export JCP="${JCP:-$(mktemp -d)}"
javac -d "$JCP" ../app/src/main/java/com/mafia/game/core/*.java DevMain.java RulesTest.java
java -cp "$JCP" RulesTest   # قواعد الأدوار
( cd ../../server && [ -d node_modules ] || npm ci --silent )
node --test --test-reporter=spec local.test.mjs
