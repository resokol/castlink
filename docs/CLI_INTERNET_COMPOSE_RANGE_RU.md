# Compose: диапазон Internet/TURN

Compose требует integer в long-syntax `target`. Renderer записывает relay mapping короткой формой `bindIPv4:30000-30999:30000-30999/udp`. Остальные long mappings имеют integer target. Четыре core-службы, public IPv4/domain, admission и отказ Internet SERVICES/START без проверенного TLS stage сохранены.

Общий фиксированный normalizer разворачивает диапазон в 1000 отдельных фактических Docker `PortBindings`. Его используют client ownership, Node/Python fixed helpers и uninstall ownership snapshot. Принимаются только точные long mappings либо короткая форма с явным IPv4, каноническими положительными портами и tcp/udp. Диапазоны должны иметь равную длину, максимум 1000 портов; всего максимум 1104 bindings. Перекрывающиеся target/protocol keys, неполные/переназначенные/лишние bindings и неоднозначные формы отказывают. Это нормализация ownership, а не разрешение Internet readiness.
