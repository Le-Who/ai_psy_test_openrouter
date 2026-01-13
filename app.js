/**
 * AI Universal Test Generator - Core Logic v6.0 (Fixed Scoring System)
 */

const TINY_TOKEN = 'lBjFvZGQQmPD56gcBpQBgdyMlezZCxwNShVIlh9wA3W4HFtDOI0418CnoXBx';

const api = {
    detectProvider(key) { return key.startsWith('AIza') ? 'gemini' : 'openrouter'; },
    safeParseJSON(text) { try { return JSON.parse(text); } catch (e) { const match = text.match(/(\{[^]*\}|\[[^]*\])/); if (match) try { return JSON.parse(match[0]); } catch (e2) {} const mdMatch = text.match(/```(?:json)?\s*([^]*?)\s*```/); if (mdMatch) try { return JSON.parse(mdMatch[1]); } catch (e3) {} throw new Error("JSON Parse Error"); } },
    async call(task, prompt, schema, key) { const provider = this.detectProvider(key); const sysPrompt = PROMPTS[provider][task]; console.log(`📡 API: ${provider} -> ${task}`); if (provider === 'gemini') return this.callGemini(sysPrompt, prompt, schema, 'generator', key); return this.callOpenRouter(sysPrompt, prompt, schema, 'generator', key); },
    
    async callOpenRouter(sys, user, schema, type, key) { 
        const model = CONFIG.providers.openrouter.models[type]; 
        const messages = [{ role: 'system', content: sys }, { role: 'user', content: user }]; 
        const res = await fetch(CONFIG.providers.openrouter.endpoint, { 
            method: 'POST', 
            headers: CONFIG.providers.openrouter.headers(key), 
            body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.7 }) 
        }); 
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenRouter API Error (${res.status}): ${errText}`);
        }
        const data = await res.json(); 
        if (!data.choices || !data.choices.length) {
            console.error("OpenRouter Response:", data);
            throw new Error("API вернул пустой ответ. Проверьте баланс или ключ.");
        }
        return this.safeParseJSON(data.choices[0].message.content); 
    },
    
    async callGemini(sys, user, schema, type, key) { 
        const model = CONFIG.providers.gemini.models[type]; 
        const prompt = `${sys}\n\nFORMAT JSON:\n${JSON.stringify(schema)}\n\nTASK: ${user}`; 
        const res = await fetch(`${CONFIG.providers.gemini.endpoint}${model}:generateContent?key=${key}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) 
        }); 
        const data = await res.json(); 
        return this.safeParseJSON(data.candidates[0].content.parts[0].text); 
    }
};

const app = {
    state: {
        step: 0,
        mode: 'psy',
        answers: [],
        questions: [],
        blueprint: null,
        quizScore: 0,
        duelHostName: null,
        duelHostScore: null,
        duelHostResultName: null
    },

    init() {
        this.checkHash();
        window.onpopstate = () => { history.replaceState(null, document.title, window.location.pathname); location.reload(); };
    },

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
                    this.state.duelHostResultName = data.r || null;
                    this.showDuelIntro();
                }
            } catch (e) {
                console.error("Link Error:", e);
                window.location.hash = "";
            }
        }
    },

    showDuelIntro() {
        document.getElementById('setupView').style.display = 'none';
        const dv = document.getElementById('duelView');
        const isQuiz = (this.state.blueprint.testType === 'quiz');
        const title = isQuiz ? "ВЫЗОВ ПРИНЯТ? ⚔️" : "СМОТРИ МОЙ РЕЗУЛЬТАТ! 👀";
        let desc = "";

        if (isQuiz) {
            desc = `Пользователь <strong style="color:#fff;">${this.state.duelHostName}</strong> набрал <strong style="color:var(--accent);">${this.state.duelHostScore}</strong> баллов.<br>Сможешь его победить?`;
        } else {
            const resultText = this.state.duelHostResultName ? `Ему выпало: <strong style="color:var(--accent);">${this.state.duelHostResultName}</strong>` : "Он уже прошел этот тест.";
            desc = `Пользователь <strong style="color:#fff;">${this.state.duelHostName}</strong> прошел тест.<br>${resultText}<br>А кто ты?`;
        }

        document.getElementById('duelView').querySelector('h1').innerText = title;
        document.getElementById('duelView').querySelector('p').innerHTML = desc;
        document.getElementById('duelThemeTitle').innerText = this.state.blueprint.theme || "Тест";
        document.getElementById('duelQCount').innerText = this.state.questions.length;
        dv.style.display = 'block';
    },

    startDuelTest() {
        document.getElementById('duelView').style.display = 'none';
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        const type = this.state.blueprint.testType || 'categorical';
        if (type === 'quiz') this.state.mode = 'duel';
        else this.state.mode = 'psy';
        this.renderQ();
        this.setView('test');
    },

    openLibrary() {
        this.setView('library');
        document.getElementById('libraryContent').innerHTML = Storage.renderLibraryHTML();
    },
    closeLibrary() { this.setView('setup'); },

    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('tabPsy').classList.toggle('active', mode === 'psy');
        document.getElementById('tabQuiz').classList.toggle('active', mode === 'quiz');
        document.getElementById('audienceGroup').style.display = mode === 'psy' ? 'block' : 'none';
        document.getElementById('difficultyGroup').style.display = mode === 'quiz' ? 'block' : 'none';
        document.getElementById('themeInput').placeholder = mode === 'psy' ? "Например: Кто ты из Вселенной Гарри Поттера?" : "Например: Знаток географии Европы";
    },

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
        const contextParam = isQuiz ? `Сложность: ${document.getElementById('difficultyInput').value}` : `Аудитория: ${document.getElementById('audienceInput').value}`;
        const taskSuffix = isQuiz ? '_quiz' : '_psy';
        
        this.setLoading(true, "🧠 Проектируем тест...");
        document.getElementById('errorBox').style.display = 'none';

        try {
            const archPrompt = `Тема: "${theme}". ${contextParam}. ${notes ? `Уточнения: "${notes}".` : ""} Создай структуру.`;
            this.state.blueprint = await api.call('architect' + taskSuffix, archPrompt, (isQuiz ? SCHEMAS.quiz_blueprint : SCHEMAS.psy_blueprint), apiKey);
            this.state.blueprint.theme = theme; 

            this.setLoading(true, "✍️ Пишем вопросы...");
            const optionsCount = isQuiz ? document.getElementById('difficultyInput').value : 0;
            const genPrompt = `Тема: ${theme}. Структура: ${JSON.stringify(this.state.blueprint.outcomes)}. Кол-во вопросов: ${count}. ${isQuiz ? `ВАЖНО: ${optionsCount} варианта ответа в каждом вопросе!` : ""} ${notes}`;
            
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

    renderQ() {
        const q = this.state.questions[this.state.step];
        const total = this.state.questions.length;
        const isQuizMode = (this.state.mode === 'quiz' || (this.state.mode === 'duel' && this.state.blueprint.testType === 'quiz'));

        document.getElementById('qNum').innerText = `${this.state.step + 1} / ${total}`;
        document.getElementById('qText').innerText = q.text;
        document.getElementById('progressBar').style.width = ((this.state.step / total) * 100) + '%';
        
        const backBtn = document.getElementById('backBtn');
        backBtn.style.visibility = (!isQuizMode && this.state.step > 0) ? 'visible' : 'hidden';

        const psyDiv = document.getElementById('psyContainer');
        const quizDiv = document.getElementById('quizContainer');

        if (isQuizMode) {
            psyDiv.style.display = 'none';
            quizDiv.style.display = 'flex';
            let html = '';
            q.options.forEach((opt, idx) => {
                html += `<button class="quiz-opt" onclick="app.handleQuizAnswer(${idx}, this)">${opt}</button>`;
            });
            quizDiv.innerHTML = html;
        } else {
            psyDiv.style.display = 'grid';
            quizDiv.style.display = 'none';
            const btns = psyDiv.querySelectorAll('.likert-opt'); 
            btns.forEach(b => b.classList.remove('selected'));
            const prevAns = this.state.answers[this.state.step];
            if (prevAns !== undefined && btns[prevAns-1]) btns[prevAns-1].classList.add('selected');
        }
    },

    answer(val) {
        this.state.answers[this.state.step] = parseInt(val);
        const btns = document.getElementById('psyContainer').querySelectorAll('.likert-opt');
        btns.forEach(b => b.classList.remove('selected'));
        if(btns[val-1]) btns[val-1].classList.add('selected');
        setTimeout(() => this.nextQuestion(), 300);
    },

    handleQuizAnswer(idx, btn) {
        const q = this.state.questions[this.state.step];
        const isCorrect = (idx === q.correctIndex);
        if (isCorrect) { btn.classList.add('correct'); this.state.quizScore++; }
        else { 
            btn.classList.add('wrong');
            const allBtns = document.querySelectorAll('.quiz-opt');
            if(allBtns[q.correctIndex]) allBtns[q.correctIndex].classList.add('correct');
        }
        document.querySelectorAll('.quiz-opt').forEach(b => {
             b.classList.add('disabled');
             b.disabled = true;
        });
        setTimeout(() => this.nextQuestion(), 1200); 
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

    // --- НОВАЯ СИСТЕМА ПОДСЧЁТА (Исправлено) ---
    calc() {
        const outcomes = this.state.blueprint.outcomes;
        const container = document.getElementById('resContent');
        let html = '';
        let winningResultName = "";

        // 1. ВИКТОРИНА
        if (this.state.mode === 'quiz' || (this.state.mode === 'duel' && this.state.blueprint.testType === 'quiz')) {
            const score = this.state.quizScore;
            const total = this.state.questions.length;
            let result = outcomes.find(o => score >= o.minScore && score <= o.maxScore) || outcomes[0];
            winningResultName = result.name;

            let duelBlock = '';
            if (this.state.mode === 'duel') {
                const hostScore = this.state.duelHostScore;
                const hostName = this.state.duelHostName;
                let verdict = "", color = "";
                if (score > hostScore) { verdict = "ТЫ ПОБЕДИЛ! 🏆"; color = "#4caf50"; }
                else if (score === hostScore) { verdict = "НИЧЬЯ! 🤝"; color = "#ffd700"; }
                else { verdict = "ТЫ ПРОИГРАЛ... 💀"; color = "#f44336"; }
                duelBlock = `<div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin:20px 0;">
                    <h3 style="margin:0 0 10px; color:${color};">${verdict}</h3>
                    <div style="display:flex; justify-content:space-around;"><div>👤 Ты: <strong>${score}</strong></div><div>🆚 ${hostName}: <strong>${hostScore}</strong></div></div>
                </div>`;
            }

            html = `<div style="text-align:center;">
                <div style="font-size:14px; color:var(--text-muted); margin-bottom:10px;">ТВОЙ РЕЗУЛЬТАТ</div>
                <h1 style="font-size:56px; margin:0; color:var(--primary);">${score} <span style="font-size:24px; color:var(--text-muted);">/ ${total}</span></h1>
                ${duelBlock}
                <h2 style="margin:15px 0 20px;">${result.name}</h2>
                <p style="font-size:18px;">${result.description}</p>
            </div>`;

        } else {
            // 2. ПСИХОЛОГИЧЕСКИЙ ТЕСТ (Новая система)
            const scores = {};
            const maxPossible = {}; // Максимально возможный балл по каждому исходу
            
            outcomes.forEach(o => {
                scores[o.id] = 0;
                maxPossible[o.id] = 0;
            });

            // Подсчёт с нормализацией
            this.state.questions.forEach((q, idx) => {
                const ans = this.state.answers[idx] !== undefined ? this.state.answers[idx] : 3;
                // Преобразуем ответ 1-5 в баллы 0-10
                const rawScore = (ans - 1) * 2.5; // 1→0, 2→2.5, 3→5, 4→7.5, 5→10
                
                if (q.mapping) {
                    q.mapping.forEach(m => {
                        if (scores[m.outcomeId] !== undefined) {
                            // Учитываем "вес" (если AI передал), но нормализуем
                            const weight = m.weight || 1;
                            const polarity = weight > 0 ? 1 : -1;
                            const finalScore = polarity === 1 ? rawScore : (10 - rawScore);
                            
                            scores[m.outcomeId] += finalScore * Math.abs(weight);
                            maxPossible[m.outcomeId] += 10 * Math.abs(weight); // Максимум за вопрос
                        }
                    });
                }
            });

            // Конвертируем в проценты
            const percentages = {};
            outcomes.forEach(o => {
                if (maxPossible[o.id] > 0) {
                    percentages[o.id] = Math.round((scores[o.id] / maxPossible[o.id]) * 100);
                } else {
                    percentages[o.id] = 0;
                }
            });

            if (this.state.blueprint.testType !== 'dimensional') {
                // Categorical: Сортируем по процентам
                const sorted = outcomes.sort((a,b) => percentages[b.id] - percentages[a.id]);
                const win = sorted[0];
                winningResultName = win.name;

                html = `<div style="text-align:center; padding-bottom: 20px;">
                    <div style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">Твой результат</div>
                    <h2 style="font-size:32px; margin:0 0 10px; color:var(--primary);">${win.name}</h2>
                    <p style="font-size:18px; line-height:1.6;">${win.description}</p>
                    <div style="margin-top:15px; font-size:28px; color:var(--accent); font-weight:bold;">${percentages[win.id]}% совпадение</div>
                </div>
                
                <div class="results-secondary-block">
                    <h4 class="results-secondary-title">Другие варианты:</h4>`;
                
                sorted.slice(1).forEach(o => {
                    const pct = percentages[o.id];
                    html += `
                    <div class="res-item">
                        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;">
                            <span><strong>${o.name}</strong></span>
                            <span style="color:var(--primary); font-weight:600; font-size:15px;">${pct}%</span>
                        </div>
                        <div class="res-bar-bg">
                            <div class="res-bar-fill" style="width:${pct}%"></div>
                        </div>
                    </div>`;
                });
                html += `</div>`;

            } else {
                // Dimensional (Профиль)
                html = `<div style="text-align:center; margin-bottom:25px;"><h2 style="color:var(--primary);">Ваш профиль</h2></div>`;
                outcomes.forEach(o => {
                    const pct = percentages[o.id];
                    html += `<div class="res-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <strong>${o.name}</strong>
                            <span style="color:var(--primary); font-weight:600; font-size:16px;">${pct}%</span>
                        </div>
                        <div class="res-bar-bg">
                            <div class="res-bar-fill" style="width:${pct}%"></div>
                        </div>
                    </div>`;
                });
            }
        }
        
        this.state.lastResultName = winningResultName;

        const isQuiz = (this.state.mode === 'quiz' || (this.state.mode === 'duel' && this.state.blueprint.testType === 'quiz'));
        const shareBtnText = isQuiz ? "⚔️ Бросить вызов" : "📤 Поделиться результатом";

        html += `
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:30px;">
            <button id="saveTestBtn" class="btn" onclick="app.saveTest()" style="flex:1;">💾 Сохранить</button>
            <button id="shareBtn" class="btn" onclick="app.createShareLink()" style="flex:1; background: var(--accent);">${shareBtnText}</button>
        </div>`;
        
        container.innerHTML = html;
    },

    async createShareLink() {
        if(!TINY_TOKEN) return alert("Нужен TinyURL Token!");
        const btn = document.getElementById('shareBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Создаем ссылку...";
        btn.disabled = true;

        try {
            const isQuiz = (this.state.blueprint.testType === 'quiz');
            const score = this.state.quizScore;
            const name = prompt("Твое имя:", "Аноним") || "Аноним";

            const payload = { 
                h: name, 
                s: (isQuiz ? score : 0), 
                r: (isQuiz ? null : this.state.lastResultName),
                t: this.state.blueprint, 
                q: this.state.questions 
            };
            
            if(!payload.t.theme) payload.t.theme = document.getElementById('themeInput').value || "Тест";

            const jsonString = JSON.stringify(payload);
            const compressed = LZString.compressToEncodedURIComponent(jsonString);
            const longUrl = `${window.location.origin}${window.location.pathname}#d=${compressed}`;

            const response = await fetch('https://api.tinyurl.com/create', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TINY_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: longUrl, domain: "tiny.one" })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            
            const msg = isQuiz ? "Ссылка на дуэль готова:" : "Ссылка на тест готова:";
            prompt(msg, data.data.tiny_url);

        } catch (e) {
            console.error(e);
            alert("Ошибка создания ссылки!");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    saveTest() {
        const name = Storage.save(this.state.blueprint, this.state.questions, this.state.blueprint.theme || document.getElementById('themeInput').value);
        alert(`Тест сохранен!`);
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
        if(confirm('Удалить?')) { Storage.delete(id); this.openLibrary(); }
    },

    setView(view) {
        ['setupView', 'testView', 'resultsView', 'libraryView', 'duelView'].forEach(v => {
            const el = document.getElementById(v); if(el) el.style.display = 'none';
        });
        document.getElementById(view + 'View').style.display = 'block';
    },

    setLoading(active, text) {
        const el = document.getElementById('loadingOverlay');
        if(el) { el.style.display = active ? 'flex' : 'none'; if(text) document.getElementById('loadingText').innerText = text; }
    }
};

window.onload = () => app.init();
