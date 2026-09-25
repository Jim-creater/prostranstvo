<?php
// Правила Пространства: форматы, абонементы и что входит в каждый.
declare(strict_types=1);

const FORMATS = [
    'lit'     => ['name' => 'Литературный клуб',          'group' => 'club'],
    'script'  => ['name' => 'Сценарный клуб',             'group' => 'club'],
    'guest'   => ['name' => 'Специальный гость',          'group' => 'weekend'],
    'film'    => ['name' => 'Кино',                       'group' => 'weekend'],
    'costume' => ['name' => 'История костюма',            'group' => 'costume'],
    'art'     => ['name' => 'Рисунок и история искусств', 'group' => 'art'],
];

// Абонемент действует календарный месяц, неиспользованные посещения сгорают, заморозки нет.
const PLANS = [
    'club1' => ['name' => 'Один клуб',        'price' => 3500,  'clubs' => 1, 'weekend' => 2, 'costume' => 0, 'art' => 0],
    'clubs' => ['name' => 'Клубы и гости',    'price' => 6500,  'clubs' => 2, 'weekend' => 4, 'costume' => 0, 'art' => 0],
    'all'   => ['name' => 'Всё Пространство', 'price' => 12000, 'clubs' => 2, 'weekend' => 6, 'costume' => 2, 'art' => 4],
];

const GROUP_LABELS = [
    'weekend' => 'Выходные: гости и кино',
    'costume' => 'История костюма',
    'art'     => 'Рисунок',
];

// Эти статусы расходуют посещение по абонементу. Поздняя отмена (меньше чем за сутки) тоже.
const COUNTED_STATUSES = ['booked', 'attended', 'noshow', 'late_cancel'];

// Сколько минут держим место за тем, кто перешёл к оплате разового посещения.
const PAYMENT_HOLD_MIN = 30;

// Отмена без списания — не позже чем за столько часов до начала.
const FREE_CANCEL_HOURS = 24;

const MONTHS_NOM = ['', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function format_group(string $format): string
{
    return FORMATS[$format]['group'] ?? 'weekend';
}

function month_of(string $datetime): string
{
    return substr($datetime, 0, 7);
}

function current_month(): string
{
    return date('Y-m');
}

function next_month(): string
{
    return date('Y-m', strtotime('first day of next month'));
}

function month_label(string $ym): string
{
    return MONTHS_NOM[(int) substr($ym, 5, 2)];
}

function month_last_day(string $ym): string
{
    return date('Y-m-t', strtotime($ym . '-01'));
}

// «25 сентября, 19:30»
function human_date(string $datetime, bool $withTime = true): string
{
    $t = strtotime($datetime);
    $s = (int) date('j', $t) . ' ' . MONTHS_GEN[(int) date('n', $t)];
    return $withTime ? $s . ', ' . date('H:i', $t) : $s;
}

function single_price(array $event): int
{
    return (int) ($event['price'] ?? 0) ?: (int) cfg('single_price');
}

function active_membership(int $clientId, string $month): ?array
{
    return row("SELECT * FROM memberships WHERE client_id = ? AND month = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [$clientId, $month]);
}

// Сколько посещений группы (выходные, мода, рисунок) уже израсходовано по абонементу.
function used_count(int $membershipId, string $group, int $excludeBookingId = 0): int
{
    $formats = array_keys(array_filter(FORMATS, fn ($f) => $f['group'] === $group));
    if (!$formats) {
        return 0;
    }
    $in = implode(',', array_fill(0, count($formats), '?'));
    $st = implode(',', array_fill(0, count(COUNTED_STATUSES), '?'));
    return (int) val(
        "SELECT COUNT(*) FROM bookings b JOIN events e ON e.id = b.event_id
         WHERE b.membership_id = ? AND b.paid_by = 'membership' AND b.id <> ? AND e.format IN ($in) AND b.status IN ($st)",
        [$membershipId, $excludeBookingId, ...$formats, ...COUNTED_STATUSES]
    );
}

function plan_clubs(array $membership): array
{
    $plan = PLANS[$membership['plan']];
    return $plan['clubs'] >= 2 ? ['lit', 'script'] : [$membership['club']];
}

// Входит ли встреча в абонемент клиента. Возвращает тип покрытия и подпись для кабинета.
function coverage(int $clientId, array $event, int $excludeBookingId = 0): array
{
    $price = single_price($event);
    $single = ['type' => 'single', 'price' => $price, 'note' => 'Разовое посещение — ' . number_format($price, 0, '', ' ') . ' ₽'];
    if (!(int) $event['included']) {
        return $single + ['reason' => 'Встреча не входит в абонементы'];
    }
    $m = active_membership($clientId, month_of($event['starts_at']));
    if (!$m) {
        return $single;
    }
    $group = format_group($event['format']);
    $plan = PLANS[$m['plan']];
    if ($group === 'club') {
        if (in_array($event['format'], plan_clubs($m), true)) {
            return ['type' => 'membership', 'membership_id' => (int) $m['id'], 'note' => 'Входит в ваш абонемент'];
        }
        return $single + ['reason' => 'Этот клуб не входит в ваш абонемент'];
    }
    $limit = (int) $plan[$group];
    if ($limit === 0) {
        return $single + ['reason' => 'Не входит в ваш абонемент'];
    }
    $used = used_count((int) $m['id'], $group, $excludeBookingId);
    if ($used < $limit) {
        $left = $limit - $used - 1;
        return [
            'type' => 'membership', 'membership_id' => (int) $m['id'],
            'note' => 'По абонементу · останется ' . $left . ' из ' . $limit,
        ];
    }
    return $single + ['reason' => 'Посещения по абонементу закончились: ' . $limit . ' из ' . $limit];
}

// Сколько мест занято (с учётом тех, кто сейчас оплачивает разовое посещение).
function seats_taken(int $eventId): int
{
    $hold = date('Y-m-d H:i:s', time() - PAYMENT_HOLD_MIN * 60);
    return (int) val(
        "SELECT COUNT(*) FROM bookings WHERE event_id = ? AND (status IN ('booked','attended','noshow') OR (status = 'pending_payment' AND updated_at >= ?))",
        [$eventId, $hold]
    );
}

// Использование абонемента для кабинета: «Выходные: 1 из 4» и т. д.
function membership_usage(array $m): array
{
    $plan = PLANS[$m['plan']];
    $items = [];
    $clubs = plan_clubs($m);
    $items[] = [
        'label' => count($clubs) === 2 ? 'Литературный и сценарный клубы' : FORMATS[$clubs[0]]['name'],
        'unlimited' => true,
    ];
    foreach (['weekend', 'costume', 'art'] as $group) {
        if ($plan[$group] > 0) {
            $items[] = ['label' => GROUP_LABELS[$group], 'used' => used_count((int) $m['id'], $group), 'limit' => $plan[$group]];
        }
    }
    return [
        'id' => (int) $m['id'], 'plan' => $m['plan'], 'name' => $plan['name'], 'month' => $m['month'],
        'month_label' => month_label($m['month']), 'ends' => human_date(month_last_day($m['month']), false),
        'club' => $m['club'], 'items' => $items,
    ];
}

function event_public(array $e, ?int $clientId = null): array
{
    $taken = seats_taken((int) $e['id']);
    $out = [
        'id' => (int) $e['id'], 'format' => $e['format'], 'format_name' => FORMATS[$e['format']]['name'] ?? $e['format'],
        'title' => $e['title'], 'host' => $e['host'], 'description' => $e['description'] ?? '',
        'starts_at' => $e['starts_at'], 'duration_min' => (int) $e['duration_min'],
        'capacity' => (int) $e['capacity'], 'left' => max(0, (int) $e['capacity'] - $taken),
        'included' => (bool) (int) $e['included'], 'price' => single_price($e),
        // До этого момента запись можно отменить без списания.
        'free_cancel_until' => human_date(date('Y-m-d H:i:s', strtotime($e['starts_at']) - FREE_CANCEL_HOURS * 3600)),
        'free_cancel' => time() <= strtotime($e['starts_at']) - FREE_CANCEL_HOURS * 3600,
    ];
    if ($clientId) {
        $b = row('SELECT id, status, paid_by FROM bookings WHERE client_id = ? AND event_id = ?', [$clientId, $e['id']]);
        $out['my_status'] = $b ? $b['status'] : null;
        $out['booking_id'] = $b ? (int) $b['id'] : null;
        $out['paid_by'] = $b ? $b['paid_by'] : null;
        $out['cover'] = in_array($out['my_status'], ['booked', 'attended'], true) ? null : coverage($clientId, $e);
    }
    return $out;
}
