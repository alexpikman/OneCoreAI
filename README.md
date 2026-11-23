# OneCoreAI

![OneCoreAI](public/onecore-ai-banner.png)

Локальный ИИ-агент для Windows 10/11. OneCoreAI объединяет чат с моделями, работу с проектами, файлами, Git и терминалом PowerShell в настольном приложении на Tauri 2. Для запуска локальных GGUF-моделей используется `llama.cpp`; также доступны Ollama, LM Studio и совместимые облачные API.

## Установка в Windows

Откройте PowerShell и запустите установщик:

```powershell
irm https://raw.githubusercontent.com/alexpikman/OneCoreAI/main/scripts/install.ps1 | iex
```

Скрипт проверит WebView2 и доступные установщики OneCoreAI. Если готового `.exe` или `.msi` ещё нет, он развернёт веб-версию приложения локально. Для облачных AI-провайдеров потребуется API-ключ; локальные модели и каталог публичных GGUF можно использовать без него.

## Локальный запуск для разработки

Нужны Node.js 22 или новее. В PowerShell выполните:

```powershell
git clone https://github.com/alexpikman/OneCoreAI.git
cd OneCoreAI
npm install --legacy-peer-deps
npm run dev
```

Приложение откроется по адресу [http://localhost:3000](http://localhost:3000). Для запуска настольной оболочки Tauri установите Rust и Visual Studio C++ Build Tools, затем выполните:

```powershell
npm run tauri:dev
```

В разделе «Проекты» можно вести отдельные задачи, план с прогрессом и полную историю действий для каждого рабочего пространства. Изменения настроек сохраняются кнопкой «Сохранить настройки»; ключи провайдеров хранятся отдельно в локальном зашифрованном хранилище.

## OneCore Designer

OneCore Designer развивается как отдельное desktop-приложение на Tauri 2. Оно подключается к уже запущенному OneCoreAI и не запускает второй backend.

Запуск из исходников:

```powershell
npm run designer:tauri:dev
```

Сборка Windows:

```powershell
npm run designer:tauri:build
```

Для подключения запустите OneCoreAI, откройте «Безопасность» → «OneCore Designer» → «Создать код подключения», затем в Designer введите показанные API-адрес и одноразовый код. Код действует две минуты и используется один раз; сессионный токен хранится только в памяти Designer.

Текущая версия Designer — ранний desktop-конструктор: защищённое подключение, реестр встроенных страниц, перетаскивание пунктов навигации между группами, изменение названий и иконок, скрытие пунктов, настройка шрифтов, размеров текста, цветов, отступов, радиусов и прозрачности с предпросмотром light/dark. Конфигурации проходят проверку, сохраняются отдельными ревизиями и поддерживают восстановление. Проверенные макеты навигации и оформления загружаются в runtime OneCoreAI при запуске и возврате в окно приложения. Перестановка внутренних блоков страниц остаётся отключённой до описания их контрактов и зависимостей.

Основные проверки и production-сборка:

```powershell
npm test
npm run lint
npm run build
```

## Пользовательские данные

По умолчанию OneCoreAI использует отдельный каталог профиля:

- Windows: `%USERPROFILE%\.onecoreai`
- Модели GGUF: `%USERPROFILE%\.onecoreai\models`
- Настройки, история чатов, проекты, заметки и хранилище секретов: файлы внутри `%USERPROFILE%\.onecoreai`
- Runtime `llama.cpp`: `%LOCALAPPDATA%\OneCoreAI\runtimes\llama.cpp`

При первом запуске создаётся чистый профиль с настройками приложения по умолчанию. Данные из других каталогов автоматически не обнаруживаются, не импортируются и не удаляются. Файлы `settings.json`, `chat-history.json`, `projects.json`, `models.json` и `notes.json` можно перенести вручную. Файл `vault.enc.json` и сохранённые в системном хранилище учётные данные не переносятся: API-ключи и токены нужно ввести заново. Переменная окружения `ONECORE_HOME` позволяет задать другой корневой каталог профиля.

## Documentation

- [Documentation index](docs/README.md) — canonical map of governance, project records, architecture, and agent knowledge.
- [Architecture index](docs/architecture/README.md) — system map, operation lifecycle, security/approvals, implementation status, and test map.
- [Knowledge base](docs/knowledge/README.md) — versioned roles, procedures, protocols, and schemas.

## Development documentation

- [AI Working Rules](docs/governance/AI_WORKING_RULES.md)
- [Development Plan](docs/project/DEVELOPMENT_PLAN.md)
- [Current Work](docs/project/CURRENT_WORK.md)
- [Continue Development](GO/ContinueDevProject.md)
