#!/usr/bin/env bash
# Запуск автотестов API: локальная база SQLite, встроенный сервер PHP.
set -e
cd "$(dirname "$0")/.."
mkdir -p tests/tmp
rm -f tests/tmp/test.sqlite tests/tmp/notify.log
export PR_CONFIG="$PWD/tests/config.test.php"
php site/api/setup.php init
php -S 127.0.0.1:8098 -t site > tests/tmp/server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 0.7
php tests/api_test.php
