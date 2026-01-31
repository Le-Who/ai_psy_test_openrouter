/**
 * AI Universal Test Generator - Storage v4.0 (Final)
 * =================================================
 * Handles local saving, loading, and library rendering
 */

const Storage = {
    KEY: 'ai_tests_library_v2',
    _cache: null,

    /**
     * Получить весь список тестов
     */
    getAll() {
        if (this._cache) return this._cache;
        const data = localStorage.getItem(this.KEY);
        this._cache = data ? JSON.parse(data) : [];
        return this._cache;
    },

    /**
     * Найти тест по ID
     */
    getById(id) {
        const list = this.getAll();
        return list.find(t => t.id === id);
    },

    /**
     * Сохранить текущий тест (с авто-переименованием дубликатов)
     * Возвращает итоговое имя теста
     */
    save(blueprint, questions, themeName, shortUrl) {
        const library = this.getAll();
        
        // Логика авто-переименования: "Тест" -> "Тест (2)" -> "Тест (3)"
        let finalName = themeName;
        let counter = 2;

        while (library.some(t => t.theme === finalName)) {
            finalName = `${themeName} (${counter})`;
            counter++;
        }

        const newTest = {
            id: 'test_' + Date.now(),
            date: new Date().toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }),
            theme: finalName,
            blueprint: blueprint,
            questions: questions,
            shortUrl: shortUrl || null
        };

        // Добавляем в начало списка
        library.unshift(newTest);
        localStorage.setItem(this.KEY, JSON.stringify(library));
        
        return finalName;
    },

    /**
     * Удалить тест по ID
     */
    delete(id) {
        const list = this.getAll();
        this._cache = list.filter(t => t.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(this._cache));
    },

    /**
     * Генерация HTML для списка библиотеки (UI)
     */
    renderLibraryHTML() {
        const list = this.getAll();
        if (list.length === 0) {
            return `<div style="text-align:center; padding:40px; color:var(--text-muted);">
                <div style="font-size:40px; margin-bottom:10px;">📭</div>
                Библиотека пуста.<br>Создайте свой первый тест!
            </div>`;
        }

        return list.map(test => {
            // Определяем иконку по типу теста (quiz vs psy)
            // Если поле testType отсутствует (старые тесты), считаем psy
            const type = test.blueprint.testType || 'categorical'; 
            const isQuiz = (type === 'quiz');
            const icon = isQuiz ? '🧠' : '🧩';
            
            const count = test.questions ? test.questions.length : 0;
            
            const shortUrlBlock = test.shortUrl ? `
                <div style="margin-top:6px; font-size: 12px; color: var(--text-muted);">
                    🔗 Короткая ссылка:&nbsp;
                    <button class="btn-text" style="padding:0; font-size:12px;" onclick="prompt('Ссылка на тест:', '${test.shortUrl}')">
                        открыть / скопировать
                    </button>
                </div>` : '';

            return `
            <div class="card" style="padding: 20px; display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="font-size: 24px; flex-shrink: 0;">${icon}</div>
                
                <div style="flex-grow: 1; min-width: 0;"> <!-- min-width fix for flexbox truncation -->
                    <h3 style="margin: 0 0 5px; font-size: 16px; line-height: 1.4; word-wrap: break-word;">${test.theme}</h3>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        ${test.date} • ${count} вопросов
                    </div>
                    ${shortUrlBlock}
                </div>

                <div style="display:flex; gap:10px; align-items: center; flex-shrink: 0;">
                    <button class="btn" onclick="app.loadSavedTest('${test.id}')" 
                        style="width: auto; padding: 8px 16px; font-size: 14px; white-space: nowrap;">
                        ▶ Начать
                    </button>
                    <button onclick="app.deleteTest('${test.id}')" 
                        style="background:none; border:none; cursor:pointer; font-size:18px; opacity:0.5; padding: 5px; color: var(--text-muted); transition: color 0.2s;"
                        onmouseover="this.style.color=var(--danger)" 
                        onmouseout="this.style.color='var(--text-muted)'"
                        title="Удалить">
                        🗑
                    </button>
                </div>
            </div>`;
        }).join('');
    }
};

// Listen for updates from other tabs to invalidate cache
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === Storage.KEY) {
            Storage._cache = null;
        }
    });
}
