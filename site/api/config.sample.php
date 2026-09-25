<?php
// Настройки Пространства. Скопируйте файл в config.php рядом и заполните.
// config.php не попадает в репозиторий: в нём пароли и токены.
return [
    // База данных. На хостинге nic.ru создайте MySQL-базу в панели управления.
    'db' => [
        'dsn'  => 'mysql:host=localhost;dbname=prostranstvo;charset=utf8mb4',
        'user' => 'prostranstvo',
        'pass' => 'пароль-от-базы',
    ],
    'timezone' => 'Europe/Moscow',

    // Адреса. Нужен HTTPS: без него Telegram не откроет кабинет и не пришлёт обновления боту.
    'site_url' => 'https://prostranstvo.ru',
    'app_url'  => 'https://prostranstvo.ru/app/',
    'api_url'  => 'https://prostranstvo.ru/api/',

    // Telegram-бот: создайте в @BotFather и вставьте токен.
    'telegram' => [
        'token'          => '',
        'bot_username'   => '',          // без @, например prostranstvo_bot
        'webhook_secret' => '',          // любая длинная случайная строка
        // Закрытый чат держателей карты: бот должен быть в нём администратором.
        'members_chat_id'     => '',     // например -1001234567890
        'members_chat_invite' => '',     // ссылка-приглашение с заявками на вступление
    ],

    // MAX-бот: включите, когда бот будет создан через «MAX для бизнеса».
    'max' => [
        'enabled'        => false,
        'token'          => '',
        'bot_link'       => '',          // например https://max.ru/prostranstvo_bot
        'api'            => 'https://platform-api2.max.ru',
        'webhook_secret' => '',
    ],

    // Оплата. provider: test (для проверки без денег) или yookassa.
    'payments' => [
        'provider' => 'test',
        'yookassa' => [
            'shop_id'    => '',
            'secret_key' => '',
            'vat_code'   => 1,           // 1 = без НДС (ИП на УСН)
        ],
    ],

    'single_price' => 2500,   // разовое посещение, ₽
    'capacity'     => 40,     // мест в зале по умолчанию

    // Ключ для запуска служебных скриптов через браузер (cron.php, setup.php).
    'cron_key' => 'длинная-случайная-строка',

    // Только для разработки: вход без Telegram и запись уведомлений в файл.
    'dev_login'  => false,
    'notify_log' => '',
];
