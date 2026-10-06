# Исправление Compose диапазона Internet/TURN

Первый source contract `0d58a22` использовал строку диапазона в long-syntax `target`; Compose требует там integer. Исправление записывает relay mapping короткой формой `bindIPv4:30000-30999:30000-30999/udp`. Остальные long mappings имеют integer target. Четыре core-службы, public IPv4/domain, admission и отказ Internet SERVICES/START без проверенного TLS stage сохранены.

Общий фиксированный normalizer разворачивает диапазон в 1000 отдельных фактических Docker `PortBindings`. Его используют client ownership, Node/Python fixed helpers и uninstall ownership snapshot. Принимаются только точные long mappings либо короткая форма с явным IPv4, каноническими положительными портами и tcp/udp. Диапазоны должны иметь равную длину, максимум 1000 портов; всего максимум 1104 bindings. Перекрывающиеся target/protocol keys, неполные/переназначенные/лишние bindings и неоднозначные формы отказывают. Это нормализация ownership, а не разрешение Internet readiness.

Sol medium: RED нового range regression — 3 FAIL. Исправленный renderer и fixed ownership — 15 PASS вместе с Internet contract family; после расширения snapshot regression и нормализации uninstall consumer — 39 PASS в range/services/target families, плюс 1 PASS выбранного cold uninstall fixture. Build/diffcheck — 0. Native runtime acceptance не заявляется.

Реальный Compose v2.40.3 `config --no-env-resolution --format json` разобрал собственный временный renderer fixture: четыре службы, 1104 LiveKit bindings, ровно 1000 UDP relay bindings 30000–30999, integer targets, точные host/published значения; stderr пуст. CONFIG renderer file занимает 20193 байта при лимите 65536. Env references для parser fixture — собственные пустые файлы в приватном `/tmp`; это проверка схемы Compose, а не запуск или сертификатный proof. Docker daemon, контейнеры, DNS/ACME, сетевые порты и устройства не использовались.

Артефакты: `/tmp/castlink-internet-range-{red,green,final,uninstall,build}.log` и `/tmp/castlink-internet-range-parser/{compose.yaml,resolved.json,stderr.log}`. Независимое повторное source review остаётся задачей координатора.
