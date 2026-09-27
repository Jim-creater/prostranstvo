<?php
// Вход: через Telegram (кабинет внутри Telegram и кнопка «Войти через Telegram» на сайте).
declare(strict_types=1);

const SESSION_DAYS = 60;

// Проверка данных, которые Telegram передаёт в мини-приложение (Telegram.WebApp.initData).
function verify_webapp_init_data(string $initData, string $botToken, int $maxAgeSec = 86400): ?array
{
    parse_str($initData, $data);
    if (empty($data['hash'])) {
        return null;
    }
    $hash = $data['hash'];
    unset($data['hash']);
    ksort($data);
    $lines = [];
    foreach ($data as $k => $v) {
        $lines[] = $k . '=' . $v;
    }
    $secret = hash_hmac('sha256', $botToken, 'WebAppData', true);
    $check = hash_hmac('sha256', implode("\n", $lines), $secret);
    if (!hash_equals($check, $hash)) {
        return null;
    }
    if (isset($data['auth_date']) && time() - (int) $data['auth_date'] > $maxAgeSec) {
        return null;
    }
    $user = isset($data['user']) ? json_decode($data['user'], true) : null;
    return is_array($user) && isset($user['id']) ? $user : null;
}

// Проверка данных виджета «Войти через Telegram» на сайте.
function verify_login_widget(array $data, string $botToken, int $maxAgeSec = 86400): ?array
{
    if (empty($data['hash']) || empty($data['id'])) {
        return null;
    }
    $hash = (string) $data['hash'];
    $fields = array_intersect_key($data, array_flip(['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date']));
    ksort($fields);
    $lines = [];
    foreach ($fields as $k => $v) {
        $lines[] = $k . '=' . $v;
    }
    $check = hash_hmac('sha256', implode("\n", $lines), hash('sha256', $botToken, true));
    if (!hash_equals($check, $hash)) {
        return null;
    }
    if (time() - (int) ($data['auth_date'] ?? 0) > $maxAgeSec) {
        return null;
    }
    return $fields;
}

// Находим клиента по Telegram или создаём нового.
function client_from_telegram(array $user): array
{
    $tgId = (int) $user['id'];
    $c = row('SELECT * FROM clients WHERE telegram_id = ?', [$tgId]);
    $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    if (!$c) {
        $id = insert('clients', [
            'telegram_id' => $tgId, 'tg_username' => $user['username'] ?? null,
            'name' => $name, 'created_at' => now(),
        ]);
        return row('SELECT * FROM clients WHERE id = ?', [$id]);
    }
    if (($user['username'] ?? null) && $c['tg_username'] !== $user['username']) {
        update('clients', (int) $c['id'], ['tg_username' => $user['username']]);
    }
    return $c;
}

// Гостя, которого команда завела на месте (без Telegram), привязываем к его Telegram,
// когда он подтвердит тот же номер кнопкой «Поделиться номером». Номер из Telegram проверенный,
// поэтому чужой абонемент так не забрать. Возвращает запись без Telegram, если нашлась и перенесена.
function adopt_offline_client(array $c): ?array
{
    if (!$c['phone']) {
        return null;
    }
    $old = row('SELECT * FROM clients WHERE phone = ? AND id <> ? AND telegram_id IS NULL AND max_user_id IS NULL ORDER BY id LIMIT 1', [$c['phone'], $c['id']]);
    if (!$old) {
        return null;
    }
    $from = (int) $old['id'];
    $to = (int) $c['id'];
    // Если на одну встречу записаны обе записи, оставляем текущую.
    $taken = array_column(rows('SELECT event_id FROM bookings WHERE client_id = ?', [$to]), 'event_id');
    foreach (rows('SELECT id, event_id FROM bookings WHERE client_id = ?', [$from]) as $b) {
        in_array($b['event_id'], $taken)
            ? q('DELETE FROM bookings WHERE id = ?', [$b['id']])
            : q('UPDATE bookings SET client_id = ? WHERE id = ?', [$to, $b['id']]);
    }
    q('UPDATE memberships SET client_id = ? WHERE client_id = ?', [$to, $from]);
    q('UPDATE purchases SET client_id = ? WHERE client_id = ?', [$to, $from]);
    foreach (rows('SELECT id, kind, ref_id FROM notifications WHERE client_id = ?', [$from]) as $n) {
        val('SELECT id FROM notifications WHERE client_id = ? AND kind = ? AND ref_id = ?', [$to, $n['kind'], $n['ref_id']])
            ? q('DELETE FROM notifications WHERE id = ?', [$n['id']])
            : q('UPDATE notifications SET client_id = ? WHERE id = ?', [$to, $n['id']]);
    }
    $upd = [];
    if (!$c['note'] && $old['note']) {
        $upd['note'] = $old['note'];
    }
    if ((int) $old['is_staff']) {
        $upd['is_staff'] = 1;
    }
    if (trim((string) $c['name']) === '' && $old['name']) {
        $upd['name'] = $old['name'];
    }
    if ($upd) {
        update('clients', $to, $upd);
    }
    q('DELETE FROM sessions WHERE client_id = ?', [$from]);
    q('DELETE FROM clients WHERE id = ?', [$from]);
    return $old;
}

function create_session(int $clientId): string
{
    $token = random_token(32);
    insert('sessions', [
        'token_hash' => hash('sha256', $token), 'client_id' => $clientId,
        'created_at' => now(), 'expires_at' => date('Y-m-d H:i:s', time() + SESSION_DAYS * 86400),
    ]);
    return $token;
}

function bearer_token(): string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (stripos($h, 'Bearer ') === 0) {
        return trim(substr($h, 7));
    }
    // Запасной заголовок: некоторые хостинги не передают Authorization в PHP.
    return (string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? $_GET['t'] ?? '');
}

function current_client(): ?array
{
    $token = bearer_token();
    if ($token === '') {
        return null;
    }
    $s = row('SELECT client_id FROM sessions WHERE token_hash = ? AND expires_at > ?', [hash('sha256', $token), now()]);
    return $s ? row('SELECT * FROM clients WHERE id = ?', [$s['client_id']]) : null;
}

function require_client(): array
{
    $c = current_client();
    if (!$c) {
        fail('Войдите в личный кабинет', 401);
    }
    return $c;
}

function require_staff(): array
{
    $c = require_client();
    if (!(int) $c['is_staff']) {
        fail('Раздел только для команды Пространства', 403);
    }
    return $c;
}

function client_public(array $c): array
{
    return [
        'id' => (int) $c['id'], 'name' => $c['name'], 'phone' => $c['phone'],
        'telegram' => $c['telegram_id'] ? true : false, 'tg_username' => $c['tg_username'],
        'max' => $c['max_user_id'] ? true : false,
        'is_staff' => (bool) (int) $c['is_staff'],
        'consent_pd' => $c['consent_pd_at'] !== null, 'consent_news' => (bool) (int) $c['consent_news'],
        'notify_tg' => (bool) (int) $c['notify_tg'], 'notify_max' => (bool) (int) $c['notify_max'],
        'notify_24h' => (bool) (int) $c['notify_24h'], 'notify_2h' => (bool) (int) $c['notify_2h'],
    ];
}

function normalize_phone(string $phone): ?string
{
    $d = preg_replace('/\D+/', '', $phone);
    if (strlen($d) === 11 && ($d[0] === '8' || $d[0] === '7')) {
        return '7' . substr($d, 1);
    }
    if (strlen($d) === 10 && $d[0] === '9') {
        return '7' . $d;
    }
    return null;
}
