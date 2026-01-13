/**
 * AI Universal Test Generator - Core Logic v5.3 (Final Polish)
 */

// !!! ВСТАВЬТЕ СЮДА ВАШ TINYURL API TOKEN !!!
const TINY_TOKEN = 'lBjFvZGQQmPD56gcBpQBgdyMlezZCxwNShVIlh9wA3W4HFtDOI0418CnoXBx'; 

// --- API Client ---
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
        duelHostName: null,
        duelHostScore: null
    },

    // --- Инициализация ---
    init() {
        this.checkHash();
        window.onpopstate = () => {
             history.replaceState(null, document.title, window.location.pathname);
             location.reload(); 
        };
    },

    // --- ЛОГИКА ДУЭЛЕЙ ---
    checkHash() {
        if (window.location.hash.startsWith('#d=')) {
            try {
                if (typeof LZString === 'undefined') throw new Error("LZString library not loaded");
                const compressed = window.location.hash.substring(3);
                const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
                const data = JSON.parse(decompressed);

                if (data && data.t && data.q) {
                    this.state.mode = 'duel';
                    this.state.blueprint = data.t;
                    this.state.questions = data.q;
                    this.state.duelHostName = data.h || "Аноним";
                    this.state.duelHostScore = data.s || 0;
                    this.showDuelIntro();
                }
            } catch (e) {
                console.error("Ошибка дуэли:", e);
                window.location.hash = "";
            }
        }
    },

    showDuelIntro() {
        document.getElementById('setupView').style.display = 'none';
        const dv = document.getElementById('duelView');
        if(dv) {
            document.getElementById('duelHostName').innerText = this.state.duelHostName;
            document.getElementById('duelHostScore').innerText = this.state.duelHostScore;
            document.getElementById('duelThemeTitle').innerText = this.state.blueprint.theme || "Тест";
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

    // --- БИБЛИОТЕКА ---
    openLibrary() {
        this.setView('library');
        // Исправлено: используем libraryContent, а не libraryList
        document.getElementById('libraryContent').innerHTML = Storage.renderLibraryHTML();
    },

    closeLibrary() {
        this.setView('setup');
    },

    // --- UI SWITCHING ---
    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('tabPsy').classList.toggle('active', mode === 'psy');
        document.getElementById('tabQuiz').classList.toggle('active', mode === 'quiz');
        document.getElementById('audienceGroup').style.display = mode === 'psy' ? 'block' : 'none';
        document.getElementById('difficultyGroup').style.display = mode === 'quiz' ? 'block' : 'none';
        document.getElementById('themeInput').placeholder = mode === 'psy' ? "Например: Кто ты из Вселенной Гарри Поттера?" : "Например: Знаток географии Европы";
    },

    // --- ГЕНЕРАЦИЯ ---
    async start(e) {
        if(e) e.preventDefault();
        
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.state.blueprint = null;
        this.state.questions = [];
        this.state.duelHostName = null;

        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const theme = document.getElementById('themeInput').value;
        const notes = document.getElementById('notesInput').value;
        const count = document.getElementById('qCountInput').value;

        if(!apiKey) return alert("Введите API ключ!");

        const isQuiz = this.state.mode === 'quiz';
        const contextParam = isQuiz ? `Сложность/Вариантов: ${document.getElementById('difficultyInput').value}` : `Аудитория: ${document.getElementById('audienceInput').value}`;
        const taskSuffix = isQuiz ? '_quiz' : '_psy';
        
        this.setLoading(true, isQuiz ? "🧠 Составляем программу викторины..." : "🧠 Архитектор проектирует тест...");
        document.getElementById('errorBox').style.display = 'none';

        try {
            const notesText = notes ? `УТОЧНЕНИЯ: "${notes}".` : "";
            const archPrompt = `Тема: "${theme}". ${contextParam}. ${notesText} Создай структуру.`;
            this.state.blueprint = await api.call('architect' + taskSuffix, archPrompt, (isQuiz ? SCHEMAS.quiz_blueprint : SCHEMAS.psy_blueprint), apiKey);
            this.state.blueprint.theme = theme; 

            this.setLoading(true, "✍️ Придумываем вопросы...");
            const optionsCount = isQuiz ? document.getElementById('difficultyInput').value : 0;
            const optionsInstruction = isQuiz ? `СТРОГОЕ ТРЕБОВАНИЕ: В каждом вопросе должно быть ровно ${optionsCount} варианта(ов) ответа!` : "";
            const genPrompt = `Тема: ${theme}. Структура: ${JSON.stringify(this.state.blueprint.outcomes)}. Кол-во вопросов: ${count}. ${optionsInstruction} ${notesText}`;
            
            const res = await api.call('generator' + taskSuffix, genPrompt, (isQuiz ? SCHEMAS.quiz_questions : SCHEMAS.psy_questions), apiKey);
            this.state.questions = res.questions;
            
            this.setLoading(false);
            this.renderQ();
            this.setView('test');

        } catch (err) {
            console.error(err);
            this.setLoading(false);
            document.getElementById('errorBox').style.display = 'block';
            document.getElementById('errorBox').innerHTML = `Ошибка: ${err.message}`;
            this.setView('setup');
        }
    },

    // --- РЕНДЕРИНГ ВОПРОСОВ ---
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

        if (isQuiz) {
            psyDiv.style.display = 'none';
            quizDiv.style.display = 'grid'; // Используем grid для красивого отображения

            let html = '';
            q.options.forEach((opt, idx) => {
                html += `<button class="quiz-option-btn" onclick="app.handleQuizAnswer(${idx}, this)">${opt}</button>`;
            });
            quizDiv.innerHTML = html;
        } else {
            psyDiv.style.display = 'grid'; // Grid для шкалы
            quizDiv.style.display = 'none';
            
            const btns = psyDiv.querySelectorAll('div'); 
            btns.forEach(b => b.classList.remove('selected'));
            
            const prevAns = this.state.answers[this.state.step];
            if (prevAns !== undefined) {
                 if(btns[prevAns-1]) btns[prevAns-1].classList.add('selected');
            }
        }
    },
    
    // --- ОБРАБОТЧИКИ ОТВЕТОВ ---

    // 1. Психологический тест (авто-переход)
    answer(val) {
        this.state.answers[this.state.step] = parseInt(val);
        
        // Подсветка
        const container = document.getElementById('psyContainer');
        const btns = container.querySelectorAll('.likert-opt');
        btns.forEach(b => b.classList.remove('selected'));
        if(btns[val-1]) btns[val-1].classList.add('selected');

        // АВТО-ПЕРЕХОД (новое)
        setTimeout(() => {
            this.nextQuestion();
        }, 300);
    },

    // 2. Викторина (с проверкой)
    handleQuizAnswer(idx, btn) {
        const q = this.state.questions[this.state.step];
        const isCorrect = (idx === q.correctIndex);
        
        if (isCorrect) {
            btn.classList.add('correct');
            this.state.quizScore++;
        } else {
            btn.classList.add('wrong');
            const allBtns = document.querySelectorAll('.quiz-option-btn');
            if(allBtns[q.correctIndex]) allBtns[q.correctIndex].classList.add('correct');
        }

        const allBtns = document.querySelectorAll('.quiz-option-btn');
        allBtns.forEach(b => b.disabled = true);

        setTimeout(() => {
            this.nextQuestion();
        }, 1200); 
    },

    nextQuestion() {
        if (this.state.step < this.state.questions.length - 1) {
            this.state.step++;
            this.renderQ();
        } else {
            this.calc();
            this.setView('results');
        }
    },
    
    prevQuestion() {
        if (this.state.step > 0) {
            this.state.step--;
            this.renderQ();
        }
    },

    // --- ПОДСЧЕТ РЕЗУЛЬТАТОВ ---
    calc() {
        const outcomes = this.state.blueprint.outcomes;
        const container = document.getElementById('resContent');
        let html = '';

        if (this.state.mode === 'quiz' || this.state.mode === 'duel') {
            const score = this.state.quizScore;
            const total = this.state.questions.length;
            
            let result = outcomes.find(o => score >= o.minScore && score <= o.maxScore) || outcomes[0];
            
            let duelBlock = '';
            if (this.state.mode === 'duel') {
                const hostScore = this.state.duelHostScore;
                const hostName = this.state.duelHostName;
                let verdict = "", color = "";
                
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
            const scores = {};
            outcomes.forEach(o => scores[o.id] = 0);
            this.state.questions.forEach((q, idx) => {
                const ans = this.state.answers[idx]; 
                const val = (ans !== undefined ? ans : 3) - 3; 
                if (q.mapping) q.mapping.forEach(m => { if (scores[m.outcomeId] !== undefined) scores[m.outcomeId] += (m.weight * val); });
            });

            if (this.state.blueprint.testType !== 'dimensional') {
                const sorted = outcomes.sort((a,b) => scores[b.id] - scores[a.id]);
                const win = sorted[0];
                let maxScore = Math.max(...Object.values(scores), 1);

                html = `<div style="text-align:center; padding-bottom: 20px;">
                    <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">Твой результат</div>
                    <h2 style="font-size:32px; margin:0 0 10px; color:var(--primary);">${win.name}</h2>
                    <p style="font-size:18px; line-height:1.6;">${win.description}</p>
                </div>`;
                // Опционально: можно вернуть блок "другие варианты" если нужно
            } else {
                html = `<div style="text-align:center; margin-bottom:25px;"><h2 style="color:var(--primary);">Ваш профиль</h2></div>`;
                outcomes.forEach(o => {
                    const s = scores[o.id];
                    const pct = Math.min(100, Math.max(0, 50 + (s * 5)));
                    html += `<div><strong>${o.name}</strong>: ${pct}%</div>`;
                });
            }
        }

        const shareBtnText = (this.state.mode === 'quiz' || this.state.mode === 'duel') ? "⚔️ Бросить вызов / Поделиться" : "📤 Поделиться результатом";

        html += `
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:30px;">
            <button id="saveTestBtn" class="btn" onclick="app.saveTest()" style="flex:1; min-width:200px;">💾 Сохранить</button>
            <button id="shareBtn" class="btn" onclick="app.createShareLink()" style="flex:1; min-width:200px; background: var(--accent);">${shareBtnText}</button>
        </div>
        `;
        
        container.innerHTML = html;
    },

    // --- SHARING (TinyURL v2 API) ---
    async createShareLink() {
        if(!TINY_TOKEN) return alert("Пожалуйста, добавьте ваш TinyURL Token в app.js!");
        if(typeof LZString === 'undefined') return alert("Ошибка: Библиотека LZString не загружена!");

        const btn = document.getElementById('shareBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Создаем ссылку...";
        btn.disabled = true;

        try {
            const isQuiz = (this.state.mode === 'quiz' || this.state.mode === 'duel');
            const score = isQuiz ? this.state.quizScore : 0;
            const name = prompt("Как тебя представить?", "Мастер Игры") || "Аноним";

            const payload = { h: name, s: score, t: this.state.blueprint, q: this.state.questions };
            // Исправлено: сохранение темы в blueprint если её там нет
            if(!payload.t.theme) payload.t.theme = document.getElementById('themeInput').value || "Тест";

            const jsonString = JSON.stringify(payload);
            const compressed = LZString.compressToEncodedURIComponent(jsonString);
            const longUrl = `${window.location.origin}${window.location.pathname}#d=${compressed}`;

            // Запрос к официальному TinyURL API v2
            const response = await fetch('https://api.tinyurl.com/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TINY_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: longUrl,
                    domain: "tiny.one"
                })
            });

            if (!response.ok) throw new Error('TinyURL API Error');
            const data = await response.json();
            const shortUrl = data.data.tiny_url;

            prompt("Скопируй ссылку и отправь другу:", shortUrl);

        } catch (e) {
            console.error(e);
            alert("Не удалось создать ссылку. Проверьте консоль или ваш API Token.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    saveTest() {
        const name = Storage.save(this.state.blueprint, this.state.questions, this.state.blueprint.theme || document.getElementById('themeInput').value);
        alert(`Тест "${name}" сохранен!`);
        document.getElementById('saveTestBtn').innerText = "✅ Сохранено";
        document.getElementById('saveTestBtn').disabled = true;
    },
    
    loadSavedTest(id) {
        const test = Storage.getById(id);
        if(!test) return;
        this.state.blueprint = test.blueprint;
        this.state.questions = test.questions;
        this.state.mode = (test.blueprint.testType === 'quiz') ? 'quiz' : 'psy';
        
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        
        this.renderQ();
        this.setView('test');
    },

    deleteTest(id) {
        if(confirm('Удалить тест?')) {
            Storage.delete(id);
            this.openLibrary(); // Обновляем список
        }
    },

    setView(view) {
        ['setupView', 'testView', 'resultsView', 'libraryView', 'duelView'].forEach(v => {
            const el = document.getElementById(v);
            if(el) el.style.display = 'none';
        });
        document.getElementById(view + 'View').style.display = 'block';
    },

    setLoading(active, text) {
        const el = document.getElementById('loadingOverlay');
        const t = document.getElementById('loadingText');
        if (el) {
            el.style.display = active ? 'flex' : 'none';
            if(t && text) t.innerText = text;
        }
    }
};

window.onload = () => app.init();
