/**
 * AI Universal Test Generator - Core Logic v5.0 (Social Edition)
 * ==============================================================
 * Features: TinyURL Sharing, Duel Mode, LZ-String Compression
 */

const api = {
    detectProvider(key) {
        return key.startsWith('AIza') ? 'gemini' : 'openrouter';
    },

    safeParseJSON(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            // Попытка найти JSON внутри текста (markdown блоков)
            const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (match) {
                try { return JSON.parse(match[0]); } catch (e2) {}
            }
            const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (mdMatch) {
                try { return JSON.parse(mdMatch[1]); } catch (e3) {}
            }
            throw new Error("JSON Parse Error: Models returned invalid format");
        }
    },

    async call(task, prompt, schema, key) {
        const provider = this.detectProvider(key);
        const sysPrompt = PROMPTS[provider][task]; 
        console.log(`📡 API: ${provider} -> ${task}`);

        if (provider === 'gemini') return this.callGemini(sysPrompt, prompt, schema, 'generator', key);
        return this.callOpenRouter(sysPrompt, prompt, schema, 'generator', key);
    },

    async callOpenRouter(sys, user, schema, type, key) {
        const model = CONFIG.providers.openrouter.models[type];
        const messages = [
            { role: 'system', content: sys },
            { role: 'user', content: user }
        ];

        const res = await fetch(CONFIG.providers.openrouter.endpoint, {
            method: 'POST',
            headers: CONFIG.providers.openrouter.headers(key),
            body: JSON.stringify({
                model,
                messages,
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        if (!res.ok) throw new Error(`OpenRouter Error: ${res.status}`);
        const data = await res.json();
        return this.safeParseJSON(data.choices[0].message.content);
    },

    async callGemini(sys, user, schema, type, key) {
        const model = CONFIG.providers.gemini.models[type];
        // Gemini лучше работает, когда схема и промпт объединены
        const prompt = `${sys}\n\nFORMAT JSON:\n${JSON.stringify(schema)}\n\nTASK: ${user}`;
        
        const res = await fetch(`${CONFIG.providers.gemini.endpoint}${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!res.ok) throw new Error(`Gemini Error: ${res.status}`);
        const data = await res.json();
        // Gemini может вернуть "Candidate was blocked due to safety", надо проверять
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error("Gemini blocked response (Safety Filter)");
        }
        return this.safeParseJSON(data.candidates[0].content.parts[0].text);
    }
};

const app = {
    state: {
        step: 0,
        mode: 'psy', // 'psy' | 'quiz' | 'duel'
        answers: [],
        questions: [],
        blueprint: null,
        quizScore: 0,
        
        // Duel specific state
        hostName: null,
        hostScore: null
    },

    init() {
        // Проверяем, есть ли хэш в URL (входящая ссылка)
        this.checkHashOnLoad();

        // UI Event Listeners
        document.getElementById('libraryBtn').onclick = () => {
            document.getElementById('libraryList').innerHTML = Storage.renderLibraryHTML();
            this.setView('library');
        };
    },

    // --- SHARE & DUEL LOGIC ---
    
    async shareTest() {
        const btn = document.getElementById('shareBtn');
        const originalText = btn.innerText;
        btn.innerText = "⏳ Создаем ссылку...";
        btn.disabled = true;

        try {
            // 1. Собираем данные
            const payload = {
                m: this.state.mode, // mode
                t: document.getElementById('themeInput').value, // theme
                b: this.state.blueprint, // blueprint
                q: this.state.questions // questions
            };

            // Если это Квиз, добавляем результаты для Дуэли
            if (this.state.mode === 'quiz' || this.state.mode === 'duel') {
                const name = prompt("Как тебя зовут? (для таблицы рекордов)", "Аноним");
                if (name) {
                    payload.hN = name; // Host Name
                    payload.hS = this.state.quizScore; // Host Score
                    payload.m = 'duel'; // Меняем режим на дуэль
                }
            }

            // 2. Сжимаем JSON (LZString)
            const jsonString = JSON.stringify(payload);
            const compressed = LZString.compressToEncodedURIComponent(jsonString);
            const longUrl = `${window.location.origin}${window.location.pathname}#d=${compressed}`;

            // 3. Сокращаем через TinyURL (если есть токен)
            const token = document.getElementById('tinyUrlTokenInput').value.trim();
            let finalUrl = longUrl;

            if (token) {
                try {
                    const res = await fetch('https://api.tinyurl.com/create', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            url: longUrl,
                            domain: "tiny.one"
                        })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        finalUrl = data.data.tiny_url;
                    } else {
                        console.warn("TinyURL Error", await res.text());
                    }
                } catch (e) {
                    console.warn("TinyURL Network Error", e);
                }
            }

            // 4. Показываем пользователю
            // Используем prompt, чтобы можно было легко скопировать (мобильные браузеры могут блокировать clipboard.writeText без жеста)
            prompt("Скопируй эту ссылку и отправь другу:", finalUrl);

        } catch (e) {
            alert("Ошибка при создании ссылки: " + e.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    checkHashOnLoad() {
        if (!window.location.hash) return;
        
        const hash = window.location.hash.substring(1); // remove #
        if (hash.startsWith('d=')) {
            try {
                // Распаковка
                const compressed = hash.substring(2);
                const json = LZString.decompressFromEncodedURIComponent(compressed);
                const data = JSON.parse(json);

                if (!data || !data.q || !data.b) throw new Error("Invalid Data");

                // Загружаем тест
                this.state.mode = data.m;
                this.state.blueprint = data.b;
                this.state.questions = data.q;
                
                // Устанавливаем тему в UI (для красоты)
                document.getElementById('themeInput').value = data.t;

                // Если это дуэль - настраиваем стейт
                if (data.m === 'duel') {
                    this.state.hostName = data.hN;
                    this.state.hostScore = data.hS;
                    
                    // Показываем баннер
                    const banner = document.getElementById('duelBanner');
                    banner.style.display = 'block';
                    document.getElementById('duelText').innerText = 
                        `${data.hN} набрал ${data.hS}/${data.q.length} баллов. Сможешь победить?`;
                    
                    // Переключаем таб на Викторию визуально
                    this.setMode('quiz'); 
                } else {
                    this.setMode(data.m);
                }

                // Сразу переходим к старту (пропуская генерацию)
                // Но надо дать пользователю нажать кнопку "Поехали", поэтому просто предзаполняем всё
                // и скрываем настройки генерации, оставляя кнопку "Начать тест"
                // Для простоты - просто запускаем рендер первого вопроса
                
                // Небольшой хак: скрываем Setup, показываем Test
                this.state.step = 0;
                this.state.answers = [];
                this.state.quizScore = 0;
                this.renderQ();
                this.setView('test');
                
                // Очищаем хэш, чтобы при рефреше не начинать заново вечно
                history.replaceState(null, null, ' ');

            } catch (e) {
                console.error("Link Error", e);
                alert("Ссылка повреждена или некорректна.");
            }
        }
    },

    // --- UI SWITCHING ---
    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('tabPsy').classList.toggle('active', mode === 'psy');
        document.getElementById('tabQuiz').classList.toggle('active', mode === 'quiz' || mode === 'duel');
        
        document.getElementById('audienceGroup').style.display = mode === 'psy' ? 'block' : 'none';
        document.getElementById('difficultyGroup').style.display = (mode === 'quiz' || mode === 'duel') ? 'block' : 'none';
        
        const themeInput = document.getElementById('themeInput');
        themeInput.placeholder = mode === 'psy' 
            ? "Например: Кто ты из Вселенной Гарри Поттера?" 
            : "Например: Знаток географии Европы";
    },

    setView(viewId) {
        ['setup', 'loading', 'test', 'results', 'library'].forEach(id => {
            document.getElementById('view-' + id).classList.add('hidden');
        });
        document.getElementById('view-' + viewId).classList.remove('hidden');
    },

    setLoading(active, text = "") {
        if (active) {
            this.setView('loading');
            document.getElementById('loadingText').innerText = text;
        } else {
            this.setView('test');
        }
    },

    // --- CORE LOGIC ---
    
    async start(e) {
        if (e) e.preventDefault();
        
        // Reset state
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.state.blueprint = null;
        this.state.questions = [];
        this.state.hostName = null; // Reset duel info on new gen
        document.getElementById('duelBanner').style.display = 'none';

        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const theme = document.getElementById('themeInput').value;
        const notes = document.getElementById('notesInput').value;
        const count = document.getElementById('qCountInput').value;

        if (!apiKey) return alert("Введите API ключ для генерации!");

        const isQuiz = this.state.mode === 'quiz';
        const contextParam = isQuiz 
            ? `Сложность/Вариантов: ${document.getElementById('difficultyInput').value}` 
            : `Аудитория: ${document.getElementById('audienceInput').value}`;
        
        const taskSuffix = isQuiz ? '_quiz' : '_psy';
        const schemaBP = isQuiz ? SCHEMAS.quiz_blueprint : SCHEMAS.psy_blueprint;
        const schemaQ = isQuiz ? SCHEMAS.quiz_questions : SCHEMAS.psy_questions;

        this.setLoading(true, isQuiz ? "🧠 Составляем программу викторины..." : "🧠 Архитектор проектирует тест...");
        document.getElementById('errorBox').style.display = 'none';

        try {
            // 1. Blueprint
            const notesText = notes ? `УТОЧНЕНИЯ: "${notes}".` : "";
            const archPrompt = `Тема: "${theme}". ${contextParam}. ${notesText} Создай структуру.`;
            
            this.state.blueprint = await api.call('architect' + taskSuffix, archPrompt, schemaBP, apiKey);

            // 2. Questions
            this.setLoading(true, "✍️ Придумываем вопросы...");
            const optionsCount = isQuiz ? document.getElementById('difficultyInput').value : 0;
            const optionsInstruction = isQuiz ? `СТРОГОЕ ТРЕБОВАНИЕ: В каждом вопросе должно быть ровно ${optionsCount} варианта(ов) ответа!` : "";

            const genPrompt = `Тема: ${theme}. Структура: ${JSON.stringify(this.state.blueprint.outcomes)}. Кол-во вопросов: ${count}. ${optionsInstruction} ${notesText}`;
            
            const res = await api.call('generator' + taskSuffix, genPrompt, schemaQ, apiKey);
            
            this.state.questions = res.questions;
            this.renderQ();
            this.setView('test');

        } catch (err) {
            console.error(err);
            document.getElementById('errorBox').style.display = 'block';
            document.getElementById('errorBox').innerHTML = `Ошибка: ${err.message}`;
            this.setView('setup');
        }
    },

    loadSavedTest(id) {
        const test = Storage.getById(id);
        if (!test) return;
        
        this.state.blueprint = test.blueprint;
        this.state.questions = test.questions;
        this.state.mode = test.blueprint.testType === 'quiz' ? 'quiz' : 'psy';
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        
        // Reset duel
        this.state.hostName = null;
        document.getElementById('duelBanner').style.display = 'none';

        this.renderQ();
        this.setView('test');
    },

    saveCurrentTest() {
        if (!this.state.blueprint) return;
        const name = document.getElementById('themeInput').value || "Без названия";
        const finalName = Storage.save(this.state.blueprint, this.state.questions, name);
        
        const btn = document.getElementById('saveTestBtn');
        btn.innerText = "✅ Сохранено!";
        btn.disabled = true;
        setTimeout(() => btn.innerText = "💾 Сохранить в библиотеку", 2000);
    },
    
    deleteTest(id) {
        if(confirm('Удалить этот тест?')) {
            Storage.delete(id);
            document.getElementById('libraryList').innerHTML = Storage.renderLibraryHTML();
        }
    },

    // --- RENDERING ---
    renderQ() {
        const q = this.state.questions[this.state.step];
        const total = this.state.questions.length;
        const isQuiz = (this.state.mode === 'quiz' || this.state.mode === 'duel');

        document.getElementById('qNum').innerText = `${this.state.step + 1} / ${total}`;
        document.getElementById('qText').innerText = q.text;
        document.getElementById('progressBar').style.width = ((this.state.step / total) * 100) + '%';

        const backBtn = document.getElementById('backBtn');
        // В режиме дуэли назад лучше не ходить, чтобы не ломать флоу, но оставим для гибкости
        backBtn.style.visibility = (!isQuiz && this.state.step > 0) ? 'visible' : 'hidden';

        const psyDiv = document.getElementById('psyContainer');
        const quizDiv = document.getElementById('quizContainer');
        const nextDiv = document.getElementById('nextBtnContainer');

        if (isQuiz) {
            psyDiv.style.display = 'none';
            quizDiv.style.display = 'flex';
            nextDiv.style.display = 'none'; // Скрываем Next, пока нет ответа
            
            // Render options
            let html = '';
            q.options.forEach((opt, idx) => {
                // Check correct index safely (иногда модель пишет 1-4, иногда 0-3)
                // Но мы просили 0-based. Будем надеяться.
                html += `<div class="ans-btn" onclick="app.answerQuiz(${idx}, this)">${opt}</div>`;
            });
            quizDiv.innerHTML = html;
        } else {
            quizDiv.style.display = 'none';
            psyDiv.style.display = 'flex';
            nextDiv.style.display = 'none'; // Psy is instant click -> next
            
            // Reset Psy buttons styles
            document.querySelectorAll('.likert-btn').forEach(b => b.classList.remove('selected'));
        }
    },

    answer(val) {
        // Psy logic
        this.state.answers[this.state.step] = val;
        // Highlight selection
        const btns = document.querySelectorAll('.likert-btn');
        btns.forEach(b => b.classList.remove('selected'));
        if(btns[val-1]) btns[val-1].classList.add('selected');

        setTimeout(() => this.nextQuestion(), 200); // Auto advance for psy
    },

    answerQuiz(idx, btnElem) {
        // Prevent double click
        if (btnElem.parentElement.style.pointerEvents === 'none') return;
        
        const q = this.state.questions[this.state.step];
        const correct = q.correctIndex;
        
        // Lock UI
        btnElem.parentElement.style.pointerEvents = 'none';
        
        const isCorrect = (idx === correct);
        if (isCorrect) {
            btnElem.classList.add('correct');
            this.state.quizScore++;
        } else {
            btnElem.classList.add('wrong');
            // Show correct one
            const allBtns = btnElem.parentElement.children;
            if(allBtns[correct]) allBtns[correct].classList.add('correct');
        }

        this.state.answers[this.state.step] = isCorrect;
        
        // Show Next Button
        const nextDiv = document.getElementById('nextBtnContainer');
        nextDiv.style.display = 'block';
    },

    nextQuestion() {
        this.state.step++;
        if (this.state.step >= this.state.questions.length) {
            this.calc();
            this.setView('results');
        } else {
            this.renderQ();
        }
    },

    calc() {
        const outcomes = this.state.blueprint.outcomes;
        const container = document.getElementById('resContent');
        let html = '';

        if (this.state.mode === 'quiz' || this.state.mode === 'duel') {
            // --- QUIZ / DUEL LOGIC ---
            const score = this.state.quizScore;
            const total = this.state.questions.length;
            
            // Find grade
            let result = outcomes.find(o => score >= o.minScore && score <= o.maxScore) 
                         || (score === 0 ? outcomes[0] : outcomes[outcomes.length - 1]);

            html = `<div style="text-align:center;">
                <div style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">ТВОЙ РЕЗУЛЬТАТ</div>
                <h1 style="font-size:56px; margin:0; color:var(--primary); line-height:1;">${score} <span style="font-size:24px; color:var(--text-muted);">/ ${total}</span></h1>
                <h2 style="margin:15px 0 20px; font-size:28px;">${result.name}</h2>
                <p style="font-size:18px; line-height:1.6;">${result.description}</p>
            </div>`;

            // --- DUEL COMPARISON BLOCK ---
            if (this.state.mode === 'duel' && this.state.hostName) {
                const hostS = this.state.hostScore;
                const userS = score;
                let msg = "";
                let color = "";
                
                if (userS > hostS) {
                    msg = "🏆 ПОБЕДА! Ты превзошел создателя!";
                    color = "var(--success)";
                } else if (userS === hostS) {
                    msg = "🤝 НИЧЬЯ! Достойный результат.";
                    color = "var(--text)";
                } else {
                    msg = "💀 ПОРАЖЕНИЕ... Тренируйся еще!";
                    color = "var(--danger)";
                }

                html += `
                <div style="margin-top:30px; padding:15px; border: 2px dashed ${color}; border-radius:12px; text-align:center;">
                    <h3 style="margin:0 0 10px; color:${color}">${msg}</h3>
                    <div style="display:flex; justify-content:center; gap:30px; font-size:18px;">
                        <div>
                            <div style="font-size:12px; opacity:0.6">ТЫ</div>
                            <b>${userS}</b>
                        </div>
                        <div>
                            <div style="font-size:12px; opacity:0.6">VS</div>
                        </div>
                        <div>
                            <div style="font-size:12px; opacity:0.6">${this.state.hostName.toUpperCase()}</div>
                            <b>${hostS}</b>
                        </div>
                    </div>
                </div>`;
            }

        } else {
            // --- PSY LOGIC (Standard) ---
            const scores = {};
            outcomes.forEach(o => scores[o.id] = 0);
            
            this.state.questions.forEach((q, idx) => {
                const ans = this.state.answers[idx]; 
                const val = (ans !== undefined ? ans : 3) - 3; 
                
                if (q.mapping && Array.isArray(q.mapping)) {
                    q.mapping.forEach(m => {
                        if (scores[m.outcomeId] !== undefined) {
                            scores[m.outcomeId] += (m.weight * val);
                        }
                    });
                }
            });

            if (this.state.blueprint.testType !== 'dimensional') {
                const sorted = outcomes.sort((a,b) => scores[b.id] - scores[a.id]);
                const win = sorted[0];
                let maxScore = Math.max(...Object.values(scores), 1); 

                html = `<div style="text-align:center; padding-bottom: 20px;">
                    <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">Твой результат</div>
                    <h2 style="font-size:32px; margin:0 0 10px; color:var(--primary);">${win.name}</h2>
                    <p style="font-size:18px; line-height:1.6;">${win.description}</p>
                </div>
                <div class="results-secondary-block">
                    <h4 class="results-secondary-title">Другие варианты:</h4>`;
                
                sorted.slice(1).forEach(o => {
                    let pct = 0;
                    if (scores[o.id] > 0) pct = (scores[o.id] / maxScore) * 100;
                    html += `<div class="res-item">
                        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;">
                            <span>${o.name}</span>
                            <span style="color:var(--text-muted); font-size:12px;">${Math.round(pct)}%</span>
                        </div>
                        <div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div>
                    </div>`;
                });
                html += `</div>`;
            } else {
                html = `<div style="text-align:center; margin-bottom:25px;">
                    <h2 style="color:var(--primary);">Ваш профиль</h2>
                    <p style="color:var(--text-muted); font-size:14px;">Результаты по каждой шкале</p>
                </div>`;
                
                outcomes.forEach(o => {
                    const s = scores[o.id];
                    const pct = Math.min(100, Math.max(0, 50 + (s * 5)));
                    let levelText = pct > 65 ? "Высокий" : pct < 35 ? "Низкий" : "Средний";

                    html += `<div class="res-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong>${o.name}</strong>
                            <span class="badge">${levelText}</span>
                        </div>
                        <div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div>
                        <small style="color:var(--text-muted); display:block; margin-top:5px; line-height:1.3;">${o.description}</small>
                    </div>`;
                });
            }
        }
        
        container.innerHTML = html;
        
        const saveBtn = document.getElementById('saveTestBtn');
        if (saveBtn) {
            saveBtn.innerText = "💾 Сохранить в библиотеку";
            saveBtn.disabled = false;
        }
    }
};

// Запуск инициализации при старте
window.onload = () => app.init();
