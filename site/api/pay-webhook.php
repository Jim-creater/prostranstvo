<?php
// Уведомления ЮKassa об оплате. Адрес указывается в личном кабинете ЮKassa: Интеграция → HTTP-уведомления.
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rules.php';
require __DIR__ . '/lib/notify.php';
require __DIR__ . '/lib/payments.php';

$n = json_decode((string) file_get_contents('php://input'), true) ?: [];
$paymentId = (string) ($n['object']['id'] ?? '');
if ($paymentId === '') {
    http_response_code(400);
    exit;
}
try {
    // Проверяем статус у ЮKassa: так нельзя подделать уведомление.
    $p = yookassa_payment($paymentId);
    $purchase = row('SELECT * FROM purchases WHERE provider_payment_id = ?', [$paymentId]);
    if ($p && $purchase) {
        if (($p['status'] ?? '') === 'succeeded' && ($p['paid'] ?? false)) {
            mark_paid((int) $purchase['id']);
        } elseif (($p['status'] ?? '') === 'canceled') {
            q("UPDATE purchases SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [$purchase['id']]);
            q("UPDATE memberships SET status = 'cancelled' WHERE purchase_id = ? AND status = 'pending'", [$purchase['id']]);
            $held = row("SELECT event_id FROM bookings WHERE purchase_id = ? AND status = 'pending_payment'", [$purchase['id']]);
            q("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE purchase_id = ? AND status = 'pending_payment'", [now(), $purchase['id']]);
            if ($held && ($ev = row('SELECT * FROM events WHERE id = ?', [$held['event_id']]))) {
                offer_seat_to_waitlist($ev);
            }
        }
    }
    http_response_code(200);
} catch (Throwable $ex) {
    log_msg('pay-webhook: ' . $ex->getMessage());
    http_response_code(500);
}
