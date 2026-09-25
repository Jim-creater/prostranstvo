<?php
// Настройки для автотестов: локальная SQLite-база, тестовая оплата, уведомления пишутся в файл.
$tmp = __DIR__ . '/tmp';
return [
    'db' => ['dsn' => 'sqlite:' . $tmp . '/test.sqlite'],
    'timezone' => 'Europe/Moscow',
    'site_url' => 'http://127.0.0.1:8098/',
    'app_url' => 'http://127.0.0.1:8098/app/',
    'api_url' => 'http://127.0.0.1:8098/api/',
    'telegram' => ['token' => '123456:TEST-TOKEN', 'bot_username' => 'prostranstvo_test_bot', 'webhook_secret' => 'hook-secret', 'members_chat_id' => '', 'members_chat_invite' => ''],
    'max' => ['enabled' => false, 'token' => '', 'bot_link' => '', 'api' => '', 'webhook_secret' => ''],
    'payments' => ['provider' => 'test', 'yookassa' => []],
    'single_price' => 2500,
    'capacity' => 40,
    'cron_key' => 'cron-key',
    'dev_login' => true,
    'notify_log' => $tmp . '/notify.log',
];
