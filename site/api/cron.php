<?php
// Служебные задачи. Запускать каждые 15 минут:
//   php /путь/к/api/cron.php
// или через браузер/планировщик хостинга: https://сайт/api/cron.php?key=<cron_key>
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rules.php';
require __DIR__ . '/lib/notify.php';

require_cli_or_key();

$report = ['expired' => 0, 'r24' => 0, 'r2' => 0, 'ending' => 0, 'chat_removed' => 0];
$nowTs = time();

// 1. Не оплатили разовое посещение за 30 минут — освобождаем место.
$stale = rows("SELECT id, event_id, purchase_id FROM bookings WHERE status = 'pending_payment' AND updated_at < ?", [date('Y-m-d H:i:s', $nowTs - PAYMENT_HOLD_MIN * 60)]);
foreach ($stale as $b) {
    q("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?", [now(), $b['id']]);
    if ($b['purchase_id']) {
        q("UPDATE purchases SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [$b['purchase_id']]);
    }
    $ev = row('SELECT * FROM events WHERE id = ?', [$b['event_id']]);
    if ($ev && strtotime($ev['starts_at']) > $nowTs) {
        offer_seat_to_waitlist($ev);
    }
    $report['expired']++;
}

// 2. Напоминания о встречах: за сутки и за 2 часа.
$upcoming = rows(
    "SELECT b.id AS booking_id, e.id AS event_id, e.title, e.starts_at, e.format, c.*
     FROM bookings b JOIN events e ON e.id = b.event_id JOIN clients c ON c.id = b.client_id
     WHERE b.status = 'booked' AND e.cancelled = 0 AND e.starts_at > ? AND e.starts_at <= ?",
    [date('Y-m-d H:i:s', $nowTs), date('Y-m-d H:i:s', $nowTs + 30 * 3600 + 900)]
);
foreach ($upcoming as $r) {
    $c = $r + ['id' => $r['id']];
    $start = strtotime($r['starts_at']);
    $hours = ($start - $nowTs) / 3600;
    $when = WEEKDAYS[(int) date('w', $start)] . ', ' . human_date($r['starts_at']);
    $buttons = [['text' => 'Мои записи', 'app' => '#bookings']];
    if ($hours <= 2.25 && (int) $c['notify_2h']) {
        if (notify_once($c, 'r2', (string) $r['booking_id'], '<b>Через 2 часа:</b> ' . e($r['title']) . ".\nНачало в " . date('H:i', $start) . '. Чай уже заварен, ждём вас!', $buttons)) {
            $report['r2']++;
        }
    } elseif ($hours > 2.25 && (int) $c['notify_24h']) {
        // Первое напоминание приходит примерно за 30 часов: пока ещё можно отменить запись без списания.
        $text = '<b>Напоминаем о встрече:</b> ' . e($r['title']) . "\n" . $when . '.';
        if ($hours > FREE_CANCEL_HOURS + 0.2) {
            $text .= "\n\nЕсли планы поменялись, отмените запись в кабинете до " . human_date(date('Y-m-d H:i:s', $start - FREE_CANCEL_HOURS * 3600)) . ': тогда посещение не спишется.';
        } else {
            $text .= ' Ждём вас!';
        }
        if (notify_once($c, 'r24', (string) $r['booking_id'], $text, $buttons)) {
            $report['r24']++;
        }
    }
}

// 3. Абонемент заканчивается: за 3 дня до конца месяца и в последний день.
$daysLeft = (int) ((strtotime(month_last_day(current_month()) . ' 23:59:59') - $nowTs) / 86400);
$hour = (int) date('G');
if ($hour >= 11 && $hour < 21 && ($daysLeft === 3 || $daysLeft === 0)) {
    $kind = $daysLeft === 3 ? 'end3' : 'end0';
    $members = rows(
        "SELECT c.*, m.plan FROM memberships m JOIN clients c ON c.id = m.client_id
         WHERE m.month = ? AND m.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM memberships n WHERE n.client_id = m.client_id AND n.month = ? AND n.status = 'active')",
        [current_month(), next_month()]
    );
    foreach ($members as $c) {
        $text = $daysLeft === 3
            ? 'Ваш абонемент «' . e(PLANS[$c['plan']]['name']) . '» действует до ' . human_date(month_last_day(current_month()), false) . '. Продлите его на ' . month_label(next_month()) . ', чтобы не пропустить встречи.'
            : 'Сегодня последний день абонемента. Продлите его на ' . month_label(next_month()) . ', и записи на новый месяц будут по абонементу.';
        if (notify_once($c, $kind, current_month(), $text, [['text' => 'Продлить абонемент', 'app' => '#plans']])) {
            $report['ending']++;
        }
    }
}

// 4. Первого числа убираем из чата тех, у кого нет абонемента на новый месяц.
$chat = (string) cfg('telegram.members_chat_id');
if ($chat !== '' && (int) date('j') === 1 && $hour >= 10 && !val("SELECT id FROM notifications WHERE client_id = 0 AND kind = 'chatclean' AND ref_id = ?", [current_month()])) {
    insert('notifications', ['client_id' => 0, 'kind' => 'chatclean', 'ref_id' => current_month(), 'sent_at' => now()]);
    $gone = rows(
        "SELECT c.* FROM clients c WHERE c.in_chat = 1 AND c.telegram_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.client_id = c.id AND m.month = ? AND m.status = 'active')",
        [current_month()]
    );
    foreach ($gone as $c) {
        tg('banChatMember', ['chat_id' => $chat, 'user_id' => (int) $c['telegram_id'], 'until_date' => $nowTs + 60]);
        tg('unbanChatMember', ['chat_id' => $chat, 'user_id' => (int) $c['telegram_id'], 'only_if_banned' => true]);
        update('clients', (int) $c['id'], ['in_chat' => 0]);
        notify_client($c, 'Абонемент закончился, поэтому доступ в чат держателей карты закрыт. Оформите абонемент, и бот снова пустит вас в чат.', [['text' => 'Абонементы', 'app' => '#plans']]);
        $report['chat_removed']++;
    }
}

if (PHP_SAPI === 'cli') {
    echo json_encode($report, JSON_UNESCAPED_UNICODE) . "\n";
} else {
    json_out($report);
}
