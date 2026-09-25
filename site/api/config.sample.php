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

    // Абонементы на месяц. Меняйте только числа и названия в кавычках.
    //   price   — цена, ₽
    //   clubs   — сколько клубов входит: 1 (клуб на выбор) или 2 (оба)
    //   weekend — проходок на выходные встречи (гости и кино)
    //   costume — занятий по истории костюма
    //   art     — занятий по рисунку
    // Новые цены действуют для новых покупок. Цены на сайте (index.html) поменяйте тоже.
    'plans' => [
        'club1' => ['name' => 'Один клуб',        'price' => 3500,  'clubs' => 1, 'weekend' => 2, 'costume' => 0, 'art' => 0],
        'clubs' => ['name' => 'Клубы и гости',    'price' => 6500,  'clubs' => 2, 'weekend' => 4, 'costume' => 0, 'art' => 0],
        'all'   => ['name' => 'Всё Пространство', 'price' => 12000, 'clubs' => 2, 'weekend' => 6, 'costume' => 2, 'art' => 4],
    ],

    'single_price' => 2500,   // разовое посещение, ₽
    'capacity'     => 40,     // мест в зале по умолчанию

    // Ключ для запуска служебных скриптов через браузер (cron.php, setup.php).
    'cron_key' => 'длинная-случайная-строка',

    // Только для разработки: вход без Telegram и запись уведомлений в файл.
    'dev_login'  => false,
    'notify_log' => '',
];
