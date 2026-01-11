/**
 * AI Universal Test Generator - Core Logic v4.0
 */

// (API Client оставляем как был, он универсален)
const api = {
    detectProvider(key) { return key.startsWith('AIza') ? 'gemini' : 'openrouter'; },
    safeParseJSON(text) {
        try { return JSON.parse(text); } catch (e) {
            const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (match) try { return JSON.parse(match[0]); } catch (e2) {}
            const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (mdMatch) try { return JSON.parse(mdMatch[1]); } catch (e3) {}
            throw new Error("JSON Parse Error");
        }
    },
    async call(task, prompt, schema, key) {
        const provider = this.detectProvider(key);
        // Выбираем промпт в зависимости от режима, который передадим в имени таска (например architect_quiz)
        const sysPrompt = PROMPTS[provider][task]; 
        
        console.log(`📡 API: ${provider} -> ${task}`);

        if (provider === 'gemini') return this.callGemini(sysPrompt, prompt, schema, 'generator', key); // model type always generator for simplicity
        return this.callOpenRouter(sysPrompt, prompt, schema, 'generator', key);
    },
    
    async callOpenRouter(sys, user, schema, type, key) { /* COPY FROM OLD APP.JS */
        const model = CONFIG.providers.openrouter.models[type];
        const messages = [{ role: 'system', content: sys }, { role: 'user', content: user }];
        const res = await fetch(CONFIG.providers.openrouter.endpoint, {
            method: 'POST', headers: CONFIG.providers.openrouter.headers(key),
            body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.7 })
        });
        const data = await res.json();
        return this.safeParseJSON(data.choices[0].message.content);
    },
    async callGemini(sys, user, schema, type, key) { /* COPY FROM OLD APP.JS */
        const model = CONFIG.providers.gemini.models[type];
        const prompt = `${sys}\n\nFORMAT JSON:\n${JSON.stringify(schema)}\n\nTASK: ${user}`;
        const res = await fetch(`${CONFIG.providers.gemini.endpoint}${model}:generateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        return this.safeParseJSON(data.candidates[0].content.parts[0].text);
    }
};

const app = {
    state: { 
        step: 0, 
        mode: 'psy', // 'psy' | 'quiz'
        answers: [], // Для quiz здесь храним true/false (правильно или нет)
        questions: [], 
        blueprint: null, 
        quizScore: 0 // Счетчик правильных ответов
    },

    // --- UI SWITCHING ---
    setMode(mode) {
        this.state.mode = mode;
        
        // Toggles
        document.getElementById('tabPsy').classList.toggle('active', mode === 'psy');
        document.getElementById('tabQuiz').classList.toggle('active', mode === 'quiz');

        // Form Fields
        document.getElementById('audienceGroup').style.display = mode === 'psy' ? 'block' : 'none';
        document.getElementById('difficultyGroup').style.display = mode === 'quiz' ? 'block' : 'none';

        // Hints
        const themeInput = document.getElementById('themeInput');
        themeInput.placeholder = mode === 'psy' 
            ? "Например: Кто ты из Вселенной Гарри Поттера?" 
            : "Например: Знаток географии Европы";
    },

    // --- GENERATION LOGIC ---
    async start(e) {
        if(e) e.preventDefault();
        
        // Reset
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.state.blueprint = null;
        this.state.questions = [];

        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const theme = document.getElementById('themeInput').value;
        const notes = document.getElementById('notesInput').value;
        const count = document.getElementById('qCountInput').value;
        
        if(!apiKey) return alert("Введите API ключ!");

        // Параметры режима
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
            
            // Получаем кол-во вариантов
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

    // --- RENDERING ---
    renderQ() {
        const q = this.state.questions[this.state.step];
        const total = this.state.questions.length;
        const isQuiz = this.state.mode === 'quiz';

        // Header
        document.getElementById('qNum').innerText = `${this.state.step + 1} / ${total}`;
        document.getElementById('qText').innerText = q.text;
        document.getElementById('progressBar').style.width = ((this.state.step / total) * 100) + '%';
        
        // Back Button (Only for Psy mode, Quiz has strict flow)
        const backBtn = document.getElementById('backBtn');
        backBtn.style.visibility = (!isQuiz && this.state.step > 0) ? 'visible' : 'hidden';

        // Containers
        const psyDiv = document.getElementById('psyContainer');
        const quizDiv = document.getElementById('quizContainer');
        const nextDiv = document.getElementById('nextBtnContainer');

        if (isQuiz) {
            psyDiv.style.display = 'none';
            quizDiv.style.display = 'flex';
            nextDiv.style.display = 'none'; // Скрываем кнопку "Далее" пока не ответил
            
            // Render Quiz Options
            let html = '';
            q.options.forEach((opt, idx) => {
                html += `<div class="quiz-opt" id="opt-${idx}" onclick="app.answerQuiz(${idx})">${opt}</div>`;
            });
            quizDiv.innerHTML = html;
        } else {
            psyDiv.style.display = 'grid';
            quizDiv.style.display = 'none';
            nextDiv.style.display = 'none';
            
            // Highlight previous psy answer
            document.querySelectorAll('.likert-opt').forEach(d => d.classList.remove('selected'));
            const prev = this.state.answers[this.state.step];
            if (prev) document.querySelectorAll('.likert-opt')[prev-1].classList.add('selected');
        }
    },

    // --- PSY LOGIC ---
    answer(val) {
        if (this.state.mode === 'quiz') return;
        this.state.answers[this.state.step] = val;
        document.querySelectorAll('.likert-opt')[val-1].classList.add('selected');
        setTimeout(() => this.nextQuestion(), 200);
    },
    
    prevQuestion() {
        if (this.state.step > 0) {
            this.state.step--;
            this.renderQ();
        }
    },

    // --- QUIZ LOGIC ---
    answerQuiz(userIndex) {
        // Блокируем повторные нажатия
        if (document.querySelector('.quiz-opt.disabled')) return;

        const q = this.state.questions[this.state.step];
        const correctIndex = q.correctIndex;
        const isCorrect = (userIndex === correctIndex);

        // Сохраняем результат
        this.state.answers[this.state.step] = isCorrect;
        if (isCorrect) this.state.quizScore++;

        // Визуал
        const userBtn = document.getElementById(`opt-${userIndex}`);
        const correctBtn = document.getElementById(`opt-${correctIndex}`);

        // Блокируем все кнопки
        document.querySelectorAll('.quiz-opt').forEach(el => el.classList.add('disabled'));

        if (isCorrect) {
            userBtn.classList.add('correct');
        } else {
            userBtn.classList.add('wrong');
            // Подсвечиваем правильный с задержкой (чтобы юзер сначала увидел свою ошибку)
            setTimeout(() => correctBtn.classList.add('correct'), 300);
        }

        // Показываем кнопку "Далее"
        document.getElementById('nextBtnContainer').style.display = 'block';
    },

    nextQuestion() {
        this.state.step++;
        if (this.state.step < this.state.questions.length) {
            this.renderQ();
        } else {
            this.finish();
        }
    },

    // --- RESULTS ---
    finish() {
        this.setLoading(true, "📊 Подводим итоги...");
        this.setView('loading');
        setTimeout(() => {
            this.calc(); 
            this.setView('results');
        }, 600);
    },

    calc() {
        const outcomes = this.state.blueprint.outcomes;
        const container = document.getElementById('resContent');
        let html = '';

        if (this.state.mode === 'quiz') {
            // --- 1. ЛОГИКА ВИКТОРИНЫ (QUIZ) ---
            const score = this.state.quizScore;
            const total = this.state.questions.length;
            
            // Ищем подходящий грейд (результат) по диапазону очков
            // Если вдруг логика диапазонов нарушена, берем самый первый или последний
            let result = outcomes.find(o => score >= o.minScore && score <= o.maxScore) 
                         || (score === 0 ? outcomes[0] : outcomes[outcomes.length - 1]);

            html = `<div style="text-align:center;">
                <div style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">ТВОЙ РЕЗУЛЬТАТ</div>
                <h1 style="font-size:56px; margin:0; color:var(--primary); line-height:1;">${score} <span style="font-size:24px; color:var(--text-muted);">/ ${total}</span></h1>
                <h2 style="margin:15px 0 20px; font-size:28px;">${result.name}</h2>
                <p style="font-size:18px; line-height:1.6;">${result.description}</p>
            </div>`;

        } else {
            // --- 2. ЛОГИКА ПСИХОЛОГИЧЕСКОГО ТЕСТА (PSY) ---
            
            // Считаем сырые баллы для каждого outcome
            const scores = {};
            outcomes.forEach(o => scores[o.id] = 0);
            
            this.state.questions.forEach((q, idx) => {
                const ans = this.state.answers[idx]; // Ответ юзера 1..5
                const val = (ans !== undefined ? ans : 3) - 3; // Превращаем в диапазон -2..+2
                
                if (q.mapping && Array.isArray(q.mapping)) {
                    q.mapping.forEach(m => {
                        if (scores[m.outcomeId] !== undefined) {
                            scores[m.outcomeId] += (m.weight * val);
                        }
                    });
                }
            });

            // Ветвление по типу теста: Категория или Шкалы
            if (this.state.blueprint.testType !== 'dimensional') {
                // А) CATEGORICAL (Типология - Один победитель)
                const sorted = outcomes.sort((a,b) => scores[b.id] - scores[a.id]);
                const win = sorted[0];
                let maxScore = Math.max(...Object.values(scores), 1); // Чтобы не делить на ноль

                html = `<div style="text-align:center; padding-bottom: 20px;">
                    <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">Твой результат</div>
                    <h2 style="font-size:32px; margin:0 0 10px; color:var(--primary);">${win.name}</h2>
                    <p style="font-size:18px; line-height:1.6;">${win.description}</p>
                </div>
                <div class="results-secondary-block">
                    <h4 class="results-secondary-title">Другие варианты:</h4>`;
                
                sorted.slice(1).forEach(o => {
                    let pct = 0;
                    if (scores[o.id] > 0) pct = (scores[o.id] / maxScore) * 100; // Процент от лидера
                    
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
                // Б) DIMENSIONAL (Шкалы - Много параметров)
                html = `<div style="text-align:center; margin-bottom:25px;">
                    <h2 style="color:var(--primary);">Ваш профиль</h2>
                    <p style="color:var(--text-muted); font-size:14px;">Результаты по каждой шкале</p>
                </div>`;
                
                outcomes.forEach(o => {
                    const s = scores[o.id];
                    // Нормализация: превращаем абстрактные очки (-10..+10) в проценты (0..100)
                    // Базовая формула: 50% + (очки * коэффициент)
                    const pct = Math.min(100, Math.max(0, 50 + (s * 5)));
                    
                    let levelText = pct > 65 ? "Высокий" : pct < 35 ? "Низкий" : "Средний";
                    // Цвет бейджика можно менять, но пока оставим стандартный

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
        
        // Кнопка сохранения
        const saveBtn = document.getElementById('saveTestBtn');
        if (saveBtn) {
            saveBtn.innerText = "💾 Сохранить в библиотеку";
            saveBtn.disabled = false;
        }
    },

    // --- UTILS ---
    setView(id) { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); document.getElementById(id+'View').classList.add('active'); },
    setLoading(active, msg) { if(active) { this.setView('loading'); document.getElementById('loadTitle').innerText = msg; } },
    openLibrary() { document.getElementById('libraryContent').innerHTML = Storage.renderLibraryHTML(); this.setView('library'); },
    
    saveCurrentTest() {
        const theme = document.getElementById('themeInput').value || "Тест";
        // Важно: передаем mode в сохранение, если нужно, но пока просто сохраняем структуру
        const savedName = Storage.save(this.state.blueprint, this.state.questions, theme);
        if (savedName) { 
            alert(`Сохранено: ${savedName}`); 
            document.getElementById('saveTestBtn').disabled = true; 
        }
    },
    
    // Для загрузки сохраненного теста нужно будет определить его тип (psy/quiz)
    // Но это уже следующий шаг улучшения Storage.js
    loadSavedTest(id) {
        const test = Storage.getById(id);
        if(!test) return;
        this.state.blueprint = test.blueprint;
        this.state.questions = test.questions;
        // Авто-детект режима по структуре blueprint
        this.state.mode = (test.blueprint.testType === 'quiz') ? 'quiz' : 'psy';
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.renderQ();
        this.setView('test');
    }
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('setupForm').addEventListener('submit', (e) => app.start(e));
});
