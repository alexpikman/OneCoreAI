# ONE CORE AI

![ONE CORE AI](public/onecore-ai-banner.png)

Локальный ИИ-агент для Windows 10/11. ONE CORE AI объединяет чат с моделями, работу с проектами, файлами, Git и терминалом PowerShell в настольном приложении на Tauri 2. Для запуска локальных GGUF-моделей используется `llama.cpp`; также доступны Ollama, LM Studio и совместимые облачные API.

## Установка в Windows

Откройте PowerShell и запустите установщик:

```powershell
irm https://raw.githubusercontent.com/alexpikman/OneCoreAI/main/scripts/install.ps1 | iex
```

Скрипт проверит WebView2 и доступные установщики ONE CORE AI. Если готового `.exe` или `.msi` ещё нет, он развернёт веб-версию приложения локально. Для облачных AI-провайдеров потребуется API-ключ; локальные модели и каталог публичных GGUF можно использовать без него.

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

Основные проверки и production-сборка:

```powershell
npm test
npm run lint
npm run build
```

## Данные предыдущих версий

Чтобы не терять пользовательские модели, проекты и зашифрованное хранилище, приложение повторно использует данные из `%APPDATA%\com.kovastudio.app` и `~/.kova-studio`, пока в новых каталогах нет собственных данных. Переменная `KOVA_HOME` также остаётся совместимой; для новых установок используйте `ONECORE_HOME`. Файлы SSH-ключей не копируются и не переименовываются.
