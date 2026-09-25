<?php
// Вебхук Telegram-бота: приветствие, телефон, мои записи, заявки в чат держателей карты.
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rules.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/notify.php';

$secret = (string) cfg('telegram.webhook_secret');
if ($secret === '' || !hash_equals($secret, (string) ($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? ''))) {
    http_response_code(403);
    exit;
}
$update = json_decode((string) file_get_contents('php://input'), true) ?: [];

try {
    // Заявка на вступление в чат держателей карты: пускаем только с действующим абонементом.
    if (isset($update['chat_join_request'])) {
        $req = $update['chat_join_request'];
        $c = client_from_telegram($req['from']);
        $chatId = $req['chat']['id'];
        if (active_membership((int) $c['id'], current_month())) {
            tg('approveChatJoinRequest', ['chat_id' => $chatId, 'user_id' => $req['from']['id']]);
            update('clients', (int) $c['id'], ['in_chat' => 1]);
        } else {
            tg('declineChatJoinRequest', ['chat_id' => $chatId, 'user_id' => $req['from']['id']]);
            send_telegram((int) $req['from']['id'], 'Чат доступен держателям карты. Оформите абонемент в кабинете, и бот пустит вас в чат.', [['text' => 'Абонементы', 'app' => '#plans']]);
        }
        exit;
    }

    $msg = $update['message'] ?? null;
    if (!$msg || ($msg['chat']['type'] ?? '') !== 'private') {
        exit;
    }
    $c = client_from_telegram($msg['from']);
    $chatId = (int) $msg['chat']['id'];
    $text = trim((string) ($msg['text'] ?? ''));

    // Клиент поделился номером телефона.
    if (isset($msg['contact'])) {
        if ((int) ($msg['contact']['user_id'] ?? 0) === (int) $msg['from']['id']) {
            $phone = normalize_phone((string) $msg['contact']['phone_number']);
            if ($phone) {
                update('clients', (int) $c['id'], ['phone' => $phone]);
            }
        }
        tg('sendMessage', ['chat_id' => $chatId, 'text' => 'Спасибо, номер сохранили.', 'reply_markup' => ['remove_keyboard' => true]]);
        send_telegram($chatId, 'Теперь можно записываться на встречи.', [['text' => 'Открыть кабинет', 'app' => '']]);
        exit;
    }

    if (str_starts_with($text, '/start')) {
        $hello = '<b>Здравствуйте! Это Пространство.</b>' . "\n\n" .
            'Здесь можно записаться на встречи клубов, гостей и кино, купить абонемент и получать напоминания.' . "\n\n" .
            'Нажмите «Открыть кабинет», чтобы посмотреть расписание.';
        send_telegram($chatId, $hello, [['text' => 'Открыть кабинет', 'app' => '']]);
        if (!$c['phone']) {
            tg('sendMessage', [
                'chat_id' => $chatId,
                'text' => 'Поделитесь номером телефона: на него придут чеки об оплате.',
                'reply_markup' => ['keyboard' => [[['text' => 'Поделиться номером', 'request_contact' => true]]], 'resize_keyboard' => true, 'one_time_keyboard' => true],
            ]);
        }
        exit;
    }

    if ($text === '/zapisi' || mb_strtolower($text) === 'мои записи') {
        $list = rows(
            "SELECT e.title, e.starts_at FROM bookings b JOIN events e ON e.id = b.event_id
             WHERE b.client_id = ? AND b.status = 'booked' AND e.starts_at >= ? ORDER BY e.starts_at LIMIT 5",
            [$c['id'], now()]
        );
        $out = $list ? "<b>Ваши ближайшие записи:</b>\n" . implode("\n", array_map(fn ($e) => '· ' . human_date($e['starts_at']) . ' — ' . e($e['title']), $list))
                     : 'Пока нет записей на ближайшие дни.';
        send_telegram($chatId, $out, [['text' => 'Открыть кабинет', 'app' => '#bookings']]);
        exit;
    }

    send_telegram($chatId, 'Всё самое нужное — в кабинете: расписание, запись и абонемент.', [['text' => 'Открыть кабинет', 'app' => '']]);
} catch (Throwable $ex) {
    log_msg('bot: ' . $ex->getMessage());
}
