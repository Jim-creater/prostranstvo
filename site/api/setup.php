<?php
// Настройка при запуске. Команды:
//   php setup.php init                        — создать таблицы
//   php setup.php seed 2026-09-28 8           — расписание на 8 недель с понедельника 28.09 (по шаблону ниже)
//   php setup.php webhook                     — подключить Telegram-бота и кнопку кабинета в меню
//   php setup.php max-webhook                 — подключить MAX-бота
//   php setup.php staff 123456789             — сделать сотрудником (Telegram ID или телефон)
// Через браузер: setup.php?key=<cron_key>&cmd=init (&a=..., &b=...)
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rules.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/notify.php';

require_cli_or_key();

$cmd = PHP_SAPI === 'cli' ? ($argv[1] ?? '') : (string) ($_GET['cmd'] ?? '');
$a = PHP_SAPI === 'cli' ? ($argv[2] ?? '') : (string) ($_GET['a'] ?? '');
$b = PHP_SAPI === 'cli' ? ($argv[3] ?? '') : (string) ($_GET['b'] ?? '');

// Недельный шаблон расписания. Время — пример, поправьте под своё.
const WEEK_TEMPLATE = [
    // день недели (1 = пн … 7 = вс), время, формат, название, длительность, только определённые недели месяца
    [1, '18:00', 'lit',     'Литературный клуб',              120, null],
    [1, '20:15', 'script',  'Сценарный клуб',                 105, null],
    [3, '18:00', 'lit',     'Литературный клуб',              120, null],
    [3, '20:15', 'script',  'Сценарный клуб',                 105, null],
    [4, '12:00', 'costume', 'История костюма и поиск стиля',  120, [1, 3]], // 1-й и 3-й четверг месяца
    [5, '19:30', 'script',  'Сценарный клуб',                 120, null],
    [6, '12:00', 'lit',     'Литературный клуб',              120, null],
    [6, '16:00', 'guest',   'Встреча со специальным гостем',  120, null],
    [6, '19:30', 'film',    'Кинопоказ и обсуждение',         150, null],
    [7, '12:00', 'art',     'Рисунок и история искусств',     120, null],
    [7, '16:00', 'guest',   'Встреча со специальным гостем',  120, null],
    [7, '19:30', 'film',    'Кинопоказ и обсуждение',         150, null],
];

function out($x): void
{
    echo (is_string($x) ? $x : json_encode($x, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) . "\n";
}

switch ($cmd) {
    case 'init':
        $sql = file_get_contents(__DIR__ . (is_sqlite() ? '/schema.sqlite.sql' : '/schema.mysql.sql'));
        $sql = preg_replace('/^\s*--.*$/m', '', $sql);
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
            db()->exec($stmt);
        }
        out('Таблицы созданы.');
        break;

    case 'seed':
        $from = strtotime($a ?: 'monday this week');
        $weeks = max(1, (int) ($b ?: 8));
        $n = 0;
        for ($d = 0; $d < $weeks * 7; $d++) {
            $day = strtotime("+$d day", $from);
            $dow = (int) date('N', $day);
            $weekOfMonth = intdiv((int) date('j', $day) - 1, 7) + 1;
            foreach (WEEK_TEMPLATE as [$wd, $time, $format, $title, $dur, $onlyWeeks]) {
                if ($wd !== $dow || ($onlyWeeks && !in_array($weekOfMonth, $onlyWeeks, true))) {
                    continue;
                }
                $starts = date('Y-m-d', $day) . ' ' . $time . ':00';
                if (val('SELECT id FROM events WHERE starts_at = ? AND format = ?', [$starts, $format])) {
                    continue;
                }
                insert('events', ['format' => $format, 'title' => $title, 'host' => '', 'starts_at' => $starts, 'duration_min' => $dur, 'capacity' => (int) cfg('capacity'), 'included' => 1, 'created_at' => now()]);
                $n++;
            }
        }
        out("Добавлено встреч: $n");
        break;

    case 'webhook':
        $api = rtrim((string) cfg('api_url'), '/');
        out(tg('setWebhook', [
            'url' => $api . '/bot.php', 'secret_token' => (string) cfg('telegram.webhook_secret'),
            'allowed_updates' => ['message', 'chat_join_request'], 'drop_pending_updates' => true,
        ]) ?? 'Ошибка setWebhook: проверьте токен и HTTPS');
        out(tg('setChatMenuButton', ['menu_button' => ['type' => 'web_app', 'text' => 'Кабинет', 'web_app' => ['url' => app_link()]]]) ?? 'Ошибка setChatMenuButton');
        out(tg('setMyCommands', ['commands' => [['command' => 'start', 'description' => 'Открыть Пространство'], ['command' => 'zapisi', 'description' => 'Мои записи']]]) ?? 'Ошибка setMyCommands');
        break;

    case 'max-webhook':
        $url = rtrim((string) cfg('api_url'), '/') . '/max-bot.php?s=' . rawurlencode((string) cfg('max.webhook_secret'));
        out(max_api('POST', '/subscriptions', ['url' => $url, 'update_types' => ['bot_started', 'message_created']]) ?? 'Ошибка: проверьте, что MAX включён и токен верный');
        break;

    case 'staff':
        $phone = normalize_phone($a);
        $c = $phone ? row('SELECT * FROM clients WHERE phone = ?', [$phone]) : row('SELECT * FROM clients WHERE telegram_id = ?', [(int) $a]);
        if (!$c) {
            out('Клиент не найден: пусть сначала откроет кабинет или напишет боту /start.');
            break;
        }
        update('clients', (int) $c['id'], ['is_staff' => 1]);
        out('Готово: ' . $c['name'] . ' теперь сотрудник.');
        break;

    default:
        out('Команды: init, seed <дата> <недель>, webhook, max-webhook, staff <telegram id или телефон>');
}
