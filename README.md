**Русский** · [English](docs/en/README.md) · [简体中文](docs/zh-CN/README.md)

<p align="center">
  <a href="https://castlink.ru"><img src="assets/castlink-logo.svg" width="112" height="112" alt="Логотип CastLink"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>Удалённые кастеры. Отдельные источники. Ваш эфир.</strong></p>
<p align="center">Подключение через браузер · OBS и vMix · Свой сервер</p>
<p align="center">
  <a href="https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip"><strong>Скачать для Windows</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz"><strong>Скачать для Linux</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">Сайт</a> &nbsp; / &nbsp;
  <a href="GUIDE.md">Инструкция</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">Что нового</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">Связаться с автором</a> &nbsp; / &nbsp;
  <a href="SUPPORT.md"><strong>♡ Поддержать CastLink</strong></a>
</p>

---

Бесплатная система удалённых подключений для эфиров. Кастер открывает ссылку в браузере, а студия получает его видео со звуком отдельным источником для OBS, vMix или другого режиссёрского ПО. Сервер работает на вашем Windows-ПК или Linux VPS.

- Отдельный видео- и аудиопоток каждого кастера.
- Просмотр студийного эфира по ссылке `/watch`.
- Ручной перенос комнаты и настраиваемый автоматический резерв.
- Статистика подключений для диагностики связи.
- Интерфейс на русском, английском и упрощённом китайском.

**Идёт публичное тестирование.** Перед рабочим эфиром проверьте устройства, сеть и резерв на своём оборудовании.

## Скачать

| Платформа | Пакет | Инструкция |
| --- | --- | --- |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip) | [Установка и работа](GUIDE.md#установить-на-windows) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz) | [Установка непосредственно на Linux](LINUX_INSTALL.md) |

[Последний выпуск](https://github.com/resokol/castlink-releases/releases/latest) · [Что изменилось](CHANGELOG.md) · [Контрольные суммы](https://github.com/resokol/castlink-releases/releases/latest/download/SHA256SUMS)

Скачивайте пакет и `SHA256SUMS` из одного выпуска. Linux-инструкция привязана к конкретной проверенной по составу сборке — используйте указанные в ней ссылки. Пакет macOS пока не опубликован.

## Начать работу

1. Установите сервер. На Windows распакуйте архив целиком и запустите `EasySetup.exe`. Для Linux используйте [отдельную инструкцию](LINUX_INSTALL.md) либо [установку по SSH из Windows-мастера](GUIDE.md#установить-на-linux-vps-из-windows).
2. Откройте CastLink, создайте студию и пригласите кастеров по ссылке.
3. Добавьте индивидуальные выходы кастеров в OBS/vMix и соберите эфир в привычном ПО.

Docker нужен только на сервере. Кастерам достаточно браузера, HTTPS и разрешений на камеру/микрофон.

## Документация и помощь

- [Полная инструкция: устройства, сеть, резерв и обновление](GUIDE.md)
- [Linux без Windows и графического мастера](LINUX_INSTALL.md)
- [История изменений](CHANGELOG.md)
- [Сообщить о проблеме автору](https://t.me/sklvmax)
- [Сайт проекта](https://castlink.ru)

В сообщении об ошибке укажите сборку, ОС, браузер, время и шаги воспроизведения. Не отправляйте публично пароли, токены и персональные ссылки доступа.

## Поддержать проект

Если CastLink полезен для ваших эфиров, [поддержите его развитие](SUPPORT.md): СБП или криптовалюта. Спасибо за вашу помощь!

## Автор и условия

Автор: [@sklvmax в Telegram](https://t.me/sklvmax) · [resokol на GitHub](https://github.com/resokol).

Использование бесплатно. Распространение неизменённых сборок допускается с указанием автора; изменения — с разрешения автора. Полные условия: [лицензия на русском](LICENSE_RU.md) · [английский оригинал](LICENSE). У сторонних компонентов собственные лицензии: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).

Этот репозиторий содержит готовые выпуски и документацию. `CastLink-ThirdParty-Sources.tar.gz` в Assets предназначен для выполнения условий лицензий сторонних компонентов; для установки он не нужен. Скачивайте платформенный пакет из таблицы выше.



---

[Пошаговая настройка TURN/TLS на TCP 443](TURN_TLS.md)

## Ответственность за сервер

За работу собственного сервера отвечает человек или организация, которые его разворачивают и администрируют. В их обязанности входят настройка, безопасность, управление доступом, резервное копирование и соблюдение закона при обработке данных и размещении материалов. Пользователи отвечают за свои действия и контент. Предоставление CastLink само по себе не делает автора владельцем или администратором таких серверов. Это условие не исключает ответственность, которую нельзя исключить по закону.

[Полные условия лицензии на русском](LICENSE_RU.md)
