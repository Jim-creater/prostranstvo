<?php
// Отправка сообщений клиентам: Telegram и MAX.
declare(strict_types=1);

function tg(string $method, array $params = []): ?array
{
    $token = (string) cfg('telegram.token');
    if ($token === '') {
        return null;
    }
    [$code, $resp] = http_json('POST', "https://api.telegram.org/bot$token/$method", $params);
    if ($code !== 200 || empty($resp['ok'])) {
        log_msg("Telegram $method: HTTP $code " . json_encode($resp, JSON_UNESCAPED_UNICODE));
        return null;
    }
    return $resp['result'] ?? [];
}

function max_api(string $method, string $path, ?array $body = null, array $query = []): ?array
{
    if (!cfg('max.enabled') || !cfg('max.token')) {
        return null;
    }
    $url = rtrim((string) cfg('max.api'), '/') . $path . ($query ? '?' . http_build_query($query) : '');
    [$code, $resp] = http_json($method, $url, $body, ['Authorization' => (string) cfg('max.token')]);
    if ($code < 200 || $code >= 300) {
        log_msg("MAX $method $path: HTTP $code " . json_encode($resp, JSON_UNESCAPED_UNICODE));
        return null;
    }
    return $resp ?? [];
}

// Кнопка для сообщения: ['text' => 'Открыть кабинет', 'app' => 'путь в кабинете'] или ['text' => ..., 'url' => ...]
function tg_keyboard(array $buttons): ?array
{
    if (!$buttons) {
        return null;
    }
    $row = [];
    foreach ($buttons as $b) {
        if (isset($b['app'])) {
            $row[] = ['text' => $b['text'], 'web_app' => ['url' => app_link($b['app'])]];
        } else {
            $row[] = ['text' => $b['text'], 'url' => $b['url']];
        }
    }
    return ['inline_keyboard' => array_map(fn ($b) => [$b], $row)];
}

// Ссылка на экран кабинета: app_link('#bookings') → https://…/app/?go=bookings
// Экран передаём параметром, а не через #: Telegram дописывает свои данные в # при открытии мини-приложения.
function app_link(string $path = '', array $params = []): string
{
    $go = ltrim($path, '#/');
    $query = array_filter(['go' => $go] + $params, fn ($v) => $v !== '' && $v !== null);
    return rtrim((string) cfg('app_url'), '/') . '/' . ($query ? '?' . http_build_query($query) : '');
}

function send_telegram(int $chatId, string $html, array $buttons = []): bool
{
    $params = ['chat_id' => $chatId, 'text' => $html, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
    if ($kb = tg_keyboard($buttons)) {
        $params['reply_markup'] = $kb;
    }
    return tg('sendMessage', $params) !== null;
}

function send_max(int $userId, string $html, array $buttons = []): bool
{
    $body = ['text' => $html, 'format' => 'html'];
    if ($buttons) {
        $body['attachments'] = [[
            'type' => 'inline_keyboard',
            'payload' => ['buttons' => array_map(fn ($b) => [[
                'type' => 'link', 'text' => $b['text'], 'url' => isset($b['app']) ? app_link($b['app']) : $b['url'],
            ]], array_slice($buttons, 0, 3))],
        ]];
    }
    return max_api('POST', '/messages', $body, ['user_id' => $userId]) !== null;
}

// Сообщение клиенту во все подключённые мессенджеры. Возвращает true, если хоть одно ушло.
function notify_client(array $c, string $html, array $buttons = []): bool
{
    $log = (string) cfg('notify_log');
    if ($log !== '') {
        file_put_contents($log, json_encode(['client' => (int) $c['id'], 'text' => $html, 'buttons' => $buttons], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);
        return true;
    }
    $sent = false;
    if ($c['telegram_id'] && (int) $c['notify_tg']) {
        $sent = send_telegram((int) $c['telegram_id'], $html, $buttons) || $sent;
    }
    if ($c['max_user_id'] && (int) $c['notify_max'] && cfg('max.enabled')) {
        $sent = send_max((int) $c['max_user_id'], $html, $buttons) || $sent;
    }
    return $sent;
}

// Отправить один раз: повторный вызов с тем же kind и ref ничего не сделает.
function notify_once(array $c, string $kind, string $ref, string $html, array $buttons = []): bool
{
    if (val('SELECT id FROM notifications WHERE client_id = ? AND kind = ? AND ref_id = ?', [$c['id'], $kind, $ref])) {
        return false;
    }
    insert('notifications', ['client_id' => (int) $c['id'], 'kind' => $kind, 'ref_id' => $ref, 'sent_at' => now()]);
    return notify_client($c, $html, $buttons);
}

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

// Место освободилось — пишем первому из листа ожидания.
function offer_seat_to_waitlist(array $ev): void
{
    // Каждому пишем один раз: если место освобождается снова, сообщение получает следующий в очереди.
    $waiting = rows("SELECT c.* FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.event_id = ? AND b.status = 'waitlist' ORDER BY b.created_at", [$ev['id']]);
    foreach ($waiting as $w) {
        if (notify_once($w, 'seat', (string) $ev['id'], 'Освободилось место на «' . e($ev['title']) . '», ' . human_date($ev['starts_at']) . '. Успейте записаться!', [['text' => 'Записаться', 'app' => '#event-' . $ev['id']]])) {
            return;
        }
    }
}
