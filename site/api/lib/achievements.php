<?php
// Достижения гостя. Считаются по посещениям и абонементам, отдельная таблица не нужна:
// о полученном достижении бот пишет один раз, отметка хранится в notifications (kind = 'ach').
declare(strict_types=1);

// код => [название, за что, что считаем, сколько нужно]
const ACHIEVEMENTS = [
    'first'    => ['Первая глава',      'Первая встреча в Пространстве',      'visits',  1],
    'lit'      => ['Книжный червь',     '5 встреч литературного клуба',       'lit',     5],
    'script'   => ['Автор сценария',    '5 встреч сценарного клуба',          'script',  5],
    'film'     => ['Киноман',           '5 кинопоказов',                      'film',    5],
    'guest'    => ['Собеседник',        '3 встречи со специальными гостями',  'guest',   3],
    'costume'  => ['Свой стиль',        '2 занятия по истории костюма',       'costume', 2],
    'art'      => ['С натуры',          '4 занятия рисунком',                 'art',     4],
    'formats'  => ['Полный круг',       'Побывать на всех шести форматах',    'formats', 6],
    'week'     => ['Насыщенная неделя', '3 встречи за одну неделю',           'week',    3],
    'regular'  => ['Завсегдатай',       '20 встреч в Пространстве',           'visits',  20],
    'season'   => ['Сезон',             'Абонемент три месяца подряд',        'streak',  3],
    'halfyear' => ['Полгода вместе',    'Абонемент шесть месяцев',            'months',  6],
];

// Считаем встречи, которые уже закончились. Если сотрудник не отметил гостя, встреча всё равно засчитывается;
// не засчитываются только отмены и отметка «не пришёл».
function achievement_stats(int $clientId): array
{
    $st = ['visits' => 0, 'formats' => 0, 'week' => 0, 'months' => 0, 'streak' => 0] + array_fill_keys(array_keys(FORMATS), 0);
    $formats = $weeks = [];
    $nowTs = time();
    $list = rows(
        "SELECT e.format, e.starts_at, e.duration_min FROM bookings b JOIN events e ON e.id = b.event_id
         WHERE b.client_id = ? AND e.cancelled = 0 AND b.status IN ('attended', 'booked') AND e.starts_at < ?",
        [$clientId, now()]
    );
    foreach ($list as $v) {
        $start = strtotime($v['starts_at']);
        if ($start + (int) $v['duration_min'] * 60 > $nowTs) {
            continue;
        }
        $st['visits']++;
        $st[$v['format']] = ($st[$v['format']] ?? 0) + 1;
        $formats[$v['format']] = true;
        $w = date('o-W', $start);
        $weeks[$w] = ($weeks[$w] ?? 0) + 1;
    }
    $st['formats'] = count($formats);
    $st['week'] = $weeks ? max($weeks) : 0;

    $months = array_column(rows("SELECT DISTINCT month FROM memberships WHERE client_id = ? AND status = 'active' AND month <= ? ORDER BY month", [$clientId, current_month()]), 'month');
    $st['months'] = count($months);
    $run = 0;
    $prev = null;
    foreach ($months as $m) {
        $run = ($prev !== null && date('Y-m', strtotime($prev . '-01 +1 month')) === $m) ? $run + 1 : 1;
        $st['streak'] = max($st['streak'], $run);
        $prev = $m;
    }
    return $st;
}

function client_achievements(int $clientId): array
{
    $st = achievement_stats($clientId);
    $earned = [];
    foreach (rows("SELECT ref_id, sent_at FROM notifications WHERE client_id = ? AND kind = 'ach'", [$clientId]) as $n) {
        $earned[$n['ref_id']] = $n['sent_at'];
    }
    $out = [];
    foreach (ACHIEVEMENTS as $code => [$title, $text, $metric, $goal]) {
        $value = min($goal, (int) ($st[$metric] ?? 0));
        $done = $value >= $goal;
        $out[] = [
            'code' => $code, 'title' => $title, 'text' => $text, 'progress' => $value, 'goal' => $goal, 'done' => $done,
            'earned_at' => $done && isset($earned[$code]) ? human_date($earned[$code], false) : null,
        ];
    }
    return $out;
}

// Поздравляем с новыми достижениями одним сообщением. Возвращает, сколько достижений новых.
function announce_achievements(array $client): int
{
    $new = [];
    foreach (client_achievements((int) $client['id']) as $a) {
        if (!$a['done'] || val("SELECT id FROM notifications WHERE client_id = ? AND kind = 'ach' AND ref_id = ?", [$client['id'], $a['code']])) {
            continue;
        }
        insert('notifications', ['client_id' => (int) $client['id'], 'kind' => 'ach', 'ref_id' => $a['code'], 'sent_at' => now()]);
        $new[] = $a;
    }
    if ($new) {
        $text = count($new) === 1
            ? '<b>Новое достижение: «' . e($new[0]['title']) . '»</b>' . "\n" . e($new[0]['text']) . '. Спасибо, что приходите!'
            : '<b>Новые достижения:</b> ' . implode(', ', array_map(fn ($a) => '«' . e($a['title']) . '»', $new)) . '. Спасибо, что приходите!';
        notify_client($client, $text, [['text' => 'Мои достижения', 'app' => '#achievements']]);
    }
    return count($new);
}
