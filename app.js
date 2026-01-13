/**
 * AI Universal Test Generator - Core Logic v5.0 (Viral Edition)
 * ============================================================
 * Features:
 * - TinyURL v2 Integration (Short Links)
 * - Challenge Mode (Duel)
 * - LZString Compression
 */

// !!! ВСТАВЬТЕ СЮДА ВАШ TINYURL API TOKEN !!!
// Получить здесь: https://tinyurl.com/app/settings/api
const TINY_TOKEN = 'lBjFvZGQQmPD56gcBpQBgdyMlezZCxwNShVIlh9wA3W4HFtDOI0418CnoXBx'; 

// (API Client оставляем без изменений)
const api = {
    detectProvider(key) { return key.startsWith('AIza') ? 'gemini' : 'openrouter'; },
    safeParseJSON(text) { try { return JSON.parse(text); } catch (e) { const match = text.match(/(\{[^]*\}|\[[^]*\])/); if (match) try { return JSON.parse(match[0]); } catch (e2) {} const mdMatch = text.match(/```(?:json)?\s*([^]*?)\s*```/); if (mdMatch) try { return JSON.parse(mdMatch[1]); } catch (e3) {} throw new Error("JSON Parse Error"); } },
    async call(task, prompt, schema, key) { const provider = this.detectProvider(key); const sysPrompt = PROMPTS[provider][task]; console.log(`📡 API: ${provider} -> ${task}`); if (provider === 'gemini') return this.callGemini(sysPrompt, prompt, schema, 'generator', key); return this.callOpenRouter(sysPrompt, prompt, schema, 'generator', key); },
    async callOpenRouter(sys, user, schema, type, key) { const model = CONFIG.providers.openrouter.models[type]; const messages = [{ role: 'system', content: sys }, { role: 'user', content: user }]; const res = await fetch(CONFIG.providers.openrouter.endpoint, { method: 'POST', headers: CONFIG.providers.openrouter.headers(key), body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.7 }) }); const data = await res.json(); return this.safeParseJSON(data.choices[0].message.content); },
    async callGemini(sys, user, schema, type, key) { const model = CONFIG.providers.gemini.models[type]; const prompt = `${sys}\n\nFORMAT JSON:\n${JSON.stringify(schema)}\n\nTASK: ${user}`; const res = await fetch(`${CONFIG.providers.gemini.endpoint}${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); const data = await res.json(); return this.safeParseJSON(data.candidates[0].content.parts[0].text); }
};

const app = {
    state: {
        step: 0,
        mode: 'psy',        // 'psy' | 'quiz' | 'duel'
        answers: [],
        questions: [],
        blueprint: null,
        quizScore: 0,
        
        // Данные для режима Дуэли
        duelHostName: null,
        duelHostScore: null
    },

    // --- Инициализация ---
    init() {
        this.checkHash(); // Проверяем, не перешли ли мы по ссылке-приглашению
        
        // Обработка кнопки "Назад" в браузере
        window.onpopstate = () => {
             // Сбрасываем хэш, чтобы не зациклиться
             history.replaceState(null, document.title, window.location.pathname);
             location.reload(); 
        };
    },

    // --- ЛОГИКА ДУЭЛЕЙ (VIRAL LOOP) ---
    checkHash() {
        if (window.location.hash.startsWith('#d=')) {
            try {
                const compressed = window.location.hash.substring(3); // Убираем '#d='
                const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
                const data = JSON.parse(decompressed);

                if (data && data.t && data.q) {
                    console.log("⚔️ Duel Data Loaded:", data);
                    
                    // Загружаем данные в стейт, но пока не начинаем тест
                    this.state.mode = 'duel'; // Включаем особый режим
                    this.state.blueprint = data.t; // Blueprint
                    this.state.questions = data.q; // Questions
                    this.state.duelHostName = data.h || "Аноним";
                    this.state.duelHostScore = data.s || 0;

                    // Показываем экран вызова (Duel View)
                    this.showDuelIntro();
                }
            } catch (e) {
                console.error("Ошибка чтения дуэльной ссылки:", e);
                alert("Ссылка повреждена или устарела :(");
                window.location.hash = "";
            }
        }
    },

    showDuelIntro() {
        // Скрываем все стандартные экраны
        document.getElementById('setupView').style.display = 'none';
        document.getElementById('testView').style.display = 'none';
        document.getElementById('resultsView').style.display = 'none';
        
        // Заполняем и показываем экран дуэли
        const dv = document.getElementById('duelView');
        if(dv) {
            document.getElementById('duelHostName').innerText = this.state.duelHostName;
            document.getElementById('duelHostScore').innerText = this.state.duelHostScore;
            document.getElementById('duelThemeTitle').innerText = this.state.blueprint.theme || "Секретная тема"; // Если тему не сохраняли, будет заглушка
            document.getElementById('duelQCount').innerText = this.state.questions.length;
            dv.style.display = 'block';
        }
    },

    startDuelTest() {
        document.getElementById('duelView').style.display = 'none';
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.renderQ();
        this.setView('test');
    },

    // --- ГЕНЕРАЦИЯ ССЫЛКИ (SHARING) ---
    async createShareLink() {
        const btn = document.getElementById('shareBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Создаем ссылку...";
        btn.disabled = true;

        try {
            // 1. Собираем данные
            // Если это Квиз, передаем счет. Если Психотест, счет 0 (не важен)
            const isQuiz = (this.state.mode === 'quiz' || this.state.mode === 'duel');
            const score = isQuiz ? this.state.quizScore : 0;
            const name = prompt("Как тебя представить в вызове?", "Мастер Игры") || "Аноним";

            const payload = {
                h: name,                    // Host Name
                s: score,                   // Host Score
                t: this.state.blueprint,    // Test Blueprint (Results info)
                q: this.state.questions     // Questions
            };
            // Сохраняем тему в blueprint, если её нет (костыль для старых версий)
            if(!payload.t.theme) payload.t.theme = document.getElementById('themeInput').value || "Тест";

            // 2. Сжимаем
            const jsonString = JSON.stringify(payload);
            const compressed = LZString.compressToEncodedURIComponent(jsonString);
            const longUrl = `${window.location.origin}${window.location.pathname}#d=${compressed}`;

            console.log(`📦 Payload size: ${jsonString.length} chars -> Compressed: ${compressed.length} chars`);

            // 3. Сокращаем через TinyURL v2
            const shortUrl = await this.shortenWithTinyURL(longUrl);

            // 4. Показываем результат
            prompt("Скопируй эту ссылку и отправь другу:", shortUrl);

        } catch (e) {
            console.error(e);
            alert("Не удалось создать короткую ссылку. Попробуйте позже.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async shortenWithTinyURL(longUrl) {
        // Официальный TinyURL API v2
        const response = await fetch('https://api.tinyurl.com/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TINY_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: longUrl,
                domain: "tiny.one" // Самый короткий домен
            })
        });

        if (!response.ok) throw new Error('TinyURL API Error');
        const data = await response.json();
        return data.data.tiny_url;
    },

    // --- UI SWITCHING ---
    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('tabPsy').classList.toggle('active', mode === 'psy');
        document.getElementById('tabQuiz').classList.toggle('active', mode === 'quiz');
        document.getElementById('audienceGroup').style.display = mode === 'psy' ? 'block' : 'none';
        document.getElementById('difficultyGroup').style.display = mode === 'quiz' ? 'block' : 'none';
        const themeInput = document.getElementById('themeInput');
        themeInput.placeholder = mode === 'psy' ? "Например: Кто ты из Вселенной Гарри Поттера?" : "Например: Знаток географии Европы";
    },

    // --- GENERATION LOGIC ---
    async start(e) {
        if(e) e.preventDefault();
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.state.blueprint = null;
        this.state.questions = [];
        this.state.duelHostName = null; // Сброс дуэли при новой генерации

        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const theme = document.getElementById('themeInput').value;
        const notes = document.getElementById('notesInput').value;
        const count = document.getElementById('qCountInput').value;

        if(!apiKey) return alert("Введите API ключ!");

        const isQuiz = this.state.mode === 'quiz';
        const contextParam = isQuiz ? `Сложность/Вариантов: ${document.getElementById('difficultyInput').value}` : `Аудитория: ${document.getElementById('audienceInput').value}`;
        const taskSuffix = isQuiz ? '_quiz' : '_psy';
        const schemaBP = isQuiz ? SCHEMAS.quiz_blueprint : SCHEMAS.psy_blueprint;
        const schemaQ = isQuiz ? SCHEMAS.quiz_questions : SCHEMAS.psy_questions;

        this.setLoading(true, isQuiz ? "🧠 Составляем программу викторины..." : "🧠 Архитектор проектирует тест...");
        document.getElementById('errorBox').style.display = 'none';

        try {
            const notesText = notes ? `УТОЧНЕНИЯ: "${notes}".` : "";
            const archPrompt = `Тема: "${theme}". ${contextParam}. ${notesText} Создай структуру.`;
            this.state.blueprint = await api.call('architect' + taskSuffix, archPrompt, schemaBP, apiKey);
            
            // Сохраняем тему в blueprint для будущего шаринга
            this.state.blueprint.theme = theme; 

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

    // --- CALCULATE RESULTS (UPDATED) ---
    calc() {
        const outcomes = this.state.blueprint.outcomes;
        const container = document.getElementById('resContent');
        let html = '';

        // 1. ЛОГИКА ВИКТОРИНЫ / ДУЭЛИ
        if (this.state.mode === 'quiz' || this.state.mode === 'duel') {
            const score = this.state.quizScore;
            const total = this.state.questions.length;
            
            let result = outcomes.find(o => score >= o.minScore && score <= o.maxScore) 
                         || (score === 0 ? outcomes[0] : outcomes[outcomes.length - 1]);

            // Блок сравнения для дуэли
            let duelBlock = '';
            if (this.state.mode === 'duel') {
                const hostScore = this.state.duelHostScore;
                const hostName = this.state.duelHostName;
                let verdict = "";
                let color = "";
                
                if (score > hostScore) { verdict = "ТЫ ПОБЕДИЛ! 🏆"; color = "#4caf50"; }
                else if (score === hostScore) { verdict = "НИЧЬЯ! 🤝"; color = "#ffd700"; }
                else { verdict = "ТЫ ПРОИГРАЛ... 💀"; color = "#f44336"; }

                duelBlock = `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin:0 0 10px; color:${color};">${verdict}</h3>
                    <div style="display:flex; justify-content:space-around; font-size:18px;">
                        <div>👤 Ты: <strong>${score}</strong></div>
                        <div>🆚 ${hostName}: <strong>${hostScore}</strong></div>
                    </div>
                </div>`;
            }

            html = `<div style="text-align:center;">
                <div style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">ТВОЙ РЕЗУЛЬТАТ</div>
                <h1 style="font-size:56px; margin:0; color:var(--primary); line-height:1;">${score} <span style="font-size:24px; color:var(--text-muted);">/ ${total}</span></h1>
                ${duelBlock}
                <h2 style="margin:15px 0 20px; font-size:28px;">${result.name}</h2>
                <p style="font-size:18px; line-height:1.6;">${result.description}</p>
            </div>`;

        } else {
            // 2. ЛОГИКА ПСИХОЛОГИЧЕСКОГО ТЕСТА (PSY) - без изменений
            const scores = {};
            outcomes.forEach(o => scores[o.id] = 0);
            this.state.questions.forEach((q, idx) => {
                const ans = this.state.answers[idx]; 
                const val = (ans !== undefined ? ans : 3) - 3; 
                if (q.mapping && Array.isArray(q.mapping)) {
                    q.mapping.forEach(m => { if (scores[m.outcomeId] !== undefined) scores[m.outcomeId] += (m.weight * val); });
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
                <div class="results-secondary-block"> <h4 class="results-secondary-title">Другие варианты:</h4>`;
                sorted.slice(1).forEach(o => {
                    let pct = 0; if (scores[o.id] > 0) pct = (scores[o.id] / maxScore) * 100;
                    html += `<div class="res-item"><div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;"><span>${o.name}</span><span style="color:var(--text-muted); font-size:12px;">${Math.round(pct)}%</span></div><div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div></div>`;
                });
                html += `</div>`;
            } else {
                html = `<div style="text-align:center; margin-bottom:25px;"><h2 style="color:var(--primary);">Ваш профиль</h2><p style="color:var(--text-muted); font-size:14px;">Результаты по каждой шкале</p></div>`;
                outcomes.forEach(o => {
                    const s = scores[o.id];
                    const pct = Math.min(100, Math.max(0, 50 + (s * 5)));
                    let levelText = pct > 65 ? "Высокий" : pct < 35 ? "Низкий" : "Средний";
                    html += `<div class="res-item"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${o.name}</strong><span class="badge">${levelText}</span></div><div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div><small style="color:var(--text-muted); display:block; margin-top:5px; line-height:1.3;">${o.description}</small></div>`;
                });
            }
        }

        // --- ДОБАВЛЯЕМ КНОПКИ ВНИЗУ ---
        // Кнопка шаринга теперь универсальна
        const shareBtnText = (this.state.mode === 'quiz' || this.state.mode === 'duel') ? "⚔️ Бросить вызов / Поделиться" : "📤 Поделиться результатом";

        html += `
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:30px;">
            <button id="saveTestBtn" class="btn" onclick="app.saveTest()" style="flex:1; min-width:200px;">
                💾 Сохранить в библиотеку
            </button>
            <button id="shareBtn" class="btn" onclick="app.createShareLink()" style="flex:1; min-width:200px; background: var(--accent);">
                ${shareBtnText}
            </button>
        </div>
        `;
        
        container.innerHTML = html;
    },

    // --- UTILS & RENDER (Restored from previous versions) ---
    renderQ() {
        const q = this.state.questions[this.state.step];
        const total = this.state.questions.length;
        const isQuiz = (this.state.mode === 'quiz' || this.state.mode === 'duel');

        document.getElementById('qNum').innerText = `${this.state.step + 1} / ${total}`;
        document.getElementById('qText').innerText = q.text;
        document.getElementById('progressBar').style.width = ((this.state.step / total) * 100) + '%';
        
        const backBtn = document.getElementById('backBtn');
        backBtn.style.visibility = (!isQuiz && this.state.step > 0) ? 'visible' : 'hidden';

        const psyDiv = document.getElementById('psyContainer');
        const quizDiv = document.getElementById('quizContainer');
        const nextDiv = document.getElementById('nextBtnContainer');

        if (isQuiz) {
            psyDiv.style.display = 'none';
            quizDiv.style.display = 'flex';
            nextDiv.style.display = 'none';

            let html = '';
            q.options.forEach((opt, idx) => {
                html += `<button class="quiz-option-btn" onclick="app.handleQuizAnswer(${idx}, this)">${opt}</button>`;
            });
            quizDiv.innerHTML = html;
        } else {
            psyDiv.style.display = 'flex';
            quizDiv.style.display = 'none';
            nextDiv.style.display = 'flex';
            
            const btns = document.querySelectorAll('.scale-btn');
            btns.forEach(b => b.classList.remove('selected'));
            const prevAns = this.state.answers[this.state.step];
            if (prevAns !== undefined) {
                btns.forEach(b => { if(parseInt(b.dataset.val) === prevAns) b.classList.add('selected'); });
            }
        }
    },
    handleScale(val, btn) {
        document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.state.answers[this.state.step] = parseInt(val);
    },
    nextQ() {
        if (this.state.mode === 'psy' && this.state.answers[this.state.step] === undefined) return alert("Выберите вариант ответа!");
        if (this.state.step < this.state.questions.length - 1) {
            this.state.step++;
            this.renderQ();
        } else {
            this.calc();
            this.setView('results');
        }
    },
    prevQ() {
        if (this.state.step > 0) {
            this.state.step--;
            this.renderQ();
        }
    },
    handleQuizAnswer(idx, btn) {
        const q = this.state.questions[this.state.step];
        const isCorrect = (idx === q.correctIndex);
        
        // Визуализация
        if (isCorrect) {
            btn.classList.add('correct');
            this.state.quizScore++;
        } else {
            btn.classList.add('wrong');
            // Подсветить правильный
            const allBtns = document.getElementById('quizContainer').children;
            if(allBtns[q.correctIndex]) allBtns[q.correctIndex].classList.add('correct');
        }

        // Блокируем клики
        const allBtns = document.querySelectorAll('.quiz-option-btn');
        allBtns.forEach(b => b.disabled = true);

        // Ждем и идем дальше
        setTimeout(() => {
            if (this.state.step < this.state.questions.length - 1) {
                this.state.step++;
                this.renderQ();
            } else {
                this.calc();
                this.setView('results');
            }
        }, CONFIG.ui?.answerDelayMs || 1000); 
    },
    saveTest() {
        const name = Storage.save(this.state.blueprint, this.state.questions, this.state.blueprint.theme || document.getElementById('themeInput').value);
        alert(`Тест "${name}" сохранен в библиотеку!`);
        document.getElementById('saveTestBtn').innerText = "✅ Сохранено";
        document.getElementById('saveTestBtn').disabled = true;
    },
    loadSavedTest(id) {
        const test = Storage.getById(id);
        if(!test) return;
        this.state.blueprint = test.blueprint;
        this.state.questions = test.questions;
        // Восстанавливаем режим
        const type = test.blueprint.testType || 'categorical';
        this.state.mode = (type === 'quiz') ? 'quiz' : 'psy';
        
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        
        this.renderQ();
        this.setView('test');
    },
    deleteTest(id) {
        if(confirm('Удалить тест?')) {
            Storage.delete(id);
            this.setView('library');
        }
    },
    setView(view) {
        ['setupView', 'testView', 'resultsView', 'libraryView', 'duelView'].forEach(v => {
            const el = document.getElementById(v);
            if(el) el.style.display = 'none';
        });

        // Specific rendering
        if (view === 'library') {
            document.getElementById('libraryList').innerHTML = Storage.renderLibraryHTML();
        }

        document.getElementById(view + 'View').style.display = 'block';
    },
    setLoading(active, text) {
        const el = document.getElementById('loadingOverlay');
        const t = document.getElementById('loadingText');
        if (active) {
            el.style.display = 'flex';
            t.innerText = text || "Загрузка...";
        } else {
            el.style.display = 'none';
        }
    }
};

// Запуск при загрузке
window.onload = () => app.init();
