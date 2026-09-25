<?php
// Оплата: ЮKassa (боевой режим) и тестовый режим без денег.
declare(strict_types=1);

// Создаёт платёж и возвращает ссылку, по которой клиент оплатит.
function create_payment(int $purchaseId, array $client, string $returnPath): string
{
    $p = row('SELECT * FROM purchases WHERE id = ?', [$purchaseId]);
    $provider = (string) cfg('payments.provider');
    // После оплаты кабинет откроется на нужном экране и сам проверит, прошёл ли платёж.
    $returnUrl = app_link($returnPath, ['purchase' => $purchaseId]);
    if ($provider === 'test') {
        update('purchases', $purchaseId, ['provider' => 'test']);
        return rtrim((string) cfg('api_url'), '/') . '/index.php?r=pay/test&purchase=' . $purchaseId . '&back=' . rawurlencode($returnPath);
    }
    if ($provider !== 'yookassa') {
        fail('Оплата не настроена', 500);
    }
    $shop = (string) cfg('payments.yookassa.shop_id');
    $key = (string) cfg('payments.yookassa.secret_key');
    $amount = number_format((float) $p['amount'], 2, '.', '');
    $customer = $client['phone'] ? ['phone' => $client['phone']] : [];
    $payload = [
        'amount' => ['value' => $amount, 'currency' => 'RUB'],
        'capture' => true,
        'confirmation' => ['type' => 'redirect', 'return_url' => $returnUrl],
        'description' => mb_substr($p['description'], 0, 128),
        'metadata' => ['purchase_id' => (string) $purchaseId],
        // Чек по 54-ФЗ: ЮKassa отправит его клиенту сама.
        'receipt' => [
            'customer' => $customer,
            'items' => [[
                'description' => mb_substr($p['description'], 0, 128),
                'quantity' => '1.00',
                'amount' => ['value' => $amount, 'currency' => 'RUB'],
                'vat_code' => (int) cfg('payments.yookassa.vat_code') ?: 1,
                'payment_mode' => 'full_payment',
                'payment_subject' => 'service',
            ]],
        ],
    ];
    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERPWD => "$shop:$key",
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Idempotence-Key: pr-' . $purchaseId],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);
    $resp = json_decode((string) curl_exec($ch), true);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || empty($resp['confirmation']['confirmation_url'])) {
        log_msg('ЮKassa: ' . json_encode($resp, JSON_UNESCAPED_UNICODE));
        fail('Не получилось создать платёж. Попробуйте ещё раз или напишите нам.', 502);
    }
    update('purchases', $purchaseId, ['provider' => 'yookassa', 'provider_payment_id' => $resp['id']]);
    return $resp['confirmation']['confirmation_url'];
}

// Проверяем платёж напрямую в ЮKassa (не доверяем телу уведомления).
function yookassa_payment(string $paymentId): ?array
{
    $ch = curl_init('https://api.yookassa.ru/v3/payments/' . rawurlencode($paymentId));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERPWD => cfg('payments.yookassa.shop_id') . ':' . cfg('payments.yookassa.secret_key'),
    ]);
    $resp = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    return is_array($resp) ? $resp : null;
}

// Платёж прошёл: включаем абонемент или подтверждаем запись.
function mark_paid(int $purchaseId): void
{
    $p = row('SELECT * FROM purchases WHERE id = ?', [$purchaseId]);
    if (!$p || $p['status'] === 'paid') {
        return;
    }
    update('purchases', $purchaseId, ['status' => 'paid', 'paid_at' => now()]);
    $c = row('SELECT * FROM clients WHERE id = ?', [$p['client_id']]);
    if ($p['kind'] === 'membership') {
        $m = row('SELECT * FROM memberships WHERE purchase_id = ?', [$purchaseId]);
        if ($m) {
            update('memberships', (int) $m['id'], ['status' => 'active']);
            $plan = PLANS[$m['plan']];
            $text = '<b>Абонемент «' . e($plan['name']) . '» оплачен.</b>' . "\n" .
                'Действует до ' . human_date(month_last_day($m['month']), false) . '. Записывайтесь на встречи в кабинете.';
            $buttons = [['text' => 'Открыть расписание', 'app' => '#schedule']];
            if (cfg('telegram.members_chat_invite')) {
                $text .= "\n\nВ чат держателей карты можно вступить по ссылке ниже: заявку бот одобрит сам.";
                $buttons[] = ['text' => 'Чат держателей карты', 'url' => (string) cfg('telegram.members_chat_invite')];
            }
            notify_client($c, $text, $buttons);
        }
    } else {
        $b = row('SELECT b.*, e.title, e.starts_at FROM bookings b JOIN events e ON e.id = b.event_id WHERE b.purchase_id = ?', [$purchaseId]);
        if ($b) {
            q("UPDATE bookings SET status = 'booked', paid_by = 'single', updated_at = ? WHERE id = ?", [now(), $b['id']]);
            notify_client($c, '<b>Вы записаны:</b> ' . e($b['title']) . ', ' . human_date($b['starts_at']) . '. Ждём вас!', [['text' => 'Мои записи', 'app' => '#bookings']]);
        }
    }
}
