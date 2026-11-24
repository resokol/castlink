# Участие в разработке / Contributing

Спасибо за интерес к CastLink. Перед изменениями прочитайте [README](README.md), [архитектурные ограничения](docs/CRITICAL_INVARIANTS_RU.md) и [правила выпуска](distribution/RELEASE_POLICY.md).

## Локальная разработка

Используйте Node.js 26.13.1 и pnpm 12.23.0. Для полного набора серверных проверок нужна Linux-среда с Bash, Python 3, компилятором C и Go. Для проверок шаблонов CLI команда `go` должна запускать инструменты Go. Путь к ним можно задать в `CASTLINK_TEST_GO`. Нативные Windows-проверки запускаются в Windows. Не используйте рабочие серверы и реальные пользовательские данные для тестов.

```sh
npm install --global pnpm@12.23.0
pnpm install --frozen-lockfile
pnpm dev
```

Настройки окружения и запуск серверных зависимостей описаны в [README](README.md). Не добавляйте `.env`, ключи, пароли, дампы баз, локальные отчёты, инструкции агентов или собранные пакеты в Git.

## Изменения и проверки

Создавайте ветку от актуального `main`. В pull request опишите проблему, изменение поведения и выполненные проверки. Для изменений интерфейса приложите изображение без личных данных. Сохраняйте существующие проверки авторизации, миграции и пользовательские данные.

```sh
pnpm typecheck
pnpm test:ci
pnpm build
```

Для Windows-клиента дополнительно запускайте `pnpm desktop:test` и соответствующие нативные проверки из [руководства клиента](apps/desktop/README.md). Укажите платформу и все проверки, которые не удалось выполнить. Проверки внешних систем требуют отдельных тестовых конфигураций.

Обновляйте документацию вместе с поведением. Пользовательские инструкции поддерживаются на русском, английском и упрощённом китайском. Собственный код проекта распространяется под [MIT](LICENSE); сохраняйте лицензии, авторство и уведомления сторонних компонентов. Не добавляйте чужой код без совместимых разрешений.

## Ошибки и уязвимости

Для обычной ошибки укажите продукт, версию, ОС, шаги воспроизведения, ожидаемый и фактический результат. Удалите из логов секреты и персональные данные. Об уязвимостях сообщайте приватно по [SECURITY.md](SECURITY.md), а не в публичном issue.

## English

Start from current `main`, follow the setup and verification commands above, and describe the problem, behavioral change and actual test results in your pull request. Full server tests require Linux, Bash, Python 3, a C compiler and the Go toolchain. The CLI template tests use `go` from PATH or the executable specified by `CASTLINK_TEST_GO`. Native Windows checks require Windows. Keep credentials, user data and local tooling artifacts out of Git. Original project code is MIT; preserve all third-party licenses and attribution. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## 简体中文

请从最新的 `main` 创建分支，按照上面的步骤安装依赖并运行检查。在拉取请求中说明问题、行为变化和实际测试结果。完整的服务器测试需要 Linux、Bash、Python 3、C 编译器和 Go 工具链。CLI 模板测试使用 PATH 中的 `go` 或 `CASTLINK_TEST_GO` 指定的可执行文件。Windows 原生测试需要 Windows。不要提交凭据、用户数据或本地工具文件。项目原创代码采用 MIT 许可证；请保留第三方许可证和署名。安全漏洞请按照 [SECURITY.md](SECURITY.md) 私下报告。
