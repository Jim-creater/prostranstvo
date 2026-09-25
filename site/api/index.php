<?php
// API личного кабинета. Все запросы: index.php?r=<раздел>
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rules.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/notify.php';
require __DIR__ . '/lib/payments.php';

$route = (string) ($_GET['r'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    switch ($route) {

        // ---------- вход ----------
        case 'auth/telegram': {
            $user = verify_webapp_init_data((string) (body()['initData'] ?? ''), (string) cfg('telegram.token'));
            if (!$user) {
                fail('Не удалось подтвердить вход через Telegram', 401);
            }
            $c = client_from_telegram($user);
            json_out(['token' => create_session((int) $c['id']), 'client' => client_public($c)]);
        }
        case 'auth/widget': {
            $user = verify_login_widget(body(), (string) cfg('telegram.token'));
            if (!$user) {
                fail('Не удалось подтвердить вход через Telegram', 401);
            }
            $c = client_from_telegram($user);
            json_out(['token' => create_session((int) $c['id']), 'client' => client_public($c)]);
        }
        case 'auth/dev': {
            // Только для разработки: вход без Telegram.
            if (!cfg('dev_login')) {
                fail('Недоступно', 404);
            }
            $tgId = (int) (body()['telegram_id'] ?? 0) ?: 1000;
            $c = client_from_telegram(['id' => $tgId, 'first_name' => (string) (body()['name'] ?? 'Гость')]);
            json_out(['token' => create_session((int) $c['id']), 'client' => client_public($c)]);
        }
        case 'auth/logout': {
            q('DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', bearer_token())]);
            json_out(['ok' => true]);
        }

        // ---------- профиль ----------
        case 'me': {
            $c = require_client();
            if ($method === 'POST') {
                $b = body();
                $data = [];
                if (isset($b['name'])) {
                    $name = trim((string) $b['name']);
                    if ($name === '' || mb_strlen($name) > 120) {
                        fail('Укажите имя');
                    }
                    $data['name'] = $name;
                }
                if (isset($b['phone'])) {
                    $phone = normalize_phone((string) $b['phone']);
                    if (!$phone) {
                        fail('Проверьте номер телефона: нужен российский номер, например +7 900 000-00-00');
                    }
                    $data['phone'] = $phone;
                }
                if (!empty($b['consent_pd']) && !$c['consent_pd_at']) {
                    $data['consent_pd_at'] = now();
                }
                foreach (['consent_news', 'notify_tg', 'notify_max', 'notify_24h', 'notify_2h'] as $flag) {
                    if (array_key_exists($flag, $b)) {
                        $data[$flag] = $b[$flag] ? 1 : 0;
                    }
                }
                if ($data) {
                    update('clients', (int) $c['id'], $data);
                }
                $c = row('SELECT * FROM clients WHERE id = ?', [$c['id']]);
            }
            $cur = active_membership((int) $c['id'], current_month());
            $next = active_membership((int) $c['id'], next_month());
            $nextBooking = row(
                "SELECT e.*, b.id AS booking_id, b.status AS my_status FROM bookings b JOIN events e ON e.id = b.event_id
                 WHERE b.client_id = ? AND b.status IN ('booked','waitlist','pending_payment') AND e.starts_at >= ? AND e.cancelled = 0
                 ORDER BY e.starts_at LIMIT 1",
                [$c['id'], date('Y-m-d H:i:s', time() - 3 * 3600)]
            );
            if (!$c['max_link_token'] && cfg('max.enabled')) {
                $token = random_token(12);
                update('clients', (int) $c['id'], ['max_link_token' => $token]);
                $c['max_link_token'] = $token;
            }
            json_out([
                'client' => client_public($c),
                'membership' => $cur ? membership_usage($cur) : null,
                'next_membership' => $next ? membership_usage($next) : null,
                'month' => ['current' => current_month(), 'current_label' => month_label(current_month()), 'next' => next_month(), 'next_label' => month_label(next_month()), 'ends' => human_date(month_last_day(current_month()), false)],
                'next_booking' => $nextBooking ? event_public($nextBooking, (int) $c['id']) : null,
                'links' => [
                    'telegram_bot' => cfg('telegram.bot_username') ? 'https://t.me/' . cfg('telegram.bot_username') : null,
                    'max_bot' => cfg('max.enabled') && cfg('max.bot_link') ? cfg('max.bot_link') . '?start=' . $c['max_link_token'] : null,
                    'members_chat' => $cur && cfg('telegram.members_chat_invite') ? cfg('telegram.members_chat_invite') : null,
                ],
            ]);
        }

        // ---------- расписание ----------
        case 'events': {
            $c = current_client();
            $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_GET['from'] ?? '')) ? $_GET['from'] : date('Y-m-d');
            $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_GET['to'] ?? '')) ? $_GET['to'] : date('Y-m-d', strtotime('+35 days'));
            $list = rows(
                'SELECT * FROM events WHERE cancelled = 0 AND starts_at >= ? AND starts_at <= ? AND starts_at >= ? ORDER BY starts_at',
                [$from . ' 00:00:00', $to . ' 23:59:59', date('Y-m-d H:i:s', time() - 3600)]
            );
            json_out(['events' => array_map(fn ($e) => event_public($e, $c ? (int) $c['id'] : null), $list)]);
        }

        // ---------- запись ----------
        case 'book': {
            $c = require_client();
            $ev = row('SELECT * FROM events WHERE id = ? AND cancelled = 0', [(int) (body()['event_id'] ?? 0)]);
            if (!$ev) {
                fail('Встреча не найдена');
            }
            if (strtotime($ev['starts_at']) < time()) {
                fail('Эта встреча уже началась');
            }
            $existing = row('SELECT * FROM bookings WHERE client_id = ? AND event_id = ?', [$c['id'], $ev['id']]);
            // Из листа ожидания можно записаться повторным нажатием, когда место освободилось.
            if ($existing && in_array($existing['status'], ['booked', 'attended'], true)) {
                json_out(['status' => $existing['status'], 'event' => event_public($ev, (int) $c['id'])]);
            }
            $save = function (array $data) use ($existing, $c, $ev): int {
                $data['updated_at'] = now();
                if ($existing && $existing['status'] === 'pending_payment' && $existing['purchase_id']) {
                    q("UPDATE purchases SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [$existing['purchase_id']]);
                }
                if ($existing) {
                    update('bookings', (int) $existing['id'], $data + ['refund_due' => 0]);
                    return (int) $existing['id'];
                }
                return insert('bookings', $data + ['client_id' => (int) $c['id'], 'event_id' => (int) $ev['id'], 'created_at' => now()]);
            };
            $cov = coverage((int) $c['id'], $ev, $existing ? (int) $existing['id'] : 0);
            $taken = seats_taken((int) $ev['id']) - ($existing && $existing['status'] === 'pending_payment' ? 1 : 0);
            if ($taken >= (int) $ev['capacity']) {
                $save(['status' => 'waitlist', 'paid_by' => null, 'membership_id' => null, 'purchase_id' => null]);
                json_out(['status' => 'waitlist', 'event' => event_public($ev, (int) $c['id'])]);
            }
            if ($cov['type'] === 'membership') {
                $save(['status' => 'booked', 'paid_by' => 'membership', 'membership_id' => $cov['membership_id'], 'purchase_id' => null]);
                json_out(['status' => 'booked', 'event' => event_public($ev, (int) $c['id'])]);
            }
            // Разовое посещение: держим место на время оплаты.
            if (!$c['phone']) {
                fail('Укажите телефон в профиле: на него придёт чек', 409);
            }
            $pid = insert('purchases', [
                'client_id' => (int) $c['id'], 'kind' => 'single', 'amount' => (int) $cov['price'], 'status' => 'pending',
                'provider' => (string) cfg('payments.provider'), 'description' => 'Посещение: ' . $ev['title'] . ', ' . human_date($ev['starts_at']),
                'created_at' => now(),
            ]);
            $save(['status' => 'pending_payment', 'paid_by' => 'single', 'membership_id' => null, 'purchase_id' => $pid]);
            json_out(['status' => 'payment_required', 'payment_url' => create_payment($pid, $c, '#bookings'), 'amount' => (int) $cov['price']]);
        }

        case 'cancel': {
            $c = require_client();
            $b = row('SELECT * FROM bookings WHERE id = ? AND client_id = ?', [(int) (body()['booking_id'] ?? 0), $c['id']]);
            if (!$b || !in_array($b['status'], ['booked', 'waitlist', 'pending_payment'], true)) {
                fail('Запись не найдена');
            }
            $ev = row('SELECT * FROM events WHERE id = ?', [$b['event_id']]);
            $hoursLeft = (strtotime($ev['starts_at']) - time()) / 3600;
            $returned = true;
            if ($b['status'] === 'booked') {
                if ($hoursLeft >= FREE_CANCEL_HOURS) {
                    q("UPDATE bookings SET status = 'cancelled', refund_due = ?, updated_at = ? WHERE id = ?", [$b['paid_by'] === 'single' ? 1 : 0, now(), $b['id']]);
                } else {
                    // Меньше чем за сутки: посещение списывается.
                    q("UPDATE bookings SET status = 'late_cancel', updated_at = ? WHERE id = ?", [now(), $b['id']]);
                    $returned = false;
                }
                offer_seat_to_waitlist($ev);
            } else {
                q("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?", [now(), $b['id']]);
                if ($b['purchase_id']) {
                    q("UPDATE purchases SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [$b['purchase_id']]);
                }
                // Неоплаченная запись тоже держала место.
                if ($b['status'] === 'pending_payment') {
                    offer_seat_to_waitlist($ev);
                }
            }
            json_out(['ok' => true, 'returned' => $returned, 'refund' => $returned && $b['paid_by'] === 'single' && $b['status'] === 'booked']);
        }

        case 'bookings': {
            $c = require_client();
            $list = rows(
                "SELECT e.*, b.id AS booking_id, b.status AS b_status FROM bookings b JOIN events e ON e.id = b.event_id
                 WHERE b.client_id = ? AND b.status <> 'cancelled' ORDER BY e.starts_at",
                [$c['id']]
            );
            $upcoming = $past = [];
            $border = date('Y-m-d H:i:s', time() - 2 * 3600);
            foreach ($list as $e) {
                $item = event_public($e, (int) $c['id']);
                if ($e['starts_at'] >= $border && $e['b_status'] !== 'late_cancel') {
                    $upcoming[] = $item;
                } elseif ($e['starts_at'] < $border) {
                    $past[] = $item;
                }
            }
            json_out(['upcoming' => $upcoming, 'past' => array_reverse($past)]);
        }

        // ---------- абонементы ----------
        case 'plans': {
            $plans = [];
            foreach (PLANS as $key => $p) {
                $plans[] = ['key' => $key] + $p;
            }
            json_out([
                'plans' => $plans, 'single_price' => (int) cfg('single_price'),
                'months' => [
                    ['key' => current_month(), 'label' => month_label(current_month()), 'ends' => human_date(month_last_day(current_month()), false)],
                    ['key' => next_month(), 'label' => month_label(next_month()), 'ends' => human_date(month_last_day(next_month()), false)],
                ],
            ]);
        }

        case 'buy': {
            $c = require_client();
            $b = body();
            $planKey = (string) ($b['plan'] ?? '');
            $month = (string) ($b['month'] ?? '');
            if (!isset(PLANS[$planKey])) {
                fail('Выберите абонемент');
            }
            if (!in_array($month, [current_month(), next_month()], true)) {
                fail('Абонемент можно купить на текущий или следующий месяц');
            }
            $club = null;
            if (PLANS[$planKey]['clubs'] === 1) {
                $club = (string) ($b['club'] ?? '');
                if (!in_array($club, ['lit', 'script'], true)) {
                    fail('Выберите клуб: литературный или сценарный');
                }
            }
            if (active_membership((int) $c['id'], $month)) {
                fail('На ' . month_label($month) . ' у вас уже есть абонемент');
            }
            if (!$c['phone']) {
                fail('Укажите телефон в профиле: на него придёт чек', 409);
            }
            $plan = PLANS[$planKey];
            $pid = insert('purchases', [
                'client_id' => (int) $c['id'], 'kind' => 'membership', 'amount' => $plan['price'], 'status' => 'pending',
                'provider' => (string) cfg('payments.provider'),
                'description' => 'Абонемент «' . $plan['name'] . '» на ' . month_label($month), 'created_at' => now(),
            ]);
            insert('memberships', [
                'client_id' => (int) $c['id'], 'plan' => $planKey, 'month' => $month, 'club' => $club,
                'status' => 'pending', 'price' => $plan['price'], 'purchase_id' => $pid, 'created_at' => now(),
            ]);
            json_out(['payment_url' => create_payment($pid, $c, '#home'), 'purchase_id' => $pid]);
        }

        case 'purchase': {
            $c = require_client();
            $p = row('SELECT id, kind, status, amount FROM purchases WHERE id = ? AND client_id = ?', [(int) ($_GET['id'] ?? 0), $c['id']]);
            if (!$p) {
                fail('Платёж не найден', 404);
            }
            $m = $p['kind'] === 'membership' ? row('SELECT * FROM memberships WHERE purchase_id = ?', [$p['id']]) : null;
            json_out($p + ['membership' => $m && $m['status'] === 'active' ? membership_usage($m) : null]);
        }

        // Тестовая оплата: сразу считаем оплаченным. Работает только при provider = test.
        case 'pay/test': {
            if (cfg('payments.provider') !== 'test') {
                fail('Недоступно', 404);
            }
            mark_paid((int) ($_GET['purchase'] ?? 0));
            header('Location: ' . app_link((string) ($_GET['back'] ?? ''), ['purchase' => (int) ($_GET['purchase'] ?? 0)]));
            exit;
        }

        // ---------- календарь: файл .ics для телефона ----------
        case 'ics': {
            $c = require_client();
            $where = isset($_GET['booking']) ? 'AND b.id = ' . (int) $_GET['booking'] : '';
            $list = rows(
                "SELECT e.* FROM bookings b JOIN events e ON e.id = b.event_id
                 WHERE b.client_id = ? AND b.status IN ('booked','attended') AND e.starts_at >= ? $where ORDER BY e.starts_at",
                [$c['id'], date('Y-m-d H:i:s', time() - 86400)]
            );
            header('Content-Type: text/calendar; charset=utf-8');
            header('Content-Disposition: attachment; filename="prostranstvo.ics"');
            echo build_ics($list);
            exit;
        }

        // ---------- команда ----------
        case 'staff/day': {
            require_staff();
            $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_GET['date'] ?? '')) ? $_GET['date'] : date('Y-m-d');
            $events = rows('SELECT * FROM events WHERE cancelled = 0 AND starts_at >= ? AND starts_at <= ? ORDER BY starts_at', [$date . ' 00:00:00', $date . ' 23:59:59']);
            $out = [];
            foreach ($events as $e) {
                $people = rows(
                    "SELECT b.id AS booking_id, b.status, b.paid_by, c.id AS client_id, c.name, c.phone FROM bookings b JOIN clients c ON c.id = b.client_id
                     WHERE b.event_id = ? AND b.status IN ('booked','attended','noshow','waitlist') ORDER BY b.status = 'waitlist', c.name",
                    [$e['id']]
                );
                $out[] = event_public($e) + ['people' => $people];
            }
            json_out(['date' => $date, 'events' => $out]);
        }
        case 'staff/attend': {
            require_staff();
            $b = body();
            $status = !empty($b['attended']) ? 'attended' : 'booked';
            q("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND status IN ('booked','attended','noshow')", [$status, now(), (int) ($b['booking_id'] ?? 0)]);
            json_out(['ok' => true, 'status' => $status]);
        }
        case 'staff/event': {
            require_staff();
            $b = body();
            if (!isset(FORMATS[$b['format'] ?? ''])) {
                fail('Выберите формат');
            }
            $title = trim((string) ($b['title'] ?? ''));
            if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($b['date'] ?? '')) || !preg_match('/^\d{2}:\d{2}$/', (string) ($b['time'] ?? ''))) {
                fail('Заполните название, дату и время');
            }
            $weeks = max(1, min(26, (int) ($b['repeat_weeks'] ?? 1)));
            $ids = [];
            for ($i = 0; $i < $weeks; $i++) {
                $ids[] = insert('events', [
                    'format' => $b['format'], 'title' => $title, 'host' => trim((string) ($b['host'] ?? '')),
                    'description' => trim((string) ($b['description'] ?? '')),
                    'starts_at' => date('Y-m-d H:i:s', strtotime($b['date'] . ' ' . $b['time'] . " +$i week")),
                    'duration_min' => max(30, (int) ($b['duration_min'] ?? 120)),
                    'capacity' => max(1, (int) ($b['capacity'] ?? cfg('capacity'))),
                    'price' => ($b['price'] ?? '') !== '' ? (int) $b['price'] : null,
                    'included' => isset($b['included']) ? ((int) (bool) $b['included']) : 1,
                    'created_at' => now(),
                ]);
            }
            json_out(['ok' => true, 'ids' => $ids]);
        }
        case 'staff/event_cancel': {
            require_staff();
            $id = (int) (body()['event_id'] ?? 0);
            $ev = row('SELECT * FROM events WHERE id = ?', [$id]);
            if (!$ev) {
                fail('Встреча не найдена');
            }
            update('events', $id, ['cancelled' => 1]);
            foreach (rows("SELECT b.*, c.telegram_id, c.max_user_id, c.notify_tg, c.notify_max, c.id AS cid FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.event_id = ? AND b.status IN ('booked','waitlist','pending_payment')", [$id]) as $b) {
                q("UPDATE bookings SET status = 'cancelled', refund_due = ?, updated_at = ? WHERE id = ?", [$b['paid_by'] === 'single' && $b['status'] === 'booked' ? 1 : 0, now(), $b['id']]);
                $cl = row('SELECT * FROM clients WHERE id = ?', [$b['cid']]);
                notify_client($cl, 'К сожалению, встреча «' . e($ev['title']) . '» ' . human_date($ev['starts_at']) . ' отменяется. Посещение по абонементу вернулось, а за разовое посещение мы вернём деньги.', [['text' => 'Выбрать другую встречу', 'app' => '#schedule']]);
            }
            json_out(['ok' => true]);
        }
        case 'staff/clients': {
            require_staff();
            $qs = trim((string) ($_GET['q'] ?? ''));
            $digits = preg_replace('/\D+/', '', $qs);
            $like = '%' . $qs . '%';
            $list = rows(
                'SELECT id, name, phone, tg_username FROM clients WHERE name LIKE ? OR tg_username LIKE ? ' . ($digits !== '' ? 'OR phone LIKE ? ' : '') . 'ORDER BY id DESC LIMIT 30',
                $digits !== '' ? [$like, $like, '%' . $digits . '%'] : [$like, $like]
            );
            foreach ($list as &$r) {
                $m = active_membership((int) $r['id'], current_month());
                $r['membership'] = $m ? PLANS[$m['plan']]['name'] : null;
            }
            json_out(['clients' => $list]);
        }
        case 'staff/client': {
            require_staff();
            $c = row('SELECT * FROM clients WHERE id = ?', [(int) ($_GET['id'] ?? 0)]);
            if (!$c) {
                fail('Клиент не найден', 404);
            }
            $ms = rows("SELECT * FROM memberships WHERE client_id = ? AND status = 'active' ORDER BY month DESC LIMIT 6", [$c['id']]);
            $bookings = rows('SELECT b.status, e.title, e.starts_at FROM bookings b JOIN events e ON e.id = b.event_id WHERE b.client_id = ? ORDER BY e.starts_at DESC LIMIT 20', [$c['id']]);
            $purchases = rows("SELECT kind, amount, status, provider, description, paid_at FROM purchases WHERE client_id = ? ORDER BY id DESC LIMIT 20", [$c['id']]);
            json_out(['client' => client_public($c) + ['note' => $c['note'], 'created_at' => $c['created_at']], 'memberships' => array_map('membership_usage', $ms), 'bookings' => $bookings, 'purchases' => $purchases]);
        }
        case 'staff/sell': {
            // Продажа абонемента на месте (наличные или терминал).
            require_staff();
            $b = body();
            $client = row('SELECT * FROM clients WHERE id = ?', [(int) ($b['client_id'] ?? 0)]);
            $planKey = (string) ($b['plan'] ?? '');
            $month = (string) ($b['month'] ?? current_month());
            if (!$client || !isset(PLANS[$planKey]) || !in_array($month, [current_month(), next_month()], true)) {
                fail('Проверьте клиента, абонемент и месяц');
            }
            $club = PLANS[$planKey]['clubs'] === 1 ? (string) ($b['club'] ?? '') : null;
            if ($club !== null && !in_array($club, ['lit', 'script'], true)) {
                fail('Выберите клуб');
            }
            if (active_membership((int) $client['id'], $month)) {
                fail('На этот месяц у клиента уже есть абонемент');
            }
            $pid = insert('purchases', [
                'client_id' => (int) $client['id'], 'kind' => 'membership', 'amount' => PLANS[$planKey]['price'], 'status' => 'pending',
                'provider' => 'cash', 'description' => 'Абонемент «' . PLANS[$planKey]['name'] . '» на ' . month_label($month) . ' (на месте)', 'created_at' => now(),
            ]);
            insert('memberships', ['client_id' => (int) $client['id'], 'plan' => $planKey, 'month' => $month, 'club' => $club, 'status' => 'pending', 'price' => PLANS[$planKey]['price'], 'purchase_id' => $pid, 'created_at' => now()]);
            mark_paid($pid);
            json_out(['ok' => true]);
        }
        case 'staff/note': {
            require_staff();
            update('clients', (int) (body()['client_id'] ?? 0), ['note' => mb_substr((string) (body()['note'] ?? ''), 0, 2000)]);
            json_out(['ok' => true]);
        }

        default:
            fail('Неизвестный запрос', 404);
    }
} catch (Throwable $ex) {
    log_msg($ex->getMessage() . ' @ ' . $ex->getFile() . ':' . $ex->getLine());
    fail('Что-то пошло не так. Попробуйте ещё раз.', 500);
}

// Файл календаря со встречами клиента.
function build_ics(array $events): string
{
    $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prostranstvo//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    foreach ($events as $e) {
        $start = strtotime($e['starts_at']);
        $end = $start + (int) $e['duration_min'] * 60;
        $lines[] = 'BEGIN:VEVENT';
        $lines[] = 'UID:event-' . $e['id'] . '@prostranstvo';
        $lines[] = 'DTSTAMP:' . gmdate('Ymd\THis\Z');
        $lines[] = 'DTSTART:' . gmdate('Ymd\THis\Z', $start);
        $lines[] = 'DTEND:' . gmdate('Ymd\THis\Z', $end);
        $lines[] = 'SUMMARY:' . ics_escape($e['title'] . ' · Пространство');
        $lines[] = 'DESCRIPTION:' . ics_escape((FORMATS[$e['format']]['name'] ?? '') . ($e['host'] ? '. ' . $e['host'] : ''));
        $lines[] = 'BEGIN:VALARM';
        $lines[] = 'TRIGGER:-PT2H';
        $lines[] = 'ACTION:DISPLAY';
        $lines[] = 'DESCRIPTION:' . ics_escape($e['title']);
        $lines[] = 'END:VALARM';
        $lines[] = 'END:VEVENT';
    }
    $lines[] = 'END:VCALENDAR';
    return implode("\r\n", $lines) . "\r\n";
}

function ics_escape(string $s): string
{
    return str_replace(["\\", ';', ',', "\n"], ['\\\\', '\\;', '\\,', '\\n'], $s);
}
