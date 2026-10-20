[Русский](PRODUCTS.md) · [English](docs/en/PRODUCTS.md) · [简体中文](docs/zh-CN/PRODUCTS.md)

# Выберите пакет CastLink

| Пакет | Для чего нужен | Последний проверенный пакет |
| --- | --- | --- |
| CastLink Client | Приложение Windows для подключения к существующему серверу. Устанавливать свой сервер для участия не требуется. | [Скачать клиент Windows](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Client-1.0.0-rc.3-1472cd052d7e-setup.exe) |
| CastLink Server Setup | Мастер Windows для организатора: установка собственного сервера на Windows-ПК или Linux VPS по SSH. | [Скачать Server Setup](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Windows.zip) |
| CastLink Linux | Самостоятельная установка сервера на Linux без Windows-мастера. | [Скачать Linux](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Linux.tar.gz) |

Эти фиксированные ссылки ведут на опубликованные пакеты **1.0.0-rc.3**, исходный коммит `1472cd052d7e`. Готовится **1.0.0-rc.8**; наличие изменений в PR ещё не означает, что новый пакет собран и опубликован. [Контрольные суммы](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/SHA256SUMS). Проверяйте сумму нужного файла перед запуском.

Кастер может подключаться в браузере, без установки приложения. Client и Server Setup — разные задачи: приложение нужно участнику, серверный мастер — организатору. [Инструкция установки](INSTALL.md).

Следующие выпуски имеют отдельные теги `client-v…`, `server-setup-v…` и `linux-v…`. Номера версий могут различаться: обновление одного пакета не означает обновления остальных. Переход на 1.1 пока отложен; текущий кандидат — 1.0.0-rc.8.

В выпуске Server Setup файл `CastLink-Linux.tar.gz` также может присутствовать как точная зависимость Windows-мастера для развёртывания VPS. Мастер использует этот файл из своего выпуска с тем же исходным SHA; он не заменяет независимо выпускаемый Linux-пакет. Самостоятельный Linux выбирайте по тегам `linux-v…`.

При публикации заменяйте каждую строку только ссылкой на готовый проверенный пакет соответствующего направления. Не используйте общий `releases/latest` для определения версии всех продуктов.
