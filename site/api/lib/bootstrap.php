<?php
// Общие функции: настройки, база данных, ответы в JSON, запросы к внешним сервисам.
declare(strict_types=1);

const API_ROOT = __DIR__ . '/..';

function cfg(?string $key = null)
{
    static $config = null;
    if ($config === null) {
        $file = getenv('PR_CONFIG') ?: API_ROOT . '/config.php';
        if (!is_file($file)) {
            http_response_code(500);
            exit('Нет файла config.php: скопируйте config.sample.php и заполните его.');
        }
        $config = require $file;
    }
    if ($key === null) {
        return $config;
    }
    $value = $config;
    foreach (explode('.', $key) as $part) {
        if (!is_array($value) || !array_key_exists($part, $value)) {
            return null;
        }
        $value = $value[$part];
    }
    return $value;
}

date_default_timezone_set(cfg('timezone') ?: 'Europe/Moscow');

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $d = cfg('db');
        $pdo = new PDO($d['dsn'], $d['user'] ?? null, $d['pass'] ?? null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        if (is_sqlite()) {
            $pdo->exec('PRAGMA busy_timeout = 3000');
        }
    }
    return $pdo;
}

function is_sqlite(): bool
{
    return str_starts_with((string) cfg('db.dsn'), 'sqlite:');
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function row(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->fetch();
    return $r === false ? null : $r;
}

function rows(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function val(string $sql, array $params = [])
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

function insert(string $table, array $data): int
{
    $cols = array_keys($data);
    $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', $cols) . ') VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')';
    q($sql, array_values($data));
    return (int) db()->lastInsertId();
}

function update(string $table, int $id, array $data): void
{
    $set = implode(', ', array_map(fn ($c) => "$c = ?", array_keys($data)));
    q("UPDATE $table SET $set WHERE id = ?", [...array_values($data), $id]);
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $code = 400): void
{
    json_out(['error' => $message], $code);
}

function body(): array
{
    static $body = null;
    if ($body === null) {
        $raw = file_get_contents('php://input');
        $body = $raw ? (json_decode($raw, true) ?: []) : [];
        $body += $_POST;
    }
    return $body;
}

function http_json(string $method, string $url, ?array $data = null, array $headers = []): array
{
    $ch = curl_init($url);
    $h = ['Content-Type: application/json'];
    foreach ($headers as $k => $v) {
        $h[] = "$k: $v";
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => $h,
    ]);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE));
    }
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($resp === false) {
        log_msg("HTTP $method $url: $err");
        return [0, null];
    }
    return [$code, json_decode((string) $resp, true)];
}

function log_msg(string $message): void
{
    error_log('[prostranstvo] ' . $message);
}

function random_token(int $bytes = 24): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

// Проверка служебного ключа для cron.php и setup.php, если их запускают через браузер.
function require_cli_or_key(): void
{
    if (PHP_SAPI === 'cli') {
        return;
    }
    $key = (string) cfg('cron_key');
    if ($key === '' || !hash_equals($key, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit('Нужен ключ');
    }
}
