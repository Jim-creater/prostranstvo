<?php
// Вебхук MAX-бота: привязка клиента к MAX, чтобы уведомления приходили и туда.
// Клиент нажимает в кабинете «Подключить MAX», бот получает событие bot_started со служебным кодом.
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rules.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/notify.php';

$secret = (string) cfg('max.webhook_secret');
if (!cfg('max.enabled') || $secret === '' || !hash_equals($secret, (string) ($_GET['s'] ?? ''))) {
    http_response_code(403);
    exit;
}
$u = json_decode((string) file_get_contents('php://input'), true) ?: [];

try {
    $type = $u['update_type'] ?? '';
    $userId = (int) ($u['user']['user_id'] ?? $u['message']['sender']['user_id'] ?? 0);
    if (!$userId) {
        exit;
    }
    if ($type === 'bot_started') {
        $code = (string) ($u['payload'] ?? '');
        $c = $code !== '' ? row('SELECT * FROM clients WHERE max_link_token = ?', [$code]) : null;
        if ($c) {
            q('UPDATE clients SET max_user_id = NULL WHERE max_user_id = ?', [$userId]);
            update('clients', (int) $c['id'], ['max_user_id' => $userId, 'max_link_token' => random_token(12)]);
            send_max($userId, '<b>Готово!</b> Напоминания о встречах и абонементе будут приходить сюда.', [['text' => 'Открыть кабинет', 'app' => '']]);
        } else {
            send_max($userId, 'Здравствуйте! Это Пространство. Чтобы получать напоминания здесь, откройте кабинет и нажмите «Подключить MAX».', [['text' => 'Открыть кабинет', 'app' => '']]);
        }
        exit;
    }
    if ($type === 'message_created') {
        send_max($userId, 'Расписание, запись и абонемент — в кабинете.', [['text' => 'Открыть кабинет', 'app' => '']]);
    }
} catch (Throwable $ex) {
    log_msg('max-bot: ' . $ex->getMessage());
}
