<?php
// Автотест API на локальной SQLite-базе. Запуск: bash tests/run.sh
declare(strict_types=1);

putenv('PR_CONFIG=' . __DIR__ . '/config.test.php');
require __DIR__ . '/../site/api/lib/bootstrap.php';
require __DIR__ . '/../site/api/lib/rules.php';

const BASE = 'http://127.0.0.1:8098/api/';
$fails = 0;
$passes = 0;

function check(string $what, bool $ok, $details = null): void
{
    global $fails, $passes;
    if ($ok) {
        $passes++;
        echo "  ✓ $what\n";
    } else {
        $fails++;
        echo "  ✗ $what\n";
        if ($details !== null) {
            echo '      ' . json_encode($details, JSON_UNESCAPED_UNICODE) . "\n";
        }
    }
}

function api(string $route, ?array $body = null, ?string $token = null, string $extra = ''): array
{
    $ch = curl_init(BASE . 'index.php?r=' . $route . $extra);
    $h = ['Content-Type: application/json'];
    if ($token) {
        $h[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_FOLLOWLOCATION => false]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    $resp = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($resp, true);
    return ['code' => $code, 'data' => is_array($json) ? $json : ['raw' => $resp]];
}

function get_url(string $url): int
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code;
}

// Подписываем initData так же, как это делает Telegram.
function init_data(int $tgId, string $firstName, string $token = '123456:TEST-TOKEN'): string
{
    $data = ['auth_date' => (string) time(), 'query_id' => 'AAH' . $tgId, 'user' => json_encode(['id' => $tgId, 'first_name' => $firstName, 'username' => 'user' . $tgId], JSON_UNESCAPED_UNICODE)];
    ksort($data);
    $lines = [];
    foreach ($data as $k => $v) {
        $lines[] = "$k=$v";
    }
    $secret = hash_hmac('sha256', $token, 'WebAppData', true);
    $data['hash'] = hash_hmac('sha256', implode("\n", $lines), $secret);
    return http_build_query($data);
}

function add_event(string $format, int $hoursFromNow, int $capacity = 40, string $title = ''): int
{
    return insert('events', [
        'format' => $format, 'title' => $title ?: FORMATS[$format]['name'], 'host' => '',
        'starts_at' => date('Y-m-d H:i:s', time() + $hoursFromNow * 3600), 'duration_min' => 120,
        'capacity' => $capacity, 'included' => 1, 'created_at' => now(),
    ]);
}

function notify_lines(): array
{
    $f = cfg('notify_log');
    return is_file($f) ? array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", (string) file_get_contents($f)))) : [];
}

echo "Вход\n";
$bad = api('auth/telegram', ['initData' => init_data(111, 'Анна', 'wrong:token')]);
check('поддельные данные Telegram отклоняются', $bad['code'] === 401, $bad);
$a = api('auth/telegram', ['initData' => init_data(111, 'Анна')]);
check('вход через Telegram работает', $a['code'] === 200 && !empty($a['data']['token']), $a);
$tA = $a['data']['token'];
$b = api('auth/telegram', ['initData' => init_data(222, 'Борис')]);
$tB = $b['data']['token'];

echo "Профиль\n";
$p = api('me', ['name' => 'Анна Смирнова', 'phone' => '8 (900) 123-45-67', 'consent_pd' => true], $tA);
check('телефон сохраняется в формате 7XXXXXXXXXX', ($p['data']['client']['phone'] ?? '') === '79001234567', $p);
check('согласие на обработку данных записано', ($p['data']['client']['consent_pd'] ?? false) === true, $p);
$bad = api('me', ['phone' => '123'], $tA);
check('неверный телефон отклоняется понятной ошибкой', $bad['code'] === 400 && str_contains($bad['data']['error'] ?? '', 'телефон'), $bad);
api('me', ['phone' => '+7 911 000-00-00'], $tB);

// Встречи: все в пределах суток-трёх, чтобы попасть в текущий месяц (тест запускается не в последние дни месяца).
$lit = add_event('lit', 30);
$w = [add_event('film', 26), add_event('guest', 27), add_event('film', 28), add_event('guest', 29), add_event('film', 31)];
$art = add_event('art', 32);
$soon = add_event('script', 10);
$tiny = add_event('lit', 33, 1, 'Камерная встреча');
$now2h = add_event('lit', 1);
$month = month_of(row('SELECT starts_at FROM events WHERE id = ?', [$lit])['starts_at']);

echo "Разовое посещение без абонемента\n";
$r = api('book', ['event_id' => $lit], $tA);
check('без абонемента нужна оплата 2 500 ₽', ($r['data']['status'] ?? '') === 'payment_required' && ($r['data']['amount'] ?? 0) === 2500, $r);
check('тестовая оплата возвращает на кабинет', get_url($r['data']['payment_url']) === 302);
$bk = row('SELECT status, paid_by FROM bookings b JOIN clients c ON c.id = b.client_id WHERE c.telegram_id = 111 AND b.event_id = ?', [$lit]);
check('после оплаты запись подтверждена', ($bk['status'] ?? '') === 'booked' && $bk['paid_by'] === 'single', $bk);

echo "Покупка абонемента\n";
$r = api('buy', ['plan' => 'club1', 'month' => $month], $tA);
check('для «Одного клуба» нужно выбрать клуб', $r['code'] === 400, $r);
$r = api('buy', ['plan' => 'clubs', 'month' => $month], $tA);
check('покупка «Клубы и гости» создаёт платёж', !empty($r['data']['payment_url']), $r);
get_url($r['data']['payment_url']);
$me = api('me', null, $tA)['data'];
$mem = $month === current_month() ? $me['membership'] : $me['next_membership'];
check('абонемент активен после оплаты', ($mem['plan'] ?? '') === 'clubs', $me);
$r = api('buy', ['plan' => 'all', 'month' => $month], $tA);
check('второй абонемент на тот же месяц не продаётся', $r['code'] === 400, $r);

echo "Запись по абонементу\n";
$r = api('book', ['event_id' => $soon], $tA);
check('клуб входит в абонемент', ($r['data']['status'] ?? '') === 'booked', $r);
foreach (array_slice($w, 0, 4) as $i => $id) {
    $r = api('book', ['event_id' => $id], $tA);
    check('выходная встреча ' . ($i + 1) . ' из 4 по абонементу', ($r['data']['status'] ?? '') === 'booked', $r);
}
$ev = api('events', null, $tA)['data']['events'];
$fifth = array_values(array_filter($ev, fn ($e) => $e['id'] === $w[4]))[0] ?? null;
check('пятая выходная встреча уже не входит', ($fifth['cover']['type'] ?? '') === 'single' && str_contains($fifth['cover']['reason'] ?? '', '4 из 4'), $fifth);
$artEv = array_values(array_filter($ev, fn ($e) => $e['id'] === $art))[0] ?? null;
check('рисунок не входит в «Клубы и гости»', ($artEv['cover']['type'] ?? '') === 'single', $artEv);

echo "Отмена\n";
$bid = (int) val('SELECT b.id FROM bookings b JOIN clients c ON c.id = b.client_id WHERE c.telegram_id = 111 AND b.event_id = ?', [$w[0]]);
$r = api('cancel', ['booking_id' => $bid], $tA);
check('отмена больше чем за сутки возвращает посещение', ($r['data']['returned'] ?? null) === true, $r);
$r = api('book', ['event_id' => $w[4]], $tA);
check('после отмены освободившееся посещение можно использовать', ($r['data']['status'] ?? '') === 'booked', $r);
$bid = (int) val('SELECT b.id FROM bookings b JOIN clients c ON c.id = b.client_id WHERE c.telegram_id = 111 AND b.event_id = ?', [$soon]);
$r = api('cancel', ['booking_id' => $bid], $tA);
check('отмена меньше чем за сутки: посещение списывается', ($r['data']['returned'] ?? null) === false, $r);
check('статус поздней отмены сохранён', val('SELECT status FROM bookings WHERE id = ?', [$bid]) === 'late_cancel');

echo "Лист ожидания\n";
@unlink(cfg('notify_log'));
$pay = api('buy', ['plan' => 'all', 'month' => $month], $tB);
get_url($pay['data']['payment_url'] ?? BASE);
$r1 = api('book', ['event_id' => $tiny], $tA);
$r2 = api('book', ['event_id' => $tiny], $tB);
check('в полный зал — в лист ожидания', ($r1['data']['status'] ?? '') === 'booked' && ($r2['data']['status'] ?? '') === 'waitlist', [$r1, $r2]);
$bid = (int) val('SELECT b.id FROM bookings b JOIN clients c ON c.id = b.client_id WHERE c.telegram_id = 111 AND b.event_id = ?', [$tiny]);
api('cancel', ['booking_id' => $bid], $tA);
$seat = array_filter(notify_lines(), fn ($n) => str_contains($n['text'] ?? '', 'Освободилось место'));
check('первому в листе ожидания пришло сообщение', count($seat) === 1, notify_lines());
$r = api('book', ['event_id' => $tiny], $tB);
check('из листа ожидания записывается на освободившееся место', ($r['data']['status'] ?? '') === 'booked', $r);
$r = api('book', ['event_id' => $tiny], $tA);
check('зал снова полон — снова в лист ожидания', ($r['data']['status'] ?? '') === 'waitlist', $r);

echo "Напоминания (cron)\n";
api('book', ['event_id' => $now2h], $tA);
@unlink(cfg('notify_log'));
$out = shell_exec('PR_CONFIG=' . escapeshellarg(__DIR__ . '/config.test.php') . ' php ' . escapeshellarg(__DIR__ . '/../site/api/cron.php'));
$rep = json_decode((string) $out, true);
check('напоминание за 2 часа отправлено', ($rep['r2'] ?? 0) >= 1, $rep);
check('напоминание за сутки отправлено', ($rep['r24'] ?? 0) >= 1, $rep);
$first = array_values(array_filter(notify_lines(), fn ($n) => str_contains($n['text'] ?? '', 'отмените запись в кабинете до')));
check('в первом напоминании указан срок бесплатной отмены', count($first) >= 1, notify_lines());
$rep2 = json_decode((string) shell_exec('PR_CONFIG=' . escapeshellarg(__DIR__ . '/config.test.php') . ' php ' . escapeshellarg(__DIR__ . '/../site/api/cron.php')), true);
check('повторный запуск не шлёт дубли', ($rep2['r2'] ?? 1) === 0 && ($rep2['r24'] ?? 1) === 0, $rep2);

echo "Календарь\n";
$ch = curl_init(BASE . 'index.php?r=ics&t=' . $tA);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$ics = (string) curl_exec($ch);
check('файл календаря .ics собирается', str_contains($ics, 'BEGIN:VCALENDAR') && substr_count($ics, 'BEGIN:VEVENT') >= 3, substr($ics, 0, 200));

echo "Команда\n";
$r = api('staff/day', null, $tB);
check('без прав раздел команды закрыт', $r['code'] === 403, $r);
shell_exec('PR_CONFIG=' . escapeshellarg(__DIR__ . '/config.test.php') . ' php ' . escapeshellarg(__DIR__ . '/../site/api/setup.php') . ' staff 79001234567');
$r = api('staff/clients', null, $tA, '&q=' . rawurlencode('Борис'));
check('поиск клиента по имени', count($r['data']['clients'] ?? []) === 1, $r);
$r = api('staff/day', null, $tA, '&date=' . date('Y-m-d', strtotime(row('SELECT starts_at FROM events WHERE id = ?', [$tiny])['starts_at'])));
check('список встреч дня с гостями', count($r['data']['events'] ?? []) >= 1, $r);
$r = api('staff/event', ['format' => 'guest', 'title' => 'Павел Глоба', 'date' => date('Y-m-d', strtotime('+20 days')), 'time' => '17:00', 'repeat_weeks' => 1], $tA);
check('сотрудник добавляет встречу', !empty($r['data']['ids']), $r);
$cB = (int) val('SELECT id FROM clients WHERE telegram_id = 222');
$r = api('staff/sell', ['client_id' => $cB, 'plan' => 'club1', 'club' => 'lit', 'month' => next_month()], $tA);
check('продажа абонемента на месте', ($r['data']['ok'] ?? false) === true, $r);

echo "Правка расписания\n";
$date = date('Y-m-d', strtotime('+15 days'));
$r = api('staff/event', ['format' => 'lit', 'title' => 'Литературный клуб', 'date' => $date, 'time' => '18:00', 'repeat_weeks' => 3], $tA);
$ids = $r['data']['ids'] ?? [];
check('серия из трёх встреч создана', count($ids) === 3, $r);
api('book', ['event_id' => $ids[1]], $tB);
@unlink(cfg('notify_log'));
$ev0 = row('SELECT * FROM events WHERE id = ?', [$ids[0]]);
update('events', $ids[2], ['title' => 'Лавр, обсуждение']);
$r = api('staff/event_update', ['event_id' => $ids[0], 'apply' => 'series', 'format' => 'lit', 'title' => 'Литературный клуб', 'date' => $date, 'time' => '18:30', 'duration_min' => 120, 'capacity' => 40, 'included' => true], $tA);
check('время серии сдвинуто для всех трёх', ($r['data']['moved'] ?? 0) === 3 && substr(row('SELECT starts_at FROM events WHERE id = ?', [$ids[2]])['starts_at'], 11, 5) === '18:30', $r);
check('темы встреч серии не перезаписаны', row('SELECT title FROM events WHERE id = ?', [$ids[2]])['title'] === 'Лавр, обсуждение');
$moved = array_filter(notify_lines(), fn ($n) => str_contains($n['text'] ?? '', 'Встреча перенесена'));
check('записанному гостю пришло сообщение о переносе', count($moved) === 1, notify_lines());
$r = api('staff/event_update', ['event_id' => $ids[1], 'apply' => 'one', 'format' => 'lit', 'title' => 'Стоунер', 'host' => 'Анна Лебедева', 'date' => date('Y-m-d', strtotime($date . ' +7 days')), 'time' => '18:30', 'duration_min' => 120, 'capacity' => 40, 'included' => true], $tA);
check('тема одной встречи поменялась только у неё', row('SELECT title FROM events WHERE id = ?', [$ids[1]])['title'] === 'Стоунер' && row('SELECT title FROM events WHERE id = ?', [$ids[0]])['title'] === 'Литературный клуб', $r);
$r = api('staff/event_update', ['event_id' => $ids[0], 'format' => 'lit', 'title' => 'x', 'date' => $date, 'time' => '18:30'], $tB);
check('гость не может менять расписание', $r['code'] === 403, $r);

echo "Достижения\n";
$cA = (int) val('SELECT id FROM clients WHERE telegram_id = 111');
foreach ([-28, -20, -8] as $i => $h) {
    $pid = add_event(['lit', 'film', 'guest'][$i], $h);
    insert('bookings', ['client_id' => $cA, 'event_id' => $pid, 'status' => 'booked', 'paid_by' => 'single', 'created_at' => now(), 'updated_at' => now()]);
}
$r = api('achievements', null, $tA);
$ach = array_column($r['data']['achievements'] ?? [], null, 'code');
check('после первой встречи получена «Первая глава»', ($ach['first']['done'] ?? false) === true, $r);
check('прогресс считается по форматам', ($ach['formats']['progress'] ?? 0) === 3 && ($ach['formats']['done'] ?? true) === false, $ach['formats'] ?? null);
@unlink(cfg('notify_log'));
$rep = json_decode((string) shell_exec('PR_CONFIG=' . escapeshellarg(__DIR__ . '/config.test.php') . ' php ' . escapeshellarg(__DIR__ . '/../site/api/cron.php')), true);
// Несколько новых достижений приходят одним сообщением.
$congrats = array_filter(notify_lines(), fn ($n) => str_contains($n['text'] ?? '', 'Первая глава'));
check('бот поздравляет с достижением одним сообщением', ($rep['achievements'] ?? 0) >= 1 && count($congrats) === 1 && count(notify_lines()) === 1, [$rep, notify_lines()]);
$rep = json_decode((string) shell_exec('PR_CONFIG=' . escapeshellarg(__DIR__ . '/config.test.php') . ' php ' . escapeshellarg(__DIR__ . '/../site/api/cron.php')), true);
check('поздравление не повторяется', ($rep['achievements'] ?? 1) === 0, $rep);

echo "\nИтого: $passes прошло, $fails не прошло\n";
exit($fails ? 1 : 0);
